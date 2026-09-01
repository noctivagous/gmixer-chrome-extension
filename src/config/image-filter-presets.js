/** Chroming Media presets + primary category catalog. */

/**
 * Palette-role color casts shown at the bottom of Chroming Media dropdowns.
 * Ids mirror Color swatch labels (`bg:secondary`, `surface:gui`, …).
 * @type {ReadonlyArray<{ id: string, label: string, role: string, requiresColor: true }>}
 */
export const COLOR_CAST_PRESETS = [
  { id: 'bg:primary', label: 'bg:primary', role: 'background', requiresColor: true },
  { id: 'bg:secondary', label: 'bg:secondary', role: 'backgroundSecondary', requiresColor: true },
  { id: 'surface:gui', label: 'surface:gui', role: 'surfaceGui', requiresColor: true },
  {
    id: 'surface:containers',
    label: 'surface:containers',
    role: 'surfaceContainers',
    requiresColor: true,
  },
  { id: 'text', label: 'text', role: 'text', requiresColor: true },
  { id: 'muted', label: 'muted', role: 'muted', requiresColor: true },
  { id: 'accent', label: 'accent', role: 'accent', requiresColor: true },
  { id: 'link', label: 'link', role: 'link', requiresColor: true },
  { id: 'nav', label: 'nav', role: 'navLink', requiresColor: true },
  { id: 'border', label: 'border', role: 'border', requiresColor: true },
  { id: 'focus', label: 'focus', role: 'focus', requiresColor: true },
];

/** @type {Readonly<Record<string, string>>} */
export const COLOR_CAST_ROLE_BY_PRESET = Object.freeze(
  Object.fromEntries(COLOR_CAST_PRESETS.map((preset) => [preset.id, preset.role]))
);

/** Presets that need Color-section palette roles (accent / link / surfaces). */
export const PALETTE_FILTER_PRESETS = new Set([
  'duotone',
  'accent-tint',
  'link-wash',
  ...COLOR_CAST_PRESETS.map((preset) => preset.id),
]);

/**
 * @typedef {string} ImageFilterPresetId
 * @typedef {'articleImages' | 'images' | 'bgImages' | 'covers' | 'avatars' | 'videos' | 'videoPlayback'} MediaFilterCategoryId
 * @typedef {Record<MediaFilterCategoryId, ImageFilterPresetId>} MediaFilterCategories
 * @typedef {{
 *   enabled: boolean,
 *   revealOnHover: boolean,
 *   customFilter: string,
 *   categories: MediaFilterCategories,
 *   preset?: string,
 *   scope?: string,
 * }} ImageFilterSettings
 */

/** @type {ReadonlyArray<{ id: ImageFilterPresetId, label: string, requiresColor?: boolean }>} */
export const IMAGE_FILTER_PRESETS = [
  { id: 'none', label: 'none' },
  { id: 'grayscale', label: 'grayscale' },
  { id: 'sepia', label: 'sepia' },
  { id: 'invert', label: 'invert' },
  { id: 'monochrome', label: 'monochrome' },
  { id: 'duotone', label: 'duotone', requiresColor: true },
  { id: 'accent-tint', label: 'accent tint', requiresColor: true },
  { id: 'link-wash', label: 'link wash', requiresColor: true },
  // Surface / role color casts sit at the bottom of the list (before custom).
  ...COLOR_CAST_PRESETS,
  { id: 'custom', label: 'custom' },
];

/**
 * Resolve the palette hex a Chroming Media preset should cast toward.
 * @param {string} preset
 * @param {Record<string, string|boolean|undefined>|null|undefined} palette
 * @returns {string|null}
 */
