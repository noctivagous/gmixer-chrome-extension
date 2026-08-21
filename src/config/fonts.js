// Bundled font catalog. Font files live in extension/fonts/<category>/
// and were sourced from https://www.peter-wiegel.de/ (freeware; unrestricted
// commercial use for fonts Peter Wiegel authored — per that site's FAQ).
// License notes: do not sell the fonts themselves as a standalone paid
// product; if you modify a font, rename it and keep it freely licensed.
// Attribution: Settings > About / extension/fonts/CREDITS.md
//
// Re-fetch / refresh with: node scripts/fetch-wiegel-fonts.mjs

export const FONT_CATEGORIES = [
  { id: 'calligraphy', label: 'Calligraphy / Script' },
  { id: 'technical', label: 'Technical / Engineering' },
  { id: 'matrix', label: 'Matrix / Display' },
  { id: 'system', label: 'System (built-in, no download)' },
];

/**
 * @typedef {object} FontEntry
 * @property {string} id
 * @property {string} label
 * @property {string} category  one of FONT_CATEGORIES[].id
 * @property {string} family    CSS font-family value once loaded
 * @property {string|null} file relative path under extension/fonts/, null for system fonts
 */

/** @type {FontEntry[]} */
export const FONTS = [
  // System fallbacks — always available.
  { id: 'system-display', label: 'System Display', category: 'system', family: 'system-ui, sans-serif', file: null },
  { id: 'system-body', label: 'System Body', category: 'system', family: 'system-ui, sans-serif', file: null },
  { id: 'system-mono', label: 'System Mono', category: 'system', family: 'ui-monospace, monospace', file: null },

  // Peter Wiegel freeware batch (55 fonts)
  { id: "astrud", label: "Astrud", category: "calligraphy", family: "\"Astrud\"", file: "calligraphy/astrud.ttf" },
  { id: "cat-reporter", label: "CAT Reporter", category: "calligraphy", family: "\"CAT Reporter\"", file: "calligraphy/cat-reporter.ttf" },
  { id: "discipuli-britannica", label: "Discipuli Britannica", category: "calligraphy", family: "\"Discipuli Britannica\"", file: "calligraphy/discipuli-britannica.ttf" },
  { id: "ehmcke-feder", label: "Ehmcke Feder", category: "calligraphy", family: "\"Ehmcke Feder\"", file: "calligraphy/ehmcke-feder.ttf" },
  { id: "engelsgold", label: "Engelsgold", category: "calligraphy", family: "\"Engelsgold\"", file: "calligraphy/engelsgold.ttf" },
  { id: "espresso-dolce", label: "Espresso Dolce", category: "calligraphy", family: "\"Espresso Dolce\"", file: "calligraphy/espresso-dolce.ttf" },
  { id: "euro-script", label: "Euro Script", category: "calligraphy", family: "\"Euro Script\"", file: "calligraphy/euro-script.ttf" },
  { id: "flottflott", label: "Flottflott", category: "calligraphy", family: "\"Flottflott\"", file: "calligraphy/flottflott.ttf" },
  { id: "gloria", label: "Gloria", category: "calligraphy", family: "\"Gloria\"", file: "calligraphy/gloria.ttf" },
  { id: "goldmarie", label: "Goldmarie", category: "calligraphy", family: "\"Goldmarie\"", file: "calligraphy/goldmarie.ttf" },
  { id: "indira-k", label: "Indira K", category: "calligraphy", family: "\"Indira K\"", file: "calligraphy/indira-k.ttf" },
  { id: "nigra-script", label: "Nigra Script", category: "calligraphy", family: "\"Nigra Script\"", file: "calligraphy/nigra-script.ttf" },
  { id: "ottilie", label: "Ottilie", category: "calligraphy", family: "\"Ottilie\"", file: "calligraphy/ottilie.ttf" },
  { id: "rosamunde", label: "Rosamunde", category: "calligraphy", family: "\"Rosamunde\"", file: "calligraphy/rosamunde.ttf" },
  { id: "rundkursiv", label: "Rundkursiv", category: "calligraphy", family: "\"Rundkursiv\"", file: "calligraphy/rundkursiv.ttf" },
  { id: "schulkursiv", label: "Schulkursiv", category: "calligraphy", family: "\"Schulkursiv\"", file: "calligraphy/schulkursiv.ttf" },
  { id: "wolgast-script", label: "Wolgast Script", category: "calligraphy", family: "\"Wolgast Script\"", file: "calligraphy/wolgast-script.ttf" },
  { id: "youbilee", label: "Youbilee", category: "calligraphy", family: "\"Youbilee\"", file: "calligraphy/youbilee.ttf" },
  { id: "10x12-lampen", label: "10x12 Lampen", category: "matrix", family: "\"10x12 Lampen\"", file: "matrix/10x12-lampen.ttf" },
  { id: "24led", label: "24 LED", category: "matrix", family: "\"24 LED\"", file: "matrix/24led.ttf" },
  { id: "5by7", label: "5by7", category: "matrix", family: "\"5by7\"", file: "matrix/5by7.ttf" },
  { id: "5x6-lampen", label: "5x6 Lampen", category: "matrix", family: "\"5x6 Lampen\"", file: "matrix/5x6-lampen.ttf" },
  { id: "alpha-54", label: "Alpha 54", category: "matrix", family: "\"Alpha 54\"", file: "matrix/alpha-54.ttf" },
  { id: "baudot-murray", label: "Baudot Murray", category: "matrix", family: "\"Baudot Murray\"", file: "matrix/baudot-murray.ttf" },
  { id: "cat-north", label: "CAT North", category: "matrix", family: "\"CAT North\"", file: "matrix/cat-north.ttf" },
  { id: "cat-stack", label: "CAT Stack", category: "matrix", family: "\"CAT Stack\"", file: "matrix/cat-stack.ttf" },
  { id: "doergon", label: "Doergon", category: "matrix", family: "\"Doergon\"", file: "matrix/doergon.ttf" },
  { id: "googee", label: "Googee", category: "matrix", family: "\"Googee\"", file: "matrix/googee.ttf" },
  { id: "hardman", label: "Hardman", category: "matrix", family: "\"Hardman\"", file: "matrix/hardman.ttf" },
  { id: "maass", label: "Maass Slicer", category: "matrix", family: "\"Maass Slicer\"", file: "matrix/maass.ttf" },
  { id: "mmx-2010", label: "MMX 2010", category: "matrix", family: "\"MMX 2010\"", file: "matrix/mmx-2010.ttf" },
  { id: "ring-matrix", label: "Ring Matrix", category: "matrix", family: "\"Ring Matrix\"", file: "matrix/ring-matrix.ttf" },
  { id: "stefans-uhr", label: "Stefans Uhr", category: "matrix", family: "\"Stefans Uhr\"", file: "matrix/stefans-uhr.ttf" },
  { id: "tippa", label: "Tippa", category: "matrix", family: "\"Tippa\"", file: "matrix/tippa.ttf" },
  { id: "alte-din-1451", label: "Alte DIN 1451", category: "technical", family: "\"Alte DIN 1451\"", file: "technical/alte-din-1451.ttf" },
  { id: "autobahn", label: "Autobahn", category: "technical", family: "\"Autobahn\"", file: "technical/autobahn.ttf" },
  { id: "berliner-wand", label: "Berliner Wand", category: "technical", family: "\"Berliner Wand\"", file: "technical/berliner-wand.ttf" },
  { id: "border-control", label: "Border Control", category: "technical", family: "\"Border Control\"", file: "technical/border-control.ttf" },
  { id: "din-1451-h", label: "DIN 1451-H", category: "technical", family: "\"DIN 1451-H\"", file: "technical/din-1451-h.ttf" },
  { id: "din-breit", label: "DIN Breitschrift", category: "technical", family: "\"DIN Breitschrift\"", file: "technical/din-breit.ttf" },
  { id: "elb-tunnel", label: "Elb Tunnel", category: "technical", family: "\"Elb Tunnel\"", file: "technical/elb-tunnel.ttf" },
  { id: "engravers", label: "Engravers", category: "technical", family: "\"Engravers\"", file: "technical/engravers.ttf" },
  { id: "eyechart", label: "Eyechart", category: "technical", family: "\"Eyechart\"", file: "technical/eyechart.ttf" },
  { id: "fabrik", label: "Fabrik", category: "technical", family: "\"Fabrik\"", file: "technical/fabrik.ttf" },
  { id: "fundamental", label: "Fundamental Brigade", category: "technical", family: "\"Fundamental Brigade\"", file: "technical/fundamental.ttf" },
  { id: "gst-aero", label: "GST Aero", category: "technical", family: "\"GST Aero\"", file: "technical/gst-aero.ttf" },
  { id: "halt", label: "Halt", category: "technical", family: "\"Halt\"", file: "technical/halt.ttf" },
  { id: "kanalisirung", label: "Kanalisirung", category: "technical", family: "\"Kanalisirung\"", file: "technical/kanalisirung.otf" },
  { id: "kk-bahn", label: "KK Bahn", category: "technical", family: "\"KK Bahn\"", file: "technical/kk-bahn.ttf" },
  { id: "powerweld", label: "Powerweld", category: "technical", family: "\"Powerweld\"", file: "technical/powerweld.ttf" },
  { id: "praegefest", label: "Praegefest", category: "technical", family: "\"Praegefest\"", file: "technical/praegefest.ttf" },
  { id: "schraubenkiste", label: "Schraubenkiste", category: "technical", family: "\"Schraubenkiste\"", file: "technical/schraubenkiste.ttf" },
  { id: "sowjet-schablone", label: "Sowjet Schablone", category: "technical", family: "\"Sowjet Schablone\"", file: "technical/sowjet-schablone.ttf" },
  { id: "standard-graf", label: "Standard Graf", category: "technical", family: "\"Standard Graf\"", file: "technical/standard-graf.ttf" },
  { id: "tgl-0-1451", label: "TGL 0-1451 Engschrift", category: "technical", family: "\"TGL 0-1451 Engschrift\"", file: "technical/tgl-0-1451.ttf" },
];

export function getFontsByCategory(categoryId) {
  return FONTS.filter((font) => font.category === categoryId);
}

export function getFontById(id) {
  return FONTS.find((font) => font.id === id) ?? null;
}

/** Fonts that need an @font-face rule (have a bundled file). */
export function getBundledFonts() {
  return FONTS.filter((font) => !!font.file);
}
