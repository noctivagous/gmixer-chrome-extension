import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIFIER_CONFIDENCE_THRESHOLD,
  classifyElement,
  classifySubtree,
  ROLE_ATTR,
  MEDIA_ATTR,
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
  });
});
