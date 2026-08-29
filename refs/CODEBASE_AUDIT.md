# gMixer Codebase Audit

Audit completed against the source tree and generated-extension architecture.
This document separates verified fixes from known limits so the product is not
represented as more complete than it is.

## Verified fixes in this audit

| Area | Fix | Evidence |
|---|---|---|
| Branded page chrome | The sampler's masthead and navigation identity colors now survive blending and are emitted as `--gmixer-masthead` / `--gmixer-nav` CSS tokens. | `src/content/page-sampler.js`, `src/content/style-injector.js` |
| Preserve / harmonize | Semantic/classified headers and navigation bars receive their own preserved or hue-harmonized identity fill and readable foreground. | `test/branded-theming.test.js` |
| SPA refresh | History navigation waits for route DOM to paint; URL changes observed with mutation batches also schedule a full resample. | `src/content/content-end.js`, `src/content/mutation-observer.js` |
| Identity false positives | Full classification now runs before sampling and sampled ad regions are excluded from identity scoring. | `src/content/adaptive-pass.js`, `src/content/page-sampler.js` |
| Flash effect | Flashing now targets interactive links and buttons instead of an unassigned `.gmixer-flash-target` class. | `src/content/style-injector.js` |
| Effects controls | Glow color and cursor style are exposed by the Effects panel; the default cursor remains `default`. | `src/popup/components/effects-panel.js` |
| Theme selection | Choosing a theme pack no longer forces a dark tone. | `src/settings/components/gmixer-settings.js` |
| Global switch clarity | The title-bar switch now identifies itself as applying to all tabs. | `src/popup/components/site-toggle.js` |
| Early commands | Toolbar/command messages arriving at `document_start` are queued and performed after the settings host initializes. | `src/messaging/early-message-queue.js` |
| Build-doc drift | Stale references to a non-existent popup bundle were removed. | `.gitignore`, `.cursor/rules/gmixer-rebuild.mdc` |

## Current architecture

```text
manifest → background message → content-start static theme
                             ↘ early-command queue
content-end → settled full sample → classify → CSS injection
            → settings host → store → chrome.storage
            → mutation / SPA refresh → full or incremental adaptive pass
```

There is no browser-action popup or options page. `src/popup/components/` is a
shared component directory used by the in-page Lit/Popover settings panel.

## Verified behavior

- The global store, persisted state, cross-tab updates, keyboard commands,
  section enablement, and accordion expansion are separately wired.
- The analyzer performs bounded computed-style sampling, perceptual Lab
  clustering, structural/identity splitting, and preserve/harmonize/restyle
  blending.
- CSS adapts document roots, semantic regions, controls, cards, links,
  headings, detected identity chrome, image filters, clipping/corners, and
  optional effects.
- Unit coverage includes brand blending/CSS, mutation processing, focus
  gating, page classification, navigation, and debug behavior.

## Remaining limitations and next work

### Structural limits

| Limitation | Impact | Recommended next step |
|---|---|---|
| Per-frame identity | `all_frames: true` themes embedded frames independently, but cross-origin frames cannot inherit the parent page's sampled brand. | Keep frame CSS sample-independent at document start; treat parent-brand propagation as a separate product decision. |
| Shadow DOM boundary | Open roots are classified and receive an adopted theme sheet; closed roots remain inaccessible and open-root internals do not contribute to the parent sample. | Keep bounded rediscovery for late open roots and document the closed-root limit. |
| Site-specific / gradient / SVG chrome | Arbitrary component bars, image gradients, SVG fills, and icon paint may remain unchanged. | Add bounded role-to-selector heuristics only after a site regression suite is established. |
| Sampling bounds | Candidate caps and viewport prioritization can miss long/infinite-scroll content. | Profile before raising limits; do not trade browsing performance for unbounded scans. |
| Router timing | A delayed/lazy route header can still appear after the settle window. | Add browser integration coverage with representative client routers before changing timing budgets. |

### Product and UX debt

| Item | Status |
|---|---|
| Per-site override state | Schema and merge path exist, but the UI intentionally exposes only the global all-tabs switch. |
| Custom font upload | Schema reserves `customFonts`; no upload/storage/`@font-face` flow exists. |
| Content bundle size | `content-end.js` includes the settings implementation in a single bundle; dynamic import defers evaluation, not download/parse. |
| Popover fallback | Opera GX/Chromium supports the current API; other browsers have no slide-out fallback. |
| Section vs inner controls | Media, Shape, and Effects have both section and feature toggles; retain the two-level model but improve inline explanation or activation defaults. |

## Release hygiene

- `extension/` is generated. Run `npm test && npm run build` after changes
  under `src/`.
- A fresh clone must install dependencies and run `npm run build` before
  loading `extension/` as an unpacked extension because runtime bundles are
  deliberately untracked.
- Before release, manually check a semantic news site, a React SPA, image
  filters, settings persistence across two tabs, and toolbar/shortcut behavior
  immediately after navigation.

## Validation completed

`npm test` passes with 62 tests after these fixes. The required production
build is run as the final task for this audit.
