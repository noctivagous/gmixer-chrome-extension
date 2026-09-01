// Snapshot of live palette tokens, classifier stamps, and texture-catalog
// surfaces as actually painted on the current document.

import {
  MEDIA_ATTR,
  NATIVE_L_ATTR,
  OVERLAY_ATTR,
  ROLE_ATTR,
  TONE_STEP_ATTR,
} from '../content/page-classifier.js';
import { collectOpenShadowRoots, isGmixerUiElement } from '../content/open-trees.js';
import { parseCssColor } from '../content/page-sampler.js';
import { TEXTURE_SURFACES } from '../config/texture-catalog.js';
import { TEXTURE_PAGE_TARGETS } from '../lib/texture-page-css.js';
import { PREVIEW_COLOR_ROLES } from '../popup/components/preview-inspect.js';

const SAMPLE_CAP = 8;
const ROLE_SCAN_CAP = 400;
const TEXTURE_SCAN_CAP = 80;

/** CSS custom properties emitted by style-injector, in inspector order. */
export const PALETTE_CSS_VARS = [
  { id: 'background', cssVar: '--gmixer-bg-primary', label: 'BG:Primary · root' },
  { id: 'backgroundSecondary', cssVar: '--gmixer-bg-secondary', label: 'BG:Secondary · sheet' },
  { id: 'canvas', cssVar: '--gmixer-bg', label: 'Canvas (--gmixer-bg)' },
  { id: 'surfaceGui', cssVar: '--gmixer-surface-gui', label: 'Surface: GUI' },
  { id: 'surfaceContainers', cssVar: '--gmixer-surface-containers', label: 'Surface: Containers' },
  { id: 'surface0', cssVar: '--gmixer-surface-0', label: 'Ladder 0' },
  { id: 'surface1', cssVar: '--gmixer-surface-1', label: 'Ladder 1' },
  { id: 'surface2', cssVar: '--gmixer-surface-2', label: 'Ladder 2' },
  { id: 'text', cssVar: '--gmixer-text', label: 'Text' },
  { id: 'muted', cssVar: '--gmixer-muted', label: 'Muted' },
  { id: 'accent', cssVar: '--gmixer-accent', label: 'Accent' },
  { id: 'link', cssVar: '--gmixer-link', label: 'Link' },
  { id: 'linkHover', cssVar: '--gmixer-link-hover', label: 'Link hover' },
  { id: 'navLink', cssVar: '--gmixer-nav-link', label: 'Nav link' },
  { id: 'navLinkHover', cssVar: '--gmixer-nav-link-hover', label: 'Nav hover' },
  { id: 'border', cssVar: '--gmixer-border', label: 'Border' },
  { id: 'focus', cssVar: '--gmixer-focus', label: 'Focus' },
  { id: 'masthead', cssVar: '--gmixer-masthead', label: 'Masthead' },
  { id: 'nav', cssVar: '--gmixer-nav', label: 'Nav fill' },
  { id: 'guiButton', cssVar: '--gmixer-gui-button', label: 'Surface:GUI:Button' },
  { id: 'guiInput', cssVar: '--gmixer-gui-input', label: 'Surface:GUI:Input' },
  { id: 'guiTextarea', cssVar: '--gmixer-gui-textarea', label: 'Surface:GUI:TextArea' },
  { id: 'guiSlider', cssVar: '--gmixer-gui-slider', label: 'Surface:GUI:Slider' },
  { id: 'headingLarge', cssVar: '--gmixer-heading-large', label: 'Accent:Heading-Large' },
  { id: 'headingMedium', cssVar: '--gmixer-heading-medium', label: 'Accent:Heading-Medium' },
  { id: 'headingSmall', cssVar: '--gmixer-heading-small', label: 'Accent:Heading-Small' },
  { id: 'linkBare', cssVar: '--gmixer-link-bare', label: 'Link:Bare' },
  { id: 'linkArticle', cssVar: '--gmixer-link-article', label: 'Link:Article' },
  { id: 'mutedKicker', cssVar: '--gmixer-muted-kicker', label: 'Muted:Caption-Kicker' },
  { id: 'mutedPhotoCaption', cssVar: '--gmixer-muted-photo-caption', label: 'Muted:Photo-Caption' },
  { id: 'mutedAsideNotes', cssVar: '--gmixer-muted-aside-notes', label: 'Muted:Asides-Notes' },
];

