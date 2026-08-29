// GENERATED — do not edit by hand.
// Bundled font catalog. Regenerated from extension/fonts/ by:
//   node scripts/generate-fonts-catalog.mjs
// (also run automatically by build.js)
//
// Categories = immediate subdirs of extension/fonts/ that contain font files
// (google/ is a source bucket; its UI categories come from google/catalog.json).
// usage / longForm / pairGroup come from font-heuristics.js (role policy).
// Re-fetch Wiegel: node scripts/fetch-wiegel-fonts.mjs
// Re-fetch Google: node scripts/fetch-google-fonts.mjs

import {
  enrichFontEntry,
  isFontSuitableForTarget,
} from './font-heuristics.js';

export const FONT_CATEGORIES = [
  { id: "script", label: "Calligraphy / Script" },
  { id: "blackletter", label: "Blackletter / Fraktur" },
  { id: "serif", label: "Serif" },
  { id: "technical", label: "Sans / Technical" },
  { id: "stencil", label: "Stencil / Industrial" },
  { id: "matrix", label: "Pixel / LED / Matrix" },
  { id: "typewriter", label: "Typewriter" },
  { id: "display", label: "Display / Decorative" },
  { id: "system", label: "System (built-in, no download)" },
];

/**
 * @typedef {object} FontEntry
 * @property {string} id
 * @property {string} label
 * @property {string} category  one of FONT_CATEGORIES[].id
 * @property {string} family    CSS font-family value once loaded
 * @property {string|null} file relative path under extension/fonts/, null for system fonts
 * @property {string} [weightRange] CSS font-weight range for variable fonts (e.g. "400 700")
 * @property {'display'|'text'|'both'} usage
 * @property {boolean} longForm
 * @property {boolean} textSafe
 * @property {string} [pairGroup]
 */

