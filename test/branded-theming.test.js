import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hexToHsl } from '../src/lib/color-theory.js';
import {
  blendWithPageSample,
  colorClusterKey,
  deriveBrandFamily,
  harmonizeHue,
  pickBestScoredColor,
  scoreColorSample,
} from '../src/content/page-sampler.js';
import { waitForPageSettle } from '../src/content/page-settle.js';

describe('page-sampler branded roles', () => {
  it('clusters nearby colors onto the same key', () => {
    assert.equal(colorClusterKey('#006666'), colorClusterKey('#006660'));
    assert.notEqual(colorClusterKey('#006666'), colorClusterKey('#990066'));
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

  it('picks the repeated cluster over a one-off', () => {
    const color = pickBestScoredColor([
      { color: '#006666', score: 2, areaRatio: 0.1, top: 0, area: 1, tag: 'A', role: null },
      { color: '#006660', score: 2, areaRatio: 0.1, top: 0, area: 1, tag: 'A', role: null },
      { color: '#006655', score: 2, areaRatio: 0.1, top: 0, area: 1, tag: 'A', role: null },
      { color: '#ff00aa', score: 3, areaRatio: 0.2, top: 0, area: 1, tag: 'IMG', role: null },
    ]);
    assert.match(color, /^#0066/i);
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
    assert.match(family.textOnBrand, /^#/);
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
  });
});

describe('page-settle', () => {
  it('resolves within the timeout budget', async () => {
    const started = Date.now();
    await waitForPageSettle({ timeoutMs: 20 });
    assert.ok(Date.now() - started < 200);
  });
});
