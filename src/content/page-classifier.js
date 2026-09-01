// Adaptive page/media classifiers (document_end only).
//
// document_start must stay a static CSS paint — never import or call this
// from content-start.js. Classification walks the live DOM, stamps semantic
// roles for the restyle engine, and is re-run on newly added subtrees by the
// MutationObserver.
//
// Prefer size/tag/ARIA heuristics over host-specific code. Do not branch on
// hostname when a generic rule can cover the same layout pattern.
//
import { MAX_CLASSIFIER_SCAN } from './scan-limits.js';
import { collectOpenShadowRoots, isGmixerUiElement, isShadowRoot } from './open-trees.js';
import { isDecorativeChromeBackground } from './background-image-tagger.js';

export const ROLE_ATTR = 'data-gmixer-role';
export const MEDIA_ATTR = 'data-gmixer-media';
/** Logo image with sampled (or inferred) alpha; skip box glow. */
export const LOGO_ALPHA_ATTR = 'data-gmixer-alpha';
export const CONFIDENCE_ATTR = 'data-gmixer-confidence';
export const REASONS_ATTR = 'data-gmixer-reasons';
export const OVERLAY_ATTR = 'data-gmixer-overlay';
/** Native relative luminance 0..1 captured while site styles are visible. */
export const NATIVE_L_ATTR = 'data-gmixer-native-l';
/** Ranked tone step 0..N-1 (0 = originally darkest among ranked surfaces). */
export const TONE_STEP_ATTR = 'data-gmixer-tone-step';
/**
 * Soft page-matching gradient wash (e.g. HF from-gray-50-to-white rails).
 * Cleared in CSS so the themed body canvas shows through — not a new surface.
 */
export const CANVAS_WASH_ATTR = 'data-gmixer-canvas-wash';
/**
 * Semi-transparent / backdrop-filter chrome (Opera GX frosted header).
 * Value is native alpha 0..1. CSS keeps the glaze and swaps in theme color.
 */
export const GLAZE_ATTR = 'data-gmixer-glaze';
/**
 * Space-separated `before` / `after` when a generated box is a covering
 * opaque fill (empty content, absolute/fixed, large). CSS restyles those
 * pseudos; icon/content pseudos are left alone.
 */
export const PSEUDO_FILL_ATTR = 'data-gmixer-pseudo-fill';

export const CLASSIFIER_CONFIDENCE_THRESHOLD = 0.7;
export const SURFACE_LADDER_STEPS = 3;

/** Roles that participate in ranked tonal remapping. */
const TONE_RANK_ROLES = new Set([
  'surface',
  'article',
  'article-body',
  'card',
  'sidebar',
  'hero',
  'main',
]);
const CHROME_TONE_RANK_ROLES = new Set(['header', 'navigation']);
const MAX_SCAN = MAX_CLASSIFIER_SCAN;
const classificationCache = new WeakMap();
const analysisDiagnostics = {
  scanCapHits: 0,
  flyoutRejectedHidden: 0,
  flyoutRejectedGeometry: 0,
  flyoutRejectedMediaChrome: 0,
  flyoutRejectedTransparent: 0,
};

export function getAnalysisDiagnostics() {
  return { ...analysisDiagnostics };
}

const STRUCTURAL_RULES = [
  { role: 'main', tags: ['MAIN'], aria: ['main'], tokens: ['main', 'content'] },
  { role: 'article', tags: ['ARTICLE'], aria: ['article'], tokens: ['article', 'story', 'post'] },
  { role: 'sidebar', tags: ['ASIDE'], aria: ['complementary'], tokens: ['sidebar', 'rail'] },
  { role: 'navigation', tags: ['NAV'], aria: ['navigation'], tokens: ['nav', 'menu'] },
  { role: 'header', tags: ['HEADER'], aria: ['banner'], tokens: ['header', 'masthead'] },
  { role: 'footer', tags: ['FOOTER'], aria: ['contentinfo'], tokens: ['footer'] },
  { role: 'hero', tags: [], aria: [], tokens: ['hero', 'jumbotron', 'masthead', 'feature'] },
  {
    role: 'card',
    tags: [],
    aria: ['group'],
    tokens: ['card', 'tile', 'teaser', 'portlet'],
  },
  {
    role: 'article-body',
    tags: [],
    aria: [],
    tokens: ['article-body', 'entry-content', 'post-content', 'prose'],
  },
];

/**
 * Hosts whose opaque descendants may be promoted to `surface`. Nested painted
 * slabs (story meta strips, preview bodies, listing cells) often keep the
 * site's light/dark fills after the host is restyled — promotion stamps them
 * so CSS can paint Surface:Containers without site-specific selectors.
 *
 * Header/nav chrome are excluded: horizontal menus often use opaque item
 * wrappers that share the parent fill on the live page; promoting them creates
 * darker spaced blocks (e.g. Opera GX masthead).
 */
const SURFACE_HOST_ROLES = new Set([
  'article',
  'article-body',
  'main',
  'card',
  'sidebar',
  'hero',
  'surface',
]);

/** Nested hosts that should run their own promote pass — do not walk into them. */
const SURFACE_WALK_STOP_ROLES = new Set([
  ...SURFACE_HOST_ROLES,
  'header',
  'navigation',
]);

const SURFACE_HOST_PRIORITY = {
  article: 0,
  'article-body': 1,
  card: 2,
  hero: 3,
  sidebar: 4,
  main: 5,
  surface: 6,
};

const SURFACE_SKIP_TAGS = new Set([
  'A',
  'BUTTON',
  'CANVAS',
  'CODE',
  'IFRAME',
  'IMG',
  'INPUT',
  'KBD',
  'LABEL',
  'LINK',
  'NOSCRIPT',
  'PICTURE',
  'PRE',
  'SAMP',
  'SCRIPT',
  'SELECT',
  'SOURCE',
  'SPAN',
  'STYLE',
  'SVG',
  'TEXTAREA',
  'TIME',
  'VIDEO',
]);

// IMAGE = SVG <image> (Facebook/X circular profile masks).
const MEDIA_TAGS = new Set(['IMG', 'VIDEO', 'IMAGE']);
const MEDIA_CHROME_TAGS = new Set(['IMG', 'VIDEO', 'PICTURE', 'CANVAS', 'IMAGE']);
/** Class/id tokens that mark poster frames and video listing thumbs. */
const VIDEO_THUMB_TOKENS = [
  'video',
  'videos',
  'thumbnail',
  'thumb',
  'poster',
  'play',
  'player',
  'clip',
  'watch',
  'duration',
  'videoresource',
];
/** Href shapes that usually mean “this media opens a video”. */
const VIDEO_HREF_RE =
  /\/videos?(?:\/|$)|\/watch(?:\?|\/|$)|[?&](?:v|video|vid)=|\/\/(?:www\.)?(?:youtu(?:\.be|be\.com)|vimeo\.com|rumble\.com)\b/i;
const OVERLAY_PANEL_TAGS = new Set(['DIV', 'SECTION', 'UL', 'OL', 'NAV', 'ASIDE', 'DIALOG', 'MENU']);
const TOKEN_RE = /[\s_-]+/;
const SURFACE_PROMOTE_MAX_DEPTH = 3;
/** Large page canvases hide slabs far below depth 3. Size heuristic — no host checks. */
const SURFACE_PROMOTE_DEEP_DEPTH = 16;
const SURFACE_PROMOTE_MIN_WIDTH = 40;
const SURFACE_PROMOTE_MIN_HEIGHT = 16;
const SURFACE_PROMOTE_DEEP_MIN_WIDTH = 80;
const SURFACE_PROMOTE_DEEP_MIN_HEIGHT = 28;
const SURFACE_PROMOTE_DEEP_MIN_AREA = 4000;

/**
 * Phrasing / inline hosts must never become structural paint roles from
 * class/id tokens. Slashdot `span.story-title` / `span.story-byline` match
 * the article "story" token and would otherwise get isolated surface fills
 * around text fragments.
 */
