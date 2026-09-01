// Page color sampling for restyle weighting.
// Bounded getComputedStyle walk: score visible regions by area, position,
// semantics, and repetition, then split structural vs identity roles.
// See refs/BRANDED_SITE_THEMING.md.

import {
  contrastRatio,
  deriveSurface,
  deriveSurfaceLadder,
  hexToHsl,
  hexToLab,
  hslToHex,
  labDistance,
} from '../lib/color-theory.js';

function rgbToHex(r, g, b) {
  const toHex = (v) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function parseAlpha(value) {
  if (value == null) return 1;
  const parsed = value.endsWith('%') ? parseFloat(value) / 100 : parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : null;
}

function parseRgbChannel(value) {
  const parsed = value.endsWith('%') ? (parseFloat(value) * 255) / 100 : parseFloat(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(255, parsed)) : null;
}

function parseHue(value) {
  const parsed = parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  if (value.endsWith('turn')) return parsed * 360;
  if (value.endsWith('rad')) return (parsed * 180) / Math.PI;
  if (value.endsWith('grad')) return parsed * 0.9;
  return parsed;
}

function hexChannels(hex) {
  const normalized = hex.replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
}

function compositeRgb(foreground, background, alpha) {
  return foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha));
}

/**
 * Parse modern computed CSS colors into #rrggbb.
 * Translucent colors are composited over `backdrop` when supplied; callers
 * without a known backdrop retain the historical opaque-channel result.
 */
export function parseCssColor(value, backdrop = null) {
  if (!value || value.trim().toLowerCase() === 'transparent') return null;
  const normalized = value.trim().toLowerCase();
  let channels = null;
  let alpha = 1;

  const hex = normalized.match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    const h = hex[1];
    const expanded = h.length <= 4 ? [...h].map((part) => part + part).join('') : h;
    channels = hexChannels(`#${expanded.slice(0, 6)}`);
    if (expanded.length === 8) alpha = parseInt(expanded.slice(6), 16) / 255;
  }

  if (!channels) {
    const rgb = normalized.match(/^rgba?\((.*)\)$/);
    if (rgb) {
      const [colorPart, alphaPart] = rgb[1].split('/').map((part) => part.trim());
      const parts = colorPart.includes(',')
        ? colorPart.split(',').map((part) => part.trim())
        : colorPart.split(/\s+/);
      if (parts.length === 4 && alphaPart == null) alpha = parseAlpha(parts.pop());
      else if (alphaPart != null) alpha = parseAlpha(alphaPart);
      channels = parts.length === 3 ? parts.map(parseRgbChannel) : null;
    }
  }

  if (!channels) {
    const hsl = normalized.match(/^hsla?\((.*)\)$/);
    if (hsl) {
      const [colorPart, alphaPart] = hsl[1].split('/').map((part) => part.trim());
      const parts = colorPart.includes(',')
        ? colorPart.split(',').map((part) => part.trim())
        : colorPart.split(/\s+/);
      if (parts.length === 4 && alphaPart == null) alpha = parseAlpha(parts.pop());
      else if (alphaPart != null) alpha = parseAlpha(alphaPart);
      const hue = parts.length === 3 ? parseHue(parts[0]) : null;
      const saturation = parseFloat(parts[1]);
      const lightness = parseFloat(parts[2]);
      if (
        hue != null &&
        Number.isFinite(saturation) &&
        Number.isFinite(lightness) &&
        parts[1].endsWith('%') &&
        parts[2].endsWith('%')
      ) {
        channels = hexChannels(
          hslToHex({
            h: ((hue % 360) + 360) % 360,
            s: Math.max(0, Math.min(100, saturation)),
            l: Math.max(0, Math.min(100, lightness)),
          })
        );
      }
    }
  }

  if (!channels) {
    const color = normalized.match(/^color\(\s*srgb\s+(.+)\)$/);
    if (color) {
      const [colorPart, alphaPart] = color[1].split('/').map((part) => part.trim());
      const parts = colorPart.split(/\s+/);
      channels =
        parts.length === 3
          ? parts.map((part) => {
              const parsed = part.endsWith('%') ? parseFloat(part) / 100 : parseFloat(part);
              return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) * 255 : null;
            })
          : null;
      if (alphaPart != null) alpha = parseAlpha(alphaPart);
    }
  }

  if (!channels || channels.some((channel) => channel == null) || alpha == null || alpha <= 0) {
    return null;
  }
  if (alpha < 1 && backdrop) {
    const backdropHex = parseCssColor(backdrop);
    if (backdropHex) channels = compositeRgb(channels, hexChannels(backdropHex), alpha);
  }
  return rgbToHex(...channels);
}

