// Most sites set hero/card background images via an external stylesheet
// class (`.hero { background-image: url(...) }`), not an inline `style`
// attribute — so the CSS-only `[style*="background-image"]` selector in
// style-injector.js misses them entirely. This does the one bit of actual
// DOM inspection gMixer needs: walk elements, ask getComputedStyle for the
// *resolved* background-image, and stamp a data attribute on matches so
// the CSS selector can reach them too. Only runs when the image filter is
// enabled with a scope that cares about backgrounds — most installs never
// pay this cost. Tag by computed style, not by hostname.
import { BACKGROUND_IMAGE_ATTR, GHOST_PAINT_ATTR } from './style-injector.js';
import { MAX_BACKGROUND_IMAGE_SCAN } from './scan-limits.js';

export const BACKGROUND_IMAGE_OVERLAY_CLASS = 'gmixer-bgimg-overlay';

/** Media roles chromed via CSS `filter:` on the paint host (not bg overlay). */
const FILTER_PAINT_MEDIA = new Set([
  'avatar',
  'cover-image',
  'article-image',
  'video-thumbnail',
]);

// Bounds the scan so a huge DOM (infinite-scroll feeds, etc.) can't turn
// this into a jank source — same "cheap sampling" philosophy as
// page-sampler.js, just applied to a bigger candidate set since coverage
// (finding every themed hero banner) matters more here than for sampling.
const MAX_SCAN = MAX_BACKGROUND_IMAGE_SCAN;
const SKIP_TAGS = new Set([
  'IMG',
  'VIDEO',
  'PICTURE',
  'SOURCE',
  'SCRIPT',
  'STYLE',
  'NOSCRIPT',
  'BR',
  'WBR',
  'HR',
  'PATH',
  'SVG',
  'CANVAS',
]);
const SKIP_PHRASING = new Set([
  'A',
  'ABBR',
  'B',
  'EM',
  'I',
  'LABEL',
  'SMALL',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'TIME',
  'U',
]);

/**
 * Nav/header wordmarks and icon sprites (Breitbart “Fight Club”, premium badges)
 * use CSS `background-image` like photos, but chroming overlays make them look
 * highlighted. Skip those; keep real hero/card photo sheets.
 *
 * @param {Element} el
 * @param {CSSStyleDeclaration} [style]
 * @returns {boolean}
 */
export function isDecorativeChromeBackground(el, style) {
  if (!el || el.nodeType !== 1) return false;
  if (typeof el.getBoundingClientRect !== 'function') return false;
  const rect = el.getBoundingClientRect();
  const w = rect.width || 0;
  const h = rect.height || 0;
  // Hidden duplicates (dropdown clones) and tiny badges.
  if (w < 1 || h < 1) return true;
  if (w <= 280 && h <= 72) return true;
  if (w * h < 16000 && h <= 96) return true;

  const resolved =
    style || (typeof getComputedStyle === 'function' ? getComputedStyle(el) : null);
  const size = resolved?.backgroundSize || '';
  const px = size.match(/^(\d+(?:\.\d+)?)px\b/i);
  if (px && Number(px[1]) <= 48) return true;
  return false;
}

/**
 * Walk elements under `root` without materializing the full `querySelectorAll('*')`
 * NodeList on huge injected subtrees. Stops after `max` nodes.
 * @param {ParentNode} root
 * @param {number} max
 * @returns {Generator<Element>}
 */
function* walkElements(root, max) {
  let count = 0;
  const includeRoot = root.nodeType === Node.ELEMENT_NODE && root !== document.body;
  if (includeRoot) {
    yield /** @type {Element} */ (root);
    count += 1;
    if (count >= max) return;
  }

  if (typeof document !== 'undefined' && typeof document.createTreeWalker === 'function') {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let node = walker.nextNode();
    while (node && count < max) {
      yield /** @type {Element} */ (node);
      count += 1;
      node = walker.nextNode();
    }
    return;
  }

  const fallback =
    includeRoot
      ? [/** @type {Element} */ (root), ...Array.from(root.querySelectorAll('*'))]
      : Array.from(root.querySelectorAll('*'));
  for (const el of fallback) {
    if (count >= max) return;
    yield el;
    count += 1;
  }
}

