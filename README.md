# gMixer

Re-theme any web page — colors, fonts, image filters, corner clipping, and
effects — through one **in-page Settings popover**. Built for Opera GX
(current Chromium engine). See `product description.txt` for the full spec.

## Setup

```bash
npm install
npm run build       # one-off build
npm run watch        # rebuild on change
npm run build:minify # production build
```

Load `extension/` as an unpacked extension (`opera://extensions` or
`chrome://extensions` → Developer mode → Load unpacked).

Open Settings: **toolbar icon** or **Alt+M** (shown in the titlebar; remappable
in extension shortcuts).

## Repo layout

```
gmixer-chrome-extension/
  extension/                 # Load unpacked here
    manifest.json
    background.js            # generated — action + Alt+M command
    content-start.js         # generated
    content-end.js           # generated (includes Lit settings UI)
    fonts/
  src/
    background.js
    messaging/messages.js
    content/
      content-start.js
      content-end.js
      settings-host.js       # Popover API host + backdrop blur
      style-injector.js
      …
    settings/
      tokens.js              # 8px module / 24px baseline grid
      settings-entry.js
      components/            # shell, font-picker, theme-preview
    popup/components/        # section panels (Lit)
    state/                   # schema + store + storage-adapter
    lib/                     # color-theory, font-faces
    config/                  # fonts + theme-packs
  build.js
```

## Architecture notes

- **Settings UI**: large in-page `popover` (`#gmixer-settings`) with left
  tabs, main controls, and a live theme preview. `::backdrop` blurs the
  page. Toolbar / Alt+M only toggle visibility.
- **Baseline grid**: CSS variables from `src/settings/tokens.js` (8px /
  24px) — titlebar, rail, preview widths, and type line-heights snap to it.
- **Font menus**: `gmixer-font-picker` listbox renders each option in its
  own bundled typeface (native `<select>` cannot).
- **Injection pipeline**: document_start CSS cache → document_end sample +
  MutationObserver + navigation + settings host.
- **State/binding**: panels talk only to `store` (`getState` / `subscribe` /
  `update`); never to `chrome.storage` directly.

## Fonts

55 Peter Wiegel freeware fonts under `extension/fonts/` — see
`extension/fonts/CREDITS.md`. Refresh with `npm run fonts:fetch`.

## Scope

No remote CSS/JS marketplace, no KeyPilot-style multi-popover suite — theming
first, with small opt-in navigation (F/D/R).
