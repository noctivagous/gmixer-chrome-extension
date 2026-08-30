/** Texture section catalog — global recipe + per-surface on/off (Stage 2a/2b). */

/**
 * @typedef {'none' | 'noise' | 'grid'} TextureMode
 * @typedef {'diamond-x' | 'diamond-y' | 'rect-dots' | 'square-dots'} TextureGridStyle
 * @typedef {'fill' | 'text' | 'media'} TextureSurfaceFamily
 * @typedef {
 *   | 'gui.button'
 *   | 'gui.input'
 *   | 'gui.textarea'
 *   | 'media.articleImage'
 *   | 'media.videoThumb'
 *   | 'accent.headingLarge'
 *   | 'accent.headingMedium'
 *   | 'accent.headingSmall'
 *   | 'link.bare'
 *   | 'link.article'
 *   | 'link.heading'
 *   | 'muted.kicker'
 *   | 'muted.photoCaption'
 *   | 'muted.asideNotes'
 *   | 'containers'
 *   | 'sheet'
 *   | 'canvas'
 * } TextureSurfaceId
 * @typedef {{
 *   mode: TextureMode,
 *   xDistance: number,
 *   yDistance: number,
 *   gridRotation: number,
 *   gridStyle: TextureGridStyle,
 *   surfaces: Record<TextureSurfaceId, boolean>,
 * }} TextureSettings
 */

/** @type {ReadonlyArray<{ id: TextureMode, label: string }>} */
export const TEXTURE_MODES = [
  { id: 'none', label: 'Off' },
  { id: 'noise', label: 'Noise' },
  { id: 'grid', label: 'Grid' },
];

/** @type {ReadonlyArray<{ id: TextureGridStyle, label: string }>} */
export const TEXTURE_GRID_STYLES = [
  { id: 'diamond-x', label: 'Diamond (X)' },
  { id: 'diamond-y', label: 'Diamond (Y)' },
  { id: 'rect-dots', label: 'Rect dots' },
  { id: 'square-dots', label: 'Square dots' },
];

export const TEXTURE_DISTANCE_MIN = 4;
export const TEXTURE_DISTANCE_MAX = 64;
export const TEXTURE_ROTATION_MIN = 0;
export const TEXTURE_ROTATION_MAX = 90;

/**
 * Surface catalog. `inUi` false = reserved id (normalize + future) but hidden in Stage 2 panel.
 * @type {ReadonlyArray<{
 *   id: TextureSurfaceId,
 *   label: string,
 *   family: TextureSurfaceFamily,
 *   group: string,
 *   inUi: boolean,
 *   defaultOn: boolean,
 * }>}
 */
