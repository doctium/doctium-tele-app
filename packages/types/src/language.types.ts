/**
 * Canonical multi-language catalog for Doctium — the single source of truth for
 * language codes shared across the API, patient app, doctor app and admin panel.
 *
 * Codes match the set already used by Leenah / `TriageSession.language`
 * (en | pcm | ha | yo | ig). `enabled` marks the languages the patient app UI is
 * actually translated into today; `ar` / `fr` are listed as "coming soon" so the
 * catalog can drive a future-proof language switcher and RTL plumbing as Doctium
 * expands into MENA / francophone markets.
 */
export interface LanguageMeta {
  /** Short language code, e.g. "en", "yo". */
  code: string;
  /** English display label, e.g. "Yoruba". */
  label: string;
  /** Endonym (the language's name in itself), e.g. "Yorùbá". */
  native: string;
  /** Right-to-left script — drives RTL layout (Arabic, etc.). */
  rtl: boolean;
  /** Whether the patient app UI is translated into this language yet. */
  enabled: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  {
    code: "en",
    label: "English",
    native: "English",
    rtl: false,
    enabled: true,
  },
  {
    code: "pcm",
    label: "Nigerian Pidgin",
    native: "Pidgin",
    rtl: false,
    enabled: true,
  },
  { code: "ha", label: "Hausa", native: "Hausa", rtl: false, enabled: true },
  { code: "yo", label: "Yoruba", native: "Yorùbá", rtl: false, enabled: true },
  { code: "ig", label: "Igbo", native: "Igbo", rtl: false, enabled: true },
  // ── Coming soon — international expansion (MENA / francophone Africa) ──
  { code: "ar", label: "Arabic", native: "العربية", rtl: true, enabled: false },
  {
    code: "fr",
    label: "French",
    native: "Français",
    rtl: false,
    enabled: false,
  },
];

export type LanguageCode = "en" | "pcm" | "ha" | "yo" | "ig" | "ar" | "fr";

/** Default app language. */
export const DEFAULT_LANGUAGE: LanguageCode = "en";

/** Languages the patient app UI is translated into today (selectable in the switcher). */
export const APP_LANGUAGES: LanguageMeta[] = SUPPORTED_LANGUAGES.filter(
  (l) => l.enabled,
);

/** Look up the full metadata for a language code. */
export function languageByCode(code: string): LanguageMeta | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}

/**
 * Human-readable English label for a language code.
 * Falls back to the raw input when the code is unknown — tolerant of legacy data
 * that stored labels (e.g. "Yoruba") rather than codes.
 */
export function languageLabel(code: string): string {
  return languageByCode(code)?.label ?? code;
}

/** Endonym (native name) for a language code, falling back to the raw input. */
export function languageNative(code: string): string {
  return languageByCode(code)?.native ?? code;
}

/** Whether a code is a known app-UI language (enabled in the catalog). */
export function isAppLanguage(code: string): code is LanguageCode {
  return APP_LANGUAGES.some((l) => l.code === code);
}
