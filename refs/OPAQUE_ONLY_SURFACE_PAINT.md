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
3. `stampOpaquePaintTargets` — set or clear `data-gmixer-native-l` on CSS paint
   candidates.
4. `assignToneSteps` — rank hosts that still have native luminance.
5. `roleCss(..., { paintOpaqueOnly })` — append `[data-gmixer-native-l]` to
   fill selectors when the flag is on.

## Files

- `src/state/schema.js` — default `paintOpaqueOnly: true`
- `src/popup/components/color-panel.js` — toggle
- `src/content/page-classifier.js` — `stampOpaquePaintTargets`
- `src/content/style-injector.js` — gated `roleCss`
