package expo.modules.kippaudio.voice

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioDeviceInfo
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.media.ToneGenerator
import android.os.Build
import android.os.Process
import android.os.SystemClock
import android.util.Log
import com.k2fsa.sherpa.onnx.FeatureConfig
import com.k2fsa.sherpa.onnx.KeywordSpotter
import com.k2fsa.sherpa.onnx.KeywordSpotterConfig
import com.k2fsa.sherpa.onnx.OfflineModelConfig
import com.k2fsa.sherpa.onnx.OfflineMoonshineModelConfig
import com.k2fsa.sherpa.onnx.OfflineRecognizer
import com.k2fsa.sherpa.onnx.OfflineRecognizerConfig
import com.k2fsa.sherpa.onnx.OnlineModelConfig
import com.k2fsa.sherpa.onnx.OnlineStream
import com.k2fsa.sherpa.onnx.OnlineTransducerModelConfig
import com.k2fsa.sherpa.onnx.SileroVadModelConfig
import com.k2fsa.sherpa.onnx.Vad
import com.k2fsa.sherpa.onnx.VadModelConfig
import expo.modules.kippaudio.DeviceMapper
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Always-on listening loop: mic -> Silero VAD + wake-word spotter -> (addressed speech) -> Moonshine -> JS.
 *
 * Modes
 *  - Waiting for wake word: speech segments are discarded unless "Hey/Hi/OK KIPP" was spotted in them.
 *  - Conversation: every finished utterance goes to KIPP; ends after [Config.conversationTimeoutMs] of quiet.
 *
 * Turn-taking: an utterance ends after [Config.patienceMs] of silence; if it sounds unfinished ("and…", "um…")
 * we wait [Config.extraPatienceMs] more for the user to continue before answering.
 */
