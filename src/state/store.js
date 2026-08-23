// The binding layer between settings state and the UI. This is the piece
// KeyPilot's settings.js didn't have from the start — every Lit component
// reads current state via `store.getState()` / `store.subscribe()` and
// writes via `store.update()`. Nothing touches chrome.storage or postMessage
// directly outside of this module and storage-adapter.js.

import { createDefaultState } from './schema.js';
import { loadPersistedState, persistState, onPersistedStateChanged } from './storage-adapter.js';

function deepMerge(base, patch) {
  // Explicit null clears a value (e.g. ui.openSection → all accordions closed).
  if (patch === null) return null;
  if (Array.isArray(base) || Array.isArray(patch)) return patch ?? base;
  if (typeof base !== 'object' || base === null) return patch ?? base;
  if (typeof patch !== 'object') return patch ?? base;

  const result = { ...base };
  for (const key of Object.keys(patch)) {
    result[key] = deepMerge(base[key], patch[key]);
  }
  return result;
}

function migrateTypography(state, persisted) {
  const persistedFonts = persisted?.global?.fonts;
  if (!persistedFonts || persistedFonts.headings) return state;
  const fonts = state.global.fonts;
  state.global.fonts = {
    ...fonts,
    headings: {
      h1: persistedFonts.headers || fonts.headings.h1,
      h2: persistedFonts.subheadings || fonts.headings.h2,
      h3: persistedFonts.subheadings || fonts.headings.h3,
      h4: persistedFonts.subheadings || fonts.headings.h4,
      h5: persistedFonts.subheadings || fonts.headings.h5,
      h6: persistedFonts.subheadings || fonts.headings.h6,
    },
  };
  return state;
}

export class SettingsStore {
  constructor() {
    /** @private */
    this._state = createDefaultState();
    /** @private */
    this._listeners = new Set();
    /** @private */
    this._ready = this._init();
  }

  async _init() {
    const persisted = await loadPersistedState();
    if (persisted) {
      this._state = migrateTypography(deepMerge(this._state, persisted), persisted);
    }
    onPersistedStateChanged(async () => {
      const latest = await loadPersistedState();
      if (latest) {
        this._state = migrateTypography(deepMerge(createDefaultState(), latest), latest);
        this._notify();
      }
    });
    this._notify();
  }

  /** Resolves once the initial load from storage has completed. */
  get ready() {
    return this._ready;
  }

  getState() {
    return this._state;
  }

  /**
   * Resolve `global` settings with the current site's `perSite` overrides
   * applied on top, for content scripts that only care about "what should
   * apply on this page right now."
   * The master `global.enabled` flag always wins when false (Alt+N / titlebar).
   */
  getResolvedStateForHost(hostname) {
    const base = this._state.global;
    const override = this._state.perSite[hostname];
    const merged = override ? deepMerge(base, override) : base;
    if (base?.enabled === false) {
      return { ...merged, enabled: false };
    }
    return merged;
  }

  /**
   * Shallow-merge a patch into `global` (or `perSite.<hostname>` when
   * `hostname` is provided) and persist + notify subscribers.
   * @param {object} patch
   * @param {{ hostname?: string }} [options]
   */
  async update(patch, { hostname } = {}) {
    if (hostname) {
      const currentSiteOverride = this._state.perSite[hostname] ?? {};
      this._state = {
        ...this._state,
        perSite: {
          ...this._state.perSite,
          [hostname]: deepMerge(currentSiteOverride, patch),
        },
      };
    } else {
      this._state = {
        ...this._state,
        global: deepMerge(this._state.global, patch),
      };
    }
    this._notify();
    await persistState(this._state);
  }

  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /** @private */
  _notify() {
    for (const listener of this._listeners) listener(this._state);
  }
}

// Single shared instance — the whole point of a binding layer is that
// there's exactly one source of truth per execution context (popup, or
// content script) rather than each component owning its own copy.
export const store = new SettingsStore();
