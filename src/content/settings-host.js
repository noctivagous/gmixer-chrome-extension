// In-page Settings host: native Popover API + backdrop blur.
// Toolbar / Alt+M only toggle this; the Lit UI mounts inside the popover.
//
// The Custom Elements polyfill patches core DOM methods and scans the
// document. Keep it, and the Lit UI bundle, out of the normal page-load path.
// They are loaded only when the user actually opens Settings.

import { GRID, GRID_CSS_VARS } from '../settings/tokens.js';
import { ensureDocumentFontFaces } from '../lib/font-faces.js';
import { MSG_TOGGLE_SETTINGS } from '../messaging/messages.js';

export const SETTINGS_POPOVER_ID = 'gmixer-settings';
export { MSG_TOGGLE_SETTINGS };

const HOST_STYLE_ID = 'gmixer-settings-host-style';
let settingsUiPromise;

function loadSettingsUi() {
  if (!settingsUiPromise) {
    settingsUiPromise = Promise.all([
      import('@webcomponents/custom-elements'),
      import('lit/polyfill-support.js'),
    ]).then(() => import('../settings/settings-entry.js'));
  }
  return settingsUiPromise;
}

function ensureHostStyles() {
  if (document.getElementById(HOST_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HOST_STYLE_ID;
  style.textContent = `
    #${SETTINGS_POPOVER_ID} {
      ${GRID_CSS_VARS}
      box-sizing: border-box;
      width: min(${GRID.panelWidth}px, calc(100vw - ${GRID.panelMaxInset}px));
      height: min(${GRID.panelHeight}px, calc(100vh - ${GRID.panelMaxInset}px));
      max-width: calc(100vw - ${GRID.panelMaxInset}px);
      max-height: calc(100vh - ${GRID.panelMaxInset}px);
      margin: auto;
      border: 1px solid var(--gm-border);
      border-radius: var(--gm-space-2);
      padding: 0;
      overflow: hidden;
      background: var(--gm-bg);
      color: var(--gm-text);
      font: 13px/var(--gm-line) system-ui, sans-serif;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.55);
      inset: 0;
    }

    #${SETTINGS_POPOVER_ID}:popover-open {
      display: flex;
      flex-direction: column;
    }

    #${SETTINGS_POPOVER_ID}::backdrop {
      background: rgba(8, 6, 14, 0.45);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    #${SETTINGS_POPOVER_ID} gmixer-settings {
      display: flex;
      flex: 1;
      min-height: 0;
      width: 100%;
      height: 100%;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

/** @returns {Promise<HTMLElement>} */
export async function ensureSettingsPopover() {
  await loadSettingsUi();
  ensureHostStyles();
  ensureDocumentFontFaces();

  let el = document.getElementById(SETTINGS_POPOVER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = SETTINGS_POPOVER_ID;
    el.setAttribute('popover', 'manual');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'gMixer Settings');
    el.appendChild(document.createElement('gmixer-settings'));
    document.documentElement.appendChild(el);
  }
  return el;
}

export async function openSettingsPopover() {
  const el = await ensureSettingsPopover();
  if (typeof el.showPopover === 'function' && !el.matches(':popover-open')) {
    el.showPopover();
  }
  return el;
}

export function closeSettingsPopover() {
  const el = document.getElementById(SETTINGS_POPOVER_ID);
  if (el && typeof el.hidePopover === 'function' && el.matches(':popover-open')) {
    el.hidePopover();
  }
}

export async function toggleSettingsPopover() {
  const el = await ensureSettingsPopover();
  if (el.matches(':popover-open')) {
    el.hidePopover();
    return false;
  }
  el.showPopover();
  return true;
}

function isTypingTarget(target) {
  if (!target || target.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
}

async function onKeyDown(e) {
  if (!(e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey)) return;
  if (e.key !== 'm' && e.key !== 'M') return;
  if (isTypingTarget(e.target)) return;
  e.preventDefault();
  e.stopPropagation();
  await toggleSettingsPopover();
}

function onRuntimeMessage(message, _sender, sendResponse) {
  if (message?.type !== MSG_TOGGLE_SETTINGS) return;
  toggleSettingsPopover()
    .then((open) => sendResponse({ ok: true, open }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true;
}

/** Call once from content-end. */
export function initSettingsHost() {
  document.addEventListener('keydown', onKeyDown, true);
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(onRuntimeMessage);
  }
}