const PHRASING_TAGS = new Set([
  'A',
  'ABBR',
  'B',
  'BDI',
  'BDO',
  'BR',
  'CITE',
  'CODE',
  'DATA',
  'DFN',
  'EM',
  'I',
  'KBD',
  'LABEL',
  'MARK',
  'Q',
  'S',
  'SAMP',
  'SMALL',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'TIME',
  'U',
  'VAR',
  'WBR',
]);
/** Per-page visit cap for depth-limited walks (not per-host). */
const SURFACE_PROMOTE_BUDGET = 5000;

function isOwnedByGmixer(el) {
  return !!(
    isGmixerUiElement(el) ||
    el.id === 'gmixer-style' ||
    el.id === 'gmixer-hover-outline' ||
    el.classList?.contains('gmixer-tonal-overlay')
  );
}

function tokensFor(el) {
  if (!el) return [];
  // Split on separators first, then camelCase, so
  // `showcaseSubbrandsArticleTitle` → showcase, subbrands, article, title
  // instead of one blob that substring-matches "article".
  const raw = `${el.id || ''} ${el.getAttribute?.('class') || ''} ${el.getAttribute?.('aria-label') || ''} ${el.getAttribute?.('data-testid') || ''}`;
  const parts = raw.split(TOKEN_RE).filter(Boolean);
  const out = [];
  for (const part of parts) {
    const camelBits = part
      .replace(/([a-z\d])([A-Z])/g, '$1\0$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1\0$2')
      .split('\0');
    for (const bit of camelBits) {
      const token = bit.toLowerCase();
      if (token) out.push(token);
    }
  }
  return out;
}

function hasToken(tokens, candidates) {
  return candidates.some((token) => tokens.includes(token));
}

function cacheKey(el) {
  return [
    el.tagName,
    el.id,
    el.getAttribute?.('class') || '',
    el.getAttribute?.('role') || '',
    el.getAttribute?.('aria-label') || '',
    el.getAttribute?.('alt') || '',
  ].join('|');
}

function result(role, confidence, reasons) {
  return { role, confidence: Math.min(0.99, confidence), reasons };
}

/**
 * Classify one element using semantic, ARIA, naming, relationship, and
 * media cues. Returns null below the confidence threshold.
 *
 * @param {Element} el
 * @returns {{ role?: string, media?: string, confidence: number, reasons: string[] }|null}
 */
/**
 * Flyout / dropdown / popover hosts. Absolute/fixed + minimum box, not the
 * in-bar chips the header transparent rule is meant to keep flush.
 * @param {Element} el
 */
export function isOverlayPanel(el) {
  if (!el || !OVERLAY_PANEL_TAGS.has(el.tagName)) return false;
  if (typeof getComputedStyle !== 'function') return false;
  const style = getComputedStyle(el);
  const pos = style.position;
  const ariaRole = (el.getAttribute?.('role') || '').toLowerCase();
  const semantic =
    ariaRole === 'menu' ||
    ariaRole === 'listbox' ||
    ariaRole === 'dialog' ||
    el.hasAttribute?.('popover') ||
    (el.tagName === 'DIALOG' && el.hasAttribute?.('open'));
  const positioned =
    pos === 'absolute' ||
    pos === 'fixed' ||
    (pos === 'sticky' && style.zIndex !== 'auto') ||
    (style.transform && style.transform !== 'none' && style.zIndex !== 'auto');
  if (!semantic && !positioned) return false;
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    Number.parseFloat(style.opacity || '1') <= 0
  ) {
    analysisDiagnostics.flyoutRejectedHidden += 1;
    return false;
  }
  if (typeof el.getBoundingClientRect !== 'function') return false;
  const rect = el.getBoundingClientRect();
  const minWidth = semantic ? 80 : 140;
  const minHeight = semantic ? 32 : 48;
  if (rect.width < minWidth || rect.height < minHeight) {
    if (semantic || positioned) analysisDiagnostics.flyoutRejectedGeometry += 1;
    return false;
  }
  const vw = typeof window !== 'undefined' ? window.innerWidth || 0 : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight || 0 : 0;
  if (
    !semantic &&
    vw > 0 &&
    vh > 0 &&
    rect.width >= vw * 0.95 &&
    rect.height >= vh * 0.95
  ) {
    return false;
  }
  // Thumbnail badge/play layers are full-size positioned siblings of the
  // poster. Painting them as flyouts covers the image.
  if (!semantic && isMediaChromeOverlay(el, style, rect)) {
    analysisDiagnostics.flyoutRejectedMediaChrome += 1;
    return false;
  }
  // Unfilled list containers are commonly CSS-only dropdowns: their visible
  // sheet is supplied by the extension. Other transparent floaters are
  // decorative/parallax content and must remain unpainted.
  const isListPanel = el.tagName === 'UL' || el.tagName === 'OL' || el.tagName === 'MENU';
  if (!semantic && !isListPanel && !hasOverlayFill(style)) {
    analysisDiagnostics.flyoutRejectedTransparent =
      (analysisDiagnostics.flyoutRejectedTransparent || 0) + 1;
    return false;
  }
  return true;
}

function hasBackdropFilter(style) {
  const value = `${style.backdropFilter || ''} ${style.webkitBackdropFilter || ''}`.trim();
  return !!(value && value !== 'none' && value !== 'none none');
}

/** Native sheet, glaze, or gradient — anything that should read as a panel fill. */
function hasOverlayFill(style) {
  const rgba = rgbaFromCss(style.backgroundColor || '');
  if (rgba && rgba.a >= 0.15) return true;
  if (hasBackdropFilter(style)) return true;
  if (hasCssGradientFill(style.backgroundImage || '')) return true;
  return false;
}

function firstMediaBox(node) {
  if (!node || node.nodeType !== 1) return null;
  const tag = (node.tagName || '').toUpperCase();
  if (MEDIA_CHROME_TAGS.has(tag) || tag === 'SVG') {
    return typeof node.getBoundingClientRect === 'function' ? node.getBoundingClientRect() : null;
  }
  const inner = node.querySelector?.('img, video, picture, canvas, image, svg');
  if (inner && typeof inner.getBoundingClientRect === 'function') {
    return inner.getBoundingClientRect();
  }
  const kids = node.children || node._children || [];
  for (const kid of kids) {
    const box = firstMediaBox(kid);
    if (box) return box;
  }
  return null;
}

function overlapBox(a, b) {
  if (!a || !b) return null;
  const aw = a.width || 0;
  const ah = a.height || 0;
  const bw = b.width || 0;
  const bh = b.height || 0;
  if (aw < 1 || ah < 1 || bw < 1 || bh < 1) return null;
  const hasOrigin =
    Number.isFinite(a.left) &&
    Number.isFinite(a.top) &&
    Number.isFinite(b.left) &&
    Number.isFinite(b.top);
  if (!hasOrigin) return { w: Math.min(aw, bw), h: Math.min(ah, bh) };
  const ar = a.right ?? a.left + aw;
  const ab = a.bottom ?? a.top + ah;
  const br = b.right ?? b.left + bw;
  const bb = b.bottom ?? b.top + bh;
  const w = Math.max(0, Math.min(ar, br) - Math.max(a.left, b.left));
  const h = Math.max(0, Math.min(ab, bb) - Math.max(a.top, b.top));
  if (w <= 0 || h <= 0) return null;
  return { w, h };
}

function boxesCover(overlayRect, mediaRect) {
  const overlap = overlapBox(overlayRect, mediaRect);
  if (!overlap) return false;
  const mw = mediaRect.width || 0;
  const mh = mediaRect.height || 0;
  const hasOrigin =
    Number.isFinite(overlayRect.left) &&
    Number.isFinite(overlayRect.top) &&
    Number.isFinite(mediaRect.left) &&
    Number.isFinite(mediaRect.top);
  if (hasOrigin) return overlap.w * overlap.h >= mw * mh * 0.45;
  const ow = overlayRect.width || 0;
  const oh = overlayRect.height || 0;
  return Math.min(ow, mw) / Math.max(ow, mw) >= 0.7 && Math.min(oh, mh) / Math.max(oh, mh) >= 0.7;
}

