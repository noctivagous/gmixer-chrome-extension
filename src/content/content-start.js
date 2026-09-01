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
import { markThemePhase } from './adaptive-timing.js';

async function applyStaticTheme() {
  markThemePhase('gmixer:static-start');
  const hostname = location.hostname;
  const initialScope = cssCacheScope(location);

  // Kick the cache read immediately — don't wait for store merge.
  const cachePromise = readCssCache(hostname, initialScope).then((cached) => {
    if (
      cached &&
      cssCacheScope(location) === initialScope &&
      !document.getElementById(STYLE_ELEMENT_ID)
    ) {
      injectStyle(cached.css);
      markThemePhase('gmixer:static-cache-paint');
    }
    return cached;
  });

  const [, cached] = await Promise.all([store.ready, cachePromise]);

  const resolved = store.getResolvedStateForHost(hostname);
  const scope = cssCacheScope(location);
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

  // Cached styles are static-only, so a matching entry is the exact fast-path
  // stylesheet this pass would rebuild.
  if (cacheMatches && cached.css && initialScope === scope) {
    markThemePhase('gmixer:static-cache-hit');
    return;
  }

  // Static only: pure theme palette, no live page sample.
  const css = buildCss(resolved, null);
  injectStyle(css);
  markThemePhase('gmixer:static-rebuild-paint');
  await writeCssCache(hostname, scope, resolved, css);
}

installEarlyMessageQueue();
applyStaticTheme();
