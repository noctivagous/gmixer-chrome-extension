import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startMutationObserver } from '../src/content/mutation-observer.js';

const originalNode = globalThis.Node;
const originalMutationObserver = globalThis.MutationObserver;
const originalDocument = globalThis.document;

afterEach(() => {
  globalThis.Node = originalNode;
  globalThis.MutationObserver = originalMutationObserver;
  globalThis.document = originalDocument;
});

describe('mutation-observer', () => {
  it('ignores gMixer-owned nodes to avoid a reapply loop', async () => {
    let callback;
    globalThis.Node = { ELEMENT_NODE: 1 };
    globalThis.document = { documentElement: {} };
    globalThis.MutationObserver = class {
      constructor(next) {
        callback = next;
      }
      observe() {}
      disconnect() {}
    };

    let cascadeCount = 0;
    startMutationObserver({
      onSubtree() {},
      onCascadeThreat() {
        cascadeCount += 1;
      },
    });

    callback([
      {
        addedNodes: [
          { nodeType: 1, id: 'gmixer-style', tagName: 'STYLE', classList: { contains: () => false } },
          {
            nodeType: 1,
            id: 'page-style',
            tagName: 'STYLE',
            classList: { contains: () => false },
            closest: () => null,
          },
        ],
      },
    ]);

    await Promise.resolve();
    assert.equal(cascadeCount, 1);
  });

  it('forwards newly added content roots to onSubtree for reclassification', async () => {
    let callback;
    globalThis.Node = { ELEMENT_NODE: 1 };
    globalThis.document = { documentElement: {} };
    globalThis.MutationObserver = class {
      constructor(next) {
        callback = next;
      }
      observe() {}
      disconnect() {}
    };

    /** @type {Element[]} */
    let seen = [];
    startMutationObserver({
      onSubtree(roots) {
        seen = roots;
      },
      onCascadeThreat() {},
    });

    const article = {
      nodeType: 1,
      id: '',
      tagName: 'ARTICLE',
      classList: { contains: () => false },
      closest: () => null,
    };

    callback([{ addedNodes: [article] }]);
    await Promise.resolve();
    assert.equal(seen.length, 1);
    assert.equal(seen[0], article);
  });
});