/** @type {Omit<FontEntry, 'usage'|'longForm'|'textSafe'|'pairGroup'>[]} */
const FONTS_RAW = [
  // System fallbacks — always available.
  { id: "system-display", label: "System Display", category: "system", family: "system-ui, sans-serif", file: null },
  { id: "system-body", label: "System Body", category: "system", family: "system-ui, sans-serif", file: null },
  { id: "system-mono", label: "System Mono", category: "system", family: "ui-monospace, monospace", file: null },

  // Google Fonts — files under fonts/google/; UI category from catalog.json.
  // Refresh with: node scripts/fetch-google-fonts.mjs
  { id: "cormorant-garamond", label: "Cormorant Garamond", category: "serif", family: "\"Cormorant Garamond\"", file: "google/cormorant-garamond.woff2", weightRange: "600" },
  { id: "lora", label: "Lora", category: "serif", family: "\"Lora\"", file: "google/lora.woff2", weightRange: "400 600" },
  { id: "playfair-display", label: "Playfair Display", category: "serif", family: "\"Playfair Display\"", file: "google/playfair-display.woff2", weightRange: "400 700" },
  { id: "dm-sans", label: "DM Sans", category: "technical", family: "\"DM Sans\"", file: "google/dm-sans.woff2", weightRange: "400 700" },
  { id: "outfit", label: "Outfit", category: "technical", family: "\"Outfit\"", file: "google/outfit.woff2", weightRange: "400 600" },
  { id: "raleway", label: "Raleway", category: "technical", family: "\"Raleway\"", file: "google/raleway.woff2", weightRange: "400 600" },
  { id: "source-sans-3", label: "Source Sans 3", category: "technical", family: "\"Source Sans 3\"", file: "google/source-sans-3.woff2", weightRange: "400 700" },
  { id: "space-grotesk", label: "Space Grotesk", category: "technical", family: "\"Space Grotesk\"", file: "google/space-grotesk.woff2", weightRange: "400 700" },

  // Bundled faces from extension/fonts/<category>/ (39 files)
  { id: "engelsgold", label: "Engelsgold", category: "script", family: "\"Engelsgold\"", file: "script/engelsgold.ttf" },
  { id: "euro-script", label: "Euro Script", category: "script", family: "\"Euro Script\"", file: "script/euro-script.ttf" },
  { id: "flottflott", label: "Flottflott", category: "script", family: "\"Flottflott\"", file: "script/flottflott.ttf" },
  { id: "halt", label: "Halt", category: "script", family: "\"Halt\"", file: "script/halt.ttf" },
  { id: "ottilie", label: "Ottilie", category: "script", family: "\"Ottilie\"", file: "script/ottilie.ttf" },
  { id: "praegefest", label: "Praegefest", category: "script", family: "\"Praegefest\"", file: "script/praegefest.ttf" },
  { id: "rundkursiv", label: "Rundkursiv", category: "script", family: "\"Rundkursiv\"", file: "script/rundkursiv.ttf" },
  { id: "schulkursiv", label: "Schulkursiv", category: "script", family: "\"Schulkursiv\"", file: "script/schulkursiv.ttf" },
  { id: "ehmcke-feder", label: "Ehmcke Feder", category: "blackletter", family: "\"Ehmcke Feder\"", file: "blackletter/ehmcke-feder.ttf" },
  { id: "rosamunde", label: "Rosamunde", category: "blackletter", family: "\"Rosamunde\"", file: "blackletter/rosamunde.ttf" },
  { id: "standard-graf", label: "Standard Graf", category: "blackletter", family: "\"Standard Graf\"", file: "blackletter/standard-graf.ttf" },
  { id: "doergon", label: "Doergon", category: "serif", family: "\"Doergon\"", file: "serif/doergon.ttf" },
  { id: "indira-k", label: "Indira K", category: "serif", family: "\"Indira K\"", file: "serif/indira-k.ttf" },
  { id: "alte-din-1451", label: "Alte DIN 1451", category: "technical", family: "\"Alte DIN 1451\"", file: "technical/alte-din-1451.ttf" },
  { id: "autobahn", label: "Autobahn", category: "technical", family: "\"Autobahn\"", file: "technical/autobahn.ttf" },
  { id: "berliner-wand", label: "Berliner Wand", category: "technical", family: "\"Berliner Wand\"", file: "technical/berliner-wand.ttf" },
  { id: "din-1451-h", label: "DIN 1451-H", category: "technical", family: "\"DIN 1451-H\"", file: "technical/din-1451-h.ttf" },
  { id: "din-breit", label: "DIN Breitschrift", category: "technical", family: "\"DIN Breitschrift\"", file: "technical/din-breit.ttf" },
  { id: "espresso-dolce", label: "Espresso Dolce", category: "technical", family: "\"Espresso Dolce\"", file: "technical/espresso-dolce.ttf" },
  { id: "fundamental", label: "Fundamental Brigade", category: "technical", family: "\"Fundamental Brigade\"", file: "technical/fundamental.ttf" },
  { id: "gst-aero", label: "GST Aero", category: "technical", family: "\"GST Aero\"", file: "technical/gst-aero.ttf" },
  { id: "kanalisirung", label: "Kanalisirung", category: "technical", family: "\"Kanalisirung\"", file: "technical/kanalisirung.otf" },
  { id: "kk-bahn", label: "KK Bahn", category: "technical", family: "\"KK Bahn\"", file: "technical/kk-bahn.ttf" },
  { id: "mmx-2010", label: "MMX 2010", category: "technical", family: "\"MMX 2010\"", file: "technical/mmx-2010.ttf" },
  { id: "stefans-uhr", label: "Stefans Uhr", category: "technical", family: "\"Stefans Uhr\"", file: "technical/stefans-uhr.ttf" },
  { id: "tgl-0-1451", label: "TGL 0-1451 Engschrift", category: "technical", family: "\"TGL 0-1451 Engschrift\"", file: "technical/tgl-0-1451.ttf" },
  { id: "fabrik", label: "Fabrik", category: "stencil", family: "\"Fabrik\"", file: "stencil/fabrik.ttf" },
  { id: "powerweld", label: "Powerweld", category: "stencil", family: "\"Powerweld\"", file: "stencil/powerweld.ttf" },
  { id: "sowjet-schablone", label: "Sowjet Schablone", category: "stencil", family: "\"Sowjet Schablone\"", file: "stencil/sowjet-schablone.ttf" },
  { id: "10x12-lampen", label: "10x12 Lampen", category: "matrix", family: "\"10x12 Lampen\"", file: "matrix/10x12-lampen.ttf" },
  { id: "24led", label: "24 LED", category: "matrix", family: "\"24 LED\"", file: "matrix/24led.ttf" },
  { id: "5by7", label: "5by7", category: "matrix", family: "\"5by7\"", file: "matrix/5by7.ttf" },
  { id: "5x6-lampen", label: "5x6 Lampen", category: "matrix", family: "\"5x6 Lampen\"", file: "matrix/5x6-lampen.ttf" },
  { id: "cat-north", label: "CAT North", category: "matrix", family: "\"CAT North\"", file: "matrix/cat-north.ttf" },
  { id: "cat-stack", label: "CAT Stack", category: "matrix", family: "\"CAT Stack\"", file: "matrix/cat-stack.ttf" },
  { id: "maass", label: "Maass Slicer", category: "matrix", family: "\"Maass Slicer\"", file: "matrix/maass.ttf" },
  { id: "ring-matrix", label: "Ring Matrix", category: "matrix", family: "\"Ring Matrix\"", file: "matrix/ring-matrix.ttf" },
  { id: "tippa", label: "Tippa", category: "typewriter", family: "\"Tippa\"", file: "typewriter/tippa.ttf" },
  { id: "engravers", label: "Engravers", category: "display", family: "\"Engravers\"", file: "display/engravers.ttf" },
];

/** @type {FontEntry[]} */
export const FONTS = FONTS_RAW.map(enrichFontEntry);

export function getFontById(id) {
  return FONTS.find((font) => font.id === id) ?? null;
}

/** Fonts that need an @font-face rule (have a bundled file). */
export function getBundledFonts() {
  return FONTS.filter((font) => !!font.file);
}

/**
 * Fonts allowed for a typography target under the role policy.
 * @param {'headers'|'subheadings'|'paragraph'|'ui'|'code'|'captions'} target
 * @param {{ showAll?: boolean }} [opts]
 */
export function getFontsForTarget(target, opts = {}) {
  return FONTS.filter((font) => isFontSuitableForTarget(font, target, opts));
}
