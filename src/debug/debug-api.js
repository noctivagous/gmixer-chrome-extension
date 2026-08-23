// Development-only debug API for browser evaluate_script / DevTools.
// Receives dependencies so it stays free of circular imports and can be
// unit-tested without a live extension context.

import { ROLE_ATTR, MEDIA_ATTR } from '../content/page-classifier.js';
import { STYLE_ELEMENT_ID } from '../content/style-injector.js';
import { patchForSettingsFocus } from '../settings/settings-focus.js';

const SETTINGS_POPOVER_ID = 'gmixer-settings';
const THEME_MODES = new Set(['light', 'gray', 'dark']);
const SETTINGS_FOCUSES = new Set(['theme', 'tone', 'media']);

function safeClone(value) {
  try {
    return structuredClone(value);
  } catch {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return value;
    }
  }
}

function countByAttr(attr) {
  /** @type {Record<string, number>} */
  const counts = {};
  if (typeof document === 'undefined') return counts;
  for (const el of document.querySelectorAll(`[${attr}]`)) {
    const key = el.getAttribute(attr) || '(empty)';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function getStyleElement() {
  if (typeof document === 'undefined') return null;
  return document.getElementById(STYLE_ELEMENT_ID);
}

function defaultGetPopover() {
  if (typeof document === 'undefined') return null;
  return document.getElementById(SETTINGS_POPOVER_ID);
}

/**
 * @param {{
 *   store: import('../state/store.js').SettingsStore,
 *   openSettings: () => Promise<unknown>,
 *   closeSettings: () => Promise<unknown>,
 *   samplePageRoles: () => object,
 *   findPrimaryBackground: () => string|null,
 *   findPrimaryBackgroundCandidates?: () => object[],
 *   buildCss: (resolved: object, sample?: object|null) => string,
 *   injectStyle: (css: string) => void,
 *   reapply?: () => void,
 *   getPopover?: () => HTMLElement|null,
 * }} deps
 */
export function createDebugApi(deps) {
  const {
    store,
    openSettings,
    closeSettings,
    samplePageRoles,
    findPrimaryBackground,
    findPrimaryBackgroundCandidates,
    buildCss,
    injectStyle,
    reapply,
    getPopover = defaultGetPopover,
  } = deps;

  const hostname = () =>
    typeof location !== 'undefined' ? location.hostname : '';

  return {
    state() {
      return safeClone(store.getState());
    },

    resolvedState(host = hostname()) {
      return safeClone(store.getResolvedStateForHost(host));
    },

    async openSettings() {
      await openSettings();
      return { ok: true, open: true };
    },

    async closeSettings() {
      await closeSettings();
      return { ok: true, open: false };
    },

    /**
     * Toggle which accordion section is expanded (UI-only; persisted).
     * Pass null/undefined/'none' to close all.
     * @param {string|null|undefined} id
     */
    async toggleSection(id) {
      await store.ready;
      const current = store.getState()?.global?.ui?.openSection ?? null;
      const next =
        id == null || id === '' || id === 'none'
          ? null
          : current === id
            ? null
            : id;
      await store.update({ ui: { openSection: next } });
      return { openSection: next };
    },

    /**
     * Persist section On/Off (page-effect master).
     * @param {string} id
     * @param {boolean} enabled
     */
    async setSectionEnabled(id, enabled) {
      await store.ready;
      /** @type {Record<string, unknown>} */
      const patch = { sections: { [id]: !!enabled } };
      if (id === 'navigation') {
        patch.navigation = { enabled: !!enabled };
      }
      await store.update(patch);
      return { id, enabled: !!enabled };
    },

    /**
     * Master theming on/off (all tabs).
     * @param {boolean} enabled
     */
    async setEnabled(enabled) {
      await store.ready;
      await store.update({ enabled: !!enabled });
      return { enabled: !!enabled };
    },

    /**
     * Switch Light | Gray | Dark tone direction (themeMode).
     * @param {'light'|'gray'|'dark'} mode
     */
    async setThemeMode(mode) {
      await store.ready;
      if (!THEME_MODES.has(mode)) {
        throw new Error(`Invalid themeMode: ${mode}`);
      }
      await store.update({ themeMode: mode });
      return { themeMode: mode };
    },

    /**
     * Apply settings focus (theme | tone | media), including focus side effects.
     * @param {'theme'|'tone'|'media'} focus
     */
    async setSettingsFocus(focus) {
      await store.ready;
      if (!SETTINGS_FOCUSES.has(focus)) {
        throw new Error(`Invalid settingsFocus: ${focus}`);
      }
      await store.update(patchForSettingsFocus(focus));
      return { settingsFocus: focus };
    },

    samplePage() {
      return samplePageRoles();
    },

    findPrimaryBackground() {
      return findPrimaryBackground();
    },

    inspectRoles() {
      return {
        roles: countByAttr(ROLE_ATTR),
        media: countByAttr(MEDIA_ATTR),
        roleCount: document.querySelectorAll(`[${ROLE_ATTR}]`).length,
        mediaCount: document.querySelectorAll(`[${MEDIA_ATTR}]`).length,
      };
    },

    rebuildCss() {
      if (typeof reapply === 'function') {
        reapply();
        const styleEl = getStyleElement();
        return {
          ok: true,
          via: 'reapply',
          cssLength: styleEl?.textContent?.length ?? 0,
          stylePresent: !!styleEl,
        };
      }
      const resolved = store.getResolvedStateForHost(hostname());
      const sample = samplePageRoles();
      const css = buildCss(resolved, sample);
      injectStyle(css);
      return {
        ok: true,
        via: 'inject',
        cssLength: css.length,
        stylePresent: !!getStyleElement(),
      };
    },

    dumpDiagnostics() {
      const state = store.getState();
      const resolved = store.getResolvedStateForHost(hostname());
      const popover = getPopover();
      const settingsRoot = popover?.querySelector?.('gmixer-settings');
      const body =
        settingsRoot?.shadowRoot?.querySelector?.('.body') ||
        popover?.querySelector?.('.body');
      const styleEl = getStyleElement();
      const css = styleEl?.textContent || '';
      const candidates = findPrimaryBackgroundCandidates
        ? findPrimaryBackgroundCandidates().slice(0, 5)
        : [];

      const cssBgPrimary = css.match(/--gmixer-bg-primary:\s*([^;]+)/)?.[1]?.trim() || null;
      const cssBgSecondary = css.match(/--gmixer-bg-secondary:\s*([^;]+)/)?.[1]?.trim() || null;
      const cssText = css.match(/--gmixer-text:\s*([^;]+)/)?.[1]?.trim() || null;

      return {
        hostname: hostname(),
        href: typeof location !== 'undefined' ? location.href : '',
        state: safeClone(state),
        resolved: safeClone(resolved),
        settingsOpen: popover?.matches?.(':popover-open') === true,
        settingsScrollTop: body ? Math.round(body.scrollTop) : 0,
        openSection: state?.global?.ui?.openSection ?? null,
        settingsFocus: state?.global?.ui?.settingsFocus ?? 'theme',
        sections: safeClone(state?.global?.sections ?? {}),
        activeThemePackId: state?.global?.activeThemePackId ?? null,
        themeMode: state?.global?.themeMode ?? null,
        primaryBackground: findPrimaryBackground(),
        primaryBackgroundCandidates: candidates,
        pageSample: samplePageRoles(),
        roles: countByAttr(ROLE_ATTR),
        media: countByAttr(MEDIA_ATTR),
        injectedCssLength: css.length,
        injectedCssHasBgPrimary: css.includes('--gmixer-bg-primary'),
        injectedCssHasSurfaceGui: css.includes('--gmixer-surface-gui'),
        cssBgPrimary,
        cssBgSecondary,
        cssText,
        cssBgSecondaryValid: !!(cssBgSecondary && /^#|rgb|hsl|var\(/i.test(cssBgSecondary)),
        styleElementPresent: !!styleEl,
        debugEnabled: true,
      };
    },
  };
}
