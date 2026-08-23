#!/usr/bin/env node
/**
 * Reclassify bundled Peter Wiegel fonts into a finer category taxonomy,
 * move files under extension/fonts/<category>/, and regenerate
 * src/config/fonts.js (plus update the fetch script's category fields).
 *
 * Evidence: DaFont theme paths (scraped) + name/Wiegel cues for misses.
 * Run: node scripts/reclassify-fonts.mjs
 */
import {
  mkdirSync,
  renameSync,
  existsSync,
  readdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'extension', 'fonts');

/** @typedef {'script'|'blackletter'|'serif'|'technical'|'stencil'|'matrix'|'typewriter'|'display'|'system'} CatId */

export const FONT_CATEGORIES = [
  { id: 'script', label: 'Calligraphy / Script' },
  { id: 'blackletter', label: 'Blackletter / Fraktur' },
  { id: 'serif', label: 'Serif' },
  { id: 'technical', label: 'Sans / Technical' },
  { id: 'stencil', label: 'Stencil / Industrial' },
  { id: 'matrix', label: 'Pixel / LED / Matrix' },
  { id: 'typewriter', label: 'Typewriter' },
  { id: 'display', label: 'Display / Decorative' },
  { id: 'system', label: 'System (built-in, no download)' },
];

/**
 * Final remapping. `note` is provenance for humans, not shipped.
 * @type {{ id: string, label: string, zip: string, category: CatId, note: string }[]}
 */
