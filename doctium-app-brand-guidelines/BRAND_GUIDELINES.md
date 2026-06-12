# Doctium Mobile App Logo Brand Guidelines

Version: 1.0  
Brand system: Doctium telemedicine mobile app  
Audience: Product design, Flutter/Dart engineering, Next.js engineering, marketing, app store operations

## Source Logo Assets

| Supplied asset | Dimensions | Format | Intended reference use |
|---|---:|---|---|
| `../Doctium App Logo With Text.png` | 500 x 467 px | PNG, transparent | Full brand signature with logomark, logotype, and tagline |
| `../Doctium App Logo.png` | 296 x 300 px | PNG, transparent | Primary app logomark reference |
| `../Doctium_App_Logo Dark.png` | 296 x 300 px | PNG, transparent | Single-color dark logomark reference |
| `../Doctium_App_Logo-WhiteBG.png` | 296 x 300 px | PNG, transparent | Light-background / white mark reference |

The supplied PNGs are reference exports. Production use should be based on a clean vector master exported to SVG, PDF, PNG, WebP, and ICO as specified in this document.

## 1. Brand Identity & Logo Concept

### Brand Essence

Doctium's identity combines clinical trust, patient accessibility, and modern software precision. The mark should feel calm enough for healthcare workflows, precise enough for clinical documentation, and engineered enough for a high-performance telemedicine platform.

The core visual narrative is:

| Brand attribute | Visual expression |
|---|---|
| Clinical trust | Medical cross geometry, clean blue palette, controlled spacing |
| Seamless connectivity | Open circular "D" form suggesting an always-on digital care loop |
| Software precision | Modular geometry, crisp edges, scalable vector construction |
| Human accessibility | Soft sky-blue accent balancing the deep navy structure |
| High-reliability EHR use | Strong contrast, disciplined clear space, status colors separated from brand colors |

### Logo Anatomy

| Component | Description | Usage rule |
|---|---|---|
| Logomark | The symbol combines a medical cross-like light-blue form with a deep navy circular "D" structure. | Use as the app icon, favicon, launcher icon, social avatar, compact navigation mark, and loading mark. |
| Logotype | The custom uppercase `DOCTIUM` wordmark uses wide, geometric letterforms with a technical healthcare tone. | Do not recreate the logotype with a standard font. Use the approved vector/raster artwork only. |
| Tagline | `YOUR DOCTOR, ANYTIME, ANYWHERE` appears as a small supporting line beneath the logotype. | Use only when the full signature is large enough for legibility. Do not use below 240 px wide on digital screens. |
| Unified signature | The stacked arrangement of logomark, logotype, and tagline. | Use for brand pages, onboarding, investor decks, app store feature graphics, and marketing collateral. |

## 2. Logo Variations & Usage Rules

### Primary Logo

The primary Doctium logo is the full stacked signature shown in `Doctium App Logo With Text.png`.

Use it on:

- White or near-white backgrounds.
- App onboarding screens with enough vertical space.
- Website header lockups where the logo is at least 160 px wide without the tagline or 240 px wide with the tagline.
- Product and marketing documents where the full brand name must be explicit.

Primary color construction:

| Element | Approved color |
|---|---|
| D structure and logotype | Doctium Clinical Navy `#133157` |
| Medical cross accent | Precision Sky Blue `#8BBBE9` |
| Tagline | Precision Sky Blue `#8BBBE9` or Doctium Clinical Navy `#133157`, depending on contrast |

### Secondary / Alternative Layouts

| Variation | Recommended file name | Use case | Rule |
|---|---|---|---|
| Stacked signature | `doctium-logo-stacked.svg` | Onboarding, presentations, app store graphics | Default brand signature when space allows. |
| Horizontal signature | `doctium-logo-horizontal.svg` | Website navigation, product dashboards, partner pages | Logomark left, wordmark right. Keep vertical center alignment exact. |
| Logomark only | `doctium-logomark.svg` | Mobile launcher, favicon, small UI contexts | Use when the wordmark would be illegible. |
| Dark one-color mark | `doctium-logomark-dark.svg` | Monochrome documents, embossing, dark-on-light UI | Use only in Doctium Clinical Navy. |
| Reversed one-color mark | `doctium-logomark-white.svg` | Dark backgrounds, video lower thirds | Use only in white or near-white. |

