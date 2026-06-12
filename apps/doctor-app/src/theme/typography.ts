// Fonts (names) + Type (scale) are shared via @doctium/mobile-ui. FontMap stays
// local because it require()s this app's patched TTF assets (see scripts/patch-naira-fonts.cjs).
export { Fonts, Type } from "@doctium/mobile-ui";

// Map for expo-font useFonts() — keys become the registered fontFamily names.
export const FontMap = {
  PlusJakartaSans_200ExtraLight: require("../../assets/fonts/PlusJakartaSans_200ExtraLight.ttf"),
  PlusJakartaSans_300Light: require("../../assets/fonts/PlusJakartaSans_300Light.ttf"),
  PlusJakartaSans_400Regular: require("../../assets/fonts/PlusJakartaSans_400Regular.ttf"),
  PlusJakartaSans_500Medium: require("../../assets/fonts/PlusJakartaSans_500Medium.ttf"),
  PlusJakartaSans_600SemiBold: require("../../assets/fonts/PlusJakartaSans_600SemiBold.ttf"),
  PlusJakartaSans_700Bold: require("../../assets/fonts/PlusJakartaSans_700Bold.ttf"),
  PlusJakartaSans_800ExtraBold: require("../../assets/fonts/PlusJakartaSans_800ExtraBold.ttf"),
};