export function paletteHexForFilterPreset(preset, palette) {
  if (!palette || typeof palette !== 'object') return null;
  if (preset === 'duotone' || preset === 'accent-tint' || preset === 'sepia') {
    return typeof palette.accent === 'string' ? palette.accent : null;
  }
  if (preset === 'link-wash') {
    if (typeof palette.link === 'string' && palette.link) return palette.link;
    return typeof palette.accent === 'string' ? palette.accent : null;
  }
  const role = COLOR_CAST_ROLE_BY_PRESET[preset];
  if (!role) return null;
  const direct = palette[role];
  if (typeof direct === 'string' && direct) return direct;
  // Legacy alias: older palettes expose `surface` for GUI.
  if (role === 'surfaceGui' && typeof palette.surface === 'string' && palette.surface) {
    return palette.surface;
  }
  if (role === 'link' && typeof palette.accent === 'string' && palette.accent) {
    return palette.accent;
  }
  if (role === 'navLink') {
    if (typeof palette.link === 'string' && palette.link) return palette.link;
    if (typeof palette.accent === 'string' && palette.accent) return palette.accent;
  }
  return null;
}

/** Level 3 detailed category dropdowns (includes Auto). */
export const DETAILED_CATEGORY_PRESETS = [
  { id: 'auto', label: 'auto' },
  ...IMAGE_FILTER_PRESETS.filter((preset) => preset.id !== 'custom'),
];

/** @type {ReadonlyArray<{ id: MediaFilterCategoryId, label: string }>} */
export const MEDIA_FILTER_CATEGORIES = [
  { id: 'articleImages', label: 'article images' },
  { id: 'images', label: 'images' },
  { id: 'bgImages', label: 'bg images' },
  { id: 'covers', label: 'covers / banners / headers' },
  { id: 'avatars', label: 'avatars' },
  { id: 'videos', label: 'videos' },
  { id: 'videoPlayback', label: 'video during playback' },
];

/** Walkthrough / example defaults for the primary rows. */
export const DEFAULT_MEDIA_FILTER_CATEGORIES = Object.freeze({
  articleImages: /** @type {ImageFilterPresetId} */ ('accent-tint'),
  images: /** @type {ImageFilterPresetId} */ ('monochrome'),
  bgImages: /** @type {ImageFilterPresetId} */ ('monochrome'),
  covers: /** @type {ImageFilterPresetId} */ ('grayscale'),
  avatars: /** @type {ImageFilterPresetId} */ ('grayscale'),
  videos: /** @type {ImageFilterPresetId} */ ('link-wash'),
  videoPlayback: /** @type {ImageFilterPresetId} */ ('link-wash'),
});

const PRESET_IDS = new Set(IMAGE_FILTER_PRESETS.map((preset) => preset.id));
const CATEGORY_IDS = new Set(MEDIA_FILTER_CATEGORIES.map((category) => category.id));

/**
 * When Color is off, palette washes collapse to a neutral media treatment.
 * @param {string} preset
 * @param {boolean} colorOn
 */
export function resolveImageFilterPreset(preset, colorOn) {
  if (colorOn || !PALETTE_FILTER_PRESETS.has(preset)) return preset;
  return 'monochrome';
}

/**
 * @param {unknown} value
 * @returns {value is ImageFilterPresetId}
 */
export function isImageFilterPresetId(value) {
  return typeof value === 'string' && PRESET_IDS.has(/** @type {ImageFilterPresetId} */ (value));
}

/**
 * @param {unknown} value
 * @returns {value is MediaFilterCategoryId}
 */
export function isMediaFilterCategoryId(value) {
  return typeof value === 'string' && CATEGORY_IDS.has(/** @type {MediaFilterCategoryId} */ (value));
}

/** @returns {MediaFilterCategories} */
export function createDefaultMediaFilterCategories() {
  return { ...DEFAULT_MEDIA_FILTER_CATEGORIES };
}

/** @returns {MediaFilterCategories} */
export function createEmptyMediaFilterCategories() {
  return {
    articleImages: 'none',
    images: 'none',
    bgImages: 'none',
    covers: 'none',
    avatars: 'none',
    videos: 'none',
    videoPlayback: 'none',
  };
}

/**
 * Map Level 3 detailed classifier roles onto a primary category for Auto.
 * @param {string} role
 * @returns {MediaFilterCategoryId}
 */
