/**
 * Ambient-scribe large-recording verification — exercises the REAL ffmpeg
 * audio-extraction pipeline used when a consult recording exceeds Whisper's
 * 25MB ceiling. Synthesises a small mp4 (audio + video) with the bundled
 * ffmpeg-static binary, then pulls the audio track back out through the
 * AudioExtractorService and checks the no-op-safe failure paths.
 *
 * Run: npx ts-node --transpile-only scripts/test-audio-extract.ts
 *   (TS_NODE_COMPILER_OPTIONS is set by the npm script / harness below)
 */
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AudioExtractorService } from "../apps/api/src/modules/emr/audio-extractor.service";

let pass = 0;
let fail = 0;
const assert = (cond: boolean, label: string) => {
  if (cond) {
    pass++;
    console.log("  ✓", label);
  } else {
    fail++;
    console.log("  ✗ FAIL:", label);
  }
};

const ffmpegBin = (): string | null => {
  try {
    return (require("ffmpeg-static") as string | null) || null;
  } catch {
    return null;
  }
};

/** Synthesise a short mp4 with a sine tone + test pattern video. */
const synthMp4 = (bin: string, out: string): Promise<boolean> =>
  new Promise((resolve) => {
    const args = [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=3",
      "-f",
      "lavfi",
      "-i",
      "testsrc=duration=3:size=320x240:rate=15",
      "-shortest",
      "-c:v",
      "mpeg4",
      "-c:a",
      "aac",
      "-pix_fmt",
      "yuv420p",
      out,
    ];
    const child = spawn(bin, args, { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });

(async () => {
  const bin = ffmpegBin();
  if (!bin) {
    console.log(
      "  ~ SKIP: ffmpeg-static unavailable — extraction is no-op-safe",
    );
    console.log("\nDone. pass=0 fail=0 (skipped)");
    process.exit(0);
  }
  console.log("ffmpeg-static:", bin);

  const extractor = new AudioExtractorService();
  assert(extractor.available, "extractor reports ffmpeg available");

  // ── 1. Real extraction from a synthesised mp4 ─────────────
  console.log("\n1) Audio extraction");
  const src = join(tmpdir(), `scribe-test-src-${process.pid}.mp4`);
  const made = await synthMp4(bin, src);
  assert(made, "synthesised a test mp4 (audio + video)");

  if (made) {
    const srcSize = (await fs.stat(src)).size;
    const audio = await extractor.extractAudio(src, { timeoutMs: 60_000 });
    assert(!!audio && audio.length > 500, "extracted a non-empty audio buffer");
    // mp3 frames start with 0xFF 0xEx (sync word) or an ID3 tag.
    if (audio) {
      const id3 = audio.slice(0, 3).toString("ascii") === "ID3";
      const mpegSync = audio[0] === 0xff && (audio[1] & 0xe0) === 0xe0;
      assert(id3 || mpegSync, "output is an MP3 stream (ID3/sync header)");
      assert(
        audio.length < srcSize,
        `audio track is smaller than the container (${audio.length} < ${srcSize})`,
      );
    }
    await fs.unlink(src).catch(() => {});
  }

  // ── 2. No-op-safe failure paths ───────────────────────────
  console.log("\n2) Failure paths return null (never throw)");
  const unreachable = await extractor.extractAudio(
    "http://127.0.0.1:9/nope.mp4",
    { timeoutMs: 20_000 },
  );
  assert(unreachable === null, "unreachable URL → null");

  const bogus = await extractor.extractAudio(
    join(tmpdir(), `does-not-exist-${process.pid}.mp4`),
    { timeoutMs: 20_000 },
  );
  assert(bogus === null, "non-existent input → null");

  console.log(`\nDone. pass=${pass} fail=${fail}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error("FATAL:", e?.message ?? e);
  process.exit(1);
});
