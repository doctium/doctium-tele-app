/**
 * Doctium Brand Guidelines v1.0
 * Single source of truth for all brand tokens — consumed by web, mobile, and admin apps.
 */

// ─── Brand Primaries ───────────────────────────────────────────────────────────

/** Doctium Clinical Navy — logo structure, headings, primary navigation, secure clinical surfaces */
export const NAVY = '#133157';

/** Precision Sky Blue — medical cross accent, selected states, calm secondary emphasis */
export const SKY_BLUE = '#8BBBE9';

/** Connected Care Teal — telemedicine connection states, availability, secondary CTAs */
export const TEAL = '#2E7CC2';

/** Interface Blue — links, focus rings, interactive controls on white backgrounds */
export const INTERACTIVE_BLUE = '#2563EB';

// ─── Supporting Neutrals ───────────────────────────────────────────────────────

/** Deep EHR Surface — dark-mode headers, secure dashboard shells */
export const DARK_SURFACE = '#0B1726';

/** Primary Text — clinical copy, patient names, provider notes */
export const TEXT_PRIMARY = '#111827';

/** Secondary Text — metadata, timestamps, supporting labels */
export const TEXT_SECONDARY = '#4B5563';

/** Divider Gray — EHR cards, tables, form boundaries */
export const DIVIDER_GRAY = '#E5E7EB';

/** Clinical Canvas — app background, empty states, app icon canvas */
export const CLINICAL_CANVAS = '#F7FAFC';

/** White — cards, forms, modals, store icon background */
export const WHITE = '#FFFFFF';

// ─── Status Colors ─────────────────────────────────────────────────────────────

/** Care Confirmed Green — completed visits, successful payment, verified availability */
export const SUCCESS = '#12B76A';

/** Clinical Caution Amber — pending intake, incomplete forms, non-critical risk */
export const WARNING = '#F79009';

/** Critical Alert Red — failed sync, urgent errors, destructive actions */
export const ERROR = '#D92D20';

/** System Info Cyan — neutral messages, education callouts, onboarding tips */
export const INFO = '#38BDF8';

// ─── Typography ────────────────────────────────────────────────────────────────

/** Primary typeface — marketing headers, onboarding, brand-adjacent surfaces */
export const FONT_PRIMARY = '"Plus Jakarta Sans", Inter, "SF Pro Display", "Segoe UI", Arial, sans-serif';

/** Secondary typeface — mobile body copy, EHR tables, form labels */
export const FONT_BODY = 'Inter, "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif';

// ─── Convenience object (React Native / JS consumers) ─────────────────────────

export const BrandColors = {
  // Primaries
  navy:         NAVY,
  skyBlue:      SKY_BLUE,
  teal:         TEAL,
  interactive:  INTERACTIVE_BLUE,

  // Semantic aliases
  primary:      NAVY,
  secondary:    TEAL,
  accent:       INTERACTIVE_BLUE,

  // Surfaces
  background:   CLINICAL_CANVAS,
  surface:      WHITE,
  darkSurface:  DARK_SURFACE,

  // Status
  success:      SUCCESS,
  warning:      WARNING,
  error:        ERROR,
  info:         INFO,

  // Text
  textPrimary:   TEXT_PRIMARY,
  textSecondary: TEXT_SECONDARY,
  textInverse:   WHITE,

  // Border
  border:       DIVIDER_GRAY,
  skeleton:     '#F3F4F6',
} as const;

export type BrandColor = typeof BrandColors[keyof typeof BrandColors];

// ─── Type scale tokens ─────────────────────────────────────────────────────────

export const TypeScale = {
  displayMd: { size: 32, lineHeight: 40, weight: '700' },
  headingLg: { size: 24, lineHeight: 32, weight: '700' },
  headingMd: { size: 20, lineHeight: 28, weight: '700' },
  headingSm: { size: 18, lineHeight: 26, weight: '600' },
  bodyLg:    { size: 16, lineHeight: 24, weight: '400' },
  bodyMd:    { size: 14, lineHeight: 20, weight: '400' },
  labelMd:   { size: 13, lineHeight: 18, weight: '600' },
  caption:   { size: 12, lineHeight: 16, weight: '500' },
  micro:     { size: 11, lineHeight: 14, weight: '600' },
} as const;
