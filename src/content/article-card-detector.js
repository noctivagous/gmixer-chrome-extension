/**
 * Viewport article/teaser card detection for Effects → link-shimmer.
 *
 * Adapted from KeyPilot media+text card heuristics (size + media + text),
 * but used as a document scan rather than hover resolve.
 */

export const LINK_SHIMMER_ATTR = 'data-gmixer-link-shimmer';

const MAX_SHELLS = 80;
const MAX_LINKS_PER_SHELL = 12;
const MIN_TEXT_LEN = 8;
const MIN_MEDIA_PX = 40;

const CHROME_SKIP = new Set(['HEADER', 'NAV', 'FOOTER']);

/**
 * @typedef {{ link: Element, media: Element|null, shell: Element }} ArticleCardPair
 */

/**
 * @param {Element} el
 * @returns {boolean}
 */
export function isInChromeAncestor(el) {
  let node = el;
  while (node && node.nodeType === 1) {
    if (CHROME_SKIP.has(node.tagName)) return true;
    const role = (node.getAttribute?.('role') || '').toLowerCase();
    if (role === 'banner' || role === 'navigation' || role === 'contentinfo') return true;
    node = node.parentElement;
  }
  return false;
}

/**
 * @param {DOMRectReadOnly|{width:number,height:number,top?:number,left?:number,bottom?:number,right?:number}} box
 * @param {{ innerWidth?: number, innerHeight?: number }} [viewport]
 */
export function isCardSizedBox(box, viewport = typeof window !== 'undefined' ? window : {}) {
  if (!box || box.width < 160 || box.height < 140) return false;
  if (box.width > 920 || box.height > 780) return false;
  const vw = viewport.innerWidth || 0;
  if (vw > 0 && box.width > vw * 0.72 && box.height > 420) return false;
  return true;
}

/**
 * True when any part of `box` intersects the visible viewport rect (no pad).
 * @param {DOMRectReadOnly|{top:number,bottom:number,left:number,right:number,width:number,height:number}} box
 * @param {{ innerWidth?: number, innerHeight?: number }} [viewport]
 */
export function intersectsViewport(box, viewport = typeof window !== 'undefined' ? window : {}) {
  if (!box || box.width <= 0 || box.height <= 0) return false;
  const vw = viewport.innerWidth || 0;
  const vh = viewport.innerHeight || 0;
  if (vw <= 0 || vh <= 0) return true;
  return !(box.bottom <= 0 || box.top >= vh || box.right <= 0 || box.left >= vw);
}

/**
 * @param {Element} el
 * @param {{ innerWidth?: number, innerHeight?: number }} [viewport]
 */
export function elementInViewport(el, viewport = typeof window !== 'undefined' ? window : {}) {
  if (!el) return false;
  try {
    return intersectsViewport(el.getBoundingClientRect(), viewport);
  } catch {
    return false;
  }
}

/**
 * @param {Element} el
 */
