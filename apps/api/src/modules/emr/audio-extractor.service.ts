import { Injectable, Logger } from "@nestjs/common";
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// Default-exports the absolute path to the bundled ffmpeg binary (string | null).
import ffmpegStatic from "ffmpeg-static";

/**
 * Ambient-scribe helper: pulls the audio track out of a large consult
 * recording and compresses it to speech-grade mono so it clears Whisper's
 * 25MB upload ceiling. A consult's audio at 16kHz/32kbps mono is tiny (~14MB
 * per hour) even when the source video is hundreds of MB.
 *
 * Uses the bundled ffmpeg-static binary — no system install. No-op-safe:
 * any failure (binary missing, spawn error, timeout, bad output) returns null
 * and the caller falls back to rejecting the recording.
 */
@Injectable()
export class AudioExtractorService {
  private readonly logger = new Logger("AudioExtractor");
  private seq = 0;

  /** Resolve the bundled ffmpeg binary path, or null if unavailable. */
  private ffmpegPath(): string | null {
    return ffmpegStatic || null;
  }

  get available(): boolean {
    return !!this.ffmpegPath();
  }

  /**
   * Extract + compress audio from a remote media URL. Returns an mp3 Buffer,
   * or null when extraction isn't possible. `timeoutMs` caps a runaway encode.
   */
  async extractAudio(
    sourceUrl: string,
    opts: { timeoutMs?: number } = {},
  ): Promise<Buffer | null> {
    const bin = this.ffmpegPath();
    if (!bin) {
      this.logger.warn("ffmpeg-static not available — skipping extraction");
      return null;
    }

    const out = join(
      tmpdir(),
      `scribe-audio-${process.pid}-${Date.now()}-${this.seq++}.mp3`,
    );
    const args = [
      "-y",
      "-nostdin",
      "-i",
      sourceUrl,
      "-vn", // drop video
      "-ac",
      "1", // mono
      "-ar",
      "16000", // 16kHz — Whisper's native rate
      "-b:a",
      "32k", // speech-intelligible, ~14MB/hour
      "-f",
      "mp3",
      out,
    ];

    const ok = await new Promise<boolean>((resolve) => {
      let settled = false;
      const child = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
      let stderr = "";
      child.stderr?.on("data", (d) => {
        // keep only the tail — ffmpeg is chatty
        stderr = (stderr + d.toString()).slice(-2000);
      });
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        this.logger.warn("ffmpeg extraction timed out");
        resolve(false);
      }, opts.timeoutMs ?? 120_000);

      child.on("error", (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.logger.warn(`ffmpeg spawn failed: ${e.message}`);
        resolve(false);
      });
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (code !== 0) {
          this.logger.warn(`ffmpeg exited ${code}: ${stderr.slice(-300)}`);
        }
        resolve(code === 0);
      });
    });

    if (!ok) {
      await fs.unlink(out).catch(() => {});
      return null;
    }
    try {
      const buffer = await fs.readFile(out);
      return buffer.length > 0 ? buffer : null;
    } catch {
      return null;
    } finally {
      await fs.unlink(out).catch(() => {});
    }
  }
}