Do not introduce unapproved lockups. If a new layout is needed, create it from the vector master while preserving the original proportions, color assignments, and clear-space rules.

### App Icon Specifics

For mobile launcher screens, app stores, favicons, and notification identity, isolate the logomark. Do not use the `DOCTIUM` wordmark or tagline inside mobile launcher icons.

| Platform / context | Required treatment |
|---|---|
| iOS app icon | Export a flattened 1024 x 1024 px PNG with no transparency. Place the logomark centered on a white or very light clinical background. Keep the symbol inside an 82% safe area. |
| Android adaptive icon foreground | Export a 432 x 432 px foreground PNG or vector drawable from the isolated logomark. Keep critical geometry within the central 66% safe area. |
| Android adaptive icon background | Use `#FFFFFF` or `#F7FAFC`. Do not use gradients behind the mark. |
| App store icon | Export 1024 x 1024 px PNG, sRGB, no alpha channel, centered logomark. |
| In-app compact icon | Use SVG wherever possible. Minimum recommended rendered size is 24 x 24 px. |
| Notification icon | Use a simplified monochrome version where required by the platform. Avoid the tagline and full wordmark. |

### Misuse / Prohibited Treatments

Do not:

- Stretch, compress, rotate, skew, or redraw the symbol.
- Change the navy or sky-blue logo colors outside the approved palette.
- Apply unapproved gradients, shadows, bevels, glows, glass effects, or outlines.
- Place the logo on noisy clinical imagery, patient photos, or low-contrast backgrounds.
- Use the tagline where it renders below 9 px high on digital screens.
- Crop the circular D form or cross geometry.
- Replace the custom logotype with a typed word in Inter, Plus Jakarta Sans, SF Pro, or any other UI font.
- Reorder the mark, wordmark, and tagline without an approved lockup.
- Use alert red, warning amber, or success green as brand logo colors.
- Place the logo inside dense EHR panels without the required clear space.

## 3. Color Palette (EHR-Specific)

Color use must support high-trust clinical workflows: calm default states, strong contrast, and clear separation between brand identity and patient safety status signals.

### Brand Colors

| Category | Color name | Hex | RGB | CMYK | Usage |
|---|---|---:|---:|---:|---|
| Primary Accent | Doctium Clinical Navy | `#133157` | 19, 49, 87 | C78 M44 Y0 K66 | Logo structure, headings, primary navigation, secure clinical surfaces |
| Secondary Accent | Precision Sky Blue | `#8BBBE9` | 139, 187, 233 | C40 M20 Y0 K9 | Medical cross, selected states, calm secondary emphasis |
| Secondary Accent | Connected Care Teal | `#2CB7A7` | 44, 183, 167 | C76 M0 Y9 K28 | Telemedicine connection states, availability indicators, secondary CTAs |
| Secondary Accent | Interface Blue | `#2563EB` | 37, 99, 235 | C84 M58 Y0 K8 | Links, focus rings, interactive controls where brand navy is too dark |

### Supporting Neutrals

| Category | Color name | Hex | RGB | CMYK | Usage |
|---|---|---:|---:|---:|---|
| Dark Background | Deep EHR Surface | `#0B1726` | 11, 23, 38 | C71 M39 Y0 K85 | Dark-mode headers, secure dashboard shells |
| Text | Primary Text | `#111827` | 17, 24, 39 | C56 M38 Y0 K85 | Clinical copy, patient names, provider notes |
| Text | Secondary Text | `#4B5563` | 75, 85, 99 | C24 M14 Y0 K61 | Metadata, timestamps, supporting labels |
| Border | Divider Gray | `#E5E7EB` | 229, 231, 235 | C3 M2 Y0 K8 | EHR cards, tables, form boundaries |
| Light Background | Clinical Canvas | `#F7FAFC` | 247, 250, 252 | C2 M1 Y0 K1 | App background, empty states, app icon canvas |
| Light Background | White | `#FFFFFF` | 255, 255, 255 | C0 M0 Y0 K0 | Cards, forms, modals, store icon background |

