/** Presets that need Color-section palette roles (accent / link). */
export const PALETTE_FILTER_PRESETS = new Set(['duotone', 'accent-tint', 'link-wash']);

/**
 * When Color is off, palette washes collapse to a neutral media treatment.
 * @param {string} preset
 * @param {boolean} colorOn
 */
export function resolveImageFilterPreset(preset, colorOn) {
  if (colorOn || !PALETTE_FILTER_PRESETS.has(preset)) return preset;
  return 'monochrome';
}
