// Most sites set hero/card background images via an external stylesheet
// class (`.hero { background-image: url(...) }`), not an inline `style`
// attribute — so the CSS-only `[style*="background-image"]` selector in
// style-injector.js misses them entirely. This does the one bit of actual
// DOM inspection gMixer needs: walk elements, ask getComputedStyle for the
// *resolved* background-image, and stamp a data attribute on matches so
// the CSS selector can reach them too. Only runs when the image filter is
// enabled with a scope that cares about backgrounds — most installs never
// pay this cost. Tag by computed style, not by hostname.
import { BACKGROUND_IMAGE_ATTR } from './style-injector.js';
import { MAX_BACKGROUND_IMAGE_SCAN } from './scan-limits.js';

export const BACKGROUND_IMAGE_OVERLAY_CLASS = 'gmixer-bgimg-overlay';

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

/** Remove background-image overlays and their marker attributes. */
export function removeBackgroundImageOverlays() {
  document.querySelectorAll(`.${BACKGROUND_IMAGE_OVERLAY_CLASS}`).forEach((overlay) => overlay.remove());
  document.querySelectorAll(`[${BACKGROUND_IMAGE_ATTR}]`).forEach((element) => {
    element.removeAttribute(BACKGROUND_IMAGE_ATTR);
  });
}
