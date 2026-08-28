import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIFIER_CONFIDENCE_THRESHOLD,
  classifyElement,
  classifySubtree,
  promotePaintedSurfaces,
  assignToneSteps,
  ROLE_ATTR,
  MEDIA_ATTR,
  NATIVE_L_ATTR,
  TONE_STEP_ATTR,
} from '../src/content/page-classifier.js';

function el(tag, attrs = {}, children = []) {
  const attributes = { ...attrs };
  const node = {
    tagName: tag.toUpperCase(),
    nodeType: 1,
    id: attributes.id || '',
    classList: {
      contains: (name) => String(attributes.class || '').split(/\s+/).includes(name),
    },
    closest(selector) {
      if (selector === '#gmixer-settings' && this.id === 'gmixer-settings') return this;
      return null;
    },
    getAttribute(name) {
      return attributes[name] ?? null;
    },
    setAttribute(name, value) {
      attributes[name] = value;
    },
    removeAttribute(name) {
      delete attributes[name];
    },
    hasAttribute(name) {
      return name in attributes;
    },
    querySelectorAll(selector) {
      const out = [];
      const visit = (n) => {
        if (!n || n.nodeType !== 1) return;
        // Extremely small matcher for the selectors we use in tests.
        if (selector.includes('article') && !selector.includes('img') && n.tagName === 'ARTICLE') {
          out.push(n);
        }
        if (selector.includes('main') && n.tagName === 'MAIN') out.push(n);
        if (selector.includes('img') && n.tagName === 'IMG' && (n._inArticle || false)) {
          out.push(n);
        }
        for (const child of n._children || []) visit(child);
      };
      for (const child of this._children || []) visit(child);
      // Also match self when root is the element.
      visit(this);
      return out;
    },
    _children: children,
  };
  for (const child of children) {
    if (tag.toUpperCase() === 'ARTICLE' && child.tagName === 'IMG') child._inArticle = true;
    child._parent = node;
  }
  return node;
}

