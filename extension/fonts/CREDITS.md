# Font credits

## Google Fonts (default theme packs)

Bundled under `extension/fonts/google/` for the Editorial, Atelier, and Studio
theme packs. All are licensed under the **SIL Open Font License 1.1** (OFL).

| Face | Designer / foundry | Pairing role |
|------|--------------------|--------------|
| Playfair Display | Claus Eggers Sørensen | Editorial headers |
| Source Sans 3 | Paul D. Hunt (Adobe) | Editorial body |
| Lora | Cyreal | Editorial captions |
| Cormorant Garamond | Christian Thalmann | Atelier headers / captions |
| Raleway | Matt McInerney et al. | Atelier body |
| Space Grotesk | Florian Karsten | Studio headers |
| DM Sans | Colophon Foundry / Google | Studio body |
| Outfit | Rodrigo Fuenzalida | Studio captions |

Sources: [fonts.google.com](https://fonts.google.com/) · OFL FAQ: https://scripts.sil.org/OFL

Refresh downloads:

```bash
npm run fonts:google
```

## Peter Wiegel (expanded library)

The remaining typefaces in `extension/fonts/` were created by **Peter Wiegel**
and downloaded from [peter-wiegel.de](https://www.peter-wiegel.de/).
The shipped set and UI categories mirror the folders/files under
`extension/fonts/` (regenerated at build time via `npm run fonts:catalog`).

Per the site FAQ (as of 2021+):

- Fonts he personally authored may be used in commercial projects without
  restriction, including redistributing them inside a paid app/extension,
  **as long as the fonts themselves are not sold as a standalone paid
  product**.
- If a font is modified, the derivative must remain freely licensed and
  must be renamed so it is not confused with the original.

gMixer does not modify these fonts. License/readme files that shipped with
each download are kept next to the font file as `*-LICENSE.*` where present.

Source: https://www.peter-wiegel.de/
Contact: wiegel@peter-wiegel.de

To refresh or expand the Wiegel set:

```bash
npm run fonts:fetch
```

To reclassify existing Wiegel files into the current category taxonomy
(DaFont theme tags + Wiegel cues — see `scripts/reclassify-fonts.mjs`):

```bash
npm run fonts:reclassify
```
