# Branded Site Theming — Analyzer Audit

Audit of the current gMixer color/theme analyzer against
[`BRANDED_SITE_THEMING.md`](./BRANDED_SITE_THEMING.md).

**Verdict:** The analyzer checklist is implemented: settings can focus Tone /
Media / full Theme, the adaptive pipeline settles before sampling, scores
visible regions into structural versus identity tokens with Lab ΔE clustering
and contrast-aware identity scoring, and derives preserve / harmonize /
restyle palettes. The application gap has now been closed for sampled semantic
mastheads and navigation bars: their identity colors are emitted as dedicated
tokens and painted back to classified/semantic chrome.

---

## Capability checklist

| Plan capability | Status | Today |
|---|---|---|
| Structural vs identity palettes | Present | `samplePageRoles()` returns `structural` + `identity` |
| `getComputedStyle` after stabilize | Present | `waitForPageSettle()` before first adaptive pass |
| Sample + semantics, area, position, frequency, contrast | Present | Scored regions; text-on-brand contrast bonus/penalty |
| Perceptual clustering + identity confidence | Present | Lab ΔE clustering (`COLOR_CLUSTER_DELTA_E`) |
| Preserve site identity | Present | `color.identityMode: 'preserve'` (default) |
| Harmonize identity hue → theme accent | Present | `harmonizeHue()` + `identityMode: 'harmonize'` |
| Fully restyle | Present | `identityMode: 'restyle'` (legacy intensity blend) |
| Brand family (tint/shade/text-on-brand/hover) | Present | Derived tokens + `--gmixer-brand-*` hover/active CSS |
| Remove gMixer styles before sample | Present | Style + tonal + bgimg overlays cleared |
| Targeted CSS overrides; leave originals underneath | Present | `#gmixer-style` + semantic selectors |
| Image overlays (don’t replace `background-image`) | Present | `background-image-tagger.js` |
| Re-run policy (end / SPA / settings / layout + incremental) | Present | Settle + full on settings/layout/SPA; incremental mutations |

---

## What exists (mapped to the plan)

### Sampling — `src/content/page-sampler.js`

Scores visible regions by area, viewport position, semantics, Lab ΔE
repetition, and text-on-brand contrast. Returns flat role hexes plus
`structural` / `identity` token bags (masthead, nav, link, accent vs
backgrounds, text, borders).

### Roles — `src/content/page-classifier.js`

Stamps structural/media attrs (`header`, `nav`, `card`, etc.). Those drive CSS
selectors; identity colors come from the scored sampler.

### Blend — `blendWithPageSample`

Intensity blends structural roles. `identityMode` controls brand colors:
preserve, harmonize (hue remap), or restyle. Derives a brand family for CSS.

### Apply — `src/content/style-injector.js` + bgimg overlays

Matches the plan’s application strategy well: dedicated override stylesheet,
semantic selectors, masthead/nav identity selectors, originals left underneath,
and overlays for background images instead of replacing `background-image`.

### Timing — `adaptive-pass.js`, `content-end.js`, `mutation-observer.js`

- Full sample (`runAdaptivePass`) on `document_end` / settings reapply.
- Incremental classify only (`runAdaptiveSubtreePass`) on mutations; reuses
  last color sample.
- Full resample after page settle, settings reapply, significant layout change,
  History API navigation, and URL changes observed alongside route DOM changes.
- `removeStyle()`, tonal layers, and background-image overlays are cleared
  before sampling.

---

## Remaining coverage limits

```text
Implemented: computed styles → visible regions → Lab clusters → identity scoring
             → preserve | harmonize | restyle → semantic/classified CSS + overlays

Not covered: cross-origin frames, shadow-root internals, gradients/SVG paint,
             arbitrary component chrome, or arbitrary below-fold page regions.
```

---

## Closest existing levers (not substitutes)

- **Intensity** ≈ continuous restyle amount, not preserve/harmonize.
- **Theme `buildPalette`** derives a role family from the *chosen theme*, not
  the site brand.
- **“Identity media”** in theme packs means logo/avatar filter exemption, not
  brand color.

Sibling design in [`CSS_COMPUTATION_THEMING.md`](./CSS_COMPUTATION_THEMING.md)
overlaps (stabilize → sample → score → blend) but still doesn’t define the
structural/identity split or preserve/harmonize modes.

---

## Key source map

| Concern | Path |
|---------|------|
| Sampling | `src/content/page-sampler.js` |
| Orchestration | `src/content/adaptive-pass.js` |
| Classifier | `src/content/page-classifier.js` |
| Theme math | `src/lib/color-theory.js` |
| CSS paint | `src/content/style-injector.js` |
| Bg overlays | `src/content/background-image-tagger.js` |
| Timing | `src/content/content-start.js`, `content-end.js`, `mutation-observer.js` |
| Intensity setting | `src/state/schema.js`, `popup/components/color-panel.js` |
| Tonal overlay teardown | `src/content/tonal-surface-layer.js` (`removeTonalSurfaceLayers` only; overlays are legacy) |

Related notes: `refs/GMIXER_DEBUG_MODE.md` (debug hooks for `samplePage` /
`findPrimaryBackground`), `product description.txt` (intensity + role palette).

No `TODO`/`FIXME` in `src/` tracks branded/identity clustering; the specs live
in `refs/`.

---

## Task list

### Settings UX

- [x] Settings prioritization: add a select dropdown that scopes which accordion
      sections are shown (`product description.txt` lines 6–12):
      - Only: Monochrome Page Media → Media accordion only
      - Only: Light | Gray | Dark Mode (Tone) → Tone accordion only
      - Theme (Select Settings) → all theme accordions

### Analyzer / branded theming

- [x] Region sampling with area, position, and repetition (replace first-match)
- [x] Structural vs identity token split (masthead/nav/link vs surfaces/text/borders)
- [x] Explicit modes: preserve / harmonize / fully restyle (intensity alone can’t
      express “keep magenta, restyle neutrals”)
- [x] Perceptual color clustering + identity confidence scoring
      (HSL bucket clustering; Lab upgrade still open)
- [x] Derive brand family from detected identity (tint/shade/text-on-brand/hover/active)
- [x] Harmonize: map site identity hue to theme accent while keeping L/S/contrast
- [x] Clear bg overlays before sampling (alongside style + tonal teardown)
- [x] Stabilize wait before sampling after `document_end`
- [x] Full resample on significant layout change and SPA navigation; keep
      incremental classify between those events

### Follow-ups (not blocking the checklist)

- [x] Upgrade HSL bucket clustering to Lab / OKLCH distance
- [x] Emit brand-family hover/active CSS from derived tokens
- [x] Contrast-aware identity scoring (text-on-brand pairs in the sampler)
