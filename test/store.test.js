import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SettingsStore } from '../src/state/store.js';
import { createDefaultState } from '../src/state/schema.js';

describe('settings store', () => {
  it('lets master enabled=false win over a per-site enabled override', () => {
    const store = new SettingsStore();
    const defaults = createDefaultState();
    store._state = {
      ...defaults,
      global: { ...defaults.global, enabled: false, color: { ...defaults.global.color, baseColor: '#111111' } },
      perSite: {
        'example.test': { enabled: true, color: { baseColor: '#ff0000' } },
      },
    };

    const resolved = store.getResolvedStateForHost('example.test');
    assert.equal(resolved.enabled, false);
    assert.equal(resolved.color.baseColor, '#ff0000');
  });

  it('merges per-site color when master theming is on', () => {
    const store = new SettingsStore();
    const defaults = createDefaultState();
    store._state = {
      ...defaults,
      perSite: {
        'example.test': { color: { baseColor: '#00ffaa' } },
      },
    };

    const resolved = store.getResolvedStateForHost('example.test');
    assert.equal(resolved.enabled, true);
    assert.equal(resolved.color.baseColor, '#00ffaa');
  });
});
