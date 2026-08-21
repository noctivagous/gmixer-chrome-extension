#!/usr/bin/env node
/**
 * Download a curated batch of Peter Wiegel freeware fonts from
 * https://www.peter-wiegel.de/ into extension/fonts/<category>/.
 *
 * Zip filenames on the site do not always match the HTML page slug —
 * use the `zip` field from each font's page (`Fonts/<name>.zip` link).
 *
 * License: freeware, unrestricted commercial use for fonts he authored
 * (per site FAQ). Do not sell the fonts themselves as a standalone product.
 *
 * Usage: node scripts/fetch-wiegel-fonts.mjs
 * Then:  regenerate src/config/fonts.js from .tmp-fonts/catalog.json
 *        (or re-run the catalog writer step in this script's finish path).
 */
import { mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync, existsSync, copyFileSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const TMP = join(ROOT, '.tmp-fonts');
const OUT = join(ROOT, 'extension', 'fonts');
const BASE = 'http://www.peter-wiegel.de/Fonts';

/** @type {{ zip: string, category: 'calligraphy'|'technical'|'matrix', label: string, id: string }[]} */
const FONTS = [
  // Calligraphy / script
  { zip: 'EuroScript.zip', category: 'calligraphy', id: 'euro-script', label: 'Euro Script' },
  { zip: 'EspressoDolce.zip', category: 'calligraphy', id: 'espresso-dolce', label: 'Espresso Dolce' },
  { zip: 'Goldmarie.zip', category: 'calligraphy', id: 'goldmarie', label: 'Goldmarie' },
  { zip: 'DiscipuliBritannicaTT.zip', category: 'calligraphy', id: 'discipuli-britannica', label: 'Discipuli Britannica' },
  { zip: 'Astrud.zip', category: 'calligraphy', id: 'astrud', label: 'Astrud' },
  { zip: 'CATReporter.zip', category: 'calligraphy', id: 'cat-reporter', label: 'CAT Reporter' },
  { zip: 'Flottflott.zip', category: 'calligraphy', id: 'flottflott', label: 'Flottflott' },
  { zip: 'EhmckeFederfraktur.zip', category: 'calligraphy', id: 'ehmcke-feder', label: 'Ehmcke Feder' },
  { zip: 'Engelsgold.zip', category: 'calligraphy', id: 'engelsgold', label: 'Engelsgold' },
  { zip: 'Indira_K.zip', category: 'calligraphy', id: 'indira-k', label: 'Indira K' },
  { zip: 'NigraScript.zip', category: 'calligraphy', id: 'nigra-script', label: 'Nigra Script' },
  { zip: 'Schulkursiv.zip', category: 'calligraphy', id: 'schulkursiv', label: 'Schulkursiv' },
  { zip: 'Rundkursiv.zip', category: 'calligraphy', id: 'rundkursiv', label: 'Rundkursiv' },
  { zip: 'WolgastScriptTT.zip', category: 'calligraphy', id: 'wolgast-script', label: 'Wolgast Script' },
  { zip: 'Youbilee.zip', category: 'calligraphy', id: 'youbilee', label: 'Youbilee' },
  { zip: 'Ottilie.zip', category: 'calligraphy', id: 'ottilie', label: 'Ottilie' },
  { zip: 'Rosamunde.zip', category: 'calligraphy', id: 'rosamunde', label: 'Rosamunde' },
  { zip: 'Gloria.zip', category: 'calligraphy', id: 'gloria', label: 'Gloria' },

  // Technical / engineering
  { zip: 'DIN1451_4H_08.87.zip', category: 'technical', id: 'din-1451-h', label: 'DIN 1451-H' },
  { zip: 'Din1451altTT.zip', category: 'technical', id: 'alte-din-1451', label: 'Alte DIN 1451' },
  { zip: 'DIN1451breit.zip', category: 'technical', id: 'din-breit', label: 'DIN Breitschrift' },
  { zip: 'Autobahn.zip', category: 'technical', id: 'autobahn', label: 'Autobahn' },
  { zip: 'Engravers.zip', category: 'technical', id: 'engravers', label: 'Engravers' },
  { zip: 'fabrik.zip', category: 'technical', id: 'fabrik', label: 'Fabrik' },
  { zip: 'BorderControl.zip', category: 'technical', id: 'border-control', label: 'Border Control' },
  { zip: 'ElbtunnelTT.zip', category: 'technical', id: 'elb-tunnel', label: 'Elb Tunnel' },
  { zip: 'Kanalisirung.zip', category: 'technical', id: 'kanalisirung', label: 'Kanalisirung' },
  { zip: 'KKBahn.zip', category: 'technical', id: 'kk-bahn', label: 'KK Bahn' },
  { zip: 'FundamentalBrigade.zip', category: 'technical', id: 'fundamental', label: 'Fundamental Brigade' },
  { zip: 'Berliner_Wand.zip', category: 'technical', id: 'berliner-wand', label: 'Berliner Wand' },
  { zip: 'Eyechart.zip', category: 'technical', id: 'eyechart', label: 'Eyechart' },
  { zip: 'GST_Aero.zip', category: 'technical', id: 'gst-aero', label: 'GST Aero' },
  { zip: 'Halt.zip', category: 'technical', id: 'halt', label: 'Halt' },
  { zip: 'TGL_0-1451Eng.zip', category: 'technical', id: 'tgl-0-1451', label: 'TGL 0-1451 Engschrift' },
  { zip: 'Sowjetschablone.zip', category: 'technical', id: 'sowjet-schablone', label: 'Sowjet Schablone' },
  { zip: 'Praegefest.zip', category: 'technical', id: 'praegefest', label: 'Praegefest' },
  { zip: 'PowerweldTT.zip', category: 'technical', id: 'powerweld', label: 'Powerweld' },
  { zip: 'Schraubenkiste.zip', category: 'technical', id: 'schraubenkiste', label: 'Schraubenkiste' },
  { zip: 'StandardGraf.zip', category: 'technical', id: 'standard-graf', label: 'Standard Graf' },

  // Matrix / display
  { zip: 'RingMatrix.zip', category: 'matrix', id: 'ring-matrix', label: 'Ring Matrix' },
  { zip: '5by7.zip', category: 'matrix', id: '5by7', label: '5by7' },
  { zip: '24LED.zip', category: 'matrix', id: '24led', label: '24 LED' },
  { zip: '10mal12Lampen.zip', category: 'matrix', id: '10x12-lampen', label: '10x12 Lampen' },
  { zip: '5mal6Lampen.zip', category: 'matrix', id: '5x6-lampen', label: '5x6 Lampen' },
  { zip: 'Baudot_Murray.zip', category: 'matrix', id: 'baudot-murray', label: 'Baudot Murray' },
  { zip: 'Alpha54.zip', category: 'matrix', id: 'alpha-54', label: 'Alpha 54' },
  { zip: 'cat_stack.zip', category: 'matrix', id: 'cat-stack', label: 'CAT Stack' },
  { zip: 'MaassTT.zip', category: 'matrix', id: 'maass', label: 'Maass Slicer' },
  { zip: 'CATNorth.zip', category: 'matrix', id: 'cat-north', label: 'CAT North' },
  { zip: 'googee.zip', category: 'matrix', id: 'googee', label: 'Googee' },
  { zip: 'Tippa.zip', category: 'matrix', id: 'tippa', label: 'Tippa' },
  { zip: 'StefansUhr.zip', category: 'matrix', id: 'stefans-uhr', label: 'Stefans Uhr' },
  { zip: 'MMX2010.zip', category: 'matrix', id: 'mmx-2010', label: 'MMX 2010' },
  { zip: 'Doergon.zip', category: 'matrix', id: 'doergon', label: 'Doergon' },
  { zip: 'Hardman.zip', category: 'matrix', id: 'hardman', label: 'Hardman' },
];

function ensureDirs() {
  for (const cat of ['calligraphy', 'technical', 'matrix']) {
    mkdirSync(join(OUT, cat), { recursive: true });
  }
  mkdirSync(TMP, { recursive: true });
}

async function download(zipName) {
  const url = `${BASE}/${zipName}`;
  const dest = join(TMP, zipName);
  if (existsSync(dest) && readFileSync(dest).length > 100) {
    return { ok: true, cached: true, dest };
  }
  const res = await fetch(url, {
    headers: { 'User-Agent': 'gMixer-font-fetcher/0.1 (+local-dev; Peter Wiegel freeware fonts)' },
    redirect: 'follow',
  });
  if (!res.ok) return { ok: false, status: res.status, url };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    return { ok: false, status: res.status, url, reason: 'not-a-zip' };
  }
  writeFileSync(dest, buf);
  return { ok: true, dest, bytes: buf.length };
}

function listFontFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, name.name);
    if (name.isDirectory()) out.push(...listFontFiles(p));
    else if (/\.(ttf|otf|woff2?)$/i.test(name.name)) out.push(p);
  }
  return out;
}

function extractAndInstall(zipPath, category, id) {
  const extractDir = join(TMP, `extract-${id}`);
  rmSync(extractDir, { recursive: true, force: true });
  mkdirSync(extractDir, { recursive: true });
  try {
    execFileSync('unzip', ['-o', '-q', zipPath, '-d', extractDir]);
  } catch (err) {
    return { ok: false, error: String(err) };
  }

  const fontFiles = listFontFiles(extractDir);
  if (!fontFiles.length) return { ok: false, error: 'no font files in zip' };

  const preferred =
    fontFiles.find((f) => !/bold|italic|oblique|black|light|thin|condensed/i.test(basename(f))) ??
    fontFiles[0];

  const ext = extname(preferred).toLowerCase();
  const outName = `${id}${ext}`;
  copyFileSync(preferred, join(OUT, category, outName));

  for (const name of readdirSync(extractDir, { recursive: true })) {
    const full = join(extractDir, String(name));
    if (/\.(txt|pdf|html|md|rtf)$/i.test(String(name)) && /licen|liesmich|readme|faq|unz|gpl|ofl/i.test(String(name))) {
      try {
        copyFileSync(full, join(OUT, category, `${id}-LICENSE${extname(String(name))}`));
      } catch {
        /* ignore */
      }
    }
  }

  return {
    ok: true,
    file: `${category}/${outName}`,
    familyGuess: basename(preferred, extname(preferred)).replace(/[_-]+/g, ' ').trim(),
    allFaces: fontFiles.map((f) => basename(f)),
  };
}

