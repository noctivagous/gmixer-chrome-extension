import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  contrastRatio,
  hexLabDistance,
  hexToHsl,
  hexToLab,
  hexToOklchApprox,
} from '../src/lib/color-theory.js';
import {
  blendWithPageSample,
  colorClusterKey,
  contrastPairBonus,
  deriveBrandFamily,
  harmonizeHue,
  pickBestScoredColor,
  scoreColorSample,
} from '../src/content/page-sampler.js';
import { waitForPageSettle } from '../src/content/page-settle.js';
import { buildCss } from '../src/content/style-injector.js';
import { createDefaultState } from '../src/state/schema.js';

function withTonePaint(global) {
  global.sections.tone = true;
  global.sections.color = true;
  global.color.identityMode = 'preserve';
  return global;
}

describe('page-sampler branded roles', () => {
  it('keeps far hues on different Lab cluster keys', () => {
    assert.notEqual(colorClusterKey('#006666'), colorClusterKey('#990066'));
  });

  it('merges near colors by Lab ΔE even across bucket edges', () => {
    const color = pickBestScoredColor([
      { color: '#006666', score: 2, areaRatio: 0.1, top: 0, area: 1, tag: 'A', role: null },
      { color: '#007070', score: 2, areaRatio: 0.1, top: 0, area: 1, tag: 'A', role: null },
      { color: '#005c5c', score: 2, areaRatio: 0.1, top: 0, area: 1, tag: 'A', role: null },
      { color: '#ff00aa', score: 3, areaRatio: 0.2, top: 0, area: 1, tag: 'IMG', role: null },
    ]);
    assert.ok(hexLabDistance(color, '#006666') < 25);
  });

  it('scores larger, top-of-page saturated samples higher for identity', () => {
    const largeTop = scoreColorSample(
      { color: '#00aa88', areaRatio: 0.4, top: 10, area: 1000, tag: 'HEADER', role: 'banner' },
      { identity: true }
    );
    const tinyBottom = scoreColorSample(
      { color: '#00aa88', areaRatio: 0.01, top: 700, area: 10, tag: 'DIV', role: null },
      { identity: true }
    );
    assert.ok(largeTop > tinyBottom);
  });

  it('rewards readable text-on-brand pairs and penalizes poor contrast', () => {
    assert.ok(contrastPairBonus('#ffffff', '#006666') > contrastPairBonus('#006666', '#006666'));
    assert.ok(contrastPairBonus('#111111', '#eeeeee') > 0);
    assert.ok(contrastPairBonus('#222222', '#222222') < 0);

    const readable = scoreColorSample(
      {
        color: '#006666',
        pairedText: '#ffffff',
        areaRatio: 0.2,
        top: 20,
        area: 100,
        tag: 'HEADER',
        role: 'banner',
      },
      { identity: true, asBackground: true }
    );
    const unreadable = scoreColorSample(
      {
        color: '#006666',
        pairedText: '#006666',
        areaRatio: 0.2,
        top: 20,
        area: 100,
        tag: 'HEADER',
        role: 'banner',
      },
      { identity: true, asBackground: true }
    );
    assert.ok(readable > unreadable);
  });

  it('harmonizes hue while keeping lightness and saturation', () => {
    const page = '#006666';
    const themeAccent = '#7c3aed';
    const result = harmonizeHue(page, themeAccent);
    assert.equal(Math.round(hexToHsl(result).h), Math.round(hexToHsl(themeAccent).h));
    assert.ok(Math.abs(hexToHsl(result).l - hexToHsl(page).l) < 1);
    assert.ok(Math.abs(hexToHsl(result).s - hexToHsl(page).s) < 1);
  });

  it('derives a brand family from an identity color', () => {
    const family = deriveBrandFamily('#006666', true);
    assert.equal(family.brand, '#006666');
    assert.ok(hexToHsl(family.tint).l > hexToHsl(family.brand).l);
    assert.ok(hexToHsl(family.shade).l < hexToHsl(family.brand).l);
    assert.ok(contrastRatio(family.textOnBrand, family.brand) >= 4.5);
    assert.match(family.hover, /^#/);
    assert.match(family.active, /^#/);
  });

  it('preserve mode keeps page identity while blending structure', () => {
    const theme = {
      background: '#111111',
      text: '#eeeeee',
      accent: '#7c3aed',
      link: '#a78bfa',
      border: '#333333',
    };
    const page = {
      background: '#ffffff',
      text: '#111111',
      accent: '#006666',
      link: '#008888',
      border: '#cccccc',
      headerSizeVariance: 0.4,
      structural: {
        background: '#ffffff',
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
    const result = blendWithPageSample(theme, page, 100, 'preserve');
    assert.equal(result.background, theme.background);
    assert.equal(result.accent, '#006666');
    assert.equal(result.link, '#008888');
    assert.equal(result.masthead, '#006666');
    assert.equal(result.nav, '#006666');
    assert.ok(result.brandFamily);
  });

  it('harmonize mode remaps identity hue to theme accent', () => {
    const theme = {
      background: '#111111',
      text: '#eeeeee',
      accent: '#7c3aed',
      link: '#a78bfa',
      border: '#333333',
    };
    const page = {
      background: '#ffffff',
      text: '#111111',
      accent: '#006666',
      link: '#008888',
      border: '#cccccc',
      structural: { background: '#ffffff', text: '#111111', border: '#cccccc' },
      identity: { accent: '#006666', link: '#008888', masthead: '#006666', nav: '#006666' },
    };
    const result = blendWithPageSample(theme, page, 80, 'harmonize');
    assert.equal(Math.round(hexToHsl(result.accent).h), Math.round(hexToHsl(theme.accent).h));
    assert.ok(Math.abs(hexToHsl(result.accent).l - hexToHsl('#006666').l) < 1);
    assert.equal(
      Math.round(hexToHsl(result.masthead).h),
      Math.round(hexToHsl(theme.accent).h)
    );
  });

  it('paints detected branded masthead and navigation regions only', () => {
    const page = {
      background: '#ffffff',
      text: '#111111',
      accent: '#006666',
      link: '#008888',
      border: '#cccccc',
      structural: { background: '#ffffff', text: '#111111', border: '#cccccc' },
      identity: { accent: '#006666', link: '#008888', masthead: '#006666', nav: '#004444' },
      masthead: '#006666',
      nav: '#004444',
    };
    const css = buildCss(withTonePaint(createDefaultState().global), page);
    assert.match(css, /--gmixer-masthead: #006666;/);
    assert.match(css, /--gmixer-nav: #004444;/);
    assert.match(css, /body \.masthead/);
    assert.match(css, /body \.navbar/);
    assert.match(css, /--site-header-background-color: var\(--gmixer-masthead\)/);
  });

  it('reads masthead/nav from nested identity when top-level keys are absent', () => {
    const page = {
      background: '#ffffff',
      text: '#111111',
      accent: '#006666',
      link: '#008888',
      border: '#cccccc',
      structural: { background: '#ffffff', text: '#111111', border: '#cccccc' },
      identity: { accent: '#006666', link: '#008888', masthead: '#006666', nav: '#004444' },
    };
    const css = buildCss(withTonePaint(createDefaultState().global), page);
    assert.match(css, /--gmixer-masthead: #006666;/);
    assert.match(css, /--gmixer-nav: #004444;/);
    assert.match(css, /body \.masthead/);
    assert.match(css, /body \.navbar/);
  });

  it('emits brand-family hover/active CSS variables and rules', () => {
    const css = buildCss(withTonePaint(createDefaultState().global), null);
    assert.match(css, /--gmixer-brand:/);
    assert.match(css, /--gmixer-brand-hover:/);
    assert.match(css, /--gmixer-brand-active:/);
    assert.match(css, /--gmixer-brand-text:/);
    assert.match(css, /a:hover/);
    assert.match(css, /a:active/);
    assert.match(css, /button:hover/);
  });
});

describe('lab color space', () => {
  it('converts hex to Lab and measures perceptual distance', () => {
    const lab = hexToLab('#006666');
    assert.ok(lab.L > 20 && lab.L < 50);
    assert.ok(hexLabDistance('#006666', '#006660') < hexLabDistance('#006666', '#990066'));
    const oklch = hexToOklchApprox('#006666');
    assert.ok(oklch.L > 0 && oklch.L < 1);
    assert.ok(oklch.C >= 0);
  });
});

describe('page-settle', () => {
  it('resolves within the timeout budget', async () => {
    const started = Date.now();
    await waitForPageSettle({ timeoutMs: 20 });
    assert.ok(Date.now() - started < 200);
  });
});
