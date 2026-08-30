/** Texture section catalog — Stage 1 UI/state shell (no page paint yet). */

/**
 * @typedef {'none' | 'noise' | 'grid'} TextureMode
 * @typedef {'diamond-x' | 'diamond-y' | 'rect-dots' | 'square-dots'} TextureGridStyle
 * @typedef {{
 *   mode: TextureMode,
 *   xDistance: number,
 *   yDistance: number,
 *   gridRotation: number,
 *   gridStyle: TextureGridStyle,
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

/** @type {ReadonlySet<TextureMode>} */
const TEXTURE_MODE_IDS = new Set(TEXTURE_MODES.map((mode) => mode.id));
/** @type {ReadonlySet<TextureGridStyle>} */
const TEXTURE_GRID_STYLE_IDS = new Set(TEXTURE_GRID_STYLES.map((style) => style.id));

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
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 */
function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** @returns {TextureSettings} */
export function createDefaultTexture() {
  return {
    mode: 'none',
    xDistance: 12,
    yDistance: 12,
    gridRotation: 0,
    gridStyle: 'square-dots',
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
  };
}

/**
 * Returns CSS suitable for an inline `style` attribute on a preview swatch.
 * In-panel preview only — not used for page paint in Stage 1.
 * Rotation is applied via `--gm-texture-rot` on an inner layer.
 * @param {TextureSettings} texture
 */
export function texturePreviewStyle(texture) {
  const normalized = normalizeTexture(texture);
  if (normalized.mode === 'none') {
    return 'background: transparent;';
  }
  if (normalized.mode === 'noise') {
    const layers = [
      'radial-gradient(circle at 20% 30%, rgba(255,255,255,0.18) 0 0.6px, transparent 1.2px)',
      'radial-gradient(circle at 70% 55%, rgba(255,255,255,0.14) 0 0.7px, transparent 1.4px)',
      'radial-gradient(circle at 40% 80%, rgba(0,0,0,0.22) 0 0.5px, transparent 1.1px)',
      'radial-gradient(circle at 85% 15%, rgba(255,255,255,0.1) 0 0.5px, transparent 1px)',
      'radial-gradient(circle at 10% 70%, rgba(0,0,0,0.16) 0 0.6px, transparent 1.2px)',
      'rgba(255,255,255,0.03)',
    ].join(', ');
    return `background: ${layers}; background-size: 18px 18px, 22px 16px, 14px 20px, 24px 12px, 16px 24px, auto;`;
  }

  const x = normalized.xDistance;
  const y = normalized.yDistance;
  const layers = gridMarkLayers(normalized.gridStyle, x, y);
  return [
    `--gm-texture-rot: ${normalized.gridRotation}deg;`,
    `background-image: ${layers};`,
    `background-size: ${x}px ${y}px;`,
    'background-position: center;',
    'background-repeat: repeat;',
    'background-color: rgba(255,255,255,0.03);',
  ].join(' ');
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
      // Wide diamond marks (X direction).
      const hh = Math.max(1, Math.round(y * 0.12));
      return [
        `linear-gradient(135deg, transparent calc(50% - ${hh}px), ${ink} calc(50% - ${hh}px), ${ink} calc(50% + ${hh}px), transparent calc(50% + ${hh}px))`,
        `linear-gradient(45deg, transparent calc(50% - ${hh}px), ${soft} calc(50% - ${hh}px), ${soft} calc(50% + ${hh}px), transparent calc(50% + ${hh}px))`,
      ].join(', ');
    }
    case 'diamond-y': {
      // Tall diamond marks (Y direction).
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
