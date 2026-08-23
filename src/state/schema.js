// Single source of truth for the shape of gMixer's settings state.
// Every Lit component reads/writes through the store (see store.js), never
// through chrome.storage directly — see product description.txt >
// "ENGINEERING FOUNDATION" for why this exists from day one.

export const SCHEMA_VERSION = 1;

/** @typedef {'analog' | 'complement' | 'splitComplement' | 'triadic' | 'tetradic' | 'monochrome'} ColorScheme */
/** @typedef {'light' | 'gray' | 'dark'} ThemeMode */
/** @typedef {'theme' | 'tone' | 'media'} SettingsFocus */
/** @typedef {'preserve' | 'harmonize' | 'restyle'} IdentityMode */

/**
 * Default state for a fresh install. Ships "good out of the box" per the
 * defaults-first customization philosophy — nothing here requires the user
 * to configure anything before it looks finished.
 */
export function createDefaultState() {
  return {
    version: SCHEMA_VERSION,
    global: {
      // Master theming switch (titlebar / Alt+N). Off disables paint on every
      // tab; stored in local so all open tabs stay in lockstep immediately.
      enabled: true,
      activeThemePackId: 'editorial',
      themeMode: /** @type {ThemeMode} */ ('dark'),
      color: {
        baseColor: '#a08a7f', // warm taupe — Editorial theme pack default
        scheme: /** @type {ColorScheme} */ ('analog'),
        // 0 = stay close to sampled page colors; 100 = full theme paint.
        intensity: 80,
        // How identity colors (masthead/nav/links/accents) are handled:
        // preserve = keep site brand; harmonize = remap hue to theme accent;
        // restyle = blend identity with the rest (legacy intensity behavior).
        identityMode: /** @type {IdentityMode} */ ('preserve'),
        // Per-role overrides. Empty string = "use the generated/blended palette value".
        overrides: {
          background: '',
          backgroundSecondary: '',
          // `surface` is the legacy general-purpose override. New settings
          // split GUI controls from larger containers.
          surface: '',
          surfaceGui: '',
          surfaceContainers: '',
          text: '',
          muted: '',
          accent: '',
          link: '',
          border: '',
          focus: '',
        },
      },
      fonts: {
        // Defaults-first: Editorial Google Font pairing (Playfair + Source Sans 3 + Lora).
        // Heading slots are independent so h1-h6 can each have their own
        // face. The settings UI can still apply one face to a selected group.
        // `headers` and `subheadings` remain as compatibility fallbacks for
        // state saved before individual heading customization existed.
        headers: { fontId: 'playfair-display', customFontId: null },
        subheadings: { fontId: 'playfair-display', customFontId: null },
        headings: {
          h1: { fontId: 'playfair-display', customFontId: null },
          h2: { fontId: 'playfair-display', customFontId: null },
          h3: { fontId: 'playfair-display', customFontId: null },
          h4: { fontId: 'playfair-display', customFontId: null },
          h5: { fontId: 'playfair-display', customFontId: null },
          h6: { fontId: 'playfair-display', customFontId: null },
        },
        paragraph: { fontId: 'source-sans-3', customFontId: null },
        ui: { fontId: 'source-sans-3', customFontId: null },
        code: { fontId: 'system-mono', customFontId: null },
        captions: { fontId: 'lora', customFontId: null },
        // User-uploaded @font-face definitions, keyed by generated id.
        customFonts: {},
      },
      imageFilter: {
        enabled: false,
        preset: 'monochrome',
        customFilter: '',
        scope: 'both', // 'images' | 'backgrounds' | 'both'
        revealOnHover: false,
      },
      // Empty category entries inherit the active theme pack's media slots.
      // User changes are stored here as explicit per-category overrides.
      mediaStyles: {},
      clipping: {
        enabled: false,
        preset: 'none', // 'round' | 'notch' | 'mixed' | 'none'
        scope: 'cards', // 'images' | 'cards' | 'buttons' | 'all'
      },
      // Manual radius + per-corner bevel overrides. When both Clipping and
      // Corners are enabled on overlapping elements, Corners wins (emitted
      // later with !important on border-radius / corner-shape).
      corners: {
        enabled: false,
        radius: 0, // px, 0–48
        bevel: {
          topLeft: false,
          topRight: false,
          bottomRight: false,
          bottomLeft: false,
        },
        scope: 'all', // 'images' | 'buttons' | 'all'
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
      // Accordion section masters — independent from expand/collapse UI state.
      // Tone/color/fonts ship on so a fresh install looks finished; opt-in
      // layers stay off until the user flips their header switch.
      sections: {
        tone: true,
        filter: false,
        color: true,
        fonts: true,
        shape: false,
        effects: false,
        navigation: false,
        'font-browser': true,
      },
      // Panel open/scroll/accordion expand — local so every open tab on this
      // device stays in lockstep. Setting values still sync via their fields.
      ui: {
        openSection: /** @type {string|null} */ (null),
        settingsOpen: false,
        settingsScrollTop: 0,
        // Which accordion sections the settings panel shows:
        // theme = all, tone = Tone only, media = Media only.
        settingsFocus: /** @type {SettingsFocus} */ ('theme'),
      },
    },
    // Per-site overrides layered on top of `global`. Keyed by hostname so
    // this never needs a storage migration to add per-site support later.
    perSite: {
      // 'example.com': { enabled: true, color: { baseColor: '#00ffaa' } }
    },
  };
}