function isEdgeChromeOverMedia(overlayRect, mediaRect) {
  const overlap = overlapBox(overlayRect, mediaRect);
  if (!overlap) return false;
  const ow = overlayRect.width || 0;
  const oh = overlayRect.height || 0;
  const mw = mediaRect.width || 0;
  const mh = mediaRect.height || 0;
  const oa = ow * oh;
  if (oa < 1) return false;
  // Badge/control strips sit mostly on the poster. Flow sheets that only
  // clip a cover's overflow (FB profile name/followers row) must paint.
  if ((overlap.w * overlap.h) / oa < 0.55) return false;
  return oh < mh * 0.4 || ow < mw * 0.4;
}

function isPositionedPaintLayer(el) {
  if (!el || typeof getComputedStyle !== 'function') return false;
  const pos = String(getComputedStyle(el).position || '');
  return pos === 'absolute' || pos === 'fixed' || pos === 'sticky';
}

/**
 * True when `elRect` is essentially a media frame/stage (poster wrapper,
 * badge layer), not a content sheet that merely embeds a thumbnail.
 * Half-and-half article rows (Breitbart “Most Popular”: image | headline)
 * must stay paint targets — only reject when media dominates the box.
 * @param {{ width?: number, height?: number }} elRect
 * @param {{ width?: number, height?: number }} mediaRect
 */
function isMediaSizedFrame(elRect, mediaRect) {
  const ew = elRect.width || 0;
  const eh = elRect.height || 0;
  const mw = mediaRect.width || 0;
  const mh = mediaRect.height || 0;
  const ea = ew * eh;
  const ma = mw * mh;
  if (ea < 1 || ma < 1) return false;
  const widthRatio = Math.min(ew, mw) / Math.max(ew, mw);
  const heightRatio = Math.min(eh, mh) / Math.max(eh, mh);
  // True poster/stage: media matches the frame on both axes (letterboxing ok).
  if (widthRatio >= 0.72 && heightRatio >= 0.72) return true;
  // Media still owns nearly all of the area (wide short control strips, etc.).
  if (ma / ea >= 0.78) return true;
  return false;
}

function coversOrStripsMedia(el, rect) {
  const ownMedia = firstMediaBox(el);
  // Self-cover must be media-sized. Otherwise any card that contains a
  // thumbnail (Techmeme #qiobv / #podcasts) is falsely rejected as chrome.
  if (ownMedia && isMediaSizedFrame(rect, ownMedia) && boxesCover(rect, ownMedia)) {
    return true;
  }
  const parent = el.parentElement;
  if (!parent) return false;
  // Absolute badges over a poster are chrome. Static flow rows under a tall
  // cover (profile identity / followers) are sheets and must stay paintable.
  const positioned = isPositionedPaintLayer(el);
  const kids = parent.children || parent._children || [];
  for (const sib of kids) {
    if (sib === el) continue;
    const media = firstMediaBox(sib);
    if (!media) continue;
    if (boxesCover(rect, media)) return true;
    if (positioned && isEdgeChromeOverMedia(rect, media)) return true;
  }
  return false;
}

/**
 * Poster/player chrome (badge layers, video stage, control strips), not a flyout.
 * @param {Element} el
 * @param {CSSStyleDeclaration} style
 * @param {DOMRect} rect
 */
function isMediaChromeOverlay(el, style, rect) {
  const pointerEvents = String(style.pointerEvents || '').toLowerCase();
  if (pointerEvents === 'none') return true;
  return coversOrStripsMedia(el, rect);
}

/**
 * Facebook/X profile faces are often SVG <image> under a circular mask, not <img>.
 * @param {Element} el
 * @param {Element|null|undefined} svgHost
 */
function looksLikeSvgAvatar(el, svgHost) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return false;
  const rect = el.getBoundingClientRect();
  const w = rect.width || 0;
  const h = rect.height || 0;
  if (w < 40 || h < 40 || w > 320 || h > 320) return false;
  if (Math.abs(w - h) / Math.max(w, h) > 0.25) return false;
  const svg = svgHost || el.closest?.('svg');
  if (!svg) return false;
  const role = (svg.getAttribute?.('role') || '').toLowerCase();
  const masked =
    !!el.closest?.('g[mask]') ||
    !!svg.querySelector?.('mask circle, mask > circle, mask');
  return role === 'img' || masked;
}

