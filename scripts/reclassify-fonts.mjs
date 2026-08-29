#!/usr/bin/env node
/**
 * Bulk-move Peter Wiegel fonts into category folders under extension/fonts/,
 * then regenerate src/config/fonts.js from the filesystem.
 *
 * Preferred day-to-day workflow: move files between folders by hand, then
 * `npm run fonts:catalog` or `npm run build`. This script is for bulk remaps.
 *
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
import { EXCLUDED_FONT_IDS } from './font-excludes.mjs';
import { CATEGORY_ORDER } from './font-metadata.mjs';
import { generateFontsCatalog } from './generate-fonts-catalog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'extension', 'fonts');

/** @typedef {'script'|'blackletter'|'serif'|'technical'|'stencil'|'matrix'|'typewriter'|'display'} CatId */

/**
 * Optional bulk remap. `note` is provenance for humans, not shipped.
 * Excluded/retired ids are skipped.
 * @type {{ id: string, label: string, zip: string, category: CatId, note: string }[]}
 */
const FONTS_ALL = [
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
  { id: 'ehmcke-feder', label: 'Ehmcke Feder', zip: 'EhmckeFederfraktur.zip', category: 'blackletter', note: 'DaFont Gothic > Medieval; Federfraktur' },
  { id: 'rosamunde', label: 'Rosamunde', zip: 'Rosamunde.zip', category: 'blackletter', note: 'DaFont Gothic > Medieval' },
  { id: 'standard-graf', label: 'Standard Graf', zip: 'StandardGraf.zip', category: 'blackletter', note: 'DaFont Gothic > Various' },
  { id: 'doergon', label: 'Doergon', zip: 'Doergon.zip', category: 'serif', note: 'DaFont Basic > Serif (was matrix)' },
  { id: 'indira-k', label: 'Indira K', zip: 'Indira_K.zip', category: 'serif', note: 'DaFont Basic > Serif (was calligraphy)' },
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
  { id: 'sowjet-schablone', label: 'Sowjet Schablone', zip: 'Sowjetschablone.zip', category: 'stencil', note: 'Schablone = stencil' },
  { id: 'powerweld', label: 'Powerweld', zip: 'PowerweldTT.zip', category: 'stencil', note: 'DaFont Fancy > Various; industrial' },
  { id: 'border-control', label: 'Border Control', zip: 'BorderControl.zip', category: 'stencil', note: 'DaFont Fancy > Various; stencil-like' },
  { id: 'fabrik', label: 'Fabrik', zip: 'fabrik.zip', category: 'stencil', note: 'DaFont Fancy > Various; industrial' },
  { id: 'schraubenkiste', label: 'Schraubenkiste', zip: 'Schraubenkiste.zip', category: 'stencil', note: 'industrial / hardware marking' },
  { id: 'ring-matrix', label: 'Ring Matrix', zip: 'RingMatrix.zip', category: 'matrix', note: 'DaFont Techno > LCD' },
  { id: '5by7', label: '5by7', zip: '5by7.zip', category: 'matrix', note: 'DaFont Techno > LCD' },
  { id: '24led', label: '24 LED', zip: '24LED.zip', category: 'matrix', note: 'LED matrix by name' },
  { id: '10x12-lampen', label: '10x12 Lampen', zip: '10mal12Lampen.zip', category: 'matrix', note: 'lamp/LED matrix by name' },
  { id: '5x6-lampen', label: '5x6 Lampen', zip: '5mal6Lampen.zip', category: 'matrix', note: 'lamp/LED matrix by name' },
  { id: 'baudot-murray', label: 'Baudot Murray', zip: 'Baudot_Murray.zip', category: 'matrix', note: 'DaFont Techno > LCD' },
  { id: 'cat-north', label: 'CAT North', zip: 'CATNorth.zip', category: 'matrix', note: 'DaFont Techno > Various' },
  { id: 'cat-stack', label: 'CAT Stack', zip: 'cat_stack.zip', category: 'matrix', note: 'stacked/pixel display by name' },
  { id: 'maass', label: 'Maass Slicer', zip: 'MaassTT.zip', category: 'matrix', note: 'DaFont Techno > Various' },
  { id: 'tippa', label: 'Tippa', zip: 'Tippa.zip', category: 'typewriter', note: 'DaFont Fancy > Typewriter; Wiegel Adler Tippa' },
  { id: 'hardman', label: 'Hardman', zip: 'Hardman.zip', category: 'display', note: 'DaFont Fancy > Retro (was matrix)' },
  { id: 'gloria', label: 'Gloria', zip: 'Gloria.zip', category: 'display', note: 'DaFont Fancy > Retro (was calligraphy)' },
  { id: 'astrud', label: 'Astrud', zip: 'Astrud.zip', category: 'display', note: 'DaFont Fancy > Retro (was calligraphy)' },
  { id: 'youbilee', label: 'Youbilee', zip: 'Youbilee.zip', category: 'display', note: 'DaFont Dingbats; anniversary ornaments' },
  { id: 'engravers', label: 'Engravers', zip: 'Engravers.zip', category: 'display', note: 'copperplate / engraved display' },
];

const FONTS = FONTS_ALL.filter((f) => !EXCLUDED_FONT_IDS.has(f.id));
const OLD_CATS = ['calligraphy', 'technical', 'matrix'];
const NEW_CATS = [...CATEGORY_ORDER];

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
  return names
    .filter((n) => n.startsWith(`${id}-LICENSE`))
    .map((n) => join(OUT, fromCat, n));
}

/** Keep fetch-wiegel FONTS_ALL category fields in sync for active fonts. */
function writeFetchFontsList() {
  const path = join(ROOT, 'scripts', 'fetch-wiegel-fonts.mjs');
  let src = readFileSync(path, 'utf8');

  const catType = NEW_CATS.map((c) => `'${c}'`).join('|');
  const fontsLiteral = FONTS_ALL.map(
    (f) =>
      `  { zip: '${f.zip}', category: '${f.category}', id: '${f.id}', label: '${f.label.replace(/'/g, "\\'")}' },`
  ).join('\n');

  src = src.replace(
    /\/\*\* @type \{\{ zip: string, category: [^}]+\}\[\] \}\*\/\nconst FONTS_ALL = \[[\s\S]*?\];/,
    `/** @type {{ zip: string, category: ${catType}, label: string, id: string }[]} */\nconst FONTS_ALL = [\n${fontsLiteral}\n];`
  );

  writeFileSync(path, src);
}

function main() {
  for (const cat of NEW_CATS) {
    mkdirSync(join(OUT, cat), { recursive: true });
  }

  const moved = [];
  const missing = [];
  const skippedExcluded = FONTS_ALL.length - FONTS.length;

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
  }

  for (const cat of OLD_CATS) {
    if (NEW_CATS.includes(cat)) continue;
    const dir = join(OUT, cat);
    if (!existsSync(dir)) continue;
    const left = readdirSync(dir);
    if (left.length === 0) {
      rmSync(dir, { recursive: true });
      console.log(`Removed empty ${cat}/`);
    } else {
      console.warn(`Old dir ${cat}/ still has: ${left.join(', ')}`);
    }
  }

  writeFetchFontsList();
  generateFontsCatalog();

  writeFileSync(
    join(ROOT, '.tmp-fonts-reclassify.json'),
    JSON.stringify({ moved, missing, skippedExcluded }, null, 2)
  );

  console.log(
    `Reclassified; moved ${moved.length}; missing ${missing.length}; skipped retired ${skippedExcluded}`
  );
  console.log('Updated fetch list + regenerated fonts catalog from disk');
}

main();
