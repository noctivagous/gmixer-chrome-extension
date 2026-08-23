# Palette-aware Media Filters

Plan for Media presets that pull from the Color section palette (`accent`,
`link`, surfaces, scheme hues) instead of fixed CSS filter recipes.

Related: [GMIXER_VISUAL_TECHNIQUES.md](./GMIXER_VISUAL_TECHNIQUES.md),
product description Feature 3 (Image CSS Filters).

## Current state

| Preset | Theme / Color aware? | Mechanism |
|--------|----------------------|-----------|
| `grayscale` | No | Fixed `grayscale(1)` |
| `sepia` | Partial (bg overlay uses accent) | Fixed `sepia(0.8)` |
| `invert` | No | Fixed `invert(1)` |
| `monochrome` | Tone only (`isDark` brightness) | Adaptive grayscale |
| `duotone` | Accent hue | `grayscale + sepia + hue-rotate` toward `palette.accent` |
| `custom` | User string | Passthrough |

Background images use a separate overlay (`mix-blend-mode`) rather than
filtering the owner element. Palette washes should keep that path.

With Color on, the blended palette already exposes `accent`, `link`,
`background`, surfaces, and scheme-derived hues (`analog`, `complement`,
`splitComplement`, `triadic`, `tetradic`, `monochrome`).

## Gating rule

Palette-driven presets require the Color section to be on (same
`isSectionEnabled(..., 'color')` bit used for surface paint, including the
legacy Tone merge).

When Color is **off**:

- CSS resolves palette presets to `monochrome` (neutral media wash).
- UI hides or disables palette-only options; stored preset is kept so
  turning Color back on restores the wash without re-picking.

When Color is **on**, palette presets use live blended colors from the
active base / scheme / tone.

## Batch 1 — cheap CSS stack (same path as duotone)

Ship first. No SVG injection.

| Preset id | Uses | Look |
|-----------|------|------|
| `accent-tint` | `accent` at lower sepia/saturate | Soft brand cast (lighter than duotone) |
| `link-wash` | `link` (scheme 2nd hue when present) | Same recipe as duotone, other palette role |
| `duotone` | `accent` (existing) | Strong accent wash; Color-gated like the new ones |

Implementation notes:

- Shared helper: sepia base (~35°) → `hue-rotate` toward target hex.
- Bg overlay: `mix-blend-mode: color` with `accent` / `link`; tint may use
  lower overlay opacity than full duotone.
- Category Media selects and global preset dropdown share the same id list.
- Tests: Color on emits hue-rotate / link color; Color off falls back to
  monochrome CSS for these ids.

## Batch 2 — true two-stop mapping

| Preset / mode | Uses | Look |
|---------------|------|------|
| True duotone | Darks → `background` / deep surface; lights → `accent` (or user stops) | Real duo, not hue-rotated sepia |

Needs SVG `feComponentTransfer` / `feColorMatrix` (or equivalent), filter URL
injection, CSP-safe IDs. Keep CSS filters as default; SVG as advanced mode.
See Visual Techniques § SVG filters.

## Batch 3 — scheme-paired stops

| Preset / mode | Uses | Look |
|---------------|------|------|
| Scheme wash | Stop A/B from active scheme (complement, split, triadic, …) | Media follows Color’s relationship, not only base accent |

Depends on Batch 2 stop machinery plus `accentHueOffsets` / scheme outputs
from `color-theory.js`.

## Later CSS-path candidates (optional)

| Preset | Uses | Look |
|--------|------|------|
| Brand mono | Grayscale + light accent color-blend | Gray photos, faint theme cast |
| Warm / cool | Surface / bg lightness | Cooler on dark themes, warmer on light (beyond current mono) |

## Keep secondary / skip

- **Keep:** `invert` (utility), `grayscale` / `sepia` (non-palette), `custom`,
  hover reveal.
- **Skip as “palette mapping”:** blur, drop-shadow (effects, not remapping).

## Practical order

1. Accent tint + link wash + Color-gated UI (and gate existing duotone).
2. True two-stop duotone when Color is on.
3. Optional scheme-paired stops.
4. Brand mono / warm-cool if still needed after true duo.

## Files

- `refs/PALETTE_MEDIA_FILTERS.md` — this plan.
- `src/config/image-filter-presets.js` — shared palette preset ids + Color fallback.
- `src/content/style-injector.js` — `imageFilterPresetCss`, bg overlay, Color gate.
- `src/popup/components/image-filter-panel.js` — preset lists + Color-gated UI.
- `test/color-restyle.test.js` — emission + fallback coverage.
- Theme preview may map new `data-filter` ids for pack cards later.