### Status Colors

Status colors must never replace logo colors. Use them for clinical state, system feedback, and workflow urgency. Always pair status color with text, iconography, or shape so meaning is not conveyed by color alone.

| Status | Color name | Hex | RGB | CMYK | Usage |
|---|---|---:|---:|---:|---|
| Success | Care Confirmed Green | `#12B76A` | 18, 183, 106 | C90 M0 Y42 K28 | Completed visits, successful payment, verified availability |
| Warning | Clinical Caution Amber | `#F79009` | 247, 144, 9 | C0 M42 Y96 K3 | Pending intake, incomplete forms, non-critical appointment risk |
| Alert | Critical Alert Red | `#D92D20` | 217, 45, 32 | C0 M79 Y85 K15 | Failed vitals sync, urgent workflow errors, destructive actions |
| Info | System Info Cyan | `#38BDF8` | 56, 189, 248 | C77 M24 Y0 K3 | Neutral system messages, education callouts, onboarding tips |

Accessibility requirements:

- Body text must meet WCAG AA contrast, minimum 4.5:1.
- Large text and icon labels must meet minimum 3:1.
- Do not use Precision Sky Blue `#8BBBE9` for small text on white.
- For CTAs on white, prefer Doctium Clinical Navy `#133157` or Interface Blue `#2563EB`.
- For dark surfaces, use white text and reserve sky blue for accents, not long-form copy.

## 4. Typography

### Primary Typeface

Recommended primary typeface: **Plus Jakarta Sans**.

Use for:

- Marketing headers.
- Product page section titles.
- App onboarding headings.
- Brand-adjacent UI surfaces.

Rationale: Plus Jakarta Sans has a modern geometric tone that complements the technical shape of the Doctium logotype while remaining friendly enough for patient-facing flows.

Fallback stack:

```css
font-family: "Plus Jakarta Sans", Inter, "SF Pro Display", "Segoe UI", Arial, sans-serif;
```

### Secondary Typeface

Recommended secondary typeface: **Inter**.

Use for:

- Mobile UI body copy.
- EHR dashboard tables.
- Form labels and helper text.
- Clinical note previews.
- Developer-facing documentation.

Fallback stack:

```css
font-family: Inter, "SF Pro Text", "Segoe UI", Roboto, Arial, sans-serif;
```

### Type Hierarchy for Mobile UI

| Token | Size | Line height | Weight | Usage |
|---|---:|---:|---:|---|
| `display-md` | 32 px | 40 px | 700 | Onboarding headline, major patient-facing screen title |
| `heading-lg` | 24 px | 32 px | 700 | Screen title, visit summary title |
| `heading-md` | 20 px | 28 px | 700 | Section heading, appointment detail group |
| `heading-sm` | 18 px | 26 px | 600 | Card title, modal title |
| `body-lg` | 16 px | 24 px | 400 | Primary reading text, instructions |
| `body-md` | 14 px | 20 px | 400 | Standard UI body, table text, form helper copy |
| `label-md` | 13 px | 18 px | 600 | Form labels, filter labels, chart labels |
| `caption` | 12 px | 16 px | 500 | Metadata, timestamps, secondary annotations |
| `micro` | 11 px | 14 px | 600 | Badges and compact table labels only |

Typography rules:

- Do not use text below 11 px in clinical workflows.
- Do not use decorative or condensed typefaces in patient-care interfaces.
- Keep letter spacing at `0` for body and UI text.
- Use sentence case for UI labels and title case for major marketing headings.
- Clinical data, medication names, vitals, and appointment times must prioritize legibility over brand expression.

## 5. Digital Asset & Export Specifications

### SVG Architecture

All production logo assets must be exported from a vector master and optimized before handoff. The PNG source files should not be auto-traced repeatedly in different tools, because repeated tracing creates inconsistent paths.

Required SVG principles:

