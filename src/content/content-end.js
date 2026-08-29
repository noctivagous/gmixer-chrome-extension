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
//
// Performance: keep this host-agnostic. Prefer URL-shape, size, and tag
// heuristics over `hostname === …` special cases.
import { store } from '../state/store.js';
import { buildCss, injectStyle, removeStyle, syncAdoptedTheme } from './style-injector.js';
import { startMutationObserver } from './mutation-observer.js';
import { cssCacheScope, writeCssCache, clearCssCache } from './css-cache.js';
import { NavigationController } from './navigation-controller.js';
import { initSettingsHost } from './settings-host.js';
import {
  runAdaptivePass,
  runAdaptiveSubtreePass,
  clearAdaptivePass,
} from './adaptive-pass.js';
import { collectOpenShadowRoots } from './open-trees.js';
import { waitForPageSettle } from './page-settle.js';
import { syncLinkShimmer, rescanLinkShimmer, stopLinkShimmer } from './link-shimmer.js';
import { syncPanScan } from './pan-scan.js';
import { syncRotatingCube } from './rotating-cube.js';
import {
  LAYOUT_RESAMPLE_DEBOUNCE_MS,
  MUTATION_DEBOUNCE_MS,
  SPA_ROUTE_DEBOUNCE_MS,
  isDocumentNavigation,
} from './adaptive-timing.js';

async function main() {
  await store.ready;
  const hostname = location.hostname;
  const getScope = () => cssCacheScope(location);
  // Subframes (ad/widget iframes) get CSS + classification only. Settings,
  // navigation patching, and media-effect wrapping stay on the top document.
  const isTopFrame = window === window.top;

  let sample = null;
  let lastLayoutKey = '';
  let layoutTimer = 0;

  const nav = isTopFrame
    ? new NavigationController(() => store.getResolvedStateForHost(hostname))
    : null;

  const reapply = () => {
    const resolved = store.getResolvedStateForHost(hostname);
    if (resolved.enabled === false) {
      if (isTopFrame) {
        syncPanScan(resolved);
        syncRotatingCube(resolved);
        stopLinkShimmer();
        nav?.sync();
      }
      removeStyle();
      clearCssCache(hostname);
      clearAdaptivePass();
      return;
    }

    const adaptive = runAdaptivePass(resolved);
    sample = adaptive.sample;
    if (isTopFrame) {
      syncPanScan(resolved);
      syncRotatingCube(resolved);
    }
    const css = buildCss(resolved, sample);
    injectStyle(css);
    writeCssCache(hostname, getScope(), resolved, css);
    if (isTopFrame) {
      nav?.sync();
      syncLinkShimmer(resolved);
      lastLayoutKey = layoutKey();
    }
  };

  const rescanOpenShadows = () => {
    const resolved = store.getResolvedStateForHost(hostname);
    if (resolved.enabled === false) return;
    for (const shadow of collectOpenShadowRoots(document.documentElement)) {
      runAdaptiveSubtreePass(shadow, resolved);
    }
    syncAdoptedTheme();
  };

  // Let the first paint settle before sampling the site's own colors.
  await waitForPageSettle();
  reapply();
  // Open shadows / ad slots often attach or gain size after the first pass.
  window.setTimeout(rescanOpenShadows, 500);

  const scheduleSpaResample = isTopFrame
    ? watchLayoutAndSpa(reapply, {
        getLastKey: () => lastLayoutKey,
        setLastKey: (key) => {
          lastLayoutKey = key;
        },
        getTimer: () => layoutTimer,
        setTimer: (id) => {
          layoutTimer = id;
        },
      })
    : () => {};

  let mutationTimer = 0;
  /** @type {Element[]} */
  let queuedRoots = [];

  const flushSubtree = () => {
    mutationTimer = 0;
    const roots = collapseMutationRoots(queuedRoots);
    queuedRoots = [];
    const resolved = store.getResolvedStateForHost(hostname);
    if (resolved.enabled === false) {
      if (isTopFrame) {
        syncPanScan(resolved);
        syncRotatingCube(resolved);
        stopLinkShimmer();
      }
      removeStyle();
      clearAdaptivePass();
      return;
    }
    for (const root of roots) {
      runAdaptiveSubtreePass(root, resolved);
    }
    if (isTopFrame) {
      syncPanScan(resolved);
      syncRotatingCube(resolved);
      syncLinkShimmer(resolved);
      rescanLinkShimmer();
    }
    // Open shadows created after the last inject need the shared sheet.
    syncAdoptedTheme();
  };

  const stopObserving = startMutationObserver({
    // New page content: reclassify / retag the added subtree.
    onSubtree(roots) {
      queuedRoots.push(...roots);
      if (mutationTimer) return;
      mutationTimer = window.setTimeout(flushSubtree, MUTATION_DEBOUNCE_MS);
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
  if (isTopFrame) initSettingsHost();

  const teardown = () => {
    unsubscribe();
    stopObserving();
    if (mutationTimer) window.clearTimeout(mutationTimer);
    nav?.destroy();
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
 * Drop disconnected nodes and children of another queued root so one
 * pane insert is classified once, not once per nested widget.
 * @param {Element[]} roots
 * @returns {Element[]}
 */
function collapseMutationRoots(roots) {
  const unique = [];
  const seen = new Set();
  for (const el of roots) {
    if (!el || seen.has(el)) continue;
    if (typeof el.isConnected === 'boolean' && !el.isConnected) continue;
    seen.add(el);
    unique.push(el);
  }
  return unique.filter(
    (el) => !unique.some((other) => other !== el && typeof other.contains === 'function' && other.contains(el))
  );
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
  let lastHref = globalThis.location?.href ?? '';
  const onSpaNav = () => {
    const nextHref = globalThis.location?.href ?? '';
    const documentNav = isDocumentNavigation(lastHref, nextHref);
    lastHref = nextHref;
    if (!documentNav) return;
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
