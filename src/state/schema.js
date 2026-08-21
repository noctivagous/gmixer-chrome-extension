// Single source of truth for the shape of gMixer's settings state.
// Every Lit component reads/writes through the store (see store.js), never
// through chrome.storage directly — see product description.txt >
// "ENGINEERING FOUNDATION" for why this exists from day one.

export const SCHEMA_VERSION = 1;

/** @typedef {'analog' | 'complement' | 'splitComplement' | 'monochrome'} ColorScheme */

/**
 * Default state for a fresh install. Ships "good out of the box" per the
 * defaults-first customization philosophy — nothing here requires the user
 * to configure anything before it looks finished.
 */
export function createDefaultState() {
  return {
    version: SCHEMA_VERSION,
    global: {
      activeThemePackId: 'gx-default',
      color: {
        baseColor: '#7c3aed', // violet — neutral starting point, themepacks override
        scheme: /** @type {ColorScheme} */ ('splitComplement'),
        // 0 = stay close to sampled page colors; 100 = full theme paint.
        intensity: 80,
        // Per-role overrides. Empty string = "use the generated/blended palette value".
        overrides: {
          background: '',
          text: '',
          accent: '',
          link: '',
          border: '',
        },
      },
      fonts: {
        // Defaults-first: ship a finished look out of the box (matrix display
        // headers + technical body + calligraphy captions), not blank system UI.
        headers: { fontId: 'ring-matrix', customFontId: null },
        paragraph: { fontId: 'fundamental', customFontId: null },
        captions: { fontId: 'euro-script', customFontId: null },
        // User-uploaded @font-face definitions, keyed by generated id.
        customFonts: {},
      },
      imageFilter: {
        enabled: false,
        preset: 'monochrome',
        customFilter: '',
        scope: 'both', // 'images' | 'backgrounds' | 'both'
      },
      clipping: {
        enabled: false,
        preset: 'none', // 'round' | 'notch' | 'mixed' | 'none'
        scope: 'cards', // 'images' | 'cards' | 'buttons' | 'all'
      },
      effects: {
        glow: { enabled: false, animated: true, color: '' },
        flash: { enabled: false },
        cursor: { enabled: false, style: 'default' },
        backgroundMotion: { enabled: false },
      },
      navigation: {
        enabled: false, // master opt-in switch — off by default
        clickElement: true,
        back: true,
        forward: true,
        hoverOutlineAnimated: true,
      },
    },
    // Per-site overrides layered on top of `global`. Keyed by hostname so
    // this never needs a storage migration to add per-site support later.
    perSite: {
      // 'example.com': { enabled: true, color: { baseColor: '#00ffaa' } }
    },
  };
}
