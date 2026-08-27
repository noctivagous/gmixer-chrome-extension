import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCardSizedBox,
  intersectsViewport,
  nextShimmerIndex,
  normalizedText,
  isMediaTextCardShell,
  pickTitleLink,
  pickCompanionMedia,
} from '../src/content/article-card-detector.js';
import { normalizeEffects } from '../src/config/effects-catalog.js';
import { buildCss } from '../src/content/style-injector.js';
import { createDefaultState } from '../src/state/schema.js';

function rect(partial) {
  return {
    width: 0,
    height: 0,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
    ...partial,
  };
}

function el(tag, opts = {}) {
  const attrs = { ...(opts.attrs || {}) };
  const children = opts.children || [];
  const box = opts.box || rect({ width: 320, height: 220, top: 40, left: 40, bottom: 260, right: 360 });
  const node = {
    tagName: tag.toUpperCase(),
    nodeType: 1,
    href: opts.href,
    innerText: opts.text || '',
    textContent: opts.text || '',
    parentElement: null,
    getAttribute(name) {
      if (name === 'href') return opts.href ?? attrs.href ?? null;
      return attrs[name] ?? null;
    },
    getBoundingClientRect() {
      return box;
    },
    querySelectorAll(selector) {
      const out = [];
      const visit = (n) => {
        if (!n) return;
        if (selector.includes('a[href]') && n.tagName === 'A') out.push(n);
        if (selector.includes('img') && n.tagName === 'IMG') out.push(n);
        if (selector.includes('video') && n.tagName === 'VIDEO') out.push(n);
        for (const c of n._children || []) visit(c);
      };
      for (const c of children) visit(c);
      visit(node);
      return out;
    },
    _children: children,
  };
  for (const child of children) child.parentElement = node;
  return node;
}

describe('article-card-detector', () => {
  it('accepts card-sized boxes and rejects tiny or huge ones', () => {
    assert.equal(isCardSizedBox(rect({ width: 320, height: 200 })), true);
    assert.equal(isCardSizedBox(rect({ width: 80, height: 80 })), false);
    assert.equal(isCardSizedBox(rect({ width: 1000, height: 200 })), false);
  });

  it('intersectsViewport uses the strict viewport rect', () => {
    const vp = { innerWidth: 1000, innerHeight: 800 };
    assert.equal(
      intersectsViewport(rect({ width: 200, height: 200, top: 10, left: 10, bottom: 210, right: 210 }), vp),
      true
    );
    assert.equal(
      intersectsViewport(rect({ width: 200, height: 200, top: 2000, left: 10, bottom: 2200, right: 210 }), vp),
      false
    );
    assert.equal(
      intersectsViewport(rect({ width: 200, height: 200, top: -250, left: 10, bottom: -50, right: 210 }), vp),
      false
    );
    // Touching the bottom edge still counts as intersecting.
    assert.equal(
      intersectsViewport(rect({ width: 200, height: 100, top: 750, left: 10, bottom: 850, right: 210 }), vp),
      true
    );
  });

  it('nextShimmerIndex wraps', () => {
    assert.equal(nextShimmerIndex(-1, 3), 0);
    assert.equal(nextShimmerIndex(0, 3), 1);
    assert.equal(nextShimmerIndex(2, 3), 0);
    assert.equal(nextShimmerIndex(0, 0), 0);
  });

  it('detects a wrapping article link shell with media + text', () => {
    const img = el('img', {
      box: rect({ width: 300, height: 160, top: 40, left: 40, bottom: 200, right: 340 }),
    });
    const shell = el('a', {
      href: 'https://example.com/story',
      text: 'Researchers found something interesting today',
      children: [img],
      box: rect({ width: 320, height: 240, top: 40, left: 40, bottom: 280, right: 360 }),
    });
    assert.equal(normalizedText(shell).length >= 8, true);
    assert.equal(isMediaTextCardShell(shell, { innerWidth: 1200, innerHeight: 900 }), true);
    assert.equal(pickTitleLink(shell), shell);
    assert.equal(pickCompanionMedia(shell), img);
  });
});

describe('link-shimmer catalog + css', () => {
  it('allows link-shimmer on articles and rejects it on images', () => {
    const ok = normalizeEffects({
      categories: { articles: { effect: 'link-shimmer' } },
    });
    assert.equal(ok.categories.articles.effect, 'link-shimmer');

    const bad = normalizeEffects({
      categories: { images: { effect: 'link-shimmer' } },
    });
    assert.equal(bad.categories.images.effect, 'none');
  });

  it('emits shimmer CSS when Articles link-shimmer is on', () => {
    const global = createDefaultState().global;
    global.sections.effects = true;
    global.effects = normalizeEffects({
      ...global.effects,
      categories: { ...global.effects.categories, articles: { effect: 'link-shimmer' } },
    });
    const css = buildCss(global, null);
    assert.match(css, /@keyframes gmixer-link-shimmer-sweep/);
    assert.match(css, /\.gmixer-link-shimmer-overlay/);
    assert.doesNotMatch(css, /border:\s*2px solid/);
    assert.doesNotMatch(css, /gmixer-media-shimmer-pulse/);
  });

  it('omits shimmer CSS when Effects section is off', () => {
    const global = createDefaultState().global;
    global.sections.effects = false;
    global.effects = normalizeEffects({
      ...global.effects,
      categories: { ...global.effects.categories, articles: { effect: 'link-shimmer' } },
    });
    const css = buildCss(global, null);
    assert.doesNotMatch(css, /gmixer-link-shimmer-sweep/);
  });
});