const FONTS = [
  // --- Calligraphy / Script ---
  { id: 'euro-script', label: 'Euro Script', zip: 'EuroScript.zip', category: 'script', note: 'name; connected script' },
  { id: 'goldmarie', label: 'Goldmarie', zip: 'Goldmarie.zip', category: 'script', note: 'name; school/script face' },
  { id: 'discipuli-britannica', label: 'Discipuli Britannica', zip: 'DiscipuliBritannicaTT.zip', category: 'script', note: 'DaFont Script > Calligraphy' },
  { id: 'cat-reporter', label: 'CAT Reporter', zip: 'CATReporter.zip', category: 'script', note: 'DaFont Script > Brush' },
  { id: 'flottflott', label: 'Flottflott', zip: 'Flottflott.zip', category: 'script', note: 'DaFont Script > Various' },
  { id: 'nigra-script', label: 'Nigra Script', zip: 'NigraScript.zip', category: 'script', note: 'name; script' },
  { id: 'schulkursiv', label: 'Schulkursiv', zip: 'Schulkursiv.zip', category: 'script', note: 'name; school cursive' },
  { id: 'rundkursiv', label: 'Rundkursiv', zip: 'Rundkursiv.zip', category: 'script', note: 'DaFont Script > Various' },
  { id: 'wolgast-script', label: 'Wolgast Script', zip: 'WolgastScriptTT.zip', category: 'script', note: 'DaFont Script > Calligraphy' },
  { id: 'ottilie', label: 'Ottilie', zip: 'Ottilie.zip', category: 'script', note: 'DaFont Script > Various' },
  { id: 'engelsgold', label: 'Engelsgold', zip: 'Engelsgold.zip', category: 'script', note: 'name; decorative script' },
  { id: 'halt', label: 'Halt', zip: 'Halt.zip', category: 'script', note: 'DaFont Script > Brush (was technical)' },
  { id: 'praegefest', label: 'Praegefest', zip: 'Praegefest.zip', category: 'script', note: 'DaFont Script > Various (was technical)' },
  { id: 'alpha-54', label: 'Alpha 54', zip: 'Alpha54.zip', category: 'script', note: 'DaFont Script > Brush (was matrix)' },

  // --- Blackletter / Fraktur ---
  { id: 'ehmcke-feder', label: 'Ehmcke Feder', zip: 'EhmckeFederfraktur.zip', category: 'blackletter', note: 'DaFont Gothic > Medieval; Federfraktur' },
  { id: 'rosamunde', label: 'Rosamunde', zip: 'Rosamunde.zip', category: 'blackletter', note: 'DaFont Gothic > Medieval' },
  { id: 'standard-graf', label: 'Standard Graf', zip: 'StandardGraf.zip', category: 'blackletter', note: 'DaFont Gothic > Various' },

  // --- Serif ---
  { id: 'doergon', label: 'Doergon', zip: 'Doergon.zip', category: 'serif', note: 'DaFont Basic > Serif (was matrix)' },
  { id: 'indira-k', label: 'Indira K', zip: 'Indira_K.zip', category: 'serif', note: 'DaFont Basic > Serif (was calligraphy)' },

  // --- Sans / Technical ---
  { id: 'din-1451-h', label: 'DIN 1451-H', zip: 'DIN1451_4H_08.87.zip', category: 'technical', note: 'DaFont Basic > Sans serif' },
  { id: 'alte-din-1451', label: 'Alte DIN 1451', zip: 'Din1451altTT.zip', category: 'technical', note: 'DIN family' },
  { id: 'din-breit', label: 'DIN Breitschrift', zip: 'DIN1451breit.zip', category: 'technical', note: 'DIN family' },
  { id: 'tgl-0-1451', label: 'TGL 0-1451 Engschrift', zip: 'TGL_0-1451Eng.zip', category: 'technical', note: 'DaFont Basic > Sans serif' },
  { id: 'kanalisirung', label: 'Kanalisirung', zip: 'Kanalisirung.zip', category: 'technical', note: 'DaFont Basic > Sans serif' },
  { id: 'fundamental', label: 'Fundamental Brigade', zip: 'FundamentalBrigade.zip', category: 'technical', note: 'DaFont Basic > Sans serif' },
  { id: 'berliner-wand', label: 'Berliner Wand', zip: 'Berliner_Wand.zip', category: 'technical', note: 'DaFont Basic > Sans serif' },
  { id: 'autobahn', label: 'Autobahn', zip: 'Autobahn.zip', category: 'technical', note: 'highway / DIN-adjacent; DaFont Techno/Gothic' },
  { id: 'espresso-dolce', label: 'Espresso Dolce', zip: 'EspressoDolce.zip', category: 'technical', note: 'DaFont Basic > Sans serif (was calligraphy)' },
  { id: 'stefans-uhr', label: 'Stefans Uhr', zip: 'StefansUhr.zip', category: 'technical', note: 'DaFont Basic > Sans serif (was matrix)' },
  { id: 'mmx-2010', label: 'MMX 2010', zip: 'MMX2010.zip', category: 'technical', note: 'DaFont Basic > Sans serif (was matrix)' },
  { id: 'eyechart', label: 'Eyechart', zip: 'Eyechart.zip', category: 'technical', note: 'DaFont Basic > Various' },
  { id: 'googee', label: 'Googee', zip: 'googee.zip', category: 'technical', note: 'DaFont Basic > Various (was matrix)' },
  { id: 'elb-tunnel', label: 'Elb Tunnel', zip: 'ElbtunnelTT.zip', category: 'technical', note: 'DaFont Techno > Various' },
  { id: 'gst-aero', label: 'GST Aero', zip: 'GST_Aero.zip', category: 'technical', note: 'aviation / technical marking' },
  { id: 'kk-bahn', label: 'KK Bahn', zip: 'KKBahn.zip', category: 'technical', note: 'railway marking face' },

  // --- Stencil / Industrial ---
  { id: 'sowjet-schablone', label: 'Sowjet Schablone', zip: 'Sowjetschablone.zip', category: 'stencil', note: 'Schablone = stencil' },
  { id: 'powerweld', label: 'Powerweld', zip: 'PowerweldTT.zip', category: 'stencil', note: 'DaFont Fancy > Various; industrial' },
  { id: 'border-control', label: 'Border Control', zip: 'BorderControl.zip', category: 'stencil', note: 'DaFont Fancy > Various; stencil-like' },
  { id: 'fabrik', label: 'Fabrik', zip: 'fabrik.zip', category: 'stencil', note: 'DaFont Fancy > Various; industrial' },
  { id: 'schraubenkiste', label: 'Schraubenkiste', zip: 'Schraubenkiste.zip', category: 'stencil', note: 'industrial / hardware marking' },

  // --- Pixel / LED / Matrix ---
  { id: 'ring-matrix', label: 'Ring Matrix', zip: 'RingMatrix.zip', category: 'matrix', note: 'DaFont Techno > LCD' },
  { id: '5by7', label: '5by7', zip: '5by7.zip', category: 'matrix', note: 'DaFont Techno > LCD' },
  { id: '24led', label: '24 LED', zip: '24LED.zip', category: 'matrix', note: 'LED matrix by name' },
  { id: '10x12-lampen', label: '10x12 Lampen', zip: '10mal12Lampen.zip', category: 'matrix', note: 'lamp/LED matrix by name' },
  { id: '5x6-lampen', label: '5x6 Lampen', zip: '5mal6Lampen.zip', category: 'matrix', note: 'lamp/LED matrix by name' },
  { id: 'baudot-murray', label: 'Baudot Murray', zip: 'Baudot_Murray.zip', category: 'matrix', note: 'DaFont Techno > LCD' },
  { id: 'cat-north', label: 'CAT North', zip: 'CATNorth.zip', category: 'matrix', note: 'DaFont Techno > Various' },
  { id: 'cat-stack', label: 'CAT Stack', zip: 'cat_stack.zip', category: 'matrix', note: 'stacked/pixel display by name' },
  { id: 'maass', label: 'Maass Slicer', zip: 'MaassTT.zip', category: 'matrix', note: 'DaFont Techno > Various' },

  // --- Typewriter ---
  { id: 'tippa', label: 'Tippa', zip: 'Tippa.zip', category: 'typewriter', note: 'DaFont Fancy > Typewriter; Wiegel Adler Tippa' },

  // --- Display / Decorative ---
  { id: 'hardman', label: 'Hardman', zip: 'Hardman.zip', category: 'display', note: 'DaFont Fancy > Retro (was matrix)' },
  { id: 'gloria', label: 'Gloria', zip: 'Gloria.zip', category: 'display', note: 'DaFont Fancy > Retro (was calligraphy)' },
  { id: 'astrud', label: 'Astrud', zip: 'Astrud.zip', category: 'display', note: 'DaFont Fancy > Retro (was calligraphy)' },
  { id: 'youbilee', label: 'Youbilee', zip: 'Youbilee.zip', category: 'display', note: 'DaFont Dingbats; anniversary ornaments' },
  { id: 'engravers', label: 'Engravers', zip: 'Engravers.zip', category: 'display', note: 'copperplate / engraved display' },
];

