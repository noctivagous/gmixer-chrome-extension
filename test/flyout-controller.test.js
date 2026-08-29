import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  stampVisibleFlyouts,
  startFlyoutController,
} from '../src/content/flyout-controller.js';

const originals = {
  document: globalThis.document,
  Node: globalThis.Node,
  requestAnimationFrame: globalThis.requestAnimationFrame,
  cancelAnimationFrame: globalThis.cancelAnimationFrame,
};

afterEach(() => {
  Object.assign(globalThis, originals);
});

describe('flyout-controller', () => {
  it('rechecks an active navigation item after two layout frames', () => {
    const listeners = new Map();
    const frames = [];
    const item = { nodeType: 1 };
    const target = {
      nodeType: 1,
      closest: (sel) =>
        typeof sel === 'string' && sel.includes('#gmixer-') ? null : item,
      getAttribute: () => null,
    };
    globalThis.Node = { ELEMENT_NODE: 1 };
    globalThis.document = {
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener: (type) => listeners.delete(type),
      getElementById: () => null,
      querySelectorAll: () => [],
    };
    globalThis.requestAnimationFrame = (callback) => {
      frames.push(callback);
      return frames.length;
    };
    globalThis.cancelAnimationFrame = () => {};

    let roots = [];
    const stop = startFlyoutController((next) => {
      roots = next;
    });
    listeners.get('pointerover')({ target });
    assert.equal(roots.length, 0);
    frames.shift()();
    frames.shift()();
    assert.deepEqual(roots, [item]);

    stop();
    assert.equal(listeners.size, 0);
  });

  it('includes aria-controlled and portaled semantic panels', () => {
    const listeners = new Map();
    const frames = [];
    const controlled = { nodeType: 1 };
    const portaled = { nodeType: 1 };
    const target = {
      nodeType: 1,
      closest: () => null,
      getAttribute: (name) => (name === 'aria-controls' ? 'menu-panel' : null),
    };
    globalThis.Node = { ELEMENT_NODE: 1 };
    globalThis.document = {
      addEventListener: (type, handler) => listeners.set(type, handler),
      removeEventListener: (type) => listeners.delete(type),
      getElementById: (id) => (id === 'menu-panel' ? controlled : null),
      querySelectorAll: () => [portaled],
    };
    globalThis.requestAnimationFrame = (callback) => {
      frames.push(callback);
      return frames.length;
    };
    globalThis.cancelAnimationFrame = () => {};

    let roots = [];
    const stop = startFlyoutController((next) => {
      roots = next;
    });
    listeners.get('click')({ target });
    frames.shift()();
    frames.shift()();
    assert.ok(roots.includes(controlled));
    assert.ok(roots.includes(portaled));
    stop();
  });

  it('stamps a visible positioned list without relying on class names', () => {
    const attrs = {};
    const panel = {
      tagName: 'UL',
      matches: () => true,
      querySelectorAll: () => [],
      getAttribute: (name) => attrs[name] ?? null,
      hasAttribute: (name) => name in attrs,
      setAttribute: (name, value) => {
        attrs[name] = String(value);
      },
      getBoundingClientRect: () => ({ width: 260, height: 180 }),
    };
    const previousWindow = globalThis.window;
    const previousGetComputedStyle = globalThis.getComputedStyle;
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };
    globalThis.getComputedStyle = () => ({
      position: 'absolute',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      zIndex: '10',
      transform: 'none',
    });
    try {
      assert.equal(stampVisibleFlyouts([panel]), 1);
      assert.equal(attrs['data-gmixer-role'], 'surface');
      assert.equal(attrs['data-gmixer-overlay'], '');
    } finally {
      globalThis.window = previousWindow;
      globalThis.getComputedStyle = previousGetComputedStyle;
    }
  });
});
