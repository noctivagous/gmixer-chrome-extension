// document_end: ADAPTIVE PASS.
//
// BOUNDARY — this file owns expensive live-DOM work. content-start.js must
// stay a static CSS paint (cache + theme-only buildCss). All sampling,
// classification, tonal layers, and background tagging go through
// adaptive-pass.js here (and again from the MutationObserver for new
// subtrees / SPA content).
//
// Also: re-assert the stylesheet into <head>, sync opt-in navigation, and
// mount the in-page Settings host (toolbar / Alt+M / Alt+N). The session
// cache remains static-only and is owned by content-start.js.
//
// Performance: keep this host-agnostic. Prefer URL-shape, size, and tag
// heuristics over `hostname === …` special cases.
import { store } from '../state/store.js';
import { buildCss, injectStyle, removeStyle, syncAdoptedTheme } from './style-injector.js';
import { startMutationObserver } from './mutation-observer.js';
import { clearCssCache } from './css-cache.js';
import { clearEarlyCanvas, persistEarlyCanvasFromDocument, persistGlobalToneCanvas } from './early-canvas.js';
import { NavigationController } from './navigation-controller.js';
import { initSettingsHost } from './settings-host.js';
import {
  runAdaptivePass,
  runAdaptiveSubtreePasses,
  clearAdaptivePass,
} from './adaptive-pass.js';
import {
  assignToneSteps,
  seedPageSheets,
  stampOpaquePaintTargets,
} from './page-classifier.js';
import { collectOpenShadowRoots } from './open-trees.js';
import { waitForPageSettle } from './page-settle.js';
import { syncLinkShimmer, stopLinkShimmer } from './link-shimmer.js';
import { syncPanScan } from './pan-scan.js';
import { syncRotatingCube } from './rotating-cube.js';
import { stampVisibleFlyouts, startFlyoutController } from './flyout-controller.js';
import {
  LAYOUT_RESAMPLE_DEBOUNCE_MS,
  MUTATION_DEBOUNCE_MS,
  SPA_ROUTE_DEBOUNCE_MS,
  isDocumentNavigation,
  markThemePhase,
  scheduleFirstAdaptivePass,
} from './adaptive-timing.js';

