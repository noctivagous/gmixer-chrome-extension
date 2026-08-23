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
  } catch {
    // A content script can outlive an extension reload. Its context is no
    // longer usable, so let the caller continue with defaults.
    return null;
  }

  const syncState = syncData[STORAGE_KEY];
  const localState = localData[STORAGE_KEY];
  if (!syncState && !localState) return null;

  const global = { ...(localState?.global ?? {}), ...(syncState?.global ?? {}) };
  // UI chrome lives in local; keep it from being overwritten by older sync
  // payloads that still carried a `ui` bag before the split.
  if (localState?.global?.ui !== undefined) {
    global.ui = localState.global.ui;
  }

  return {
    version: syncState?.version ?? localState?.version,
    global,
    perSite: localState?.perSite ?? {},
  };
}

/** Persist the full state, splitting fields across sync/local per FIELD_STORAGE_AREAS. */
export async function persistState(state) {
  if (!hasChromeStorage()) return;

  const { sync, local } = splitGlobal(state.global);
  const syncPayload = { [STORAGE_KEY]: { version: state.version, global: sync } };
  const localPayload = {
    [STORAGE_KEY]: {
      version: state.version,
      global: local,
      ...(PER_SITE_AREA === 'local' ? { perSite: state.perSite } : {}),
    },
  };

  try {
    await Promise.all([
      chrome.storage.sync.set(syncPayload),
      chrome.storage.local.set(localPayload),
    ]);
  } catch {
    // Ignore writes from a stale content/popup context after extension reload.
  }
}

/** Subscribe to external storage changes (e.g. settings edited in another tab/window). */
export function onPersistedStateChanged(callback) {
  if (!hasChromeStorage()) return () => {};

  const listener = (changes, area) => {
    if ((area === 'sync' || area === 'local') && STORAGE_KEY in changes) {
      // Do not leave an async storage callback unhandled when the extension
      // is reloaded while this content script is still resident.
      Promise.resolve().then(callback).catch(() => {});
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
