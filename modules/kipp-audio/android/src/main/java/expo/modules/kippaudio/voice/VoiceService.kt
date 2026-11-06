package expo.modules.kippaudio.voice

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log

/**
 * Foreground service (type microphone) that keeps KIPP listening while the app is in the background.
 * Always shows a "KIPP is listening" notification with a Stop action. Must be started while the app is visible.
 */
class VoiceService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      shutdown()
      return START_NOT_STICKY
    }
    try {
      val n = notification()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
      } else {
        startForeground(NOTIFICATION_ID, n)
      }
    } catch (e: Exception) {
      // e.g. ForegroundServiceStartNotAllowedException when started from the background.
      Log.e(TAG, "startForeground failed", e)
      VoiceHub.engineListener.onError("SERVICE_FAILED", "Android didn't allow KIPP to keep listening: ${e.message}", true)
      stopSelf()
      return START_NOT_STICKY
    }
    if (VoiceHub.engine == null) {
      val engine = VoiceEngine(applicationContext, VoiceHub.pendingConfig, VoiceHub.speaker(this), object : VoiceEngine.Listener by VoiceHub.engineListener {
        override fun onError(code: String, message: String, fatal: Boolean) {
          VoiceHub.engineListener.onError(code, message, fatal)
          if (fatal) shutdown()
        }
        override fun onState(state: String, inConversation: Boolean) {
          if (state == "stopped" && VoiceHub.engine != null) VoiceHub.engine = null
          VoiceHub.engineListener.onState(state, inConversation)
        }
      })
      VoiceHub.engine = engine
      engine.start()
    }
    // Not sticky: if Android kills us, the user restarts listening from the app (mic FGS can't start from background).
    return START_NOT_STICKY
  }

  private fun shutdown() {
    val engine = VoiceHub.engine
    VoiceHub.engine = null
    Thread { engine?.stop() }.start()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(STOP_FOREGROUND_REMOVE) else @Suppress("DEPRECATION") stopForeground(true)
    stopSelf()
    VoiceHub.engineListener.onState("stopped", false)
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    shutdown()
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    VoiceHub.engine?.let { e -> VoiceHub.engine = null; Thread { e.stop() }.start() }
    super.onDestroy()
  }

  private fun notification(): Notification {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "KIPP listening", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Shown while KIPP is listening for \"Hey KIPP\""
          setShowBadge(false)
        },
      )
    }
    val immutable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0
    val open = packageManager.getLaunchIntentForPackage(packageName)?.let {
      PendingIntent.getActivity(this, 0, it, immutable or PendingIntent.FLAG_UPDATE_CURRENT)
    }
    val stop = PendingIntent.getService(this, 1, Intent(this, VoiceService::class.java).setAction(ACTION_STOP), immutable)
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL_ID) else @Suppress("DEPRECATION") Notification.Builder(this)
    return builder
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentTitle("KIPP is listening")
      .setContentText("Say \"Hey KIPP\" to talk. Audio stays on this phone.")
      .setOngoing(true)
      .setContentIntent(open)
      .addAction(Notification.Action.Builder(null, "Stop listening", stop).build())
      .build()
  }

  companion object {
    private const val TAG = "KippVoiceService"
    private const val CHANNEL_ID = "kipp-listening"
    private const val NOTIFICATION_ID = 4711
    const val ACTION_STOP = "expo.modules.kippaudio.voice.STOP"

    fun start(ctx: Context) {
      val i = Intent(ctx, VoiceService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) ctx.startForegroundService(i) else ctx.startService(i)
    }

    fun stop(ctx: Context) {
      ctx.startService(Intent(ctx, VoiceService::class.java).setAction(ACTION_STOP))
    }
  }
}
