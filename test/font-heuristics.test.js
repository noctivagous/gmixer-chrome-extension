import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getFontById,
  getFontsForTarget,
  FONTS,
  FONT_CATEGORIES,
} from '../src/config/fonts.js';
import {
  isFontSuitableForTarget,
  enrichFontEntry,
} from '../src/config/font-heuristics.js';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FONTS_DIR = join(ROOT, 'extension', 'fonts');

describe('font-heuristics', () => {
  it('enriches catalog entries with usage and longForm', () => {
    const ring = getFontById('ring-matrix');
    const fund = getFontById('fundamental');
    const tippa = getFontById('tippa');
    const din = getFontById('din-1451-h');

    assert.equal(ring.usage, 'display');
    assert.equal(ring.longForm, false);

    assert.equal(fund.usage, 'both');
    assert.equal(fund.longForm, true);

    assert.equal(tippa.usage, 'both');
    assert.equal(tippa.longForm, true);

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
    const ornament = enrichFontEntry({
      id: 'ornament-fixture',
      label: 'Ornament Fixture',
      category: 'display',
      family: '"Ornament Fixture"',
      file: 'display/ornament-fixture.ttf',
    });
    // Simulate a textSafe:false override the way retired dingbats used to.
    const dingbat = { ...ornament, textSafe: false };
    assert.equal(isFontSuitableForTarget(dingbat, 'headers'), false);
    assert.equal(isFontSuitableForTarget(dingbat, 'headers', { showAll: true }), true);
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

describe('fonts catalog mirrors filesystem', () => {
  it('every bundled file path exists on disk', () => {
    for (const font of FONTS) {
      if (!font.file) continue;
      assert.ok(
        existsSync(join(FONTS_DIR, font.file)),
        `missing ${font.file} for ${font.id}`
      );
    }
  });

  it('does not list retired fonts', () => {
    const retired = [
      'alpha-54',
      'youbilee',
      'goldmarie',
      'baudot-murray',
      'hardman',
    ];
    for (const id of retired) {
      assert.equal(getFontById(id), null, `retired font still catalogued: ${id}`);
    }
  });

  it('FONT_CATEGORIES includes system and disk-backed categories', () => {
    const ids = FONT_CATEGORIES.map((c) => c.id);
    assert.ok(ids.includes('system'));
    assert.ok(ids.includes('script'));
    assert.ok(ids.includes('technical'));
    assert.ok(!ids.includes('google'), 'google/ is a source bucket, not a UI category');
  });
});
