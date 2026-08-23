// Adaptive page/media classifiers (document_end only).
//
// document_start must stay a static CSS paint — never import or call this
// from content-start.js. Classification walks the live DOM, stamps semantic
// roles for the restyle engine, and is re-run on newly added subtrees by the
// MutationObserver.
//
export const ROLE_ATTR = 'data-gmixer-role';
export const MEDIA_ATTR = 'data-gmixer-media';
export const CONFIDENCE_ATTR = 'data-gmixer-confidence';
export const REASONS_ATTR = 'data-gmixer-reasons';

export const CLASSIFIER_CONFIDENCE_THRESHOLD = 0.7;
const MAX_SCAN = 2500;
const classificationCache = new WeakMap();

const STRUCTURAL_RULES = [
  { role: 'main', tags: ['MAIN'], aria: ['main'], tokens: ['main', 'content'] },
  { role: 'article', tags: ['ARTICLE'], aria: ['article'], tokens: ['article', 'story', 'post'] },
  { role: 'sidebar', tags: ['ASIDE'], aria: ['complementary'], tokens: ['sidebar', 'rail'] },
  { role: 'navigation', tags: ['NAV'], aria: ['navigation'], tokens: ['nav', 'menu'] },
  { role: 'header', tags: ['HEADER'], aria: ['banner'], tokens: ['header', 'masthead'] },
  { role: 'footer', tags: ['FOOTER'], aria: ['contentinfo'], tokens: ['footer'] },
  { role: 'hero', tags: [], aria: [], tokens: ['hero', 'jumbotron', 'masthead', 'feature'] },
  { role: 'card', tags: [], aria: ['group'], tokens: ['card', 'tile', 'teaser', 'portlet'] },
  { role: 'article-body', tags: [], aria: [], tokens: ['article-body', 'entry-content', 'post-content', 'prose'] },
];

const MEDIA_TAGS = new Set(['IMG', 'VIDEO']);
const TOKEN_RE = /[\s_-]+/;

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
  const raw = `${el.id || ''} ${el.getAttribute?.('class') || ''} ${el.getAttribute?.('aria-label') || ''}`;
  return raw.toLowerCase().split(TOKEN_RE).filter(Boolean);
}

function hasToken(tokens, candidates) {
  return candidates.some((token) => tokens.includes(token) || tokens.some((value) => value.includes(token)));
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

function stamp(el, classification) {
  if (classification.role) el.setAttribute(ROLE_ATTR, classification.role);
  if (classification.media) el.setAttribute(MEDIA_ATTR, classification.media);
  el.setAttribute(CONFIDENCE_ATTR, classification.confidence.toFixed(2));
  el.setAttribute(REASONS_ATTR, classification.reasons.join('; '));
}

function clearClassification(el) {
  el.removeAttribute(ROLE_ATTR);
  el.removeAttribute(MEDIA_ATTR);
  el.removeAttribute(CONFIDENCE_ATTR);
  el.removeAttribute(REASONS_ATTR);
}

function elementsUnder(root) {
  if (!root || typeof root.querySelectorAll !== 'function') return [];
  const descendants = Array.from(root.querySelectorAll('*'));
  return root.nodeType === 1 ? [root, ...descendants] : descendants;
}

/**
 * Stamp high-confidence structural/media roles under `root` (defaults to body).
 * Safe to call repeatedly — attributes are idempotent.
 *
 * @param {ParentNode} [root]
 * @returns {{ stamped: number, scanned: number }}
 */
export function classifySubtree(root = document.body) {
  if (!root || typeof root.querySelectorAll !== 'function') {
    return { stamped: 0, scanned: 0 };
  }

  let stamped = 0;
  let scanned = 0;
  for (const el of elementsUnder(root)) {
    if (scanned >= MAX_SCAN) break;
    if (!isOwnedByGmixer(el)) {
      scanned += 1;
      clearClassification(el);
      const classification = classifyElement(el);
      if (classification) {
        stamp(el, classification);
        stamped += 1;
      }
    }
  }

  return { stamped, scanned };
}

/** Full-document adaptive classification entry point. */
export function classifyPage() {
  return classifySubtree(document.body);
}
