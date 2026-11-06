package expo.modules.kippaudio

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioDeviceInfo
import android.media.AudioFocusRequest
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioRouting
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.Process
import android.os.SystemClock
import android.util.Log
import java.io.File
import java.io.RandomAccessFile
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicReference
import kotlin.math.abs
import kotlin.math.max

/**
 * One foreground microphone test: route request -> AudioRecord -> 16-bit mono WAV in app cache -> restore.
 *
 * Routing strategy
 *  - Bluetooth HFP/SCO and LE Audio, API 31+: MODE_IN_COMMUNICATION + setCommunicationDevice(matching output).
 *    Android then picks the paired input by policy; we verify it via AudioRecord.getRoutedDevice().
 *  - Bluetooth SCO, API 24-30: MODE_IN_COMMUNICATION + startBluetoothSco(), waiting for SCO_AUDIO_STATE_CONNECTED.
 *  - LE Audio below API 31: unsupported (no public routing API) -> explicit error.
 *  - Wired / USB / built-in: AudioRecord.setPreferredDevice() only; no global audio state is touched.
 * If the capture route doesn't match the request we stop and report, never silently use another mic.
 */
internal class CaptureSession(
  private val context: Context,
  private val am: AudioManager,
  val requested: AudioDeviceInfo,
  private val outDir: File,
  private val targetSampleRate: Int,
  private val maxDurationMs: Long,
  private val mainHandler: Handler,
  private val emit: (String, Map<String, Any?>) -> Unit,
  private val onClosed: (Map<String, Any?>) -> Unit,
) {
  private val isBluetooth = DeviceMapper.isBluetoothCommunication(requested.type)
  private val stopCode = AtomicReference<String?>(null)
  @Volatile private var stopMessage: String? = null
  private val finalized = AtomicBoolean(false)
  private val restored = AtomicBoolean(false)
  private val done = CountDownLatch(1)
  @Volatile private var result: Map<String, Any?>? = null

  private var savedMode: Int? = null
  private var commDeviceSet = false
  private var scoStarted = false
  private var scoReceiver: BroadcastReceiver? = null
  private var focusRequest: AudioFocusRequest? = null
  private var legacyFocusListener: AudioManager.OnAudioFocusChangeListener? = null

  private var record: AudioRecord? = null
  private var raf: RandomAccessFile? = null
  private var thread: Thread? = null
  private var routingListener: AudioRouting.OnRoutingChangedListener? = null
  var filePath: String? = null
    private set

  @Volatile var actualInputId: String? = null
    private set
  @Volatile private var actualDevice: AudioDeviceInfo? = null
  @Volatile private var routeConfirmed = false
  private var sampleRate = 0
  private var audioSource = "MIC"
  @Volatile private var bytes = 0L
  @Volatile private var readErrors = 0
  @Volatile private var zeroReads = 0
  @Volatile private var maxPeak = 0
  private val events = mutableListOf<Map<String, Any?>>()

  private var tRouteRequest = 0L
  private var tRecordStart = 0L
  private var commConfirmMs: Long? = null
  private var captureConfirmMs: Long? = null
  private var recorderInitMs: Long? = null

  // ---- Start ---------------------------------------------------------------------------------

  /** Blocks (off the JS thread) until capture has started. Throws KippAudioException with a diagnostic. */
  fun start(): Map<String, Any?> {
    try {
      tRouteRequest = SystemClock.elapsedRealtime()
      requestFocus()
      if (isBluetooth) routeBluetooth()
      createRecorder()
      startCapture()
    } catch (e: Throwable) {
      releaseRecorder()
      raf?.runCatching { close() }
      filePath?.let { File(it).delete() }
      restoreRouting()
      done.countDown()
      throw if (e is KippAudioException) e else KippAudioException("START_FAILED", e.message ?: "Could not start the microphone.")
    }
    return mapOf(
      "requestedInput" to DeviceMapper.toMap(requested, null),
      "sampleRate" to sampleRate,
      "channelCount" to 1,
      "encoding" to "PCM_16BIT",
      "audioSource" to audioSource,
      "communicationRouteConfirmMs" to commConfirmMs,
      "recorderInitMs" to recorderInitMs,
      "maxDurationMs" to maxDurationMs,
    )
  }

  private fun fail(code: String, message: String): Nothing = throw KippAudioException(code, message)

  private val name get() = DeviceMapper.displayName(requested)

  private fun requestFocus() {
    val granted: Int
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
        .setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(if (isBluetooth) AudioAttributes.USAGE_VOICE_COMMUNICATION else AudioAttributes.USAGE_ASSISTANT)
            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
            .build(),
        )
        .setOnAudioFocusChangeListener(::onFocusChange, mainHandler)
        .build()
      focusRequest = req
      granted = am.requestAudioFocus(req)
    } else {
      val l = AudioManager.OnAudioFocusChangeListener(::onFocusChange)
      legacyFocusListener = l
      @Suppress("DEPRECATION")
      granted = am.requestAudioFocus(l, AudioManager.STREAM_VOICE_CALL, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_EXCLUSIVE)
    }
    if (granted != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
      fail("AUDIO_FOCUS_DENIED", "Android refused audio focus — a phone call or another app is using audio right now.")
    }
  }

  private fun onFocusChange(change: Int) {
    if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
      requestStop("INTERRUPTED", "Recording was interrupted by a phone call or another app taking audio.")
    }
  }

  private fun routeBluetooth() {
    savedMode = am.mode
    am.mode = AudioManager.MODE_IN_COMMUNICATION
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val target = am.availableCommunicationDevices.firstOrNull { DeviceMapper.matchesForCommunication(requested, it) }
        ?: am.availableCommunicationDevices.firstOrNull { it.type == requested.type }
        ?: fail(
          "ROUTE_UNAVAILABLE",
          "$name is connected, but Android doesn't offer it for call audio, so its microphone can't be used. It may support playback only.",
        )
      if (!am.setCommunicationDevice(target)) {
        fail("ROUTE_REJECTED", "Android rejected the request to route call audio to $name.")
      }
      commDeviceSet = true
      addEvent("route_requested", "Requested communication device ${DeviceMapper.displayName(target)}")
      if (!waitUntil(4000) { am.communicationDevice?.id == target.id }) {
        val now = am.communicationDevice?.let { DeviceMapper.displayName(it) } ?: "none"
        fail(
          "ROUTE_NOT_CONFIRMED",
          "$name didn't accept the hands-free audio connection within 4 s (current call device: $now). The headset may have refused the HFP/LE Audio voice profile.",
        )
      }
      commConfirmMs = SystemClock.elapsedRealtime() - tRouteRequest
      addEvent("route_accepted", "Android switched call audio to ${DeviceMapper.displayName(target)}")
    } else if (requested.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO) {
      if (!am.isBluetoothScoAvailableOffCall) fail("SCO_UNSUPPORTED", "This phone doesn't support Bluetooth headset microphones outside of calls.")
      routeScoLegacy()
    } else {
      fail("UNSUPPORTED_ANDROID", "Bluetooth LE Audio microphones need Android 12 or newer.")
    }
  }

  @SuppressLint("UnspecifiedRegisterReceiverFlag") // only runs on API < 31, where flags don't exist
  @Suppress("DEPRECATION")
  private fun routeScoLegacy() {
    val connected = CountDownLatch(1)
    var refused = false
    var sawConnecting = false
    val receiver = object : BroadcastReceiver() {
      override fun onReceive(c: Context?, intent: Intent?) {
        when (intent?.getIntExtra(AudioManager.EXTRA_SCO_AUDIO_STATE, -1)) {
          AudioManager.SCO_AUDIO_STATE_CONNECTED -> connected.countDown()
          AudioManager.SCO_AUDIO_STATE_CONNECTING -> sawConnecting = true
          AudioManager.SCO_AUDIO_STATE_ERROR -> { refused = true; connected.countDown() }
          AudioManager.SCO_AUDIO_STATE_DISCONNECTED -> if (sawConnecting) { refused = true; connected.countDown() }
        }
      }
    }
    context.registerReceiver(receiver, IntentFilter(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED))
    scoReceiver = receiver
    am.startBluetoothSco()
    scoStarted = true
    addEvent("route_requested", "Requested Bluetooth SCO audio")
    val ok = connected.await(4, TimeUnit.SECONDS) && !refused
    if (!ok) fail("ROUTE_NOT_CONFIRMED", "$name refused or timed out on the hands-free (SCO) audio connection.")
    commConfirmMs = SystemClock.elapsedRealtime() - tRouteRequest
    addEvent("route_accepted", "Bluetooth SCO audio connected")
  }

  @SuppressLint("MissingPermission") // RECORD_AUDIO checked by the module before start
  private fun createRecorder() {
    val t0 = SystemClock.elapsedRealtime()
    // VOICE_COMMUNICATION follows the communication route (required for SCO/LE). VOICE_RECOGNITION is
    // tuned for ASR (no AGC) and honours setPreferredDevice for local mics.
    val source = if (isBluetooth) MediaRecorder.AudioSource.VOICE_COMMUNICATION else MediaRecorder.AudioSource.VOICE_RECOGNITION
    audioSource = if (isBluetooth) "VOICE_COMMUNICATION" else "VOICE_RECOGNITION"
    // Prefer the target rate; fall back without assuming Bluetooth supports wideband.
    val rates = listOf(targetSampleRate, 16000, 48000, 44100, 8000).distinct()
    for (rate in rates) {
      val minBuf = AudioRecord.getMinBufferSize(rate, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
      if (minBuf <= 0) continue
      val r = try {
        AudioRecord.Builder()
          .setAudioSource(source)
          .setAudioFormat(
            AudioFormat.Builder()
              .setSampleRate(rate)
              .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
              .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
              .build(),
          )
          .setBufferSizeInBytes(max(minBuf * 2, rate / 5 * 2)) // >= 200 ms of headroom
          .build()
      } catch (e: Exception) {
        null
      }
      if (r == null) continue
      if (r.state != AudioRecord.STATE_INITIALIZED) { r.release(); continue }
      record = r
      sampleRate = r.sampleRate
      break
    }
    val r = record ?: fail("RECORDER_INIT_FAILED", "Android couldn't open a 16-bit mono recorder for $name at any supported sample rate.")
    if (!r.setPreferredDevice(requested)) addEvent("preferred_rejected", "AudioRecord rejected the preferred device")
    val listener = AudioRouting.OnRoutingChangedListener { router -> onRoutingChanged(router.routedDevice) }
    r.addOnRoutingChangedListener(listener, mainHandler)
    routingListener = listener
    recorderInitMs = SystemClock.elapsedRealtime() - t0
  }

  private fun startCapture() {
    val file = File(outDir, "kipp-mic-test-${System.currentTimeMillis()}.wav")
    filePath = file.path
    raf = RandomAccessFile(file, "rw").apply { setLength(0); write(ByteArray(44)) }
    val r = record!!
    try {
      r.startRecording()
    } catch (e: IllegalStateException) {
      fail("RECORDER_START_FAILED", "The microphone couldn't start: ${e.message}")
    }
    if (r.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
      fail("RECORDER_START_FAILED", "The microphone is in use by another app or blocked by the system.")
    }
    tRecordStart = SystemClock.elapsedRealtime()
    addEvent("recording_started", "Recording at $sampleRate Hz")
    thread = Thread(::captureLoop, "kipp-audio-capture").also { it.start() }
  }

  // ---- Capture -------------------------------------------------------------------------------

  private fun captureLoop() {
    Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO)
    val r = record ?: return
    val out = raf ?: return
    val buf = ByteArray(max(sampleRate / 20, 160) * 2) // ~50 ms
    val maxBytes = sampleRate.toLong() * 2 * maxDurationMs / 1000
    var consecutiveErrors = 0
    var lastEmit = 0L
    var unverifiedNoted = false
    try {
      while (stopCode.get() == null) {
        val n = r.read(buf, 0, buf.size)
        when {
          n > 0 -> {
            val take = if (bytes + n > maxBytes) (maxBytes - bytes).toInt() else n // partial reads are fine
            out.write(buf, 0, take)
            bytes += take
            maxPeak = max(maxPeak, peak(buf, take))
            consecutiveErrors = 0
            if (!routeConfirmed) checkRoute(r.routedDevice)
            if (!routeConfirmed && !unverifiedNoted && SystemClock.elapsedRealtime() - tRecordStart > 2000) {
              unverifiedNoted = true
              addEvent("route_unverified", "Android hasn't reported which microphone is capturing")
            }
            if (bytes >= maxBytes) requestStop("MAX_DURATION", null)
          }
          n == 0 -> zeroReads++
          n == AudioRecord.ERROR_DEAD_OBJECT ->
            requestStop("AUDIO_DEAD_OBJECT", "Android closed the microphone stream (device disconnected or taken by another app).")
          else -> {
            readErrors++
            if (++consecutiveErrors >= 10) requestStop("READ_FAILED", "The microphone returned repeated read errors (code $n).")
          }
        }
        val now = SystemClock.elapsedRealtime()
        if (now - lastEmit >= 250) {
          lastEmit = now
          emit("onRecordingStatus", status())
        }
      }
    } catch (e: Throwable) {
      requestStop("CAPTURE_FAILED", e.message ?: "Capture failed.")
    } finally {
      finish()
    }
  }

  private fun peak(buf: ByteArray, len: Int): Int {
    var p = 0
    var i = 0
    while (i + 1 < len) {
      val s = (buf[i].toInt() and 0xff) or (buf[i + 1].toInt() shl 8)
      p = max(p, abs(s.toShort().toInt()))
      i += 2
    }
    return p
  }

  private fun matches(d: AudioDeviceInfo): Boolean =
    d.id == requested.id || (d.type == requested.type && d.productName == requested.productName)

  private fun checkRoute(routed: AudioDeviceInfo?) {
    if (routed == null) return
    actualDevice = routed
    actualInputId = routed.id.toString()
    if (matches(routed)) {
      routeConfirmed = true
      captureConfirmMs = SystemClock.elapsedRealtime() - tRouteRequest
      addEvent("capture_confirmed", "Capturing from ${DeviceMapper.displayName(routed)}")
    } else {
      requestStop(
        "ROUTE_MISMATCH",
        "Requested $name, but Android is capturing from ${DeviceMapper.displayName(routed)}. Stopped instead of silently switching microphones.",
      )
    }
  }

  private fun onRoutingChanged(routed: AudioDeviceInfo?) {
    if (finalized.get()) return
    addEvent("route_changed", "Capture route → ${routed?.let { DeviceMapper.displayName(it) } ?: "none"}")
    if (!routeConfirmed) { checkRoute(routed); return }
    if (routed != null && !matches(routed)) {
      actualDevice = routed
      actualInputId = routed.id.toString()
      requestStop("ROUTE_CHANGED", "Capture moved from $name to ${DeviceMapper.displayName(routed)} during recording.")
    }
  }

  fun onDevicesRemoved(removed: Array<out AudioDeviceInfo>) {
    if (removed.any { it.id == requested.id || (isBluetooth && it.type == requested.type && it.productName == requested.productName) }) {
      requestStop("DEVICE_DISCONNECTED", "$name disconnected during recording.")
    }
  }

  // ---- Stop / cleanup ------------------------------------------------------------------------

  fun requestStop(code: String, message: String?) {
    if (stopCode.compareAndSet(null, code)) {
      stopMessage = message
      if (message != null) addEvent("stop", message)
    }
  }

  /** Request stop and wait for the WAV to be finalized and routing restored. Safe to call repeatedly. */
  fun stop(code: String, message: String?): Map<String, Any?>? {
    requestStop(code, message)
    val t = thread
    if (t != null && t !== Thread.currentThread()) {
      t.join(1500)
      if (t.isAlive) {
        record?.runCatching { stop() } // unblocks a stuck read()
        t.join(1000)
      }
    }
    done.await(500, TimeUnit.MILLISECONDS)
    return result
  }

  private fun finish() {
    if (!finalized.compareAndSet(false, true)) return
    val durationMs = if (sampleRate > 0) bytes * 1000 / (sampleRate * 2L) else 0L
    releaseRecorder()
    try {
      raf?.let { writeWavHeader(it, bytes); it.close() }
    } catch (e: Exception) {
      requestStop("FILE_FAILED", "Couldn't save the recording: ${e.message}")
    }
    restoreRouting()
    val code = stopCode.get() ?: "USER_STOPPED"
    val ok = code == "USER_STOPPED" || code == "MAX_DURATION"
    if (bytes == 0L) filePath?.let { File(it).delete() }
    val res = mapOf(
      "status" to if (ok) "completed" else if (code == "INTERRUPTED" || code == "APP_BACKGROUNDED") "interrupted" else "failed",
      "stopCode" to code,
      "error" to if (ok) null else stopMessage,
      "filePath" to if (bytes > 0) "file://$filePath" else null,
      "durationMs" to durationMs,
      "bytes" to bytes,
      "sampleRate" to sampleRate,
      "channelCount" to 1,
      "encoding" to "PCM_16BIT",
      "audioSource" to audioSource,
      "requestedInput" to DeviceMapper.toMap(requested, null),
      "actualInput" to actualDevice?.let { DeviceMapper.toMap(it, null) },
      "routeConfirmed" to routeConfirmed,
      "communicationRouteConfirmMs" to commConfirmMs,
      "captureConfirmMs" to captureConfirmMs,
      "recorderInitMs" to recorderInitMs,
      "readErrors" to readErrors,
      "zeroReads" to zeroReads,
      "peakLevel" to maxPeak / 32768.0,
      "events" to synchronized(events) { events.toList() },
    )
    result = res
    done.countDown()
    Log.i(TAG, "test finished code=$code bytes=$bytes rate=$sampleRate confirmed=$routeConfirmed")
    onClosed(res)
  }

  private fun releaseRecorder() {
    val r = record ?: return
    record = null
    routingListener?.let { r.removeOnRoutingChangedListener(it) }
    routingListener = null
    r.runCatching { if (recordingState == AudioRecord.RECORDSTATE_RECORDING) stop() }
    r.release()
  }

  @Suppress("DEPRECATION")
  private fun restoreRouting() {
    if (!restored.compareAndSet(false, true)) return
    runCatching {
      if (commDeviceSet && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.clearCommunicationDevice()
      if (scoStarted) am.stopBluetoothSco()
      scoReceiver?.let { context.unregisterReceiver(it) }
      savedMode?.let { am.mode = it }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) focusRequest?.let { am.abandonAudioFocusRequest(it) }
      else legacyFocusListener?.let { am.abandonAudioFocus(it) }
    }.onFailure { Log.w(TAG, "restoreRouting: ${it.message}") }
    scoReceiver = null
  }

  // ---- Helpers -------------------------------------------------------------------------------

  private fun status(): Map<String, Any?> = mapOf(
    "elapsedMs" to if (sampleRate > 0) bytes * 1000 / (sampleRate * 2L) else 0L,
    "bytes" to bytes,
    "peakLevel" to maxPeak / 32768.0,
    "actualInputId" to actualInputId,
    "routeConfirmed" to routeConfirmed,
    "readErrors" to readErrors,
  )

  private fun addEvent(type: String, message: String) {
    val e = mapOf("type" to type, "message" to message, "atMs" to SystemClock.elapsedRealtime() - tRouteRequest)
    synchronized(events) { events.add(e) }
    emit("onRouteEvent", e)
  }

  private fun waitUntil(timeoutMs: Long, cond: () -> Boolean): Boolean {
    val end = SystemClock.elapsedRealtime() + timeoutMs
    while (SystemClock.elapsedRealtime() < end) {
      if (cond()) return true
      Thread.sleep(25)
    }
    return cond()
  }

  private fun writeWavHeader(f: RandomAccessFile, dataLen: Long) {
    val byteRate = sampleRate * 2
    val h = java.nio.ByteBuffer.allocate(44).order(java.nio.ByteOrder.LITTLE_ENDIAN)
    h.put("RIFF".toByteArray()).putInt((36 + dataLen).toInt()).put("WAVE".toByteArray())
    h.put("fmt ".toByteArray()).putInt(16).putShort(1).putShort(1).putInt(sampleRate).putInt(byteRate).putShort(2).putShort(16)
    h.put("data".toByteArray()).putInt(dataLen.toInt())
    f.seek(0)
    f.write(h.array())
  }

  companion object { private const val TAG = "KippAudio" }
}
