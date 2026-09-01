/** Shared runtime message types (keep this file free of DOM/Lit deps). */
export const MSG_TOGGLE_SETTINGS = 'GMIXER_TOGGLE_SETTINGS';
export const MSG_OPEN_SETTINGS = 'GMIXER_OPEN_SETTINGS';
export const MSG_TOGGLE_SITE = 'GMIXER_TOGGLE_SITE';
export const MSG_OPEN_WALKTHROUGH = 'GMIXER_OPEN_WALKTHROUGH';
/** Debug-only: extension page asks the service worker to snapshot a tab. */
export const MSG_DEBUG_INSPECT_TAB = 'GMIXER_DEBUG_INSPECT_TAB';
/** Debug-only: service worker asks the content script for live surfaces. */
export const MSG_DEBUG_INSPECT_SURFACES = 'GMIXER_DEBUG_INSPECT_SURFACES';
/** Debug-only: open the live-surface inspector for the sender tab. */
export const MSG_DEBUG_OPEN_SURFACES = 'GMIXER_DEBUG_OPEN_SURFACES';
