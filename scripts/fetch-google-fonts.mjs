/**
 * Download OFL Google Fonts used by the default aesthetic theme packs.
 * Writes woff2 files to extension/fonts/google/ (latin subset; variable when available).
 *
 * Usage: node scripts/fetch-google-fonts.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'extension/fonts/google');

const FAMILIES = [
  { id: 'playfair-display', cssFamily: 'Playfair Display', query: 'Playfair+Display:wght@400..700', weightRange: '400 700' },
  { id: 'source-sans-3', cssFamily: 'Source Sans 3', query: 'Source+Sans+3:wght@400..700', weightRange: '400 700' },
  { id: 'lora', cssFamily: 'Lora', query: 'Lora:wght@400..600', weightRange: '400 600' },
  { id: 'cormorant-garamond', cssFamily: 'Cormorant Garamond', query: 'Cormorant+Garamond:wght@600', weightRange: '600' },
  { id: 'raleway', cssFamily: 'Raleway', query: 'Raleway:wght@400..600', weightRange: '400 600' },
  { id: 'space-grotesk', cssFamily: 'Space Grotesk', query: 'Space+Grotesk:wght@400..700', weightRange: '400 700' },
  { id: 'dm-sans', cssFamily: 'DM Sans', query: 'DM+Sans:wght@400..700', weightRange: '400 700' },
  { id: 'outfit', cssFamily: 'Outfit', query: 'Outfit:wght@400..600', weightRange: '400 600' },
];

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

async function cssFor(query) {
  const url = `https://fonts.googleapis.com/css2?family=${query}&display=swap`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`CSS ${res.status} for ${query}`);
  return res.text();
}

function pickBestWoff2(css) {
  const blocks = css.split(/@font-face\s*/).slice(1);
  const candidates = [];
  for (const block of blocks) {
    const url = block.match(/url\(([^)]+\.woff2)\)/)?.[1]?.replace(/['"]/g, '');
    const range = block.match(/unicode-range:\s*([^;]+)/)?.[1] || '';
    if (!url) continue;
    const weightDecl = block.match(/font-weight:\s*([^;]+)/)?.[1] || '';
    const isVar = /\d+\s+\d+/.test(weightDecl);
    candidates.push({ url, range, isVar });
  }
  if (!candidates.length) throw new Error('No woff2 URLs in CSS');
  const latin = candidates.filter((c) => /U\+0000-00FF/i.test(c.range));
  const pool = latin.length ? latin : candidates;
  return pool.find((c) => c.isVar) || pool[pool.length - 1] || pool[0];
}

fs.mkdirSync(OUT, { recursive: true });

const catalog = [];
for (const fam of FAMILIES) {
  process.stdout.write(`${fam.cssFamily}… `);
  const css = await cssFor(fam.query);
  const pick = pickBestWoff2(css);
  const res = await fetch(pick.url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`woff2 ${res.status} for ${fam.id}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const file = `${fam.id}.woff2`;
  fs.writeFileSync(path.join(OUT, file), buf);
  console.log(`${(buf.length / 1024).toFixed(1)} KB`);
  catalog.push({
    id: fam.id,
    label: fam.cssFamily,
    family: `"${fam.cssFamily}"`,
    file: `google/${file}`,
    weightRange: fam.weightRange,
    variable: pick.isVar,
  });
}

fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 2));
console.log(`Wrote ${catalog.length} fonts → ${OUT}`);
