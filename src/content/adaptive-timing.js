// Debounce windows for "the page changed enough to resample identity colors."
// History/hash/popstate should feel snappy; resize/layout coalesces further
// because those events fire continuously while the user drags.
//
// Prefer generic URL/size/tag heuristics over host-specific branches.
// Do not special-case mail.google.com (or any other hostname) here.

/** History API / mutation-observed path change → full resample. */
export const SPA_ROUTE_DEBOUNCE_MS = 100;

/** Viewport or document height change → full resample. */
export const LAYOUT_RESAMPLE_DEBOUNCE_MS = 400;

/**
 * Cap for the first post-document_end settle. Double-rAF usually wins first;
 * this only matters when rAF is missing or a frame is stalled.
 */
export const PAGE_SETTLE_TIMEOUT_MS = 80;

/**
 * requestIdleCallback timeout for the first adaptive pass. The previous
 * 1500ms ceiling left whitespot/classification unpainted on busy pages.
 * Double-rAF already waited for a static-theme paint, so a short idle
 * window is enough to yield once without a visible flash.
 */
export const ADAPTIVE_IDLE_TIMEOUT_MS = 120;

/**
 * Yield once after settle, but never wait the old 1500ms flash window.
 *
 * @param {() => void} callback
 * @param {{ requestIdleCallback?: Function, setTimeout?: Function }} [clock]
 * @returns {number}
 */
export function scheduleFirstAdaptivePass(callback, clock = globalThis) {
  if (typeof clock.requestIdleCallback === 'function') {
    return clock.requestIdleCallback(callback, { timeout: ADAPTIVE_IDLE_TIMEOUT_MS });
  }
  return clock.setTimeout(callback, 0);
}

/**
 * Named timeline breadcrumb for the static→adaptive paint gap.
 * Marks always land on the content-script performance timeline; console
 * lines are debug-build only so production stays quiet.
 *
 * @param {string} name
 */
export function markThemePhase(name) {
  try {
    performance.mark(name);
  } catch {
    /* performance.mark can throw in some worker/test shims */
  }
  if (typeof __GMIXER_DEBUG__ !== 'undefined' && __GMIXER_DEBUG__) {
    console.info('[gmixer-timing]', name, `${Math.round(performance.now())}ms`);
  }
}

/**
 * Coalesce MutationObserver subtree work. Heavy SPAs inject many sibling
 * batches per turn; a microtask flush per batch restyles the tab.
 */
export const MUTATION_DEBOUNCE_MS = 160;

/**
 * True when origin/path/search changed. Hash-only swaps stay on the same
 * document (same chrome, same identity sample) so incremental classify
 * is enough — a full removeStyle + resample forces layout on any
 * hash-routed app.
 *
 * @param {string} fromHref
 * @param {string} toHref
 * @returns {boolean}
 */
export function isDocumentNavigation(fromHref, toHref) {
  if (!fromHref || !toHref || fromHref === toHref) return false;
  try {
    const from = new URL(fromHref, 'https://gmixer.invalid/');
    const to = new URL(toHref, 'https://gmixer.invalid/');
    return from.origin !== to.origin || from.pathname !== to.pathname || from.search !== to.search;
  } catch {
    return String(fromHref).split('#')[0] !== String(toHref).split('#')[0];
  }
}
