import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isDecorativeChromeBackground,
  tagGhostMediaBackgroundHosts,
  BACKGROUND_IMAGE_OVERLAY_CLASS,
} from '../src/content/background-image-tagger.js';
import {
  BACKGROUND_IMAGE_ATTR,
  GHOST_PAINT_ATTR,
} from '../src/content/style-injector.js';

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

  it('pairs opacity-0 imgs with same-size background-image siblings', () => {
    const attrs = new Map();
    const overlay = {
      className: BACKGROUND_IMAGE_OVERLAY_CLASS,
      remove() {
        const idx = paintHost._children.indexOf(this);
        if (idx >= 0) paintHost._children.splice(idx, 1);
      },
    };
    const paintHost = {
      tagName: 'DIV',
      nodeType: 1,
      classList: { contains: () => false },
      closest: () => null,
      getAttribute: (name) => attrs.get(name) ?? null,
      setAttribute: (name, value) => attrs.set(name, value),
      removeAttribute: (name) => attrs.delete(name),
      hasAttribute: (name) => attrs.has(name),
      getBoundingClientRect: () => ({ width: 134, height: 134, top: 0, left: 0 }),
      querySelector(selector) {
        if (String(selector).includes(BACKGROUND_IMAGE_OVERLAY_CLASS)) {
          return this._children.find((c) => c.className === BACKGROUND_IMAGE_OVERLAY_CLASS) || null;
        }
        return null;
      },
      _children: [overlay],
    };
    const img = {
      tagName: 'IMG',
      nodeType: 1,
      currentSrc: 'https://cdn.example/avatar_200x200.jpg',
      getAttribute: (name) => (name === 'data-gmixer-media' ? 'avatar' : name === 'src' ? img.currentSrc : null),
      closest: () => null,
      getBoundingClientRect: () => ({ width: 134, height: 134, top: 0, left: 0 }),
    };
    const parent = {
      tagName: 'DIV',
      children: [img, paintHost],
    };
    img.parentElement = parent;
    paintHost.parentElement = parent;

    const previousCs = globalThis.getComputedStyle;
    const previousLoc = globalThis.location;
    globalThis.location = { href: 'https://example.com/' };
    globalThis.getComputedStyle = (node) => {
      if (node === img) {
        return { opacity: '0', visibility: 'visible', display: 'block', backgroundImage: 'none' };
      }
      if (node === paintHost) {
        return {
          opacity: '1',
          backgroundImage: 'url("https://cdn.example/avatar_200x200.jpg")',
        };
      }
      return { opacity: '1', backgroundImage: 'none' };
    };

    const root = {
      querySelectorAll: (sel) => (sel === 'img' ? [img] : []),
    };

    try {
      tagGhostMediaBackgroundHosts(root);
      assert.equal(paintHost.hasAttribute(BACKGROUND_IMAGE_ATTR), true);
      assert.equal(paintHost.getAttribute('data-gmixer-media'), 'avatar');
      assert.equal(paintHost.hasAttribute(GHOST_PAINT_ATTR), false);
      assert.equal(paintHost._children.includes(overlay), false);
    } finally {
      globalThis.getComputedStyle = previousCs;
      globalThis.location = previousLoc;
    }
  });

  it('marks unclassified opacity-0 img paint hosts as ghost-paint when overlays are off', () => {
    const attrs = new Map();
    const paintHost = {
      tagName: 'DIV',
      nodeType: 1,
      classList: { contains: () => false },
      closest: () => null,
      getAttribute: (name) => attrs.get(name) ?? null,
      setAttribute: (name, value) => attrs.set(name, value),
      removeAttribute: (name) => attrs.delete(name),
      hasAttribute: (name) => attrs.has(name),
      getBoundingClientRect: () => ({ width: 600, height: 200, top: 0, left: 0 }),
      querySelector: () => null,
      _children: [],
    };
    const img = {
      tagName: 'IMG',
      nodeType: 1,
      currentSrc: 'https://cdn.example/banner/600x200',
      getAttribute: (name) => (name === 'src' ? img.currentSrc : null),
      closest: () => null,
      getBoundingClientRect: () => ({ width: 600, height: 200, top: 0, left: 0 }),
    };
    const parent = {
      tagName: 'DIV',
      children: [img, paintHost],
    };
    img.parentElement = parent;
    paintHost.parentElement = parent;

    const previousCs = globalThis.getComputedStyle;
    const previousLoc = globalThis.location;
    globalThis.location = { href: 'https://example.com/' };
    globalThis.getComputedStyle = (node) => {
      if (node === img) {
        return { opacity: '0', visibility: 'visible', display: 'block', backgroundImage: 'none' };
      }
      if (node === paintHost) {
        return {
          opacity: '1',
          backgroundImage: 'url("https://cdn.example/banner/600x200")',
        };
      }
      return { opacity: '1', backgroundImage: 'none' };
    };

    try {
      tagGhostMediaBackgroundHosts(
        { querySelectorAll: (sel) => (sel === 'img' ? [img] : []) },
        { preferFilterForUnclassified: true }
      );
      assert.equal(paintHost.hasAttribute(BACKGROUND_IMAGE_ATTR), true);
      assert.equal(paintHost.hasAttribute(GHOST_PAINT_ATTR), true);
    } finally {
      globalThis.getComputedStyle = previousCs;
      globalThis.location = previousLoc;
    }
  });
});
