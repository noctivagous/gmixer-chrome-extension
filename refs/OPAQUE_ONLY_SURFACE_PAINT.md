# Opaque-only surface paint

## Flag

`global.color.paintOpaqueOnly` (default **`true`**).

Color panel: “Only paint surfaces that already had a background.”

When **on**, structural fills require `data-gmixer-native-l` (opaque native
`background-color` captured before restyle). Transparent layout wrappers share
the page canvas instead of getting a synthetic fill.

When **off**, restores unconditional paints on matched headers, sections,
articles, controls, etc. (legacy behavior). `html` / `body` always receive the
primary canvas either way.

## Pipeline

1. Classify roles (`classifySubtree`).
2. Seed opaque page sheets / promote nested opaque surfaces.
3. Suspend gMixer's stylesheet for both full and incremental native-style
   measurement.
4. `stampOpaquePaintTargets` — set or clear `data-gmixer-native-l` on CSS paint
   candidates. Semi-transparent fills are composited against their effective
   backdrop; negligible alpha tints are not opaque sheets.
5. `assignToneSteps` — cluster hosts by native luminance, independently for
   content and header/navigation chrome. Equal native depth receives the same
   step across full and incremental passes.
6. `roleCss(..., { paintOpaqueOnly })` — append `[data-gmixer-native-l]` to
   fill selectors when the flag is on.

Interactive flyouts are an exception to opaque-only gating. Once a visible
semantic or positioned overlay is confirmed, it is stamped as `surface` and
receives an opaque GUI sheet even when the site's panel started transparent.

## Files

- `src/state/schema.js` — default `paintOpaqueOnly: true`
- `src/popup/components/color-panel.js` — toggle
- `src/content/page-classifier.js` — `stampOpaquePaintTargets`
- `src/content/style-injector.js` — gated `roleCss`
