// A Theme Pack composes shared personality + tonal modes + category styling
// for color, fonts, media, clipping, and effects.
// into one one-click "look" (product description.txt > FEATURE 6).
// Manual per-section tuning in the Settings popover overrides these
// defaults without needing to "leave" the active theme pack.
//
// Default packs use curated Google Font pairings (bundled OFL faces under
// extension/fonts/google/) researched from common aesthetic combo lists:
// Mantlr, Pagecloud, StudioLimb, Davey & Krista.

/**
 * @typedef {object} ThemePack
 * @property {string} id
 * @property {string} label
 * @property {string} description
 * @property {{ light: ThemeModeConfig, gray: ThemeModeConfig, dark: ThemeModeConfig }} modes
 *   Tonal modes sharing this pack's personality.
 * @property {ThemeMediaConfig} media Category-specific media styling slots.
 * @property {Partial<import('../state/schema.js').createDefaultState>} patch
 *   Partial `global` settings patch applied when this pack is selected.
 */
/**
 * @typedef {object} ThemeModeConfig
 * @property {'light'|'gray'|'dark'} tone
 * @property {string} label
 */
/**
 * @typedef {object} ThemeMediaStyle
 * @property {string} filter `auto`, `none`, or an image filter preset
 * @property {'none'|'accent'} outline
 */
/**
 * @typedef {object} ThemeMediaConfig
 * @property {string} defaultFilter
 * @property {ThemeMediaStyle} articleImage
 * @property {ThemeMediaStyle} videoThumbnail
 * @property {ThemeMediaStyle} avatar
 * @property {ThemeMediaStyle} logo
 * @property {ThemeMediaStyle} ad
 * @property {ThemeMediaStyle} hero
 * @property {ThemeMediaStyle} card
 * @property {ThemeMediaStyle} sidebar
 */

export const THEME_MODES = [
  { id: 'light', label: 'Light', description: 'Bright, high-contrast surfaces' },
  { id: 'gray', label: 'Gray', description: 'Neutral mid-tone surfaces' },
  { id: 'dark', label: 'Dark', description: 'Low-light surfaces with bright text' },
];

function modeSet() {
  return {
    light: { label: 'Light', tone: 'light' },
    gray: { label: 'Gray', tone: 'gray' },
    dark: { label: 'Dark', tone: 'dark' },
  };
}

function mediaSet(defaultFilter = 'none') {
  const categoryFilter = defaultFilter === 'none' ? 'auto' : defaultFilter;
  return {
    defaultFilter,
    articleImage: { filter: categoryFilter, outline: 'none' },
    videoThumbnail: { filter: categoryFilter, outline: 'accent' },
    // Noir explicitly protects identity media; other packs inherit the
    // global image filter through `auto`.
    avatar: { filter: defaultFilter === 'none' ? 'auto' : 'none', outline: 'none' },
    logo: { filter: defaultFilter === 'none' ? 'auto' : 'none', outline: 'none' },
    ad: { filter: 'auto', outline: 'none' },
    hero: { filter: categoryFilter, outline: 'none' },
    card: { filter: 'auto', outline: 'none' },
    sidebar: { filter: 'auto', outline: 'none' },
  };
}

