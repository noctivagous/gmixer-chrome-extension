// document_start: inject override CSS before the page paints.
//
// Flash mitigation: race a chrome.storage.session CSS cache (last CSS we
// applied for this host) against the full settings load. Cache usually
// wins first and paints immediately; store.ready then refreshes with the
// true current settings (still without page sampling — that runs at
// document_end when the DOM exists).
import { store } from '../state/store.js';
import { buildCss, injectStyle, removeStyle, STYLE_ELEMENT_ID } from './style-injector.js';
import { readCssCache, writeCssCache, clearCssCache } from './css-cache.js';

async function applyInitialTheme() {
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

  // No page sample yet (DOM may not exist) — pure theme palette.
  const css = buildCss(resolved, null);
  injectStyle(css);
  await writeCssCache(hostname, css);
}

applyInitialTheme();
