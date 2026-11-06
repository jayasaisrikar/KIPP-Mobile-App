package expo.modules.kippaudio.voice

import android.content.Context
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream
import java.io.BufferedInputStream
import java.io.File
import java.io.FilterInputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

/**
 * On-device voice models. Downloaded once from the sherpa-onnx GitHub releases into app-private storage
 * (filesDir/kipp-voice/<pack>/), streamed straight through bzip2+tar so the archive never hits disk.
 */
internal object ModelStore {
  private const val BASE = "https://github.com/k2-fsa/sherpa-onnx/releases/download"

  data class Pack(
    val id: String,
    val url: String,
    /** Top-level folder inside the archive (stripped on extract); null for a single-file download. */
    val archiveDir: String?,
    /** Approximate download size, used for progress before Content-Length is known. */
    val approxBytes: Long,
    val keep: (String) -> Boolean,
  )

  const val KWS_DIR = "sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01-mobile"
  const val KWS_SUFFIX = "epoch-12-avg-2-chunk-16-left-64"

  val packs = listOf(
    Pack("vad", "$BASE/asr-models/silero_vad_v5.onnx", null, 2_300_000L) { true },
    Pack("kws", "$BASE/kws-models/$KWS_DIR.tar.bz2", KWS_DIR, 14_700_000L) {
      it in setOf("encoder-$KWS_SUFFIX.int8.onnx", "decoder-$KWS_SUFFIX.onnx", "joiner-$KWS_SUFFIX.int8.onnx", "tokens.txt")
    },
    Pack("asr", "$BASE/asr-models/sherpa-onnx-moonshine-base-en-int8.tar.bz2", "sherpa-onnx-moonshine-base-en-int8", 250_000_000L) {
      it in setOf("preprocess.onnx", "encode.int8.onnx", "uncached_decode.int8.onnx", "cached_decode.int8.onnx", "tokens.txt")
    },
    Pack("tts", "$BASE/tts-models/kokoro-int8-multi-lang-v1_0.tar.bz2", "kokoro-int8-multi-lang-v1_0", 132_000_000L) {
      it in setOf("model.int8.onnx", "voices.bin", "tokens.txt", "lexicon-us-en.txt") || it.startsWith("espeak-ng-data/")
    },
  )

  fun root(ctx: Context) = File(ctx.filesDir, "kipp-voice")
  fun dir(ctx: Context, id: String) = File(root(ctx), id)
  private fun marker(ctx: Context, id: String) = File(dir(ctx, id), ".ready")

  fun isReady(ctx: Context, id: String) = marker(ctx, id).exists()
  fun allReady(ctx: Context) = packs.all { isReady(ctx, it.id) }

  fun status(ctx: Context): Map<String, Any?> = mapOf(
    "ready" to allReady(ctx),
    "packs" to packs.associate { it.id to isReady(ctx, it.id) },
    "totalBytes" to packs.filter { !isReady(ctx, it.id) }.sumOf { it.approxBytes },
  )

  fun delete(ctx: Context) {
    root(ctx).deleteRecursively()
  }

  /**
   * Downloads every missing pack. [onProgress] gets (packId, downloadedBytesOverall, totalBytesOverall).
   * Throws on failure; a partially extracted pack is removed so it is retried next time.
   */
  fun download(ctx: Context, cancelled: AtomicBoolean, onProgress: (String, Long, Long) -> Unit) {
    val missing = packs.filter { !isReady(ctx, it.id) }
    val total = missing.sumOf { it.approxBytes }
    var doneBefore = 0L
    for (pack in missing) {
      if (cancelled.get()) throw IOException("Download cancelled")
      val out = dir(ctx, pack.id)
      out.deleteRecursively()
      out.mkdirs()
      try {
        fetch(pack, out, cancelled) { n -> onProgress(pack.id, doneBefore + n, total) }
        marker(ctx, pack.id).writeText("ok")
      } catch (e: Throwable) {
        out.deleteRecursively()
        throw e
      }
      doneBefore += pack.approxBytes
    }
    onProgress("done", total, total)
  }

  private fun open(url: String): HttpURLConnection {
    var current = url
    repeat(6) {
      val c = URL(current).openConnection() as HttpURLConnection
      c.instanceFollowRedirects = false
      c.connectTimeout = 20_000
      c.readTimeout = 60_000
      c.setRequestProperty("User-Agent", "KIPP-Android")
      when (c.responseCode) {
        in 200..299 -> return c
        301, 302, 303, 307, 308 -> {
          current = URL(URL(current), c.getHeaderField("Location")).toString()
          c.disconnect()
        }
        else -> throw IOException("Download failed (HTTP ${c.responseCode}) for ${url.substringAfterLast('/')}")
      }
    }
    throw IOException("Too many redirects for ${url.substringAfterLast('/')}")
  }

  private fun fetch(pack: Pack, out: File, cancelled: AtomicBoolean, progress: (Long) -> Unit) {
    val conn = open(pack.url)
    try {
      val counting = CountingStream(BufferedInputStream(conn.inputStream, 1 shl 16), cancelled, progress)
      if (pack.archiveDir == null) {
        File(out, pack.url.substringAfterLast('/')).outputStream().use { counting.copyTo(it, 1 shl 16) }
        return
      }
      TarArchiveInputStream(BZip2CompressorInputStream(counting)).use { tar ->
        val prefix = pack.archiveDir + "/"
        while (true) {
          val entry = tar.nextEntry ?: break
          val rel = entry.name.removePrefix("./").removePrefix(prefix)
          if (entry.isDirectory || rel == entry.name || !pack.keep(rel)) continue
          val target = File(out, rel).canonicalFile
          if (!target.path.startsWith(out.canonicalPath + File.separator)) continue // no path traversal
          target.parentFile?.mkdirs()
          target.outputStream().use { tar.copyTo(it, 1 shl 16) }
        }
      }
    } finally {
      conn.disconnect()
    }
  }

  private class CountingStream(
    inner: InputStream,
    private val cancelled: AtomicBoolean,
    private val progress: (Long) -> Unit,
  ) : FilterInputStream(inner) {
    private var count = 0L
    private var lastReport = 0L

    private fun advance(n: Int) {
      if (cancelled.get()) throw IOException("Download cancelled")
      if (n > 0) count += n
      if (count - lastReport >= 512 * 1024) {
        lastReport = count
        progress(count)
      }
    }

    override fun read(): Int = super.read().also { if (it >= 0) advance(1) }
    override fun read(b: ByteArray, off: Int, len: Int): Int = super.read(b, off, len).also { advance(it) }
  }
}
