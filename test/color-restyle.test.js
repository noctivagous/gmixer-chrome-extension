import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPalette, contrastRatio, deriveSurface, hexToHsl } from '../src/lib/color-theory.js';
import {
  blendWithPageSample,
  findPrimaryBackground,
  parseCssColor,
} from '../src/content/page-sampler.js';
import { buildCss } from '../src/content/style-injector.js';
import { createDefaultState } from '../src/state/schema.js';
import { THEME_PACKS } from '../src/config/theme-packs.js';

describe('color-theory', () => {
  it('builds a split-complement palette from a base color', () => {
    const palette = buildPalette('#7c3aed', 'splitComplement');
    assert.match(palette.background, /^#[0-9a-f]{6}$/i);
    assert.match(palette.backgroundSecondary, /^#[0-9a-f]{6}$/i);
    assert.match(palette.surface, /^#[0-9a-f]{6}$/i);
    assert.match(palette.surfaceGui, /^#[0-9a-f]{6}$/i);
    assert.match(palette.surfaceContainers, /^#[0-9a-f]{6}$/i);
    assert.match(palette.text, /^#[0-9a-f]{6}$/i);
    assert.match(palette.accent, /^#[0-9a-f]{6}$/i);
    assert.notEqual(palette.accent, palette.link);
    // Surface sits above background for dark themes.
    assert.ok(hexToHsl(palette.surface).l > hexToHsl(palette.background).l);
  });

  it('derives a readable elevated surface from a background', () => {
    const bg = '#140f1f';
    const surface = deriveSurface(bg, true);
    assert.ok(hexToHsl(surface).l > hexToHsl(bg).l);
  });

  it('supports light, gray, and dark tonal modes', () => {
    const light = buildPalette('#7c3aed', 'monochrome', 'light');
    const gray = buildPalette('#7c3aed', 'monochrome', 'gray');
    const dark = buildPalette('#7c3aed', 'monochrome', 'dark');
    assert.ok(hexToHsl(light.background).l > hexToHsl(gray.background).l);
    assert.ok(hexToHsl(gray.background).l > hexToHsl(dark.background).l);
    assert.ok(hexToHsl(gray.surface).l > hexToHsl(gray.background).l);
    assert.equal(light.isDark, false);
    assert.equal(gray.isDark, true);
    assert.equal(dark.isDark, true);
  });

  it('supports triadic and tetradic hue relationships', () => {
    const baseHue = hexToHsl('#7c3aed').h;
    const triadic = buildPalette('#7c3aed', 'triadic');
    const tetradic = buildPalette('#7c3aed', 'tetradic');

    assert.equal(Math.round((hexToHsl(triadic.accent).h - baseHue + 360) % 360), 120);
    assert.equal(Math.round((hexToHsl(triadic.link).h - baseHue + 360) % 360), 240);
    assert.equal(Math.round((hexToHsl(tetradic.accent).h - baseHue + 360) % 360), 90);
    assert.equal(Math.round((hexToHsl(tetradic.link).h - baseHue + 360) % 360), 180);
  });

  it('generates semantic roles from one base color and scheme choice', () => {
    for (const scheme of [
      'analog',
      'complement',
      'splitComplement',
      'triadic',
      'tetradic',
      'monochrome',
    ]) {
      const palette = buildPalette('#7c3aed', scheme);
      for (const role of [
        'background',
        'backgroundSecondary',
        'surface',
        'surfaceGui',
        'surfaceContainers',
        'text',
        'muted',
        'accent',
        'link',
        'border',
        'focus',
      ]) {
        assert.match(palette[role], /^#[0-9a-f]{6}$/i, `${scheme} should generate ${role}`);
      }
    }
  });

  it('keeps generated foreground roles above their contrast thresholds', () => {
    for (const mode of ['light', 'gray', 'dark']) {
      for (const scheme of [
        'analog',
        'complement',
        'splitComplement',
        'triadic',
        'tetradic',
        'monochrome',
      ]) {
        const palette = buildPalette('#7c3aed', scheme, mode);
        assert.ok(contrastRatio(palette.text, palette.background) >= 4.5);
        assert.ok(contrastRatio(palette.muted, palette.background) >= 4.5);
        assert.ok(contrastRatio(palette.accent, palette.background) >= 4.5);
        assert.ok(contrastRatio(palette.link, palette.background) >= 4.5);
        assert.ok(contrastRatio(palette.border, palette.background) >= 3);
        assert.ok(contrastRatio(palette.focus, palette.surfaceGui) >= 3);
      }
    }
  });

  it('leaves explicit role overrides unchanged', () => {
    const global = createDefaultState().global;
    global.color.overrides = {
      ...global.color.overrides,
      surface: '#123456',
      surfaceGui: '#345678',
      surfaceContainers: '#56789a',
      muted: '#abcdef',
      focus: '#fedcba',
    };
    const css = buildCss(global, null);

    assert.match(css, /--gmixer-surface-gui: #345678/);
    assert.match(css, /--gmixer-surface-containers: #56789a/);
    assert.match(css, /--gmixer-muted: #abcdef/);
    assert.match(css, /--gmixer-focus: #fedcba/);
  });

  it('uses generated role defaults when no overrides are configured', () => {
    const global = createDefaultState().global;
    const generated = buildPalette(global.color.baseColor, global.color.scheme, global.themeMode);
    const css = buildCss(global, null);

    assert.deepEqual(
      global.color.overrides,
      {
        background: '',
        backgroundSecondary: '',
        surface: '',
        surfaceGui: '',
        surfaceContainers: '',
        text: '',
        muted: '',
        accent: '',
        link: '',
        border: '',
        focus: '',
      }
    );
    assert.match(css, new RegExp(`--gmixer-surface-gui: ${generated.surfaceGui}`));
    assert.match(
      css,
      new RegExp(`--gmixer-surface-containers: ${generated.surfaceContainers}`)
    );
    assert.match(css, new RegExp(`--gmixer-muted: ${generated.muted}`));
    assert.match(css, new RegExp(`--gmixer-focus: ${generated.focus}`));
  });
});

describe('page-sampler helpers', () => {
  it('parses rgb and hex colors', () => {
    assert.equal(parseCssColor('#abc'), '#aabbcc');
    assert.equal(parseCssColor('rgb(124, 58, 237)'), '#7c3aed');
    assert.equal(parseCssColor('transparent'), null);
  });

  it('blends toward theme as intensity increases', () => {
    const theme = buildPalette('#7c3aed', 'complement');
    const page = {
      background: '#ffffff',
      text: '#111111',
      accent: '#222222',
      link: '#0000ee',
      border: '#cccccc',
      isDark: false,
      headerSizeVariance: 0.2,
    };
    const low = blendWithPageSample(theme, page, 10);
    const high = blendWithPageSample(theme, page, 100);
    // High intensity background should be closer (in lightness) to theme dark bg.
    const themeL = hexToHsl(theme.background).l;
    const lowL = hexToHsl(low.background).l;
    const highL = hexToHsl(high.background).l;
    assert.ok(Math.abs(highL - themeL) <= Math.abs(lowL - themeL));
    assert.ok(hexToHsl(high.surface).l > hexToHsl(high.background).l);
  });

  it('preserves the sampled page exactly at zero intensity', () => {
    const theme = buildPalette('#7c3aed', 'complement');
    const page = {
      background: '#ffffff',
      text: '#111111',
      accent: '#222222',
      link: '#0000ee',
      border: '#cccccc',
      isDark: false,
      headerSizeVariance: 0.2,
    };
    const result = blendWithPageSample(theme, page, 0);
    assert.equal(result.background, page.background);
    assert.equal(result.text, page.text);
    assert.equal(result.accent, page.accent);
    assert.equal(result.link, page.link);
    assert.equal(result.border, page.border);
  });

  it('prefers a large app root when the document body is transparent', () => {
    const makeElement = (tagName, id) => ({
      tagName,
      id,
      getAttribute: () => null,
      getBoundingClientRect: () => ({ width: 1000, height: 800 }),
    });
    const body = makeElement('BODY', '');
    const html = makeElement('HTML', '');
    const app = makeElement('DIV', 'app');
    const doc = {
      body,
      documentElement: html,
      querySelectorAll: () => [app],
    };
    const previousWindow = globalThis.window;
    const previousGetComputedStyle = globalThis.getComputedStyle;
    globalThis.window = { innerWidth: 1000, innerHeight: 800 };
    globalThis.getComputedStyle = (element) => ({
      backgroundColor: element === app ? 'rgb(240, 244, 249)' : 'transparent',
    });

    try {
      assert.equal(findPrimaryBackground(doc), '#f0f4f9');
    } finally {
      globalThis.window = previousWindow;
      globalThis.getComputedStyle = previousGetComputedStyle;
    }
  });
});

describe('buildCss page paint', () => {
  it('emits independent font rules for all heading levels', () => {
    const global = createDefaultState().global;
    global.fonts.headings.h1.fontId = 'lora';
    global.fonts.headings.h3.fontId = 'source-sans-3';
    const css = buildCss(global, null);

    assert.match(css, /h1, \[role="heading"\]\[aria-level="1"\].*font-family: "Lora"/);
    assert.match(css, /h2, \[role="heading"\]\[aria-level="2"\].*font-family: "Playfair Display"/);
    assert.match(css, /h3, \[role="heading"\]\[aria-level="3"\].*font-family: "Source Sans 3"/);
    assert.match(css, /h6, \[role="heading"\]\[aria-level="6"\].*font-family: "Playfair Display"/);
  });

  it('falls back to legacy header roles for older saved state', () => {
    const global = createDefaultState().global;
    delete global.fonts.headings;
    global.fonts.headers.fontId = 'lora';
    const css = buildCss(global, null);

    assert.match(css, /h1, \[role="heading"\]\[aria-level="1"\].*font-family: "Lora"/);
    assert.match(css, /h2, \[role="heading"\]\[aria-level="2"\].*font-family: "Playfair Display"/);
  });

  it('uses conservative semantic surfaces instead of recursive overlays', () => {
    const css = buildCss(createDefaultState().global, null);
    assert.match(css, /--gmixer-bg-primary:/);
    assert.match(css, /--gmixer-bg-secondary:/);
    assert.match(css, /--gmixer-surface-gui:/);
    assert.match(css, /--gmixer-surface-containers:/);
    assert.doesNotMatch(css, /\.gmixer-tonal-overlay/);
    assert.doesNotMatch(css, /mix-blend-mode: multiply/);
    assert.doesNotMatch(css, /span, div/);
    assert.match(css, /\[data-gmixer-role="card"\]/);
    assert.match(css, /body input/);
    assert.match(css, /\[role="searchbox"\]/);
    assert.match(css, /:has\(> input, > textarea, > select/);
    assert.match(css, /border-radius: inherit !important/);
    assert.match(css, /corner-shape: inherit !important/);
    assert.match(
      css,
      /html, body \{[\s\S]*background-color: var\(--gmixer-bg\)[\s\S]*\}[\s\S]*body > header[\s\S]*background-color: var\(--gmixer-bg-secondary\)[\s\S]*body input[\s\S]*background-color: var\(--gmixer-surface-gui\)[\s\S]*body \.card[\s\S]*background-color: var\(--gmixer-surface-containers\)/
    );
    assert.match(css, /color-scheme: dark/);
    assert.match(css, /--gmixer-muted:/);
    assert.match(css, /--gmixer-focus:/);
  });

  it('forces theme text with !important so light-page body colors cannot stick', () => {
    const css = buildCss(createDefaultState().global, null);
    assert.match(css, /p, li, td, th, blockquote[\s\S]*color: var\(--gmixer-text\) !important/);
    assert.match(css, /h1, h2, h3, h4, h5, h6[\s\S]*color: var\(--gmixer-accent\) !important/);
    assert.match(css, /a, a:link, a:visited[\s\S]*color: var\(--gmixer-link\) !important/);
    assert.match(css, /h1 a, h1 a:link, h1 a:visited[\s\S]*color: var\(--gmixer-accent\) !important/);
  });

  it('renders category media slots independently from the global filter', () => {
    const global = createDefaultState().global;
    global.sections.filter = true;
    global.imageFilter.enabled = true;
    global.imageFilter.revealOnHover = true;
    global.mediaStyles = {
      videoThumbnail: { outline: 'accent', filter: 'monochrome' },
      logo: { filter: 'none' },
    };
    const css = buildCss(global, null);
    assert.match(css, /\[data-gmixer-media="videoThumbnail"\]/);
    assert.match(css, /outline: 2px solid var\(--gmixer-accent\)/);
    assert.match(css, /\[data-gmixer-media="logo"\][\s\S]*filter: none !important/);
    assert.match(css, /:hover \{ filter: none !important; \}/);
  });

  it('uses a separate overlay for background images instead of filtering their owner', () => {
    const global = createDefaultState().global;
    global.sections.filter = true;
    global.imageFilter.enabled = true;
    global.imageFilter.scope = 'backgrounds';
    global.imageFilter.preset = 'monochrome';
    const css = buildCss(global, null);

    assert.match(css, /\.gmixer-bgimg-overlay/);
    assert.match(css, /mix-blend-mode: saturation/);
    assert.match(css, /background: #808080 !important/);
    assert.doesNotMatch(css, /\[data-gmixer-bgimg\][^{]*\{[^}]*filter:/);
  });

  it('reveals original images and background overlays on hover when enabled', () => {
    const global = createDefaultState().global;
    global.sections.filter = true;
    global.imageFilter.enabled = true;
    global.imageFilter.preset = 'monochrome';
    global.imageFilter.revealOnHover = true;
    global.imageFilter.scope = 'both';
    const css = buildCss(global, null);

    assert.match(css, /img, video \{ filter: grayscale\(1\)/);
    assert.match(css, /img:hover, video:hover/);
    assert.match(css, /a:hover img, a:hover video/);
    assert.match(css, /filter: none !important/);
    assert.match(
      css,
      /\[data-gmixer-bgimg\]:hover > \.gmixer-bgimg-overlay \{ opacity: 0 !important; \}/
    );
  });

  it('omits media CSS when the Media section is off', () => {
    const global = createDefaultState().global;
    global.sections.filter = false;
    global.imageFilter.enabled = true;
    global.mediaStyles = {
      videoThumbnail: { outline: 'accent', filter: 'monochrome' },
    };
    const css = buildCss(global, null);
    assert.doesNotMatch(css, /\[data-gmixer-media="videoThumbnail"\]/);
    assert.doesNotMatch(css, /img, video, picture source/);
  });

  it('media-only focus paints filters without tone/color/font restyle', () => {
    const global = createDefaultState().global;
    global.ui.settingsFocus = 'media';
    global.sections = {
      ...global.sections,
      tone: true,
      color: true,
      fonts: true,
      filter: true,
    };
    global.imageFilter.enabled = true;
    global.imageFilter.preset = 'monochrome';
    const css = buildCss(global, null);
    assert.match(css, /img, video \{ filter:/);
    assert.match(css, /grayscale\(1\)/);
    assert.doesNotMatch(css, /--gmixer-bg-primary:/);
    assert.doesNotMatch(css, /--gmixer-text:/);
    assert.doesNotMatch(css, /font-family:/);
  });

  it('tone-only focus paints surfaces without media filters', () => {
    const global = createDefaultState().global;
    global.ui.settingsFocus = 'tone';
    global.sections.filter = true;
    global.imageFilter.enabled = true;
    const css = buildCss(global, null);
    assert.match(css, /--gmixer-bg-primary:/);
    assert.doesNotMatch(css, /img, video \{ filter:/);
  });
});

describe('theme package schema', () => {
  it('gives every pack shared light/gray/dark modes and media slots', () => {
    const mediaRoles = ['articleImage', 'videoThumbnail', 'avatar', 'logo', 'ad', 'hero', 'card', 'sidebar'];
    for (const pack of THEME_PACKS) {
      assert.deepEqual(Object.keys(pack.modes).sort(), ['dark', 'gray', 'light']);
      for (const role of mediaRoles) {
        assert.ok(pack.media[role]);
        assert.ok(typeof pack.media[role].filter === 'string');
        assert.ok(['none', 'accent'].includes(pack.media[role].outline));
      }
    }
  });

  it('preserves each pack personality while tone changes its surfaces', () => {
    for (const pack of THEME_PACKS) {
      const { baseColor, scheme } = pack.patch.color;
      const palettes = ['light', 'gray', 'dark'].map((mode) =>
        buildPalette(baseColor, scheme, mode)
      );

      assert.ok(pack.patch.fonts.headers.fontId, `${pack.label} keeps its type pairing`);
      assert.ok(pack.media.defaultFilter !== undefined, `${pack.label} keeps its media direction`);
      assert.ok(hexToHsl(palettes[0].background).l > hexToHsl(palettes[1].background).l);
      assert.ok(hexToHsl(palettes[1].background).l > hexToHsl(palettes[2].background).l);
    }
  });
});