export function classifyElement(el) {
  if (!el || isOwnedByGmixer(el)) return null;
  const key = cacheKey(el);
  const cached = classificationCache.get(el);
  if (cached?.key === key) {
    if (cached.value?.media || cached.value?.role === 'surface') return cached.value;
    if (!OVERLAY_PANEL_TAGS.has(el.tagName) || !isOverlayPanel(el)) return cached.value;
  }

  const tag = el.tagName;
  const ariaRole = (el.getAttribute?.('role') || '').toLowerCase();
  const tokens = tokensFor(el);

  if (isOverlayPanel(el)) {
    const value = {
      ...result('surface', 0.88, ['positioned overlay panel']),
      overlay: true,
    };
    classificationCache.set(el, { key, value });
    return value;
  }

  for (const rule of STRUCTURAL_RULES) {
    // Text / heading hosts: never promote to article/card/main/etc from naming.
    // TNW `h3.showcaseSubbrandsArticleTitle` substring-matched "article" and
    // received surface fills around the heading text alone.
    if (PHRASING_TAGS.has(tag) || /^H[1-6]$/.test(tag)) continue;

    const reasons = [];
    let confidence = 0;
    if (rule.tags.includes(tag)) {
      confidence = 0.96;
      reasons.push(`semantic <${tag.toLowerCase()}>`);
    }
    if (rule.aria.includes(ariaRole)) {
      confidence = Math.max(confidence, 0.94);
      reasons.push(`ARIA role="${ariaRole}"`);
    }
    if (hasToken(tokens, rule.tokens)) {
      confidence = Math.max(confidence, rule.role === 'card' || rule.role === 'hero' ? 0.82 : 0.76);
      reasons.push('class/id naming convention');
    }
    if (confidence >= CLASSIFIER_CONFIDENCE_THRESHOLD) {
      const value = result(rule.role, confidence, reasons);
      classificationCache.set(el, { key, value });
      return value;
    }
  }

  // SVG <image> uses lowercase tagName in HTML documents.
  const mediaKind = (tag || '').toUpperCase();
  if (MEDIA_TAGS.has(mediaKind)) {
    // Video cues often live on the wrapping link/card (CNN vertical-video
    // links, Rumble thumb shells), not on the <img> class itself.
    const parentTokens = tokensFor(el.parentElement);
    const link = el.closest?.('a[href]');
    const linkTokens = tokensFor(link);
    const card = el.closest?.(
      '[data-gmixer-role="card"], [class*="card"], [class*="teaser"], [class*="thumb"], li, figure'
    );
    const cardTokens = tokensFor(card);
    const ancestor = el.closest?.('article, [role="article"], .article, .post, .entry-content');
    const ancestorTokens = tokensFor(ancestor);
    // Facebook/X circular faces: cues live on the svg[role=img] / button host.
    const svgHost = mediaKind === 'IMAGE' ? el.closest?.('svg') : null;
    const svgTokens = tokensFor(svgHost);
    const svgControl = svgHost?.closest?.('button, [role="button"], a[href], [role="link"]');
    const allTokens = [
      ...tokens,
      ...parentTokens,
      ...linkTokens,
      ...cardTokens,
      ...ancestorTokens,
      ...svgTokens,
      ...tokensFor(svgControl),
    ];
    const href = link?.getAttribute?.('href') || '';
    const hrefIsVideo = VIDEO_HREF_RE.test(href);
    const namedVideoThumb = hasToken(allTokens, VIDEO_THUMB_TOKENS);
    const reasons = [];
    let confidence = 0;
    let videoThumbCue = mediaKind === 'VIDEO';

    if (mediaKind === 'VIDEO') {
      confidence = 0.96;
      reasons.push('video element');
    }
    if (namedVideoThumb) {
      confidence = Math.max(confidence, 0.88);
      reasons.push('video/thumbnail/play naming cue');
      videoThumbCue = true;
    }
    if (hrefIsVideo) {
      confidence = Math.max(confidence, 0.9);
      reasons.push('video URL shape');
      videoThumbCue = true;
    }
    if (mediaKind === 'IMG' && ancestor) {
      confidence = Math.max(confidence, 0.86);
      reasons.push('image nested in article');
    }
    // Covers before avatars: "View profile cover photo" must not become avatar
    // just because the label contains "profile".
    const coverCue =
      hasToken(allTokens, ['cover', 'banner', 'masthead', 'jumbotron']) ||
      (hasToken(allTokens, ['header']) &&
        hasToken(allTokens, ['photo', 'image', 'img', 'media', 'picture']));
    if (coverCue && mediaKind === 'IMG') {
      confidence = Math.max(confidence, 0.9);
      reasons.push('cover/banner/header naming cue');
      const value = { media: 'cover-image', confidence, reasons };
      classificationCache.set(el, { key, value });
      return value;
    }
    if (mediaKind === 'IMAGE' && looksLikeSvgAvatar(el, svgHost)) {
      confidence = Math.max(confidence, 0.9);
      reasons.push('circular svg profile image');
      const value = { media: 'avatar', confidence, reasons };
      classificationCache.set(el, { key, value });
      return value;
    }
    if (hasToken(allTokens, ['avatar', 'author', 'user', 'profile'])) {
      // Large landscape photos with a weak "profile" cue are covers, not faces.
      const rect =
        typeof el.getBoundingClientRect === 'function' ? el.getBoundingClientRect() : null;
      const w = rect?.width || 0;
      const h = rect?.height || 0;
      const landscapeCover = w >= 400 && h > 0 && w / h >= 1.5;
      if (landscapeCover && !hasToken(allTokens, ['avatar', 'author', 'user'])) {
        confidence = Math.max(confidence, 0.88);
        reasons.push('large landscape profile media → cover');
        const value = { media: 'cover-image', confidence, reasons };
        classificationCache.set(el, { key, value });
        return value;
      }
      confidence = Math.max(confidence, 0.9);
      reasons.push('avatar/profile naming cue');
      const value = { media: 'avatar', confidence, reasons };
      classificationCache.set(el, { key, value });
      return value;
    }
    if (hasToken(allTokens, ['logo', 'brand', 'wordmark']) || /logo/i.test(el.getAttribute?.('alt') || '')) {
      confidence = Math.max(confidence, 0.92);
      reasons.push('logo/brand naming cue');
      const value = { media: 'logo', confidence, reasons };
      classificationCache.set(el, { key, value });
      return value;
    }
    if (confidence >= CLASSIFIER_CONFIDENCE_THRESHOLD && mediaKind !== 'IMAGE') {
      // Video cues win over article nesting — otherwise every in-article
      // poster becomes article-image and picks up the Images filter.
      // SVG <image> without cues stays unclassified (icons/decor).
      const media = videoThumbCue || mediaKind === 'VIDEO' ? 'video-thumbnail' : 'article-image';
      const value = { media, confidence, reasons };
      classificationCache.set(el, { key, value });
      return value;
    }
  }

  if (tag !== 'IMG' && tag !== 'VIDEO' && tag !== 'image' && tag !== 'IMAGE' && !PHRASING_TAGS.has(tag)) {
    if (typeof getComputedStyle === 'function') {
      const style = getComputedStyle(el);
      const bgImage = style.backgroundImage || '';
      if (
        bgImage &&
        bgImage !== 'none' &&
        bgImage.includes('url(') &&
        !isDecorativeChromeBackground(el, style)
      ) {
        const value = {
          media: 'background-image',
          confidence: 0.78,
          reasons: ['computed background-image'],
        };
        classificationCache.set(el, { key, value });
        return value;
      }
    }
    if (hasToken(tokens, ['ad', 'ads', 'advert', 'sponsor', 'sponsored'])) {
      const value = result('ad', 0.84, ['advertising naming cue']);
      classificationCache.set(el, { key, value });
      return value;
    }
  }

  classificationCache.set(el, { key, value: null });
  return null;
}

function rgbaFromCss(bg) {
  const rgba = (bg || '').match(
    /rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i
  );
  if (!rgba) return null;
  const parsedAlpha = rgba[4] === undefined ? 1 : parseFloat(rgba[4]);
  const alpha = Number.isNaN(parsedAlpha)
    ? 1
    : String(rgba[4] || '').includes('%')
      ? parsedAlpha / 100
      : parsedAlpha;
  return {
    r: +rgba[1] / 255,
    g: +rgba[2] / 255,
    b: +rgba[3] / 255,
    a: Math.max(0, Math.min(1, alpha)),
  };
}

function luminanceFromRgba(color) {
  if (!color || color.a <= 0) return null;
  return 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
}

function parentPaintNode(el) {
  if (el?.parentElement) return el.parentElement;
  const root = el?.getRootNode?.();
  return root?.host || null;
}

function effectiveBackground(el, style) {
  const layers = [];
  let node = el;
  let currentStyle = style;
  for (let depth = 0; node && depth < 12; depth += 1) {
    const color = rgbaFromCss(currentStyle?.backgroundColor || '');
    if (color && color.a > 0) layers.push(color);
    if (color?.a >= 0.999) break;
    node = parentPaintNode(node);
    currentStyle =
      node && typeof getComputedStyle === 'function' ? getComputedStyle(node) : null;
  }
  let out = { r: 1, g: 1, b: 1, a: 1 };
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const top = layers[index];
    out = {
      r: top.r * top.a + out.r * (1 - top.a),
      g: top.g * top.a + out.g * (1 - top.a),
      b: top.b * top.a + out.b * (1 - top.a),
      a: top.a + out.a * (1 - top.a),
    };
  }
  return out;
}

const CSS_COLOR_TOKEN_RE =
  /rgba?\([^)]+\)|hsla?\([^)]+\)|oklch\([^)]+\)|oklab\([^)]+\)|color\([^)]+\)|#[0-9a-f]{3,8}\b/gi;

function firstCssColorToken(value) {
  // Prefer rgb(a) when present; otherwise accept modern CSS color functions /
  // hex stops (Hugging Face Tailwind gradients often use oklch()).
  CSS_COLOR_TOKEN_RE.lastIndex = 0;
  const match = CSS_COLOR_TOKEN_RE.exec(value || '');
  return match ? match[0] : '';
}

/** @param {string} value */
function cssColorTokens(value) {
  CSS_COLOR_TOKEN_RE.lastIndex = 0;
  return [...(value || '').matchAll(CSS_COLOR_TOKEN_RE)].map((match) => match[0]);
}

/** Relative luminance of the document canvas (body, then html). */
function pageCanvasLuminance() {
  if (typeof getComputedStyle !== 'function' || typeof document === 'undefined') return 1;
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const style = getComputedStyle(el);
    const rgba = rgbaFromCss(style.backgroundColor || '');
    if (rgba && rgba.a >= 0.5) return luminanceFromRgba(rgba);
    const fromGradient = luminanceFromCssColorToken(firstCssColorToken(style.backgroundImage || ''));
    if (fromGradient != null) return fromGradient;
  }
  return 1;
}

/**
 * Approximate relative luminance for a single CSS color token.
 * OKLCH/OKLAB expose perceptual L directly — no sRGB round-trip needed.
 * @param {string} token
 * @returns {number|null}
 */
