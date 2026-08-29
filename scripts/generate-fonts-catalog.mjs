#!/usr/bin/env node
/**
 * Scan extension/fonts/ and regenerate src/config/fonts.js.
 *
 * - Category ids = immediate subdirectory names that contain font files
 *   (except google/, whose UI categories come from google/catalog.json)
 * - Font entries = font files on disk (+ synthetic system faces)
 *
 * Usage: node scripts/generate-fonts-catalog.mjs
 * Also run automatically from build.js.
 */
import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
} from 'node:fs';
import { join, extname, basename, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  CATEGORY_ORDER,
  GOOGLE_DIR,
  categoryLabel,
  fontLabel,
} from './font-metadata.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONTS_DIR = join(ROOT, 'extension', 'fonts');
const OUT_JS = join(ROOT, 'src', 'config', 'fonts.js');
const GOOGLE_CATALOG = join(FONTS_DIR, GOOGLE_DIR, 'catalog.json');

const FONT_EXT = /\.(ttf|otf|woff2?)$/i;

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listFontFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => FONT_EXT.test(name))
    .map((name) => join(dir, name))
    .filter((p) => statSync(p).isFile())
    .sort((a, b) => basename(a).localeCompare(basename(b)));
}

/**
 * @returns {{ id: string, label: string }[]}
 */
function discoverCategories(diskCategoryIds, googleCategories) {
  const fromDisk = new Set(diskCategoryIds);
  for (const c of googleCategories) fromDisk.add(c);

  const known = CATEGORY_ORDER.filter((id) => fromDisk.has(id));
  const extras = [...fromDisk]
    .filter((id) => !CATEGORY_ORDER.includes(id) && id !== 'system')
    .sort((a, b) => a.localeCompare(b));

  const cats = [...known, ...extras].map((id) => ({
    id,
    label: categoryLabel(id),
  }));
  cats.push({ id: 'system', label: categoryLabel('system') });
  return cats;
}

/**
 * @returns {object[]}
 */
function loadGoogleEntries() {
  if (!existsSync(GOOGLE_CATALOG)) return [];
  /** @type {object[]} */
  const raw = JSON.parse(readFileSync(GOOGLE_CATALOG, 'utf8'));
  const entries = [];
  for (const row of raw) {
    const fileRel = row.file || `${GOOGLE_DIR}/${row.id}.woff2`;
    const abs = join(FONTS_DIR, fileRel);
    if (!existsSync(abs)) {
      console.warn(`google catalog: missing file ${fileRel}`);
      continue;
    }
    const category = row.category || 'technical';
    const label = row.label || fontLabel(row.id);
    /** @type {Record<string, unknown>} */
    const entry = {
      id: row.id,
      label,
      category,
      family: row.family || `"${label}"`,
      file: fileRel,
    };
    if (row.weightRange) entry.weightRange = row.weightRange;
    entries.push(entry);
  }
  return entries;
}

/**
 * @returns {{ categories: { id: string, label: string }[], fonts: object[] }}
 */
export function buildCatalog() {
  const dirs = existsSync(FONTS_DIR)
    ? readdirSync(FONTS_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && !d.name.startsWith('.'))
        .map((d) => d.name)
    : [];

  const diskFonts = [];
  const diskCategoryIds = [];

  for (const dirName of dirs) {
    if (dirName === GOOGLE_DIR) continue;
    const files = listFontFiles(join(FONTS_DIR, dirName));
    if (!files.length) continue;
    diskCategoryIds.push(dirName);
    for (const abs of files) {
      const id = basename(abs, extname(abs));
      const label = fontLabel(id);
      diskFonts.push({
        id,
        label,
        category: dirName,
        family: `"${label}"`,
        file: `${dirName}/${basename(abs)}`,
      });
    }
  }

  const googleFonts = loadGoogleEntries();
  const googleCategories = googleFonts.map((f) => f.category);

  const categories = discoverCategories(diskCategoryIds, googleCategories);

  const systemFonts = [
    {
      id: 'system-display',
      label: 'System Display',
      category: 'system',
      family: 'system-ui, sans-serif',
      file: null,
    },
    {
      id: 'system-body',
      label: 'System Body',
      category: 'system',
      family: 'system-ui, sans-serif',
      file: null,
    },
    {
      id: 'system-mono',
      label: 'System Mono',
      category: 'system',
      family: 'ui-monospace, monospace',
      file: null,
    },
  ];

  const catIndex = new Map(categories.map((c, i) => [c.id, i]));
  const bundled = [...googleFonts, ...diskFonts].sort((a, b) => {
    const ai = catIndex.get(a.category) ?? 999;
    const bi = catIndex.get(b.category) ?? 999;
    if (ai !== bi) return ai - bi;
    return a.label.localeCompare(b.label);
  });

  return { categories, fonts: [...systemFonts, ...bundled] };
}

/**
 * @param {object} entry
 * @returns {string}
 */
function formatEntry(entry) {
  const parts = [
    `id: ${JSON.stringify(entry.id)}`,
    `label: ${JSON.stringify(entry.label)}`,
    `category: ${JSON.stringify(entry.category)}`,
    `family: ${JSON.stringify(entry.family)}`,
    `file: ${JSON.stringify(entry.file)}`,
  ];
  if (entry.weightRange) {
    parts.push(`weightRange: ${JSON.stringify(entry.weightRange)}`);
  }
  return `  { ${parts.join(', ')} },`;
}

/**
 * @param {{ categories: { id: string, label: string }[], fonts: object[] }} catalog
 * @returns {string}
 */
export function renderFontsJs(catalog) {
  const { categories, fonts } = catalog;
  const catBlock = categories
    .map((c) => `  { id: ${JSON.stringify(c.id)}, label: ${JSON.stringify(c.label)} },`)
    .join('\n');

  const system = fonts.filter((f) => f.category === 'system');
  const google = fonts.filter((f) => f.file && String(f.file).startsWith('google/'));
  const rest = fonts.filter(
    (f) => f.category !== 'system' && !(f.file && String(f.file).startsWith('google/'))
  );

  const sections = [
    '  // System fallbacks — always available.',
    ...system.map(formatEntry),
  ];
  if (google.length) {
    sections.push(
      '',
      '  // Google Fonts — files under fonts/google/; UI category from catalog.json.',
      '  // Refresh with: node scripts/fetch-google-fonts.mjs',
      ...google.map(formatEntry)
    );
  }
  if (rest.length) {
    sections.push(
      '',
      `  // Bundled faces from extension/fonts/<category>/ (${rest.length} files)`,
      ...rest.map(formatEntry)
    );
  }

  return `// GENERATED — do not edit by hand.
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
${catBlock}
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
${sections.join('\n')}
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
`;
}

export function generateFontsCatalog() {
  const catalog = buildCatalog();
  writeFileSync(OUT_JS, renderFontsJs(catalog));
  const bundled = catalog.fonts.filter((f) => f.file).length;
  const cats = catalog.categories.filter((c) => c.id !== 'system').map((c) => c.id);
  console.log(
    `fonts catalog: ${bundled} bundled + 3 system; categories: ${cats.join(', ')} → ${OUT_JS}`
  );
  return catalog;
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  generateFontsCatalog();
}
