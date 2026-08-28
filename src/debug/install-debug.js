// Content-script installer for the development debug API.
// Exposes APIs in the isolated world and bridges them into the page main
// world so browser evaluate_script / CDP can call window.gmixerDebug.

import { createDebugApi } from './debug-api.js';
import {
  findPrimaryBackground,
  findPrimaryBackgroundCandidates,
  samplePageRoles,
} from '../content/page-sampler.js';
import { buildCss, injectStyle } from '../content/style-injector.js';
import {
  openSettingsPopover,
  closeSettingsPopover,
  SETTINGS_POPOVER_ID,
} from '../content/settings-host.js';

const REQUEST_TYPE = 'GMIXER_DEBUG_REQUEST';
const RESPONSE_TYPE = 'GMIXER_DEBUG_RESPONSE';
const BRIDGE_SRC = 'debug-bridge.js';

function isDebugEnabled() {
  try {
    // esbuild --define replaces this with true/false at build time.
    return typeof __GMIXER_DEBUG__ !== 'undefined' && !!__GMIXER_DEBUG__;
  } catch {
    return false;
  }
}

/**
 * @param {import('../state/store.js').SettingsStore} store
 * @param {() => void} [reapply]
 */
export function installDebugApi(store, reapply) {
  if (!isDebugEnabled()) return null;

  const api = createDebugApi({
    store,
    openSettings: openSettingsPopover,
    closeSettings: closeSettingsPopover,
    samplePageRoles,
    findPrimaryBackground,
    findPrimaryBackgroundCandidates,
    buildCss,
    injectStyle,
    reapply,
    getPopover: () => document.getElementById(SETTINGS_POPOVER_ID),
  });

  // Isolated-world global (Chrome DevTools content-script context).
  globalThis.__GMIXER_DEBUG__ = true;
  globalThis.gmixerDebug = api;

  installMainWorldBridge(api);
  return api;
}

/**
 * @param {ReturnType<typeof createDebugApi>} api
 */
function installMainWorldBridge(api) {
  // Content script handles page-world requests.
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.origin !== window.location.origin) return;
    const data = event.data;
    if (!data || data.type !== REQUEST_TYPE || typeof data.id !== 'string') return;
    if (typeof data.method !== 'string') return;

    const method = api[data.method];
    /** @type {{ type: string, id: string, ok: boolean, result?: unknown, error?: string }} */
    const response = { type: RESPONSE_TYPE, id: data.id, ok: false };
    try {
      if (typeof method !== 'function') {
        throw new Error(`Unknown gmixerDebug method: ${data.method}`);
      }
      const args = Array.isArray(data.args) ? data.args : [];
      response.result = await method.apply(api, args);
      response.ok = true;
    } catch (err) {
      response.error = err instanceof Error ? err.message : String(err);
    }
    window.postMessage(response, window.location.origin);
  });

  // Inject the page-world stub via extension URL (CSP-safe vs inline script).
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return;
    if (document.documentElement?.dataset?.gmixerDebugBridge === '1') return;
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL(BRIDGE_SRC);
    script.async = false;
    script.dataset.gmixerDebug = '1';
    script.onload = () => script.remove();
    script.onerror = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
    if (document.documentElement) {
      document.documentElement.dataset.gmixerDebugBridge = '1';
    }
  } catch {
    // Page may block extension scripts; isolated-world API still works.
  }
}
