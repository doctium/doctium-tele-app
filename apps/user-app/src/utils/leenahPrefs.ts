// Leenah (AI assistant) preferences — persisted so the user's experience is
// remembered across sessions and editable anytime from the Leenah settings page
// (not only from the pre-chat setup screen).
import * as SecureStore from "expo-secure-store";

const AUTOPLAY_KEY = "leenah_autoplay";
const LANGUAGE_KEY = "leenah_language";

/** Languages Leenah can converse in. `auto` = detect from the user's words. */
export const LEENAH_LANGUAGES = [
  { code: "auto", label: "Auto" },
  { code: "en", label: "English" },
  { code: "pcm", label: "Pidgin" },
  { code: "ha", label: "Hausa" },
  { code: "yo", label: "Yorùbá" },
  { code: "ig", label: "Igbo" },
] as const;

/** Whether Leenah reads her replies aloud (voice replies / "speak back"). */
export async function getLeenahAutoPlay(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(AUTOPLAY_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setLeenahAutoPlay(on: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(AUTOPLAY_KEY, on ? "1" : "0");
  } catch {
    // best-effort; a failed write just falls back to the default next launch
  }
}

/** Preferred conversation language (defaults to `auto`). */
export async function getLeenahLanguage(): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(LANGUAGE_KEY)) || "auto";
  } catch {
    return "auto";
  }
}

export async function setLeenahLanguage(code: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(LANGUAGE_KEY, code);
  } catch {
    // best-effort
  }
}
