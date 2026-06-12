import { useEffect, useState } from "react";
import { I18nManager } from "react-native";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import * as SecureStore from "expo-secure-store";
import {
  DEFAULT_LANGUAGE,
  isEnabledLanguage,
  languageByCode,
} from "./languages";
import en from "./locales/en.json";
import pcm from "./locales/pcm.json";
import ha from "./locales/ha.json";
import yo from "./locales/yo.json";
import ig from "./locales/ig.json";

const STORAGE_KEY = "doctium.language";

export const resources = {
  en: { translation: en },
  pcm: { translation: pcm },
  ha: { translation: ha },
  yo: { translation: yo },
  ig: { translation: ig },
} as const;

// Initialise synchronously with English so `useTranslation` works on first
// render; bootstrapI18n() then swaps to the saved/device language during the
// splash gate, before first paint — so there's no English flash.
i18n.use(initReactI18next).init({
  resources,
  lng: DEFAULT_LANGUAGE,
  fallbackLng: "en",
  defaultNS: "translation",
  interpolation: { escapeValue: false },
  returnNull: false,
});

function deviceLanguage(): string {
  try {
    const code = Localization.getLocales()[0]?.languageCode ?? "";
    return isEnabledLanguage(code) ? code : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/** The persisted language if valid, otherwise the device language, otherwise English. */
export async function getSavedLanguage(): Promise<string> {
  try {
    const saved = await SecureStore.getItemAsync(STORAGE_KEY);
    if (saved && isEnabledLanguage(saved)) return saved;
  } catch {
    // SecureStore unavailable — fall through to device detection.
  }
  return deviceLanguage();
}

/**
 * Apply RTL direction for a language. Dormant today (no RTL language is enabled),
 * but wired so enabling Arabic flips layout. A full app reload is required for an
 * RTL change to take effect across native views.
 */
function applyDirection(code: string): void {
  const rtl = !!languageByCode(code)?.rtl;
  if (I18nManager.isRTL !== rtl) {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  }
}

/** Read the persisted/device language and apply it. Call once before first paint. */
export async function bootstrapI18n(): Promise<void> {
  const lng = await getSavedLanguage();
  applyDirection(lng);
  if (i18n.language !== lng) await i18n.changeLanguage(lng);
}

/** Persist and apply a new app language (local UI source of truth). */
export async function setAppLanguage(code: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(STORAGE_KEY, code);
  } catch {
    // Persisting failed — still apply for this session.
  }
  applyDirection(code);
  await i18n.changeLanguage(code);
}

/** Gate hook for the root layout: resolves once the saved language is applied. */
export function useI18nReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    bootstrapI18n().finally(() => setReady(true));
  }, []);
  return ready;
}

export default i18n;
