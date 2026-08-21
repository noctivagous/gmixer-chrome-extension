// document_end: DOM is parsed — re-assert the stylesheet into <head>,
// sample the page for restyle weighting, start the MutationObserver, and
// refresh the session CSS cache so the next navigation's document_start
// has a fast paint path. Also syncs opt-in navigation and the in-page
// Settings popover host (toolbar / Alt+M).
//
import { store } from '../state/store.js';
import { buildCss, injectStyle, removeStyle } from './style-injector.js';
import { startMutationObserver } from './mutation-observer.js';
import { samplePageRoles } from './page-sampler.js';
import { writeCssCache, clearCssCache } from './css-cache.js';
import { NavigationController } from './navigation-controller.js';
import { initSettingsHost } from './settings-host.js';

async function main() {
  await store.ready;
  const hostname = location.hostname;

  let sample = samplePageRoles();

  const nav = new NavigationController(() => store.getResolvedStateForHost(hostname));

  const reapply = () => {
    const resolved = store.getResolvedStateForHost(hostname);
    if (resolved.enabled === false) {
      removeStyle();
      clearCssCache(hostname);
      nav.sync();
      return;
    }
    sample = samplePageRoles();
    const css = buildCss(resolved, sample);
    injectStyle(css);
    writeCssCache(hostname, css);
    nav.sync();
  };

  reapply();
  startMutationObserver(() => {
    const resolved = store.getResolvedStateForHost(hostname);
    if (resolved.enabled === false) {
      removeStyle();
      return;
    }
    injectStyle(buildCss(resolved, sample));
  });

  store.subscribe(reapply);
  initSettingsHost();
}

main();
