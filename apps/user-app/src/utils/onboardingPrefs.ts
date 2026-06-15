import * as SecureStore from "expo-secure-store";

// Mirrors the language/theme persistence pattern (expo-secure-store keys).
const KEY = "doctium.onboarding.seen";

export async function getOnboardingSeen(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === "true";
  } catch {
    return false;
  }
}

export async function setOnboardingSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, "true");
  } catch {
    // non-fatal: worst case the user sees onboarding again next launch
  }
}
