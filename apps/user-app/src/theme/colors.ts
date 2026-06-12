// Doctium Design System — "Calm Clinical Luxury"
// Brand: Clinical Navy #133157 · Connected-Care Teal #2E7CC2 · Precision Sky #8BBBE9
//
// Light + Dark palettes share the SAME shape (Palette). `Colors` is the LIGHT
// palette for backward-compat: module-scope StyleSheet.create({}) that haven't
// been migrated to useColors() still compile and render the light theme. Themed
// screens read the live palette via useColors()/useThemedStyles().
//
// Only Colors is theme-split; Gradients/Shadow are dark/navy already and read
// well on both surfaces, so they stay shared.

const light = {
  // Brand primaries (fills/accents — identical across themes)
  navy: "#133157",
  skyBlue: "#8BBBE9",
  teal: "#2E7CC2",
  interactive: "#2563EB",

  // Semantic aliases
  primary: "#133157",
  secondary: "#2E7CC2",
  accent: "#2563EB",

  // Extended brand scales (for depth & gradients)
  navyDeep: "#0B1B30",
  navyMid: "#1C4A74",
  navySoft: "#E7EEF6",
  tealBright: "#5E97D1",
  tealDeep: "#205F9E",
  tealSoft: "#E7F1FC",
  skyDeep: "#5E97D1",
  skySoft: "#E9F2FB",

  // Surfaces
  background: "#F4F7FB", // calm clinical canvas
  surface: "#FFFFFF",
  surfaceAlt: "#EEF3F9", // inset / raised-alt
  darkSurface: "#0B1726",

  // Glass (frosted overlays)
  glass: "rgba(255,255,255,0.72)",
  glassBorder: "rgba(255,255,255,0.55)",
  glassDark: "rgba(11,23,38,0.55)",
  hairline: "rgba(15,27,45,0.07)",
  hairlineOnDark: "rgba(255,255,255,0.14)",

  // Status
  success: "#12B76A",
  successSoft: "#E6F7EF",
  warning: "#F79009",
  warningSoft: "#FEF3E2",
  error: "#E5484D",
  errorSoft: "#FCEBEC",
  info: "#38BDF8",

  // Text
  text: {
    primary: "#0F1B2D",
    secondary: "#5A6B82",
    tertiary: "#93A1B5",
    inverse: "#FFFFFF",
    onDark: "rgba(255,255,255,0.94)",
    onDarkDim: "rgba(255,255,255,0.64)",
  },

  // Borders & utilities
  border: "#E6ECF3",
  skeleton: "#EAF0F6",
  scrim: "rgba(8,18,32,0.45)",
};

export type Palette = typeof light;

export const LightColors: Palette = light;

// Deep-navy dark theme (not flat black) — keeps the "Calm Clinical Luxury" feel.
// Brand fills (navy/teal) stay; surfaces, text, borders and soft tints flip.
export const DarkColors: Palette = {
  navy: "#133157",
  skyBlue: "#8BBBE9",
  teal: "#3E8BD0",
  interactive: "#4E86F5",

  primary: "#2E7CC2",
  secondary: "#5E97D1",
  accent: "#4E86F5",

  navyDeep: "#0B1B30",
  navyMid: "#7CA8D9", // brightened: used as icon/ink on dark chips
  navySoft: "#1B2942", // elevated dark chip
  tealBright: "#5E97D1",
  tealDeep: "#3E8BD0",
  tealSoft: "#152B44",
  skyDeep: "#5E97D1",
  skySoft: "#15263C",

  background: "#0A1322", // deep navy-black canvas
  surface: "#111D31", // raised card
  surfaceAlt: "#16243B", // inset / raised-alt
  darkSurface: "#070E1A",

  glass: "rgba(17,29,49,0.72)",
  glassBorder: "rgba(255,255,255,0.10)",
  glassDark: "rgba(7,14,26,0.65)",
  hairline: "rgba(255,255,255,0.09)",
  hairlineOnDark: "rgba(255,255,255,0.14)",

  success: "#27C281",
  successSoft: "#0E2A1E",
  warning: "#F9A53A",
  warningSoft: "#33240A",
  error: "#F0676C",
  errorSoft: "#331A1C",
  info: "#4FC3F7",

  text: {
    primary: "#EDF2F8",
    secondary: "#9FB0C6",
    tertiary: "#6B7B92",
    inverse: "#FFFFFF",
    onDark: "rgba(255,255,255,0.94)",
    onDarkDim: "rgba(255,255,255,0.64)",
  },

  border: "rgba(255,255,255,0.10)",
  skeleton: "#1A2740",
  scrim: "rgba(4,9,18,0.55)",
};

/** Backward-compatible default export — the LIGHT palette. */
export const Colors = LightColors;

// Gradients consumed by expo-linear-gradient (colors arrays). Shared across
// themes — these are deep navy/teal and read well on light and dark surfaces.
export const Gradients = {
  // Signature hero: deep navy into clinical blue (brand navy story — no green)
  hero: ["#0B1B30", "#143A63", "#1C4A74"] as const,
  heroNavy: ["#102C4C", "#1B3F66", "#22557F"] as const,
  // Primary CTA — Doctium Clinical Navy (brand: primary CTAs are navy)
  cta: ["#1C4A74", "#102C4C"] as const,
  // Connected-Care Teal — SECONDARY accent only (premium / availability)
  teal: ["#2E7CC2", "#205F9E"] as const,
  // Soft accents
  sky: ["#A9D2F2", "#7BAEE4"] as const,
  aurora: ["#1C4A74", "#3E78B4"] as const,
  // Glass sheen overlay (top highlight)
  sheen: ["rgba(255,255,255,0.22)", "rgba(255,255,255,0)"] as const,
  // Scrim for media overlays (transparent -> dark)
  scrim: ["rgba(8,18,32,0)", "rgba(8,18,32,0.78)"] as const,
} as const;