export function primaryCategoryForMediaRole(role) {
  if (role === 'articleImage' || role === 'hero') return 'articleImages';
  if (role === 'coverImage' || role === 'cover-image') return 'covers';
  if (role === 'avatar') return 'avatars';
  if (role === 'videoThumbnail') return 'videos';
  return 'images';
}

/**
 * @param {unknown} raw
 * @returns {MediaFilterCategories}
 */
export function normalizeMediaFilterCategories(raw) {
  const defaults = createDefaultMediaFilterCategories();
  if (!raw || typeof raw !== 'object') return defaults;
  /** @type {Record<string, ImageFilterPresetId>} */
  const next = { ...defaults };
  for (const id of CATEGORY_IDS) {
    const value = /** @type {Record<string, unknown>} */ (raw)[id];
    if (isImageFilterPresetId(value)) next[id] = value;
  }
  return /** @type {MediaFilterCategories} */ (next);
}

/**
 * Migrate legacy preset+scope into categories when categories are missing.
 * @param {object|null|undefined} raw
 * @returns {MediaFilterCategories}
 */
export function migrateLegacyImageFilterCategories(raw) {
  if (raw?.categories && typeof raw.categories === 'object') {
    return normalizeMediaFilterCategories(raw.categories);
  }

  const preset = isImageFilterPresetId(raw?.preset) ? raw.preset : 'none';
  const scope = raw?.scope === 'backgrounds' || raw?.scope === 'both' || raw?.scope === 'images'
    ? raw.scope
    : 'images';

  if (!raw?.enabled || !preset || preset === 'none') {
    return createEmptyMediaFilterCategories();
  }

  const onImages = scope === 'images' || scope === 'both';
  const onBg = scope === 'backgrounds' || scope === 'both';
  return {
    articleImages: onImages ? preset : 'none',
    images: onImages ? preset : 'none',
    bgImages: onBg ? preset : 'none',
    covers: onImages ? preset : 'none',
    avatars: onImages ? preset : 'none',
    videos: onImages ? preset : 'none',
    videoPlayback: onImages ? preset : 'none',
  };
}

/**
 * Normalize Chroming Media filter state. Categories migrate from legacy
 * preset+scope when missing. `enabled` stays an explicit master switch.
 * @param {object|null|undefined} raw
 * @returns {ImageFilterSettings}
 */
export function normalizeImageFilter(raw) {
  const categories = migrateLegacyImageFilterCategories(raw);
  return {
    enabled: raw?.enabled === true,
    revealOnHover: raw?.revealOnHover !== false,
    customFilter: typeof raw?.customFilter === 'string' ? raw.customFilter : '',
    categories,
    // Preserve legacy fields for one release of readers; UI stops writing them.
    preset: typeof raw?.preset === 'string' ? raw.preset : 'none',
    scope:
      raw?.scope === 'backgrounds' || raw?.scope === 'both' || raw?.scope === 'images'
        ? raw.scope
        : 'images',
  };
}

/**
 * Resolve Auto for a detailed media role against primary categories.
 * @param {string} role
 * @param {MediaFilterCategories|null|undefined} categories
 * @returns {string}
 */
export function resolveAutoMediaRoleFilter(role, categories) {
  const normalized = normalizeMediaFilterCategories(categories);
  return normalized[primaryCategoryForMediaRole(role)] || 'none';
}

/**
 * Whether background-image tagging should run for Chroming Media.
 * @param {object|null|undefined} imageFilter
 */
export function imageFilterAppliesToBackgrounds(imageFilter) {
  const normalized = normalizeImageFilter(imageFilter);
  if (!normalized.enabled) return false;
  return normalized.categories.bgImages !== 'none';
}

/**
 * Whether any replaced-media (img/video) primary category is active.
 * @param {object|null|undefined} imageFilter
 */
export function imageFilterAppliesToReplacedMedia(imageFilter) {
  const normalized = normalizeImageFilter(imageFilter);
  if (!normalized.enabled) return false;
  const { articleImages, images, covers, avatars, videos, videoPlayback } =
    normalized.categories;
  return [articleImages, images, covers, avatars, videos, videoPlayback].some(
    (preset) => preset !== 'none'
  );
}
