// document_end: ADAPTIVE PASS.
//
// BOUNDARY — this file owns expensive live-DOM work. content-start.js must
// stay a static CSS paint (cache + theme-only buildCss). All sampling,
// classification, tonal layers, and background tagging go through
// adaptive-pass.js here (and again from the MutationObserver for new
// subtrees / SPA content).
//
// Also: re-assert the stylesheet into <head>, refresh the session CSS cache
// for the next navigation's document_start, sync opt-in navigation, and
// mount the in-page Settings host (toolbar / Alt+M / Alt+N).
import { store } from '../state/store.js';
import { buildCss, injectStyle, removeStyle } from './style-injector.js';
import { startMutationObserver } from './mutation-observer.js';
import { cssCacheScope, writeCssCache, clearCssCache } from './css-cache.js';
import { NavigationController } from './navigation-controller.js';
import { initSettingsHost } from './settings-host.js';
import {
  runAdaptivePass,
  runAdaptiveSubtreePass,
  clearAdaptivePass,
} from './adaptive-pass.js';
import { waitForPageSettle } from './page-settle.js';
import { syncLinkShimmer, rescanLinkShimmer, stopLinkShimmer } from './link-shimmer.js';
import { syncPanScan } from './pan-scan.js';
import { syncRotatingCube } from './rotating-cube.js';
import { LAYOUT_RESAMPLE_DEBOUNCE_MS, SPA_ROUTE_DEBOUNCE_MS } from './adaptive-timing.js';

async function main() {
  await store.ready;
  const hostname = location.hostname;
  const getScope = () => cssCacheScope(location);

  let sample = null;
  let lastLayoutKey = '';
  let layoutTimer = 0;

  const nav = new NavigationController(() => store.getResolvedStateForHost(hostname));

  const reapply = () => {
    const resolved = store.getResolvedStateForHost(hostname);
    if (resolved.enabled === false) {
      syncPanScan(resolved);
      syncRotatingCube(resolved);
      removeStyle();
      clearCssCache(hostname);
      clearAdaptivePass();
      stopLinkShimmer();
      nav.sync();
      return;
    }

    const adaptive = runAdaptivePass(resolved);
    sample = adaptive.sample;
    syncPanScan(resolved);
    syncRotatingCube(resolved);
    const css = buildCss(resolved, sample);
    injectStyle(css);
    writeCssCache(hostname, getScope(), resolved, css);
    nav.sync();
    syncLinkShimmer(resolved);
    lastLayoutKey = layoutKey();
  };

  // Let the first paint settle before sampling the site's own colors.
  await waitForPageSettle();
  reapply();

  const scheduleSpaResample = watchLayoutAndSpa(reapply, {
    getLastKey: () => lastLayoutKey,
    setLastKey: (key) => {
      lastLayoutKey = key;
    },
    getTimer: () => layoutTimer,
    setTimer: (id) => {
      layoutTimer = id;
    },
  });

  const stopObserving = startMutationObserver({
    // New page content: reclassify / retag the added subtree, then reassert CSS.
    onSubtree(roots) {
      const resolved = store.getResolvedStateForHost(hostname);
      if (resolved.enabled === false) {
        syncPanScan(resolved);
        syncRotatingCube(resolved);
        removeStyle();
        clearAdaptivePass();
        stopLinkShimmer();
        return;
      }
      for (const root of roots) {
        runAdaptiveSubtreePass(root, resolved);
      }
      syncPanScan(resolved);
      syncRotatingCube(resolved);
      injectStyle(buildCss(resolved, sample));
      syncLinkShimmer(resolved);
      rescanLinkShimmer();
    },
    // Stylesheets or head changes: cascade order may have beaten us — reassert.
    onCascadeThreat() {
      const resolved = store.getResolvedStateForHost(hostname);
      if (resolved.enabled === false) {
        removeStyle();
        clearAdaptivePass();
        stopLinkShimmer();
        return;
      }
      injectStyle(buildCss(resolved, sample));
    },
    // Covers routers that mutate the route without invoking the History APIs
    // patched below. Run a full pass after its new DOM has had a chance to
    // paint instead of retaining the prior route's identity sample.
    onNavigation: scheduleSpaResample,
  });

  const unsubscribe = store.subscribe(reapply);
  initSettingsHost();

  const teardown = () => {
    unsubscribe();
    stopObserving();
    nav.destroy();
  };
  window.addEventListener('pagehide', teardown, { once: true });

  // Compile-time flag from build.js (--debug). False builds drop this import.
  if (__GMIXER_DEBUG__) {
    const { installDebugApi } = await import('../debug/install-debug.js');
    installDebugApi(store, reapply);
  }
}

function layoutKey() {
  return `${window.innerWidth}x${window.innerHeight}:${Math.round(document.documentElement.scrollHeight / 200)}`;
}

/**
 * Full resample on significant layout change or SPA history navigation.
 * Mutations still use incremental classify between these events.
 * @param {() => void} reapply
 * @param {{
 *   getLastKey: () => string,
 *   setLastKey: (key: string) => void,
 *   getTimer: () => number,
 *   setTimer: (id: number) => void,
 * }} layout
 */
function watchLayoutAndSpa(reapply, layout) {
  const scheduleLayoutResample = () => {
    clearTimeout(layout.getTimer());
    layout.setTimer(
      window.setTimeout(() => {
        const next = layoutKey();
        if (next === layout.getLastKey()) return;
        layout.setLastKey(next);
        reapply();
      }, LAYOUT_RESAMPLE_DEBOUNCE_MS)
    );
  };

  window.addEventListener('resize', scheduleLayoutResample, { passive: true });

  let routeTimer = 0;
  const onSpaNav = () => {
    clearTimeout(routeTimer);
    routeTimer = window.setTimeout(() => {
      void waitForPageSettle().then(reapply);
    }, SPA_ROUTE_DEBOUNCE_MS);
  };
  window.addEventListener('popstate', onSpaNav);
  window.addEventListener('hashchange', onSpaNav);

  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  history.pushState = function pushStatePatched(...args) {
    const result = originalPush.apply(this, args);
    onSpaNav();
    return result;
  };
  history.replaceState = function replaceStatePatched(...args) {
    const result = originalReplace.apply(this, args);
    onSpaNav();
    return result;
  };
  return onSpaNav;
}

main();
