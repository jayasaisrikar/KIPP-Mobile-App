package expo.modules.kippaudio

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.util.concurrent.Executor

class KippAudioException(code: String, message: String) : CodedException(code, message, null)

/**
 * Android audio-device discovery, microphone routing and a foreground-only capture test.
 *
 * Raw PCM never crosses the JS bridge: JS receives device lists, state transitions, ~4 Hz status
 * (elapsed time, byte count, peak level) and the final WAV file path.
 */
class KippAudioModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()
  private val audioManager: AudioManager
    get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  private val mainHandler = Handler(Looper.getMainLooper())
  private val lock = Any()
  private var session: CaptureSession? = null
  private var lastResult: Map<String, Any?>? = null
  private var deviceCallback: AudioDeviceCallback? = null
  private var commListener: Any? = null // AudioManager.OnCommunicationDeviceChangedListener (API 31+)

  private val recordingsDir: File
    get() = File(context.cacheDir, "kipp-audio-test").apply { mkdirs() }

  override fun definition() = ModuleDefinition {
    Name("KippAudio")

    Events("onDevicesChanged", "onRecordingStatus", "onRouteEvent", "onRecordingFinished")

    OnCreate {
      // Test recordings are throwaway. Anything left here comes from a test the app was killed during.
      deleteAllRecordingsInternal()
      registerDeviceObservers()
    }

    OnDestroy {
      synchronized(lock) { session }?.stop("APP_CLOSED", "KIPP closed during the test.")
      unregisterDeviceObservers()
    }

    OnActivityEntersBackground {
      // This milestone is foreground-only. Never keep the microphone open behind the user's back.
      synchronized(lock) { session }?.requestStop(
        "APP_BACKGROUNDED",
        "Recording stopped because KIPP left the screen. Background capture is not supported yet.",
      )
    }

    Function("getAndroidSdkInt") { Build.VERSION.SDK_INT }

    AsyncFunction("getRoutingState") { snapshot() }

    AsyncFunction("startTest") { deviceId: String, sampleRate: Int, maxDurationMs: Int ->
      if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
        throw KippAudioException("PERMISSION_DENIED", "Microphone permission is not granted.")
      }
      synchronized(lock) {
        if (session != null) throw KippAudioException("ALREADY_RECORDING", "A test is already recording.")
      }
      val id = deviceId.toIntOrNull()
      val device = audioManager.getDevices(AudioManager.GET_DEVICES_INPUTS).firstOrNull { it.id == id }
        ?: throw KippAudioException("DEVICE_NOT_FOUND", "That microphone is no longer connected.")

      val s = CaptureSession(
        context = context,
        am = audioManager,
        requested = device,
        outDir = recordingsDir,
        targetSampleRate = sampleRate.coerceIn(8000, 48000),
        maxDurationMs = maxDurationMs.coerceIn(1000, 60000).toLong(),
        mainHandler = mainHandler,
        emit = { name, body -> sendEvent(name, body) },
        onClosed = { result ->
          synchronized(lock) {
            lastResult = result
            session = null
          }
          sendEvent("onRecordingFinished", result)
        },
      )
      synchronized(lock) { session = s }
      try {
        s.start()
      } catch (e: Throwable) {
        synchronized(lock) { if (session === s) session = null }
        throw e
      }
    }

    AsyncFunction("stopTest") {
      val s = synchronized(lock) { session }
      // Idempotent: stopping twice (or after auto-stop) returns the last result.
      s?.stop("USER_STOPPED", null) ?: synchronized(lock) { lastResult }
    }

    AsyncFunction("deleteRecording") { path: String ->
      val file = File(path.removePrefix("file://")).canonicalFile
      if (file.parentFile?.canonicalPath != recordingsDir.canonicalPath) {
        throw KippAudioException("INVALID_PATH", "Only KIPP test recordings can be deleted here.")
      }
      synchronized(lock) {
        if (lastResult?.get("filePath") == "file://${file.path}" || lastResult?.get("filePath") == path) lastResult = null
      }
      file.delete() || !file.exists()
    }

    AsyncFunction("deleteAllRecordings") {
      synchronized(lock) { lastResult = null }
      deleteAllRecordingsInternal()
    }
  }

  private fun deleteAllRecordingsInternal(): Int {
    val active = synchronized(lock) { session?.filePath }
    return recordingsDir.listFiles()?.count { it.path != active && it.delete() } ?: 0
  }

  // ---- Discovery -----------------------------------------------------------------------------

  private fun snapshot(): Map<String, Any?> {
    val t0 = SystemClock.elapsedRealtimeNanos()
    val am = audioManager
    val inputs = am.getDevices(AudioManager.GET_DEVICES_INPUTS).filter { DeviceMapper.isUserFacing(it) }
    val outputs = am.getDevices(AudioManager.GET_DEVICES_OUTPUTS).filter { DeviceMapper.isUserFacing(it) }
    val comm = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.availableCommunicationDevices else null
    val commCurrent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) am.communicationDevice else null
    val s = synchronized(lock) { session }
    val discoveryMs = (SystemClock.elapsedRealtimeNanos() - t0) / 1_000_000.0
    return mapOf(
      "availableInputs" to inputs.map { DeviceMapper.toMap(it, DeviceMapper.communicationCapable(it, comm)) },
      "availableOutputs" to outputs.map { d -> DeviceMapper.toMap(d, comm?.any { it.id == d.id }) },
      "communicationDeviceId" to commCurrent?.id?.toString(),
      "requestedInputId" to s?.requested?.id?.toString(),
      "actualInputId" to s?.actualInputId,
      "isRecording" to (s != null),
      "androidSdkInt" to Build.VERSION.SDK_INT,
      "discoveryMs" to discoveryMs,
    )
  }

  private fun emitDevices() = sendEvent("onDevicesChanged", snapshot())

  private fun registerDeviceObservers() {
    val am = audioManager
    val cb = object : AudioDeviceCallback() {
      override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>) = emitDevices()
      override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>) {
        synchronized(lock) { session }?.onDevicesRemoved(removedDevices)
        emitDevices()
      }
    }
    am.registerAudioDeviceCallback(cb, mainHandler)
    deviceCallback = cb
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val listener = AudioManager.OnCommunicationDeviceChangedListener { emitDevices() }
      am.addOnCommunicationDeviceChangedListener(Executor { mainHandler.post(it) }, listener)
      commListener = listener
    }
  }

  private fun unregisterDeviceObservers() {
    val am = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
    deviceCallback?.let { am.unregisterAudioDeviceCallback(it) }
    deviceCallback = null
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      (commListener as? AudioManager.OnCommunicationDeviceChangedListener)?.let { am.removeOnCommunicationDeviceChangedListener(it) }
    }
    commListener = null
  }
}

