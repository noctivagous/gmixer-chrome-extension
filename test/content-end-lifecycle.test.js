import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { watchLayoutAndSpa } from '../src/content/content-end.js';

const originals = {
  window: globalThis.window,
  document: globalThis.document,
  location: globalThis.location,
  history: globalThis.history,
  clearTimeout: globalThis.clearTimeout,
};

afterEach(() => {
  Object.assign(globalThis, originals);
});

describe('content-end layout and SPA lifecycle', () => {
  it('returns navigation and destroy controls that release all owned resources', () => {
    const listeners = new Map();
    const removed = [];
    const cleared = [];
    let nextTimer = 1;
    globalThis.window = {
      innerWidth: 1200,
      innerHeight: 800,
      addEventListener(type, callback) {
        listeners.set(type, callback);
      },
      removeEventListener(type, callback) {
        removed.push([type, callback]);
        if (listeners.get(type) === callback) listeners.delete(type);
      },
      setTimeout() {
        return nextTimer++;
      },
    };
    globalThis.clearTimeout = (id) => {
      cleared.push(id);
    };
    globalThis.document = { documentElement: { scrollHeight: 1600 } };
    globalThis.location = { href: 'https://example.test/one' };

    const originalPush = function pushState() {};
    const originalReplace = function replaceState() {};
    globalThis.history = {
      pushState: originalPush,
      replaceState: originalReplace,
    };

    let layoutTimer = 0;
    const controller = watchLayoutAndSpa(() => {}, {
      getLastKey: () => '',
      setLastKey() {},
      getTimer: () => layoutTimer,
      setTimer(id) {
        layoutTimer = id;
      },
    });

    assert.equal(typeof controller.onNavigation, 'function');
    assert.equal(typeof controller.destroy, 'function');
    assert.notEqual(globalThis.history.pushState, originalPush);
    assert.notEqual(globalThis.history.replaceState, originalReplace);

    listeners.get('resize')();
    globalThis.location.href = 'https://example.test/two';
    controller.onNavigation();
    controller.destroy();

    assert.equal(globalThis.history.pushState, originalPush);
    assert.equal(globalThis.history.replaceState, originalReplace);
    assert.equal(layoutTimer, 0);
    assert.ok(cleared.includes(1));
    assert.ok(cleared.includes(2));
    assert.deepEqual(
      removed.map(([type]) => type).sort(),
      ['hashchange', 'popstate', 'resize']
    );
  });
});
