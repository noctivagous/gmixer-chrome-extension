import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEffects } from '../src/config/effects-catalog.js';
import { buildPreviewEffectsCss, previewEffectsActive } from '../src/lib/preview-effects-css.js';
import { buildCss } from '../src/content/style-injector.js';
import { createDefaultState } from '../src/state/schema.js';
import { gridIndexToPercent, GRID_SIZE } from '../src/content/pan-scan.js';

describe('effects catalog', () => {
  it('clamps invalid category effects to none', () => {
    const normalized = normalizeEffects({
      categories: {
        images: { effect: 'not-a-real-effect' },
        videos: { effect: 'glow' },
        navigation: { effect: 'pan-scan' },
      },
      glow: { animated: false, color: '#ff00aa' },
    });
    assert.equal(normalized.categories.images.effect, 'none');
    assert.equal(normalized.categories.videos.effect, 'glow');
    assert.equal(normalized.categories.navigation.effect, 'none');
    assert.equal(normalized.categories.hyperlinks.effect, 'none');
    assert.equal(normalized.glow.animated, false);
    assert.equal(normalized.glow.color, '#ff00aa');
  });

  it('defaults missing hyperlinks category to none', () => {
    const normalized = normalizeEffects({
      categories: { navigation: { effect: 'glow' } },
    });
    assert.equal(normalized.categories.hyperlinks.effect, 'none');
    assert.equal(normalized.categories.navigation.effect, 'glow');
  });

  it('copies shared glow onto navigation when category glow is absent', () => {
    const normalized = normalizeEffects({
      categories: { navigation: { effect: 'glow' } },
      glow: { animated: false, color: '#112233' },
    });
    assert.equal(normalized.categories.navigation.glow.color, '#112233');
    assert.equal(normalized.categories.navigation.glow.animated, false);
    assert.equal(normalized.categories.hyperlinks.glow.color, '');
  });
});

