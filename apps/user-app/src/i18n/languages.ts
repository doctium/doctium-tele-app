/**
 * App language catalog for the patient app.
 *
 * Mirrors the canonical catalog in packages/types/src/language.types.ts — kept
 * local because the mobile apps don't bundle workspace TS packages through Metro.
 * CODES MUST stay in sync with the shared catalog (and the doctor app's
 * SPOKEN_LANGUAGES) so the "speaks your language" doctor filter matches.
 *
 * `enabled` = the patient UI is translated into this language today (shown as a
 * selectable option). Disabled entries render as "coming soon" in the switcher.
 */
export interface AppLanguage {
  code: string;
  label: string; // English label
  native: string; // endonym
  rtl: boolean;
  enabled: boolean;
}

export const LANGUAGES: AppLanguage[] = [
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
  // ── Coming soon — international expansion ──
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

export const DEFAULT_LANGUAGE: LanguageCode = "en";

/** Languages the UI is translated into today (selectable in the switcher). */
export const ENABLED_LANGUAGES = LANGUAGES.filter((l) => l.enabled);

export const languageByCode = (code: string): AppLanguage | undefined =>
  LANGUAGES.find((l) => l.code === code);

/** Endonym for a code, falling back to the raw value. */
export const languageNative = (code: string): string =>
  languageByCode(code)?.native ?? code;

/** Whether a code is an enabled (selectable) app UI language. */
export const isEnabledLanguage = (code: string): boolean =>
  ENABLED_LANGUAGES.some((l) => l.code === code);
