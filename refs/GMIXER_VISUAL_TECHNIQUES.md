# gMixer Visual Techniques

These techniques can make gMixer more capable, but each is best suited to a
different visual layer.

## CSS `filter`

Best for media and lightweight visual correction.

```css
img, video {
  filter: grayscale(1) contrast(1.08) brightness(.92) saturate(.8);
}
```

Potential gMixer features:

- Grayscale, monochrome, sepia, duotone
- Brightness and contrast correction for dark or light themes
- Saturation control
- Hue rotation toward the active theme accent
- Blur for privacy or de-emphasis
- `drop-shadow()` for themed media edges
- Hover reveal: filtered by default, original on hover

This fits the existing Media section well. It is relatively simple and
performant, though filters can make images muddy and do not replace semantic
recoloring.

## CSS `backdrop-filter`

Best for translucent GUI surfaces such as:

- Settings panels
- Sticky headers
- Navigation bars
- Dialogs
- Floating cards
- Search shells
- Toolbars

```css
[data-gmixer-role="glass"] {
  background: color-mix(in srgb, var(--gmixer-surface-gui) 78%, transparent);
  backdrop-filter: blur(14px) saturate(1.2);
  -webkit-backdrop-filter: blur(14px) saturate(1.2);
}
```

This enables glass, frosted, or translucent theme styles while preserving page
depth.

Risks:

- Can be expensive over large areas
- May reduce text contrast
- Interacts poorly with fixed and sticky elements
- Requires careful opacity and fallback colors
- Should not be applied globally to `body`

The existing transparent popover `::backdrop` is not the same thing.
`::backdrop` controls the area behind the popover; `backdrop-filter` blurs
content behind an element.

## SVG `feColorMatrix` and SVG filters

Best for precise, custom image transformations.

They can implement:

- True grayscale
- Sepia
- Duotone mapping
- Arbitrary channel remapping
- Color inversion
- Theme-specific color replacement
- More controlled transformations than chained CSS filters

A grayscale matrix can be expressed as:

```xml
<feColorMatrix type="matrix" values="
  .3 .6 .1 0 0
  .3 .6 .1 0 0
  .3 .6 .1 0 0
  0   0   0 1 0"/>
```

An advanced duotone filter could map dark image pixels to one theme color and
light pixels to another. This could support theme packs where photography
shares one visual treatment.

SVG filters are more complex to generate and debug. They introduce issues
around filter IDs, inline SVG injection, CSP behavior, and browser
compatibility. CSS filters should remain the default; SVG filters could be an
advanced “duotone” or “custom media treatment” mode.

## `mix-blend-mode` and `background-blend-mode`

Useful for decorative theme treatments:

```css
.gmixer-themed-image {
  mix-blend-mode: multiply;
}
```

Possible uses:

- Accent-colored image overlays
- Texture and gradient washes
- Duotone-like treatments
- Integrating media into a theme surface

These are risky for normal page restyling because they depend heavily on
stacking contexts and can make content disappear or become unreadable. Restrict
them to explicitly classified media rather than arbitrary page elements.

## Masks, gradients, and `clip-path`

Useful for the Shape and Effects sections:

- Gradient masks around images
- Accent edge fades
- Custom clipped hero images
- Notched or angled cards
- Decorative section transitions
- Theme-shaped avatars and thumbnails

These pair naturally with the existing `clipping` and `corners` settings.

## `color-mix()`, gradients, and opacity

These are particularly useful for semantic roles:

```css
background:
  linear-gradient(
    135deg,
    color-mix(in srgb, var(--gmixer-accent) 18%, var(--gmixer-bg-primary)),
    var(--gmixer-bg-primary)
  );
```

They can generate:

- Accent-soft backgrounds
- Hover states
- Focus rings
- Borders
- Selected controls
- Surface elevation
- Disabled states

This is likely more valuable to gMixer than applying filters to the whole page
because it preserves the semantic color system.

## Recommended gMixer strategy

Use these in roughly this order:

1. CSS variables and semantic selectors for backgrounds, text, GUI, containers,
   borders, and focus.
2. CSS filters for images and video.
3. `backdrop-filter` for selected translucent GUI surfaces.
4. Gradients and `color-mix()` for generated hover, focus, accent-soft, and
   elevation states.
5. SVG filters as an advanced media mode for duotone and custom color mapping.
6. Blend modes and masks only for explicitly classified decorative media.

Avoid applying these globally to arbitrary `div` elements. The conservative
classifier and media-role tagging are the right foundation for preventing
visual glitches.
