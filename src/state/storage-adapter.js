// Storage-agnostic persistence for the settings state (schema.js).
// The binding layer (store.js) is the only thing that talks to this module —
// UI components never touch chrome.storage directly. That indirection is the
// point: swapping an individual field between sync/local/IndexedDB later
// should only mean editing FIELD_STORAGE_AREAS below.

const STORAGE_KEY = 'gmixer_state';

/**
 * Which chrome.storage area each top-level `global.*` field belongs in.
 * - 'sync': small values that should follow the user across machines
 *   (color scheme, toggles, active theme pack).
 * - 'local': larger/device-specific values (uploaded custom font data,
 *   per-site override map) that shouldn't burn the sync quota.
 */
const FIELD_STORAGE_AREAS = {
  enabled: 'local',
  activeThemePackId: 'sync',
  themeMode: 'sync',
  color: 'sync',
  fonts: 'local', // customFonts can hold data: URLs — keep off sync quota
  imageFilter: 'sync',
  mediaStyles: 'sync',
  clipping: 'sync',
  corners: 'sync',
  effects: 'sync',
  navigation: 'sync',
  sections: 'sync',
  // Panel chrome (open, scroll, accordion expand) — local so every open tab
  // on this device stays in lockstep without waiting on sync.
  ui: 'local',
};

const PER_SITE_AREA = 'local';
/** chrome.storage.sync allows 120 writes/minute. Coalesce slider/wheel input. */
const PERSIST_DEBOUNCE_MS = 400;

let persistTimer = 0;
let queuedState = null;
/** @type {Promise<void> | null} */
let persistWaiters = null;
/** @type {(() => void) | null} */
let resolvePersistWaiters = null;
let lastSyncJson = '';
let lastLocalJson = '';

function isInvalidatedExtensionContext(err) {
  return /Extension context invalidated|context invalidated/i.test(String(err?.message || err));
}

function warnUnlessInvalidated(action, err) {
  if (isInvalidatedExtensionContext(err)) return;
  console.warn(`[gMixer] ${action} failed`, err);
}

function splitGlobal(global) {
  const sync = {};
  const local = {};
  for (const [key, value] of Object.entries(global)) {
    const area = FIELD_STORAGE_AREAS[key] ?? 'sync';
    (area === 'sync' ? sync : local)[key] = value;
  }
  return { sync, local };
}

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && !!chrome.storage;
}

/** Load the full persisted state (merging sync + local areas). Returns null if nothing stored yet. */
export async function loadPersistedState() {
  if (!hasChromeStorage()) return null;

  let syncData;
  let localData;
  try {
    [syncData, localData] = await Promise.all([
      chrome.storage.sync.get(STORAGE_KEY),
      chrome.storage.local.get(STORAGE_KEY),
    ]);
  } catch (err) {
    warnUnlessInvalidated('storage load', err);
    return null;
  }

  const syncState = syncData[STORAGE_KEY];
  const localState = localData[STORAGE_KEY];
  if (!syncState && !localState) return null;

  const global = { ...(localState?.global ?? {}), ...(syncState?.global ?? {}) };
  // UI chrome and the master enable flag live in local; keep them from being
  // overwritten by older sync payloads that still carried those keys.
  if (localState?.global?.ui !== undefined) {
    global.ui = localState.global.ui;
  }
  if (localState?.global?.enabled !== undefined) {
    global.enabled = localState.global.enabled;
  }

  const resolved = {
    version: syncState?.version ?? localState?.version,
    global,
    perSite: localState?.perSite ?? {},
  };
  rememberWritten(resolved);
  return resolved;
}

function payloadsFor(state) {
  const { sync, local } = splitGlobal(state.global);
  return {
    syncPayload: { [STORAGE_KEY]: { version: state.version, global: sync } },
    localPayload: {
      [STORAGE_KEY]: {
        version: state.version,
        global: local,
        ...(PER_SITE_AREA === 'local' ? { perSite: state.perSite } : {}),
      },
    },
  };
}

function rememberWritten(state) {
  const { syncPayload, localPayload } = payloadsFor(state);
  lastSyncJson = JSON.stringify(syncPayload);
  lastLocalJson = JSON.stringify(localPayload);
}

function enqueuePersistWaiter() {
  if (!persistWaiters) {
    persistWaiters = new Promise((resolve) => {
      resolvePersistWaiters = resolve;
    });
  }
  return persistWaiters;
}

function settlePersistWaiters() {
  resolvePersistWaiters?.();
  persistWaiters = null;
  resolvePersistWaiters = null;
}

async function flushPersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = 0;
  }
  const state = queuedState;
  queuedState = null;
  if (!state || !hasChromeStorage()) {
    settlePersistWaiters();
    return;
  }

  const { syncPayload, localPayload } = payloadsFor(state);
  const syncJson = JSON.stringify(syncPayload);
  const localJson = JSON.stringify(localPayload);
  /** @type {Promise<void>[]} */
  const writes = [];
  if (syncJson !== lastSyncJson) {
    lastSyncJson = syncJson;
    writes.push(chrome.storage.sync.set(syncPayload));
  }
  if (localJson !== lastLocalJson) {
    lastLocalJson = localJson;
    writes.push(chrome.storage.local.set(localPayload));
  }
  if (!writes.length) {
    settlePersistWaiters();
    return;
  }
  try {
    await Promise.all(writes);
  } catch (err) {
    warnUnlessInvalidated('storage write', err);
  } finally {
    settlePersistWaiters();
  }
}

/**
 * Persist the full state, splitting fields across sync/local per FIELD_STORAGE_AREAS.
 * Writes are coalesced so color-wheel / slider input cannot exhaust
 * chrome.storage.sync's 120 writes/minute quota.
 *
 * @param {object} state
 * @param {{ immediate?: boolean }} [options]
 */
export function persistState(state, { immediate = false } = {}) {
  if (!hasChromeStorage()) return Promise.resolve();
  queuedState = state;
  const waiter = enqueuePersistWaiter();
  if (immediate) {
    return flushPersist();
  }
  if (!persistTimer) {
    persistTimer = setTimeout(() => {
      persistTimer = 0;
      void flushPersist();
    }, PERSIST_DEBOUNCE_MS);
  }
  return waiter;
}

/** Flush a pending coalesced write (pagehide / tests). */
export function flushPersistedState() {
  return flushPersist();
}

/** Test-only: drop debounce timers and last-write cache. */
export function resetPersistCacheForTests() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = 0;
  }
  queuedState = null;
  lastSyncJson = '';
  lastLocalJson = '';
  settlePersistWaiters();
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushPersist();
  });
}
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    void flushPersist();
  });
}

/** Subscribe to external storage changes (e.g. settings edited in another tab/window). */
export function onPersistedStateChanged(callback) {
  if (!hasChromeStorage()) return () => {};

  const listener = (changes, area) => {
    if ((area === 'sync' || area === 'local') && STORAGE_KEY in changes) {
      // Do not leave an async storage callback unhandled when the extension
      // is reloaded while this content script is still resident.
      Promise.resolve().then(callback).catch((err) => {
        warnUnlessInvalidated('storage sync', err);
      });
    }
  };
  try {
    chrome.storage.onChanged.addListener(listener);
  } catch {
    return () => {};
  }
  return () => {
    try {
      chrome.storage.onChanged.removeListener(listener);
    } catch {
      // The extension context may have been invalidated already.
    }
  };
}
