// Doctium Brand Guidelines v1.0 — "Calm Clinical Luxury" admin design system
import type { Config } from "tailwindcss";

// Channel-variable token: `rgb(var(--x) / <alpha-value>)` keeps Tailwind opacity
// modifiers (e.g. bg-surface/70) working while letting `.dark` swap the value.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Semantic, theme-swappable tokens (light/dark values live in globals.css).
        surface: v("surface"),
        surfaceAlt: v("surface-alt"),
        muted: v("muted"),
        border: v("border"),
        hairline: v("hairline"),
        ink: v("ink"), // primary text — replaces literal `text-navy` ink usage
        // Neutral ramp is INVERTED in dark (globals.css) so existing
        // text-gray-*/bg-gray-*/border-gray-* flip automatically.
        gray: {
          50: v("gray-50"),
          100: v("gray-100"),
          200: v("gray-200"),
          300: v("gray-300"),
          400: v("gray-400"),
          500: v("gray-500"),
          600: v("gray-600"),
          700: v("gray-700"),
          800: v("gray-800"),
          900: v("gray-900"),
        },
        // Brand primaries
        navy: {
          DEFAULT: "#133157",
          50: v("navy-50"),
          100: "#D9E4FF",
          200: "#B6CBEA",
          300: "#7E9CC4",
          400: "#3E5F8C",
          500: "#133157",
          600: "#0F2747",
          700: "#0C2040",
          800: "#081628",
          900: "#060F1C",
          deep: "#0B1B30",
          mid: "#1C4A74",
        },
        skyblue: {
          DEFAULT: "#8BBBE9",
          50: v("skyblue-50"),
          100: "#C9E3F5",
          200: "#A9D0EF",
          300: "#8BBBE9",
        },
        teal: {
          DEFAULT: "#2E7CC2",
          50: v("teal-50"),
          100: "#CFE4F7",
          200: "#A9CDEE",
          300: "#7FB2E4",
          400: "#5092D6",
          500: "#2E7CC2",
          600: v("teal-600"),
          700: v("teal-700"),
          bright: "#5E97D1",
          deep: "#205F9E",
        },
        // Semantic aliases that map to brand values
        primary: {
          DEFAULT: "#133157",
          50: v("primary-50"),
          100: "#D9E4FF",
          200: "#B6CBEA",
          300: "#7E9CC4",
          400: "#3E5F8C",
          500: "#133157",
          600: v("primary-600"),
          700: "#060F1C",
        },
        secondary: {
          DEFAULT: "#2E7CC2",
          50: "#EAF3FC",
          100: "#CFE4F7",
          500: "#2E7CC2",
          600: "#2766A6",
        },
        interactive: {
          DEFAULT: "#2563EB",
          50: "#EFF6FF",
          500: "#2563EB",
          600: "#1D4ED8",
        },
        // Deep EHR surface fill (literal — used as a dark fill, not theme-swapped)
        dark: "#0B1726",
        // Status
        success: {
          DEFAULT: "#12B76A",
          50: v("success-50"),
          100: v("success-100"),
          500: "#12B76A",
          600: v("success-600"),
        },
        caution: {
          DEFAULT: "#F79009",
          50: v("caution-50"),
          100: "#FEF0C7",
          500: "#F79009",
          600: v("caution-600"),
        },
        alert: {
          DEFAULT: "#D92D20",
          50: v("alert-50"),
          100: v("alert-100"),
          500: "#D92D20",
          600: v("alert-600"),
          700: v("alert-700"),
        },
        info: {
          DEFAULT: "#38BDF8",
          50: v("info-50"),
          100: "#E0F2FE",
          500: "#38BDF8",
        },
        // Tailwind default families — var-back ONLY the tint/text shades used as
        // status pills so they flip in dark (other shades inherit defaults).
        red: {
          50: v("red-50"),
          100: v("red-100"),
          600: v("red-600"),
          700: v("red-700"),
        },
        orange: { 50: v("orange-50"), 600: v("orange-600") },
        yellow: { 600: v("yellow-600") },
        green: {
          50: v("green-50"),
          100: v("green-100"),
          600: v("green-600"),
          700: v("green-700"),
        },
        blue: { 50: v("blue-50"), 700: v("blue-700") },
        purple: { 50: v("purple-50"), 700: v("purple-700") },
      },
      backgroundImage: {
        "gradient-hero":
          "linear-gradient(135deg, #0B1B30 0%, #143A63 55%, #1C4A74 100%)",
        "gradient-navy":
          "linear-gradient(160deg, #0B1B30 0%, #133157 55%, #1C4A74 100%)",
        "gradient-teal": "linear-gradient(135deg, #2E7CC2 0%, #205F9E 100%)",
        "gradient-aurora": "linear-gradient(120deg, #143A63 0%, #3E78B4 100%)",
        "gradient-sky": "linear-gradient(135deg, #8BBBE9 0%, #5C92C9 100%)",
        "gradient-sheen":
          "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 100%)",
      },
      fontFamily: {
        // "Naira Sign" (globals.css @font-face, unicode-range U+20A6) renders
        // ₦ from system fonts so it gets the official double-bar glyph.
        sans: [
          '"Naira Sign"',
          "var(--font-jakarta)",
          '"Plus Jakarta Sans"',
          "Inter",
          '"SF Pro Display"',
          '"Segoe UI"',
          "Arial",
          "sans-serif",
        ],
        body: [
          '"Naira Sign"',
          "var(--font-jakarta)",
          "Inter",
          '"SF Pro Text"',
          '"Segoe UI"',
          "Roboto",
          "Arial",
          "sans-serif",
        ],
      },
      fontSize: {
        "display-lg": [
          "40px",
          { lineHeight: "48px", fontWeight: "800", letterSpacing: "-0.02em" },
        ],
        "display-md": [
          "32px",
          { lineHeight: "40px", fontWeight: "800", letterSpacing: "-0.02em" },
        ],
        "heading-lg": [
          "24px",
          { lineHeight: "32px", fontWeight: "700", letterSpacing: "-0.01em" },
        ],
        "heading-md": [
          "20px",
          { lineHeight: "28px", fontWeight: "700", letterSpacing: "-0.01em" },
        ],
        "heading-sm": ["18px", { lineHeight: "26px", fontWeight: "600" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "400" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "400" }],
        "label-md": ["13px", { lineHeight: "18px", fontWeight: "600" }],
        caption: ["12px", { lineHeight: "16px", fontWeight: "500" }],
        micro: ["11px", { lineHeight: "14px", fontWeight: "600" }],
      },
      borderRadius: {
        sm: "10px",
        md: "14px",
        lg: "18px",
        xl: "22px",
        "2xl": "26px",
        "3xl": "34px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(19,49,87,0.04), 0 8px 24px -12px rgba(19,49,87,0.12)",
        raised:
          "0 2px 6px rgba(19,49,87,0.05), 0 18px 40px -18px rgba(19,49,87,0.18)",
        floating:
          "0 8px 16px rgba(19,49,87,0.07), 0 30px 60px -24px rgba(19,49,87,0.24)",
        cta: "0 8px 20px -6px rgba(139,187,233,0.45)",
        "cta-navy": "0 8px 20px -6px rgba(19,49,87,0.40)",
        "inset-soft": "inset 0 1px 0 rgba(255,255,255,0.08)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "fade-in": "fade-in 0.4s ease both",
        "scale-in": "scale-in 0.35s cubic-bezier(0.22,1,0.36,1) both",
      },
    },
  },
  plugins: [],
};
export default config;
