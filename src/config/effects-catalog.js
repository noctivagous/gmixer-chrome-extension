/** Per-category Effects catalog. */

/**
 * @typedef {'none' | 'glow' | 'pan-scan' | 'flash' | 'link-shimmer'} EffectId
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

  return {
    categories,
    glow: {
      animated: raw.glow?.animated !== false,
      color: typeof raw.glow?.color === 'string' ? raw.glow.color : '',
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

/** True when any category uses glow (for shared glow option UI). */
export function anyCategoryUsesGlow(effects) {
  const normalized = normalizeEffects(effects);
  return Object.values(normalized.categories).some((slot) => slot.effect === 'glow');
}

/** True when Articles link-shimmer should run. */
export function isLinkShimmerEnabled(effects) {
  return normalizeEffects(effects).categories.articles.effect === 'link-shimmer';
}
