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
 * @param {string} [mode]
 * @returns {ToneStop}
 */
export function toneStop(mode) {
  return TONE_SPECTRUM.find((stop) => stop.id === mode) || FALLBACK_STOP;
}

/**
 * Canvas lightness for a tone. With no intensity, returns the canonical L.
 * Intensity 0 = lighter end of the band, 1 = darker end (task 7c).
 *
 * @param {string} [mode]
 * @param {number|null} [intensity]
 * @returns {number}
 */
export function toneCanvasLightness(mode, intensity = null) {
  const index = TONE_SPECTRUM.findIndex((stop) => stop.id === mode);
  const i = index < 0 ? TONE_SPECTRUM.length - 1 : index;
  const stop = TONE_SPECTRUM[i];
  if (intensity == null || Number.isNaN(Number(intensity))) return stop.l;
  const t = Math.max(0, Math.min(1, Number(intensity)));
  const prev = TONE_SPECTRUM[i - 1];
  const next = TONE_SPECTRUM[i + 1];
  const lighter = prev ? (prev.l + stop.l) / 2 : 99;
  const darker = next ? (stop.l + next.l) / 2 : 3;
  return lighter + (darker - lighter) * t;
}

function grayHex(lightness) {
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
  const scheme = l >= 50 ? 'light' : 'dark';
  const step = scheme === 'dark' ? 8 : -8;
  const secondaryL = Math.max(3, Math.min(96, l + step));
  const surfaceL = Math.max(3, Math.min(96, l + step * 2));
  return {
    tone: stop.id,
    intensity: intensity == null || Number.isNaN(Number(intensity)) ? null : Math.max(0, Math.min(1, Number(intensity))),
    bg: grayHex(l),
    secondary: grayHex(secondaryL),
    surface: grayHex(surfaceL),
    text: grayHex(scheme === 'dark' ? 92 : 12),
    scheme,
  };
}
