package expo.modules.kippaudio.voice

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioTrack
import android.os.Build
import android.util.Log
import com.k2fsa.sherpa.onnx.GenerationConfig
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import java.io.File
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicInteger

/**
 * KIPP's voice: Kokoro (on-device neural TTS) streamed sentence-by-sentence into an AudioTrack, so speech
 * starts after the first sentence is synthesized rather than the whole reply.
 */
internal class Speaker(private val context: Context) {
  private val executor = Executors.newSingleThreadExecutor { Thread(it, "kipp-tts").apply { priority = Thread.MAX_PRIORITY } }
  private val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
  @Volatile private var tts: OfflineTts? = null
  @Volatile private var track: AudioTrack? = null
  /** Incremented to cancel the utterance currently being generated/played. */
  private val generation = AtomicInteger(0)
  @Volatile var speaking = false
    private set
  var voiceId = 3 // af_heart
  var speed = 1.0f

  private fun load(): OfflineTts {
    tts?.let { return it }
    val dir = ModelStore.dir(context, "tts")
    val config = OfflineTtsConfig(
      model = OfflineTtsModelConfig(
        kokoro = OfflineTtsKokoroModelConfig(
          model = File(dir, "model.int8.onnx").path,
          voices = File(dir, "voices.bin").path,
          tokens = File(dir, "tokens.txt").path,
          dataDir = File(dir, "espeak-ng-data").path, // espeak-ng pronounces words missing from the lexicon
          lexicon = File(dir, "lexicon-us-en.txt").path,
        ),
        numThreads = 2,
      ),
      maxNumSentences = 1,
    )
    return OfflineTts(config = config).also { tts = it }
  }

  /** Load the model ahead of the first reply (takes a second or two). */
  fun warmUp() = executor.execute { runCatching { load() }.onFailure { Log.w(TAG, "TTS warm-up failed: ${it.message}") } }

  /**
   * Speak [text]. Any current speech is cut off. [onDone] gets true if it finished, false if interrupted
   * or failed (with an error message).
   */
  fun speak(text: String, onStart: () -> Unit, onDone: (completed: Boolean, error: String?) -> Unit) {
    val myGen = generation.incrementAndGet()
    stopTrack()
    executor.execute {
      if (myGen != generation.get()) return@execute onDone(false, null)
      var focus: AudioFocusRequest? = null
      try {
        val engine = load()
        val rate = engine.sampleRate()
        val minBuf = AudioTrack.getMinBufferSize(rate, AudioFormat.CHANNEL_OUT_MONO, AudioFormat.ENCODING_PCM_FLOAT)
        val t = AudioTrack.Builder()
          .setAudioAttributes(
            AudioAttributes.Builder()
              .setUsage(AudioAttributes.USAGE_ASSISTANT)
              .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
              .build(),
          )
          .setAudioFormat(
            AudioFormat.Builder()
              .setSampleRate(rate)
              .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
              .setEncoding(AudioFormat.ENCODING_PCM_FLOAT)
              .build(),
          )
          .setBufferSizeInBytes(maxOf(minBuf, rate / 5 * 4))
          .setTransferMode(AudioTrack.MODE_STREAM)
          .build()
        track = t
        focus = requestDuck()
        t.play()
        speaking = true
        onStart()
        var wrote = 0
        engine.generateWithConfigAndCallback(text, GenerationConfig(sid = voiceId, speed = speed)) { samples ->
          if (myGen != generation.get()) return@generateWithConfigAndCallback 0 // stop synthesis
          t.write(samples, 0, samples.size, AudioTrack.WRITE_BLOCKING)
          wrote += samples.size
          1
        }
        val completed = myGen == generation.get()
        if (completed && wrote > 0) {
          // Let the buffered tail play out before reporting done.
          val endFrame = wrote
          val deadline = System.currentTimeMillis() + 2000 + wrote * 1000L / rate
          while (myGen == generation.get() && t.playbackHeadPosition < endFrame && System.currentTimeMillis() < deadline) {
            Thread.sleep(20)
          }
        }
        finish(t, focus)
        onDone(myGen == generation.get(), null)
      } catch (e: Throwable) {
        Log.w(TAG, "speak failed: ${e.message}")
        track?.let { finish(it, focus) }
        onDone(false, e.message ?: "Speech failed")
      }
    }
  }

  /** Cut off current speech immediately (barge-in, user tapped stop). */
  fun stop() {
    generation.incrementAndGet()
    stopTrack()
  }

  private fun stopTrack() {
    track?.runCatching { pause(); flush() }
  }

  private fun finish(t: AudioTrack, focus: AudioFocusRequest?) {
    speaking = false
    runCatching { t.stop() }
    t.release()
    if (track === t) track = null
    if (focus != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) am.abandonAudioFocusRequest(focus)
  }

  /** Lower (not pause) whatever else is playing while KIPP talks. */
  private fun requestDuck(): AudioFocusRequest? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null
    val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
      .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ASSISTANT).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
      .build()
    am.requestAudioFocus(req)
    return req
  }

  fun release() {
    stop()
    executor.execute {
      tts?.release()
      tts = null
    }
    executor.shutdown()
  }

  companion object { private const val TAG = "KippSpeaker" }
}
