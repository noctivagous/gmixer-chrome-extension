# Theming Branded Websites

## Problem

Many websites do not use one neutral palette. Their identity is expressed
through repeated colors in mastheads, navigation bars, article heading bars,
category labels, links, buttons, borders, and icons.

For example:

- Slashdot uses teal/green across its masthead, navigation, article title
  bars, and links.
- Windows Central uses magenta in its masthead and section accents, with dark
  gray navigation and mostly white content surfaces.

A re-theme that only changes `body` or the primary background will leave these
strong identity colors untouched. A re-theme that replaces every color
independently will destroy the site's visual relationships.

## Use two palettes

The analyzer should distinguish between:

### Structural palette

- Page background
- Secondary page regions
- Cards and containers
- GUI controls
- Body and muted text
- Borders

### Identity palette

- Masthead and site header
- Navigation and article heading bars
- Primary links
- Buttons and labels
- Accent borders and icons
- Hover and active states

The structural palette is usually safe to normalize. The identity palette
should either be preserved or deliberately harmonized with the selected
gMixer theme.

## Analyze rendered CSS

Use `getComputedStyle()` after the page has loaded and stabilized. This sees
the final result after inheritance, CSS variables, media queries, and the
cascade have been resolved.

```js
const style = getComputedStyle(element);
const rect = element.getBoundingClientRect();

({
  background: style.backgroundColor,
  color: style.color,
  border: style.borderColor,
  area: rect.width * rect.height,
  top: rect.top,
});
```

Do not treat the color list as sufficient by itself. Associate each sample
with:

- Element semantics and ARIA role
- Visible area and viewport position
- Frequency and repetition
- Text contrast
- Whether it belongs to a header, link, control, surface, or content region

## Color clustering and confidence

Group nearby rendered colors into clusters in a perceptual color space rather
than comparing raw RGB values. Rank clusters using:

- Total visible area
- Number of repeated elements
- Position near the top-level header or navigation
- Semantic roles and element types
- Contrast with nearby text
- Persistence across repeated components

A large, repeated saturated color in a masthead or article heading bar is a
strong identity-color candidate. A one-off saturated ad or article image
should have low identity confidence.

## Two user-facing behaviors

### Preserve site identity

Keep the site's green, magenta, or other brand colors while adapting its
neutral backgrounds, surfaces, text, and controls. This is generally the most
natural default because the page remains recognizable.

### Harmonize site identity

Map the detected identity hue to the selected theme's accent while preserving
the site's lightness, saturation, and contrast relationships. For example:

```text
Slashdot green → selected theme accent hue
Windows Central magenta → selected theme accent hue
```

This produces a stronger transformation and should be an explicit preference,
not an accidental side effect.

A possible setting model is:

- Preserve site identity
- Harmonize site identity
- Fully restyle

## Preserve relationships

Do not replace each discovered color independently. Derive a family of roles
from each identity color:

```text
brand color
→ lighter brand tint
→ darker brand shade
→ readable text on brand
→ hover variation
→ active variation
```

This keeps a branded header coherent after theming and preserves readable
contrast.

## Application strategy

After analysis:

1. Remove gMixer's temporary stylesheet and overlays before sampling.
2. Sample and score visible rendered regions.
3. Build structural and identity role tokens.
4. Preserve or harmonize identity tokens according to the user's preference.
5. Apply targeted CSS overrides with sufficient specificity.
6. Leave original site declarations available underneath the overrides.
7. Use dedicated overlays for background images; never replace the original
   `background-image` just to recolor it.
8. Discover interaction-only flyouts after hover/focus/click layout settles,
   stamp confirmed semantic or positioned panels as surfaces, and paint them
   independently of their header ancestry.

Re-run full analysis on initial `document_end`, major SPA navigation, explicit
settings reapply, and significant layout changes. Use incremental
classification between those events instead of rescanning every mutation, but
suspend gMixer paint during every native-background/luminance measurement.

## What gMixer does today

gMixer already samples computed page colors and identifies backgrounds, text,
links, borders, and semantic regions. That is a useful foundation, but a
reliable branded-site solution needs a bounded rendered-role analyzer that
clusters colors and assigns confidence using geometry, semantics, repetition,
and contrast.

The target pipeline is:

**computed styles → visible region detection → perceptual color clustering →
semantic role scoring → identity preservation or harmonization → targeted CSS
overrides and image overlays**
