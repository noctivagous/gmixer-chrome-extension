// Single source of truth for the shape of gMixer's settings state.
// Every Lit component reads/writes through the store (see store.js), never
// through chrome.storage directly — see product description.txt >
// "ENGINEERING FOUNDATION" for why this exists from day one.

export const SCHEMA_VERSION = 1;

/** @typedef {'analog' | 'complement' | 'splitComplement' | 'triadic' | 'tetradic' | 'monochrome'} ColorScheme */
/** @typedef {'light' | 'light-gray' | 'gray' | 'dark-gray' | 'dark'} ThemeMode */
/** @typedef {'theme' | 'tone' | 'media'} SettingsFocus */
/** @typedef {'preserve' | 'harmonize' | 'restyle'} IdentityMode */
/** @typedef {'side-panel' | 'walkthrough-modal'} PreferredShell */
/** @typedef {1 | 2 | 3} CustomizationLevel */

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
        // Working color after the Color Scheme pipeline:
        // 1) scheme, 2) hue from the ring (s=1.0, l=0.5), 3) saturation & lightness.
        // Later steps must not rewrite earlier ones.
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
        // Surface → swatch-cell pins (scale/hue/step). Empty = auto-assign.
        // Coords stay put when hue/S/L change so cell hexes cascade.
        swatchAssignments: {},
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
          // Surface:GUI:* — fall back to `surfaceGui` when Auto.
          guiButton: '',
          guiInput: '',
          guiTextarea: '',
          guiSlider: '',
          // Accent:Heading-* — fall back to `accent` when Auto. Link:Heading
          // has no override of its own; it mirrors whichever tier applies.
          headingLarge: '',
          headingMedium: '',
          headingSmall: '',
          // Link:* — fall back to `link` when Auto.
          linkBare: '',
          linkArticle: '',
          // Muted:* — fall back to `muted` when Auto.
          mutedKicker: '',
          mutedPhotoCaption: '',
          mutedAsideNotes: '',
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
        customFilter: '',
        revealOnHover: true,
        // Primary Chroming Media rows (per-category CSS filters).
        categories: {
          articleImages: 'accent-tint',
          images: 'monochrome',
          bgImages: 'monochrome',
          videos: 'link-wash',
          videoPlayback: 'link-wash',
        },
        // Legacy fields retained for migration only (UI no longer writes them).
        preset: 'none',
        scope: 'images', // 'images' | 'backgrounds' | 'both'
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
      // Surface texture: global recipe + per-surface on/off (page paint later).
      texture: {
        mode: /** @type {'none' | 'noise' | 'grid'} */ ('none'),
        xDistance: 12,
        yDistance: 12,
        gridRotation: 0,
        gridStyle: /** @type {'diamond-x' | 'diamond-y' | 'rect-dots' | 'square-dots'} */ (
          'square-dots'
        ),
        // Defaults: GUI button + input on; remaining surfaces opt-in.
        surfaces: {
          'gui.button': true,
          'gui.input': true,
          'gui.textarea': false,
          'media.articleImage': false,
          'media.videoThumb': false,
          'accent.headingLarge': false,
          'accent.headingMedium': false,
          'accent.headingSmall': false,
          'link.bare': false,
          'link.article': false,
          'link.heading': false,
          'muted.kicker': false,
          'muted.photoCaption': false,
          'muted.asideNotes': false,
          containers: false,
          sheet: false,
          canvas: false,
        },
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
        texture: false,
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
        // After onboarding, Alt+M / toolbar open this shell.
        preferredShell: /** @type {PreferredShell} */ ('side-panel'),
        // 1 = Tone…Effects; 2 = + Preview/Nav/Font browser; 3 reserved.
        // Texture + Clipping/Corners deferred for 0.1.0 (see RELEASE-GOALS.md).
        customizationLevel: /** @type {CustomizationLevel} */ (1),
        // On/Off remembered for sections forced off when level drops beneath them.
        customizationLevelSectionMemory: /** @type {Record<string, boolean>} */ ({}),
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
