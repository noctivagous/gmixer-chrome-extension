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
 * Coalesce MutationObserver subtree work. Heavy SPAs inject many sibling
 * batches per turn; a microtask flush per batch restyles the tab.
 */
export const MUTATION_DEBOUNCE_MS = 64;

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
