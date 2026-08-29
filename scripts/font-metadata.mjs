/**
 * Display labels and preferred category order for the filesystem-driven catalog.
 * Category ids come from folder names under extension/fonts/; labels are nicenames.
 */

/** Preferred UI order for known category folders (unknown folders sort alphabetically after). */
export const CATEGORY_ORDER = [
  'script',
  'blackletter',
  'serif',
  'technical',
  'stencil',
  'matrix',
  'typewriter',
  'display',
];

/** @type {Record<string, string>} */
export const CATEGORY_LABELS = {
  script: 'Calligraphy / Script',
  blackletter: 'Blackletter / Fraktur',
  serif: 'Serif',
  technical: 'Sans / Technical',
  stencil: 'Stencil / Industrial',
  matrix: 'Pixel / LED / Matrix',
  typewriter: 'Typewriter',
  display: 'Display / Decorative',
  system: 'System (built-in, no download)',
};

/**
 * Per-font display labels when the filename stem is not enough
 * (e.g. fundamental → Fundamental Brigade).
 * @type {Record<string, string>}
 */
export const FONT_LABELS = {
  engelsgold: 'Engelsgold',
  'euro-script': 'Euro Script',
  flottflott: 'Flottflott',
  halt: 'Halt',
  ottilie: 'Ottilie',
  praegefest: 'Praegefest',
  rundkursiv: 'Rundkursiv',
  schulkursiv: 'Schulkursiv',
  'ehmcke-feder': 'Ehmcke Feder',
  rosamunde: 'Rosamunde',
  'standard-graf': 'Standard Graf',
  doergon: 'Doergon',
  'indira-k': 'Indira K',
  'alte-din-1451': 'Alte DIN 1451',
  autobahn: 'Autobahn',
  'berliner-wand': 'Berliner Wand',
  'din-1451-h': 'DIN 1451-H',
  'din-breit': 'DIN Breitschrift',
  'espresso-dolce': 'Espresso Dolce',
  fundamental: 'Fundamental Brigade',
  'gst-aero': 'GST Aero',
  kanalisirung: 'Kanalisirung',
  'kk-bahn': 'KK Bahn',
  'mmx-2010': 'MMX 2010',
  'stefans-uhr': 'Stefans Uhr',
  'tgl-0-1451': 'TGL 0-1451 Engschrift',
  fabrik: 'Fabrik',
  powerweld: 'Powerweld',
  'sowjet-schablone': 'Sowjet Schablone',
  '10x12-lampen': '10x12 Lampen',
  '24led': '24 LED',
  '5by7': '5by7',
  '5x6-lampen': '5x6 Lampen',
  'cat-north': 'CAT North',
  'cat-stack': 'CAT Stack',
  maass: 'Maass Slicer',
  'ring-matrix': 'Ring Matrix',
  tippa: 'Tippa',
  engravers: 'Engravers',
};

/** Folder that stores Google OFL files; UI category comes from catalog.json, not this name. */
export const GOOGLE_DIR = 'google';

/**
 * @param {string} id
 * @returns {string}
 */
export function humanizeId(id) {
  return id
    .split('-')
    .map((part) => {
      if (/^\d/.test(part)) return part;
      if (part === part.toUpperCase()) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

/**
 * @param {string} categoryId
 * @returns {string}
 */
export function categoryLabel(categoryId) {
  return CATEGORY_LABELS[categoryId] ?? humanizeId(categoryId);
}

/**
 * @param {string} id
 * @returns {string}
 */
export function fontLabel(id) {
  return FONT_LABELS[id] ?? humanizeId(id);
}
