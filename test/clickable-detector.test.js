import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NAV_HIT_ATTR,
  stampNavPointerTargets,
} from '../src/content/clickable-detector.js';

const originals = {
  document: globalThis.document,
  getComputedStyle: globalThis.getComputedStyle,
  Node: globalThis.Node,
};

afterEach(() => {
  Object.assign(globalThis, originals);
});

function el(tag, attrs = {}, children = []) {
  const attributes = { ...attrs };
  const node = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    id: attributes.id || '',
    className: attributes.class || '',
    style: { cursor: attributes.cursor || '' },
    parentElement: null,
    children,
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
    matches(selector) {
      const parts = selector.split(',').map((part) => part.trim());
      return parts.some((part) => {
        if (part === tag.toLowerCase()) return true;
        if (part === 'a' && tag.toLowerCase() === 'a') return true;
        if (part === 'button' && tag.toLowerCase() === 'button') return true;
        if (part === 'nav' && tag.toLowerCase() === 'nav') return true;
        if (part === '[role="button"]') return attributes.role === 'button';
        if (part === '[role="link"]') return attributes.role === 'link';
        if (part === '[role="menuitem"]') return attributes.role === 'menuitem';
        if (part === '[role="navigation"]') return attributes.role === 'navigation';
        if (part === '[data-gmixer-role="navigation"]') return attributes['data-gmixer-role'] === 'navigation';
        return false;
      });
    },
    querySelector(selector) {
      return this.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const out = [];
      const walk = (child) => {
        if (child.matches?.(selector) || selector === '*' || selector.split(',').some((part) => child.matches?.(part.trim()))) {
          if (selector === '*' || child.matches(selector)) out.push(child);
        }
        for (const nested of child.children || []) walk(nested);
      };
      for (const child of this.children) walk(child);
      return out;
    },
    closest(selector) {
      let node = this;
      while (node) {
        if (node.matches?.(selector)) return node;
        node = node.parentElement;
      }
      return null;
    },
  };
  for (const child of children) {
    child.parentElement = node;
  }
  return node;
}

describe('nav pointer-cursor flyout stamps', () => {
  it('stamps pointer spans in nav and skips wrappers that already contain a link', () => {
    globalThis.Node = { ELEMENT_NODE: 1 };
    const flyout = el('span', { cursor: 'pointer' });
    const link = el('a', { href: '/starlink', cursor: 'pointer' });
    const linkHost = el('div', {}, [link]);
    const nav = el('nav', {}, [
      el('div', { class: 'menu-header sub-menu-header' }, [flyout]),
      el('div', { class: 'menu-header' }, [linkHost]),
    ]);
    globalThis.getComputedStyle = (node) => ({
      cursor: node.style?.cursor === 'pointer' ? 'pointer' : 'auto',
    });
    const stamped = stampNavPointerTargets(nav);
    assert.equal(stamped, 1);
    assert.equal(flyout.getAttribute(NAV_HIT_ATTR), '');
    assert.equal(linkHost.getAttribute(NAV_HIT_ATTR), null);
    assert.equal(link.getAttribute(NAV_HIT_ATTR), null);
  });
});
