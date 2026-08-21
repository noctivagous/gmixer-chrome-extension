// A Theme Pack composes color + fonts + image filter + clipping + effects
// into one one-click "look" (product description.txt > FEATURE 6).
// Manual per-section tuning in the Settings popover overrides these
// defaults without needing to "leave" the active theme pack.

/**
 * @typedef {object} ThemePack
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {Partial<import('../state/schema.js').createDefaultState>} patch
 *   Partial `global` settings patch applied when this pack is selected.
 */

/** @type {ThemePack[]} */
export const THEME_PACKS = [
  {
    id: 'gx-default',
    label: 'GX Default',
    description: 'Dark, high-contrast violet/cyan split-complement — good out of the box, the default on install.',
    patch: {
      color: { baseColor: '#7c3aed', scheme: 'splitComplement' },
      effects: { glow: { enabled: true, animated: true } },
    },
  },
  {
    id: 'neon-synthwave',
    label: 'Neon / Synthwave',
    description: 'Magenta-cyan complementary palette, animated glow + background motion.',
    patch: {
      color: { baseColor: '#ff2bd6', scheme: 'complement' },
      effects: {
        glow: { enabled: true, animated: true },
        backgroundMotion: { enabled: true },
      },
    },
  },
  {
    id: 'monochrome-minimal',
    label: 'Monochrome Minimal',
    description: 'Understated monochrome wash, no glow/flash — the "minimalist streamer" look.',
    patch: {
      color: { baseColor: '#8a8a8a', scheme: 'monochrome' },
      imageFilter: { enabled: true, preset: 'monochrome' },
      effects: { glow: { enabled: false }, flash: { enabled: false } },
    },
  },
];

export function getThemePackById(id) {
  return THEME_PACKS.find((pack) => pack.id === id) ?? null;
}