internal object DeviceMapper {
  private val hidden = setOf(
    AudioDeviceInfo.TYPE_TELEPHONY,
    AudioDeviceInfo.TYPE_REMOTE_SUBMIX,
    AudioDeviceInfo.TYPE_FM,
    AudioDeviceInfo.TYPE_FM_TUNER,
    AudioDeviceInfo.TYPE_TV_TUNER,
    AudioDeviceInfo.TYPE_IP,
    AudioDeviceInfo.TYPE_BUS,
  )

  fun isUserFacing(d: AudioDeviceInfo) = d.type !in hidden

  /** AudioDeviceInfo.getAddress() only exists on API 28+. */
  fun address(d: AudioDeviceInfo): String =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) d.address.orEmpty() else ""

  fun isBluetoothCommunication(type: Int) =
    type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO || type == AudioDeviceInfo.TYPE_BLE_HEADSET

  fun category(type: Int): String = when (type) {
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO, AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_BLE_HEADSET,
    AudioDeviceInfo.TYPE_BLE_SPEAKER, AudioDeviceInfo.TYPE_BLE_BROADCAST, AudioDeviceInfo.TYPE_HEARING_AID -> "bluetooth"
    AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES, AudioDeviceInfo.TYPE_LINE_ANALOG,
    AudioDeviceInfo.TYPE_AUX_LINE -> "wired"
    AudioDeviceInfo.TYPE_USB_DEVICE, AudioDeviceInfo.TYPE_USB_HEADSET, AudioDeviceInfo.TYPE_USB_ACCESSORY -> "usb"
    AudioDeviceInfo.TYPE_BUILTIN_MIC, AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, AudioDeviceInfo.TYPE_BUILTIN_EARPIECE,
    AudioDeviceInfo.TYPE_BUILTIN_SPEAKER_SAFE -> "built_in"
    else -> "unknown"
  }

  fun typeName(type: Int): String = when (type) {
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "Bluetooth HFP/SCO"
    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP -> "Bluetooth A2DP (playback only)"
    AudioDeviceInfo.TYPE_BLE_HEADSET -> "Bluetooth LE Audio headset"
    AudioDeviceInfo.TYPE_BLE_SPEAKER -> "Bluetooth LE Audio speaker"
    AudioDeviceInfo.TYPE_BLE_BROADCAST -> "Bluetooth LE broadcast"
    AudioDeviceInfo.TYPE_HEARING_AID -> "Hearing aid"
    AudioDeviceInfo.TYPE_WIRED_HEADSET -> "Wired headset"
    AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "Wired headphones (no mic)"
    AudioDeviceInfo.TYPE_LINE_ANALOG -> "Analog line"
    AudioDeviceInfo.TYPE_AUX_LINE -> "Aux line"
    AudioDeviceInfo.TYPE_USB_HEADSET -> "USB headset"
    AudioDeviceInfo.TYPE_USB_DEVICE -> "USB audio device"
    AudioDeviceInfo.TYPE_USB_ACCESSORY -> "USB accessory"
    AudioDeviceInfo.TYPE_BUILTIN_MIC -> "Built-in microphone"
    AudioDeviceInfo.TYPE_BUILTIN_SPEAKER -> "Phone speaker"
    AudioDeviceInfo.TYPE_BUILTIN_SPEAKER_SAFE -> "Phone speaker (safe)"
    AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "Phone earpiece"
    else -> "Audio device (type $type)"
  }

  fun displayName(d: AudioDeviceInfo): String {
    val product = d.productName?.toString()?.trim().orEmpty()
    return when (d.type) {
      // productName is the phone model for built-in devices; address distinguishes bottom/back mics.
      AudioDeviceInfo.TYPE_BUILTIN_MIC -> {
        val where = address(d).trim()
        if (where.isNotEmpty() && !where.contains(':')) "Phone microphone ($where)" else "Phone microphone"
      }
      AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, AudioDeviceInfo.TYPE_BUILTIN_SPEAKER_SAFE -> "Phone speaker"
      AudioDeviceInfo.TYPE_BUILTIN_EARPIECE -> "Phone earpiece"
      else -> product.ifEmpty { typeName(d.type) }
    }
  }

  /** For an input: whether Android offers a matching device for communication routing. Null below API 31. */
  fun communicationCapable(input: AudioDeviceInfo, comm: List<AudioDeviceInfo>?): Boolean? {
    if (comm == null) return null
    return comm.any { matchesForCommunication(input, it) }
  }

  fun matchesForCommunication(input: AudioDeviceInfo, output: AudioDeviceInfo): Boolean {
    if (output.type != input.type) return false
    val a = address(input)
    val b = address(output)
    return if (a.isNotEmpty() && b.isNotEmpty()) a == b else input.productName == output.productName
  }

  fun toMap(d: AudioDeviceInfo, communication: Boolean?): Map<String, Any?> = mapOf(
    "id" to d.id.toString(),
    "name" to displayName(d),
    "type" to category(d.type),
    "typeName" to typeName(d.type),
    "androidType" to d.type,
    "isInput" to d.isSource,
    "isOutput" to d.isSink,
    "isAvailable" to true, // listed by AudioManager.getDevices() right now
    "isCommunicationDevice" to communication,
    "sampleRates" to d.sampleRates.toList(),
    "channelCounts" to d.channelCounts.toList(),
  )
}
