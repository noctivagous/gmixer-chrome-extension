// Fast path for document_start: remember the last CSS we applied per host
// in chrome.storage.session so the next navigation can paint the theme
// before sync/local settings fully resolve (reduces flash-of-original).

const CACHE_PREFIX = 'gmixer_css:';

function hasSessionStorage() {
  return typeof chrome !== 'undefined' && !!chrome.storage?.session;
}

export async function readCssCache(hostname) {
  if (!hasSessionStorage() || !hostname) return null;
  try {
    const key = CACHE_PREFIX + hostname;
    const data = await chrome.storage.session.get(key);
    return typeof data[key] === 'string' ? data[key] : null;
  } catch {
    return null;
  }
}

export async function writeCssCache(hostname, css) {
  if (!hasSessionStorage() || !hostname || !css) return;
  try {
    await chrome.storage.session.set({ [CACHE_PREFIX + hostname]: css });
  } catch {
    /* session quota / private mode — ignore */
  }
}

export async function clearCssCache(hostname) {
  if (!hasSessionStorage() || !hostname) return;
  try {
    await chrome.storage.session.remove(CACHE_PREFIX + hostname);
  } catch {
    /* ignore */
  }
}