/**
 * @param {{ enabled: boolean, scope: 'images'|'backgrounds'|'both' }|null|undefined} imageFilter
 * @param {Record<string, { filter?: string }>|null|undefined} [mediaStyles]
 * @param {{ colorOn?: boolean }} [options]
 *   When color restyle clears surface gradients, tag url() hosts so they are
 *   excluded from `background-image: none` even if no image filter overlay runs.
 */
export function shouldTagBackgroundImages(imageFilter, mediaStyles = {}, options = {}) {
  if (options.colorOn) return true;
  const cats = imageFilter?.categories;
  const globalFilterApplies =
    !!imageFilter?.enabled &&
    (cats
      ? cats.bgImages && cats.bgImages !== 'none'
      : imageFilter.scope !== 'images');
  const categoryFilterApplies = Object.values(mediaStyles || {}).some(
    (style) => style?.filter && !['auto', 'none', 'original'].includes(style.filter)
  );
  return globalFilterApplies || categoryFilterApplies;
}

/**
 * @param {ParentNode} [root=document.body]
 * @param {{ createOverlays?: boolean }} [options]
 *   Overlays are only needed when an image filter blends over the photo.
 *   Color-only tagging stamps the attr so solid surface paint skips url() hosts.
 */
export function tagBackgroundImageElements(root = document.body, options = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const createOverlays = options.createOverlays !== false;

  /** @type {Element[]} */
  const toTag = [];
  /** @type {Element[]} */
  const toUntag = [];
  let scanned = 0;
  for (const el of walkElements(root, MAX_SCAN)) {
    if (scanned >= MAX_SCAN) break;
    if (
      SKIP_TAGS.has(el.tagName) ||
      SKIP_PHRASING.has(el.tagName) ||
      el.classList?.contains(BACKGROUND_IMAGE_OVERLAY_CLASS) ||
      el.closest('#gmixer-settings')
    ) {
      continue;
    }
    scanned++;

    const style = getComputedStyle(el);
    if (isDecorativeChromeBackground(el, style)) {
      if (el.hasAttribute(BACKGROUND_IMAGE_ATTR)) toUntag.push(el);
      continue;
    }

    // Already tagged from a prior pass: skip re-checking url(). Incremental
    // mutations must not re-read the whole tree — decorative check above still
    // runs so chrome sprites can be cleared after a heuristic tighten.
    if (el.hasAttribute(BACKGROUND_IMAGE_ATTR)) {
      if (createOverlays && !el.querySelector(`:scope > .${BACKGROUND_IMAGE_OVERLAY_CLASS}`)) {
        toTag.push(el);
      }
      continue;
    }

    const bg = style.backgroundImage;
    const hasImage = !!bg && bg !== 'none' && bg.includes('url(');
    if (hasImage) toTag.push(el);
    else if (el.hasAttribute(BACKGROUND_IMAGE_ATTR)) toUntag.push(el);
  }

  for (const el of toTag) {
    if (!el.hasAttribute(BACKGROUND_IMAGE_ATTR)) el.setAttribute(BACKGROUND_IMAGE_ATTR, '');
    if (createOverlays && !el.querySelector(`:scope > .${BACKGROUND_IMAGE_OVERLAY_CLASS}`)) {
      const overlay = document.createElement('span');
      overlay.className = BACKGROUND_IMAGE_OVERLAY_CLASS;
      overlay.setAttribute('aria-hidden', 'true');
      el.prepend(overlay);
    }
  }
  for (const el of toUntag) {
    el.removeAttribute(BACKGROUND_IMAGE_ATTR);
    el.querySelector(`:scope > .${BACKGROUND_IMAGE_OVERLAY_CLASS}`)?.remove();
  }
}

/**
 * Sites like X.com hide the real <img> (opacity:0) and paint the photo on a
 * same-size sibling/parent via `background-image`. Filtering the invisible img
 * does nothing; chrome the visible paint host instead.
 *
 * - Stamped cover/avatar/article → copy media role so category `filter:` applies
 * - Unclassified imgs → keep bgImages overlay when present; otherwise mark
 *   `data-gmixer-ghost-paint` so the Images category can filter the host
 * - Drop overlay when switching to a filter-based path so effects do not stack
 *
 * @param {ParentNode} [root=document.body]
 * @param {{ preferFilterForUnclassified?: boolean, createOverlays?: boolean }} [options]
 */
