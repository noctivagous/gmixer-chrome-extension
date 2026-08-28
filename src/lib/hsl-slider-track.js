import { accentHueOffsets, hexToHsl, hslToHex } from './color-theory.js';

/**
 * Scheme hues for slider bands: base + accent offsets (tetradic → 4).
 * @param {string} baseColorHex
 * @param {string} [scheme]
 * @returns {number[]}
 */
export function schemeSliderHues(baseColorHex, scheme) {
  const { h } = hexToHsl(baseColorHex || '#8a8a8a');
  return [0, ...accentHueOffsets(scheme || 'analog')].map(
    (offset) => (h + offset + 360) % 360
  );
}

/**
 * CSS custom properties for multi-band S/L tracks (up to 4 bands).
 * Pair with `.hsl-track` styles that lay bands out vertically or horizontally.
 *
 * @param {string} baseColorHex
 * @param {string} scheme
 * @param {'s'|'l'} channel
 * @returns {string} inline style attribute value
 */
export function schemeHslTrackStyle(baseColorHex, scheme, channel) {
  const hsl = hexToHsl(baseColorHex || '#8a8a8a');
  const hues = schemeSliderHues(baseColorHex, scheme);
  const n = Math.max(hues.length, 1);
  /** @type {string[]} */
  const parts = [`--hsl-band-count:${n}`];

  for (let i = 0; i < 4; i++) {
    if (i < hues.length) {
      const h = hues[i];
      if (channel === 's') {
        parts.push(`--hsl-band-${i}-a:${hslToHex({ h, s: 0, l: hsl.l })}`);
        parts.push(`--hsl-band-${i}-b:${hslToHex({ h, s: 100, l: hsl.l })}`);
      } else {
        parts.push(`--hsl-band-${i}-a:${hslToHex({ h, s: hsl.s, l: 8 })}`);
        parts.push(`--hsl-band-${i}-b:${hslToHex({ h, s: hsl.s, l: 92 })}`);
      }
    } else {
      parts.push(`--hsl-band-${i}-a:transparent`);
      parts.push(`--hsl-band-${i}-b:transparent`);
    }
  }

  return parts.join(';');
}