const OLD_CATS = ['calligraphy', 'technical', 'matrix'];
const NEW_CATS = FONT_CATEGORIES.filter((c) => c.id !== 'system').map((c) => c.id);

function findExistingFile(id) {
  for (const cat of [...NEW_CATS, ...OLD_CATS]) {
    for (const ext of ['.ttf', '.otf', '.woff', '.woff2']) {
      const p = join(OUT, cat, `${id}${ext}`);
      if (existsSync(p)) return { path: p, ext, cat };
    }
  }
  return null;
}

function findExistingLicense(id, fromCat) {
  if (!existsSync(join(OUT, fromCat))) return null;
  const names = readdirSync(join(OUT, fromCat));
  return names.filter((n) => n.startsWith(`${id}-LICENSE`)).map((n) => join(OUT, fromCat, n));
}

function writeFontsJs(catalog) {
  const fonts = [...catalog].sort((a, b) => {
    const ai = NEW_CATS.indexOf(a.category);
    const bi = NEW_CATS.indexOf(b.category);
    if (ai !== bi) return ai - bi;
    return a.label.localeCompare(b.label);
  });
  const entries = fonts
    .map(
      (f) =>
        `  { id: ${JSON.stringify(f.id)}, label: ${JSON.stringify(f.label)}, category: ${JSON.stringify(f.category)}, family: ${JSON.stringify(`"${f.label}"`)}, file: ${JSON.stringify(f.file)} },`
    )
    .join('\n');

  const catEntries = FONT_CATEGORIES.map(
    (c) => `  { id: ${JSON.stringify(c.id)}, label: ${JSON.stringify(c.label)} },`
  ).join('\n');

  const src = `// Bundled font catalog. Font files live in extension/fonts/<category>/
// and were sourced from https://www.peter-wiegel.de/ (freeware; unrestricted
// commercial use for fonts Peter Wiegel authored — per that site's FAQ).
// License notes: do not sell the fonts themselves as a standalone paid
// product; if you modify a font, rename it and keep it freely licensed.
// Attribution: Settings > About / extension/fonts/CREDITS.md
//
// Categories refined from DaFont theme paths + Peter Wiegel page cues.
// usage / longForm / pairGroup come from font-heuristics.js (role policy).
// Re-fetch / refresh with: node scripts/fetch-wiegel-fonts.mjs
// Reclassify in place with: node scripts/reclassify-fonts.mjs

import {
  enrichFontEntry,
  isFontSuitableForTarget,
} from './font-heuristics.js';

export const FONT_CATEGORIES = [
${catEntries}
];

/**
 * @typedef {object} FontEntry
 * @property {string} id
 * @property {string} label
 * @property {string} category  one of FONT_CATEGORIES[].id
 * @property {string} family    CSS font-family value once loaded
 * @property {string|null} file relative path under extension/fonts/, null for system fonts
 * @property {'display'|'text'|'both'} usage
 * @property {boolean} longForm
 * @property {boolean} textSafe
 * @property {string} [pairGroup]
 */

/** @type {Omit<FontEntry, 'usage'|'longForm'|'textSafe'|'pairGroup'>[]} */
const FONTS_RAW = [
  // System fallbacks — always available.
  { id: 'system-display', label: 'System Display', category: 'system', family: 'system-ui, sans-serif', file: null },
  { id: 'system-body', label: 'System Body', category: 'system', family: 'system-ui, sans-serif', file: null },
  { id: 'system-mono', label: 'System Mono', category: 'system', family: 'ui-monospace, monospace', file: null },

  // Peter Wiegel freeware batch (${fonts.length} fonts)
${entries}
];

/** @type {FontEntry[]} */
export const FONTS = FONTS_RAW.map(enrichFontEntry);

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

/**
 * Fonts allowed for a typography target under the role policy.
 * @param {'headers'|'paragraph'|'captions'} target
 * @param {{ showAll?: boolean }} [opts]
 */
export function getFontsForTarget(target, opts = {}) {
  return FONTS.filter((font) => isFontSuitableForTarget(font, target, opts));
}
`;
  writeFileSync(join(ROOT, 'src', 'config', 'fonts.js'), src);
}

