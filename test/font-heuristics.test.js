import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getFontById,
  getFontsForTarget,
  FONTS,
} from '../src/config/fonts.js';
import {
  isFontSuitableForTarget,
  enrichFontEntry,
} from '../src/config/font-heuristics.js';

describe('font-heuristics', () => {
  it('enriches catalog entries with usage and longForm', () => {
    const ring = getFontById('ring-matrix');
    const fund = getFontById('fundamental');
    const tippa = getFontById('tippa');
    const youbilee = getFontById('youbilee');
    const din = getFontById('din-1451-h');

    assert.equal(ring.usage, 'display');
    assert.equal(ring.longForm, false);

    assert.equal(fund.usage, 'both');
    assert.equal(fund.longForm, true);

    assert.equal(tippa.usage, 'both');
    assert.equal(tippa.longForm, true);

    assert.equal(youbilee.textSafe, false);
    assert.equal(din.pairGroup, 'din');
  });

  it('keeps display faces out of body by default', () => {
    const ring = getFontById('ring-matrix');
    assert.equal(isFontSuitableForTarget(ring, 'paragraph'), false);
    assert.equal(isFontSuitableForTarget(ring, 'headers'), true);
    assert.equal(isFontSuitableForTarget(ring, 'paragraph', { showAll: true }), true);
  });

  it('allows long-form text faces for paragraphs', () => {
    const fund = getFontById('fundamental');
    assert.equal(isFontSuitableForTarget(fund, 'paragraph'), true);
    assert.equal(isFontSuitableForTarget(fund, 'headers'), true);
  });

  it('allows script faces for captions but not body', () => {
    const euro = getFontById('euro-script');
    assert.equal(euro.usage, 'display');
    assert.equal(isFontSuitableForTarget(euro, 'captions'), true);
    assert.equal(isFontSuitableForTarget(euro, 'paragraph'), false);
  });

  it('excludes script faces from recommended headers but keeps them with Show all', () => {
    const euro = getFontById('euro-script');
    assert.equal(isFontSuitableForTarget(euro, 'headers'), false);
    assert.equal(isFontSuitableForTarget(euro, 'subheadings'), false);
    assert.equal(isFontSuitableForTarget(euro, 'headers', { showAll: true }), true);
  });

  it('excludes ornament fonts unless showAll', () => {
    const youbilee = getFontById('youbilee');
    assert.equal(isFontSuitableForTarget(youbilee, 'headers'), false);
    assert.equal(isFontSuitableForTarget(youbilee, 'headers', { showAll: true }), true);
  });

  it('getFontsForTarget returns a filtered subset', () => {
    const body = getFontsForTarget('paragraph');
    const all = getFontsForTarget('paragraph', { showAll: true });
    assert.ok(body.length < all.length);
    assert.ok(body.every((f) => f.longForm && (f.usage === 'text' || f.usage === 'both')));
    assert.equal(all.length, FONTS.length);
  });

  it('enrichFontEntry merges category defaults with overrides', () => {
    const enriched = enrichFontEntry({
      id: 'schulkursiv',
      category: 'script',
      label: 'Schulkursiv',
      family: '"Schulkursiv"',
      file: 'script/schulkursiv.ttf',
    });
    assert.equal(enriched.usage, 'both');
    assert.equal(enriched.longForm, true);
  });
});
