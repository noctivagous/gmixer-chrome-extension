/** Per-category Effects catalog. */

/**
 * Chrome effects (glow / drop-glow / marquee / flash / shimmer).
 * Glow is a centered halo; drop-glow is the same color, offset down-right.
 * Image motion (pan-scan, rotating-cube) lives on `categories.images.motion`.
 * @typedef {'none' | 'glow' | 'drop-glow' | 'marquee' | 'flash' | 'link-shimmer' | 'pan-scan' | 'rotating-cube'} EffectId
 * @typedef {'none' | 'pan-scan' | 'rotating-cube'} ImageMotionId
 * @typedef {'images' | 'videos' | 'hyperlinks' | 'navigation' | 'articles'} EffectCategoryId
 * @typedef {{ animated: boolean, color: string }} GlowParams
 */

const IMAGE_MOTION_IDS = new Set(['pan-scan', 'rotating-cube']);

/** Internal image motion — own dropdown, not mixed with glow/shadow/marquee. */
export const IMAGE_MOTION_EFFECTS = [
  { id: 'none', label: 'None' },
  { id: 'pan-scan', label: 'Pan & scan' },
  { id: 'rotating-cube', label: 'Rotating cube' },
];

/** @type {Record<EffectCategoryId, { label: string, effects: { id: EffectId, label: string }[] }>} */
export const EFFECT_CATEGORIES = {
  images: {
    label: 'Images',
    effects: [
      { id: 'none', label: 'None' },
      { id: 'glow', label: 'Glow' },
      { id: 'drop-glow', label: 'Drop glow' },
      { id: 'marquee', label: 'Marquee outline' },
    ],
  },
  videos: {
    label: 'Videos',
    effects: [
      { id: 'none', label: 'None' },
      { id: 'glow', label: 'Glow' },
      { id: 'drop-glow', label: 'Drop glow' },
      { id: 'marquee', label: 'Marquee outline' },
    ],
  },
  hyperlinks: {
    label: 'Body links',
    effects: [
      { id: 'none', label: 'None' },
      { id: 'glow', label: 'Glow' },
      { id: 'drop-glow', label: 'Drop glow' },
      { id: 'flash', label: 'Flash' },
    ],
  },
  navigation: {
    label: 'Navigation',
    effects: [
      { id: 'none', label: 'None' },
      { id: 'glow', label: 'Glow' },
      { id: 'drop-glow', label: 'Drop glow' },
      { id: 'flash', label: 'Flash' },
    ],
  },
  articles: {
    label: 'Articles',
    effects: [
      { id: 'none', label: 'None' },
      { id: 'drop-glow', label: 'Drop glow' },
      { id: 'marquee', label: 'Marquee outline' },
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
      images: {
        effect: /** @type {EffectId} */ ('none'),
        motion: /** @type {ImageMotionId} */ ('none'),
      },
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
  const splitImages = splitImageChromeAndMotion(raw.categories?.images);
  const categories = {
    images: splitImages,
    videos: { effect: aliasChromeEffect(raw.categories?.videos?.effect) },
    hyperlinks: {
      effect: aliasChromeEffect(raw.categories?.hyperlinks?.effect),
      glow: normalizeGlow(raw.categories?.hyperlinks?.glow),
    },
    navigation: {
      effect: aliasChromeEffect(raw.categories?.navigation?.effect),
      // Pre-split saved state stored nav glow on the shared `effects.glow`.
      glow: normalizeGlow(raw.categories?.navigation?.glow, sharedGlow),
    },
    articles: { effect: aliasChromeEffect(raw.categories?.articles?.effect) },
  };

  for (const [cat, meta] of Object.entries(EFFECT_CATEGORIES)) {
    const allowed = new Set(meta.effects.map((e) => e.id));
    if (!allowed.has(categories[cat].effect)) {
      categories[cat].effect = 'none';
    }
  }
  if (!IMAGE_MOTION_IDS.has(categories.images.motion)) {
    categories.images.motion = 'none';
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

/** Glow (centered) or drop-glow (offset) — both use the glow color controls. */
export function isGlowLike(effect) {
  return effect === 'glow' || effect === 'drop-glow';
}

/** True when images, videos, or articles use glow / drop-glow. */
export function mediaUsesGlow(effects) {
  const normalized = normalizeEffects(effects);
  return (
    isGlowLike(normalized.categories.images.effect) ||
    isGlowLike(normalized.categories.videos.effect) ||
    isGlowLike(normalized.categories.articles.effect)
  );
}

/** True when any category uses glow or drop-glow. */
export function anyCategoryUsesGlow(effects) {
  const normalized = normalizeEffects(effects);
  return Object.values(normalized.categories).some((slot) => isGlowLike(slot.effect));
}

/** True when a specific category uses glow or drop-glow. */
export function categoryUsesGlow(effects, categoryId) {
  return isGlowLike(normalizeEffects(effects).categories[categoryId]?.effect);
}

/** True when Articles link-shimmer should run. */
export function isLinkShimmerEnabled(effects) {
  return normalizeEffects(effects).categories.articles.effect === 'link-shimmer';
}

/**
 * Pre-split saved state stored pan-scan / rotating-cube on `images.effect`.
 * @param {{ effect?: string, motion?: string }|null|undefined} raw
 */
function aliasChromeEffect(effect) {
  if (effect === 'drop-shadow') return 'drop-glow';
  return effect || 'none';
}

function splitImageChromeAndMotion(raw) {
  const effect = aliasChromeEffect(raw?.effect);
  const motion = raw?.motion || 'none';
  if (IMAGE_MOTION_IDS.has(effect)) {
    return {
      effect: /** @type {EffectId} */ ('none'),
      motion: /** @type {ImageMotionId} */ (
        IMAGE_MOTION_IDS.has(motion) ? motion : effect
      ),
    };
  }
  return {
    effect,
    motion: IMAGE_MOTION_IDS.has(motion) ? motion : 'none',
  };
}

/** Image motion id (pan-scan / rotating-cube / none). */
export function imageMotion(effects) {
  return normalizeEffects(effects).categories.images.motion || 'none';
}
