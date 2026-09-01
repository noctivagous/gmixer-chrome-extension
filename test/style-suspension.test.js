import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  STYLE_ELEMENT_ID,
  withStyleSuspended,
} from '../src/content/style-injector.js';

const originalDocument = globalThis.document;

afterEach(() => {
  globalThis.document = originalDocument;
});

describe('native style measurement transaction', () => {
  it('removes and restores the current theme synchronously', () => {
    let attached = true;
    let appended = 0;
    const style = {
      id: STYLE_ELEMENT_ID,
      textContent: ':root { --gmixer-bg: #111; }',
      remove() {
        attached = false;
      },
    };
    globalThis.document = {
      documentElement: { querySelectorAll: () => [] },
      head: {
        appendChild(node) {
          assert.equal(node, style);
          attached = true;
          appended += 1;
        },
      },
      getElementById: (id) => (id === STYLE_ELEMENT_ID ? style : null),
    };

    const measured = withStyleSuspended(() => {
      assert.equal(attached, false);
      return 'native';
    });
    assert.equal(measured, 'native');
    assert.equal(attached, true);
    assert.equal(appended, 1);
  });
});
