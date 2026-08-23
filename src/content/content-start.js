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
import { readCssCache, writeCssCache, clearCssCache } from './css-cache.js';
import { installEarlyMessageQueue } from '../messaging/early-message-queue.js';

async function applyStaticTheme() {
  const hostname = location.hostname;

  // Kick the cache read immediately — don't wait for store merge.
  const cachePromise = readCssCache(hostname).then((cachedCss) => {
    if (cachedCss && !document.getElementById(STYLE_ELEMENT_ID)) {
      injectStyle(cachedCss);
    }
  });

  await Promise.all([store.ready, cachePromise]);

  const resolved = store.getResolvedStateForHost(hostname);
  if (resolved.enabled === false) {
    removeStyle();
    await clearCssCache(hostname);
    return;
  }

  // Static only: pure theme palette, no live page sample.
  const css = buildCss(resolved, null);
  injectStyle(css);
  await writeCssCache(hostname, css);
}

installEarlyMessageQueue();
applyStaticTheme();