function main() {
  for (const cat of NEW_CATS) {
    mkdirSync(join(OUT, cat), { recursive: true });
  }

  const catalog = [];
  const moved = [];
  const missing = [];

  for (const font of FONTS) {
    const found = findExistingFile(font.id);
    if (!found) {
      missing.push(font.id);
      console.warn(`MISSING file for ${font.id}`);
      continue;
    }

    const destDir = join(OUT, font.category);
    const destFile = join(destDir, `${font.id}${found.ext}`);
    mkdirSync(destDir, { recursive: true });

    if (found.path !== destFile) {
      if (existsSync(destFile)) rmSync(destFile);
      renameSync(found.path, destFile);
      moved.push(`${found.cat}/${font.id} → ${font.category}/${font.id}`);
    }

    for (const lic of findExistingLicense(font.id, found.cat) || []) {
      const base = lic.split('/').pop();
      const destLic = join(destDir, base);
      if (lic !== destLic) {
        if (existsSync(destLic)) rmSync(destLic);
        renameSync(lic, destLic);
      }
    }

    catalog.push({
      id: font.id,
      label: font.label,
      category: font.category,
      file: `${font.category}/${font.id}${found.ext}`,
      note: font.note,
    });
  }

  // Remove empty old dirs
  for (const cat of OLD_CATS) {
    const dir = join(OUT, cat);
    if (!existsSync(dir)) continue;
    const left = readdirSync(dir);
    if (left.length === 0) {
      rmSync(dir, { recursive: true });
      console.log(`Removed empty ${cat}/`);
    } else if (!NEW_CATS.includes(cat)) {
      console.warn(`Old dir ${cat}/ still has: ${left.join(', ')}`);
    }
  }

  writeFontsJs(catalog);
  writeFileSync(
    join(ROOT, '.tmp-fonts-reclassify.json'),
    JSON.stringify({ catalog, moved, missing }, null, 2)
  );
  writeFetchFontsList();

  const counts = Object.fromEntries(NEW_CATS.map((c) => [c, 0]));
  for (const f of catalog) counts[f.category]++;
  console.log(`Reclassified ${catalog.length} fonts; moved ${moved.length}; missing ${missing.length}`);
  console.log('Counts:', counts);
  console.log('Updated src/config/fonts.js + scripts/fetch-wiegel-fonts.mjs');
}

/** Rewrite the FONTS array + categories inside fetch-wiegel-fonts.mjs */
function writeFetchFontsList() {
  const path = join(ROOT, 'scripts', 'fetch-wiegel-fonts.mjs');
  let src = readFileSync(path, 'utf8');

  const catType = NEW_CATS.map((c) => `'${c}'`).join('|');
  const fontsLiteral = FONTS.map(
    (f) =>
      `  { zip: '${f.zip}', category: '${f.category}', id: '${f.id}', label: '${f.label.replace(/'/g, "\\'")}' },`
  ).join('\n');

  src = src.replace(
    /\/\*\* @type \{\{ zip: string, category: [^}]+\}\[\] \}\*\/\nconst FONTS = \[[\s\S]*?\];/,
    `/** @type {{ zip: string, category: ${catType}, label: string, id: string }[]} */\nconst FONTS = [\n${fontsLiteral}\n];`
  );

  src = src.replace(
    /for \(const cat of \[[^\]]+\]\)/,
    `for (const cat of ${JSON.stringify(NEW_CATS)})`
  );

  // Embedded FONT_CATEGORIES inside the generated fonts.js template string
  src = src.replace(
    /export const FONT_CATEGORIES = \[\n(?:  \{ id: '[^']+', label: '[^']*' \},\n)+\]/,
    `export const FONT_CATEGORIES = [\n${FONT_CATEGORIES.map((c) => `  { id: '${c.id}', label: '${c.label}' },`).join('\n')}\n]`
  );

  writeFileSync(path, src);
}

main();
