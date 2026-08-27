// In-page Settings host: native Popover API as a left slide-out panel.
// Toolbar / Alt+M toggle this; Alt+N toggles per-site theming (titlebar switch).
// The Lit UI mounts inside the popover.
//
// The Custom Elements polyfill patches core DOM methods and scans the
// document. Keep it, and the Lit UI bundle, out of the normal page-load path.
// They are loaded only when the user actually opens Settings.
//
// Open/closed + settings UI state are store-backed so every tab stays in sync:
// opening the panel on one tab opens it on the others; accordion, scroll, and
// setting changes propagate through chrome.storage.

import { GRID, GRID_CSS_VARS } from '../settings/tokens.js';
import { ensureDocumentFontFaces } from '../lib/font-faces.js';
import {
  MSG_TOGGLE_SETTINGS,
  MSG_TOGGLE_SITE,
  MSG_OPEN_WALKTHROUGH,
} from '../messaging/messages.js';
import { drainEarlyMessageQueue } from '../messaging/early-message-queue.js';
import { toggleSiteTheming } from '../state/site-enable.js';
import { createDefaultState } from '../state/schema.js';
import { store } from '../state/store.js';

export const SETTINGS_POPOVER_ID = 'gmixer-settings';
export const WALKTHROUGH_POPOVER_ID = 'gmixer-walkthrough-host';
export { MSG_TOGGLE_SETTINGS, MSG_TOGGLE_SITE };

const HOST_STYLE_ID = 'gmixer-settings-host-style';
let settingsUiPromise;
let walkthroughUiPromise;
/** @type {(() => void) | null} */
let unsubscribeStore = null;

function loadSettingsUi() {
  if (!settingsUiPromise) {
    settingsUiPromise = Promise.all([
      import('@webcomponents/custom-elements'),
      import('lit/polyfill-support.js'),
    ]).then(() => import('../settings/settings-entry.js'));
  }
  return settingsUiPromise;
}

function loadWalkthroughUi() {
  if (!walkthroughUiPromise) {
    walkthroughUiPromise = Promise.all([
      import('@webcomponents/custom-elements'),
      import('lit/polyfill-support.js'),
    ]).then(() => import('../settings/components/gmixer-walkthrough.js'));
  }
  return walkthroughUiPromise;
}

async function persistSettingsOpen(open) {
  try {
    await store.ready;
    const current = store.getState()?.global?.ui?.settingsOpen;
    if (current === open) return;
    await store.update({ ui: { settingsOpen: open } });
  } catch {
    // Stale extension context after reload — ignore.
  }
}

