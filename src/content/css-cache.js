// Fast path for document_start: remember the last CSS we applied per host and
// route in chrome.storage.session so the next navigation can paint the theme
// before sync/local settings fully resolve (reduces flash-of-original).

const CACHE_PREFIX = 'gmixer_css:';
const CACHE_VERSION = 2;

function hasSessionStorage() {
  return typeof chrome !== 'undefined' && !!chrome.storage?.session;
}

export function cssCacheScope(locationLike = location) {
  return `${locationLike.origin}${locationLike.pathname}`;
}

export function cssCacheFingerprint(resolved) {
  const serialized = JSON.stringify(resolved);
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export async function readCssCache(hostname, scope) {
  if (!hasSessionStorage() || !hostname) return null;
  try {
    const key = CACHE_PREFIX + hostname;
    const data = await chrome.storage.session.get(key);
    const cached = data[key];
    if (
      !cached ||
      typeof cached !== 'object' ||
      cached.version !== CACHE_VERSION ||
      cached.scope !== scope ||
      typeof cached.fingerprint !== 'string' ||
      typeof cached.css !== 'string'
    ) {
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

export async function writeCssCache(hostname, scope, resolved, css) {
  if (!hasSessionStorage() || !hostname || !scope || !resolved || !css) return;
  try {
    await chrome.storage.session.set({
      [CACHE_PREFIX + hostname]: {
        version: CACHE_VERSION,
        scope,
        fingerprint: cssCacheFingerprint(resolved),
        css,
      },
    });
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
