// Light page sampling for restyle weighting (product description.txt >
// PAGE_RESTYLE / color theming notes). Keep this cheap: a handful of
// getComputedStyle calls, no full CSSOM walk.

import { hexToHsl, hslToHex } from '../lib/color-theory.js';

function rgbToHex(r, g, b) {
  const toHex = (v) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/** Parse css color strings (rgb/rgba/hex) into #rrggbb, or null. */
export function parseCssColor(value) {
  if (!value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)') return null;
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1];
    if (h.length === 3) {
      return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
    }
    return `#${h}`.toLowerCase();
  }
  const rgb = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb) return rgbToHex(+rgb[1], +rgb[2], +rgb[3]);
  return null;
}

function luminance(hex) {
  const { l } = hexToHsl(hex);
  return l;
}

function pickFirstColor(elements, prop) {
  for (const el of elements) {
    if (!el) continue;
    const color = parseCssColor(getComputedStyle(el)[prop]);
    if (color) return color;
  }
  return null;
}

function querySample(selector, limit = 8) {
  try {
    return Array.from(document.querySelectorAll(selector)).slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Sample the live page's role colors + header size hierarchy.
 * Safe to call only after DOM is available (document_end+).
 *
 * @returns {{
 *   background: string|null,
 *   text: string|null,
 *   accent: string|null,
 *   link: string|null,
 *   border: string|null,
 *   isDark: boolean,
 *   headerSizeVariance: number,
 * }}
 */
export function samplePageRoles() {
  const html = document.documentElement;
  const body = document.body;
  const roots = [html, body, ...querySample('main, article, [role="main"]', 3)];
  const headings = querySample('h1, h2, h3, h4, h5, h6, [role="heading"]', 12);
  const links = querySample('a[href]', 8);
  const bordered = querySample('hr, button, input, .card, [class*="card"]', 6);

  const background =
    pickFirstColor(roots, 'backgroundColor') ||
    pickFirstColor(roots, 'background') ||
    '#ffffff';
  const text = pickFirstColor([...roots, ...headings], 'color') || '#111111';
  const link = pickFirstColor(links, 'color') || text;
  const accent = pickFirstColor(headings, 'color') || link;
  const border = pickFirstColor(bordered, 'borderColor') || text;

  const sizes = headings
    .map((el) => parseFloat(getComputedStyle(el).fontSize) || 0)
    .filter((n) => n > 0);
  let headerSizeVariance = 0.35;
  if (sizes.length >= 2) {
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    // Normalize: ratio 1.0 (flat) → 0, ratio ≥2.0 → 1
    headerSizeVariance = Math.max(0, Math.min(1, (max / min - 1) / 1));
  }

  const isDark = luminance(background) < 50;

  return {
    background,
    text,
    accent,
    link,
    border,
    isDark,
    headerSizeVariance,
  };
}

/**
 * Blend theme palette toward sampled page roles by intensity (0–100).
 * 0 = stay close to the page; 100 = full theme paint.
 */
export function blendWithPageSample(themePalette, pageSample, intensity = 80) {
  if (!pageSample) return themePalette;
  const t = Math.max(0, Math.min(100, intensity)) / 100;

  const mixHex = (themeHex, pageHex) => {
    if (!pageHex) return themeHex;
    const a = hexToHsl(themeHex);
    const b = hexToHsl(pageHex);
    // Prefer theme hue/sat, keep some of the page's lightness relationship.
    return hslToHex({
      h: a.h * t + b.h * (1 - t),
      s: a.s * t + b.s * (1 - t),
      l: a.l * (0.55 + 0.45 * t) + b.l * (0.45 * (1 - t)),
    });
  };

  const background = mixHex(themePalette.background, pageSample.background);
  const text = mixHex(themePalette.text, pageSample.text);
  const accent = mixHex(themePalette.accent, pageSample.accent);
  const link = mixHex(themePalette.link, pageSample.link);
  const border = mixHex(themePalette.border, pageSample.border);

  return {
    background,
    text,
    accent,
    link,
    border,
    isDark: luminance(background) < 50,
    headerSizeVariance: pageSample.headerSizeVariance ?? 0.35,
  };
}