function luminanceFromCssColorToken(token) {
  if (!token) return null;
  const rgba = rgbaFromCss(token);
  if (rgba) return luminanceFromRgba(rgba);

  const oklike = token.match(/okl(?:ch|ab)\(\s*([-\d.]+%?)/i);
  if (oklike) {
    let L = parseFloat(oklike[1]);
    if (!Number.isFinite(L)) return null;
    if (String(oklike[1]).includes('%') || L > 1) L /= 100;
    return Math.max(0, Math.min(1, L));
  }

  const hex = token.match(/^#([0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) {
      h = [...h].map((c) => c + c).join('');
    }
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return luminanceFromRgba({ r, g, b, a });
  }

  return null;
}

function captureNativeLuminance(el, style) {
  if (el.hasAttribute?.(NATIVE_L_ATTR)) return;
  if (!style) {
    if (typeof getComputedStyle !== 'function') return;
    style = getComputedStyle(el);
  }
  const ownColor = rgbaFromCss(style.backgroundColor || '');
  let lum = ownColor?.a > 0 ? luminanceFromRgba(effectiveBackground(el, style)) : null;
  if (lum == null) {
    lum = luminanceFromCssColorToken(firstCssColorToken(style.backgroundImage || ''));
  }
  // Unparsed gradient stops still count as a painted sheet for opaque-only.
  if (lum == null && hasCssGradientFill(style.backgroundImage || '')) {
    lum = 0.5;
  }
  if (lum == null && hasBackdropFilter(style)) {
    // Frosted chrome with no resolvable color — treat as mid glaze.
    lum = 0.2;
  }
  if (lum == null) return;
  el.setAttribute(NATIVE_L_ATTR, lum.toFixed(4));
  captureNativeGlaze(el, style, ownColor);
}

/**
 * Mark frosted / semi-transparent chrome so CSS can keep the glaze while
 * swapping in theme colors (Opera GX header menus).
 * @param {Element} el
 * @param {CSSStyleDeclaration} style
 * @param {{ r: number, g: number, b: number, a: number }|null} [ownColor]
 */
function captureNativeGlaze(el, style, ownColor = null) {
  if (el.hasAttribute?.(GLAZE_ATTR)) return;
  const rgba = ownColor || rgbaFromCss(style.backgroundColor || '');
  const backdrop = hasBackdropFilter(style);
  if (backdrop) {
    const alpha = rgba && rgba.a > 0.05 && rgba.a < 0.95 ? rgba.a : 0.5;
    el.setAttribute(GLAZE_ATTR, String(+alpha.toFixed(2)));
    return;
  }
  if (rgba && rgba.a > 0.08 && rgba.a < 0.92) {
    el.setAttribute(GLAZE_ATTR, String(+rgba.a.toFixed(2)));
  }
}

/**
 * Selectors that roleCss may fill. Opaque-only paint requires
 * {@link NATIVE_L_ATTR} on these hosts; stamp it here for opaque natives
 * (including body > section sheets that never got a structural role).
 */
const OPAQUE_PAINT_TARGET_SELECTORS = [
  'body > header',
  'body > footer',
  'body footer',
  'body > nav',
  'body > aside',
  'body > section',
  'body > [role="banner"]',
  'body > [role="contentinfo"]',
  'body > [role="navigation"]',
  'body > [role="complementary"]',
  'body header',
  'body [role="banner"]',
  'body .masthead',
  'body #header',
  'body #masthead',
  'body nav',
  'body [role="navigation"]',
  'body .nav',
  'body .navbar',
  'body main',
  'body #main',
  'body [role="main"]',
  'body article',
  'body .card',
  'body aside',
  'body dialog',
  'body [role="dialog"]',
  'body [role="menu"]',
  'body [role="listbox"]',
  'body [role="alert"]',
  'body pre',
  'body code',
  'body kbd',
  'body samp',
  'body input',
  'body textarea',
  'body select',
  'body button',
  'body a.button',
  'body a.btn',
  'body [role="textbox"]',
  'body [role="searchbox"]',
  'body [role="combobox"]',
  'body [role="search"]',
  'body [role="button"]',
  'body [role="tab"]',
  'body [contenteditable="true"]',
  `[${ROLE_ATTR}="main"]`,
  `[${ROLE_ATTR}="article"]`,
  `[${ROLE_ATTR}="article-body"]`,
  `[${ROLE_ATTR}="card"]`,
  `[${ROLE_ATTR}="surface"]`,
  `[${ROLE_ATTR}="sidebar"]`,
  `[${ROLE_ATTR}="hero"]`,
  `[${ROLE_ATTR}="header"]`,
  `[${ROLE_ATTR}="footer"]`,
  `[${ROLE_ATTR}="navigation"]`,
].join(',');

/**
 * Stamp or clear {@link NATIVE_L_ATTR} on CSS paint targets so opaque-only
 * fills can gate on the attribute.
 *
 * @param {ParentNode} root
 * @returns {number} number of elements stamped with native luminance
 */
export function stampOpaquePaintTargets(root = document.body) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  const scope =
    typeof document !== 'undefined' && (root === document.body || root === document.documentElement)
      ? document
      : root;
  const nodes = scope.querySelectorAll?.(OPAQUE_PAINT_TARGET_SELECTORS) || [];
  /** @type {{ el: Element, style: CSSStyleDeclaration }[]} */
  const toStamp = [];
  /** @type {Element[]} */
  const toClear = [];
  for (const el of nodes) {
    if (isOwnedByGmixer(el)) continue;
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
    const isTab = el.getAttribute?.('role') === 'tab';
    if (
      style &&
      (isOpaqueBackground(el, style) || (isTab && hasTabChipFill(style)))
    ) {
      toStamp.push({ el, style });
    } else if (isTab && el.hasAttribute?.(NATIVE_L_ATTR)) {
      // Incremental passes run with the theme sheet on; our tab GUI fill
      // hides the native chip tint. Keep a prior stamp instead of clearing.
    } else {
      toClear.push(el);
    }
  }
  let stamped = 0;
  for (const { el, style } of toStamp) {
    const had = el.hasAttribute(NATIVE_L_ATTR);
    captureNativeLuminance(el, style);
    if (!had && el.hasAttribute(NATIVE_L_ATTR)) stamped += 1;
  }
  for (const el of toClear) {
    el.removeAttribute(NATIVE_L_ATTR);
    el.removeAttribute(TONE_STEP_ATTR);
  }
  return stamped;
}

function stamp(el, classification) {
  if (classification.role) el.setAttribute(ROLE_ATTR, classification.role);
  if (classification.overlay) el.setAttribute(OVERLAY_ATTR, '');
  if (classification.media) el.setAttribute(MEDIA_ATTR, classification.media);
  el.setAttribute(CONFIDENCE_ATTR, classification.confidence.toFixed(2));
  el.setAttribute(REASONS_ATTR, classification.reasons.join('; '));
  if (classification.role && TONE_RANK_ROLES.has(classification.role)) {
    captureNativeLuminance(el);
  }
}

function clearClassification(el) {
  el.removeAttribute(ROLE_ATTR);
  el.removeAttribute(MEDIA_ATTR);
  el.removeAttribute(LOGO_ALPHA_ATTR);
  el.removeAttribute(CONFIDENCE_ATTR);
  el.removeAttribute(REASONS_ATTR);
  el.removeAttribute(OVERLAY_ATTR);
  el.removeAttribute(NATIVE_L_ATTR);
  el.removeAttribute(TONE_STEP_ATTR);
  el.removeAttribute(CANVAS_WASH_ATTR);
  el.removeAttribute(GLAZE_ATTR);
  el.removeAttribute(PSEUDO_FILL_ATTR);
}

function elementsUnder(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const descendants = Array.from(root.querySelectorAll('*'));
  return root.nodeType === 1 ? [root, ...descendants] : descendants;
}

