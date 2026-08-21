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
  color: 'sync',
  fonts: 'local', // customFonts can hold data: URLs — keep off sync quota
  imageFilter: 'sync',
  clipping: 'sync',
  effects: 'sync',
  navigation: 'sync',
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

  const [syncData, localData] = await Promise.all([
    chrome.storage.sync.get(STORAGE_KEY),
    chrome.storage.local.get(STORAGE_KEY),
  ]);

  const syncState = syncData[STORAGE_KEY];
  const localState = localData[STORAGE_KEY];
  if (!syncState && !localState) return null;

  return {
    version: syncState?.version ?? localState?.version,
    global: { ...(localState?.global ?? {}), ...(syncState?.global ?? {}) },
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

  await Promise.all([
    chrome.storage.sync.set(syncPayload),
    chrome.storage.local.set(localPayload),
  ]);
}

/** Subscribe to external storage changes (e.g. settings edited in another tab/window). */
export function onPersistedStateChanged(callback) {
  if (!hasChromeStorage()) return () => {};

  const listener = (changes, area) => {
    if ((area === 'sync' || area === 'local') && STORAGE_KEY in changes) {
      callback();
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
