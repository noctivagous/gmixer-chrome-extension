import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultState } from '../src/state/schema.js';
import {
  loadPersistedState,
  onPersistedStateChanged,
  persistState,
} from '../src/state/storage-adapter.js';
import { isCurrentPersistedState } from '../src/state/store.js';

const originalChrome = globalThis.chrome;

function createStorageArea(data) {
  return {
    async get(key) {
      return { [key]: data[key] };
    },
    async set(patch) {
      Object.assign(data, patch);
    },
  };
}

function installStorage(syncData = {}, localData = {}) {
  const listeners = new Set();
  globalThis.chrome = {
    storage: {
      sync: createStorageArea(syncData),
      local: createStorageArea(localData),
      onChanged: {
        addListener(listener) {
          listeners.add(listener);
        },
        removeListener(listener) {
          listeners.delete(listener);
        },
      },
    },
  };
  return listeners;
}

afterEach(() => {
  globalThis.chrome = originalChrome;
});

describe('storage adapter', () => {
  it('splits sync and local settings while round-tripping the resolved state', async () => {
    const syncData = {};
    const localData = {};
    installStorage(syncData, localData);
    const state = createDefaultState();
    state.global.enabled = false;
    state.global.color.baseColor = '#123456';
    state.global.ui.settingsOpen = true;
    state.perSite['example.test'] = { color: { baseColor: '#abcdef' } };

    await persistState(state);

    assert.equal(syncData.gmixer_state.global.color.baseColor, '#123456');
    assert.equal(syncData.gmixer_state.global.enabled, undefined);
    assert.equal(localData.gmixer_state.global.enabled, false);
    assert.equal(localData.gmixer_state.global.ui.settingsOpen, true);
    assert.deepEqual(localData.gmixer_state.perSite, state.perSite);
    assert.deepEqual(await loadPersistedState(), state);
  });

  it('keeps local device settings ahead of stale sync values', async () => {
    const state = createDefaultState();
    installStorage(
      { gmixer_state: { version: state.version, global: { enabled: true, color: { baseColor: '#111111' } } } },
      { gmixer_state: { version: state.version, global: { enabled: false, ui: { settingsOpen: true } } } }
    );

    const loaded = await loadPersistedState();
    assert.equal(loaded.global.enabled, false);
    assert.equal(loaded.global.ui.settingsOpen, true);
    assert.equal(loaded.global.color.baseColor, '#111111');
  });

  it('subscribes and unsubscribes from external storage changes', async () => {
    const listeners = installStorage();
    let calls = 0;
    const unsubscribe = onPersistedStateChanged(() => {
      calls += 1;
    });

    for (const listener of listeners) listener({ unrelated: {} }, 'sync');
    await Promise.resolve();
    assert.equal(calls, 0);

    for (const listener of listeners) listener({ gmixer_state: {} }, 'local');
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(calls, 1);

    unsubscribe();
    assert.equal(listeners.size, 0);
  });
});

describe('persisted state validation', () => {
  it('accepts only the current, object-shaped schema version', () => {
    const state = createDefaultState();
    assert.equal(isCurrentPersistedState(state), true);
    assert.equal(isCurrentPersistedState({ global: {} }), false);
    assert.equal(isCurrentPersistedState({ version: state.version + 1, global: {} }), false);
    assert.equal(isCurrentPersistedState({ version: state.version, global: null }), false);
  });
});