export function tagGhostMediaBackgroundHosts(root = document.body, options = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  if (typeof getComputedStyle !== 'function') return;
  const preferFilterForUnclassified = options.preferFilterForUnclassified === true;
  const createOverlays = options.createOverlays === true;

  const imgs = root.querySelectorAll('img');
  for (const img of imgs) {
    if (img.closest?.('#gmixer-settings')) continue;
    const imgStyle = getComputedStyle(img);
    if (Number.parseFloat(imgStyle.opacity || '1') > 0.05) continue;
    if (imgStyle.visibility === 'hidden' || imgStyle.display === 'none') continue;

    const host = findMatchingBackgroundPaintHost(img);
    if (!host) continue;

    if (!host.hasAttribute(BACKGROUND_IMAGE_ATTR)) {
      host.setAttribute(BACKGROUND_IMAGE_ATTR, '');
    }

    const media = img.getAttribute('data-gmixer-media');
    if (media && FILTER_PAINT_MEDIA.has(media)) {
      const hostMedia = host.getAttribute('data-gmixer-media');
      if (!hostMedia || hostMedia === 'background-image') {
        host.setAttribute('data-gmixer-media', media);
      }
      host.removeAttribute(GHOST_PAINT_ATTR);
      host.querySelector(`:scope > .${BACKGROUND_IMAGE_OVERLAY_CLASS}`)?.remove();
      continue;
    }

    if (preferFilterForUnclassified) {
      host.setAttribute(GHOST_PAINT_ATTR, '');
      host.querySelector(`:scope > .${BACKGROUND_IMAGE_OVERLAY_CLASS}`)?.remove();
      continue;
    }

    // bgImages overlay path: ensure the paint host is tagged (decorative
    // heuristics may have skipped small-but-real photo siblings).
    host.removeAttribute(GHOST_PAINT_ATTR);
    if (
      createOverlays &&
      !host.querySelector(`:scope > .${BACKGROUND_IMAGE_OVERLAY_CLASS}`)
    ) {
      const overlay = document.createElement('span');
      overlay.className = BACKGROUND_IMAGE_OVERLAY_CLASS;
      overlay.setAttribute('aria-hidden', 'true');
      host.prepend(overlay);
    }
  }
}

/**
 * @param {HTMLImageElement} img
 * @returns {Element|null}
 */
function findMatchingBackgroundPaintHost(img) {
  const parent = img.parentElement;
  if (!parent) return null;
  const imgRect = img.getBoundingClientRect();
  if (imgRect.width < 8 || imgRect.height < 8) return null;

  const src = img.currentSrc || img.getAttribute('src') || '';
  let srcNeedle = '';
  try {
    const path = new URL(src, typeof location !== 'undefined' ? location.href : undefined).pathname;
    srcNeedle = path.split('/').filter(Boolean).pop() || '';
  } catch {
    srcNeedle = String(src).split('/').pop()?.split('?')[0] || '';
  }

  /** @type {Element[]} */
  const candidates = [];
  for (const child of parent.children) {
    if (child === img) continue;
    if (child.classList?.contains(BACKGROUND_IMAGE_OVERLAY_CLASS)) continue;
    candidates.push(child);
  }
  candidates.push(parent);

  let best = null;
  let bestScore = -1;
  for (const el of candidates) {
    if (SKIP_TAGS.has(el.tagName) || SKIP_PHRASING.has(el.tagName)) continue;
    const style = getComputedStyle(el);
    const bg = style.backgroundImage || '';
    if (!bg || bg === 'none' || !bg.includes('url(')) continue;

    const rect = el.getBoundingClientRect();
    if (rect.width < 8 || rect.height < 8) continue;
    const maxDw = Math.max(8, imgRect.width * 0.08);
    const maxDh = Math.max(8, imgRect.height * 0.08);
    const dw = Math.abs(rect.width - imgRect.width);
    const dh = Math.abs(rect.height - imgRect.height);
    if (dw > maxDw || dh > maxDh) continue;

    let score = 10 - (dw + dh) / 10;
    if (srcNeedle && bg.includes(srcNeedle)) score += 50;
    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }
  return best;
}

/** Remove background-image overlays and their marker attributes. */
export function removeBackgroundImageOverlays() {
  document.querySelectorAll(`.${BACKGROUND_IMAGE_OVERLAY_CLASS}`).forEach((overlay) => overlay.remove());
  document.querySelectorAll(`[${BACKGROUND_IMAGE_ATTR}]`).forEach((element) => {
    element.removeAttribute(BACKGROUND_IMAGE_ATTR);
    element.removeAttribute(GHOST_PAINT_ATTR);
  });
}