const CSS_GRADIENT_RE = /(?:repeating-)?(?:linear|radial|conic)-gradient\(/i;

function hasCssGradientFill(backgroundImage) {
  return CSS_GRADIENT_RE.test(backgroundImage || '');
}

function isEmptyGeneratedContent(content) {
  const raw = String(content || '').trim();
  return raw === '""' || raw === "''";
}

/**
 * True when ::before/::after is a covering sheet (not an icon glyph).
 * @param {Element} el
 * @param {string} pseudo `::before` or `::after`
 */
function isCoveringPseudoFill(el, pseudo) {
  if (typeof getComputedStyle !== 'function' || typeof el.getBoundingClientRect !== 'function') {
    return false;
  }
  const style = getComputedStyle(el, pseudo);
  if (!style) return false;
  if (!isEmptyGeneratedContent(style.content)) return false;
  const pos = String(style.position || '');
  if (pos !== 'absolute' && pos !== 'fixed') return false;
  if (!isOpaqueBackground(el, style) && !hasCssGradientFill(style.backgroundImage || '')) {
    return false;
  }
  const host = el.getBoundingClientRect();
  const w = parseFloat(style.width);
  const h = parseFloat(style.height);
  if (!(w >= 80) || !(h >= 80)) return false;
  if (host.width >= 1 && w / host.width < 0.4) return false;
  if (host.height >= 1 && h / host.height < 0.4) return false;
  return true;
}

/**
 * Mark hosts whose empty ::before/::after is the visible opaque fill.
 * @param {ParentNode} root
 * @returns {number}
 */
export function stampCoveringPseudoFills(root = document.body) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  const scope =
    typeof document !== 'undefined' && (root === document.body || root === document.documentElement)
      ? document
      : root;
  const nodes = scope.querySelectorAll?.(
    `[${ROLE_ATTR}], [${NATIVE_L_ATTR}]`
  ) || [];
  let stamped = 0;
  for (const el of nodes) {
    if (isOwnedByGmixer(el)) continue;
    const parts = [];
    if (isCoveringPseudoFill(el, '::before')) parts.push('before');
    if (isCoveringPseudoFill(el, '::after')) parts.push('after');
    if (parts.length) {
      el.setAttribute(PSEUDO_FILL_ATTR, parts.join(' '));
      stamped += 1;
    } else if (el.hasAttribute?.(PSEUDO_FILL_ATTR)) {
      el.removeAttribute(PSEUDO_FILL_ATTR);
    }
  }
  return stamped;
}

function isOpaqueBackground(el, style) {
  if (!style) {
    if (typeof getComputedStyle !== 'function') return false;
    style = getComputedStyle(el);
  }
  const bg = style.backgroundColor || '';
  const rgba = rgbaFromCss(bg);
  // Opaque-only means a meaningful native sheet, not a barely visible tint.
  if (rgba ? rgba.a >= 0.5 : bg && bg !== 'transparent') return true;
  // Brand chrome often paints with linear-gradient and a transparent color.
  return hasCssGradientFill(style.backgroundImage || '');
}

/**
 * Tab chips (Gan Jing `.home-tag-menu [role=tab]`) often use a faint tint
 * (~5% alpha) that is not an opaque sheet but should still keep a themed fill.
 * @param {CSSStyleDeclaration} style
 */
function hasTabChipFill(style) {
  const bg = style.backgroundColor || '';
  const rgba = rgbaFromCss(bg);
  if (rgba && rgba.a >= 0.02) return true;
  if (!rgba && bg && bg !== 'transparent') return true;
  return hasCssGradientFill(style.backgroundImage || '');
}

/**
 * Soft gradient that matches the page canvas (HF `from-gray-50-to-white` rails).
 * @param {CSSStyleDeclaration} style
 */
function isCanvasWashGradient(style) {
  if (!hasCssGradientFill(style.backgroundImage || '')) return false;
  const rgba = rgbaFromCss(style.backgroundColor || '');
  // A real solid sheet underneath is not a wash.
  if (rgba && rgba.a >= 0.5) return false;

  const lums = cssColorTokens(style.backgroundImage || '')
    .map(luminanceFromCssColorToken)
    .filter((l) => l != null);
  if (!lums.length) return false;

  const pageLum = pageCanvasLuminance();
  if (lums.every((l) => Math.abs(l - pageLum) <= 0.1)) return true;
  if (lums.every((l) => l >= 0.93) || lums.every((l) => l <= 0.08)) return true;
  return false;
}

/**
 * True when a fill should become its own surface sheet under seed/promote.
 * Soft page-matching gradient washes share the canvas and must not invent
 * secondary surfaces under Tone. Solid opaque fills and brand gradients still
 * qualify.
 *
 * @param {Element} el
 * @param {CSSStyleDeclaration} [style]
 */
function isDistinctSheetBackground(el, style) {
  if (!style) {
    if (typeof getComputedStyle !== 'function') return false;
    style = getComputedStyle(el);
  }
  const rgba = rgbaFromCss(style.backgroundColor || '');
  if (rgba && rgba.a >= 0.5) return true;
  if (!hasCssGradientFill(style.backgroundImage || '')) return false;
  // Parsed canvas washes are not distinct; unparsed gradients still count as
  // brand chrome we cannot inspect.
  return !isCanvasWashGradient(style);
}

/** Mark canvas washes so CSS can clear them without inventing a surface. */
function stampCanvasWash(el, style) {
  if (!el || el.nodeType !== 1) return false;
  if (el.hasAttribute?.(ROLE_ATTR) || el.hasAttribute?.(MEDIA_ATTR)) return false;
  if (!style) {
    if (typeof getComputedStyle !== 'function') return false;
    style = getComputedStyle(el);
  }
  if (!isCanvasWashGradient(style)) return false;
  if (!isLargePaintedSheet(el)) return false;
  el.setAttribute(CANVAS_WASH_ATTR, '');
  return true;
}

/**
 * Promote opaque painted descendants under classified hosts to `surface`.
 * General fix for nested slabs that keep native fills after the host restyle.
 *
 * Walks only up to {@link SURFACE_PROMOTE_MAX_DEPTH} so a large `main` host
 * cannot exhaust the budget before article slabs are considered.
 *
 * @param {ParentNode} root
 * @returns {number} number of newly stamped surfaces
 */
export function promotePaintedSurfaces(root = document.body) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;

  const hosts = Array.from(root.querySelectorAll?.(`[${ROLE_ATTR}]`) || []).filter((el) =>
    SURFACE_HOST_ROLES.has(el.getAttribute(ROLE_ATTR) || '')
  );
  // Include root itself when it is a stamped host (subtree reclassify).
  if (
    root.nodeType === 1 &&
    SURFACE_HOST_ROLES.has(/** @type {Element} */ (root).getAttribute?.(ROLE_ATTR) || '')
  ) {
    hosts.unshift(/** @type {Element} */ (root));
  }

  // Prefer tight hosts (article/card) over broad ones (main) so nested
  // story slabs are stamped before a page-wide main walk burns the budget.
  hosts.sort((a, b) => {
    const pa = SURFACE_HOST_PRIORITY[a.getAttribute(ROLE_ATTR) || ''] ?? 9;
    const pb = SURFACE_HOST_PRIORITY[b.getAttribute(ROLE_ATTR) || ''] ?? 9;
    return pa - pb;
  });

  let stamped = 0;
  let budget = SURFACE_PROMOTE_BUDGET;

  /**
   * @param {Element} host
   * @param {string} hostRole
   * @param {Element} el
   * @param {number} depth
   * @param {number} maxDepth
   */
  function visit(host, hostRole, el, depth, maxDepth) {
    if (budget <= 0) return;
    if (depth > maxDepth) return;

    // Nested classified hosts (e.g. header inside article) get their own pass.
    // Also stop at header/nav chrome so page-sheet walks do not elevate menu fills.
    const nestedRole = depth >= 1 ? el.getAttribute?.(ROLE_ATTR) : null;
    if (nestedRole && SURFACE_WALK_STOP_ROLES.has(nestedRole)) return;

    budget -= 1;

    if (
      depth >= 1 &&
      !isOwnedByGmixer(el) &&
      !SURFACE_SKIP_TAGS.has(el.tagName) &&
      !el.hasAttribute(ROLE_ATTR) &&
      !el.hasAttribute(MEDIA_ATTR) &&
      isDistinctSheetBackground(el)
    ) {
      let sizedOk = true;
      if (typeof el.getBoundingClientRect === 'function') {
        const rect = el.getBoundingClientRect();
        const deep = depth > SURFACE_PROMOTE_MAX_DEPTH;
        sizedOk = deep
          ? rect.width >= SURFACE_PROMOTE_DEEP_MIN_WIDTH &&
            rect.height >= SURFACE_PROMOTE_DEEP_MIN_HEIGHT &&
            rect.width * rect.height >= SURFACE_PROMOTE_DEEP_MIN_AREA
          : rect.width >= SURFACE_PROMOTE_MIN_WIDTH && rect.height >= SURFACE_PROMOTE_MIN_HEIGHT;
        if (sizedOk && coversOrStripsMedia(el, rect)) sizedOk = false;
      }
      if (sizedOk) {
        stamp(el, result('surface', 0.8, [`opaque surface inside ${hostRole}`]));
        stamped += 1;
      }
    }

    if (depth >= maxDepth) return;
    const children = el.children;
    if (!children) return;
    for (let i = 0; i < children.length; i += 1) {
      visit(host, hostRole, children[i], depth + 1, maxDepth);
      if (budget <= 0) return;
    }
  }

  for (const host of hosts) {
    if (budget <= 0) break;
    const hostRole = host.getAttribute(ROLE_ATTR) || '';
    const maxDepth = promoteMaxDepthFor(host);
    const children = host.children;
    if (!children) continue;
    for (let i = 0; i < children.length; i += 1) {
      visit(host, hostRole, children[i], 1, maxDepth);
      if (budget <= 0) break;
    }
  }
  return stamped;
}

