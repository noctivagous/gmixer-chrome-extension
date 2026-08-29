import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startMutationObserver } from '../src/content/mutation-observer.js';

const originals = {
  Node: globalThis.Node,
  Element: globalThis.Element,
  MutationObserver: globalThis.MutationObserver,
  document: globalThis.document,
};

afterEach(() => {
  Object.assign(globalThis, originals);
});

describe('mutation shadow rediscovery', () => {
  it('discovers and observes an open shadow attached after startup without patching attachShadow', async () => {
    let mutationCallback;
    const observed = [];
    const originalAttachShadow = function attachShadow() {};
    globalThis.Node = { ELEMENT_NODE: 1 };
    globalThis.Element = function Element() {};
    globalThis.Element.prototype.attachShadow = originalAttachShadow;

    const shadow = { nodeType: 11, host: null, querySelectorAll: () => [] };
    const host = {
      nodeType: 1,
      id: '',
      tagName: 'X-LATE',
      shadowRoot: null,
      classList: { contains: () => false },
      closest: () => null,
      querySelectorAll: () => [],
    };
    shadow.host = host;
    const documentElement = {
      querySelectorAll: (selector) => (selector === '*' ? [host] : []),
    };
    globalThis.document = { documentElement };
    globalThis.MutationObserver = class {
      constructor(callback) {
        mutationCallback = callback;
      }
      observe(root) {
        observed.push(root);
      }
      disconnect() {}
    };

    let classified = [];
    startMutationObserver({
      onSubtree(roots) {
        classified = roots;
      },
      onCascadeThreat() {},
    });

    host.shadowRoot = shadow;
    const added = {
      nodeType: 1,
      id: '',
      tagName: 'DIV',
      classList: { contains: () => false },
      closest: () => null,
    };
    mutationCallback([{ type: 'childList', addedNodes: [added] }]);
    await Promise.resolve();

    assert.equal(globalThis.Element.prototype.attachShadow, originalAttachShadow);
    assert.ok(observed.includes(shadow));
    assert.ok(classified.includes(host));
    assert.ok(classified.includes(added));
  });
});
