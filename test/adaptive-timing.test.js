import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ADAPTIVE_IDLE_TIMEOUT_MS,
  PAGE_SETTLE_TIMEOUT_MS,
  scheduleFirstAdaptivePass,
} from '../src/content/adaptive-timing.js';

describe('first adaptive-pass scheduling', () => {
  it('caps idle wait well below the old 1500ms flash window', () => {
    assert.ok(ADAPTIVE_IDLE_TIMEOUT_MS <= 200);
    assert.ok(ADAPTIVE_IDLE_TIMEOUT_MS > 0);
    assert.ok(PAGE_SETTLE_TIMEOUT_MS <= 120);
    assert.ok(PAGE_SETTLE_TIMEOUT_MS > 0);
  });

  it('passes the short timeout to requestIdleCallback when available', () => {
    const calls = [];
    scheduleFirstAdaptivePass(() => {}, {
      requestIdleCallback(callback, options) {
        calls.push({ callback, options });
        return 7;
      },
      setTimeout() {
        throw new Error('setTimeout should not run when requestIdleCallback exists');
      },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].options.timeout, ADAPTIVE_IDLE_TIMEOUT_MS);
  });

  it('falls back to setTimeout(0) without requestIdleCallback', () => {
    const calls = [];
    scheduleFirstAdaptivePass(() => {}, {
      setTimeout(callback, delay) {
        calls.push({ callback, delay });
        return 3;
      },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].delay, 0);
  });
});
