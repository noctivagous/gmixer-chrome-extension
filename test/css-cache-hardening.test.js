import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearCssCache,
  cssCacheScope,
  readCssCache,
  writeCssCache,
} from '../src/content/css-cache.js';

const originalChrome = globalThis.chrome;

afterEach(() => {
  globalThis.chrome = originalChrome;
});

function installSessionStorage() {
  const values = {};
  globalThis.chrome = {
    storage: {
      session: {
        async get(key) {
          if (key === null) return { ...values };
          return key in values ? { [key]: values[key] } : {};
        },
        async set(entries) {
          Object.assign(values, entries);
        },
        async remove(keys) {
          for (const key of Array.isArray(keys) ? keys : [keys]) delete values[key];
        },
      },
    },
  };
  return values;
}

describe('static CSS cache hardening', () => {
  it('keeps same-host route entries independent', async () => {
    installSessionStorage();
    const resolved = { enabled: true, themeMode: 'dark' };

    await Promise.all([
      writeCssCache('example.test', 'https://example.test/one', resolved, 'route-one-static'),
      writeCssCache('example.test', 'https://example.test/two', resolved, 'route-two-static'),
    ]);

    assert.equal(
      (await readCssCache('example.test', 'https://example.test/one')).css,
      'route-one-static'
    );
    assert.equal(
      (await readCssCache('example.test', 'https://example.test/two')).css,
      'route-two-static'
    );
  });

  it('clears every scope for one host without touching prefix-like hosts', async () => {
    installSessionStorage();
    const resolved = { enabled: true };
    await writeCssCache('example.test', 'https://example.test/one', resolved, 'one');
    await writeCssCache('example.test', 'https://example.test/two', resolved, 'two');
    await writeCssCache('example.test.evil', 'https://example.test.evil/one', resolved, 'other');

    await clearCssCache('example.test');

    assert.equal(await readCssCache('example.test', 'https://example.test/one'), null);
    assert.equal(await readCssCache('example.test', 'https://example.test/two'), null);
    assert.equal(
      (await readCssCache('example.test.evil', 'https://example.test.evil/one')).css,
      'other'
    );
  });

  it('scopes cache entries by origin and path', () => {
    assert.equal(
      cssCacheScope({ origin: 'https://example.test', pathname: '/inbox' }),
      'https://example.test/inbox'
    );
  });
});