/**
 * Shallow promotion for tight article/card hosts; deep walks for large page
 * canvases whose painted descendants sit many wrappers below the host.
 * @param {Element} host
 */
function promoteMaxDepthFor(host) {
  const role = host.getAttribute?.(ROLE_ATTR) || '';
  if (role !== 'surface' && role !== 'main' && role !== 'sidebar') return SURFACE_PROMOTE_MAX_DEPTH;
  if (typeof window === 'undefined' || typeof host.getBoundingClientRect !== 'function') {
    return SURFACE_PROMOTE_MAX_DEPTH;
  }
  const rect = host.getBoundingClientRect();
  const vw = window.innerWidth || 0;
  const largeCanvas = (vw > 0 && rect.width >= vw * 0.4 && rect.height >= 160) || rect.height >= 400;
  return largeCanvas ? SURFACE_PROMOTE_DEEP_DEPTH : SURFACE_PROMOTE_MAX_DEPTH;
}

const SHEET_SKIP_TAGS = new Set([
  ...SURFACE_SKIP_TAGS,
  ...PHRASING_TAGS,
  'HEAD',
  'META',
  'NOSCRIPT',
  'SCRIPT',
  'STYLE',
  'TEMPLATE',
]);
const SHEET_MAX_DEPTH = 20;
const SHEET_WALK_BUDGET = 1200;

/**
 * Full-width canvases and tall columns that keep native light fills after
 * html/body are restyled. Size-only — no site-specific class names.
 * @param {Element} el
 */
function isLargePaintedSheet(el) {
  if (typeof el.getBoundingClientRect !== 'function') return false;
  const rect = el.getBoundingClientRect();
  const vw = typeof window !== 'undefined' ? window.innerWidth || 0 : 0;
  const inShadow = isShadowRoot(el.getRootNode?.());
  const minBarHeight = inShadow ? 24 : 32;
  // Inbox/list rows and shadow ad bars are wide and short. Size-only.
  // Profile identity rows under covers are often ~120–160px tall.
  if (
    vw > 0 &&
    rect.width >= vw * 0.6 &&
    rect.height >= minBarHeight &&
    rect.height <= 168 &&
    rect.width * rect.height >= 20000
  ) {
    return true;
  }
  // Mid-width opaque cards / search shells / expanding nav rails (IG ~238px).
  if (
    rect.width >= 220 &&
    rect.width <= 480 &&
    rect.height >= 40 &&
    rect.width * rect.height >= 14000
  ) {
    return true;
  }
  // Timeline composer / feed chrome that is wide but not full-viewport.
  if (rect.width >= 280 && rect.height >= 48 && rect.width * rect.height >= 25000) {
    return true;
  }
  if (rect.width < 120 || rect.height < 80) return false;
  if (vw > 0 && rect.width >= vw * 0.45 && rect.height >= 160) return true;
  if (rect.width >= 140 && rect.height >= 240) return true;
  return rect.width * rect.height >= 80000;
}

/**
 * Seed large page sheets that are opaque but were not stamped by structural
 * rules. Walks through transparent layout wrappers so `body > div.bg-white`
 * and table-free sidebar columns are found without matching only
 * `section`/`main`. Do not add hostname branches.
 *
 * @param {ParentNode} root
 * @returns {number}
 */
export function seedPageSheets(root) {
  if (typeof document === 'undefined') return 0;
  const scope = root === document.body || root === document.documentElement ? document : root;
  const sheets =
    scope.querySelectorAll?.('body > section, body > main, #main, [role="main"]') || [];
  let stamped = 0;
  for (const el of sheets) {
    if (isOwnedByGmixer(el)) continue;
    if (el.hasAttribute(ROLE_ATTR) || el.hasAttribute(MEDIA_ATTR)) continue;
    if (!isDistinctSheetBackground(el)) continue;
    if (typeof el.getBoundingClientRect === 'function') {
      const rect = el.getBoundingClientRect();
      if (rect.width < 120 || rect.height < 80) continue;
    }
    stamp(el, result('surface', 0.78, ['opaque page sheet']));
    stamped += 1;
  }

  const start =
    root === document.body || root === document.documentElement
      ? document.body
      : root.nodeType === 1 || isShadowRoot(root)
        ? root
        : null;
  if (!start || typeof start.children === 'undefined') return stamped;

  /**
   * @param {Element} el
   */
  function consider(el) {
    if (!el || el.nodeType !== 1) return;
    if (el === document.body || el === document.documentElement) return;
    if (SHEET_SKIP_TAGS.has(el.tagName) || isOwnedByGmixer(el)) return;
    if (el.hasAttribute(ROLE_ATTR) || el.hasAttribute(MEDIA_ATTR)) return;
    if (typeof getComputedStyle === 'function') {
      const style = getComputedStyle(el);
      if (stampCanvasWash(el, style)) return;
      if (!isDistinctSheetBackground(el, style) || !isLargePaintedSheet(el)) return;
    } else if (!isDistinctSheetBackground(el) || !isLargePaintedSheet(el)) {
      return;
    }
    if (typeof el.getBoundingClientRect === 'function' && coversOrStripsMedia(el, el.getBoundingClientRect())) {
      return;
    }
    stamp(el, result('surface', 0.78, ['opaque page sheet']));
    stamped += 1;
  }

  // Mutation subtree passes receive the added node itself (e.g. a hydrated
  // `body > div.bg-white` or a list row). Walk only sees children.
  consider(start);

  let budget = SHEET_WALK_BUDGET;
  /**
   * Previous-route SPA shells stay in the tree as `display:none`. Recursing
   * into them burns the walk budget before a later visible sibling (Google
   * News `c-wiz` topic pages) is considered.
   * @param {Element} el
   */
  function isCollapsedPaintShell(el) {
    if (typeof getComputedStyle === 'function') {
      const display = String(getComputedStyle(el).display || '');
      if (display === 'none') return true;
    }
    if (typeof el.getBoundingClientRect === 'function') {
      const rect = el.getBoundingClientRect();
      if ((rect.width || 0) < 1 && (rect.height || 0) < 1) return true;
    }
    return false;
  }
  /**
   * @param {Element} el
   * @param {number} depth
   */
  function walk(el, depth) {
    if (budget <= 0 || depth > SHEET_MAX_DEPTH) return;
    const children = el.children;
    if (!children) return;
    for (let i = 0; i < children.length; i += 1) {
      if (budget <= 0) return;
      const child = children[i];
      if (SHEET_SKIP_TAGS.has(child.tagName) || isOwnedByGmixer(child)) continue;
      budget -= 1;
      if (isCollapsedPaintShell(child)) continue;
      consider(child);
      walk(child, depth + 1);
    }
  }
  walk(start, 0);

  // DFS spends the budget on the first column of a long feed. Also consider
  // sizable boxes anywhere under start so later sidebar slabs are not starved.
  const extras = start.querySelectorAll?.('div, aside, section, article') || [];
  for (const el of extras) {
    if (el.hasAttribute?.(ROLE_ATTR) || el.hasAttribute?.(MEDIA_ATTR)) continue;
    if (typeof el.getBoundingClientRect === 'function' && !isLargePaintedSheet(el)) continue;
    consider(el);
  }
  // Direct children again: custom-element page shells (`c-wiz`) are not in
  // the extras selector, and a hidden previous sibling can exhaust DFS.
  const kids = start.children;
  if (kids) {
    for (let i = 0; i < kids.length; i += 1) {
      consider(kids[i]);
    }
  }

  return stamped;
}

