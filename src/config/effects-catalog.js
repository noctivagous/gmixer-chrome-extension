/** Per-category Effects catalog. */

/**
 * @typedef {'none' | 'glow' | 'pan-scan' | 'rotating-cube' | 'flash' | 'link-shimmer'} EffectId
 * @typedef {'images' | 'videos' | 'hyperlinks' | 'navigation' | 'articles'} EffectCategoryId
 * @typedef {{ animated: boolean, color: string }} GlowParams
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
  hyperlinks: {
    label: 'Body links',
    effects: [
      { id: 'none', label: 'None' },
      { id: 'glow', label: 'Glow' },
      { id: 'flash', label: 'Flash' },
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

function defaultGlow() {
  return { animated: true, color: '' };
}

export function createDefaultEffects() {
  return {
    categories: {
      images: { effect: /** @type {EffectId} */ ('none') },
      videos: { effect: /** @type {EffectId} */ ('none') },
      hyperlinks: {
        effect: /** @type {EffectId} */ ('none'),
        glow: defaultGlow(),
      },
      navigation: {
        effect: /** @type {EffectId} */ ('none'),
        glow: defaultGlow(),
      },
      articles: { effect: /** @type {EffectId} */ ('none') },
    },
    glow: defaultGlow(),
    panScan: { speed: 16, zoom: 14, distance: 3, loop: 'fade', motion: 'scan' },
    cursor: { enabled: false, style: 'default' },
    backgroundMotion: { enabled: false },
  };
}

/**
 * @param {object|null|undefined} raw
 * @param {GlowParams} [fallback]
 * @returns {GlowParams}
 */
function normalizeGlow(raw, fallback = defaultGlow()) {
  const source = raw && typeof raw === 'object' ? raw : fallback;
  return {
    animated: source?.animated !== false,
    color: typeof source?.color === 'string' ? source.color : '',
  };
}

/**
 * Clamp effects to the current schema (invalid category effects → none).
 * @param {object|null|undefined} raw
 */
export function normalizeEffects(raw) {
  const defaults = createDefaultEffects();
  if (!raw || typeof raw !== 'object') return defaults;

  const sharedGlow = normalizeGlow(raw.glow);
  const categories = {
    images: { effect: raw.categories?.images?.effect || 'none' },
    videos: { effect: raw.categories?.videos?.effect || 'none' },
    hyperlinks: {
      effect: raw.categories?.hyperlinks?.effect || 'none',
      glow: normalizeGlow(raw.categories?.hyperlinks?.glow),
    },
    navigation: {
      effect: raw.categories?.navigation?.effect || 'none',
      // Pre-split saved state stored nav glow on the shared `effects.glow`.
      glow: normalizeGlow(raw.categories?.navigation?.glow, sharedGlow),
    },
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
    glow: sharedGlow,
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

/** True when images or videos use glow (shared media glow option UI). */
export function mediaUsesGlow(effects) {
  const normalized = normalizeEffects(effects);
  return (
    normalized.categories.images.effect === 'glow' ||
    normalized.categories.videos.effect === 'glow'
  );
}

/** True when any category uses glow. */
export function anyCategoryUsesGlow(effects) {
  const normalized = normalizeEffects(effects);
  return Object.values(normalized.categories).some((slot) => slot.effect === 'glow');
}

/** True when a specific category uses glow. */
export function categoryUsesGlow(effects, categoryId) {
  return normalizeEffects(effects).categories[categoryId]?.effect === 'glow';
}

/** True when Articles link-shimmer should run. */
export function isLinkShimmerEnabled(effects) {
  return normalizeEffects(effects).categories.articles.effect === 'link-shimmer';
}
