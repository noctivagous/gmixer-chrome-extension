# gMixer

Re-theme any web page — colors, fonts, image filters, corner clipping /
radius overrides, and effects — through one **in-page Settings popover**.
Built for Opera GX (current Chromium engine). See `product description.txt`
for the full spec.

## Setup

```bash
npm install
npm run build        # one-off build
npm run build:debug  # build with window.gmixerDebug for evaluate_script
npm run watch        # rebuild on change
npm run watch:debug  # watch with debug API enabled
npm run build:minify # production build
```

Load `extension/` as an unpacked extension (`opera://extensions` or
`chrome://extensions` → Developer mode → Load unpacked).

Open Settings: **toolbar icon** or **Alt+M**. Toggle theming on **all tabs**:
**Alt+N** (same control as the titlebar On/Off switch). Both are remappable
in extension shortcuts.

## Repo layout

```
gmixer-chrome-extension/
  extension/                 # Load unpacked here
    manifest.json
    background.js            # generated — action + Alt+M / Alt+N commands
    content-start.js         # generated
    content-end.js           # generated (includes Lit settings UI)
    fonts/
  src/
    background.js
    messaging/messages.js
    content/
      content-start.js
      content-end.js
      settings-host.js       # Popover API left slide-out host
      style-injector.js
      …
    settings/
      tokens.js              # 8px module / 24px baseline grid
      settings-entry.js
      components/            # shell, font-picker, section previews
    popup/components/        # section panels (Lit)
    state/                   # schema + store + storage-adapter
    lib/                     # color-theory, font-faces
    config/                  # fonts + theme-packs
    debug/                   # optional gmixerDebug API (build:debug)
    refs/                    # design notes
  build.js
```

## Architecture notes

- **Debug API**: `npm run build:debug` installs `window.gmixerDebug` for
  CDP / `evaluate_script` (see `refs/GMIXER_DEBUG_MODE.md`). Off by default.
- **Settings UI**: full-height left slide-out `popover` (`#gmixer-settings`)
  with a single-column, one-open-at-a-time guided accordion. Every section has
  an independent rectangular On/Off switch and every open section includes a
  focused preview GUI; the body has a dark pro custom scrollbar. Transparent
  `::backdrop` keeps the page visible for live feedback. Toolbar / Alt+M
  toggle Settings visibility; Alt+N toggles per-site theming.
- **Baseline grid**: CSS variables from `src/settings/tokens.js` (8px /
  24px) — titlebar, panel width, accordion spacing, and type line-heights
  snap to it.
- **Font menus**: `gmixer-font-picker` listbox renders each option in its
  own bundled typeface (native `<select>` cannot).
- **Injection pipeline**: document_start CSS cache → document_end sample +
  MutationObserver + navigation + settings host.
- **State/binding**: panels talk only to `store` (`getState` / `subscribe` /
  `update`); never to `chrome.storage` directly.
- **Generated palette**: one base color plus a color relationship generates
  BG:Primary, BG:Secondary, Surface:GUI, Surface:Containers, Text, Muted,
  Accent, Link, Border, and Focus roles.
  Empty overrides retain generated defaults; explicit overrides are preserved.

## Fonts

55 Peter Wiegel freeware fonts under `extension/fonts/<category>/` — see
`extension/fonts/CREDITS.md`. Categories: script, blackletter, serif,
technical, stencil, matrix, typewriter, display. Each face also has
`usage` / `longForm` heuristics (`src/config/font-heuristics.js`) so body
roles prefer text faces and headers prefer display; pickers offer
“Show all fonts” to bypass. Refresh with `npm run fonts:fetch`;
reclassify with `npm run fonts:reclassify`.

Six typography roles (not three): Hero/H1, Subheadings (h2-h6), Paragraph,
UI chrome (buttons/nav/forms), Code, Captions — see `TARGET_SELECTORS` in
`src/content/style-injector.js` for exactly which elements each hits.

## Scope

No remote CSS/JS marketplace, no KeyPilot-style multi-popover suite — theming
first, with small opt-in navigation (F/D/R).
