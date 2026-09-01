// Fast path for document_start: remember sample-independent CSS by host and
// route in chrome.storage.session so the next navigation can paint the theme
// before sync/local settings fully resolve (reduces flash-of-original).
//
// Adaptive/page-sampled CSS must never be written here. Scope-specific keys
// keep concurrent routes and same-host frames from replacing one another.

const CACHE_PREFIX = 'gmixer_css:';
const CACHE_VERSION = 4;

function hasSessionStorage() {
  return typeof chrome !== 'undefined' && !!chrome.storage?.session;
}

export function cssCacheScope(locationLike = location) {
  return `${locationLike.origin}${locationLike.pathname}`;
}

function cacheHostPrefix(hostname) {
  return `${CACHE_PREFIX}${encodeURIComponent(hostname)}:`;
}

function cacheKey(hostname, scope) {
  return `${cacheHostPrefix(hostname)}${encodeURIComponent(scope)}`;
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
  if (!hasSessionStorage() || !hostname || !scope) return null;
  try {
    const key = cacheKey(hostname, scope);
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
      [cacheKey(hostname, scope)]: {
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
    const data = await chrome.storage.session.get(null);
    const prefix = cacheHostPrefix(hostname);
    const keys = Object.keys(data).filter((key) => key.startsWith(prefix));
    if (keys.length) await chrome.storage.session.remove(keys);
  } catch {
    /* ignore */
  }
}
