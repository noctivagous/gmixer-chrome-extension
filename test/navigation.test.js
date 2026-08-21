import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isTypingContext } from '../src/content/clickable-detector.js';

describe('clickable-detector', () => {
  it('treats missing active element as not typing', () => {
    assert.equal(isTypingContext(null), false);
  });

  it('detects input-like typing contexts via duck-typed nodes', () => {
    assert.equal(isTypingContext({ tagName: 'INPUT', isContentEditable: false }), true);
    assert.equal(isTypingContext({ tagName: 'TEXTAREA', isContentEditable: false }), true);
    assert.equal(isTypingContext({ tagName: 'DIV', isContentEditable: true }), true);
    assert.equal(
      isTypingContext({
        tagName: 'DIV',
        isContentEditable: false,
        getAttribute: (n) => (n === 'role' ? 'textbox' : null),
      }),
      true
    );
    assert.equal(
      isTypingContext({
        tagName: 'DIV',
        isContentEditable: false,
        getAttribute: () => null,
      }),
      false
    );
  });
});