const ROLE_LABELS = {
  ...Object.fromEntries(PREVIEW_COLOR_ROLES.map((role) => [role.id, role.label])),
  main: 'Main',
  article: 'Article',
  'article-body': 'Article body',
  card: 'Card',
  surface: 'Surface',
  sidebar: 'Sidebar',
  hero: 'Hero',
  header: 'Header',
  footer: 'Footer',
  navigation: 'Navigation',
  ad: 'Ad',
};

/**
 * @param {ParentNode|null|undefined} root
 * @param {string} selector
 * @param {number} [cap]
 * @returns {Element[]}
 */
function queryAllDeep(root, selector, cap = ROLE_SCAN_CAP) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  /** @type {Element[]} */
  const out = [];
  const push = (node) => {
    if (!node || isGmixerUiElement(node) || out.length >= cap) return;
    out.push(node);
  };
  try {
    for (const el of root.querySelectorAll(selector)) {
      push(el);
      if (out.length >= cap) return out;
    }
  } catch {
    return out;
  }
  for (const sr of collectOpenShadowRoots(root)) {
    try {
      for (const el of sr.querySelectorAll(selector)) {
        push(el);
        if (out.length >= cap) return out;
      }
    } catch {
      // Selector may not be valid inside a given tree.
    }
  }
  return out;
}

/**
 * @param {string|null|undefined} cssValue
 * @param {string|null} [backdrop]
 * @returns {string|null}
 */
function toHex(cssValue, backdrop = null) {
  if (!cssValue) return null;
  const trimmed = cssValue.trim();
  if (!trimmed || trimmed === 'transparent') return null;
  return parseCssColor(trimmed, backdrop);
}

/**
 * @param {CSSStyleDeclaration|null|undefined} style
 * @param {string} name
 */
function readVar(style, name) {
  if (!style || typeof style.getPropertyValue !== 'function') return '';
  return style.getPropertyValue(name).trim();
}

/**
 * @param {Record<string, number>} counts
 * @param {string|null} key
 */
function bump(counts, key) {
  if (!key) return;
  counts[key] = (counts[key] || 0) + 1;
}

/**
 * @param {Record<string, number>} counts
 * @returns {{ hex: string, count: number }[]}
 */
function rankedHexes(counts) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([hex, count]) => ({ hex, count }));
}

/**
 * @param {Element} el
 * @param {typeof globalThis} win
 */
function readPaint(el, win) {
  const getStyle =
    win.getComputedStyle ||
    (typeof globalThis.getComputedStyle === 'function' ? globalThis.getComputedStyle : null);
  if (typeof getStyle !== 'function') {
    return { fill: null, ink: null, fillRaw: '', inkRaw: '' };
  }
  const style = getStyle(el);
  const fillRaw = style?.backgroundColor || '';
  const inkRaw = style?.color || '';
  return {
    fill: toHex(fillRaw),
    ink: toHex(inkRaw),
    fillRaw,
    inkRaw,
  };
}

/**
 * @param {Element} el
 */
function shortSelector(el) {
  const tag = (el.tagName || '').toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const className =
    typeof el.className === 'string'
      ? el.className
      : typeof el.getAttribute === 'function'
        ? el.getAttribute('class') || ''
        : '';
  const cls = className
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((token) => `.${token}`)
    .join('');
  return `${tag}${id}${cls}`.slice(0, 80);
}

/**
 * @param {Document|null} doc
 * @param {typeof globalThis} win
 */
function collectPalette(doc, win) {
  const root = doc?.documentElement;
  const getStyle =
    win.getComputedStyle ||
    (typeof globalThis.getComputedStyle === 'function' ? globalThis.getComputedStyle : null);
  const style = root && typeof getStyle === 'function' ? getStyle(root) : null;
  const tokens = PALETTE_CSS_VARS.map((entry) => {
    const raw = readVar(style, entry.cssVar);
    const hex = toHex(raw) || (raw.startsWith('#') ? raw : null);
    return {
      ...entry,
      raw: raw || null,
      hex,
    };
  });

  const htmlPaint = root ? readPaint(root, win) : { fill: null, ink: null };
  const bodyPaint = doc?.body ? readPaint(doc.body, win) : { fill: null, ink: null };

  const hexById = Object.fromEntries(tokens.map((token) => [token.id, token.hex]));
  /** @type {string[]} */
  const collapses = [];
  if (hexById.background && hexById.backgroundSecondary === hexById.background) {
    collapses.push('BG:Primary and BG:Secondary resolve to the same color');
  }
  if (hexById.backgroundSecondary && hexById.surfaceGui === hexById.backgroundSecondary) {
    collapses.push('Surface:GUI and BG:Secondary resolve to the same color');
  }
  if (hexById.surfaceGui && hexById.surfaceContainers === hexById.surfaceGui) {
    collapses.push('Surface:Containers and Surface:GUI resolve to the same color');
  }

  return {
    tokens,
    htmlFill: htmlPaint.fill,
    bodyFill: bodyPaint.fill,
    bodyInk: bodyPaint.ink,
    collapses,
  };
}