export function normalizedText(el) {
  try {
    return String(el.innerText || el.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return '';
  }
}

/**
 * @param {Element} el
 * @returns {boolean}
 */
export function hasDescendantMedia(el) {
  if (!el || typeof el.querySelectorAll !== 'function') return false;
  try {
    const nodes = el.querySelectorAll('img, picture img, video');
    for (let i = 0; i < nodes.length && i < 36; i += 1) {
      const media = nodes[i];
      let rect = null;
      try {
        rect = media.getBoundingClientRect?.();
      } catch {
        rect = null;
      }
      if (!rect) continue;
      if (rect.width >= MIN_MEDIA_PX && rect.height >= MIN_MEDIA_PX) return true;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * @param {Element} el
 * @param {{ innerWidth?: number, innerHeight?: number }} [viewport]
 */
export function isMediaTextCardShell(el, viewport) {
  if (!el || el.nodeType !== 1) return false;
  if (isInChromeAncestor(el)) return false;
  let box = null;
  try {
    box = el.getBoundingClientRect();
  } catch {
    return false;
  }
  if (!isCardSizedBox(box, viewport)) return false;
  if (!hasDescendantMedia(el)) return false;
  return normalizedText(el).length >= MIN_TEXT_LEN;
}

/**
 * @param {string} href
 */
function isHttpHref(href) {
  if (!href) return false;
  const h = String(href).trim().toLowerCase();
  if (h.startsWith('javascript:') || h.startsWith('mailto:') || h.startsWith('tel:') || h === '#') {
    return false;
  }
  return true;
}

/**
 * @param {Element} shell
 * @returns {Element|null}
 */
export function pickTitleLink(shell) {
  if (!shell) return null;
  if (shell.tagName === 'A' && isHttpHref(shell.getAttribute?.('href') || shell.href)) {
    return shell;
  }
  let links = [];
  try {
    links = Array.from(shell.querySelectorAll('a[href]')).slice(0, MAX_LINKS_PER_SHELL);
  } catch {
    return null;
  }

  let best = null;
  let bestScore = -1;
  for (const link of links) {
    if (isInChromeAncestor(link)) continue;
    const href = link.getAttribute?.('href') || link.href || '';
    if (!isHttpHref(href)) continue;
    const text = normalizedText(link);
    let rect = null;
    try {
      rect = link.getBoundingClientRect();
    } catch {
      rect = null;
    }
    const area = rect ? Math.max(0, rect.width) * Math.max(0, rect.height) : 0;
    // Prefer readable headline links over icon chips.
    if (text.length < MIN_TEXT_LEN && area < 8000) continue;
    const score = text.length * 40 + area;
    if (score > bestScore) {
      bestScore = score;
      best = link;
    }
  }
  return best;
}

/**
 * @param {Element} shell
 * @returns {Element|null}
 */
export function pickCompanionMedia(shell) {
  if (!shell || typeof shell.querySelectorAll !== 'function') return null;
  let nodes = [];
  try {
    nodes = Array.from(shell.querySelectorAll('img, picture img'));
  } catch {
    return null;
  }
  let best = null;
  let bestArea = 0;
  for (let i = 0; i < nodes.length && i < 36; i += 1) {
    const media = nodes[i];
    let rect = null;
    try {
      rect = media.getBoundingClientRect();
    } catch {
      rect = null;
    }
    if (!rect) continue;
    if (rect.width < MIN_MEDIA_PX || rect.height < MIN_MEDIA_PX) continue;
    const area = rect.width * rect.height;
    if (area > bestArea) {
      bestArea = area;
      best = media;
    }
  }
  return best;
}

/**
 * Collect viewport article card pairs (title link + optional companion image).
 *
 * @param {ParentNode} [root]
 * @param {{ innerWidth?: number, innerHeight?: number }} [viewport]
 * @returns {ArticleCardPair[]}
 */
export function collectViewportArticleCards(root = typeof document !== 'undefined' ? document.body : null, viewport) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const vp = viewport || (typeof window !== 'undefined' ? window : {});

  /** @type {ArticleCardPair[]} */
  const pairs = [];
  const seenLinks = new Set();

  // Seed from links, then lift to a card-sized ancestor / self.
  let anchors = [];
  try {
    anchors = Array.from(root.querySelectorAll('a[href], article, [role="article"], .card'));
  } catch {
    return [];
  }

  for (let i = 0; i < anchors.length && pairs.length < MAX_SHELLS; i += 1) {
    const seed = anchors[i];
    if (isInChromeAncestor(seed)) continue;

    /** @type {Element|null} */
    let shell = null;
    if (seed.tagName === 'A') {
      if (isMediaTextCardShell(seed, vp)) {
        shell = seed;
      } else {
        let parent = seed.parentElement;
        let depth = 0;
        while (parent && depth < 6) {
          if (isMediaTextCardShell(parent, vp)) {
            shell = parent;
            break;
          }
          parent = parent.parentElement;
          depth += 1;
        }
      }
    } else if (isMediaTextCardShell(seed, vp)) {
      shell = seed;
    }

    if (!shell) continue;

    // Require the title link itself (not just the shell) to be in the viewport.
    if (!elementInViewport(shell, vp)) continue;

    const link = pickTitleLink(shell);
    if (!link || seenLinks.has(link)) continue;
    if (!elementInViewport(link, vp)) continue;
    seenLinks.add(link);

    pairs.push({
      shell,
      link,
      media: pickCompanionMedia(shell),
    });
  }

  return pairs;
}

/**
 * Advance cycler index with wrap.
 * @param {number} index
 * @param {number} length
 */
export function nextShimmerIndex(index, length) {
  if (!length || length < 1) return 0;
  const next = (Number.isFinite(index) ? index : -1) + 1;
  return ((next % length) + length) % length;
}