describe('effectsRules category paint', () => {
  function withEffects(patch) {
    const global = createDefaultState().global;
    global.sections.effects = true;
    global.effects = normalizeEffects({
      ...global.effects,
      ...patch,
      categories: {
        ...global.effects.categories,
        ...(patch.categories || {}),
      },
    });
    return global;
  }

  it('outsets opaque logo glow and skips the box on transparent logos', () => {
    const css = buildCss(
      withEffects({
        categories: { images: { effect: 'glow' } },
        glow: { animated: true, color: '#00ff00' },
      }),
      null
    );
    assert.match(css, /gmixer-glow-logo-box-pulse/);
    assert.match(css, /0 0 4px 3px/);
    assert.match(css, /\[data-gmixer-media="logo"\]:not\(\[data-gmixer-alpha\]\)/);
    assert.match(css, /gmixer-glow-logo-drop-pulse/);
    assert.match(css, /\[data-gmixer-media="logo"\]\[data-gmixer-alpha\]/);
    assert.match(
      css,
      /img:not\(\[data-gmixer-media="logo"\]\), picture img:not\(\[data-gmixer-media="logo"\]\)/
    );
  });

  it('emits pan-scan keyframes for images', () => {
    const css = buildCss(
      withEffects({
        categories: { images: { effect: 'pan-scan' } },
      }),
      null
    );
    assert.match(css, /@keyframes gmixer-pan-scan-fade/);
    assert.match(css, /@keyframes gmixer-pan-scan-rest/);
    assert.match(css, /\[data-gmixer-pan-scan-target="fade"\]/);
    assert.match(css, /\[data-gmixer-pan-scan-rest\]/);
    assert.doesNotMatch(css, /infinite alternate/);
  });

  it('emits oscillate pan-scan when loop is oscillate', () => {
    const css = buildCss(
      withEffects({
        categories: { images: { effect: 'pan-scan' } },
        panScan: { loop: 'oscillate' },
      }),
      null
    );
    assert.match(css, /@keyframes gmixer-pan-scan-oscillate/);
    assert.match(css, /infinite alternate/);
  });

  it('defaults pan-scan loop to fade and clamps invalid loop values', () => {
    assert.equal(normalizeEffects({}).panScan.loop, 'fade');
    assert.equal(normalizeEffects({ panScan: { loop: 'nope' } }).panScan.loop, 'fade');
    assert.equal(normalizeEffects({ panScan: { loop: 'oscillate' } }).panScan.loop, 'oscillate');
  });

  it('defaults pan-scan motion to scan and clamps invalid motion values', () => {
    assert.equal(normalizeEffects({}).panScan.motion, 'scan');
    assert.equal(normalizeEffects({ panScan: { motion: 'nope' } }).panScan.motion, 'scan');
    assert.equal(normalizeEffects({ panScan: { motion: 'pan' } }).panScan.motion, 'pan');
    assert.equal(normalizeEffects({ panScan: { motion: 'tilt' } }).panScan.motion, 'tilt');
  });

  it('emits transform-origin vars for pan-scan grid zooms', () => {
    const css = buildCss(
      withEffects({
        categories: { images: { effect: 'pan-scan' } },
      }),
      null
    );
    assert.match(css, /transform-origin: var\(--gmixer-pan-ox/);
    assert.match(css, /--gmixer-pan-oy/);
  });

  it('maps 9x9 grid indices into a distance-scaled origin range', () => {
    assert.equal(GRID_SIZE, 9);
    assert.equal(gridIndexToPercent(4, 3), 50);
    assert.ok(gridIndexToPercent(0, 3) < 50);
    assert.ok(gridIndexToPercent(8, 3) > 50);
    assert.ok(gridIndexToPercent(0, 12) < gridIndexToPercent(0, 3));
  });

  it('emits rotating-cube keyframes and face transforms', () => {
    const css = buildCss(
      withEffects({
        categories: { images: { effect: 'rotating-cube' } },
      }),
      null
    );
    assert.match(css, /@keyframes gmixer-rotating-cube/);
    assert.match(css, /rotateY\(360deg\)/);
    assert.match(css, /\[data-gmixer-rotating-cube\]/);
    assert.match(css, /\[data-gmixer-rotating-cube-face="front"\]/);
    assert.match(css, /--gmixer-cube-half-w/);
    assert.match(css, /--gmixer-cube-half-d/);
  });

  it('migrates pan-scan and rotating-cube off images.effect onto images.motion', () => {
    const cube = normalizeEffects({ categories: { images: { effect: 'rotating-cube' } } });
    assert.equal(cube.categories.images.effect, 'none');
    assert.equal(cube.categories.images.motion, 'rotating-cube');
    const pan = normalizeEffects({ categories: { images: { effect: 'pan-scan' } } });
    assert.equal(pan.categories.images.effect, 'none');
    assert.equal(pan.categories.images.motion, 'pan-scan');
    const both = normalizeEffects({
      categories: { images: { effect: 'glow', motion: 'pan-scan' } },
    });
    assert.equal(both.categories.images.effect, 'glow');
    assert.equal(both.categories.images.motion, 'pan-scan');
  });

  it('emits navigation glow on nav/header/footer selectors, not bare a', () => {
    const css = buildCss(
      withEffects({
        categories: { navigation: { effect: 'glow' } },
        glow: { animated: true, color: '' },
      }),
      null
    );
    assert.match(css, /nav a/);
    assert.match(css, /footer a/);
    assert.match(css, /\[role="navigation"\] a/);
    assert.match(css, /\[role="contentinfo"\] a/);
    assert.match(css, /button, \[role="button"\]/);
    assert.match(css, /\[data-gmixer-nav-hit\]/);
    assert.match(css, /nav \[aria-haspopup\]/);
    assert.match(css, /nav summary/);
    assert.match(css, /header summary/);
    assert.match(css, /gmixer-glow-pulse-nav/);
    assert.doesNotMatch(css, /gmixer-glow-pulse-link/);
    assert.doesNotMatch(css, /(?:^|\n)\s*a, button, \[role="button"\] \{ animation/);
  });

  it('emits body-link glow on a and cancels it on chrome and heading links', () => {
    const css = buildCss(
      withEffects({
        categories: {
          hyperlinks: { effect: 'glow', glow: { animated: true, color: '#ff00aa' } },
        },
      }),
      null
    );
    assert.match(css, /gmixer-glow-pulse-link/);
    // Unclip the anchors only — parent :has(> a) breaks overflow:hidden dropdowns.
    assert.match(css, /(?:^|\n)\s*a \{\s*overflow: visible !important;/);
    assert.doesNotMatch(css, /:has\(> a\),\s*:has\(> button\)/);
    assert.match(css, /#ff00aa/);
    assert.match(css, /footer a,[\s\S]*h1 a[\s\S]*text-shadow: none/);
    assert.doesNotMatch(css, /gmixer-glow-pulse-nav/);
  });

  it('unclips image glow parents but not the images themselves', () => {
    const imageCss = buildCss(
      withEffects({
        categories: { images: { effect: 'glow' } },
        glow: { animated: true, color: '' },
      }),
      null
    );
    assert.match(imageCss, /:has\(> img\), :has\(> picture img\) \{\s*overflow: visible !important;/);
    assert.doesNotMatch(imageCss, /(?:^|\n)\s*img, picture img,/);

    const videoCss = buildCss(
      withEffects({
        categories: { videos: { effect: 'glow' } },
        glow: { animated: true, color: '' },
      }),
      null
    );
    assert.match(videoCss, /:has\(> video\) \{\s*overflow: visible !important;/);
    assert.doesNotMatch(videoCss, /(?:^|\n)\s*video \{\s*overflow: visible !important;/);

    const navCss = buildCss(
      withEffects({
        categories: { navigation: { effect: 'glow' } },
        glow: { animated: true, color: '' },
      }),
      null
    );
    assert.doesNotMatch(navCss, /:has\(> a\),/);
  });

  it('keeps independent glow colors for body vs navigation links', () => {
    const css = buildCss(
      withEffects({
        categories: {
          hyperlinks: { effect: 'glow', glow: { animated: false, color: '#ff0000' } },
          navigation: { effect: 'glow', glow: { animated: false, color: '#00ff00' } },
        },
      }),
      null
    );
    assert.match(css, /a \{ text-shadow: 0 0 8px #ff0000; \}/);
    assert.match(css, /nav a[\s\S]*text-shadow: 0 0 8px #00ff00/);
  });

  it('emits an offset drop-glow distinct from centered glow', () => {
    const css = buildCss(
      withEffects({
        categories: { images: { effect: 'drop-glow' }, hyperlinks: { effect: 'drop-glow' } },
        glow: { animated: false, color: '#ff00aa' },
      }),
      null
    );
    assert.match(css, /box-shadow: 4px 10px 20px #ff00aa/);
    assert.match(css, /a \{ text-shadow: 2px 4px 10px /);
    assert.doesNotMatch(css, /gmixer-glow-box-pulse/);
    assert.doesNotMatch(css, /box-shadow: 0 0 12px/);
  });

  it('aliases saved drop-shadow to drop-glow', () => {
    const normalized = normalizeEffects({
      categories: { images: { effect: 'drop-shadow' } },
    });
    assert.equal(normalized.categories.images.effect, 'drop-glow');
  });

  it('emits a rotating marquee outline on images and article containers', () => {
    const css = buildCss(
      withEffects({
        categories: { images: { effect: 'marquee' }, articles: { effect: 'marquee' } },
      }),
      null
    );
    assert.match(css, /@keyframes gmixer-marquee-spin/);
    assert.match(css, /--gmixer-marquee-angle/);
    assert.match(css, /conic-gradient\(from var\(--gmixer-marquee-angle\)/);
    assert.match(css, /article, \[role="article"\]/);
  });

  it('omits effects CSS when the Effects section is off', () => {
    const global = withEffects({
      categories: { images: { effect: 'pan-scan' }, navigation: { effect: 'glow' } },
    });
    global.sections.effects = false;
    const css = buildCss(global, null);
    assert.doesNotMatch(css, /gmixer-pan-scan/);
    assert.doesNotMatch(css, /gmixer-glow-pulse/);
  });
});

describe('preview effects css', () => {
  it('scopes image glow to the theme preview blurb', () => {
    const css = buildPreviewEffectsCss(
      { categories: { images: { effect: 'glow' } }, glow: { animated: false, color: '#ff00aa' } },
      { accent: '#7c3aed' }
    );
    assert.match(css, /\.theme-preview \.blurb-image/);
    assert.match(css, /#ff00aa/);
    assert.doesNotMatch(css, /^img,/m);
  });

  it('animates the preview image using Pan & Scan direction and distance', () => {
    const css = buildPreviewEffectsCss(
      {
        categories: { images: { effect: 'pan-scan' } },
        panScan: { speed: 12, zoom: 20, distance: 8, loop: 'oscillate', motion: 'pan' },
      },
      { accent: '#7c3aed' }
    );
    assert.match(css, /gmixer-preview-pan-scan-oscillate 12s/);
    assert.match(css, /translate\(-4%, 0%\)/);
    assert.match(css, /translate\(4%, 0%\) scale\(1\.2\)/);
  });

  it('animates the preview rotating cube scene', () => {
    const css = buildPreviewEffectsCss(
      { categories: { images: { effect: 'rotating-cube' } } },
      { accent: '#7c3aed' }
    );
    assert.match(css, /gmixer-preview-rotating-cube/);
    assert.match(css, /\.theme-preview \.blurb-cube \{ animation:/);
  });

  it('activates preview effects only when the Effects section is on', () => {
    const global = createDefaultState().global;
    global.sections.effects = false;
    global.effects.categories.images.effect = 'glow';
    assert.equal(previewEffectsActive(global), false);
    global.sections.effects = true;
    assert.equal(previewEffectsActive(global), true);
  });

  it('activates preview when only image motion is on', () => {
    const global = createDefaultState().global;
    global.sections.effects = true;
    global.effects.categories.images.motion = 'pan-scan';
    assert.equal(previewEffectsActive(global), true);
  });

  it('previews offset drop-glow and marquee outline', () => {
    const shadow = buildPreviewEffectsCss(
      { categories: { images: { effect: 'drop-glow' } }, glow: { animated: false, color: '#ff00aa' } },
      { accent: '#7c3aed' }
    );
    assert.match(shadow, /4px 10px 20px #ff00aa/);
    const marquee = buildPreviewEffectsCss(
      { categories: { images: { effect: 'marquee' } } },
      { accent: '#7c3aed' }
    );
    assert.match(marquee, /gmixer-preview-marquee-spin/);
    assert.match(marquee, /\.theme-preview \.blurb-image/);
  });
});
