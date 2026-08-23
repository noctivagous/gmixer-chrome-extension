// Page color sampling for restyle weighting.
// Bounded getComputedStyle walk: score visible regions by area, position,
// semantics, and repetition, then split structural vs identity roles.
// See refs/BRANDED_SITE_THEMING.md.

import { contrastRatio, deriveSurface, hexToHsl, hexToLab, hslToHex, labDistance } from '../lib/color-theory.js';

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

function isTransparentColor(value) {
  return !value || value === 'transparent' || value === 'rgba(0, 0, 0, 0)';
}

function querySample(selector, limit = 8) {
  try {
    return Array.from(document.querySelectorAll(selector)).slice(0, limit);
  } catch {
    return [];
  }
}

/** Default CIE76 ΔE threshold for merging brand-color samples. */
export const COLOR_CLUSTER_DELTA_E = 18;

/**
 * Quantized Lab key for fast equality; near colors still merge via ΔE in
 * {@link pickBestScoredColor}.
 * @param {string} hex
 */
export function colorClusterKey(hex) {
  const { L, a, b } = hexToLab(hex);
  return `${Math.round(L / 8)}:${Math.round(a / 10)}:${Math.round(b / 10)}`;
}

/**
 * @param {Element} element
 * @param {string} prop
 * @returns {{
 *   color: string,
 *   area: number,
 *   areaRatio: number,
 *   top: number,
 *   tag: string,
 *   role: string|null,
 *   pairedText: string|null,
 *   pairedBackground: string|null,
 * }|null}
 */
function sampleElementColor(element, prop) {
  if (!element) return null;
  const style = getComputedStyle(element);
  const color = parseCssColor(style[prop]);
  if (!color) return null;
  if (prop === 'backgroundColor' && isTransparentColor(style.backgroundColor)) return null;

  const rect = element.getBoundingClientRect();
  const area = Math.max(0, rect.width * rect.height);
  if (area < 4) return null;
  if (rect.bottom < 0 || rect.right < 0) return null;
  if (rect.top > window.innerHeight && prop !== 'color') return null;

  const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
  const pairedText =
    prop === 'backgroundColor' ? parseCssColor(style.color) : null;
  const pairedBackground =
    prop === 'color' ? parseCssColor(style.backgroundColor) : null;

  return {
    color,
    area,
    areaRatio: Math.min(1, area / viewportArea),
    top: rect.top,
    tag: element.tagName,
    role: element.getAttribute?.('role') || null,
    pairedText,
    pairedBackground,
  };
}

/**
 * Contrast bonus for text-on-brand (or text-on-surface) pairs.
 * Rewards WCAG-ish readable pairs; penalizes unreadable identity paints.
 * @param {string|null|undefined} foreground
 * @param {string|null|undefined} background
 */
export function contrastPairBonus(foreground, background) {
  if (!foreground || !background) return 0;
  const ratio = contrastRatio(foreground, background);
  if (ratio >= 4.5) return 3;
  if (ratio >= 3) return 1.5;
  if (ratio < 2) return -2;
  return 0;
}

/**
 * Score a sample for role selection. Higher = more trusted.
 * @param {ReturnType<typeof sampleElementColor>} sample
 * @param {{ identity?: boolean, semanticBonus?: number, asBackground?: boolean, asForeground?: boolean }} [opts]
 */
export function scoreColorSample(sample, opts = {}) {
  if (!sample) return 0;
  const {
    identity = false,
    semanticBonus = 0,
    asBackground = false,
    asForeground = false,
  } = opts;
  const viewportHeight =
    typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800;
  const topBonus = identity
    ? Math.max(0, 1 - Math.max(0, sample.top) / Math.max(1, viewportHeight * 0.45))
    : 0;
  const sat = hexToHsl(sample.color).s;
  const satBonus = identity ? Math.min(1, sat / 60) : 0;

  let contrastBonus = 0;
  if (asBackground || (identity && sample.pairedText)) {
    contrastBonus += contrastPairBonus(sample.pairedText, sample.color);
  }
  if (asForeground || (identity && sample.pairedBackground && !isTransparentColor(sample.pairedBackground))) {
    contrastBonus += contrastPairBonus(sample.color, sample.pairedBackground);
  }

  return sample.areaRatio * 10 + topBonus * 4 + satBonus * 2 + semanticBonus + contrastBonus;
}

/**
 * Pick the best color from scored samples, merging near colors by Lab ΔE.
 * @param {Array<ReturnType<typeof sampleElementColor> & { score: number }>} scored
 * @param {{ maxDeltaE?: number }} [options]
 * @returns {string|null}
 */
