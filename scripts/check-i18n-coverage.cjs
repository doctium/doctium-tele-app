/**
 * i18n coverage + parity checker for the patient app.
 *   node scripts/check-i18n-coverage.cjs
 *
 * 1. Parses all base + extra locale JSON (fails loudly on malformed JSON).
 * 2. Deep-merges base+extra per locale → flat dot-key set.
 * 3. Scans every screen/component for static t("…") keys and asserts each
 *    exists in the English catalog (a miss = a raw key shown to users).
 * 4. Reports per-locale parity gaps vs English (these fall back to en).
 */
const fs = require("fs");
const path = require("path");

const APP = path.join(__dirname, "..", "apps", "user-app");
const LOC = path.join(APP, "src", "i18n", "locales");
const LANGS = ["en", "pcm", "ha", "yo", "ig"];

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (e) {
    console.error(`❌ INVALID JSON: ${path.basename(p)} — ${e.message}`);
    process.exitCode = 1;
    return {};
  }
}
function deepMerge(base, extra) {
  const out = { ...base };
  for (const k of Object.keys(extra)) {
    const b = out[k];
    const e = extra[k];
    if (
      b &&
      e &&
      typeof b === "object" &&
      typeof e === "object" &&
      !Array.isArray(b) &&
      !Array.isArray(e)
    ) {
      out[k] = deepMerge(b, e);
    } else out[k] = e;
  }
  return out;
}
function flatten(obj, prefix = "", acc = new Set()) {
  for (const k of Object.keys(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    const v = obj[k];
    if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, key, acc);
    else acc.add(key);
  }
  return acc;
}
function walk(dir, files = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === "i18n") continue;
      walk(p, files);
    } else if (/\.tsx?$/.test(e.name)) files.push(p);
  }
  return files;
}

// ── Build catalogs ──
const merged = {};
for (const lng of LANGS) {
  const base = readJson(path.join(LOC, `${lng}.json`));
  const extra = readJson(path.join(LOC, `${lng}.extra.json`));
  merged[lng] = flatten(deepMerge(base, extra));
}
const en = merged.en;
console.log(
  `Catalog sizes (leaf keys): ${LANGS.map((l) => `${l}=${merged[l].size}`).join("  ")}`,
);

// ── Static key coverage ──
const dirs = [path.join(APP, "app"), path.join(APP, "src", "components")];
const files = dirs.flatMap((d) => (fs.existsSync(d) ? walk(d) : []));
const KEY_RE = /\bt\(\s*["']([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)+)["']/g;
const referenced = new Map(); // key -> first file
for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  let m;
  while ((m = KEY_RE.exec(src))) {
    if (!referenced.has(m[1])) referenced.set(m[1], path.relative(APP, f));
  }
}
const missing = [...referenced].filter(([k]) => !en.has(k));
console.log(`\nStatic t("…") keys referenced: ${referenced.size}`);
if (missing.length) {
  console.log(
    `❌ ${missing.length} referenced key(s) MISSING from English catalog:`,
  );
  for (const [k, f] of missing) console.log(`   ${k}   (${f})`);
  process.exitCode = 1;
} else {
  console.log(
    "✅ Every static key resolves in the English catalog (no raw keys).",
  );
}

// ── Parity vs English ──
console.log("\nParity vs English (missing keys fall back to en):");
for (const lng of LANGS.filter((l) => l !== "en")) {
  const miss = [...en].filter((k) => !merged[lng].has(k));
  console.log(
    `  ${lng}: ${merged[lng].size}/${en.size}${miss.length ? ` — ${miss.length} missing` : " ✅ full parity"}`,
  );
  if (miss.length) miss.slice(0, 8).forEach((k) => console.log(`     · ${k}`));
}
console.log(process.exitCode ? "\nFAILED" : "\nOK");
