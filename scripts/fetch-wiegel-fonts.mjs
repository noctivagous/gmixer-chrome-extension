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
 * After install, regenerates src/config/fonts.js from extension/fonts/
 * (categories + faces = filesystem). Retired ids in font-excludes.mjs
 * are never re-downloaded.
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  rmSync,
  existsSync,
  copyFileSync,
} from 'node:fs';
import { join, basename, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { EXCLUDED_FONT_IDS } from './font-excludes.mjs';
import { generateFontsCatalog } from './generate-fonts-catalog.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const TMP = join(ROOT, '.tmp-fonts');
const OUT = join(ROOT, 'extension', 'fonts');
const BASE = 'http://www.peter-wiegel.de/Fonts';

/** @type {{ zip: string, category: 'script'|'blackletter'|'serif'|'technical'|'stencil'|'matrix'|'typewriter'|'display', label: string, id: string }[]} */
const FONTS_ALL = [
  { zip: 'EuroScript.zip', category: 'script', id: 'euro-script', label: 'Euro Script' },
  { zip: 'Goldmarie.zip', category: 'script', id: 'goldmarie', label: 'Goldmarie' },
  { zip: 'DiscipuliBritannicaTT.zip', category: 'script', id: 'discipuli-britannica', label: 'Discipuli Britannica' },
  { zip: 'CATReporter.zip', category: 'script', id: 'cat-reporter', label: 'CAT Reporter' },
  { zip: 'Flottflott.zip', category: 'script', id: 'flottflott', label: 'Flottflott' },
  { zip: 'NigraScript.zip', category: 'script', id: 'nigra-script', label: 'Nigra Script' },
  { zip: 'Schulkursiv.zip', category: 'script', id: 'schulkursiv', label: 'Schulkursiv' },
  { zip: 'Rundkursiv.zip', category: 'script', id: 'rundkursiv', label: 'Rundkursiv' },
  { zip: 'WolgastScriptTT.zip', category: 'script', id: 'wolgast-script', label: 'Wolgast Script' },
  { zip: 'Ottilie.zip', category: 'script', id: 'ottilie', label: 'Ottilie' },
  { zip: 'Engelsgold.zip', category: 'script', id: 'engelsgold', label: 'Engelsgold' },
  { zip: 'Halt.zip', category: 'script', id: 'halt', label: 'Halt' },
  { zip: 'Praegefest.zip', category: 'script', id: 'praegefest', label: 'Praegefest' },
  { zip: 'Alpha54.zip', category: 'script', id: 'alpha-54', label: 'Alpha 54' },
  { zip: 'EhmckeFederfraktur.zip', category: 'blackletter', id: 'ehmcke-feder', label: 'Ehmcke Feder' },
  { zip: 'Rosamunde.zip', category: 'blackletter', id: 'rosamunde', label: 'Rosamunde' },
  { zip: 'StandardGraf.zip', category: 'blackletter', id: 'standard-graf', label: 'Standard Graf' },
  { zip: 'Doergon.zip', category: 'serif', id: 'doergon', label: 'Doergon' },
  { zip: 'Indira_K.zip', category: 'serif', id: 'indira-k', label: 'Indira K' },
  { zip: 'DIN1451_4H_08.87.zip', category: 'technical', id: 'din-1451-h', label: 'DIN 1451-H' },
  { zip: 'Din1451altTT.zip', category: 'technical', id: 'alte-din-1451', label: 'Alte DIN 1451' },
  { zip: 'DIN1451breit.zip', category: 'technical', id: 'din-breit', label: 'DIN Breitschrift' },
  { zip: 'TGL_0-1451Eng.zip', category: 'technical', id: 'tgl-0-1451', label: 'TGL 0-1451 Engschrift' },
  { zip: 'Kanalisirung.zip', category: 'technical', id: 'kanalisirung', label: 'Kanalisirung' },
  { zip: 'FundamentalBrigade.zip', category: 'technical', id: 'fundamental', label: 'Fundamental Brigade' },
  { zip: 'Berliner_Wand.zip', category: 'technical', id: 'berliner-wand', label: 'Berliner Wand' },
  { zip: 'Autobahn.zip', category: 'technical', id: 'autobahn', label: 'Autobahn' },
  { zip: 'EspressoDolce.zip', category: 'technical', id: 'espresso-dolce', label: 'Espresso Dolce' },
  { zip: 'StefansUhr.zip', category: 'technical', id: 'stefans-uhr', label: 'Stefans Uhr' },
  { zip: 'MMX2010.zip', category: 'technical', id: 'mmx-2010', label: 'MMX 2010' },
  { zip: 'Eyechart.zip', category: 'technical', id: 'eyechart', label: 'Eyechart' },
  { zip: 'googee.zip', category: 'technical', id: 'googee', label: 'Googee' },
  { zip: 'ElbtunnelTT.zip', category: 'technical', id: 'elb-tunnel', label: 'Elb Tunnel' },
  { zip: 'GST_Aero.zip', category: 'technical', id: 'gst-aero', label: 'GST Aero' },
  { zip: 'KKBahn.zip', category: 'technical', id: 'kk-bahn', label: 'KK Bahn' },
  { zip: 'Sowjetschablone.zip', category: 'stencil', id: 'sowjet-schablone', label: 'Sowjet Schablone' },
  { zip: 'PowerweldTT.zip', category: 'stencil', id: 'powerweld', label: 'Powerweld' },
  { zip: 'BorderControl.zip', category: 'stencil', id: 'border-control', label: 'Border Control' },
  { zip: 'fabrik.zip', category: 'stencil', id: 'fabrik', label: 'Fabrik' },
  { zip: 'Schraubenkiste.zip', category: 'stencil', id: 'schraubenkiste', label: 'Schraubenkiste' },
  { zip: 'RingMatrix.zip', category: 'matrix', id: 'ring-matrix', label: 'Ring Matrix' },
  { zip: '5by7.zip', category: 'matrix', id: '5by7', label: '5by7' },
  { zip: '24LED.zip', category: 'matrix', id: '24led', label: '24 LED' },
  { zip: '10mal12Lampen.zip', category: 'matrix', id: '10x12-lampen', label: '10x12 Lampen' },
  { zip: '5mal6Lampen.zip', category: 'matrix', id: '5x6-lampen', label: '5x6 Lampen' },
  { zip: 'Baudot_Murray.zip', category: 'matrix', id: 'baudot-murray', label: 'Baudot Murray' },
  { zip: 'CATNorth.zip', category: 'matrix', id: 'cat-north', label: 'CAT North' },
  { zip: 'cat_stack.zip', category: 'matrix', id: 'cat-stack', label: 'CAT Stack' },
  { zip: 'MaassTT.zip', category: 'matrix', id: 'maass', label: 'Maass Slicer' },
  { zip: 'Tippa.zip', category: 'typewriter', id: 'tippa', label: 'Tippa' },
  { zip: 'Hardman.zip', category: 'display', id: 'hardman', label: 'Hardman' },
  { zip: 'Gloria.zip', category: 'display', id: 'gloria', label: 'Gloria' },
  { zip: 'Astrud.zip', category: 'display', id: 'astrud', label: 'Astrud' },
  { zip: 'Youbilee.zip', category: 'display', id: 'youbilee', label: 'Youbilee' },
  { zip: 'Engravers.zip', category: 'display', id: 'engravers', label: 'Engravers' },
];

const FONTS = FONTS_ALL.filter((f) => !EXCLUDED_FONT_IDS.has(f.id));

function ensureDirs() {
  for (const cat of [
    'script',
    'blackletter',
    'serif',
    'technical',
    'stencil',
    'matrix',
    'typewriter',
    'display',
  ]) {
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
    headers: {
      'User-Agent':
        'gMixer-font-fetcher/0.1 (+local-dev; Peter Wiegel freeware fonts)',
    },
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
    fontFiles.find(
      (f) => !/bold|italic|oblique|black|light|thin|condensed/i.test(basename(f))
    ) ?? fontFiles[0];

  const ext = extname(preferred).toLowerCase();
  const outName = `${id}${ext}`;
  copyFileSync(preferred, join(OUT, category, outName));

  for (const name of readdirSync(extractDir, { recursive: true })) {
    const full = join(extractDir, String(name));
    if (
      /\.(txt|pdf|html|md|rtf)$/i.test(String(name)) &&
      /licen|liesmich|readme|faq|unz|gpl|ofl/i.test(String(name))
    ) {
      try {
        copyFileSync(
          full,
          join(OUT, category, `${id}-LICENSE${extname(String(name))}`)
        );
      } catch {
        /* ignore */
      }
    }
  }

  return {
    ok: true,
    file: `${category}/${outName}`,
    familyGuess: basename(preferred, extname(preferred))
      .replace(/[_-]+/g, ' ')
      .trim(),
    allFaces: fontFiles.map((f) => basename(f)),
  };
}

async function main() {
  ensureDirs();
  const skipped = FONTS_ALL.length - FONTS.length;
  if (skipped) {
    console.log(`Skipping ${skipped} retired font(s) (see scripts/font-excludes.mjs)`);
  }

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
  generateFontsCatalog();
  console.log(`\nInstalled ${catalog.length} fonts; ${failed.length} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
