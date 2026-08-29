import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectOpenShadowRoots, isShadowRoot } from '../src/content/open-trees.js';

describe('open-trees', () => {
  it('collects nested open shadow roots without host allowlists', () => {
    const innerShadow = { nodeType: 11, host: {}, querySelectorAll: () => [] };
    const innerHost = {
      tagName: 'X-INNER',
      nodeType: 1,
      shadowRoot: innerShadow,
    };
    const outerShadow = {
      nodeType: 11,
      host: {},
      querySelectorAll: (selector) => (selector === '*' ? [innerHost] : []),
    };
    const outerHost = {
      tagName: 'X-OUTER',
      nodeType: 1,
      shadowRoot: outerShadow,
      querySelectorAll: () => [],
    };
    innerShadow.host = innerHost;
    outerShadow.host = outerHost;

    const found = collectOpenShadowRoots(outerHost);
    assert.equal(found.length, 2);
    assert.ok(found.includes(outerShadow));
    assert.ok(found.includes(innerShadow));
    assert.equal(isShadowRoot(outerShadow), true);
    assert.equal(isShadowRoot(outerHost), false);
  });
});