function luminance(hex) {
  const { l } = hexToHsl(hex);
  return l;
}

function isTransparentColor(value) {
  return !value || parseCssColor(value) === null;
}

/**
 * Select a bounded, spatially and semantically representative subset instead
 * of allowing early DOM order to dominate every role.
 */
export function selectRepresentativeCandidates(elements, limit = 8) {
  const all = Array.from(elements || []).filter(Boolean);
  if (all.length <= limit) return all;
  const scanLimit = Math.max(limit, 240);
  const stride = Math.max(1, Math.ceil(all.length / scanLimit));
  const scanned = all.filter((_, index) => index % stride === 0);
  if (scanned[scanned.length - 1] !== all[all.length - 1]) scanned.push(all[all.length - 1]);
  const viewportHeight =
    typeof window !== 'undefined' && window.innerHeight ? window.innerHeight : 800;

  const ranked = scanned.map((element, index) => {
    let rect = { top: 0, width: 0, height: 0, bottom: 0, right: 0 };
    try {
      rect = element.getBoundingClientRect?.() || rect;
    } catch {
      // Detached or synthetic candidates retain a DOM-spread score.
    }
    const area = Math.max(0, rect.width * rect.height);
    const visible = rect.bottom >= 0 && rect.right >= 0 && rect.top <= viewportHeight * 2;
    const tag = element.tagName || '';
    const role = element.getAttribute?.('role') || '';
    const semantic =
      /^(HTML|BODY|MAIN|ARTICLE|HEADER|NAV|H1|H2|H3)$/.test(tag) ||
      /^(main|banner|navigation|heading|application)$/.test(role)
        ? 2
        : 0;
    const band = Math.max(0, Math.min(5, Math.floor(Math.max(0, rect.top) / Math.max(1, viewportHeight / 2))));
    return {
      element,
      band,
      score: (visible ? 2 : 0) + semantic + Math.min(3, area / 100000) + index / scanned.length,
    };
  });

  const selected = [];
  const used = new Set();
  for (let band = 0; band <= 5 && selected.length < limit; band += 1) {
    const best = ranked
      .filter((candidate) => candidate.band === band)
      .sort((a, b) => b.score - a.score)[0];
    if (best) {
      selected.push(best.element);
      used.add(best.element);
    }
  }
  for (const candidate of ranked.sort((a, b) => b.score - a.score)) {
    if (selected.length >= limit) break;
    if (!used.has(candidate.element)) {
      selected.push(candidate.element);
      used.add(candidate.element);
    }
  }
  return selected;
}

