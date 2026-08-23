# Computed CSS and Natural Theming

## Recommendation

Yes, gMixer should use the page's rendered CSS values to make theming more
natural and accurate. The analysis should be targeted rather than a complete
CSS rewrite.

The useful distinction is:

- `getComputedStyle()` reveals the final rendered values after inheritance,
  CSS variables, media queries, and cascade resolution.
- CSSOM inspection attempts to inspect the authored rules. It is less reliable
  because cross-origin stylesheets can expose inaccessible `cssRules`, and
  authored rules do not necessarily describe the current rendered result.

## Preferred pipeline

1. Let the page reach a stable state after `document_end`.
2. Temporarily remove gMixer's stylesheet and overlays.
3. Sample computed styles from visible, meaningful elements.
4. Resolve page roles such as:
   - primary and secondary backgrounds
   - GUI controls
   - cards and larger containers
   - body text and muted text
   - links and accents
   - borders and focus indicators
   - background-image owners
5. Score samples using semantics, viewport visibility, rendered area, and
   repetition so one incidental element does not determine the whole palette.
6. Blend the selected theme toward the page palette according to the
   configured intensity.
7. Reapply gMixer's stylesheet and preserve original page images and layout.

This lets the theme respond to the actual page instead of assuming that
`body` is always the page background or that every `div` is a surface.

## What to analyze

Use `getComputedStyle()` on a bounded set of candidates:

- `html`, `body`, `main`, `article`, `header`, `footer`, `nav`, and semantic
  ARIA regions
- elements with substantial rendered area
- controls and repeated card/container patterns
- headings, paragraphs, links, and borders
- elements whose computed `background-image` contains a URL

Prefer visible elements and cap the number of inspected nodes. Sampling a
representative subset is usually more useful than walking the entire page.

The current page sampler and background-image tagger already provide the
foundation for this approach.

## What not to do

Avoid rewriting every authored CSS declaration or traversing every stylesheet.
That approach can:

- fail on cross-origin stylesheets
- become slow on large applications
- interact badly with specificity and `!important`
- break layout, animations, hover states, and component-library assumptions
- become stale as JavaScript changes classes and inline styles

gMixer should keep applying a dedicated stylesheet and use overlays for
background images. The original `background-image` declaration should remain
untouched; filtering the image owner can also unintentionally filter its text
and controls.

## Timing and resampling

Sampling should happen after the initial DOM is available and after gMixer's
temporary paint has been removed. This prevents the extension from sampling
its own colors.

Resample on meaningful events:

- initial `document_end`
- major SPA route or navigation changes
- large subtree additions
- explicit settings reapply

Do not resample on every mutation. Subtree classification and background-image
tagging can remain incremental between full samples.

## Practical conclusion

Computed-style analysis is a worthwhile improvement and should become the
source of page-aware palette roles. The safe design is:

**bounded rendered-style analysis → semantic role scoring → palette blending →
dedicated CSS overrides and image overlays**

This gives more accurate results without taking ownership of the site's full
CSS system.
