// Debounce windows for "the page changed enough to resample identity colors."
// History/hash/popstate should feel snappy; resize/layout coalesces further
// because those events fire continuously while the user drags.

/** History API / hash / mutation-observed URL change → full resample. */
export const SPA_ROUTE_DEBOUNCE_MS = 100;

/** Viewport or document height change → full resample. */
export const LAYOUT_RESAMPLE_DEBOUNCE_MS = 400;
