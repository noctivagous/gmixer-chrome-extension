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
      activeThemePackId: 'user-made',
      themeMode: /** @type {ThemeMode} */ ('dark'),
      color: {
        baseColor: '#8a8a8a',
        // Anchor for scheme scales / HSL track gradients. Wheel and HSL sliders
        // keep this aligned with baseColor; tint swatches may diverge.
        schemeBaseColor: '#8a8a8a',
        scheme: /** @type {ColorScheme} */ ('monochrome'),
        // 0 = stay close to sampled page colors; 100 = full theme paint.
        // Tone-aligned default: full Light|Gray|Dark unless the user lowers it.
        intensity: 100,
        // How identity colors (masthead/nav/links/accents) are handled:
        // preserve = keep site brand; harmonize = remap hue to theme accent;
        // restyle = Tone approach — full structural Light|Gray|Dark including headers.
        identityMode: /** @type {IdentityMode} */ ('restyle'),
        // When true (default), only paint fills on hosts that already had an
        // opaque native background (`data-gmixer-native-l`). Transparent layout
        // wrappers stay transparent so they share the page canvas.
        paintOpaqueOnly: true,
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
          linkHover: '',
          navLink: '',
          navLinkHover: '',
          border: '',
          focus: '',
        },
      },
      fonts: {
        // Roles retain a usable fallback until the user opts into Typography.
        // Heading slots are independent so h1-h6 can each have their own face.
        // `headers` and `subheadings` remain as compatibility fallbacks for
        // state saved before individual heading customization existed.
        headers: { fontId: 'system-body', customFontId: null },
        subheadings: { fontId: 'system-body', customFontId: null },
        headings: {
          h1: { fontId: 'system-body', customFontId: null },
          h2: { fontId: 'system-body', customFontId: null },
          h3: { fontId: 'system-body', customFontId: null },
          h4: { fontId: 'system-body', customFontId: null },
          h5: { fontId: 'system-body', customFontId: null },
          h6: { fontId: 'system-body', customFontId: null },
        },
        paragraph: { fontId: 'system-body', customFontId: null },
        ui: { fontId: 'system-body', customFontId: null },
        code: { fontId: 'system-mono', customFontId: null },
        captions: { fontId: 'system-body', customFontId: null },
        // User-uploaded @font-face definitions, keyed by generated id.
        customFonts: {},
      },
      imageFilter: {
        enabled: false,
        preset: 'none',
        customFilter: '',
        scope: 'images', // 'images' | 'backgrounds' | 'both'
        revealOnHover: true,
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
        categories: {
          images: { effect: 'none' },
          videos: { effect: 'none' },
          hyperlinks: { effect: 'none', glow: { animated: true, color: '' } },
          navigation: { effect: 'none', glow: { animated: true, color: '' } },
          articles: { effect: 'none' },
        },
        glow: { animated: true, color: '' },
        panScan: { speed: 16, zoom: 14, distance: 3, loop: 'fade', motion: 'scan' },
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
      // Tone is the always-active base layer; remaining layers are opted in by
      // an explicit user choice in the walkthrough or settings panel.
      sections: {
        preview: true,
        tone: true,
        filter: false,
        color: false,
        fonts: false,
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
        walkthroughInitialized: false,
        walkthroughCompleted: false,
      },
    },
    // Per-site overrides layered on top of `global` via
    // `store.getResolvedStateForHost(hostname)`. Keyed by hostname.
    perSite: {
      // 'example.com': { enabled: true, color: { baseColor: '#00ffaa' } }
    },
  };
}
