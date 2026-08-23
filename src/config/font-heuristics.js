/**
 * Typography heuristics for the font catalog.
 *
 * - usage: where a face is intended (display / text / both)
 * - longForm: safe for paragraph-length reading
 * - textSafe: false for dingbats / ornament fonts
 * - pairGroup: optional pack id (e.g. DIN family)
 *
 * Role policy (when showAll is false):
 * - headers:      usage display | both               (hero / h1)
 * - subheadings:  usage display | both                (h2-h6 — same policy as headers,
 *                 kept as its own role so a theme can size/weight-differentiate it)
 * - paragraph:    usage text | both, and longForm       (long-form prose)
 * - ui:           usage text | both                     (buttons/nav/forms — short strings,
 *                 doesn't need longForm safety)
 * - code:         technical / system / typewriter categories (monospace-adjacent)
 * - captions:     usage text | both, or personality categories (script / typewriter / display)
 */

/** @typedef {'display'|'text'|'both'} FontUsage */
/** @typedef {'headers'|'subheadings'|'paragraph'|'ui'|'code'|'captions'} TypographyTarget */

/**
 * @typedef {object} FontHeuristics
 * @property {FontUsage} usage
 * @property {boolean} longForm
 * @property {boolean} [textSafe]
 * @property {string} [pairGroup]
 */

/** @type {Record<string, FontHeuristics>} */
export const CATEGORY_HEURISTICS = {
  system: { usage: 'both', longForm: true, textSafe: true },
  technical: { usage: 'both', longForm: true, textSafe: true },
  serif: { usage: 'both', longForm: true, textSafe: true },
  typewriter: { usage: 'both', longForm: true, textSafe: true },
  script: { usage: 'display', longForm: false, textSafe: true },
  blackletter: { usage: 'display', longForm: false, textSafe: true },
  stencil: { usage: 'display', longForm: false, textSafe: true },
  matrix: { usage: 'display', longForm: false, textSafe: true },
  display: { usage: 'display', longForm: false, textSafe: true },
};

/** Per-id overrides on top of category defaults. */
/** @type {Record<string, Partial<FontHeuristics>>} */
export const FONT_HEURISTIC_OVERRIDES = {
  'system-display': { usage: 'display', longForm: false },
  'system-body': { usage: 'text', longForm: true },
  'system-mono': { usage: 'both', longForm: true },

  // School / round cursives — readable enough for short body or captions.
  schulkursiv: { usage: 'both', longForm: true },
  rundkursiv: { usage: 'both', longForm: true },

  // Specialty technical — OK for UI chrome / captions, not long paragraphs.
  eyechart: { usage: 'both', longForm: false },
  googee: { usage: 'both', longForm: false },
  'gst-aero': { usage: 'both', longForm: false },
  'kk-bahn': { usage: 'both', longForm: false },
  'elb-tunnel': { usage: 'both', longForm: false },
  'stefans-uhr': { usage: 'both', longForm: false },

  // Ornament / dingbat — never for reading text.
  youbilee: { usage: 'display', longForm: false, textSafe: false },

  // DIN family pack.
  'alte-din-1451': { pairGroup: 'din' },
  'din-1451-h': { pairGroup: 'din' },
  'din-breit': { pairGroup: 'din' },
  'tgl-0-1451': { pairGroup: 'din' },

  // Google Fonts — display serifs for headers; text faces for body/captions.
  'playfair-display': { usage: 'display', longForm: false, pairGroup: 'editorial' },
  'cormorant-garamond': { usage: 'both', longForm: false, pairGroup: 'atelier' },
  lora: { usage: 'both', longForm: true, pairGroup: 'editorial' },
  'source-sans-3': { usage: 'text', longForm: true, pairGroup: 'editorial' },
  raleway: { usage: 'both', longForm: true, pairGroup: 'atelier' },
  'space-grotesk': { usage: 'both', longForm: true, pairGroup: 'studio' },
  'dm-sans': { usage: 'text', longForm: true, pairGroup: 'studio' },
  outfit: { usage: 'both', longForm: true, pairGroup: 'studio' },
};

/** Categories allowed as "personality" captions even when usage is display. */
const CAPTION_PERSONALITY_CATEGORIES = new Set(['script', 'typewriter', 'display']);

/**
 * @param {{ id: string, category: string } & Record<string, unknown>} font
 * @returns {typeof font & FontHeuristics}
 */
export function enrichFontEntry(font) {
  const fromCat = CATEGORY_HEURISTICS[font.category] || {
    usage: /** @type {FontUsage} */ ('both'),
    longForm: false,
    textSafe: true,
  };
  const over = FONT_HEURISTIC_OVERRIDES[font.id] || {};
  return {
    ...font,
    usage: over.usage ?? fromCat.usage,
    longForm: over.longForm ?? fromCat.longForm,
    textSafe: over.textSafe ?? fromCat.textSafe ?? true,
    ...(over.pairGroup || fromCat.pairGroup
      ? { pairGroup: over.pairGroup ?? fromCat.pairGroup }
      : {}),
  };
}

/**
 * @param {{ usage: FontUsage, longForm: boolean, textSafe?: boolean, category: string }} font
 * @param {TypographyTarget} target
 * @param {{ showAll?: boolean }} [opts]
 */
/** Categories treated as monospace-adjacent for the `code` role. */
const CODE_SAFE_CATEGORIES = new Set(['technical', 'system', 'typewriter']);

export function isFontSuitableForTarget(font, target, opts = {}) {
  if (opts.showAll) return true;
  if (font.textSafe === false) return false;

  if (target === 'paragraph') {
    return (font.usage === 'text' || font.usage === 'both') && !!font.longForm;
  }

  if (target === 'headers' || target === 'subheadings') {
    return font.usage === 'display' || font.usage === 'both';
  }

  if (target === 'ui') {
    return font.usage === 'text' || font.usage === 'both';
  }

  if (target === 'code') {
    return CODE_SAFE_CATEGORIES.has(font.category);
  }

  if (target === 'captions') {
    if (font.usage === 'text' || font.usage === 'both') return true;
    return CAPTION_PERSONALITY_CATEGORIES.has(font.category);
  }

  return true;
}

/**
 * Short reason when a font is filtered out (for UI titles / hints).
 * @param {{ usage: FontUsage, longForm: boolean, textSafe?: boolean, category: string, label: string }} font
 * @param {TypographyTarget} target
 */
export function unsuitableReason(font, target) {
  if (font.textSafe === false) return 'Ornament / dingbat — not for reading text';
  if (target === 'paragraph') {
    if (font.usage === 'display') return 'Display face — not for body text (enable Show all to force)';
    if (!font.longForm) return 'Not suited to long paragraphs (enable Show all to force)';
  }
  if ((target === 'headers' || target === 'subheadings') && font.usage === 'text') {
    return 'Body-oriented face — headers prefer display (enable Show all to force)';
  }
  if (target === 'ui' && font.usage === 'display') {
    return 'Display face — UI chrome prefers text/both (enable Show all to force)';
  }
  if (target === 'code' && !CODE_SAFE_CATEGORIES.has(font.category)) {
    return 'Not a monospace-adjacent face — code prefers Sans/Technical, System, or Typewriter (enable Show all to force)';
  }
  if (target === 'captions' && font.usage === 'display' && !CAPTION_PERSONALITY_CATEGORIES.has(font.category)) {
    return 'Heavy display face — captions prefer text or script (enable Show all to force)';
  }
  return '';
}
