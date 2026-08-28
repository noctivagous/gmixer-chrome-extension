// Master theming enable for whether gMixer paints pages.
// Shared by the titlebar switch and the Alt+N shortcut. Stored on
// global.enabled so every open tab stays in lockstep.

import { store } from './store.js';

/**
 * Titlebar / Alt+N master: theming allowed on this device.
 * @returns {boolean}
 */
export function isMasterThemingEnabled() {
  return store.getState()?.global?.enabled !== false;
}

/**
 * Flip master theming for all tabs / hosts.
 * @returns {Promise<boolean>} the new enabled state
 */
export async function toggleSiteTheming() {
  await store.ready;
  const next = !isMasterThemingEnabled();
  await store.update({ enabled: next });
  return next;
}
