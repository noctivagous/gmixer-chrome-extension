// Light page sampling for restyle weighting (product description.txt >
// PAGE_RESTYLE / color theming notes). Keep this cheap: a handful of
// getComputedStyle calls, no full CSSOM walk.

import { deriveSurface, hexToHsl, hslToHex } from '../lib/color-theory.js';

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

function isTransparentColor(value) {
  return !value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)';
}

/**
 * Score candidates for the most likely primary page background.
 * Large semantic/app roots are useful for SPAs whose body is transparent.
 * @param {Document} [doc]
 * @returns {{ color: string, score: number, tag: string, id: string, role: string|null, areaRatio: number }[]}
 */
export function findPrimaryBackgroundCandidates(doc = document) {
  const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
  const candidates = [
    doc.documentElement,
    doc.body,
    ...Array.from(
      doc.querySelectorAll(
        'main, [role="main"], [role="application"], #app, #root, [data-app], [data-reactroot]'
      )
    ),
  ].filter(Boolean);

  return candidates
    .map((element) => {
      const style = getComputedStyle(element);
      const color = parseCssColor(style.backgroundColor);
      if (isTransparentColor(style.backgroundColor) || !color) return null;
      const rect = element.getBoundingClientRect();
      const area = Math.max(0, rect.width * rect.height);
      const areaRatio = Math.min(1, area / viewportArea);
      const role = element.getAttribute?.('role') || null;
      const isSemanticRoot =
        element === doc.body ||
        element === doc.documentElement ||
        /^(MAIN)$/.test(element.tagName) ||
        role === 'main' ||
        role === 'application' ||
        ['app', 'root'].includes(element.id);
      const score = areaRatio * 10 + (isSemanticRoot ? 1 : 0);
      return {
        color,
        score,
        tag: element.tagName,
        id: element.id || '',
        role,
        areaRatio: Number(areaRatio.toFixed(3)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
}

/**
 * Select the most likely primary page background instead of assuming body.
 * @param {Document} [doc]
 * @returns {string|null}
 */
export function findPrimaryBackground(doc = document) {
  return findPrimaryBackgroundCandidates(doc)[0]?.color || null;
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
    findPrimaryBackground(document) ||
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
    backgroundSecondary: deriveSurface(background, isDark),
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
    if (t === 0) return pageHex;
    if (t === 1) return themeHex;
    const a = hexToHsl(themeHex);
    const b = hexToHsl(pageHex);
    // Interpolate through the shortest path around the hue wheel. A plain
    // numeric average makes hues near 0°/360° travel through green.
    const hueDelta = ((a.h - b.h + 540) % 360) - 180;
    // Prefer theme hue/sat, keep some of the page's lightness relationship.
    return hslToHex({
      h: (b.h + hueDelta * t + 360) % 360,
      s: a.s * t + b.s * (1 - t),
      l: a.l * t + b.l * (1 - t),
    });
  };

  const background = mixHex(themePalette.background, pageSample.background);
  const text = mixHex(themePalette.text, pageSample.text);
  const accent = mixHex(themePalette.accent, pageSample.accent);
  const link = mixHex(themePalette.link, pageSample.link);
  const border = mixHex(themePalette.border, pageSample.border);
  const isDark = luminance(background) < 50;

  return {
    background,
    surface: deriveSurface(background, isDark),
    surfaceGui: deriveSurface(background, isDark),
    surfaceContainers: deriveSurface(deriveSurface(background, isDark), isDark),
    text,
    accent,
    link,
    border,
    isDark,
    headerSizeVariance: pageSample.headerSizeVariance ?? 0.35,
  };
}
