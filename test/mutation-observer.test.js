import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { startMutationObserver } from '../src/content/mutation-observer.js';
import { isDocumentNavigation } from '../src/content/adaptive-timing.js';

const originalNode = globalThis.Node;
const originalMutationObserver = globalThis.MutationObserver;
const originalDocument = globalThis.document;
const originalLocation = globalThis.location;

afterEach(() => {
  globalThis.Node = originalNode;
  globalThis.MutationObserver = originalMutationObserver;
  globalThis.document = originalDocument;
  globalThis.location = originalLocation;
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

  it('signals a URL change arriving with router DOM mutations', async () => {
    let callback;
    globalThis.Node = { ELEMENT_NODE: 1 };
    globalThis.document = { documentElement: {} };
    globalThis.location = { href: 'https://example.test/first' };
    globalThis.MutationObserver = class {
      constructor(next) {
        callback = next;
      }
      observe() {}
      disconnect() {}
    };

    let navigationCount = 0;
    let subtreeCount = 0;
    startMutationObserver({
      onSubtree() {
        subtreeCount += 1;
      },
      onCascadeThreat() {},
      onNavigation() {
        navigationCount += 1;
      },
    });

    globalThis.location = { href: 'https://example.test/second' };
    callback([
      {
        addedNodes: [
          { nodeType: 1, id: '', tagName: 'MAIN', classList: { contains: () => false }, closest: () => null },
        ],
      },
    ]);
    await Promise.resolve();
    assert.equal(navigationCount, 1);
    assert.equal(subtreeCount, 0);
  });

  it('classifies hash-only URL changes as same-document subtree work', async () => {
    let callback;
    globalThis.Node = { ELEMENT_NODE: 1 };
    globalThis.document = { documentElement: {} };
    globalThis.location = { href: 'https://app.example.test/mail/#inbox' };
    globalThis.MutationObserver = class {
      constructor(next) {
        callback = next;
      }
      observe() {}
      disconnect() {}
    };

    let navigationCount = 0;
    let subtreeCount = 0;
    startMutationObserver({
      onSubtree() {
        subtreeCount += 1;
      },
      onCascadeThreat() {},
      onNavigation() {
        navigationCount += 1;
      },
    });

    globalThis.location = { href: 'https://app.example.test/mail/#inbox/thread-1' };
    callback([
      {
        addedNodes: [
          { nodeType: 1, id: '', tagName: 'DIV', classList: { contains: () => false }, closest: () => null },
        ],
      },
    ]);
    await Promise.resolve();
    assert.equal(navigationCount, 0);
    assert.equal(subtreeCount, 1);
  });
});

describe('isDocumentNavigation', () => {
  it('ignores hash-only swaps on the same path', () => {
    assert.equal(
      isDocumentNavigation(
        'https://app.example.test/mail/#inbox',
        'https://app.example.test/mail/#inbox/thread'
      ),
      false
    );
  });

  it('treats path changes as a real navigation', () => {
    assert.equal(
      isDocumentNavigation('https://example.test/home', 'https://example.test/notifications'),
      true
    );
  });
});