async function main() {
  await store.ready;
  const hostname = location.hostname;
  // Subframes (ad/widget iframes) get CSS + classification only. Settings,
  // navigation patching, and media-effect wrapping stay on the top document.
  const isTopFrame = window === window.top;

  let sample = null;
  let lastLayoutKey = '';
  let layoutTimer = 0;
  let delayedShadowTimer = 0;
  let active = true;

  const nav = isTopFrame
    ? new NavigationController(() => store.getResolvedStateForHost(hostname))
    : null;

  if (isTopFrame) initSettingsHost();

  const reapply = () => {
    if (!active) return;
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
      clearEarlyCanvas();
      persistGlobalToneCanvas(resolved);
      clearAdaptivePass();
      return;
    }

    markThemePhase('gmixer:adaptive-pass-start');
    const adaptive = runAdaptivePass(resolved);
    sample = adaptive.sample;
    if (isTopFrame) {
      syncPanScan(resolved);
      syncRotatingCube(resolved);
    }
    const css = buildCss(resolved, sample);
    injectStyle(css);
    persistEarlyCanvasFromDocument();
    persistGlobalToneCanvas(resolved);
    markThemePhase('gmixer:adaptive-pass-done');
    if (isTopFrame) {
      nav?.sync();
      syncLinkShimmer(resolved);
      lastLayoutKey = layoutKey();
    }
  };

  const rescanOpenShadows = () => {
    if (!active) return;
    const resolved = store.getResolvedStateForHost(hostname);
    if (resolved.enabled === false) return;
    syncAdoptedTheme();
    if (isTopFrame) {
      syncPanScan(resolved);
      syncRotatingCube(resolved);
      syncLinkShimmer(resolved);
    }
  };

  markThemePhase('gmixer:document-end');
  await waitForPageSettle();
  markThemePhase('gmixer:page-settled');
  const startAdaptive = () => {
    if (!active) return;
    markThemePhase('gmixer:idle-callback');
    reapply();
    delayedShadowTimer = window.setTimeout(rescanOpenShadows, 500);
  };
  scheduleFirstAdaptivePass(startAdaptive);

  const layoutAndSpa = isTopFrame
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
    : { onNavigation: () => {}, destroy: () => {} };

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
      clearEarlyCanvas();
      clearAdaptivePass();
      return;
    }
    runAdaptiveSubtreePasses(roots, resolved);
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
        clearEarlyCanvas();
        persistGlobalToneCanvas(resolved);
        clearAdaptivePass();
        stopLinkShimmer();
        return;
      }
      injectStyle(buildCss(resolved, sample));
      persistEarlyCanvasFromDocument();
      persistGlobalToneCanvas(resolved);
    },
    // Covers routers that mutate the route without invoking the History APIs
    // patched below. Run a full pass after its new DOM has had a chance to
    // paint instead of retaining the prior route's identity sample.
    onNavigation: layoutAndSpa.onNavigation,
  });
  const stopFlyoutAnalysis = startFlyoutController((roots) => {
    const resolved = store.getResolvedStateForHost(hostname);
    if (!(active && resolved.enabled !== false)) return;
    stampVisibleFlyouts(roots);
    // Collapsed rails (Instagram) often expand a static sheet via hover /
    // inline style — not an absolute flyout panel. Re-seed opaque sheets
    // under the interaction host so white fills get surface paint.
    for (const root of roots || []) {
      let host = root;
      for (let i = 0; i < 8 && host; i += 1) {
        const rect = host.getBoundingClientRect?.();
        if (rect && rect.height >= 240 && rect.width >= 120) {
          seedPageSheets(host);
          stampOpaquePaintTargets(host);
          assignToneSteps(host);
          break;
        }
        host = host.parentElement;
      }
    }
  });

  let reapplyTimer = 0;
  const scheduleReapply = () => {
    if (!active || reapplyTimer) return;
    reapplyTimer = window.setTimeout(() => {
      reapplyTimer = 0;
      reapply();
    }, 32);
  };
  const unsubscribe = store.subscribe(scheduleReapply);

  let tornDown = false;
  const teardown = () => {
    if (tornDown) return;
    tornDown = true;
    active = false;
    window.removeEventListener('pagehide', teardown);
    unsubscribe();
    stopObserving();
    stopFlyoutAnalysis();
    if (mutationTimer) window.clearTimeout(mutationTimer);
    if (reapplyTimer) window.clearTimeout(reapplyTimer);
    if (delayedShadowTimer) window.clearTimeout(delayedShadowTimer);
    queuedRoots = [];
    layoutAndSpa.destroy();
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
export function watchLayoutAndSpa(reapply, layout) {
  let destroyed = false;
  const scheduleLayoutResample = () => {
    if (destroyed) return;
    clearTimeout(layout.getTimer());
    layout.setTimer(
      window.setTimeout(() => {
        if (destroyed) return;
        const next = layoutKey();
        if (next === layout.getLastKey()) return;
        layout.setLastKey(next);
        reapply();
      }, LAYOUT_RESAMPLE_DEBOUNCE_MS)
    );
  };

  window.addEventListener('resize', scheduleLayoutResample, { passive: true });

  let routeTimer = 0;
  let routeGeneration = 0;
  let lastHref = globalThis.location?.href ?? '';
  const onSpaNav = () => {
    if (destroyed) return;
    const nextHref = globalThis.location?.href ?? '';
    const documentNav = isDocumentNavigation(lastHref, nextHref);
    lastHref = nextHref;
    if (!documentNav) return;
    const generation = ++routeGeneration;
    clearTimeout(routeTimer);
    routeTimer = window.setTimeout(() => {
      void waitForPageSettle().then(() => {
        if (!destroyed && generation === routeGeneration) reapply();
      });
    }, SPA_ROUTE_DEBOUNCE_MS);
  };
  window.addEventListener('popstate', onSpaNav);
  window.addEventListener('hashchange', onSpaNav);

  const originalPush = history.pushState;
  const originalReplace = history.replaceState;
  const historyPushPatched = function pushStatePatched(...args) {
    const result = originalPush.apply(this, args);
    onSpaNav();
    return result;
  };
  const historyReplacePatched = function replaceStatePatched(...args) {
    const result = originalReplace.apply(this, args);
    onSpaNav();
    return result;
  };
  history.pushState = historyPushPatched;
  history.replaceState = historyReplacePatched;

  return {
    onNavigation: onSpaNav,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      routeGeneration += 1;
      window.removeEventListener('resize', scheduleLayoutResample);
      window.removeEventListener('popstate', onSpaNav);
      window.removeEventListener('hashchange', onSpaNav);
      clearTimeout(layout.getTimer());
      layout.setTimer(0);
      clearTimeout(routeTimer);
      routeTimer = 0;
      if (history.pushState === historyPushPatched) history.pushState = originalPush;
      if (history.replaceState === historyReplacePatched) history.replaceState = originalReplace;
    },
  };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  main();
}
