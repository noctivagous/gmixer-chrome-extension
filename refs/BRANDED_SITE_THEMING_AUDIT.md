# Branded Site Theming — Analyzer Audit

Audit of the current gMixer color/theme analyzer against
[`BRANDED_SITE_THEMING.md`](./BRANDED_SITE_THEMING.md).

**Verdict:** The checklist items are implemented. Settings can focus Tone /
Media / full Theme. The adaptive pipeline settles before sampling, scores
visible regions into structural vs identity tokens, clusters with HSL buckets,
and applies preserve / harmonize / restyle. Remaining polish: Lab clustering,
brand-family hover CSS, and contrast-aware identity scoring.

---

## Capability checklist

| Plan capability | Status | Today |
|---|---|---|
| Structural vs identity palettes | Present | `samplePageRoles()` returns `structural` + `identity` |
| `getComputedStyle` after stabilize | Present | `waitForPageSettle()` before first adaptive pass |
| Sample + semantics, area, position, frequency, contrast | Present | Scored region samples; cluster repetition boost |
| Perceptual clustering + identity confidence | Partial | HSL bucket clustering (Lab still open) |
| Preserve site identity | Present | `color.identityMode: 'preserve'` (default) |
| Harmonize identity hue → theme accent | Present | `harmonizeHue()` + `identityMode: 'harmonize'` |
| Fully restyle | Present | `identityMode: 'restyle'` (legacy intensity blend) |
| Brand family (tint/shade/text-on-brand/hover) | Partial | Derived in blend; CSS hover/active wiring still open |
| Remove gMixer styles before sample | Present | Style + tonal + bgimg overlays cleared |
| Targeted CSS overrides; leave originals underneath | Present | `#gmixer-style` + semantic selectors |
| Image overlays (don’t replace `background-image`) | Present | `background-image-tagger.js` |
| Re-run policy (end / SPA / settings / layout + incremental) | Present | Settle + full on settings/layout/SPA; incremental mutations |

---

## What exists (mapped to the plan)

### Sampling — `src/content/page-sampler.js`

Takes a handful of `getComputedStyle` picks (`pickFirstColor`), not a scored
region census. Primary background is the one place with geometry + semantic
scoring (`findPrimaryBackgroundCandidates`).

Accent is “first heading color,” not masthead/nav brand. Link and border are
likewise first-match from bounded selector lists.

### Roles — `src/content/page-classifier.js`

Stamps structural/media attrs (`header`, `nav`, `card`, etc.). Those drive CSS
selectors, not color-identity assignment.

### Blend — `blendWithPageSample`

The only “how much site vs theme” control. Intensity 0 ≈ page, 100 ≈ theme;
every sampled role moves together. This is not preserve-identity or
hue-harmonize.

### Apply — `src/content/style-injector.js` + bgimg overlays

Matches the plan’s application strategy well: dedicated override stylesheet,
semantic selectors, originals left underneath, overlays for background images
instead of replacing `background-image`.

### Timing — `adaptive-pass.js`, `content-end.js`, `mutation-observer.js`

- Full sample (`runAdaptivePass`) on `document_end` / settings reapply.
- Incremental classify only (`runAdaptiveSubtreePass`) on mutations; reuses
  last color sample.
- No stabilize wait, no significant-layout resample, no dedicated SPA
  navigation resample.
- `removeStyle()` + `removeTonalSurfaceLayers()` run before sampling;
  background-image overlays are not cleared first.

---

## Pipeline gap

```text
Plan:   computed → visible regions → perceptual clusters → identity scoring
        → preserve | harmonize | fully restyle → targeted overrides

Actual: first-match getComputedStyle → flat role hexes
        → HSL blend by intensity → semantic CSS + bgimg overlays
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
| Orphan tonal overlay API | `src/content/tonal-surface-layer.js` (`ensureTonalSurfaceLayers` unused) |

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

- [ ] Upgrade HSL bucket clustering to Lab / OKLCH distance
- [ ] Emit brand-family hover/active CSS from derived tokens
- [ ] Contrast-aware identity scoring (text-on-brand pairs in the sampler)
