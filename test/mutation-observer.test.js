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

    let reapplyCount = 0;
    startMutationObserver(() => {
      reapplyCount += 1;
    });

    callback([{
      addedNodes: [
        { nodeType: 1, id: 'gmixer-style', tagName: 'STYLE' },
        { nodeType: 1, id: 'page-style', tagName: 'STYLE' },
      ],
    }]);

    await Promise.resolve();
    assert.equal(reapplyCount, 1);
  });
});
