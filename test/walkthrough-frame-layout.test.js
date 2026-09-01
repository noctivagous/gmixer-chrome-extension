import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyWalkthroughFrameLayout,
  walkthroughLayoutMessage,
  WALKTHROUGH_LAYOUT_COMPLETION,
  WALKTHROUGH_LAYOUT_PANEL,
} from '../src/settings/walkthrough-frame-layout.js';

describe('walkthrough-frame-layout', () => {
  it('builds a host layout message from completion metrics', () => {
    assert.deepEqual(walkthroughLayoutMessage('completion', { width: 440.4, height: 201.2 }), {
      source: 'gmixer-ui',
      type: 'layout',
      layout: WALKTHROUGH_LAYOUT_COMPLETION,
      width: 440.4,
      height: 201.2,
    });
    assert.equal(walkthroughLayoutMessage('panel').layout, WALKTHROUGH_LAYOUT_PANEL);
  });

  it('shrinks and restores the outer walkthrough iframe', () => {
    const iframe = { style: {} };
    iframe.style.removeProperty = (name) => {
      delete iframe.style[name];
    };
    const attrs = {};
    const popover = {
      setAttribute(name, value) {
        attrs[name] = value;
      },
      removeAttribute(name) {
        delete attrs[name];
      },
    };

    applyWalkthroughFrameLayout(popover, walkthroughLayoutMessage('completion'), iframe);
    assert.equal(attrs['data-gmixer-layout'], 'completion');

    applyWalkthroughFrameLayout(
      popover,
      walkthroughLayoutMessage('completion', { width: 440.6, height: 198.2 }),
      iframe
    );
    assert.equal(iframe.style.width, '441px');
    assert.equal(iframe.style.height, '198px');

    applyWalkthroughFrameLayout(popover, walkthroughLayoutMessage('panel'), iframe);
    assert.equal(attrs['data-gmixer-layout'], undefined);
    assert.equal(iframe.style.width, undefined);
    assert.equal(iframe.style.height, undefined);
  });
});
