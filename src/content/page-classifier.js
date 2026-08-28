// Adaptive page/media classifiers (document_end only).
//
// document_start must stay a static CSS paint — never import or call this
// from content-start.js. Classification walks the live DOM, stamps semantic
// roles for the restyle engine, and is re-run on newly added subtrees by the
// MutationObserver.
//
import { MAX_CLASSIFIER_SCAN } from './scan-limits.js';

export const ROLE_ATTR = 'data-gmixer-role';
export const MEDIA_ATTR = 'data-gmixer-media';
export const CONFIDENCE_ATTR = 'data-gmixer-confidence';
export const REASONS_ATTR = 'data-gmixer-reasons';
/** Native relative luminance 0..1 captured while site styles are visible. */
export const NATIVE_L_ATTR = 'data-gmixer-native-l';
/** Ranked tone step 0..N-1 (0 = originally darkest among ranked surfaces). */
export const TONE_STEP_ATTR = 'data-gmixer-tone-step';

export const CLASSIFIER_CONFIDENCE_THRESHOLD = 0.7;
export const SURFACE_LADDER_STEPS = 3;

/** Roles that participate in ranked tonal remapping. */
const TONE_RANK_ROLES = new Set([
  'surface',
  'article',
  'article-body',
  'card',
  'header',
  'navigation',
  'sidebar',
  'hero',
  'main',
]);
const MAX_SCAN = MAX_CLASSIFIER_SCAN;
const classificationCache = new WeakMap();

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
]);

