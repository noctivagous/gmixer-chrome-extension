/** Per-category Effects catalog. */

/**
 * @typedef {'none' | 'glow' | 'pan-scan' | 'rotating-cube' | 'flash' | 'link-shimmer'} EffectId
 * @typedef {'images' | 'videos' | 'navigation' | 'articles'} EffectCategoryId
 */

/** @type {Record<EffectCategoryId, { label: string, effects: { id: EffectId, label: string }[] }>} */
export const EFFECT_CATEGORIES = {
  images: {
    label: 'Images',
    effects: [
      { id: 'none', label: 'None' },
      { id: 'glow', label: 'Glow' },
      { id: 'pan-scan', label: 'Pan & scan' },
      { id: 'rotating-cube', label: 'Rotating cube' },
    ],
  },
  videos: {
    label: 'Videos',
    effects: [
      { id: 'none', label: 'None' },
      { id: 'glow', label: 'Glow' },
    ],
  },
  navigation: {
    label: 'Navigation',
    effects: [
      { id: 'none', label: 'None' },
      { id: 'glow', label: 'Glow' },
      { id: 'flash', label: 'Flash' },
    ],
  },
  articles: {
    label: 'Articles',
    effects: [
      { id: 'none', label: 'None' },
      { id: 'link-shimmer', label: 'Link shimmer' },
    ],
  },
};

export function createDefaultEffects() {
  return {
    categories: {
      images: { effect: /** @type {EffectId} */ ('none') },
      videos: { effect: /** @type {EffectId} */ ('none') },
      navigation: { effect: /** @type {EffectId} */ ('none') },
      articles: { effect: /** @type {EffectId} */ ('none') },
    },
    glow: { animated: true, color: '' },
    panScan: { speed: 16, zoom: 14, distance: 3, loop: 'fade', motion: 'scan' },
    cursor: { enabled: false, style: 'default' },
    backgroundMotion: { enabled: false },
  };
}

/**
 * Clamp effects to the current schema (invalid category effects → none).
 * @param {object|null|undefined} raw
 */
export function normalizeEffects(raw) {
  const defaults = createDefaultEffects();
  if (!raw || typeof raw !== 'object') return defaults;

  const categories = {
    images: { effect: raw.categories?.images?.effect || 'none' },
    videos: { effect: raw.categories?.videos?.effect || 'none' },
    navigation: { effect: raw.categories?.navigation?.effect || 'none' },
    articles: { effect: raw.categories?.articles?.effect || 'none' },
  };

  for (const [cat, meta] of Object.entries(EFFECT_CATEGORIES)) {
    const allowed = new Set(meta.effects.map((e) => e.id));
    if (!allowed.has(categories[cat].effect)) {
      categories[cat].effect = 'none';
    }
  }

  const loopRaw = raw.panScan?.loop;
  const loop = loopRaw === 'oscillate' ? 'oscillate' : 'fade';
  const motionRaw = raw.panScan?.motion;
  const motion =
    motionRaw === 'pan' || motionRaw === 'tilt' ? motionRaw : 'scan';

  return {
    categories,
    glow: {
      animated: raw.glow?.animated !== false,
      color: typeof raw.glow?.color === 'string' ? raw.glow.color : '',
    },
    panScan: {
      speed: clampNumber(raw.panScan?.speed, 4, 40, 16),
      zoom: clampNumber(raw.panScan?.zoom, 4, 40, 14),
      distance: clampNumber(raw.panScan?.distance, 0, 12, 3),
      loop,
      motion,
    },
    cursor: {
      enabled: !!raw.cursor?.enabled,
      style: typeof raw.cursor?.style === 'string' ? raw.cursor.style : 'default',
    },
    backgroundMotion: {
      enabled: !!raw.backgroundMotion?.enabled,
    },
  };
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

/** True when any category uses glow (for shared glow option UI). */
export function anyCategoryUsesGlow(effects) {
  const normalized = normalizeEffects(effects);
  return Object.values(normalized.categories).some((slot) => slot.effect === 'glow');
}

/** True when Articles link-shimmer should run. */
export function isLinkShimmerEnabled(effects) {
  return normalizeEffects(effects).categories.articles.effect === 'link-shimmer';
}
