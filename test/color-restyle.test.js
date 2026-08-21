import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPalette, hexToHsl } from '../src/lib/color-theory.js';
import { blendWithPageSample, parseCssColor } from '../src/content/page-sampler.js';

describe('color-theory', () => {
  it('builds a split-complement palette from a base color', () => {
    const palette = buildPalette('#7c3aed', 'splitComplement');
    assert.match(palette.background, /^#[0-9a-f]{6}$/i);
    assert.match(palette.text, /^#[0-9a-f]{6}$/i);
    assert.match(palette.accent, /^#[0-9a-f]{6}$/i);
    assert.notEqual(palette.accent, palette.link);
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
  });
});
