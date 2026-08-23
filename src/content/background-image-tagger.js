// Most sites set hero/card background images via an external stylesheet
// class (`.hero { background-image: url(...) }`), not an inline `style`
// attribute — so the CSS-only `[style*="background-image"]` selector in
// style-injector.js misses them entirely. This does the one bit of actual
// DOM inspection gMixer needs: walk elements, ask getComputedStyle for the
// *resolved* background-image, and stamp a data attribute on matches so
// the CSS selector can reach them too. Only runs when the image filter is
// enabled with a scope that cares about backgrounds — most installs never
// pay this cost.
import { BACKGROUND_IMAGE_ATTR } from './style-injector.js';

// Bounds the scan so a huge DOM (infinite-scroll feeds, etc.) can't turn
// this into a jank source — same "cheap sampling" philosophy as
// page-sampler.js, just applied to a bigger candidate set since coverage
// (finding every themed hero banner) matters more here than for sampling.
const MAX_SCAN = 3000;
const SKIP_TAGS = new Set(['IMG', 'VIDEO', 'PICTURE', 'SOURCE', 'SCRIPT', 'STYLE', 'NOSCRIPT']);

/**
 * @param {{ enabled: boolean, scope: 'images'|'backgrounds'|'both' }|null|undefined} imageFilter
 */
export function shouldTagBackgroundImages(imageFilter) {
  return !!imageFilter?.enabled && imageFilter.scope !== 'images';
}

/**
 * @param {ParentNode} [root=document.body]
 */
export function tagBackgroundImageElements(root = document.body) {
  if (!root || typeof root.querySelectorAll !== 'function') return;

  const candidates =
    root.nodeType === Node.ELEMENT_NODE && root !== document.body
      ? [root, ...Array.from(root.querySelectorAll('*'))]
      : Array.from(root.querySelectorAll('*'));

  let scanned = 0;
  for (const el of candidates) {
    if (scanned >= MAX_SCAN) break;
    if (SKIP_TAGS.has(el.tagName) || el.closest('#gmixer-settings')) continue;
    scanned++;

    const bg = getComputedStyle(el).backgroundImage;
    const hasImage = !!bg && bg !== 'none' && bg.includes('url(');
    if (hasImage) {
      if (!el.hasAttribute(BACKGROUND_IMAGE_ATTR)) el.setAttribute(BACKGROUND_IMAGE_ATTR, '');
    } else if (el.hasAttribute(BACKGROUND_IMAGE_ATTR)) {
      el.removeAttribute(BACKGROUND_IMAGE_ATTR);
    }
  }
}
