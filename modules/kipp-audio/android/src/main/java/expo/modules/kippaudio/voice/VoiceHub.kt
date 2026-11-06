package expo.modules.kippaudio.voice

import android.content.Context

/**
 * Process-wide link between the JS module and the listening service. The service owns the engine;
 * the module owns the event emitter. Both live in the same process.
 */
internal object VoiceHub {
  @Volatile var emitter: ((String, Map<String, Any?>) -> Unit)? = null
  @Volatile var engine: VoiceEngine? = null
  @Volatile var pendingConfig: VoiceEngine.Config = VoiceEngine.Config()
  private var speaker: Speaker? = null

  @Synchronized
  fun speaker(ctx: Context): Speaker = speaker ?: Speaker(ctx.applicationContext).also { speaker = it }

  fun emit(name: String, body: Map<String, Any?>) {
    emitter?.invoke(name, body)
  }

  val listening get() = engine != null

  /** Engine events -> JS. */
  val engineListener = object : VoiceEngine.Listener {
    override fun onState(state: String, inConversation: Boolean) =
      emit("onVoiceState", mapOf("state" to state, "inConversation" to inConversation, "listening" to listening))
    override fun onWake() = emit("onWake", emptyMap())
    override fun onUtterance(text: String, viaWakeWord: Boolean, speechMs: Long, asrMs: Long) =
      emit("onUtterance", mapOf("text" to text, "viaWakeWord" to viaWakeWord, "speechMs" to speechMs, "asrMs" to asrMs))
    override fun onSpeech(status: String, error: String?) = emit("onSpeech", mapOf("status" to status, "error" to error))
    override fun onError(code: String, message: String, fatal: Boolean) =
      emit("onVoiceError", mapOf("code" to code, "message" to message, "fatal" to fatal))
  }
}
