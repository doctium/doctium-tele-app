// Spacing, radii, elevation, motion — the structural rhythm of the system.
import { ViewStyle } from "react-native";

// 4-based spatial scale
export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 44,
  giant: 64,
} as const;

// Generous, modern radii (premium softness)
export const Radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  xxl: 34,
  round: 999,
} as const;

// Brand-tinted soft shadows — navy-toned for a calm, expensive depth.
// (Android approximates via `elevation`.)
export const Shadow: Record<string, ViewStyle> = {
  none: {},
  card: {
    shadowColor: "#0B1B30",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  raised: {
    shadowColor: "#0B1B30",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.1,
    shadowRadius: 28,
    elevation: 7,
  },
  floating: {
    shadowColor: "#0A1424",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.16,
    shadowRadius: 36,
    elevation: 16,
  },
  // Navy glow for primary CTAs (brand: primary actions are Clinical Navy)
  cta: {
    shadowColor: "#102C4C",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 9,
  },
};

// Motion — spring configs (reanimated) + timings.
export const Motion = {
  spring: {
    // tactile press
    press: { damping: 18, stiffness: 320, mass: 0.7 },
    // smooth settle
    smooth: { damping: 20, stiffness: 180, mass: 0.9 },
    // bouncy entrance
    bouncy: { damping: 14, stiffness: 160, mass: 0.8 },
    // fluid indicator
    fluid: { damping: 22, stiffness: 240, mass: 0.6 },
  },
  timing: {
    fast: 180,
    base: 280,
    slow: 480,
  },
  // staggered entrance step (ms) per index
  stagger: 70,
} as const;
