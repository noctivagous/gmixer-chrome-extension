// Per-hostname master for whether gMixer theming applies on this page.
// Shared by the titlebar switch and the Alt+N shortcut.

import { store } from './store.js';

/**
 * @param {string} [hostname]
 * @returns {boolean}
 */
export function isSiteThemingEnabled(hostname = typeof location !== 'undefined' ? location.hostname : '') {
  if (!hostname) return true;
  const override = store.getState().perSite?.[hostname];
  return override?.enabled !== false;
}

/**
 * Flip theming for the current (or given) hostname.
 * @param {string} [hostname]
 * @returns {Promise<boolean>} the new enabled state
 */
export async function toggleSiteTheming(hostname = typeof location !== 'undefined' ? location.hostname : '') {
  await store.ready;
  if (!hostname) return true;
  const next = !isSiteThemingEnabled(hostname);
  await store.update({ enabled: next }, { hostname });
  return next;
}
