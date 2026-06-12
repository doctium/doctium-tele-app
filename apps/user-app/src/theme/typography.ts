// Typography — Plus Jakarta Sans (brand primary).
// Use `Fonts.*` for fontFamily and `Type.*` for ready-made text styles.
//
// ⚠️ The TTFs in assets/fonts/ are PATCHED copies of the @expo-google-fonts
// files with the ₦ (U+20A6) mapping removed: Jakarta's own naira glyph is
// single-barred, and removing it makes the OS font (Roboto/SF) supply the
// official double-barred sign. Regenerate after a font-package upgrade with
// `node scripts/patch-naira-fonts.cjs` — never import from the package here.
import { TextStyle } from "react-native";

export const Fonts = {
  extraLight: "PlusJakartaSans_200ExtraLight",
  light: "PlusJakartaSans_300Light",
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  extrabold: "PlusJakartaSans_800ExtraBold",
} as const;

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

// Expressive type scale. Display sizes lean on weight + negative tracking for a
// confident, premium voice; body stays airy and legible.
export const Type = {
  hero: {
    fontFamily: Fonts.extrabold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.8,
  } as TextStyle,
  display: {
    fontFamily: Fonts.extrabold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.6,
  } as TextStyle,
  h1: {
    fontFamily: Fonts.bold,
    fontSize: 23,
    lineHeight: 29,
    letterSpacing: -0.4,
  } as TextStyle,
  h2: {
    fontFamily: Fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.3,
  } as TextStyle,
  h3: {
    fontFamily: Fonts.semibold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.2,
  } as TextStyle,
  title: {
    fontFamily: Fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.1,
  } as TextStyle,
  body: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  } as TextStyle,
  bodyMed: {
    fontFamily: Fonts.medium,
    fontSize: 15,
    lineHeight: 22,
  } as TextStyle,
  bodySm: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 19,
  } as TextStyle,
  label: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: -0.1,
  } as TextStyle,
  caption: {
    fontFamily: Fonts.medium,
    fontSize: 12,
    lineHeight: 16,
  } as TextStyle,
  overline: {
    fontFamily: Fonts.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  } as TextStyle,
  // Numeric / price emphasis
  price: {
    fontFamily: Fonts.extrabold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: -0.5,
  } as TextStyle,
} as const;
