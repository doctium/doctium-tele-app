/**
 * Official naira sign fix for the mobile apps.
 *
 * Plus Jakarta Sans ships its own ₦ (U+20A6) glyph drawn with a SINGLE
 * crossbar; the official Central Bank sign is double-barred. React Native
 * only falls back to the system font (Roboto / SF — both double-barred)
 * when a glyph is MISSING, so we re-emit each Jakarta weight with every
 * character EXCEPT U+20A6 and load those patched files instead of the
 * @expo-google-fonts originals.
 *
 * Run after upgrading the plus-jakarta-sans package:
 *   node scripts/patch-naira-fonts.cjs
 */
const fs = require("fs");
const path = require("path");
const fontkit = require("fontkit");
const subsetFont = require("subset-font");

const NAIRA = 0x20a6;
const WEIGHTS = [
  "200ExtraLight",
  "300Light",
  "400Regular",
  "500Medium",
  "600SemiBold",
  "700Bold",
  "800ExtraBold",
];
const SRC_DIR = path.join(
  __dirname,
  "..",
  "node_modules",
  "@expo-google-fonts",
  "plus-jakarta-sans",
);
const DEST_DIRS = [
  path.join(__dirname, "..", "apps", "user-app", "assets", "fonts"),
  path.join(__dirname, "..", "apps", "doctor-app", "assets", "fonts"),
];

(async () => {
  for (const dir of DEST_DIRS) fs.mkdirSync(dir, { recursive: true });

  for (const weight of WEIGHTS) {
    const file = `PlusJakartaSans_${weight}.ttf`;
    const srcPath = path.join(SRC_DIR, weight, file);
    const buf = fs.readFileSync(srcPath);

    const font = fontkit.create(buf);
    const keep = font.characterSet.filter((cp) => cp !== NAIRA);
    const text = keep.map((cp) => String.fromCodePoint(cp)).join("");

    const patched = await subsetFont(buf, text, { targetFormat: "truetype" });

    // Sanity: the naira mapping must be gone, everything else intact.
    const check = fontkit.create(patched);
    if (check.hasGlyphForCodePoint(NAIRA))
      throw new Error(`${file}: naira glyph still mapped after subset`);
    if (
      !check.hasGlyphForCodePoint(0x0041) ||
      !check.hasGlyphForCodePoint(0x20ac)
    )
      throw new Error(`${file}: subset dropped expected characters`);

    for (const dir of DEST_DIRS)
      fs.writeFileSync(path.join(dir, file), patched);
    console.log(
      `${file}: ${buf.length} -> ${patched.length} bytes, ${keep.length} chars kept, naira unmapped`,
    );
  }
  console.log("Done. Both apps now load patched fonts from assets/fonts/.");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
