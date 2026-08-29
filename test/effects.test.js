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

  it('allows rotating-cube on images', () => {
    assert.equal(
      normalizeEffects({ categories: { images: { effect: 'rotating-cube' } } }).categories.images
        .effect,
      'rotating-cube'
    );
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
    assert.match(css, /:has\(> a\)/);
    assert.match(css, /overflow: visible !important/);
    assert.match(css, /#ff00aa/);
    assert.match(css, /footer a,[\s\S]*h1 a[\s\S]*text-shadow: none/);
    assert.doesNotMatch(css, /gmixer-glow-pulse-nav/);
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
});
