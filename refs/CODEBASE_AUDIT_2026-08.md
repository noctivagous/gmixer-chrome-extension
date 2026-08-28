# gMixer Codebase Audit — 2026-08

Fresh audit of `src/`, `build.js`, `package.json`, and `extension/manifest.json`
against the current tree (108/108 tests passing at time of writing). This
complements the earlier [`CODEBASE_AUDIT.md`](./CODEBASE_AUDIT.md) and
[`BRANDED_SITE_THEMING_AUDIT.md`](./BRANDED_SITE_THEMING_AUDIT.md) (which track
analyzer/theming completeness) by focusing on code health: dead code, error
handling, leaks, security, performance, tests, build, and accessibility.

No `TODO`/`FIXME`/`HACK` comments and no `innerHTML`/`eval`-style sinks exist
anywhere in `src/` — the codebase is clean on those two axes already.

---

## Findings and task list

### Dead / orphan code

- [x] `src/content/tonal-surface-layer.js` — deleted the legacy, unused
      overlay API. Paint is CSS-only; there is no longer an obsolete
      compatibility teardown path.
- [x] `src/state/site-enable.js` — removed unused `isSiteThemingEnabled()`.
      Per-site overrides (including `enabled`) still apply through
      `store.getResolvedStateForHost()`. Master on/off is
      `isMasterThemingEnabled()` / Alt+N.
- [x] `src/config/fonts.js` — removed unused runtime `getFontsByCategory()`.
      Font-fetch scripts keep their own copies.
- [x] `src/popup/components/theme-pack-panel.js` — deleted; nothing imported
      the deprecated `gmixer-theme-pack-panel` alias.

### Error handling

- [x] SPA URL change + DOM mutations no longer inject CSS from the previous
      route's identity sample. `mutation-observer` skips incremental
      `onSubtree` / `onCascadeThreat` when `location.href` changed and lets
      the navigation handler run a full resample after settle.
- [x] `early-message-queue.js` now queues `MSG_OPEN_SETTINGS` and
      `MSG_OPEN_WALKTHROUGH` as well as the toggle messages.
- [x] `settings-host.js` logs `store.ready` initialization failures instead
      of swallowing them with an empty `catch`.
- [x] `storage-adapter.js` logs write/sync/load failures unless the error is
      an invalidated extension context (stale content script after reload).
- [x] `store.js` accepts persisted data only when it has the current
      `SCHEMA_VERSION` and a `{ global: object }` shape. The obsolete
      typography migration was removed, following the forward-only active
      development convention.

### Memory / lifecycle leaks

- [x] `content-end.js` now unsubscribes the store, disconnects the mutation
      observer, and calls `nav.destroy()` on `pagehide`.
- [x] `store.subscribe(reapply)` unsubscribe is retained and used in that
      teardown path.
- [x] `HoverOutline._flash()` timer is tracked and cleared in `stop()`.

### Security

- [x] Documented why `<all_urls>` is required in `README.md` (universal
      re-themer + `@font-face` font files).
- [x] Debug bridge `postMessage` uses `window.location.origin` and ignores
      events from other origins. Still compile-gated by `__GMIXER_DEBUG__`.
- [x] Confirmed: session storage from untrusted content scripts only holds
      generated CSS + fingerprint (`css-cache.js`). Comment added in
      `background.js`.

### Performance

- [x] `rotating-cube.js` and `pan-scan.js` iterate at most
      `MAX_MEDIA_EFFECT_SCAN` images via `document.images`.
- [x] Background-image tagging walks with a TreeWalker and stops at
      `MAX_BACKGROUND_IMAGE_SCAN` (including large injected subtrees).
- [x] Incremental `classifySubtree(..., { skipClassified: true })` skips
      already-stamped nodes instead of clear/restamp.
- [x] Rotating-cube (and pan-scan frames) read `getComputedStyle` once per
      wrapped element.

### Consistency / maintainability

- [x] Settings Alt+M/N typing guard uses `isTypingContext` from
      `clickable-detector.js`.
- [x] Scan caps live in `src/content/scan-limits.js` with comments.
      `css-cache.js:18` was a hash loop, not a DOM scan cap — left as-is.
      Tonal overlay scan cap went away with `ensureTonalSurfaceLayers`.
- [x] Named debounce constants in `src/content/adaptive-timing.js`
      (`SPA_ROUTE_DEBOUNCE_MS` = 100, `LAYOUT_RESAMPLE_DEBOUNCE_MS` = 400).
      Values stay different on purpose (history vs continuous resize).

### Test coverage

- [x] Added `test/storage-adapter.test.js` for storage-area splitting,
      local-over-sync precedence, storage-change subscription lifecycle, and
      schema-version validation. This covers the previously highest-risk
      untested state path.
- [x] Kept the unit-test boundary intentional: browser/lifecycle and Lit
      component integration require a browser DOM harness, not shallow
      file-by-file import tests. Existing unit tests cover their pure
      algorithms (classification, mutation routing, effects, focus rules,
      palette generation, storage, and messages); browser integration testing
      remains a release-validation activity rather than a misleading
      Node-only checkbox.

### Build / tooling

- [x] GitHub Actions job `.github/workflows/gmixer.yml` runs
      `npm run lint`, `npm test`, and `npm run build` on gMixer paths.
      `package.json` now has an ESLint command and flat configuration.
- [x] `build.js` `--minify` now emits `external` sourcemaps instead of
      disabling them.

### Accessibility (settings / walkthrough UI)

- [x] Settings and walkthrough dialogs both use `aria-modal="true"`,
      receive initial focus on open, and have a Tab focus trap.
- [x] Escape closes the walkthrough or settings popover.
- [x] Font picker: `aria-label`, `aria-labelledby`, `aria-activedescendant`,
      Arrow/Home/End/Enter keyboard navigation.
- [x] Clipping / navigation / corners enable controls wrap the checkbox in
      a `<label>` and use `role="switch"` / `aria-checked`.

---

## Not re-litigated here

Analyzer/theming completeness (structural vs identity palettes, preserve /
harmonize / restyle, shadow DOM, iframes, gradients/SVG chrome) is already
tracked in [`CODEBASE_AUDIT.md`](./CODEBASE_AUDIT.md) and
[`BRANDED_SITE_THEMING_AUDIT.md`](./BRANDED_SITE_THEMING_AUDIT.md); this
document intentionally does not duplicate that checklist.

## Validation

`npm test` + `npm run build` after implementing the items above.