export const TEXTURE_SURFACES = [
  {
    id: 'gui.button',
    label: 'Button',
    family: 'fill',
    group: 'Surface:GUI',
    inUi: true,
    defaultOn: true,
  },
  {
    id: 'gui.input',
    label: 'Input field',
    family: 'fill',
    group: 'Surface:GUI',
    inUi: true,
    defaultOn: true,
  },
  {
    id: 'gui.textarea',
    label: 'Text area',
    family: 'fill',
    group: 'Surface:GUI',
    inUi: true,
    defaultOn: false,
  },
  {
    id: 'media.articleImage',
    label: 'Article / card image',
    family: 'media',
    group: 'Media',
    inUi: true,
    defaultOn: false,
  },
  {
    id: 'media.videoThumb',
    label: 'Video thumbnail / paused',
    family: 'media',
    group: 'Media',
    inUi: true,
    defaultOn: false,
  },
  {
    id: 'accent.headingLarge',
    label: 'Heading large (h1–h2)',
    family: 'text',
    group: 'Accent headings',
    inUi: true,
    defaultOn: false,
  },
  {
    id: 'accent.headingMedium',
    label: 'Heading medium (h3–h4)',
    family: 'text',
    group: 'Accent headings',
    inUi: true,
    defaultOn: false,
  },
  {
    id: 'accent.headingSmall',
    label: 'Heading small (h5–h6)',
    family: 'text',
    group: 'Accent headings',
    inUi: true,
    defaultOn: false,
  },
  {
    id: 'link.bare',
    label: 'Bare',
    family: 'text',
    group: 'Links',
    inUi: true,
    defaultOn: false,
  },
  {
    id: 'link.article',
    label: 'Article',
    family: 'text',
    group: 'Links',
    inUi: true,
    defaultOn: false,
  },
  {
    id: 'link.heading',
    label: 'Heading',
    family: 'text',
    group: 'Links',
    inUi: true,
    defaultOn: false,
  },
  {
    id: 'muted.kicker',
    label: 'Caption / kicker',
    family: 'text',
    group: 'Muted captions',
    inUi: true,
    defaultOn: false,
  },
  {
    id: 'muted.photoCaption',
    label: 'Photo caption',
    family: 'text',
    group: 'Muted captions',
    inUi: true,
    defaultOn: false,
  },
  {
    id: 'muted.asideNotes',
    label: 'Asides / notes',
    family: 'text',
    group: 'Muted captions',
    inUi: true,
    defaultOn: false,
  },
  {
    id: 'containers',
    label: 'Surface:Containers',
    family: 'fill',
    group: 'Reserved',
    inUi: false,
    defaultOn: false,
  },
  {
    id: 'sheet',
    label: 'BG:Secondary · sheet',
    family: 'fill',
    group: 'Reserved',
    inUi: false,
    defaultOn: false,
  },
  {
    id: 'canvas',
    label: 'BG:Primary · root',
    family: 'fill',
    group: 'Reserved',
    inUi: false,
    defaultOn: false,
  },
];

/** UI fieldset order for the Texture panel. */
export const TEXTURE_SURFACE_GROUPS = [
  'Surface:GUI',
  'Media',
  'Accent headings',
  'Links',
  'Muted captions',
];

/** @type {ReadonlySet<TextureMode>} */
const TEXTURE_MODE_IDS = new Set(TEXTURE_MODES.map((mode) => mode.id));
/** @type {ReadonlySet<TextureGridStyle>} */
const TEXTURE_GRID_STYLE_IDS = new Set(TEXTURE_GRID_STYLES.map((style) => style.id));
/** @type {ReadonlySet<TextureSurfaceId>} */
const TEXTURE_SURFACE_IDS = new Set(TEXTURE_SURFACES.map((surface) => surface.id));

/**
 * @param {unknown} value
 * @returns {value is TextureMode}
 */
export function isTextureMode(value) {
  return typeof value === 'string' && TEXTURE_MODE_IDS.has(/** @type {TextureMode} */ (value));
}

/**
 * @param {unknown} value
 * @returns {value is TextureGridStyle}
 */
export function isTextureGridStyle(value) {
  return (
    typeof value === 'string' &&
    TEXTURE_GRID_STYLE_IDS.has(/** @type {TextureGridStyle} */ (value))
  );
}

/**
 * @param {unknown} value
 * @returns {value is TextureSurfaceId}
 */
