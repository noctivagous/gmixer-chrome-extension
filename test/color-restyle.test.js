import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPalette,
  contrastRatio,
  deriveGlowColor,
  deriveSurface,
  deriveSurfaceLadder,
  hexToHsl,
  HUE_RING,
  hueRingHex,
  resolveGlowColor,
} from '../src/lib/color-theory.js';
import {
  blendWithPageSample,
  findPrimaryBackground,
  parseCssColor,
} from '../src/content/page-sampler.js';
import { buildCss } from '../src/content/style-injector.js';
import { createDefaultState } from '../src/state/schema.js';
import { THEME_PACKS } from '../src/config/theme-packs.js';

/** Fresh install defaults Media+Typography only; color/tone tests opt back in. */
function withTonePaint(global) {
  global.sections.color = true;
  global.sections.tone = true;
  return global;
}

describe('color-theory', () => {
  it('samples the hue ring at saturation 1.0 and lightness 0.5', () => {
    assert.equal(HUE_RING.s, 100);
    assert.equal(HUE_RING.l, 50);
    const red = hexToHsl(hueRingHex(0));
    assert.equal(Math.round(red.h), 0);
    assert.ok(Math.abs(red.s - 100) < 1);
    assert.ok(Math.abs(red.l - 50) < 1);
  });

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
    assert.notEqual(palette.navLink, palette.link);
    assert.notEqual(deriveGlowColor(palette.link), palette.link);
    assert.notEqual(resolveGlowColor(palette.link, palette.link), palette.link);
    // Surface sits above background for dark themes.
    assert.ok(hexToHsl(palette.surface).l > hexToHsl(palette.background).l);
  });

  it('derives a readable elevated surface from a background', () => {
    const bg = '#140f1f';
    const surface = deriveSurface(bg, true);
    assert.ok(hexToHsl(surface).l > hexToHsl(bg).l);
  });

  it('keeps consecutive surface roles distinct at the lightness boundary', () => {
    for (const [background, isDark] of [
      ['#e0e0e0', true],
      ['#1f1f1f', false],
    ]) {
      const secondary = deriveSurface(background, isDark);
      const gui = deriveSurface(secondary, isDark);
      const containers = deriveSurface(gui, isDark);
      assert.notEqual(gui, secondary);
      assert.notEqual(containers, gui);
    }
  });

  it('uses the supplied tonal direction when deriving a surface', () => {
    const background = '#333333';
    assert.ok(hexToHsl(deriveSurface(background, true)).l > hexToHsl(background).l);
    assert.ok(hexToHsl(deriveSurface(background, false)).l < hexToHsl(background).l);
  });

  it('supports the five-stop Light through Dark spectrum', () => {
    const light = buildPalette('#7c3aed', 'monochrome', 'light');
    const lightGray = buildPalette('#7c3aed', 'monochrome', 'light-gray');
    const gray = buildPalette('#7c3aed', 'monochrome', 'gray');
    const darkGray = buildPalette('#7c3aed', 'monochrome', 'dark-gray');
    const dark = buildPalette('#7c3aed', 'monochrome', 'dark');
    assert.ok(hexToHsl(light.background).l > hexToHsl(lightGray.background).l);
    assert.ok(hexToHsl(lightGray.background).l > hexToHsl(gray.background).l);
    assert.ok(hexToHsl(gray.background).l > hexToHsl(darkGray.background).l);
    assert.ok(hexToHsl(darkGray.background).l > hexToHsl(dark.background).l);
    assert.ok(hexToHsl(gray.surface).l > hexToHsl(gray.background).l);
    assert.equal(light.isDark, false);
    assert.equal(lightGray.isDark, false);
    assert.equal(gray.isDark, true);
    assert.equal(darkGray.isDark, true);
    assert.equal(dark.isDark, true);
    const darkSoft = buildPalette('#7c3aed', 'monochrome', 'dark', 0);
    const darkHard = buildPalette('#7c3aed', 'monochrome', 'dark', 1);
    assert.ok(hexToHsl(darkSoft.background).l > hexToHsl(darkHard.background).l);
  });

  it('keeps monochrome palette roles desaturated for Tone-only themes', () => {
    const palette = buildPalette('#8a8a8a', 'monochrome', 'dark');
    assert.equal(hexToHsl(palette.accent).s, 0);
    assert.equal(hexToHsl(palette.link).s, 0);
    assert.equal(hexToHsl(palette.navLink).s, 0);
    assert.equal(hexToHsl(palette.focus).s, 0);
    assert.notEqual(palette.navLink, palette.link);
  });

  it('keeps picker saturation on chromatic page backgrounds', () => {
    const lime = '#00ff00';
    const dark = buildPalette(lime, 'analog', 'dark');
    const gray = buildPalette(lime, 'analog', 'gray');
    const light = buildPalette(lime, 'analog', 'light');
    assert.ok(hexToHsl(dark.background).s >= 90, 'dark bg keeps lime saturation');
    assert.ok(hexToHsl(gray.background).s >= 90, 'gray bg keeps lime saturation');
    assert.ok(hexToHsl(light.background).s >= 90, 'light bg keeps lime saturation');
    assert.ok(hexToHsl(light.background).l > hexToHsl(gray.background).l);
    assert.ok(hexToHsl(gray.background).l > hexToHsl(dark.background).l);
    assert.ok(hexToHsl(gray.background).l >= 40, 'gray mode can sit near the picked lightness');
  });

  it('uses the monochrome base value to adjust theme surfaces', () => {
    const deep = buildPalette('#333333', 'monochrome', 'dark');
    const bright = buildPalette('#cccccc', 'monochrome', 'dark');
    assert.ok(hexToHsl(bright.background).l > hexToHsl(deep.background).l);
    assert.equal(hexToHsl(deep.background).s, 0);
    assert.equal(hexToHsl(bright.background).s, 0);
  });

  it('builds a ranked elevated surface ladder from the page background', () => {
    const dark = buildPalette('#7c3aed', 'monochrome', 'dark');
    assert.equal(dark.surfaceLadder.length, 3);
    assert.ok(hexToHsl(dark.surfaceLadder[0]).l > hexToHsl(dark.background).l);
    assert.ok(hexToHsl(dark.surfaceLadder[1]).l > hexToHsl(dark.surfaceLadder[0]).l);
    assert.ok(hexToHsl(dark.surfaceLadder[2]).l > hexToHsl(dark.surfaceLadder[1]).l);
    const ladder = deriveSurfaceLadder('#111111', true, 3);
    assert.equal(ladder.length, 3);
  });

  it('supports triadic and tetradic hue relationships', () => {
    const baseHue = hexToHsl('#7c3aed').h;
    const triadic = buildPalette('#7c3aed', 'triadic');
    const tetradic = buildPalette('#7c3aed', 'tetradic');

    const hueDelta = (hex, expected) =>
      Math.abs(((hexToHsl(hex).h - baseHue + 360) % 360) - expected);
    // Triadic: base + 120° accent + 240° on link/nav/focus chrome.
    assert.ok(hueDelta(triadic.accent, 120) <= 2);
    assert.ok(hueDelta(triadic.link, 240) <= 2);
    assert.ok(hueDelta(triadic.navLink, 240) <= 2);
    assert.ok(hueDelta(triadic.focus, 240) <= 2);
    assert.ok(hueDelta(triadic.border, 120) <= 2);
    // Tetradic: park the 4th stop (270°) on nav; link/focus share 180°.
    assert.ok(hueDelta(tetradic.accent, 90) <= 2);
    assert.ok(hueDelta(tetradic.link, 180) <= 2);
    assert.ok(hueDelta(tetradic.navLink, 270) <= 2);
    assert.ok(hueDelta(tetradic.focus, 180) <= 2);
    assert.ok(hueDelta(tetradic.border, 90) <= 2);
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
        'linkHover',
        'navLink',
        'navLinkHover',
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
        assert.ok(contrastRatio(palette.navLink, palette.background) >= 4.5);
        assert.ok(contrastRatio(palette.border, palette.background) >= 3);
        assert.ok(contrastRatio(palette.focus, palette.surfaceGui) >= 3);
      }
    }
  });

  it('leaves explicit role overrides unchanged', () => {
    const global = withTonePaint(createDefaultState().global);
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
    const global = withTonePaint(createDefaultState().global);
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
        linkHover: '',
        navLink: '',
        navLinkHover: '',
        border: '',
        focus: '',
        guiButton: '',
        guiInput: '',
        guiTextarea: '',
        guiSlider: '',
        headingLarge: '',
        headingMedium: '',
        headingSmall: '',
        linkBare: '',
        linkArticle: '',
        mutedKicker: '',
        mutedPhotoCaption: '',
        mutedAsideNotes: '',
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

  it('keeps backgroundSecondary, muted, and focus after blending', () => {
    const theme = buildPalette('#7c3aed', 'complement', 'dark');
    const page = {
      background: '#ffffff',
      backgroundSecondary: '#f0f0f0',
      text: '#111111',
      accent: '#222222',
      link: '#0000ee',
      border: '#cccccc',
      isDark: false,
      headerSizeVariance: 0.2,
      structural: {
        background: '#ffffff',
        backgroundSecondary: '#f0f0f0',
        text: '#111111',
        border: '#cccccc',
      },
    };
    const result = blendWithPageSample(theme, page, 80);
    assert.match(result.backgroundSecondary, /^#[0-9a-f]{6}$/i);
    assert.match(result.muted, /^#[0-9a-f]{6}$/i);
    assert.match(result.focus, /^#[0-9a-f]{6}$/i);
    assert.notEqual(result.backgroundSecondary, 'undefined');
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
    global.sections.fonts = true;
    global.fonts.headings.h1.fontId = 'lora';
    global.fonts.headings.h2.fontId = 'raleway';
    global.fonts.headings.h3.fontId = 'source-sans-3';
    global.fonts.headings.h6.fontId = 'outfit';
    const css = buildCss(global, null);

    assert.match(css, /h1, \[role="heading"\]\[aria-level="1"\], h1 a, \[role="heading"\]\[aria-level="1"\] a \{ font-family: "Lora"/);
    assert.match(css, /h2, \[role="heading"\]\[aria-level="2"\], h2 a, \[role="heading"\]\[aria-level="2"\] a \{ font-family: "Raleway"/);
    assert.match(css, /h3, \[role="heading"\]\[aria-level="3"\], h3 a, \[role="heading"\]\[aria-level="3"\] a \{ font-family: "Source Sans 3"/);
    assert.match(css, /h6, \[role="heading"\]\[aria-level="6"\], h6 a, \[role="heading"\]\[aria-level="6"\] a \{ font-family: "Outfit"/);
  });

  it('falls back to legacy header roles for older saved state', () => {
    const global = createDefaultState().global;
    global.sections.fonts = true;
    delete global.fonts.headings;
    global.fonts.headers.fontId = 'lora';
    global.fonts.subheadings.fontId = 'raleway';
    const css = buildCss(global, null);

    assert.match(css, /h1, \[role="heading"\]\[aria-level="1"\], h1 a, \[role="heading"\]\[aria-level="1"\] a \{ font-family: "Lora"/);
    assert.match(css, /h2, \[role="heading"\]\[aria-level="2"\], h2 a, \[role="heading"\]\[aria-level="2"\] a \{ font-family: "Raleway"/);
  });

  it('uses conservative semantic surfaces instead of recursive overlays', () => {
    const css = buildCss(withTonePaint(createDefaultState().global), null);
    assert.match(css, /--gmixer-bg-primary:/);
    assert.match(css, /--gmixer-bg-secondary:/);
    assert.match(css, /--gmixer-surface-gui:/);
    assert.match(css, /--gmixer-surface-containers:/);
    assert.match(
      css,
      /body \.card\[data-gmixer-native-l\]:not\(\[data-gmixer-bgimg\]\),[\s\S]*background-color: var\(--gmixer-surface-containers\)/
    );
    assert.doesNotMatch(css, /\.gmixer-tonal-overlay/);
    assert.doesNotMatch(css, /mix-blend-mode: multiply/);
    assert.doesNotMatch(css, /span, div/);
    assert.match(css, /\[data-gmixer-role="card"\]/);
    assert.match(css, /\[data-gmixer-role="article"\]/);
    assert.match(css, /\[data-gmixer-role="main"\]/);
    assert.match(css, /\[data-gmixer-role="surface"\]/);
    assert.match(css, /\[data-gmixer-role="ad"\]/);
    assert.match(css, /--gmixer-surface-0:/);
    assert.match(css, /--gmixer-surface-1:/);
    assert.match(css, /--gmixer-surface-2:/);
    assert.match(css, /data-gmixer-tone-step="0"/);
    assert.match(css, /data-gmixer-tone-step="2"/);
    assert.match(css, /body #main\[data-gmixer-native-l\]/);
    assert.match(css, /body footer\[data-gmixer-native-l\]/);
    assert.match(css, /\[data-gmixer-role="footer"\]\[data-gmixer-native-l\]/);
    assert.match(css, /nav[\s\S]*:is\([\s\S]*div,/);
    assert.doesNotMatch(css, /ntv-preview/);
    assert.doesNotMatch(css, /listingResult/);
    assert.doesNotMatch(css, /trending__wrapper/);
    assert.match(css, /body input\[data-gmixer-native-l\]/);
    assert.match(css, /\[role="searchbox"\]\[data-gmixer-native-l\]/);
    assert.match(css, /:has\(> input, > textarea, > select/);
    assert.match(css, /border-radius: inherit !important/);
    assert.match(css, /corner-shape: inherit !important/);
    assert.match(
      css,
      /html, body \{[\s\S]*background-color: var\(--gmixer-bg\)[\s\S]*background-image: none !important;[\s\S]*\}[\s\S]*body > header\[data-gmixer-native-l\][\s\S]*background-color: var\(--gmixer-bg-secondary\)[\s\S]*body input\[data-gmixer-native-l\][\s\S]*background-color: var\(--gmixer-surface-gui\)[\s\S]*body \.card\[data-gmixer-native-l\]:not\(\[data-gmixer-bgimg\]\)[\s\S]*background-color: var\(--gmixer-surface-1\)/
    );
    // Opaque mains get elevated fill; layout-only mains stay unpainted.
    assert.match(
      css,
      /body #main\[data-gmixer-native-l\]:not\(\[data-gmixer-bgimg\]\),[\s\S]*body \[role="main"\]\[data-gmixer-native-l\]:not\(\[data-gmixer-bgimg\]\),[\s\S]*body \[data-gmixer-role="main"\]\[data-gmixer-native-l\]:not\(\[data-gmixer-bgimg\]\) \{[\s\S]*background-color: var\(--gmixer-bg-secondary\)/
    );
    assert.doesNotMatch(
      css,
      /body main,\s*body #main,\s*body \[role="main"\],\s*body \[data-gmixer-role="main"\] \{/
    );
    assert.match(css, /color-scheme: dark/);
    assert.match(css, /--gmixer-muted:/);
    assert.match(css, /--gmixer-focus:/);
    assert.doesNotMatch(css, /--gmixer-bg-secondary:\s*undefined/);
  });

  it('paintOpaqueOnly off restores unconditional structural fills', () => {
    const global = withTonePaint(createDefaultState().global);
    global.color.paintOpaqueOnly = false;
    const css = buildCss(global, null);
    assert.match(css, /body > header, body > footer/);
    assert.doesNotMatch(css, /body > header\[data-gmixer-native-l\]/);
    assert.match(
      css,
      /body main:not\(\[data-gmixer-bgimg\]\),\s*body #main:not\(\[data-gmixer-bgimg\]\),\s*body \[role="main"\]:not\(\[data-gmixer-bgimg\]\),\s*body \[data-gmixer-role="main"\]:not\(\[data-gmixer-bgimg\]\) \{/
    );
    assert.match(css, /body \.card:not\(\[data-gmixer-bgimg\]\),\s*body article:not\(\[data-gmixer-bgimg\]\),/);
  });

  function pageWithBrandIdentity() {
    return {
      background: '#ffffff',
      backgroundSecondary: '#f5f5f5',
      text: '#111111',
      accent: '#006666',
      link: '#008888',
      border: '#cccccc',
      structural: {
        background: '#ffffff',
        backgroundSecondary: '#f5f5f5',
        text: '#111111',
        border: '#cccccc',
      },
      identity: {
        accent: '#006666',
        link: '#008888',
        masthead: '#006666',
        nav: '#006666',
      },
    };
  }

  function assertPureToneCss(css, theme) {
    assert.match(css, new RegExp(`--gmixer-bg-primary: ${theme.background}`));
    assert.match(css, new RegExp(`--gmixer-bg-secondary: ${theme.backgroundSecondary}`));
    // Pure Tone still paints mastheads, but with secondary fill — not brand identity.
    assert.match(css, /body \.masthead/);
    assert.match(css, /--site-header-background-color: var\(--gmixer-bg-secondary\)/);
    assert.doesNotMatch(css, /--site-header-background-color: var\(--gmixer-masthead\)/);
    assert.match(css, /body \[data-gmixer-role="main"\]/);
  }

  it('applies full theme tone under tone-only settings focus', () => {
    const global = withTonePaint(createDefaultState().global);
    global.ui.settingsFocus = 'tone';
    global.themeMode = 'dark';
    global.color.intensity = 10;
    const theme = buildPalette('#8a8a8a', 'monochrome', 'dark');
    assertPureToneCss(buildCss(global, pageWithBrandIdentity()), theme);
  });

  it('Only: Tone ignores chromatic Color Scheme and role overrides', () => {
    const global = withTonePaint(createDefaultState().global);
    global.ui.settingsFocus = 'tone';
    global.themeMode = 'dark';
    global.sections.color = true;
    global.color.baseColor = '#7c3aed';
    global.color.scheme = 'triadic';
    global.color.overrides = {
      ...global.color.overrides,
      background: '#ff0000',
      backgroundSecondary: '#00ff00',
      accent: '#0000ff',
    };
    const expected = buildPalette('#8a8a8a', 'monochrome', 'dark');
    const css = buildCss(global, null);
    assert.match(css, new RegExp(`--gmixer-bg-primary: ${expected.background}`));
    assert.match(css, new RegExp(`--gmixer-bg-secondary: ${expected.backgroundSecondary}`));
    assert.match(css, new RegExp(`--gmixer-accent: ${expected.accent}`));
    assert.doesNotMatch(css, /--gmixer-bg-primary: #ff0000/);
    assert.doesNotMatch(css, /--gmixer-bg-secondary: #00ff00/);
  });

  it('cascades Auto Secondary/surfaces from a Primary override', () => {
    const global = withTonePaint(createDefaultState().global);
    global.ui.settingsFocus = 'theme';
    global.color.overrides = {
      ...global.color.overrides,
      background: '#112233',
    };
    const isDark = hexToHsl('#112233').l < 50;
    const expectedSecondary = deriveSurface('#112233', isDark);
    const expectedGui = deriveSurface(expectedSecondary, isDark);
    const expectedContainers = deriveSurface(expectedGui, isDark);
    const css = buildCss(global, null);
    assert.match(css, /--gmixer-bg-primary: #112233/);
    assert.match(css, new RegExp(`--gmixer-bg-secondary: ${expectedSecondary}`));
    assert.match(css, new RegExp(`--gmixer-surface-gui: ${expectedGui}`));
    assert.match(css, new RegExp(`--gmixer-surface-containers: ${expectedContainers}`));
  });

  it('keeps an explicit Secondary override when Primary is also overridden', () => {
    const global = withTonePaint(createDefaultState().global);
    global.ui.settingsFocus = 'theme';
    global.color.overrides = {
      ...global.color.overrides,
      background: '#112233',
      backgroundSecondary: '#abcdef',
    };
    const css = buildCss(global, null);
    assert.match(css, /--gmixer-bg-primary: #112233/);
    assert.match(css, /--gmixer-bg-secondary: #abcdef/);
  });

  it('applies Tone structural chrome under Theme Color with Fully restyle', () => {
    const global = createDefaultState().global;
    global.ui.settingsFocus = 'theme';
    global.sections.color = true;
    global.sections.tone = true;
    global.themeMode = 'dark';
    global.color.intensity = 10;
    global.color.identityMode = 'restyle';
    // Intensity still blends neutrals, but headers use structural fills like Tone.
    const css = buildCss(global, pageWithBrandIdentity());
    assert.match(css, /--site-header-background-color: var\(--gmixer-bg-secondary\)/);
    assert.doesNotMatch(css, /--site-header-background-color: var\(--gmixer-masthead\)/);
    assert.match(css, /body \.masthead/);
  });

  it('preserves brand masthead fills when Color identity is Preserve', () => {
    const global = withTonePaint(createDefaultState().global);
    global.ui.settingsFocus = 'theme';
    global.color.identityMode = 'preserve';
    global.color.intensity = 100;
    const css = buildCss(global, pageWithBrandIdentity());
    assert.match(css, /--site-header-background-color: var\(--gmixer-masthead\)/);
  });

  it('keeps header/nav menu controls flush with chrome instead of elevated GUI blocks', () => {
    const css = buildCss(withTonePaint(createDefaultState().global), null);
    assert.match(css, /Header\/nav in-bar items share one chrome fill/);
    assert.match(css, /\[data-gmixer-role="header"\],\s*\[data-gmixer-role="navigation"\]/);
    assert.match(css, /ul,\s*ol,\s*li,\s*div,\s*menu,\s*button/);
    assert.match(css, /background-color: transparent !important;/);
    assert.match(
      css,
      /:not\(\[role="search"\]\):not\(\[role="menu"\]\):not\(\[role="listbox"\]\):not\(\[role="dialog"\]\):not\(\[popover\]\):not\(\[data-gmixer-role="surface"\]\)/
    );
    assert.match(
      css,
      /\[role="menu"\],\s*\[role="listbox"\],\s*\[role="dialog"\],\s*\[popover\],\s*\[data-gmixer-role="surface"\]\s*\):not\(\[data-gmixer-bgimg\]\) \{\s*background-color: var\(--gmixer-surface-gui\)/
    );
    assert.match(css, /\[popover\]:popover-open/);
    assert.match(css, /:not\(#gmixer-settings\):not\(#gmixer-walkthrough-host\)/);
    assert.doesNotMatch(
      css,
      /:is\(li, div\):is\(:hover, :focus-within\) > :is\(ul, ol, div, menu, section\)/
    );
  });

  it('restyles covering ::before/::after fills on stamped hosts', () => {
    const css = buildCss(withTonePaint(createDefaultState().global), null);
    assert.match(
      css,
      /\[data-gmixer-pseudo-fill~="before"\]::before \{[\s\S]*background-color: inherit !important;/
    );
    assert.match(
      css,
      /\[data-gmixer-pseudo-fill~="after"\]::after \{[\s\S]*background-color: inherit !important;/
    );
  });

  it('paints [role="search"] landmarks as GUI field shells, including in header chrome', () => {
    const css = buildCss(withTonePaint(createDefaultState().global), null);
    assert.match(css, /body \[role="search"\]\[data-gmixer-native-l\]/);
    assert.match(
      css,
      /body \[role="search"\]\[data-gmixer-native-l\],[\s\S]*\[role="search"\]\[data-gmixer-native-l\] \{[\s\S]*background-color: var\(--gmixer-surface-gui\)/
    );
    assert.match(
      css,
      /body \[role="search"\] :is\(input, textarea, select, \[role="textbox"\], \[role="searchbox"\], \[role="combobox"\]\) \{[\s\S]*background-color: transparent !important;/
    );
  });

  it('paints role=tab chips that had a native fill with the GUI surface', () => {
    const css = buildCss(withTonePaint(createDefaultState().global), null);
    assert.match(css, /body \[role="tab"\]\[data-gmixer-native-l\]/);
    assert.match(
      css,
      /body a\[role="tab"\]\[data-gmixer-native-l\],[\s\S]*body \[role="tab"\]\[data-gmixer-native-l\] \{[\s\S]*background-color: var\(--gmixer-surface-gui\)/
    );
    // Transparent-link wipe still exists, but the later tab rule restores GUI.
    assert.match(css, /a, a:link, a:visited \{[\s\S]*background-color: transparent !important;/);
  });

  it('clears header/nav/footer CSS gradients so brand mastheads follow Tone', () => {
    const css = buildCss(withTonePaint(createDefaultState().global), null);
    assert.match(
      css,
      /body header\[data-gmixer-native-l\][\s\S]*background-image: none !important/
    );
    assert.match(
      css,
      /body footer\[data-gmixer-native-l\][\s\S]*background-image: none !important/
    );
  });

  it('clears article/surface CSS gradients so Tailwind rails follow Tone', () => {
    const css = buildCss(withTonePaint(createDefaultState().global), null);
    assert.match(
      css,
      /body \[data-gmixer-role="article"\]\[data-gmixer-native-l\]:not\(\[data-gmixer-bgimg\]\)/
    );
    assert.match(
      css,
      /body \[data-gmixer-role="surface"\]\[data-gmixer-native-l\]:not\(\[data-gmixer-bgimg\]\)[\s\S]*background-image: none !important/
    );
    assert.match(
      css,
      /body \[data-gmixer-role="main"\]\[data-gmixer-native-l\]:not\(\[data-gmixer-bgimg\]\)[\s\S]*background-image: none !important/
    );
  });

  it('remaps common header CSS variables on semantic header selectors', () => {
    const css = buildCss(withTonePaint(createDefaultState().global), null);
    assert.match(css, /--site-header-background-color:/);
    assert.match(css, /--header-background-color:/);
    assert.match(css, /body \[data-gmixer-role="header"\]/);
    assert.doesNotMatch(css, /data-component-name/);
    assert.doesNotMatch(css, /van-masthead/);
  });

  it('forces theme text with !important so light-page body colors cannot stick', () => {
    const css = buildCss(withTonePaint(createDefaultState().global), null);
    assert.match(css, /p, li, td, th, blockquote[\s\S]*color: var\(--gmixer-text\) !important/);
    assert.match(css, /h1, h2, h3, h4, h5, h6[\s\S]*color: var\(--gmixer-accent\) !important/);
    assert.match(css, /a, a:link, a:visited[\s\S]*color: var\(--gmixer-link\) !important/);
    assert.match(css, /a:hover, a:focus-visible[\s\S]*color: var\(--gmixer-link-hover\) !important/);
    assert.match(css, /h1 a, h1 a:link, h1 a:visited[\s\S]*color: var\(--gmixer-accent\) !important/);
    assert.match(css, /header a[\s\S]*color: var\(--gmixer-nav-link\) !important/);
    assert.match(css, /footer a/);
    assert.match(
      css,
      /header a:hover[\s\S]*color: var\(--gmixer-nav-link-hover\) !important/
    );
  });

  it('makes nested ink inside links and headings inherit so span headlines restyle', () => {
    const css = buildCss(withTonePaint(createDefaultState().global), null);
    assert.match(css, /a \*,[\s\S]*h1 \*, h2 \*, h3 \*, h4 \*, h5 \*, h6 \*,[\s\S]*color: inherit !important/);
    assert.match(css, /a:hover \*, a:focus-visible \*[\s\S]*color: inherit !important/);
    assert.match(css, /\[data-gmixer-role="article"\] :is\(div, span\)/);
    assert.match(css, /\[data-gmixer-role\] a[\s\S]*color: var\(--gmixer-link\) !important/);
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
    assert.match(css, /\[data-gmixer-media="video-thumbnail"\]/);
    assert.match(css, /outline: 2px solid var\(--gmixer-accent\)/);
    assert.match(css, /\[data-gmixer-media="logo"\][\s\S]*filter: none !important/);
    assert.match(css, /:hover \{ filter: none !important; \}/);
  });

  it('uses a separate overlay for background images instead of filtering their owner', () => {
    const global = createDefaultState().global;
    global.activeThemePackId = 'editorial';
    global.sections.filter = true;
    global.imageFilter.enabled = true;
    global.imageFilter.categories = {
      articleImages: 'none',
      images: 'none',
      bgImages: 'monochrome',
      videos: 'none',
      videoPlayback: 'none',
    };
    const css = buildCss(global, null);

    assert.match(css, /\.gmixer-bgimg-overlay/);
    assert.match(css, /mix-blend-mode: saturation/);
    assert.match(css, /background: #808080 !important/);
    // Full desat — matches filter:grayscale(1) on replaced media.
    assert.match(css, /opacity: 1 !important/);
    // Generic bgimg hosts use an overlay, not filter on the owner itself.
    assert.doesNotMatch(css, /\[data-gmixer-bgimg\]\s*\{[^}]*filter:/);
  });

  it('filters ghost-paint background hosts when Images chroming is on', () => {
    const global = createDefaultState().global;
    global.sections.filter = true;
    global.imageFilter.enabled = true;
    global.imageFilter.categories = {
      articleImages: 'none',
      images: 'monochrome',
      bgImages: 'none',
      videos: 'none',
      videoPlayback: 'none',
    };
    const css = buildCss(global, null);
    assert.match(
      css,
      /\[data-gmixer-bgimg\]\[data-gmixer-ghost-paint\][\s\S]*filter: grayscale\(1\)/
    );
  });

  it('reveals original images and background overlays on hover when enabled', () => {
    const global = createDefaultState().global;
    global.sections.filter = true;
    global.imageFilter.enabled = true;
    global.imageFilter.revealOnHover = true;
    global.imageFilter.categories = {
      articleImages: 'monochrome',
      images: 'monochrome',
      bgImages: 'monochrome',
      videos: 'monochrome',
      videoPlayback: 'monochrome',
    };
    const css = buildCss(global, null);

    assert.match(css, /img:not\(\[data-gmixer-media="article-image"\]\)[\s\S]*filter: grayscale\(1\)/);
    assert.match(css, /img:hover, video:hover/);
    assert.match(css, /a:hover img, a:hover video/);
    assert.match(css, /filter: none !important/);
    assert.match(css, /data-gmixer-ghost-paint\]:hover/);
    assert.match(css, /:hover > \.gmixer-bgimg-overlay \{ opacity: 0 !important; \}/);
  });

  it('emits accent-tint and link-wash when Color is on', () => {
    const global = createDefaultState().global;
    global.sections.filter = true;
    global.sections.color = true;
    global.imageFilter.enabled = true;
    global.color.baseColor = '#3366ff';
    global.color.scheme = 'complement';

    global.imageFilter.categories = {
      articleImages: 'none',
      images: 'accent-tint',
      bgImages: 'none',
      videos: 'none',
      videoPlayback: 'none',
    };
    const tintCss = buildCss(global, null);
    assert.match(
      tintCss,
      /img:not\(\[data-gmixer-media="article-image"\]\)[\s\S]*filter: grayscale\(1\) sepia\(0\.55\) hue-rotate\(\d+deg\) saturate\(0\.85\)/
    );

    global.imageFilter.categories.images = 'link-wash';
    const linkCss = buildCss(global, null);
    assert.match(
      linkCss,
      /img:not\(\[data-gmixer-media="article-image"\]\)[\s\S]*filter: grayscale\(1\) sepia\(1\) hue-rotate\(\d+deg\) saturate\(1\.4\)/
    );
  });

  it('emits surface color casts (bg:secondary) when Color is on', () => {
    const global = createDefaultState().global;
    global.sections.filter = true;
    global.sections.color = true;
    global.imageFilter.enabled = true;
    global.color.baseColor = '#3366ff';
    global.color.scheme = 'complement';
    global.imageFilter.categories = {
      articleImages: 'none',
      images: 'bg:secondary',
      bgImages: 'bg:secondary',
      videos: 'none',
      videoPlayback: 'none',
    };
    const css = buildCss(global, null);
    assert.match(
      css,
      /img:not\(\[data-gmixer-media="article-image"\]\)[\s\S]*filter: grayscale\(1\) sepia\(1\) hue-rotate\(\d+deg\) saturate\(1\.4\)/
    );
    assert.match(css, /mix-blend-mode: color/);
    assert.doesNotMatch(css, /background: #808080 !important/);
  });

  it('falls palette washes back to monochrome when Color is off', () => {
    const global = createDefaultState().global;
    global.sections.filter = true;
    global.sections.color = false;
    global.sections.tone = false;
    global.imageFilter.enabled = true;
    global.imageFilter.categories = {
      articleImages: 'none',
      images: 'accent-tint',
      bgImages: 'accent-tint',
      videos: 'none',
      videoPlayback: 'none',
    };
    const css = buildCss(global, null);

    assert.match(css, /img:not\(\[data-gmixer-media="article-image"\]\)[\s\S]*filter: grayscale\(1\) contrast/);
    assert.doesNotMatch(css, /sepia\(0\.55\)/);
    assert.match(css, /mix-blend-mode: saturation/);
    assert.match(css, /background: #808080 !important/);
  });

  it('falls surface color casts back to monochrome when Color is off', () => {
    const global = createDefaultState().global;
    global.sections.filter = true;
    global.sections.color = false;
    global.sections.tone = false;
    global.imageFilter.enabled = true;
    global.imageFilter.categories = {
      articleImages: 'none',
      images: 'bg:secondary',
      bgImages: 'surface:gui',
      videos: 'none',
      videoPlayback: 'none',
    };
    const css = buildCss(global, null);
    assert.match(css, /img:not\(\[data-gmixer-media="article-image"\]\)[\s\S]*filter: grayscale\(1\) contrast/);
    assert.doesNotMatch(css, /sepia\(1\) hue-rotate/);
    assert.match(css, /mix-blend-mode: saturation/);
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
    global.imageFilter.categories = {
      articleImages: 'monochrome',
      images: 'monochrome',
      bgImages: 'none',
      videos: 'monochrome',
      videoPlayback: 'monochrome',
    };
    const css = buildCss(global, null);
    assert.match(css, /img:not\(\[data-gmixer-media="article-image"\]\)[\s\S]*filter:/);
    assert.match(css, /grayscale\(1\)/);
    assert.doesNotMatch(css, /--gmixer-bg-primary:/);
    assert.doesNotMatch(css, /--gmixer-text:/);
    assert.doesNotMatch(css, /font-family:/);
  });

  it('tone-only focus paints surfaces without media filters', () => {
    const global = withTonePaint(createDefaultState().global);
    global.ui.settingsFocus = 'tone';
    global.sections.filter = true;
    global.imageFilter.enabled = true;
    const css = buildCss(global, null);
    assert.match(css, /--gmixer-bg-primary:/);
    assert.doesNotMatch(css, /data-gmixer-media="article-image"/);
    assert.doesNotMatch(css, /img:not\(\[data-gmixer-media="article-image"\]\)[\s\S]*filter:/);
  });
});

describe('theme package schema', () => {
  it('gives every pack shared light/gray/dark modes and media slots', () => {
    const mediaRoles = ['articleImage', 'videoThumbnail', 'avatar', 'logo', 'ad', 'hero', 'card', 'sidebar'];
    for (const pack of THEME_PACKS) {
      assert.deepEqual(Object.keys(pack.modes).sort(), [
        'dark',
        'dark-gray',
        'gray',
        'light',
        'light-gray',
      ]);
      for (const role of mediaRoles) {
        assert.ok(pack.media[role]);
        assert.ok(typeof pack.media[role].filter === 'string');
        assert.ok(['none', 'accent'].includes(pack.media[role].outline));
      }
    }
  });

  it('preserves each pack personality while tone changes its surfaces', () => {
    for (const pack of THEME_PACKS.filter((pack) => pack.patch.color)) {
      const { baseColor, scheme } = pack.patch.color;
      const palettes = ['light', 'light-gray', 'gray', 'dark-gray', 'dark'].map((mode) =>
        buildPalette(baseColor, scheme, mode)
      );

      assert.ok(pack.patch.fonts.headers.fontId, `${pack.label} keeps its type pairing`);
      assert.ok(pack.media.defaultFilter !== undefined, `${pack.label} keeps its media direction`);
      assert.ok(hexToHsl(palettes[0].background).l > hexToHsl(palettes[1].background).l);
      assert.ok(hexToHsl(palettes[1].background).l > hexToHsl(palettes[2].background).l);
      assert.ok(hexToHsl(palettes[2].background).l > hexToHsl(palettes[3].background).l);
      assert.ok(hexToHsl(palettes[3].background).l > hexToHsl(palettes[4].background).l);
    }
  });
});