function ensureHostStyles() {
  if (document.getElementById(HOST_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = HOST_STYLE_ID;
  style.textContent = `
    #${SETTINGS_POPOVER_ID} {
      ${GRID_CSS_VARS}
      box-sizing: border-box;
      position: fixed;
      inset: 0 auto 0 0;
      margin: 0;
      width: min(${GRID.panelWidth}px, calc(100vw - ${GRID.panelPagePeek}px));
      height: 100vh;
      height: 100dvh;
      max-width: calc(100vw - ${GRID.panelPagePeek}px);
      max-height: none;
      border: 0;
      border-right: 1px solid var(--gm-border);
      border-radius: 0;
      padding: 0;
      overflow: hidden;
      background: var(--gm-bg);
      color: var(--gm-text);
      font: 13px/var(--gm-line) system-ui, sans-serif;
      box-shadow: 8px 0 32px rgba(0, 0, 0, 0.35);
      transform: translateX(-100%);
      transition:
        transform 280ms cubic-bezier(0.32, 0.72, 0, 1),
        overlay 280ms allow-discrete,
        display 280ms allow-discrete;
    }

    #${SETTINGS_POPOVER_ID}:popover-open {
      display: flex;
      flex-direction: column;
      transform: translateX(0);
    }

    @starting-style {
      #${SETTINGS_POPOVER_ID}:popover-open {
        transform: translateX(-100%);
      }
    }

    /* Transparent, non-blocking — page stays visible for live theme feedback. */
    #${SETTINGS_POPOVER_ID}::backdrop {
      background: transparent;
      pointer-events: none;
    }

    #${SETTINGS_POPOVER_ID} gmixer-settings {
      display: flex;
      flex: 1;
      min-height: 0;
      width: 100%;
      height: 100%;
    }

    #${WALKTHROUGH_POPOVER_ID} {
      ${GRID_CSS_VARS}
      box-sizing: border-box;
      position: fixed;
      inset: 0;
      margin: auto;
      width: fit-content;
      height: fit-content;
      max-width: 90vw;
      max-height: 90vh;
      border: 0;
      padding: 0;
      overflow: visible;
      background: transparent;
      color: var(--gm-text);
      box-shadow: none;
      opacity: 0;
      transform: scale(0.95);
      transition:
        opacity 200ms ease,
        transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1),
        overlay 200ms allow-discrete,
        display 200ms allow-discrete;
    }

    #${WALKTHROUGH_POPOVER_ID}:popover-open {
      display: flex;
      flex-direction: column;
      opacity: 1;
      transform: scale(1);
    }

    @starting-style {
      #${WALKTHROUGH_POPOVER_ID}:popover-open {
        opacity: 0;
        transform: scale(0.95);
      }
    }

    #${WALKTHROUGH_POPOVER_ID}::backdrop {
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      pointer-events: auto;
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

/** @returns {Promise<HTMLElement>} */
export async function ensureWalkthroughPopover() {
  await loadWalkthroughUi();
  ensureHostStyles();
  ensureDocumentFontFaces();

  let el = document.getElementById(WALKTHROUGH_POPOVER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = WALKTHROUGH_POPOVER_ID;
    el.setAttribute('popover', 'manual');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'gMixer Walkthrough');
    el.appendChild(document.createElement('gmixer-walkthrough'));
    document.documentElement.appendChild(el);
  }
  return el;
}

export async function openWalkthroughPopover() {
  const el = await ensureWalkthroughPopover();
  const walkthrough = el.querySelector('gmixer-walkthrough');
  if (walkthrough) walkthrough.currentSlide = 0;
  if (typeof el.showPopover === 'function' && !el.matches(':popover-open')) {
    el.showPopover();
  }
  return el;
}

/**
 * Apply the blank User-Made baseline exactly once before onboarding begins.
 * Reloading an unpacked extension can retain chrome.storage, so new
 * walkthrough state must not inherit a prior theme’s fonts or color choices.
 */
async function initializeWalkthrough() {
  const state = store.getState();
  if (state?.global?.ui?.walkthroughInitialized) return;

  const baseline = createDefaultState().global;
  await store.update({
    ...baseline,
    ui: {
      ...baseline.ui,
      walkthroughInitialized: true,
      walkthroughCompleted: false,
    },
  });
}

/**
 * Apply popover visibility to match store state without writing storage.
 * Used for cross-tab follow and for the local DOM side of open/close.
 * @param {boolean} open
 */
async function applySettingsOpenDom(open) {
  if (open) {
    const el = await ensureSettingsPopover();
    if (typeof el.showPopover === 'function' && !el.matches(':popover-open')) {
      el.showPopover();
    }
    return;
  }
  const el = document.getElementById(SETTINGS_POPOVER_ID);
  if (el && typeof el.hidePopover === 'function' && el.matches(':popover-open')) {
    el.hidePopover();
  }
}

function isPopoverOpen() {
  const el = document.getElementById(SETTINGS_POPOVER_ID);
  return !!el?.matches?.(':popover-open');
}

/**
 * Keep this tab's popover aligned with store.ui.settingsOpen (other tabs,
 * reload restore, and local toggles all flow through the store).
 * @param {ReturnType<typeof store.getState>} state
 */
function syncPopoverFromStore(state) {
  const wantOpen = !!state?.global?.ui?.settingsOpen;
  const isOpen = isPopoverOpen();
  if (wantOpen === isOpen) {
    // Closed and never mounted — nothing to do.
    if (!wantOpen) return;
    // Want open but element missing (first remote open on this tab).
    if (!document.getElementById(SETTINGS_POPOVER_ID)) {
      void applySettingsOpenDom(true);
    }
    return;
  }
  void applySettingsOpenDom(wantOpen);
}

export async function openSettingsPopover() {
  await applySettingsOpenDom(true);
  await persistSettingsOpen(true);
  return document.getElementById(SETTINGS_POPOVER_ID);
}

export async function closeSettingsPopover() {
  await applySettingsOpenDom(false);
  await persistSettingsOpen(false);
}

export async function toggleSettingsPopover() {
  if (isPopoverOpen()) {
    await closeSettingsPopover();
    return false;
  }
  await openSettingsPopover();
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
  if (isTypingTarget(e.target)) return;

  const key = e.key?.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === 'm') {
    e.preventDefault();
    e.stopPropagation();
    await toggleSettingsPopover();
    return;
  }
  if (key === 'n') {
    e.preventDefault();
    e.stopPropagation();
    await toggleSiteTheming();
  }
}

function onRuntimeMessage(message, _sender, sendResponse) {
  if (message?.type === MSG_TOGGLE_SETTINGS) {
    toggleSettingsPopover()
      .then((open) => sendResponse({ ok: true, open }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (message?.type === MSG_TOGGLE_SITE) {
    toggleSiteTheming()
      .then((enabled) => sendResponse({ ok: true, enabled }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (message?.type === MSG_OPEN_WALKTHROUGH) {
    openWalkthroughPopover()
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
}

/** Call once from content-end. */
export function initSettingsHost() {
  document.addEventListener('keydown', onKeyDown, true);
  try {
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(onRuntimeMessage);
    }
  } catch {
    // A content script may remain briefly after the extension is reloaded.
  }
  for (const type of drainEarlyMessageQueue()) {
    void onRuntimeMessage({ type }, null, () => {});
  }

  store.ready
    .then(() => {
      unsubscribeStore?.();
      unsubscribeStore = store.subscribe(syncPopoverFromStore);
      
      const state = store.getState();
      // Align with persisted open state (reload + already-open other tabs).
      syncPopoverFromStore(state);

      // Trigger walkthrough if not completed and not in a frame.
      if (!state?.global?.ui?.walkthroughCompleted && window === window.top) {
        void initializeWalkthrough().then(() => openWalkthroughPopover());
      }
    })
    .catch(() => {});
}
