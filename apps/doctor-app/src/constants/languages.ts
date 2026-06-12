/**
 * Languages a doctor can declare they speak.
 *
 * Mirrors the canonical catalog in packages/types/src/language.types.ts — kept
 * local because the mobile apps don't bundle workspace TS packages through Metro.
 * The CODES here MUST stay in sync with the shared catalog (and with the patient
 * app's i18n languages) so the "speaks your language" filter matches correctly.
 *
 * A doctor may speak languages the patient UI isn't translated into yet (e.g. ar/fr),
 * so this list is a superset of the patient app's enabled languages.
 */
export interface SpokenLanguage {
  code: string;
  label: string; // English label
  native: string; // endonym
}

export const SPOKEN_LANGUAGES: SpokenLanguage[] = [
  { code: "en", label: "English", native: "English" },
  { code: "pcm", label: "Nigerian Pidgin", native: "Pidgin" },
  { code: "ha", label: "Hausa", native: "Hausa" },
  { code: "yo", label: "Yoruba", native: "Yorùbá" },
  { code: "ig", label: "Igbo", native: "Igbo" },
  { code: "ar", label: "Arabic", native: "العربية" },
  { code: "fr", label: "French", native: "Français" },
];

/** English label for a code, falling back to the raw value (tolerant of legacy data). */
export const languageLabel = (code: string): string =>
  SPOKEN_LANGUAGES.find((l) => l.code === code)?.label ?? code;

/** Endonym for a code, falling back to the raw value. */
export const languageNative = (code: string): string =>
  SPOKEN_LANGUAGES.find((l) => l.code === code)?.native ?? code;