internal class VoiceEngine(
  private val context: Context,
  private val config: Config,
  private val speaker: Speaker,
  private val listener: Listener,
) {
  data class Config(
    val inputDeviceId: Int? = null,
    val patienceMs: Int = 800,
    val extraPatienceMs: Long = 1500,
    val conversationTimeoutMs: Long = 20_000,
  )

  interface Listener {
    fun onState(state: String, inConversation: Boolean)
    fun onWake()
    fun onUtterance(text: String, viaWakeWord: Boolean, speechMs: Long, asrMs: Long)
    fun onSpeech(status: String, error: String?)
    fun onError(code: String, message: String, fatal: Boolean)
  }

  private val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  private val running = AtomicBoolean(false)
  private var thread: Thread? = null

  private var vad: Vad? = null
  private var kws: KeywordSpotter? = null
  private var kwsStream: OnlineStream? = null
  private var asr: OfflineRecognizer? = null

  // State, touched from the capture thread, ASR thread and JS calls.
  @Volatile private var state = "starting"
  @Volatile private var inConversation = false
  @Volatile private var thinking = false
  @Volatile private var lastActivity = 0L
  @Volatile private var wakeHitAt = 0L
  @Volatile private var muteUntil = 0L
  @Volatile private var bargeInAllowed = false
  private var speechStartedAt = 0L

  // Utterance being assembled across VAD segments (patience window).
  private val pending = ArrayList<FloatArray>()
  private var pendingViaWake = false
  private var holdUntil = 0L
  private var pendingSpeechMs = 0L
  private var pendingText = ""
  private var pendingAsrMs = 0L
  @Volatile private var resetKws = false

  // Bluetooth routing we changed and must restore.
  private var savedMode: Int? = null
  private var commDeviceSet = false

  fun start() {
    if (!running.compareAndSet(false, true)) return
    thread = Thread(::run, "kipp-listen").also { it.start() }
  }

  fun stop() {
    if (!running.compareAndSet(true, false)) return
    speaker.stop()
    thread?.join(2000)
  }

  // ---- Calls from JS (via VoiceHub) ----------------------------------------------------------

  /** KIPP's reply: speak it, then keep the conversation open. */
  fun speak(text: String) {
    thinking = false
    bargeInAllowed = headsetOutput()
    speaker.speak(
      text,
      onStart = { setState("speaking"); listener.onSpeech("start", null) },
      onDone = { completed, error ->
        // On the phone speaker, stay deaf briefly so the mic doesn't catch KIPP's own tail.
        muteUntil = SystemClock.elapsedRealtime() + if (bargeInAllowed) 0 else 350
        lastActivity = SystemClock.elapsedRealtime()
        listener.onSpeech(if (error != null) "error" else if (completed) "done" else "interrupted", error)
        if (state == "speaking") setState(if (inConversation) "listening" else "waiting_for_wake")
      },
    )
  }

  /** The turn ended without speech (error, or a reply shown only as text). */
  fun replyFinished() {
    thinking = false
    lastActivity = SystemClock.elapsedRealtime()
    if (state == "thinking") setState(if (inConversation) "listening" else "waiting_for_wake")
  }

  fun endConversation() {
    inConversation = false
    resetKws = true
    thinking = false
    speaker.stop()
    setState("waiting_for_wake")
  }

  fun stopSpeaking() = speaker.stop()

  // ---- Capture loop --------------------------------------------------------------------------

  @SuppressLint("MissingPermission") // RECORD_AUDIO is checked before the service starts
  private fun run() {
    Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
    var record: AudioRecord? = null
    try {
      setState("starting")
      loadModels()
      val input = config.inputDeviceId?.let { id -> am.getDevices(AudioManager.GET_DEVICES_INPUTS).firstOrNull { it.id == id } }
      val bluetooth = input != null && DeviceMapper.isBluetoothCommunication(input.type)
      if (bluetooth) routeBluetooth(input!!)
      val minBuf = AudioRecord.getMinBufferSize(SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
      record = AudioRecord.Builder()
        .setAudioSource(if (bluetooth) MediaRecorder.AudioSource.VOICE_COMMUNICATION else MediaRecorder.AudioSource.VOICE_RECOGNITION)
        .setAudioFormat(AudioFormat.Builder().setSampleRate(SAMPLE_RATE).setChannelMask(AudioFormat.CHANNEL_IN_MONO).setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
        .setBufferSizeInBytes(maxOf(minBuf * 4, SAMPLE_RATE * 2 * 3)) // ~3 s: transcription runs on this thread
        .build()
      if (record.state != AudioRecord.STATE_INITIALIZED) throw VoiceException("MIC_INIT_FAILED", "Couldn't open the microphone.")
      input?.let { record.setPreferredDevice(it) }
      record.startRecording()
      if (record.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
        throw VoiceException("MIC_BUSY", "The microphone is being used by another app.")
      }
      lastActivity = SystemClock.elapsedRealtime()
      setState("waiting_for_wake")

      val pcm = ShortArray(FRAME)
      val floats = FloatArray(FRAME)
      var deadReads = 0
      while (running.get()) {
        val n = record.read(pcm, 0, FRAME)
        if (n <= 0) {
          if (n == AudioRecord.ERROR_DEAD_OBJECT || ++deadReads > 50) throw VoiceException("MIC_LOST", "The microphone stopped (device disconnected or taken by another app).")
          continue
        }
        deadReads = 0
        for (i in 0 until n) floats[i] = pcm[i] / 32768f
        process(if (n == FRAME) floats else floats.copyOf(n))
      }
    } catch (e: VoiceException) {
      listener.onError(e.code, e.message ?: e.code, true)
    } catch (e: Throwable) {
      Log.e(TAG, "listening failed", e)
      listener.onError("LISTEN_FAILED", e.message ?: "Listening stopped unexpectedly.", true)
    } finally {
      running.set(false)
      record?.let { r -> runCatching { r.stop() }; r.release() }
      restoreRouting()
      kwsStream?.release(); kws?.release(); vad?.release(); asr?.release()
      setState("stopped")
    }
  }

  private fun process(samples: FloatArray) {
    val now = SystemClock.elapsedRealtime()
    val speaking = speaker.speaking
    // Half-duplex on the phone speaker: don't listen to ourselves.
    if ((speaking && !bargeInAllowed) || now < muteUntil) {
      vad?.reset()
      return
    }
    val v = vad!!
    v.acceptWaveform(samples)

    // Wake word, only while not in a conversation.
    if (!inConversation) {
      val stream = kwsStream!!
      val spotter = kws!!
      if (resetKws) { resetKws = false; spotter.reset(stream) }
      stream.acceptWaveform(samples, SAMPLE_RATE)
      while (spotter.isReady(stream)) {
        spotter.decode(stream)
        if (spotter.getResult(stream).keyword.isNotBlank()) {
          spotter.reset(stream)
          onWake(now)
        }
      }
    }

    val voiceActive = v.isSpeechDetected()
    if (voiceActive) {
      lastActivity = now
      if (speechStartedAt == 0L) speechStartedAt = now
      // Barge-in (headphones only): the user talks over KIPP for 300 ms -> KIPP stops.
      if (speaking && now - speechStartedAt > 300) speaker.stop()
      if (inConversation && !speaking && state != "hearing") setState("hearing")
      holdUntil = Long.MAX_VALUE // they're still talking; keep waiting
    } else {
      speechStartedAt = 0L
    }

    while (!v.empty()) {
      val segment = v.front().samples
      v.pop()
      onSegment(segment, now)
    }

    if (pending.isNotEmpty() && !voiceActive && now >= holdUntil) finalizeUtterance()

    if (inConversation && !voiceActive && !speaking && !thinking && pending.isEmpty() &&
      now - lastActivity > config.conversationTimeoutMs
    ) {
      inConversation = false
      resetKws = true
      setState("waiting_for_wake")
    }
  }

  private fun onWake(now: Long) {
    wakeHitAt = now
    inConversation = true
    lastActivity = now
    speaker.stop()
    chime()
    listener.onWake()
    setState("hearing")
  }

  private fun onSegment(segment: FloatArray, now: Long) {
    val viaWake = wakeHitAt != 0L && now - wakeHitAt < 15_000
    // Not addressed to KIPP: speech while waiting for the wake word, with no wake word in it.
    if (!inConversation && !viaWake) return
    if (pending.isEmpty()) pendingViaWake = viaWake
    wakeHitAt = 0L
    pending.add(segment)
    pendingSpeechMs += segment.size * 1000L / SAMPLE_RATE
    // Transcribe what we have so far; if it ends mid-thought, give them longer to continue.
    setState("transcribing")
    val (text, asrMs) = transcribe(concat(pending))
    pendingText = text
    pendingAsrMs = asrMs
    holdUntil = if (soundsUnfinished(text)) SystemClock.elapsedRealtime() + config.extraPatienceMs else 0L
  }

  private fun finalizeUtterance() {
    val raw = pendingText
    val viaWake = pendingViaWake
    val speechMs = pendingSpeechMs
    val asrMs = pendingAsrMs
    pending.clear()
    pendingSpeechMs = 0
    pendingText = ""
    holdUntil = 0
    val text = if (viaWake) stripWakePhrase(raw) else raw.trim()
    if (text.isBlank() || !text.any { it.isLetterOrDigit() }) {
      // Only the wake word (or noise): keep listening for the actual request.
      setState(if (inConversation) "listening" else "waiting_for_wake")
      return
    }
    thinking = true
    lastActivity = SystemClock.elapsedRealtime()
    setState("thinking")
    listener.onUtterance(text, viaWake, speechMs, asrMs)
  }

  private fun transcribe(samples: FloatArray): Pair<String, Long> {
    val t0 = SystemClock.elapsedRealtime()
    val recognizer = asr ?: return "" to 0L
    val stream = recognizer.createStream()
    return try {
      stream.acceptWaveform(samples, SAMPLE_RATE)
      recognizer.decode(stream)
      recognizer.getResult(stream).text.trim() to SystemClock.elapsedRealtime() - t0
    } finally {
      stream.release()
    }
  }

  // ---- Setup ---------------------------------------------------------------------------------

  private fun loadModels() {
    if (!ModelStore.allReady(context)) throw VoiceException("MODELS_MISSING", "KIPP's voice models aren't downloaded yet.")
    val vadDir = ModelStore.dir(context, "vad")
    vad = Vad(
      config = VadModelConfig(
        sileroVadModelConfig = SileroVadModelConfig(
          model = File(vadDir, "silero_vad_v5.onnx").path,
          threshold = 0.5f,
          minSilenceDuration = config.patienceMs / 1000f,
          minSpeechDuration = 0.25f,
          windowSize = 512,
          maxSpeechDuration = 30f,
        ),
        sampleRate = SAMPLE_RATE,
        numThreads = 1,
      ),
    )
    val kwsDir = ModelStore.dir(context, "kws")
    val keywords = File(kwsDir, "keywords.txt").apply { writeText(KEYWORDS.joinToString("\n")) }
    val suffix = ModelStore.KWS_SUFFIX
    kws = KeywordSpotter(
      config = KeywordSpotterConfig(
        featConfig = FeatureConfig(sampleRate = SAMPLE_RATE, featureDim = 80),
        modelConfig = OnlineModelConfig(
          transducer = OnlineTransducerModelConfig(
            encoder = File(kwsDir, "encoder-$suffix.int8.onnx").path,
            decoder = File(kwsDir, "decoder-$suffix.onnx").path,
            joiner = File(kwsDir, "joiner-$suffix.int8.onnx").path,
          ),
          tokens = File(kwsDir, "tokens.txt").path,
          numThreads = 1,
        ),
        keywordsFile = keywords.path,
      ),
    )
    kwsStream = kws!!.createStream()
    val asrDir = ModelStore.dir(context, "asr")
    asr = OfflineRecognizer(
      config = OfflineRecognizerConfig(
        modelConfig = OfflineModelConfig(
          moonshine = OfflineMoonshineModelConfig(
            preprocessor = File(asrDir, "preprocess.onnx").path,
            encoder = File(asrDir, "encode.int8.onnx").path,
            uncachedDecoder = File(asrDir, "uncached_decode.int8.onnx").path,
            cachedDecoder = File(asrDir, "cached_decode.int8.onnx").path,
          ),
          tokens = File(asrDir, "tokens.txt").path,
          numThreads = 2,
        ),
      ),
    )
    speaker.warmUp()
  }

  private fun routeBluetooth(input: AudioDeviceInfo) {
    savedMode = am.mode
    am.mode = AudioManager.MODE_IN_COMMUNICATION
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val target = am.availableCommunicationDevices.firstOrNull { DeviceMapper.matchesForCommunication(input, it) }
        ?: am.availableCommunicationDevices.firstOrNull { it.type == input.type }
        ?: throw VoiceException("ROUTE_UNAVAILABLE", "${DeviceMapper.displayName(input)} doesn't offer a microphone to apps.")
      if (!am.setCommunicationDevice(target)) throw VoiceException("ROUTE_REJECTED", "Android refused to use ${DeviceMapper.displayName(input)}'s microphone.")
      commDeviceSet = true
    } else {
      @Suppress("DEPRECATION")
      am.startBluetoothSco()
      commDeviceSet = true
    }
  }

  @Suppress("DEPRECATION")
  private fun restoreRouting() {
    runCatching {
      if (commDeviceSet) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.clearCommunicationDevice() else am.stopBluetoothSco()
      }
      savedMode?.let { am.mode = it }
    }
    commDeviceSet = false
    savedMode = null
  }

  // ---- Helpers -------------------------------------------------------------------------------

  private fun headsetOutput(): Boolean = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any {
    it.type in setOf(
      AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
      AudioDeviceInfo.TYPE_BLUETOOTH_SCO, AudioDeviceInfo.TYPE_BLE_HEADSET, AudioDeviceInfo.TYPE_USB_HEADSET,
    )
  }

  private fun chime() = runCatching {
    ToneGenerator(AudioManager.STREAM_MUSIC, 40).apply {
      startTone(ToneGenerator.TONE_PROP_ACK, 120)
      Thread { Thread.sleep(300); release() }.start()
    }
  }

  private fun setState(s: String) {
    if (state == s) return
    state = s
    listener.onState(s, inConversation)
  }

  val currentState get() = state
  val conversationActive get() = inConversation

  private class VoiceException(val code: String, message: String) : Exception(message)

  companion object {
    private const val TAG = "KippVoice"
    const val SAMPLE_RATE = 16_000
    private const val FRAME = 1024 // 64 ms

    /** Tokens for the GigaSpeech BPE wake-word model (generated from its bpe.model). */
    private val KEYWORDS = listOf(
      "▁HE Y ▁K I PP @HEY_KIPP",
      "▁HE Y ▁K I P @HEY_KIPP",
      "▁HI ▁K I PP @HI_KIPP",
      "▁O K ▁K I PP @OK_KIPP",
    )

    private val WAKE_PREFIX = Regex(
      "^\\s*(?:(?:hey|hi|hay|hei|ok|okay|a|yo)[\\s,.!]*)?(?:kipp?|kipper|keep|kit|kip\\.|skip)\\b[\\s,.!?:-]*",
      RegexOption.IGNORE_CASE,
    )

    fun stripWakePhrase(text: String): String = text.trim().replaceFirst(WAKE_PREFIX, "").trim()

    private val TRAILING = setOf(
      "and", "but", "so", "or", "because", "um", "uh", "er", "like", "the", "a", "an", "to", "of", "with", "for",
      "if", "then", "that", "which", "my", "your", "is", "are", "i", "i'm", "we", "also", "about", "maybe",
    )

    /** Heuristic: does the transcript end mid-thought? */
    fun soundsUnfinished(text: String): Boolean {
      val t = text.trim()
      if (t.isEmpty()) return true
      if (t.endsWith(",") || t.endsWith("...") || t.endsWith("…")) return true
      val last = t.trimEnd('.', '!', '?', ',', ' ').substringAfterLast(' ').lowercase()
      return last in TRAILING
    }

    fun concat(parts: List<FloatArray>): FloatArray {
      val out = FloatArray(parts.sumOf { it.size })
      var o = 0
      for (p in parts) { p.copyInto(out, o); o += p.size }
      return out
    }
  }
}
