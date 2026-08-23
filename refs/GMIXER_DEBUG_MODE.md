# gMixer Debug Mode

A dedicated debug module makes browser `evaluate_script` / CDP work much more
effectively. Instead of repeatedly writing long DOM queries, call a stable
diagnostic API exposed by the extension.

## Enable

```bash
npm run build:debug
# or
npm run watch:debug
```

Then reload the unpacked extension. Debug is **off** in normal `npm run build`
and minify builds (`__GMIXER_DEBUG__` is compile-time `false`).

## API

```js
window.gmixerDebug = {
  state(),
  resolvedState(hostname),
  openSettings(),
  closeSettings(),
  toggleSection(id),
  setSectionEnabled(id, enabled),
  samplePage(),
  findPrimaryBackground(),
  inspectRoles(),
  rebuildCss(),
  dumpDiagnostics()
};
```

In a debug build:

- **Isolated world** (content script / DevTools “gMixer” context):
  `globalThis.gmixerDebug` is installed directly.
- **Page main world** (default browser `evaluate_script` / page console):
  `extension/debug-bridge.js` is injected and proxies calls to the content
  script via `postMessage`. Methods return Promises.

Example:

```js
await window.gmixerDebug.dumpDiagnostics();
await window.gmixerDebug.openSettings();
await window.gmixerDebug.setSectionEnabled('filter', true);
await window.gmixerDebug.toggleSection('tone');
```

## Diagnostics covered

- Current global and per-site state
- Active theme and generated palette inputs
- Enabled and disabled sections
- Open accordion and settings scroll position
- Detected BG:Primary color and top scored candidates
- Classified `data-gmixer-role` / `data-gmixer-media` counts
- Injected CSS size and key variable presence
- Settings popover visibility

## Safety model

```js
if (globalThis.__GMIXER_DEBUG__) {
  globalThis.gmixerDebug = createDebugApi(/* deps */);
}
```

Production builds do not install the API or inject the bridge. Mutating methods
call existing store / settings-host actions so behavior matches normal UI
paths (including cross-tab sync).

## Source layout

| File | Role |
| --- | --- |
| `src/debug/debug-api.js` | Pure API factory (dependency-injected) |
| `src/debug/install-debug.js` | Content-script installer + message bridge |
| `src/debug/main-world-bridge.js` | Page-world `window.gmixerDebug` stub |
| `extension/debug-bridge.js` | Bundled bridge (web_accessible) |

`content-end.js` calls `installDebugApi(store, reapply)` after the adaptive
pass and settings host are wired.