| Requirement | Specification |
|---|---|
| Geometry | Use clean filled paths. Avoid embedded raster images, masks, filters, and unnecessary clipping groups. |
| ViewBox | Preserve native proportions. Recommended viewBoxes: `0 0 500 467` for the full stacked signature and `0 0 296 300` for the logomark. |
| Fill behavior | Branded SVGs must use fixed fills: `#133157` and `#8BBBE9`. Monochrome SVGs may use `fill="currentColor"`. |
| Stroke behavior | Avoid strokes for core logo geometry. Convert strokes to outlines before export. |
| Precision | Round path decimals to 2 or 3 places after visual QA. |
| Accessibility | For inline web use, include a `<title>` for meaningful brand placement or `aria-hidden="true"` for decorative use. |
| Responsiveness | Set `width="100%"` only in layout wrappers. The SVG itself should preserve `viewBox` and not hard-code CSS layout sizes. |
| Optimization | Run SVGO or equivalent optimization, but do not merge paths in a way that prevents approved recoloring of separate logo elements. |

Recommended inline SVG pattern:

```svg
<svg
  role="img"
  aria-labelledby="doctium-logo-title"
  viewBox="0 0 296 300"
  xmlns="http://www.w3.org/2000/svg"
>
  <title id="doctium-logo-title">Doctium</title>
  <path class="doctium-mark-primary" fill="#133157" d="..." />
  <path class="doctium-mark-accent" fill="#8BBBE9" d="..." />
</svg>
```

Next.js guidance:

- Store SVGs in `/public/brand/` for static references and in `/src/components/brand/` only if the SVG is converted to a React component.
- Use fixed-color branded SVGs for the official logo.
- Use `currentColor` only for approved monochrome UI icon variants.
- Do not recolor the official two-color logo with CSS filters.

Flutter guidance:

- Store assets under `assets/brand/`.
- Prefer SVG with `flutter_svg` for the logomark and wordmark where platform support allows.
- Use PNG fallbacks for launcher icons, splash screens, and app store assets.
- Do not apply `ColorFilter` to the two-color official logo. Use the monochrome SVG variant when a single-color mark is required.

### Required Production Asset Set

| Asset | Recommended file name | Format | Base size / viewBox | Background | Purpose |
|---|---|---|---:|---|---|
| Full stacked signature | `doctium-logo-stacked.svg` | SVG | `0 0 500 467` | Transparent | Master brand signature |
| Horizontal signature | `doctium-logo-horizontal.svg` | SVG | To vector master proportions | Transparent | Website and dashboard header |
| Logomark | `doctium-logomark.svg` | SVG | `0 0 296 300` | Transparent | App identity, compact UI |
| Dark logomark | `doctium-logomark-dark.svg` | SVG | `0 0 296 300` | Transparent | Single-color navy mark |
| White logomark | `doctium-logomark-white.svg` | SVG | `0 0 296 300` | Transparent | Reversed single-color mark |
| Favicon | `favicon.ico` | ICO | 16, 32, 48 px | Transparent or white | Browser tabs and legacy web contexts |
| Web app icon | `icon-192.png` | PNG | 192 x 192 px | Solid | PWA manifest |
| Web app icon | `icon-512.png` | PNG | 512 x 512 px | Solid | PWA manifest and Android store surfaces |
| iOS app icon | `app-icon-1024.png` | PNG | 1024 x 1024 px | Solid, no alpha | App Store Connect |
| Android adaptive foreground | `adaptive-icon-foreground.png` | PNG | 432 x 432 px | Transparent | Android launcher foreground |
| Android adaptive background | `adaptive-icon-background.png` | PNG | 432 x 432 px | Solid | Android launcher background |
| Splash logo | `splash-logo.png` | PNG | 512 x 512 px | Transparent | Flutter splash and loading screens |

### Favicon & ICO Specification

The `.ico` must contain multiple embedded resolutions:

| Embedded size | Use |
|---:|---|
| 16 x 16 px | Browser tab and legacy toolbar use |
| 32 x 32 px | Standard desktop browser favicon |
| 48 x 48 px | Windows shortcut and high-density fallback |