const SURFACE_HOST_PRIORITY = {
  article: 0,
  'article-body': 1,
  card: 2,
  hero: 3,
  sidebar: 4,
  main: 5,
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

const MEDIA_TAGS = new Set(['IMG', 'VIDEO']);
const TOKEN_RE = /[\s_-]+/;
const SURFACE_PROMOTE_MAX_DEPTH = 3;
const SURFACE_PROMOTE_MIN_WIDTH = 40;
const SURFACE_PROMOTE_MIN_HEIGHT = 16;

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
    el.closest?.('#gmixer-settings') ||
    el.id === 'gmixer-settings' ||
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
  const raw = `${el.id || ''} ${el.getAttribute?.('class') || ''} ${el.getAttribute?.('aria-label') || ''}`;
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
export function classifyElement(el) {
  if (!el || isOwnedByGmixer(el)) return null;
  const key = cacheKey(el);
  const cached = classificationCache.get(el);
  if (cached?.key === key) return cached.value;

  const tag = el.tagName;
  const ariaRole = (el.getAttribute?.('role') || '').toLowerCase();
  const tokens = tokensFor(el);

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

  if (MEDIA_TAGS.has(tag)) {
    const parentTokens = tokensFor(el.parentElement);
    const ancestor = el.closest?.('article, [role="article"], .article, .post, .entry-content');
    const ancestorTokens = tokensFor(ancestor);
    const allTokens = [...tokens, ...parentTokens, ...ancestorTokens];
    const reasons = [];
    let confidence = 0;

    if (tag === 'VIDEO') {
      confidence = 0.96;
      reasons.push('video element');
    }
    if (hasToken(allTokens, ['video', 'thumbnail', 'thumb', 'poster', 'play'])) {
      confidence = Math.max(confidence, 0.88);
      reasons.push('video/thumbnail/play naming cue');
    }
    if (tag === 'IMG' && ancestor) {
      confidence = Math.max(confidence, 0.86);
      reasons.push('image nested in article');
    }
    if (hasToken(allTokens, ['avatar', 'profile', 'author', 'user'])) {
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
    if (confidence >= CLASSIFIER_CONFIDENCE_THRESHOLD) {
      const value = { media: ancestor ? 'article-image' : 'video-thumbnail', confidence, reasons };
      classificationCache.set(el, { key, value });
      return value;
    }
  }

  if (tag !== 'IMG' && tag !== 'VIDEO') {
    if (typeof getComputedStyle === 'function') {
      const style = getComputedStyle(el);
      if (style.backgroundImage && style.backgroundImage !== 'none') {
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

function relativeLuminanceFromCss(bg) {
  const rgba = (bg || '').match(
    /rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i
  );
  if (!rgba) return null;
  if (rgba[4] !== undefined) {
    const alpha = parseFloat(rgba[4]);
    if (!Number.isNaN(alpha)) {
      const a = String(rgba[4]).includes('%') ? alpha / 100 : alpha;
      if (a <= 0) return null;
    }
  }
  const r = +rgba[1] / 255;
  const g = +rgba[2] / 255;
  const b = +rgba[3] / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function captureNativeLuminance(el) {
  if (typeof getComputedStyle !== 'function') return;
  const lum = relativeLuminanceFromCss(getComputedStyle(el).backgroundColor || '');
  if (lum == null) return;
  el.setAttribute(NATIVE_L_ATTR, lum.toFixed(4));
}

/**
 * Selectors that roleCss may fill. Opaque-only paint requires
 * {@link NATIVE_L_ATTR} on these hosts; stamp it here for opaque natives
 * (including body > section sheets that never got a structural role).
 */
const OPAQUE_PAINT_TARGET_SELECTORS = [
  'body > header',
  'body > footer',
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
  'body [role="textbox"]',
  'body [role="searchbox"]',
  'body [role="combobox"]',
  'body [role="button"]',
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
  let stamped = 0;
  for (const el of nodes) {
    if (isOwnedByGmixer(el)) continue;
    if (isOpaqueBackground(el)) {
      const had = el.hasAttribute(NATIVE_L_ATTR);
      captureNativeLuminance(el);
      if (!had && el.hasAttribute(NATIVE_L_ATTR)) stamped += 1;
    } else {
      // Transparent layout hosts must not keep a fill gate.
      el.removeAttribute(NATIVE_L_ATTR);
      el.removeAttribute(TONE_STEP_ATTR);
    }
  }
  return stamped;
}

function stamp(el, classification) {
  if (classification.role) el.setAttribute(ROLE_ATTR, classification.role);
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
  el.removeAttribute(CONFIDENCE_ATTR);
  el.removeAttribute(REASONS_ATTR);
  el.removeAttribute(NATIVE_L_ATTR);
  el.removeAttribute(TONE_STEP_ATTR);
}

function elementsUnder(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const descendants = Array.from(root.querySelectorAll('*'));
  return root.nodeType === 1 ? [root, ...descendants] : descendants;
}

function isOpaqueBackground(el) {
  if (typeof getComputedStyle !== 'function') return false;
  const bg = getComputedStyle(el).backgroundColor || '';
  if (!bg || bg === 'transparent') return false;
  const rgba = bg.match(
    /rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/i
  );
  if (!rgba) return true;
  if (rgba[4] === undefined) return true;
  const alpha = parseFloat(rgba[4]);
  if (Number.isNaN(alpha)) return true;
  // css opacity channel: 0 or 0% is transparent; 1 or 100% is opaque
  if (String(rgba[4]).includes('%')) return alpha > 0;
  return alpha > 0;
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
   */
  function visit(host, hostRole, el, depth) {
    if (budget <= 0) return;
    if (depth > SURFACE_PROMOTE_MAX_DEPTH) return;

    // Nested classified hosts (e.g. header inside article) get their own pass.
    const nestedRole = depth >= 1 ? el.getAttribute?.(ROLE_ATTR) : null;
    if (nestedRole && SURFACE_HOST_ROLES.has(nestedRole)) return;

    budget -= 1;

    if (
      depth >= 1 &&
      !isOwnedByGmixer(el) &&
      !SURFACE_SKIP_TAGS.has(el.tagName) &&
      !el.hasAttribute(ROLE_ATTR) &&
      !el.hasAttribute(MEDIA_ATTR) &&
      isOpaqueBackground(el)
    ) {
      let sizedOk = true;
      if (typeof el.getBoundingClientRect === 'function') {
        const rect = el.getBoundingClientRect();
        sizedOk =
          rect.width >= SURFACE_PROMOTE_MIN_WIDTH && rect.height >= SURFACE_PROMOTE_MIN_HEIGHT;
      }
      if (sizedOk) {
        stamp(el, result('surface', 0.8, [`opaque surface inside ${hostRole}`]));
        stamped += 1;
      }
    }

    if (depth >= SURFACE_PROMOTE_MAX_DEPTH) return;
    const children = el.children;
    if (!children) return;
    for (let i = 0; i < children.length; i += 1) {
      visit(host, hostRole, children[i], depth + 1);
      if (budget <= 0) return;
    }
  }

  for (const host of hosts) {
    if (budget <= 0) break;
    const hostRole = host.getAttribute(ROLE_ATTR) || '';
    const children = host.children;
    if (!children) continue;
    for (let i = 0; i < children.length; i += 1) {
      visit(host, hostRole, children[i], 1);
      if (budget <= 0) break;
    }
  }
  return stamped;
}

/**
 * Seed large page sheets (e.g. body > section white canvases) that are opaque
 * but were not stamped by structural rules.
 *
 * @param {ParentNode} root
 * @returns {number}
 */
function seedPageSheets(root) {
  if (typeof document === 'undefined') return 0;
  const scope = root === document.body || root === document.documentElement ? document : root;
  const sheets =
    scope.querySelectorAll?.('body > section, body > main, #main, [role="main"]') || [];
  let stamped = 0;
  for (const el of sheets) {
    if (isOwnedByGmixer(el)) continue;
    if (el.hasAttribute(ROLE_ATTR) || el.hasAttribute(MEDIA_ATTR)) continue;
    if (!isOpaqueBackground(el)) continue;
    if (typeof el.getBoundingClientRect === 'function') {
      const rect = el.getBoundingClientRect();
      if (rect.width < 120 || rect.height < 80) continue;
    }
    stamp(el, result('surface', 0.78, ['opaque page sheet']));
    stamped += 1;
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
    if (!TONE_RANK_ROLES.has(role)) continue;
    let lum = parseFloat(el.getAttribute(NATIVE_L_ATTR) || '');
    if (Number.isNaN(lum)) {
      captureNativeLuminance(el);
      lum = parseFloat(el.getAttribute(NATIVE_L_ATTR) || '');
    }
    if (Number.isNaN(lum)) continue;
    ranked.push({ el, lum });
  }
  if (!ranked.length) return 0;

  ranked.sort((a, b) => a.lum - b.lum || 0);
  ranked.forEach((item, index) => {
    const step = Math.min(
      stepCount - 1,
      Math.floor((index / ranked.length) * stepCount)
    );
    item.el.setAttribute(TONE_STEP_ATTR, String(step));
  });
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
export function classifySubtree(root = document.body, options = {}) {
  if (!root || typeof root.querySelectorAll !== 'function') {
    return { stamped: 0, scanned: 0, surfaces: 0, toneSteps: 0 };
  }

  const skipClassified = options.skipClassified === true;
  let stamped = 0;
  let scanned = 0;
  for (const el of elementsUnder(root)) {
    if (scanned >= MAX_SCAN) break;
    if (!isOwnedByGmixer(el)) {
      scanned += 1;
      if (skipClassified && (el.hasAttribute(ROLE_ATTR) || el.hasAttribute(MEDIA_ATTR))) {
        continue;
      }
      clearClassification(el);
      const classification = classifyElement(el);
      if (classification) {
        stamp(el, classification);
        stamped += 1;
      }
    }
  }

  const sheets = seedPageSheets(root);
  const surfaces = promotePaintedSurfaces(root);
  stampOpaquePaintTargets(root);
  const toneSteps = assignToneSteps(root);
  return {
    stamped: stamped + surfaces + sheets,
    scanned,
    surfaces: surfaces + sheets,
    toneSteps,
  };
}

/** Full-document adaptive classification entry point. */
export function classifyPage() {
  return classifySubtree(document.body);
}
