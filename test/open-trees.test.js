import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectOpenShadowRoots,
  isGmixerUiElement,
  isGmixerUiShadowRoot,
  isShadowRoot,
} from '../src/content/open-trees.js';

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

  it('identifies settings and walkthrough trees as gMixer UI', () => {
    const walkthrough = { id: 'gmixer-walkthrough-host', closest(sel) {
      return sel.includes('#gmixer-walkthrough-host') ? this : null;
    } };
    const inner = { id: '', closest(sel) {
      return sel.includes('#gmixer-walkthrough-host') ? walkthrough : null;
    } };
    assert.equal(isGmixerUiElement(walkthrough), true);
    assert.equal(isGmixerUiElement(inner), true);
    assert.equal(isGmixerUiElement({ id: 'main', closest: () => null }), false);
    assert.equal(isGmixerUiShadowRoot({ host: inner }), true);
    assert.equal(isGmixerUiShadowRoot({ host: { id: 'widget', closest: () => null } }), false);
  });

  it('identifies nested shadows whose closest() cannot escape the parent shadow', () => {
    const popover = {
      id: 'gmixer-settings',
      nodeType: 1,
      closest(sel) {
        return sel.includes('#gmixer-settings') ? this : null;
      },
    };
    const shell = {
      id: '',
      nodeType: 1,
      parentElement: popover,
      closest(sel) {
        return sel.includes('#gmixer-settings') ? popover : null;
      },
    };
    const shellShadow = { nodeType: 11, host: shell };
    const nested = {
      id: '',
      nodeType: 1,
      parentElement: null,
      parentNode: shellShadow,
      closest: () => null,
    };
    const nestedShadow = { nodeType: 11, host: nested };
    assert.equal(isGmixerUiElement(nested), true);
    assert.equal(isGmixerUiShadowRoot(nestedShadow), true);
  });

  it('does not collect shadows under the settings popover', () => {
    const popover = {
      id: 'gmixer-settings',
      nodeType: 1,
      closest(sel) {
        return sel.includes('#gmixer-settings') ? this : null;
      },
    };
    const shellShadow = { nodeType: 11, host: {}, querySelectorAll: () => [] };
    const shell = {
      id: '',
      tagName: 'GMIXER-SETTINGS',
      localName: 'gmixer-settings',
      nodeType: 1,
      parentElement: popover,
      shadowRoot: shellShadow,
      closest(sel) {
        return sel.includes('#gmixer-settings') ? popover : null;
      },
    };
    shellShadow.host = shell;
    const page = {
      nodeType: 1,
      querySelectorAll: (selector) => (selector === '*' ? [popover, shell] : []),
    };
    assert.equal(collectOpenShadowRoots(page).length, 0);
  });
});