export function pickBestScoredColor(scored, options = {}) {
  if (!scored.length) return null;
  const maxDeltaE = options.maxDeltaE ?? COLOR_CLUSTER_DELTA_E;

  /** @type {{ color: string, lab: ReturnType<typeof hexToLab>, score: number, count: number, bestSampleScore: number }[]} */
  const clusters = [];

  for (const sample of scored) {
    const lab = hexToLab(sample.color);
    let matched = null;
    let bestDistance = Infinity;
    for (const cluster of clusters) {
      const distance = labDistance(lab, cluster.lab);
      if (distance <= maxDeltaE && distance < bestDistance) {
        matched = cluster;
        bestDistance = distance;
      }
    }
    if (matched) {
      matched.score += sample.score;
      matched.count += 1;
      if (sample.score > matched.bestSampleScore) {
        matched.color = sample.color;
        matched.lab = lab;
        matched.bestSampleScore = sample.score;
      }
    } else {
      clusters.push({
        color: sample.color,
        lab,
        score: sample.score,
        count: 1,
        bestSampleScore: sample.score,
      });
    }
  }

  let best = null;
  for (const cluster of clusters) {
    const total = cluster.score * (1 + Math.log2(1 + cluster.count));
    if (!best || total > best.total) best = { ...cluster, total };
  }
  return best?.color || null;
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
 * Collect and score samples for a CSS property across a candidate list.
 * @param {Element[]} elements
 * @param {string} prop
 * @param {{
 *   identity?: boolean,
 *   semanticBonus?: (el: Element) => number,
 *   asBackground?: boolean,
 *   asForeground?: boolean,
 * }} [opts]
 */
function collectScored(elements, prop, opts = {}) {
  /** @type {Array<NonNullable<ReturnType<typeof sampleElementColor>> & { score: number }>} */
  const scored = [];
  for (const el of elements) {
    const sample = sampleElementColor(el, prop);
    if (!sample) continue;
    const semanticBonus = opts.semanticBonus?.(el) ?? 0;
    scored.push({
      ...sample,
      score: scoreColorSample(sample, {
        identity: opts.identity,
        semanticBonus,
        asBackground: opts.asBackground ?? prop === 'backgroundColor',
        asForeground: opts.asForeground ?? prop === 'color',
      }),
    });
  }
  return scored;
}

/**
 * Sample the live page's role colors with region scoring + structural/identity split.
 * Safe to call only after DOM is available (document_end+).
 *
 * @returns {{
 *   background: string|null,
 *   backgroundSecondary: string,
 *   text: string|null,
 *   accent: string|null,
 *   link: string|null,
 *   border: string|null,
 *   isDark: boolean,
 *   headerSizeVariance: number,
 *   structural: { background: string|null, text: string|null, border: string|null },
 *   identity: { accent: string|null, link: string|null, masthead: string|null, nav: string|null },
 * }}
 */
export function samplePageRoles() {
  const html = document.documentElement;
  const body = document.body;
  const roots = [html, body, ...querySample('main, article, [role="main"]', 3)];
  const headers = querySample('header, [role="banner"], .masthead, #header, #masthead', 8);
  const navs = querySample('nav, [role="navigation"], .nav, .navbar', 8);
  const headings = querySample('h1, h2, h3, h4, h5, h6, [role="heading"]', 12);
  const links = querySample('a[href]', 12);
  const bordered = querySample('hr, button, input, .card, [class*="card"]', 8);
  const surfaces = querySample(
    'main, article, [role="main"], .card, [class*="card"], aside, [role="complementary"]',
    10
  );

  const bgScored = collectScored(roots, 'backgroundColor', {
    semanticBonus: (el) =>
      el === body || el === html || el.tagName === 'MAIN' || el.getAttribute('role') === 'main'
        ? 1
        : 0,
  });
  const background =
    findPrimaryBackground(document) ||
    pickBestScoredColor(bgScored) ||
    '#ffffff';

  const textScored = collectScored([...roots, ...headings], 'color');
  const text = pickBestScoredColor(textScored) || '#111111';

  const linkScored = collectScored(links, 'color', { identity: true });
  const link = pickBestScoredColor(linkScored) || text;

  const mastheadScored = collectScored(headers, 'backgroundColor', {
    identity: true,
    semanticBonus: () => 2,
  });
  const navScored = collectScored(navs, 'backgroundColor', {
    identity: true,
    semanticBonus: () => 1.5,
  });
  const headingAccentScored = collectScored(headings, 'color', { identity: true });
  const masthead = pickBestScoredColor(mastheadScored);
  const nav = pickBestScoredColor(navScored);
  const accent =
    pickBestScoredColor([...mastheadScored, ...navScored, ...headingAccentScored]) || link;

  const borderScored = collectScored(bordered, 'borderColor');
  const border = pickBestScoredColor(borderScored) || text;

  const surfaceScored = collectScored(surfaces, 'backgroundColor');
  const backgroundSecondary =
    pickBestScoredColor(surfaceScored.filter((s) => s.color !== background)) ||
    deriveSurface(background, luminance(background) < 50);

  const sizes = headings
    .map((el) => parseFloat(getComputedStyle(el).fontSize) || 0)
    .filter((n) => n > 0);
  let headerSizeVariance = 0.35;
  if (sizes.length >= 2) {
    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    headerSizeVariance = Math.max(0, Math.min(1, (max / min - 1) / 1));
  }

  const isDark = luminance(background) < 50;

  const structural = {
    background,
    backgroundSecondary,
    text,
    border,
  };
  const identity = {
    accent,
    link,
    masthead: masthead || accent,
    nav: nav || accent,
  };

  return {
    background,
    backgroundSecondary,
    text,
    accent,
    link,
    border,
    isDark,
    headerSizeVariance,
    structural,
    identity,
  };
}

/**
 * Map a page color onto a target hue while keeping saturation/lightness.
 * @param {string} pageHex
 * @param {string} targetHueHex
 */
export function harmonizeHue(pageHex, targetHueHex) {
  if (!pageHex) return targetHueHex;
  const page = hexToHsl(pageHex);
  const target = hexToHsl(targetHueHex);
  return hslToHex({ h: target.h, s: page.s, l: page.l });
}

/**
 * Derive a small brand family from an identity color.
 * @param {string} brandHex
 * @param {boolean} isDark
 */
export function deriveBrandFamily(brandHex, isDark = true) {
  const base = hexToHsl(brandHex);
  const tint = hslToHex({ ...base, l: Math.min(96, base.l + (isDark ? 18 : 12)) });
  const shade = hslToHex({ ...base, l: Math.max(8, base.l - (isDark ? 14 : 10)) });
  const whiteOk = contrastRatio('#ffffff', brandHex) >= 4.5;
  const blackOk = contrastRatio('#111111', brandHex) >= 4.5;
  const textOnBrand = whiteOk
    ? '#ffffff'
    : blackOk
      ? '#111111'
      : contrastRatio('#ffffff', brandHex) >= contrastRatio('#111111', brandHex)
        ? '#ffffff'
        : '#111111';
  const hover = hslToHex({
    ...base,
    l: Math.max(0, Math.min(100, base.l + (isDark ? 8 : -8))),
  });
  const active = hslToHex({
    ...base,
    l: Math.max(0, Math.min(100, base.l + (isDark ? -6 : 6))),
  });
  return { brand: brandHex, tint, shade, textOnBrand, hover, active };
}

/**
 * Blend theme palette toward sampled page roles by intensity and identity mode.
 * - restyle: blend all roles (legacy behavior)
 * - preserve: blend structural roles; keep identity colors from the page
 * - harmonize: blend structural; remap identity hues to theme accent
 *
 * @param {object} themePalette
 * @param {ReturnType<typeof samplePageRoles>|null} pageSample
 * @param {number} [intensity]
 * @param {'preserve'|'harmonize'|'restyle'} [identityMode]
 */
export function blendWithPageSample(
  themePalette,
  pageSample,
  intensity = 80,
  identityMode = 'restyle'
) {
  if (!pageSample) return themePalette;
  const t = Math.max(0, Math.min(100, intensity)) / 100;
  const mode = identityMode || 'restyle';

  const mixHex = (themeHex, pageHex) => {
    if (!pageHex) return themeHex;
    if (t === 0) return pageHex;
    if (t === 1) return themeHex;
    const a = hexToHsl(themeHex);
    const b = hexToHsl(pageHex);
    const hueDelta = ((a.h - b.h + 540) % 360) - 180;
    return hslToHex({
      h: (b.h + hueDelta * t + 360) % 360,
      s: a.s * t + b.s * (1 - t),
      l: a.l * t + b.l * (1 - t),
    });
  };

  const structural = pageSample.structural || pageSample;
  const identity = pageSample.identity || {
    accent: pageSample.accent,
    link: pageSample.link,
  };

  const background = mixHex(themePalette.background, structural.background || pageSample.background);
  const text = mixHex(themePalette.text, structural.text || pageSample.text);
  const border = mixHex(themePalette.border, structural.border || pageSample.border);

  let accent;
  let link;
  if (mode === 'preserve') {
    accent = identity.accent || pageSample.accent || themePalette.accent;
    link = identity.link || pageSample.link || themePalette.link;
  } else if (mode === 'harmonize') {
    const pageAccent = identity.accent || pageSample.accent;
    const pageLink = identity.link || pageSample.link;
    accent = pageAccent
      ? harmonizeHue(pageAccent, themePalette.accent)
      : themePalette.accent;
    link = pageLink ? harmonizeHue(pageLink, themePalette.accent) : themePalette.link;
  } else {
    accent = mixHex(themePalette.accent, pageSample.accent);
    link = mixHex(themePalette.link, pageSample.link);
  }

  const isDark = luminance(background) < 50;
  const brandFamily = deriveBrandFamily(accent, isDark);

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
    brandFamily,
    identityMode: mode,
  };
}