ICO creation rules:

- Use the isolated logomark only.
- Remove the tagline and wordmark.
- Align the symbol optically, not just mathematically, because the right-side D has more visual mass.
- Test at 16 px. If the two-color mark becomes muddy, use the single-color navy mark on a white canvas.
- Export from SVG to PNG sizes first, then package into `.ico`.

Example ImageMagick packaging command:

```bash
magick doctium-favicon-16.png doctium-favicon-32.png doctium-favicon-48.png favicon.ico
```

### App Icon PNG Exports

| Output | Size | Alpha | Color space | Notes |
|---|---:|---|---|---|
| App Store master | 1024 x 1024 px | No alpha | sRGB | White or Clinical Canvas background |
| Google Play icon | 512 x 512 px | Allowed, but solid preferred | sRGB | Keep mark inside safe zone |
| iOS notification/settings sizes | 20, 29, 40, 60, 76, 83.5 pt at required scales | No alpha | sRGB | Generate through native app icon pipeline |
| Android mipmap | mdpi through xxxhdpi | Usually no alpha for launcher composite | sRGB | Use adaptive icon layers for modern Android |
| PWA icon | 192 x 192 and 512 x 512 px | No alpha preferred | sRGB | Match app icon composition |

## 6. Cognitive Layout & Clear Space

### Clear Space Unit

Define `X` as the width of the vertical stem in the light-blue medical cross element of the logomark. This unit is visually tied to the healthcare component of the brand and scales reliably across the full signature and isolated mark.

Mandatory clear space:

| Logo usage | Minimum clear space |
|---|---|
| Full stacked signature | `1X` on all sides |
| Horizontal signature | `1X` top and bottom, `1.25X` left and right |
| Isolated app logomark | `0.75X` on all sides |
| Favicon / launcher icon canvas | Center mark within platform safe area; do not force extra clear space outside platform mask |
| Dense EHR dashboard header | `1X` from neighboring nav, filters, patient search, or account controls |

Clear space must remain free of:

- Patient data.
- Navigation items.
- Badges and notification counters.
- Partner logos.
- Appointment status chips.
- Background medical imagery.

### Minimum Size Limitations

| Logo asset | Digital minimum | Print minimum | Notes |
|---|---:|---:|---|
| Full signature with tagline | 240 px wide | 55 mm wide | Tagline must remain legible. |
| Full signature without tagline | 160 px wide | 32 mm wide | Use when the tagline would be too small. |
| Horizontal signature | 180 px wide | 38 mm wide | Best for top navigation and email headers. |
| Isolated logomark | 24 px wide | 8 mm wide | For compact UI and favicon-adjacent contexts. |
| App launcher icon | Platform-native sizes | N/A | Use platform icon pipeline, not the marketing lockup. |

### Placement in High-Density Clinical Interfaces

Doctium product screens may include appointment queues, patient records, provider availability, payments, and clinical forms. In these dense EHR contexts, the logo should establish trust without competing with clinical content.

Rules:

- Use the horizontal signature or logomark in app chrome, not the full stacked marketing signature.
- Keep the logo out of table rows, alert banners, and clinical note cards.
- Prefer the dark navy mark on white or Clinical Canvas backgrounds.
- On dark navigation surfaces, use the white monochrome mark or the two-color mark only if contrast remains strong.
- Do not place red alert badges directly adjacent to the logo. Maintain at least `1X` separation to prevent the brand from appearing as an error state.

## Implementation Checklist

Before approving a Doctium brand asset release:

- Confirm all SVGs are vector paths with no embedded raster image.
- Confirm the official two-color logo uses only `#133157` and `#8BBBE9`.
- Confirm monochrome variants use only approved navy, white, or `currentColor`.
- Confirm the tagline is removed from favicon and app icon exports.
- Confirm app store icons are square, centered, sRGB, and free of unintended alpha channels.
- Confirm minimum sizes and clear space in mobile, tablet, web, and marketing layouts.
- Confirm status colors are not used as brand logo colors.
- Confirm accessibility contrast for every logo placement and UI color pairing.