/**
 * @param {Document|null} doc
 * @param {typeof globalThis} win
 */
function collectClassified(doc, win) {
  const nodes = queryAllDeep(doc, `[${ROLE_ATTR}]`);
  /** @type {Map<string, {
   *   role: string,
   *   count: number,
   *   fills: Record<string, number>,
   *   inks: Record<string, number>,
   *   toneSteps: Record<string, number>,
   *   samples: object[],
   * }>} */
  const byRole = new Map();

  for (const el of nodes) {
    const role = el.getAttribute?.(ROLE_ATTR) || '(empty)';
    let group = byRole.get(role);
    if (!group) {
      group = { role, count: 0, fills: {}, inks: {}, toneSteps: {}, samples: [] };
      byRole.set(role, group);
    }
    group.count += 1;
    const paint = readPaint(el, win);
    bump(group.fills, paint.fill);
    bump(group.inks, paint.ink);
    const step = el.getAttribute?.(TONE_STEP_ATTR);
    if (step != null && step !== '') bump(group.toneSteps, step);
    if (group.samples.length < SAMPLE_CAP) {
      group.samples.push({
        selector: shortSelector(el),
        fill: paint.fill,
        ink: paint.ink,
        toneStep: step,
        nativeL: el.getAttribute?.(NATIVE_L_ATTR),
        overlay: el.hasAttribute?.(OVERLAY_ATTR) || false,
        media: el.getAttribute?.(MEDIA_ATTR),
      });
    }
  }

  return [...byRole.values()]
    .sort((a, b) => b.count - a.count || a.role.localeCompare(b.role))
    .map((group) => ({
      role: group.role,
      label: ROLE_LABELS[group.role] || group.role,
      count: group.count,
      fills: rankedHexes(group.fills),
      inks: rankedHexes(group.inks),
      toneSteps: group.toneSteps,
      samples: group.samples,
    }));
}

/**
 * @param {Document|null} doc
 * @param {typeof globalThis} win
 */
function collectTextureSurfaces(doc, win) {
  return TEXTURE_SURFACES.map((surface) => {
    const target = TEXTURE_PAGE_TARGETS[surface.id];
    const selectors = target?.selectors || '';
    const nodes = selectors ? queryAllDeep(doc, selectors, TEXTURE_SCAN_CAP) : [];
    /** @type {Record<string, number>} */
    const fills = {};
    /** @type {Record<string, number>} */
    const inks = {};
    const family = target?.family || surface.family;
    const sample = nodes[0] ? readPaint(nodes[0], win) : { fill: null, ink: null };
    for (const el of nodes) {
      const paint = readPaint(el, win);
      if (family === 'text') bump(inks, paint.ink);
      else bump(fills, paint.fill);
      bump(inks, paint.ink);
    }
    return {
      id: surface.id,
      label: surface.label,
      group: surface.group,
      family,
      inUi: surface.inUi,
      matchCount: nodes.length,
      fills: rankedHexes(fills),
      inks: rankedHexes(inks),
      sampleFill: sample.fill,
      sampleInk: sample.ink,
      sampleSelector: nodes[0] ? shortSelector(nodes[0]) : null,
    };
  });
}

/**
 * @param {Document|null} [doc]
 * @param {typeof globalThis} [win]
 */
export function collectLiveSurfaces(
  doc = typeof document !== 'undefined' ? document : null,
  win = typeof window !== 'undefined' ? window : globalThis
) {
  const palette = collectPalette(doc, win);
  const classified = collectClassified(doc, win);
  const texture = collectTextureSurfaces(doc, win);
  return {
    href: typeof win.location !== 'undefined' ? win.location.href : '',
    hostname: typeof win.location !== 'undefined' ? win.location.hostname : '',
    classifiedCount: classified.reduce((sum, group) => sum + group.count, 0),
    palette,
    classified,
    texture,
  };
}