function writeFontsJs(catalog) {
  const fonts = [...catalog].sort((a, b) => {
    const cat = a.category.localeCompare(b.category);
    return cat !== 0 ? cat : a.label.localeCompare(b.label);
  });
  const entries = fonts
    .map(
      (f) =>
        `  { id: ${JSON.stringify(f.id)}, label: ${JSON.stringify(f.label)}, category: ${JSON.stringify(f.category)}, family: ${JSON.stringify(`"${f.label}"`)}, file: ${JSON.stringify(f.file)} },`
    )
    .join('\n');

  const src = `// Bundled font catalog. Font files live in extension/fonts/<category>/
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

  // Peter Wiegel freeware batch (${fonts.length} fonts)
${entries}
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
`;
  writeFileSync(join(ROOT, 'src', 'config', 'fonts.js'), src);
}

async function main() {
  ensureDirs();
  const catalog = [];
  const failed = [];

  for (const font of FONTS) {
    process.stdout.write(`→ ${font.zip} ... `);
    const dl = await download(font.zip);
    if (!dl.ok) {
      console.log(`FAIL (${dl.status ?? ''} ${dl.reason ?? ''})`);
      failed.push({ ...font, error: dl });
      continue;
    }
    const installed = extractAndInstall(dl.dest, font.category, font.id);
    if (!installed.ok) {
      console.log(`EXTRACT FAIL: ${installed.error}`);
      failed.push({ ...font, error: installed });
      continue;
    }
    console.log(`OK → ${installed.file} (${installed.allFaces.length} face(s))`);
    catalog.push({
      id: font.id,
      label: font.label,
      category: font.category,
      family: `"${font.label}"`,
      file: installed.file,
      sourceFamily: installed.familyGuess,
      facesInZip: installed.allFaces,
    });
  }

  writeFileSync(join(TMP, 'catalog.json'), JSON.stringify({ catalog, failed }, null, 2));
  writeFontsJs(catalog);
  console.log(`\nInstalled ${catalog.length} fonts; ${failed.length} failed.`);
  console.log('Updated src/config/fonts.js');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
