import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { imageHasTransparency, stampLogoAlpha } from '../src/content/logo-alpha.js';
import { LOGO_ALPHA_ATTR } from '../src/content/page-classifier.js';

describe('logo alpha', () => {
  it('treats SVG sources as transparent', () => {
    const img = {
      currentSrc: 'https://example.test/brand/logo.svg?v=2',
      src: '',
      complete: true,
      naturalWidth: 120,
    };
    assert.equal(imageHasTransparency(img), true);
  });

  it('treats fully opaque sampled pixels as a box-glow logo', () => {
    const pixels = new Uint8ClampedArray(16);
    for (let i = 0; i < 16; i += 4) {
      pixels[i] = 10;
      pixels[i + 1] = 20;
      pixels[i + 2] = 30;
      pixels[i + 3] = 255;
    }
    const previous = globalThis.document;
    globalThis.document = {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({
          drawImage() {},
          getImageData: () => ({ data: pixels }),
        }),
      }),
    };
    try {
      const img = {
        currentSrc: 'https://example.test/logo.png',
        complete: true,
        naturalWidth: 8,
        naturalHeight: 8,
      };
      assert.equal(imageHasTransparency(img), false);
    } finally {
      globalThis.document = previous;
    }
  });

  it('stamps data-gmixer-alpha on transparent classified logos', () => {
    const img = {
      tagName: 'IMG',
      currentSrc: 'https://cdn.example.test/wordmark.svg',
      src: '',
      complete: true,
      naturalWidth: 64,
      attributes: { 'data-gmixer-media': 'logo' },
      hasAttribute(name) {
        return name in this.attributes;
      },
      getAttribute(name) {
        return this.attributes[name] ?? null;
      },
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
      removeAttribute(name) {
        delete this.attributes[name];
      },
    };
    const root = {
      querySelectorAll: (selector) =>
        selector.includes('logo') ? [img] : [],
    };
    stampLogoAlpha(root);
    assert.equal(img.getAttribute(LOGO_ALPHA_ATTR), '');
  });
});
