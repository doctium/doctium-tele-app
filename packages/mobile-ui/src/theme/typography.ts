// Typography — Plus Jakarta Sans (brand primary).
// Use `Fonts.*` for fontFamily and `Type.*` for ready-made text styles.
//
// NOTE: the FontMap (require() of the TTF assets) stays in each app, because the
// font files live under each app's assets/fonts and are PATCHED copies (₦ glyph
// removed). Only the font NAMES and the type scale are shared here.
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