/** @type {ThemePack[]} */
export const THEME_PACKS = [
  {
    id: 'user-made',
    label: 'User-Made',
    description: 'Your personal combination of Tone, Color Scheme, Media, Typography, and Effects.',
    modes: modeSet(),
    media: mediaSet('none'),
    // Selecting this pack intentionally preserves the user’s current settings.
    patch: {},
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description:
      'Playfair Display + Source Sans 3 + Lora captions — classic high-contrast serif/sans editorial (Pagecloud / Mantlr staple).',
    modes: modeSet(),
    media: mediaSet('none'),
    patch: {
      themeMode: 'dark',
      color: { baseColor: '#a08a7f', scheme: 'analog' },
      fonts: {
        headers: { fontId: 'playfair-display', customFontId: null },
        subheadings: { fontId: 'playfair-display', customFontId: null },
        paragraph: { fontId: 'source-sans-3', customFontId: null },
        ui: { fontId: 'source-sans-3', customFontId: null },
        code: { fontId: 'system-mono', customFontId: null },
        captions: { fontId: 'lora', customFontId: null },
      },
      imageFilter: { enabled: false },
      sections: { filter: false },
      effects: {
        categories: {
          images: { effect: 'none' },
          videos: { effect: 'none' },
          navigation: { effect: 'none' },
          articles: { effect: 'none' },
        },
        glow: { animated: true, color: '' },
        backgroundMotion: { enabled: false },
      },
    },
  },
  {
    id: 'atelier',
    label: 'Atelier',
    description:
      'Cormorant Garamond + Raleway — elegant display serif with geometric sans body (Davey & Krista / luxury editorial).',
    modes: modeSet(),
    media: mediaSet('none'),
    patch: {
      themeMode: 'dark',
      color: { baseColor: '#6b7c6e', scheme: 'analog' },
      fonts: {
        headers: { fontId: 'cormorant-garamond', customFontId: null },
        subheadings: { fontId: 'cormorant-garamond', customFontId: null },
        paragraph: { fontId: 'raleway', customFontId: null },
        ui: { fontId: 'raleway', customFontId: null },
        code: { fontId: 'system-mono', customFontId: null },
        captions: { fontId: 'cormorant-garamond', customFontId: null },
      },
      imageFilter: { enabled: false },
      sections: { filter: false },
      effects: {
        categories: {
          images: { effect: 'none' },
          videos: { effect: 'none' },
          navigation: { effect: 'none' },
          articles: { effect: 'none' },
        },
        glow: { animated: true, color: '' },
        backgroundMotion: { enabled: false },
      },
    },
  },
  {
    id: 'studio',
    label: 'Studio',
    description:
      'Space Grotesk + DM Sans + Outfit captions — modern tech / studio grotesque pairing (Mantlr SaaS list).',
    modes: modeSet(),
    media: mediaSet('none'),
    patch: {
      themeMode: 'dark',
      color: { baseColor: '#5b6b7a', scheme: 'monochrome' },
      fonts: {
        headers: { fontId: 'space-grotesk', customFontId: null },
        subheadings: { fontId: 'space-grotesk', customFontId: null },
        paragraph: { fontId: 'dm-sans', customFontId: null },
        ui: { fontId: 'dm-sans', customFontId: null },
        code: { fontId: 'system-mono', customFontId: null },
        captions: { fontId: 'outfit', customFontId: null },
      },
      imageFilter: { enabled: false },
      sections: { filter: false },
      effects: {
        categories: {
          images: { effect: 'none' },
          videos: { effect: 'none' },
          navigation: { effect: 'none' },
          articles: { effect: 'none' },
        },
        glow: { animated: true, color: '' },
        backgroundMotion: { enabled: false },
      },
    },
  },
  {
    id: 'noir',
    label: 'gMixer Default',
    description:
      'gMixer Default — Media + Typography only. Monochrome images with original-on-hover; DIN Breitschrift h1, Raleway h2, Outfit h3–h6, DM Sans body, Tippa captions.',
    modes: modeSet(),
    media: mediaSet('monochrome'),
    patch: {
      themeMode: 'dark',
      color: { baseColor: '#8a8a8a', scheme: 'monochrome' },
      fonts: {
        headers: { fontId: 'din-breit', customFontId: null },
        subheadings: { fontId: 'raleway', customFontId: null },
        headings: {
          h1: { fontId: 'din-breit', customFontId: null },
          h2: { fontId: 'raleway', customFontId: null },
          h3: { fontId: 'outfit', customFontId: null },
          h4: { fontId: 'outfit', customFontId: null },
          h5: { fontId: 'outfit', customFontId: null },
          h6: { fontId: 'outfit', customFontId: null },
        },
        paragraph: { fontId: 'dm-sans', customFontId: null },
        ui: { fontId: 'dm-sans', customFontId: null },
        code: { fontId: 'system-mono', customFontId: null },
        captions: { fontId: 'tippa', customFontId: null },
      },
      imageFilter: { enabled: true, preset: 'monochrome', scope: 'both', revealOnHover: true },
      // Page layers: Media + Typography only.
      sections: {
        tone: false,
        filter: true,
        color: false,
        fonts: true,
        shape: false,
        effects: false,
        navigation: false,
      },
      effects: {
        categories: {
          images: { effect: 'none' },
          videos: { effect: 'none' },
          navigation: { effect: 'none' },
          articles: { effect: 'none' },
        },
        glow: { animated: true, color: '' },
        backgroundMotion: { enabled: false },
      },
    },
  },
];

export function getThemePackById(id) {
  return THEME_PACKS.find((pack) => pack.id === id) ?? null;
}