describe('page-classifier', () => {
  it('uses a conservative confidence threshold for unknown elements', () => {
    const unknown = el('div');
    assert.equal(classifyElement(unknown), null);
    assert.equal(CLASSIFIER_CONFIDENCE_THRESHOLD, 0.7);
  });

  it('stamps semantic article/main roles and article-image media', () => {
    const img = el('img');
    const article = el('article', {}, [img]);
    img._inArticle = true;
    img.parentElement = article;
    img.closest = (selector) => (selector.includes('article') ? article : null);
    const root = el('div', {}, [el('main'), article]);

    // Make querySelectorAll on root find descendants by walking.
    root.querySelectorAll = (selector) => {
      const all = [];
      const walk = (n) => {
        all.push(n);
        for (const c of n._children || []) walk(c);
      };
      for (const c of root._children || []) walk(c);
      if (selector === '*') return all;
      if (selector.startsWith('main')) return all.filter((n) => n.tagName === 'MAIN');
      if (selector.startsWith('article') && !selector.includes('img')) {
        return all.filter((n) => n.tagName === 'ARTICLE');
      }
      if (selector.includes('img')) {
        return all.filter((n) => n.tagName === 'IMG' && n._inArticle);
      }
      return [];
    };

    const result = classifySubtree(root);
    assert.ok(result.scanned >= 2);
    assert.equal(root._children[0].getAttribute(ROLE_ATTR), 'main');
    assert.equal(article.getAttribute(ROLE_ATTR), 'article');
    assert.equal(img.getAttribute(MEDIA_ATTR), 'article-image');

    const skipped = classifySubtree(root, { skipClassified: true });
    assert.ok(skipped.scanned >= 2);
  });

  it('does not classify Slashdot-style story title/byline spans as articles', () => {
    const title = el('span', { class: 'story-title' });
    const byline = el('span', { class: 'story-byline' });
    assert.equal(classifyElement(title), null);
    assert.equal(classifyElement(byline), null);

    // Real story containers still match.
    const story = el('div', { class: 'story' });
    const classified = classifyElement(story);
    assert.equal(classified?.role, 'article');
  });

  it('does not classify TNW-style heading titles as articles from camelCase class names', () => {
    const showcase = el('h3', { class: 'showcaseSubbrandsArticleTitle' });
    const sectionHeading = el('h2', { class: 'c-bodyNews__heading' });
    assert.equal(classifyElement(showcase), null);
    assert.equal(classifyElement(sectionHeading), null);

    // A real article-named container still matches via camelCase token split.
    const wrap = el('div', { class: 'showcaseSubbrandsArticle' });
    assert.equal(classifyElement(wrap)?.role, 'article');
  });

  it('promotes opaque nested slabs under classified hosts to surface', () => {
    const attrs = (initial = {}) => {
      const a = { ...initial };
      return {
        getAttribute: (name) => a[name] ?? null,
        setAttribute: (name, value) => {
          a[name] = String(value);
        },
        removeAttribute: (name) => {
          delete a[name];
        },
        hasAttribute: (name) => name in a,
      };
    };

    const details = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...attrs({ class: 'details' }),
      getBoundingClientRect: () => ({ width: 400, height: 32 }),
      _bg: 'rgb(242, 242, 242)',
    };
    const body = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...attrs({ class: 'body' }),
      getBoundingClientRect: () => ({ width: 400, height: 120 }),
      _bg: 'rgb(247, 247, 247)',
    };
    const article = {
      tagName: 'ARTICLE',
      nodeType: 1,
      children: [details, body],
      ...attrs({ [ROLE_ATTR]: 'article' }),
      getBoundingClientRect: () => ({ width: 400, height: 200 }),
      _bg: 'rgb(230, 230, 230)',
    };
    details.parentElement = article;
    body.parentElement = article;

    const root = {
      nodeType: 11,
      querySelectorAll: (selector) => {
        if (selector === `[${ROLE_ATTR}]`) return [article];
        return [];
      },
    };

    const previous = globalThis.getComputedStyle;
    globalThis.getComputedStyle = (node) => ({
      backgroundColor: node._bg || 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });

    try {
      const promoted = promotePaintedSurfaces(root);
      assert.equal(promoted, 2);
      assert.equal(details.getAttribute(ROLE_ATTR), 'surface');
      assert.equal(body.getAttribute(ROLE_ATTR), 'surface');

      // Darker native L → lower tone step; lighter → higher.
      details.setAttribute(NATIVE_L_ATTR, '0.90');
      body.setAttribute(NATIVE_L_ATTR, '0.99');
      article.setAttribute(NATIVE_L_ATTR, '0.80');
      const rankedRoot = {
        querySelectorAll: (selector) => {
          if (selector === `[${ROLE_ATTR}]`) return [article, details, body];
          return [];
        },
      };
      assert.equal(assignToneSteps(rankedRoot, 3), 3);
      assert.equal(article.getAttribute(TONE_STEP_ATTR), '0');
      assert.equal(details.getAttribute(TONE_STEP_ATTR), '1');
      assert.equal(body.getAttribute(TONE_STEP_ATTR), '2');
    } finally {
      globalThis.getComputedStyle = previous;
    }
  });

  it('does not promote opaque menu wrappers inside header chrome', () => {
    const attrs = (initial = {}) => {
      const a = { ...initial };
      return {
        getAttribute: (name) => a[name] ?? null,
        setAttribute: (name, value) => {
          a[name] = String(value);
        },
        removeAttribute: (name) => {
          delete a[name];
        },
        hasAttribute: (name) => name in a,
      };
    };

    const item = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...attrs({ class: 'menu-item' }),
      getBoundingClientRect: () => ({ width: 96, height: 40 }),
      _bg: 'rgb(20, 20, 20)',
    };
    const header = {
      tagName: 'HEADER',
      nodeType: 1,
      children: [item],
      ...attrs({ [ROLE_ATTR]: 'header' }),
      getBoundingClientRect: () => ({ width: 1200, height: 64 }),
      _bg: 'rgb(20, 20, 20)',
    };
    item.parentElement = header;

    const root = {
      nodeType: 11,
      querySelectorAll: (selector) => {
        if (selector === `[${ROLE_ATTR}]`) return [header];
        return [];
      },
    };

    const previous = globalThis.getComputedStyle;
    globalThis.getComputedStyle = (node) => ({
      backgroundColor: node._bg || 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });

    try {
      assert.equal(promotePaintedSurfaces(root), 0);
      assert.equal(item.getAttribute(ROLE_ATTR), null);
    } finally {
      globalThis.getComputedStyle = previous;
    }
  });
});
