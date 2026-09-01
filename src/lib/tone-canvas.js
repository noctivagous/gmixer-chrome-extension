// Tone → first-paint canvas ladder.
//
// Ordered 5-stop spectrum for task 7 (Light … Dark). Canonical L matches
// today's buildPalette monochrome bases (light 96, gray 42, dark 8).
// Optional intensity 0–1 moves within that stop's band (task 7c) without
// changing the canonical value when intensity is omitted.

/** @typedef {'light'|'light-gray'|'gray'|'dark-gray'|'dark'} ToneId */

/**
 * @typedef {object} ToneStop
 * @property {ToneId} id
 * @property {number} l  Canonical canvas lightness 0–100
 * @property {'light'|'dark'} scheme
 */

/** @type {readonly ToneStop[]} */
export const TONE_SPECTRUM = Object.freeze([
  { id: 'light', l: 96, scheme: 'light' },
  { id: 'light-gray', l: 78, scheme: 'light' },
  { id: 'gray', l: 42, scheme: 'dark' },
  { id: 'dark-gray', l: 22, scheme: 'dark' },
  { id: 'dark', l: 8, scheme: 'dark' },
]);

const FALLBACK_STOP = TONE_SPECTRUM[TONE_SPECTRUM.length - 1];

/**
 * @param {number} value
 * @returns {number}
 */
export function normalizeThemeIntensity(value) {
  if (value == null || Number.isNaN(Number(value))) return 0.5;
  return Math.max(0, Math.min(1, Number(value)));
}

/**
 * @param {string} [mode]
 * @returns {ToneStop}
 */
export function toneStop(mode) {
  return TONE_SPECTRUM.find((stop) => stop.id === mode) || FALLBACK_STOP;
}

/**
 * @param {string} [mode]
 * @returns {boolean}
 */
export function toneIsDark(mode) {
  return toneStop(mode).scheme === 'dark';
}

/**
 * Chromatic lightness bias for a tone: Light +18 … Dark −18.
 * @param {string} [mode]
 * @returns {number}
 */
export function toneModeBias(mode) {
  const index = TONE_SPECTRUM.findIndex((stop) => stop.id === mode);
  const i = index < 0 ? TONE_SPECTRUM.length - 1 : index;
  return 18 - i * 9;
}

/**
 * @typedef {object} ToneBand
 * @property {ToneId} id
 * @property {number} canonical
 * @property {number} lighter
 * @property {number} darker
 * @property {'light'|'dark'} scheme
 * @property {number} index
 */

/**
 * Lightness band for a named tone. Midpoint 0.5 of the intensity slider is
 * `canonical`; 0 is `lighter`, 1 is `darker`.
 *
 * @param {string} [mode]
 * @returns {ToneBand}
 */
export function toneBand(mode) {
  const index = TONE_SPECTRUM.findIndex((stop) => stop.id === mode);
  const i = index < 0 ? TONE_SPECTRUM.length - 1 : index;
  const stop = TONE_SPECTRUM[i];
  const prev = TONE_SPECTRUM[i - 1];
  const next = TONE_SPECTRUM[i + 1];
  return {
    id: stop.id,
    canonical: stop.l,
    lighter: prev ? (prev.l + stop.l) / 2 : 99,
    darker: next ? (stop.l + next.l) / 2 : 3,
    scheme: stop.scheme,
    index: i,
  };
}

/**
 * Canvas lightness for a tone. With no intensity, returns the canonical L.
 * Intensity 0 = lighter end of the band, 0.5 = named tone, 1 = darker end.
 *
 * @param {string} [mode]
 * @param {number|null} [intensity]
 * @returns {number}
 */
export function toneCanvasLightness(mode, intensity = null) {
  const band = toneBand(mode);
  if (intensity == null || Number.isNaN(Number(intensity))) return band.canonical;
  const t = normalizeThemeIntensity(intensity);
  if (t <= 0.5) return band.lighter + (band.canonical - band.lighter) * (t * 2);
  return band.canonical + (band.darker - band.canonical) * ((t - 0.5) * 2);
}

/**
 * @param {number} lightness
 * @returns {string}
 */
export function grayHexFromLightness(lightness) {
  const n = Math.round(Math.max(0, Math.min(100, lightness)) * 2.55);
  const hex = n.toString(16).padStart(2, '0');
  return `#${hex}${hex}${hex}`;
}

/**
 * @typedef {object} ToneCanvas
 * @property {string} tone
 * @property {number|null} intensity
 * @property {string} bg
 * @property {string} secondary
 * @property {string} surface
 * @property {string} text
 * @property {'light'|'dark'} scheme
 */

/**
 * Monochrome ladder for a tone. Used as the uncached first-load guess and
 * as a fallback when no live theme tokens have been persisted yet.
 *
 * @param {string} [mode]
 * @param {number|null} [intensity]
 * @returns {ToneCanvas}
 */
export function toneCanvas(mode = 'dark', intensity = null) {
  const stop = toneStop(mode);
  const l = toneCanvasLightness(mode, intensity);
  const scheme = stop.scheme;
  const step = scheme === 'dark' ? 8 : -8;
  const secondaryL = Math.max(3, Math.min(96, l + step));
  const surfaceL = Math.max(3, Math.min(96, l + step * 2));
  return {
    tone: stop.id,
    intensity:
      intensity == null || Number.isNaN(Number(intensity))
        ? null
        : normalizeThemeIntensity(intensity),
    bg: grayHexFromLightness(l),
    secondary: grayHexFromLightness(secondaryL),
    surface: grayHexFromLightness(surfaceL),
    text: grayHexFromLightness(scheme === 'dark' ? 92 : 12),
    scheme,
  };
}
