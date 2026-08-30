import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDecorativeChromeBackground } from '../src/content/background-image-tagger.js';

describe('background-image tagger', () => {
  it('treats Breitbart-sized Fight Club nav sprites as decorative chrome', () => {
    const el = {
      nodeType: 1,
      getBoundingClientRect: () => ({ width: 114, height: 45 }),
    };
    assert.equal(
      isDecorativeChromeBackground(el, { backgroundSize: '17px auto' }),
      true
    );
  });

  it('does not treat large photo sheets as decorative', () => {
    const el = {
      nodeType: 1,
      getBoundingClientRect: () => ({ width: 640, height: 360 }),
    };
    assert.equal(
      isDecorativeChromeBackground(el, { backgroundSize: 'cover' }),
      false
    );
  });

  it('treats tiny background-size sprites as decorative even in larger boxes', () => {
    const el = {
      nodeType: 1,
      getBoundingClientRect: () => ({ width: 320, height: 80 }),
    };
    assert.equal(
      isDecorativeChromeBackground(el, { backgroundSize: '17px auto' }),
      true
    );
  });
});
