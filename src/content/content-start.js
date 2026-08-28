// document_start: STATIC PASS ONLY.
//
// BOUNDARY — do not cross:
// ✓ chrome.storage.session CSS cache for this host
// ✓ buildCss(resolved, null) from theme settings alone
// ✓ inject/remove the override <style>
// ✗ samplePageRoles / page sampling
// ✗ classifyPage / classifySubtree
// ✗ tonal surface layers
// ✗ background-image tagging
// ✗ MutationObserver
//
// Those adaptive steps live in adaptive-pass.js and run from content-end.js
// (and the MutationObserver) once the DOM exists.
//
// Flash mitigation: race the session CSS cache against the full settings
// load. Cache usually wins first and paints immediately; store.ready then
// refreshes with the true current settings (still without page sampling).
import { store } from '../state/store.js';
import { buildCss, injectStyle, removeStyle, STYLE_ELEMENT_ID } from './style-injector.js';
import {
  cssCacheFingerprint,
  cssCacheScope,
  readCssCache,
  writeCssCache,
  clearCssCache,
} from './css-cache.js';
import { installEarlyMessageQueue } from '../messaging/early-message-queue.js';

async function applyStaticTheme() {
  const hostname = location.hostname;
  const scope = cssCacheScope(location);

  // Kick the cache read immediately — don't wait for store merge.
  const cachePromise = readCssCache(hostname, scope).then((cached) => {
    if (cached && !document.getElementById(STYLE_ELEMENT_ID)) {
      injectStyle(cached.css);
    }
    return cached;
  });

  const [, cached] = await Promise.all([store.ready, cachePromise]);

  const resolved = store.getResolvedStateForHost(hostname);
  if (resolved.enabled === false) {
    removeStyle();
    await clearCssCache(hostname);
    return;
  }

  // The early cache read intentionally races settings resolution. Once the
  // current settings are known, replace any stale cached theme immediately.
  const fingerprint = cssCacheFingerprint(resolved);
  const cacheMatches =
    cached?.scope === scope && cached.fingerprint === fingerprint;

  // Keep a validated analyzed stylesheet in place until document_end can
  // perform its synchronous adaptive refresh. This avoids downgrading a good
  // cache hit back to the less complete static stylesheet.
  if (cacheMatches && cached.css) return;

  // Static only: pure theme palette, no live page sample.
  const css = buildCss(resolved, null);
  injectStyle(css);
  await writeCssCache(hostname, scope, resolved, css);
}

installEarlyMessageQueue();
applyStaticTheme();
