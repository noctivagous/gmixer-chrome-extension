import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDebugApi } from '../src/debug/debug-api.js';

function makeStore(initial = {}) {
  const state = {
    version: 1,
    global: {
      activeThemePackId: 'editorial',
      themeMode: 'dark',
      sections: { tone: true, filter: false, color: true },
      ui: { openSection: null, settingsOpen: false, settingsScrollTop: 0 },
      navigation: { enabled: false },
      ...initial.global,
    },
    perSite: {},
    ...initial,
  };
  return {
    ready: Promise.resolve(),
    getState: () => state,
    getResolvedStateForHost: () => state.global,
    async update(patch) {
      if (patch.sections) {
        state.global.sections = { ...state.global.sections, ...patch.sections };
      }
      if (patch.ui) {
        state.global.ui = { ...state.global.ui, ...patch.ui };
      }
      if (patch.navigation) {
        state.global.navigation = { ...state.global.navigation, ...patch.navigation };
      }
      if (patch.themeMode) {
        state.global.themeMode = patch.themeMode;
      }
      if (patch.imageFilter) {
        state.global.imageFilter = { ...(state.global.imageFilter || {}), ...patch.imageFilter };
      }
    },
  };
}

describe('debug-api', () => {
  it('exposes state and section controls through injected deps', async () => {
    const store = makeStore();
    let opened = false;
    let injected = '';
    const api = createDebugApi({
      store,
      openSettings: async () => {
        opened = true;
      },
      closeSettings: async () => {
        opened = false;
      },
      samplePageRoles: () => ({ background: '#111111', text: '#eeeeee' }),
      findPrimaryBackground: () => '#112233',
      findPrimaryBackgroundCandidates: () => [
        { color: '#112233', score: 11, tag: 'BODY', id: '', role: null, areaRatio: 1 },
      ],
      buildCss: () => '/* css */',
      injectStyle: (css) => {
        injected = css;
      },
      getPopover: () => null,
    });

    assert.equal(api.state().global.activeThemePackId, 'editorial');
    assert.equal(api.findPrimaryBackground(), '#112233');
    assert.deepEqual(api.samplePage(), { background: '#111111', text: '#eeeeee' });

    await api.openSettings();
    assert.equal(opened, true);

    await api.setSectionEnabled('filter', true);
    assert.equal(store.getState().global.sections.filter, true);

    await api.toggleSection('color');
    assert.equal(store.getState().global.ui.openSection, 'color');
    await api.toggleSection('color');
    assert.equal(store.getState().global.ui.openSection, null);

    const rebuilt = api.rebuildCss();
    assert.equal(rebuilt.ok, true);
    assert.equal(injected, '/* css */');

    const dump = api.dumpDiagnostics();
    assert.equal(dump.primaryBackground, '#112233');
    assert.equal(dump.debugEnabled, true);
    assert.equal(dump.openSection, null);

    const live = api.inspectLiveSurfaces();
    assert.ok(Array.isArray(live.palette.tokens));
    assert.ok(Array.isArray(live.classified));
    assert.ok(Array.isArray(live.texture));

    await api.setThemeMode('light');
    assert.equal(store.getState().global.themeMode, 'light');

    await api.setSettingsFocus('tone');
    assert.equal(store.getState().global.ui.settingsFocus, 'tone');
    assert.equal(store.getState().global.sections.color, false);
  });

  it('rebuildCss prefers reapply when provided', () => {
    let called = false;
    const api = createDebugApi({
      store: makeStore(),
      openSettings: async () => {},
      closeSettings: async () => {},
      samplePageRoles: () => ({}),
      findPrimaryBackground: () => null,
      buildCss: () => '',
      injectStyle: () => {},
      reapply: () => {
        called = true;
      },
    });
    const result = api.rebuildCss();
    assert.equal(called, true);
    assert.equal(result.via, 'reapply');
  });
});