export function isTextureSurfaceId(value) {
  return (
    typeof value === 'string' &&
    TEXTURE_SURFACE_IDS.has(/** @type {TextureSurfaceId} */ (value))
  );
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 */
function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** @returns {Record<TextureSurfaceId, boolean>} */
export function createDefaultTextureSurfaces() {
  /** @type {Record<string, boolean>} */
  const surfaces = {};
  for (const surface of TEXTURE_SURFACES) {
    surfaces[surface.id] = surface.defaultOn;
  }
  return /** @type {Record<TextureSurfaceId, boolean>} */ (surfaces);
}

/**
 * @param {unknown} raw
 * @returns {Record<TextureSurfaceId, boolean>}
 */
export function normalizeTextureSurfaces(raw) {
  const defaults = createDefaultTextureSurfaces();
  if (!raw || typeof raw !== 'object') return defaults;
  /** @type {Record<string, boolean>} */
  const next = { ...defaults };
  for (const surface of TEXTURE_SURFACES) {
    const value = /** @type {Record<string, unknown>} */ (raw)[surface.id];
    if (value === true || value === false) next[surface.id] = value;
  }
  return /** @type {Record<TextureSurfaceId, boolean>} */ (next);
}

/** @returns {TextureSettings} */
export function createDefaultTexture() {
  return {
    mode: 'none',
    xDistance: 12,
    yDistance: 12,
    gridRotation: 0,
    gridStyle: 'square-dots',
    surfaces: createDefaultTextureSurfaces(),
  };
}

/**
 * @param {object|null|undefined} raw
 * @returns {TextureSettings}
 */
export function normalizeTexture(raw) {
  const defaults = createDefaultTexture();
  if (!raw || typeof raw !== 'object') return defaults;
  return {
    mode: isTextureMode(/** @type {{ mode?: unknown }} */ (raw).mode)
      ? /** @type {TextureMode} */ (/** @type {{ mode: TextureMode }} */ (raw).mode)
      : defaults.mode,
    xDistance: clampNumber(
      /** @type {{ xDistance?: unknown }} */ (raw).xDistance,
      TEXTURE_DISTANCE_MIN,
      TEXTURE_DISTANCE_MAX,
      defaults.xDistance
    ),
    yDistance: clampNumber(
      /** @type {{ yDistance?: unknown }} */ (raw).yDistance,
      TEXTURE_DISTANCE_MIN,
      TEXTURE_DISTANCE_MAX,
      defaults.yDistance
    ),
    gridRotation: clampNumber(
      /** @type {{ gridRotation?: unknown }} */ (raw).gridRotation,
      TEXTURE_ROTATION_MIN,
      TEXTURE_ROTATION_MAX,
      defaults.gridRotation
    ),
    gridStyle: isTextureGridStyle(/** @type {{ gridStyle?: unknown }} */ (raw).gridStyle)
      ? /** @type {TextureGridStyle} */ (
          /** @type {{ gridStyle: TextureGridStyle }} */ (raw).gridStyle
        )
      : defaults.gridStyle,
    surfaces: normalizeTextureSurfaces(/** @type {{ surfaces?: unknown }} */ (raw).surfaces),
  };
}

/**
 * @param {TextureSettings} texture
 * @param {TextureSurfaceId} id
 */
export function textureSurfaceEnabled(texture, id) {
  const normalized = normalizeTexture(texture);
  return normalized.mode !== 'none' && normalized.surfaces[id] === true;
}

/**
 * Live Preview selector map for each shipped surface.
 * @type {Readonly<Record<TextureSurfaceId, string>>}
 */
export const TEXTURE_PREVIEW_SELECTORS = {
  'gui.button': '.blurb-button',
  'gui.input': '.blurb-field',
  'gui.textarea': '.blurb-textarea',
  'media.articleImage': '.blurb-image-wrap',
  'media.videoThumb': '.blurb-video-thumb',
  'accent.headingLarge': '.blurb-title',
  'accent.headingMedium': '.blurb-subhead, .blurb-card-title',
  'accent.headingSmall': '.blurb-heading-small',
  'link.bare': '.blurb-link',
  'link.article': '.blurb-article-link',
  'link.heading': '.blurb-heading-link',
  'muted.kicker': '.blurb-kicker',
  'muted.photoCaption': '.blurb-image-caption',
  'muted.asideNotes': '.blurb-caption',
  containers: '.blurb-card',
  sheet: '.blurb-gui',
  canvas: '.blurb',
};

/**
 * Returns CSS suitable for an inline `style` attribute on a preview swatch.
 * Rotation is applied via `--gm-texture-rot` on an inner layer.
 * @param {TextureSettings} texture
 */
export function texturePreviewStyle(texture) {
  const normalized = normalizeTexture(texture);
  if (normalized.mode === 'none') {
    return 'background: transparent;';
  }
  if (normalized.mode === 'noise') {
    return `${texturePatternDeclarations(normalized)};`;
  }

  return [
    `--gm-texture-rot: ${normalized.gridRotation}deg;`,
    texturePatternDeclarations(normalized),
  ].join(' ');
}

/**
 * Background-image / size / repeat declarations (no trailing brace).
 * @param {TextureSettings} texture
 */
export function texturePatternDeclarations(texture) {
  const normalized = normalizeTexture(texture);
  if (normalized.mode === 'none') return 'background-image: none';

  if (normalized.mode === 'noise') {
    const layers = [
      'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.18) 0 0.6px, transparent 1.2px)',
      'radial-gradient(circle at 70% 55%, rgba(255,255,255,0.14) 0 0.7px, transparent 1.4px)',
      'radial-gradient(circle at 40% 80%, rgba(0,0,0,0.22) 0 0.5px, transparent 1.1px)',
      'radial-gradient(circle at 85% 15%, rgba(255,255,255,0.1) 0 0.5px, transparent 1px)',
      'radial-gradient(circle at 10% 70%, rgba(0,0,0,0.16) 0 0.6px, transparent 1.2px)',
    ].join(', ');
    return [
      `background-image: ${layers}`,
      'background-size: 18px 18px, 22px 16px, 14px 20px, 24px 12px, 16px 24px',
      'background-repeat: repeat',
    ].join('; ');
  }

  const x = normalized.xDistance;
  const y = normalized.yDistance;
  const layers = gridMarkLayers(normalized.gridStyle, x, y);
  return [
    `background-image: ${layers}`,
    `background-size: ${x}px ${y}px`,
    'background-position: center',
    'background-repeat: repeat',
  ].join('; ');
}

/**
 * @param {TextureGridStyle} style
 * @param {number} x
 * @param {number} y
 */
function gridMarkLayers(style, x, y) {
  const ink = 'rgba(255,255,255,0.55)';
  const soft = 'rgba(255,255,255,0.28)';
  switch (style) {
    case 'diamond-x': {
      const hh = Math.max(1, Math.round(y * 0.12));
      return [
        `linear-gradient(135deg, transparent calc(50% - ${hh}px), ${ink} calc(50% - ${hh}px), ${ink} calc(50% + ${hh}px), transparent calc(50% + ${hh}px))`,
        `linear-gradient(45deg, transparent calc(50% - ${hh}px), ${soft} calc(50% - ${hh}px), ${soft} calc(50% + ${hh}px), transparent calc(50% + ${hh}px))`,
      ].join(', ');
    }
    case 'diamond-y': {
      const hw = Math.max(1, Math.round(x * 0.12));
      return [
        `linear-gradient(45deg, transparent calc(50% - ${hw}px), ${ink} calc(50% - ${hw}px), ${ink} calc(50% + ${hw}px), transparent calc(50% + ${hw}px))`,
        `linear-gradient(135deg, transparent calc(50% - ${hw}px), ${soft} calc(50% - ${hw}px), ${soft} calc(50% + ${hw}px), transparent calc(50% + ${hw}px))`,
      ].join(', ');
    }
    case 'rect-dots': {
      const rw = Math.max(2, Math.round(x * 0.28));
      const rh = Math.max(1, Math.round(y * 0.16));
      return `radial-gradient(ellipse ${rw}px ${rh}px at center, ${ink} 0 70%, transparent 72%)`;
    }
    case 'square-dots':
    default: {
      const r = Math.max(1.5, Math.round(Math.min(x, y) * 0.14));
      return `radial-gradient(circle ${r}px at center, ${ink} 0 70%, transparent 72%)`;
    }
  }
}
