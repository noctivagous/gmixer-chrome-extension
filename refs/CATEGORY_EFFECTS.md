# Per-category Effects

Effects are chosen **per element category** (one effect each), plus a few
page-global controls.

## Categories

| Category | Valid effects | Selectors / runtime |
|----------|---------------|---------------------|
| Images | `none`, `glow`, `pan-scan` | `img`, `picture img` |
| Videos | `none`, `glow` | `video` |
| Body links | `none`, `glow`, `flash` | In-content `a` (not headings, not chrome) |
| Navigation | `none`, `glow`, `flash` | header/footer/nav links, buttons |
| Articles | `none`, `link-shimmer` | Viewport teaser cards (JS cycler) |

## Effect catalog

| Id | Look | Notes |
|----|------|-------|
| `none` | — | Default |
| `glow` | Soft halo | Images/videos use shared `effects.glow` (`box-shadow` so Media `filter` does not wipe it). Body links and navigation each have their own `categories.*.glow` animated + color options (`text-shadow` / drop-shadow pulse). Glow color is derived so it is never the same hex as the ink it sits behind. |
| `flash` | Opacity flicker | Navigation only |
| `pan-scan` | Slow Ken Burns zoom/pan | Images only. May show edge bleed if parents are `overflow: visible`. |
| `link-shimmer` | Cycling shimmer | Articles only. Scans KeyPilot-inspired card shells in the viewport; stamps title link + companion image one pair at a time. |

## Page-global (not category-scoped)

- Cursor mods
- Animated background motion

## State

```js
effects: {
  categories: {
    images: { effect: 'none' },
    videos: { effect: 'none' },
    hyperlinks: { effect: 'none', glow: { animated: true, color: '' } },
    navigation: { effect: 'none', glow: { animated: true, color: '' } },
    articles: { effect: 'none' },
  },
  glow: { animated: true, color: '' }, // images + videos
  cursor: { enabled: false, style: 'default' },
  backgroundMotion: { enabled: false },
}
```

Body vs navigation hyperlinks also have separate rest/hover color tokens (`link` / `linkHover` vs `navLink` / `navLinkHover`), generated from the same color scheme.

[`normalizeEffects`](../src/config/effects-catalog.js) clamps invalid category
effect ids to `none`.

## Files

- `src/config/effects-catalog.js` — catalog + normalize
- `src/popup/components/effects-panel.js` — UI
- `src/content/style-injector.js` — `effectsRules` (incl. shimmer CSS)
- `src/content/article-card-detector.js` — card shell scan
- `src/content/link-shimmer.js` — viewport cycler
- `src/state/schema.js` — defaults