/**
 * Rank stamped surfaces by captured native luminance and assign tone steps.
 * Step 0 = originally darkest; higher = originally lighter. Theme CSS maps
 * steps onto an elevated surface ladder so Light|Gray|Dark keep relative depth.
 *
 * @param {ParentNode} root
 * @param {number} [steps]
 * @returns {number} number of elements that received a tone step
 */
export function assignToneSteps(root = document.body, steps = SURFACE_LADDER_STEPS) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  const stepCount = Math.max(1, Math.min(6, steps | 0));
  const ranked = [];
  for (const el of root.querySelectorAll(`[${ROLE_ATTR}]`)) {
    const role = el.getAttribute(ROLE_ATTR) || '';
    if (!TONE_RANK_ROLES.has(role) && !CHROME_TONE_RANK_ROLES.has(role)) continue;
    let lum = parseFloat(el.getAttribute(NATIVE_L_ATTR) || '');
    if (Number.isNaN(lum)) {
      captureNativeLuminance(el);
      lum = parseFloat(el.getAttribute(NATIVE_L_ATTR) || '');
    }
    if (Number.isNaN(lum)) continue;
    ranked.push({ el, lum });
  }
  if (!ranked.length) return 0;

  const assignGroup = (items) => {
    items.sort((a, b) => a.lum - b.lum || 0);
    const clusters = [];
    for (const item of items) {
      const cluster = clusters.at(-1);
      if (!cluster || Math.abs(item.lum - cluster.mean) > 0.02) {
        clusters.push({ mean: item.lum, items: [item] });
      } else {
        cluster.items.push(item);
        cluster.mean =
          cluster.items.reduce((sum, current) => sum + current.lum, 0) /
          cluster.items.length;
      }
    }
    clusters.forEach((cluster, index) => {
      const step =
        clusters.length === 1
          ? Math.floor((stepCount - 1) / 2)
          : Math.round((index / (clusters.length - 1)) * (stepCount - 1));
      for (const item of cluster.items) {
        item.el.setAttribute(TONE_STEP_ATTR, String(step));
      }
    });
  };
  assignGroup(ranked.filter(({ el }) => TONE_RANK_ROLES.has(el.getAttribute(ROLE_ATTR) || '')));
  assignGroup(
    ranked.filter(({ el }) => CHROME_TONE_RANK_ROLES.has(el.getAttribute(ROLE_ATTR) || ''))
  );
  return ranked.length;
}

/**
 * Stamp high-confidence structural/media roles under `root` (defaults to body).
 * Safe to call repeatedly — attributes are idempotent.
 *
 * @param {ParentNode} [root]
 * @param {{ skipClassified?: boolean }} [options]
 *   When true (incremental mutation pass), already-stamped nodes keep their
 *   attributes so we don't clear/restamp and re-run getComputedStyle on them.
 * @returns {{ stamped: number, scanned: number, surfaces: number, toneSteps: number }}
 */
function classifyOneTree(root, options = {}, budget = { remaining: MAX_SCAN }) {
  const skipClassified = options.skipClassified === true;
  let stamped = 0;
  let scanned = 0;
  /** @type {{ el: Element, classification: ReturnType<typeof classifyElement> }[]} */
  const pending = [];
  for (const el of elementsUnder(root)) {
    if (budget.remaining <= 0) break;
    if (isOwnedByGmixer(el)) continue;
    budget.remaining -= 1;
    scanned += 1;
    if (skipClassified && (el.hasAttribute(ROLE_ATTR) || el.hasAttribute(MEDIA_ATTR))) {
      const role = el.getAttribute(ROLE_ATTR);
      if (el.hasAttribute(MEDIA_ATTR) || role === 'surface' || !isOverlayPanel(el)) {
        continue;
      }
    }
    pending.push({ el, classification: classifyElement(el) });
  }
  for (const { el, classification } of pending) {
    if (!skipClassified) clearClassification(el);
    if (classification) {
      stamp(el, classification);
      stamped += 1;
    }
  }

  const sheets = seedPageSheets(root);
  let surfaces = promotePaintedSurfaces(root);
  // SPA widgets often land under an already-classified sidebar after the
  // first pass. Re-promote that small host so new opaque cards get stamped
  // without re-walking the main feed.
  if (root.nodeType === 1) {
    const host = /** @type {Element} */ (root).closest?.(`[${ROLE_ATTR}]`);
    if (host && host.getAttribute(ROLE_ATTR) === 'sidebar') {
      surfaces += promotePaintedSurfaces(host);
    }
  }
  stampOpaquePaintTargets(root);
  stampCoveringPseudoFills(root);
  return {
    stamped: stamped + surfaces + sheets,
    scanned,
    surfaces: surfaces + sheets,
    toneSteps: 0,
  };
}

export function classifySubtree(root = document.body, options = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') {
    return { stamped: 0, scanned: 0, surfaces: 0, toneSteps: 0 };
  }

  /** @type {(ParentNode|Element|ShadowRoot)[]} */
  const trees = [root];
  const rootNode = typeof root.getRootNode === 'function' ? root.getRootNode() : null;
  // A mutation inside an open shadow is often a tiny child. Re-seed the
  // whole shadow so the painted wrapper can stamp after it gets size.
  if (isShadowRoot(rootNode) && rootNode !== root) trees.push(rootNode);
  for (const shadow of collectOpenShadowRoots(root)) trees.push(shadow);

  const seen = new Set();
  const budget = { remaining: MAX_SCAN };
  const totals = { stamped: 0, scanned: 0, surfaces: 0, toneSteps: 0 };
  for (const tree of trees) {
    if (!tree || seen.has(tree)) continue;
    seen.add(tree);
    const sub = classifyOneTree(tree, options, budget);
    totals.stamped += sub.stamped;
    totals.scanned += sub.scanned;
    totals.surfaces += sub.surfaces;
  }
  if (budget.remaining <= 0) analysisDiagnostics.scanCapHits += 1;
  const rankingRoots = new Set();
  for (const tree of seen) {
    const node = tree?.getRootNode?.();
    if (isShadowRoot(tree)) rankingRoots.add(tree);
    else if (isShadowRoot(node)) rankingRoots.add(node);
    else if (typeof document !== 'undefined' && document.body) rankingRoots.add(document.body);
    else rankingRoots.add(tree);
  }
  for (const rankingRoot of rankingRoots) {
    totals.toneSteps += assignToneSteps(rankingRoot);
  }
  return totals;
}

/** Full-document adaptive classification entry point. */
export function classifyPage() {
  return classifySubtree(document.body);
}