function querySample(selector, limit = 8) {
  try {
    return selectRepresentativeCandidates(document.querySelectorAll(selector), limit);
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
function getCachedStyle(element, styleCache) {
  if (!styleCache) return getComputedStyle(element);
  let style = styleCache.get(element);
  if (!style) {
    style = getComputedStyle(element);
    styleCache.set(element, style);
  }
  return style;
}

function findOpaqueBackdrop(element, styleCache) {
  const ancestors = [];
  let current = element?.parentElement;
  for (let depth = 0; current && depth < 8; depth += 1, current = current.parentElement) {
    ancestors.push(current);
  }
  let backdrop = '#ffffff';
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const color = parseCssColor(
      getCachedStyle(ancestors[index], styleCache).backgroundColor,
      backdrop
    );
    if (color) backdrop = color;
  }
  return backdrop;
}

function sampleElementColor(element, prop, styleCache) {
  if (!element) return null;
  const style = getCachedStyle(element, styleCache);
  const backdrop = findOpaqueBackdrop(element, styleCache);
  const color = parseCssColor(style[prop], backdrop);
  if (!color) return null;
  if (prop === 'backgroundColor' && isTransparentColor(style.backgroundColor)) return null;

  const rect = element.getBoundingClientRect();
  const area = Math.max(0, rect.width * rect.height);
  if (area < 4) return null;
  if (rect.bottom < 0 || rect.right < 0) return null;
  if (rect.top > window.innerHeight && prop !== 'color') return null;

  const viewportArea = Math.max(1, window.innerWidth * window.innerHeight);
  const pairedText =
    prop === 'backgroundColor' ? parseCssColor(style.color, color) : null;
  const pairedBackground =
    prop === 'color' ? parseCssColor(style.backgroundColor, backdrop) || backdrop : null;

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
export function findPrimaryBackgroundCandidates(doc = document, styleCache) {
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
      const style = getCachedStyle(element, styleCache);
      const color = parseCssColor(
        style.backgroundColor,
        findOpaqueBackdrop(element, styleCache)
      );
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
export function findPrimaryBackground(doc = document, styleCache) {
  return findPrimaryBackgroundCandidates(doc, styleCache)[0]?.color || null;
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
function collectScored(elements, prop, opts = {}, styleCache) {
  /** @type {Array<NonNullable<ReturnType<typeof sampleElementColor>> & { score: number }>} */
  const scored = [];
  for (const el of elements) {
    // Classifier annotations are available during the full adaptive pass.
    // Advertiser creative is often saturated and large, but must not become a
    // site's preserved or harmonized identity color.
    if (opts.identity && el.closest?.('[data-gmixer-role="ad"]')) continue;
    const sample = sampleElementColor(el, prop, styleCache);
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

/** Below this, the nominal primary background isn't backed by meaningful area. */
const PRIMARY_BACKGROUND_MIN_AREA_RATIO = 0.35;
/** A surface must cover at least this much of the viewport to be promoted to BG:Primary. */
const SECONDARY_PROMOTION_MIN_AREA_RATIO = 0.45;

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
 *   navLink: string|null,
 *   border: string|null,
 *   muted: string|null,
 *   focus: string|null,
 *   isDark: boolean,
 *   headerSizeVariance: number,
 *   structural: { background: string|null, text: string|null, border: string|null },
 *   identity: { accent: string|null, link: string|null, navLink: string|null, masthead: string|null, nav: string|null },
 *   sampling: {
 *     confidence: 'high'|'medium'|'low',
 *     weak: boolean,
 *     provenance: Record<string, string>,
 *     candidateCounts: Record<string, number>,
 *   },
 * }}
 */
export function samplePageRoles() {
  const styleCache = new WeakMap();
  const html = document.documentElement;
  const body = document.body;
  const roots = [html, body, ...querySample('main, article, [role="main"]', 3)];
  const headers = querySample(
    'header, [role="banner"], .masthead, #header, #masthead, [data-gmixer-role="header"]',
    8
  );
  const navs = querySample(
    'nav, [role="navigation"], .nav, .navbar, [data-gmixer-role="navigation"]',
    8
  );
  const headings = querySample('h1, h2, h3, h4, h5, h6, [role="heading"]', 12);
  const contentLinks = querySample(
    'main a[href], article a[href], [role="main"] a[href], p a[href]',
    12
  );
  const chromeLinks = querySample(
    'header a[href], footer a[href], nav a[href], [role="banner"] a[href], [role="contentinfo"] a[href], [role="navigation"] a[href], [data-gmixer-role="header"] a[href], [data-gmixer-role="footer"] a[href], [data-gmixer-role="navigation"] a[href]',
    12
  );
  const links = contentLinks.length ? contentLinks : querySample('a[href]', 12);
  const bordered = querySample('hr, button, input, .card, [class*="card"]', 8);
  const surfaces = querySample(
    'main, article, [role="main"], .card, [class*="card"], aside, [role="complementary"]',
    10
  );
  const mutedCandidates = querySample(
    'small, figcaption, footer, .meta, .muted, .subtitle, [aria-describedby]',
    10
  );
  const focusCandidates = querySample(
    'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])',
    12
  );

  const bgScored = collectScored(roots, 'backgroundColor', {
    semanticBonus: (el) =>
      el === body || el === html || el.tagName === 'MAIN' || el.getAttribute('role') === 'main'
        ? 1
        : 0,
  }, styleCache);
  const primaryCandidates = findPrimaryBackgroundCandidates(document, styleCache);
  const primaryBackground = primaryCandidates[0]?.color || null;
  const scoredBackground = pickBestScoredColor(bgScored);
  let background = primaryBackground || scoredBackground || '#ffffff';
  // Area actually backing `background`. A page whose html/body/main are
  // transparent falls through to the '#ffffff' default above, which isn't
  // backed by any real element - treat that as zero coverage.
  let backgroundAreaRatio = primaryBackground ? primaryCandidates[0].areaRatio : 0;

  const textScored = collectScored([...roots, ...headings], 'color', {}, styleCache);
  const sampledText = pickBestScoredColor(textScored);
  const text = sampledText || '#111111';

  const linkScored = collectScored(links, 'color', { identity: true }, styleCache);
  const sampledLink = pickBestScoredColor(linkScored);
  const link = sampledLink || text;
  const navLinkScored = collectScored(chromeLinks, 'color', { identity: true }, styleCache);
  const sampledNavLink = pickBestScoredColor(navLinkScored);
  const navLink = sampledNavLink || link;

  const mastheadScored = collectScored(headers, 'backgroundColor', {
    identity: true,
    semanticBonus: () => 2,
  }, styleCache);
  const navScored = collectScored(navs, 'backgroundColor', {
    identity: true,
    semanticBonus: () => 1.5,
  }, styleCache);
  const headingAccentScored = collectScored(headings, 'color', { identity: true }, styleCache);
  const masthead = pickBestScoredColor(mastheadScored);
  const nav = pickBestScoredColor(navScored);
  const sampledAccent = pickBestScoredColor([
    ...mastheadScored,
    ...navScored,
    ...headingAccentScored,
  ]);
  const accent = sampledAccent || link;

  const borderScored = collectScored(bordered, 'borderColor', {}, styleCache);
  const sampledBorder = pickBestScoredColor(borderScored);
  const border = sampledBorder || text;

  const surfaceScored = collectScored(surfaces, 'backgroundColor', {}, styleCache);

  // Many app shells never paint a real primary background (html/body stay
  // transparent) while a large content wrapper - a `.card`/aside/complementary
  // surface that would otherwise become BG:Secondary - visually IS the page
  // background. When the nominal primary barely covers the viewport and one
  // of those surfaces dominates it instead, promote the surface to BG:Primary
  // and let backgroundSecondary/surfaceGui/surfaceContainers re-derive from
  // the new primary below rather than leaving the stale assignment in place.
  const dominantSurface = surfaceScored.reduce(
    (best, sample) =>
      sample.color !== background && (!best || sample.areaRatio > best.areaRatio)
        ? sample
        : best,
    null
  );
  const promotedSecondary =
    Boolean(dominantSurface) &&
    backgroundAreaRatio < PRIMARY_BACKGROUND_MIN_AREA_RATIO &&
    dominantSurface.areaRatio >= SECONDARY_PROMOTION_MIN_AREA_RATIO &&
    dominantSurface.areaRatio > backgroundAreaRatio;
  if (promotedSecondary) {
    background = dominantSurface.color;
    backgroundAreaRatio = dominantSurface.areaRatio;
  }

  const sampledSecondary = pickBestScoredColor(
    surfaceScored.filter((sample) => sample.color !== background)
  );
  const backgroundSecondary =
    sampledSecondary ||
    deriveSurface(background, luminance(background) < 50);

  const mutedScored = collectScored(mutedCandidates, 'color', {}, styleCache);
  const sampledMuted = pickBestScoredColor(mutedScored);
  const muted = sampledMuted || text;
  const focusOutlineScored = collectScored(focusCandidates, 'outlineColor', {}, styleCache);
  const focusBorderScored = collectScored(focusCandidates, 'borderColor', {}, styleCache);
  const sampledFocus = pickBestScoredColor([...focusOutlineScored, ...focusBorderScored]);
  const focus = sampledFocus || accent;

  const sizes = headings
    .map((el) => parseFloat(getCachedStyle(el, styleCache).fontSize) || 0)
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
    muted,
    border,
    focus,
  };
  const identity = {
    accent,
    link,
    navLink,
    masthead: masthead || accent,
    nav: nav || accent,
  };
  const provenance = {
    background: promotedSecondary
      ? 'promoted-secondary-surface'
      : primaryBackground
        ? 'primary-background'
        : scoredBackground
          ? 'scored-root'
          : 'fallback',
    backgroundSecondary: sampledSecondary ? 'scored-surface' : 'derived',
    text: sampledText ? 'scored-content' : 'fallback',
    muted: sampledMuted ? 'scored-muted' : 'text-fallback',
    accent: sampledAccent ? 'scored-identity' : 'link-fallback',
    link: sampledLink ? 'scored-link' : 'text-fallback',
    navLink: sampledNavLink ? 'scored-chrome-link' : 'link-fallback',
    border: sampledBorder ? 'scored-control' : 'text-fallback',
    focus: sampledFocus ? 'scored-focus' : 'accent-fallback',
  };
  const directRoleCount = Object.values(provenance).filter(
    (source) => !source.includes('fallback') && source !== 'derived'
  ).length;
  const confidence = directRoleCount >= 6 ? 'high' : directRoleCount >= 3 ? 'medium' : 'low';
  const sampling = {
    confidence,
    weak: confidence === 'low',
    provenance,
    candidateCounts: {
      roots: roots.length,
      headings: headings.length,
      links: links.length,
      chromeLinks: chromeLinks.length,
      identity: headers.length + navs.length,
      surfaces: surfaces.length,
      muted: mutedCandidates.length,
      focus: focusCandidates.length,
    },
  };

  return {
    background,
    backgroundSecondary,
    text,
    accent,
    link,
    navLink,
    border,
    muted,
    focus,
    isDark,
    headerSizeVariance,
    structural,
    identity,
    sampling,
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
 * Preserve hue and saturation while moving lightness only as far as needed to
 * meet the requested contrast. This is applied after all blend modes.
 */
export function ensureReadableColor(foreground, background, minimumRatio = 4.5) {
  if (!foreground || !background || contrastRatio(foreground, background) >= minimumRatio) {
    return foreground;
  }
  const source = hexToHsl(foreground);
  let best = null;
  let bestDistance = Infinity;
  for (let lightness = 0; lightness <= 100; lightness += 1) {
    const candidate = hslToHex({ ...source, l: lightness });
    if (contrastRatio(candidate, background) < minimumRatio) continue;
    const distance = Math.abs(lightness - source.l);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  if (best) return best;
  return contrastRatio('#ffffff', background) >= contrastRatio('#000000', background)
    ? '#ffffff'
    : '#000000';
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
    navLink: pageSample.navLink,
  };

  const background = mixHex(themePalette.background, structural.background || pageSample.background);
  let text = mixHex(themePalette.text, structural.text || pageSample.text);
  const border = mixHex(themePalette.border, structural.border || pageSample.border);

  let accent;
  let link;
  let navLink;
  let masthead;
  let nav;
  const themeNavLink = themePalette.navLink || themePalette.link;
  const pageNavLink = identity.navLink || pageSample.navLink;
  if (mode === 'preserve') {
    accent = identity.accent || pageSample.accent || themePalette.accent;
    link = identity.link || pageSample.link || themePalette.link;
    navLink = pageNavLink || link || themeNavLink;
    masthead = identity.masthead || accent;
    nav = identity.nav || accent;
  } else if (mode === 'harmonize') {
    const pageAccent = identity.accent || pageSample.accent;
    const pageLink = identity.link || pageSample.link;
    const pageMasthead = identity.masthead || pageAccent;
    const pageNav = identity.nav || pageAccent;
    accent = pageAccent
      ? harmonizeHue(pageAccent, themePalette.accent)
      : themePalette.accent;
    link = pageLink ? harmonizeHue(pageLink, themePalette.link) : themePalette.link;
    navLink = pageNavLink
      ? harmonizeHue(pageNavLink, themeNavLink)
      : pageLink
        ? harmonizeHue(pageLink, themeNavLink)
        : themeNavLink;
    masthead = pageMasthead ? harmonizeHue(pageMasthead, themePalette.accent) : accent;
    nav = pageNav ? harmonizeHue(pageNav, themePalette.accent) : accent;
  } else {
    accent = mixHex(themePalette.accent, pageSample.accent);
    link = mixHex(themePalette.link, pageSample.link);
    navLink = mixHex(themeNavLink, pageNavLink || pageSample.link);
    masthead = mixHex(themePalette.accent, identity.masthead || pageSample.accent);
    nav = mixHex(themePalette.accent, identity.nav || pageSample.accent);
  }

  const isDark = luminance(background) < 50;
  const backgroundSecondary = mixHex(
    themePalette.backgroundSecondary || deriveSurface(themePalette.background, themePalette.isDark),
    structural.backgroundSecondary || pageSample.backgroundSecondary
  );
  // Surfaces follow the blended background ladder so elevated layers stay
  // consistent when intensity moves the primary canvas.
  const bg = backgroundSecondary || background;
  const derivedGui = deriveSurface(bg, isDark);
  const derivedContainers = deriveSurface(derivedGui, isDark);
  const surfaceLadder = deriveSurfaceLadder(background, isDark, 3);
  let muted = mixHex(themePalette.muted, structural.muted || pageSample.muted);
  let focus = mixHex(themePalette.focus, structural.focus || pageSample.focus);

  // Complete generated palettes carry all readable foreground tokens. Keep
  // accepting partial palettes used by API consumers without rewriting their
  // explicitly preserved identity values.
  const hasReadableTokenSet = Boolean(themePalette.muted && themePalette.focus);
  if (hasReadableTokenSet) {
    text = ensureReadableColor(text, background, 4.5);
    muted = ensureReadableColor(muted || text, background, 4.5);
    accent = ensureReadableColor(accent, background, 4.5);
    link = ensureReadableColor(link, background, 4.5);
    navLink = ensureReadableColor(navLink || link, background, 4.5);
    focus = ensureReadableColor(focus || accent, derivedGui, 3);
  }
  const brandFamily = deriveBrandFamily(accent, isDark);
  const linkFamily = deriveBrandFamily(link, isDark);
  const navLinkFamily = deriveBrandFamily(navLink || link, isDark);

  return {
    background,
    backgroundSecondary: backgroundSecondary || deriveSurface(background, isDark),
    surface: derivedGui,
    surfaceGui: derivedGui,
    surfaceContainers: derivedContainers,
    surfaceLadder,
    text,
    muted,
    accent,
    link,
    linkHover: linkFamily.hover,
    linkActive: linkFamily.active,
    navLink: navLink || link,
    navLinkHover: navLinkFamily.hover,
    navLinkActive: navLinkFamily.active,
    masthead,
    nav,
    border,
    focus,
    isDark,
    headerSizeVariance: pageSample.headerSizeVariance ?? 0.35,
    brandFamily,
    identityMode: mode,
  };
}
