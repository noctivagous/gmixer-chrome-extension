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
  MSG_OPEN_SETTINGS,
  MSG_TOGGLE_SITE,
  MSG_OPEN_WALKTHROUGH,
} from '../messaging/messages.js';
import { drainEarlyMessageQueue } from '../messaging/early-message-queue.js';
import { toggleSiteTheming } from '../state/site-enable.js';
import { createDefaultState } from '../state/schema.js';
import { store } from '../state/store.js';
import { isTypingContext } from './clickable-detector.js';

export const SETTINGS_POPOVER_ID = 'gmixer-settings';
export const WALKTHROUGH_POPOVER_ID = 'gmixer-walkthrough-host';
export { MSG_TOGGLE_SETTINGS, MSG_TOGGLE_SITE };

const HOST_STYLE_ID = 'gmixer-settings-host-style';
const SETTINGS_FRAME = 'settings-frame.html';
const WALKTHROUGH_FRAME = 'walkthrough-frame.html';
/** @type {(() => void) | null} */
let unsubscribeStore = null;

function frameSrc(file) {
  try {
    return chrome.runtime.getURL(file);
  } catch {
    return file;
  }
}

function ensureUiFrame(el, file) {
  let iframe = el.querySelector('iframe.gmixer-ui-frame');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.className = 'gmixer-ui-frame';
    iframe.src = frameSrc(file);
    iframe.title = el.getAttribute('aria-label') || 'gMixer';
    el.appendChild(iframe);
  }
  return iframe;
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
      all: revert;
      ${GRID_CSS_VARS}
      box-sizing: border-box !important;
      position: fixed !important;
      inset: 0 auto 0 0 !important;
      margin: 0 !important;
      width: min(${GRID.panelWidth}px, calc(100vw - ${GRID.panelPagePeek}px)) !important;
      height: 100vh !important;
      height: 100dvh !important;
      max-width: calc(100vw - ${GRID.panelPagePeek}px) !important;
      max-height: none !important;
      border: 0 !important;
      border-right: 1px solid var(--gm-border) !important;
      border-radius: 0 !important;
      padding: 0 !important;
      overflow: hidden !important;
      background: var(--gm-bg) !important;
      color: var(--gm-text) !important;
      font: 13px/var(--gm-line) system-ui, sans-serif !important;
      box-shadow: 8px 0 32px rgba(0, 0, 0, 0.35) !important;
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

    #${SETTINGS_POPOVER_ID} iframe.gmixer-ui-frame {
      display: block;
      flex: 1;
      min-height: 0;
      width: 100%;
      height: 100%;
      border: 0;
      background: var(--gm-bg);
    }

    #${WALKTHROUGH_POPOVER_ID} {
      all: revert;
      ${GRID_CSS_VARS}
      box-sizing: border-box !important;
      position: fixed !important;
      inset: 0 !important;
      margin: auto !important;
      width: fit-content !important;
      height: fit-content !important;
      max-width: 90vw !important;
      max-height: 90vh !important;
      border: 0 !important;
      padding: 0 !important;
      overflow: visible !important;
      background: transparent !important;
      color: var(--gm-text) !important;
      box-shadow: none !important;
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

    #${WALKTHROUGH_POPOVER_ID} iframe.gmixer-ui-frame {
      display: block;
      border: 0;
      background: transparent;
      width: min(1120px, calc(90vw + 80px), calc(100vw - 32px));
      height: min(840px, calc(85vh + 80px));
      max-width: 90vw;
      max-height: 90vh;
    }
  `;
  (document.head || document.documentElement).appendChild(style);
}

/** @returns {Promise<HTMLElement>} */
export async function ensureSettingsPopover() {
  ensureHostStyles();
  ensureDocumentFontFaces();

  let el = document.getElementById(SETTINGS_POPOVER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = SETTINGS_POPOVER_ID;
    el.setAttribute('popover', 'manual');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'gMixer Settings');
    document.documentElement.appendChild(el);
  }
  ensureUiFrame(el, SETTINGS_FRAME);
  return el;
}

/** @returns {Promise<HTMLElement>} */
export async function ensureWalkthroughPopover() {
  ensureHostStyles();
  ensureDocumentFontFaces();

  let el = document.getElementById(WALKTHROUGH_POPOVER_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = WALKTHROUGH_POPOVER_ID;
    el.setAttribute('popover', 'manual');
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'gMixer Walkthrough');
    document.documentElement.appendChild(el);
  }
  ensureUiFrame(el, WALKTHROUGH_FRAME);
  return el;
}

export async function closeWalkthroughPopover() {
  const el = document.getElementById(WALKTHROUGH_POPOVER_ID);
  if (el && typeof el.hidePopover === 'function' && el.matches(':popover-open')) {
    el.hidePopover();
  }
}

export async function openWalkthroughPopover() {
  if (isPopoverOpen()) {
    await closeSettingsPopover();
  }
  const el = await ensureWalkthroughPopover();
  const iframe = el.querySelector('iframe.gmixer-ui-frame');
  const reset = () => {
    iframe?.contentWindow?.postMessage({ source: 'gmixer-host', type: 'reset' }, '*');
  };
  if (iframe) {
    iframe.addEventListener('load', reset, { once: true });
    reset();
  }
  if (typeof el.showPopover === 'function' && !el.matches(':popover-open')) {
    el.showPopover();
  }
  focusFirstIn(el);
  return el;
}

/** @param {'side-panel' | 'walkthrough-modal'} shell */
async function persistPreferredShell(shell) {
  try {
    await store.ready;
    const current = store.getState()?.global?.ui?.preferredShell;
    if (current === shell) return;
    await store.update({ ui: { preferredShell: shell } });
  } catch {
    // Stale extension context after reload — ignore.
  }
}

async function markWalkthroughCompleted() {
  try {
    await store.ready;
    if (store.getState()?.global?.ui?.walkthroughCompleted) return;
    await store.update({ ui: { walkthroughCompleted: true } });
  } catch {
    // Stale extension context after reload — ignore.
  }
}

/** @returns {'side-panel' | 'walkthrough-modal'} */
function preferredShellFromStore() {
  const shell = store.getState()?.global?.ui?.preferredShell;
  return shell === 'walkthrough-modal' ? 'walkthrough-modal' : 'side-panel';
}

function walkthroughCompletedFromStore() {
  return !!store.getState()?.global?.ui?.walkthroughCompleted;
}

/**
 * Persist preference and open that shell, closing the other.
 * @param {'side-panel' | 'walkthrough-modal'} shell
 */
export async function switchToShell(shell) {
  await persistPreferredShell(shell);
  if (shell === 'walkthrough-modal') {
    await openWalkthroughPopover();
    return;
  }
  await closeWalkthroughPopover();
  await openSettingsPopover();
}

/** Alt+M / toolbar: honor preferred shell after onboarding. */
export async function togglePreferredShell() {
  if (!walkthroughCompletedFromStore()) {
    return toggleSettingsPopover();
  }

  if (isWalkthroughOpen()) {
    await closeWalkthroughPopover();
    return false;
  }
  if (isPopoverOpen()) {
    await closeSettingsPopover();
    return false;
  }

  const shell = preferredShellFromStore();
  if (shell === 'walkthrough-modal') {
    await openWalkthroughPopover();
    return true;
  }
  await openSettingsPopover();
  return true;
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
    if (isWalkthroughOpen()) {
      await closeWalkthroughPopover();
    }
    const el = await ensureSettingsPopover();
    if (typeof el.showPopover === 'function' && !el.matches(':popover-open')) {
      el.showPopover();
      focusFirstIn(el);
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
  if (isWalkthroughOpen()) {
    await closeWalkthroughPopover();
  }
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

function isWalkthroughOpen() {
  const el = document.getElementById(WALKTHROUGH_POPOVER_ID);
  return !!el?.matches?.(':popover-open');
}

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function firstFocusable(root) {
  if (!root) return null;
  if (root.shadowRoot) {
    const inner = root.shadowRoot.querySelector(FOCUSABLE);
    if (inner) return inner;
  }
  try {
    const light = root.querySelector?.(FOCUSABLE);
    if (light) return light;
  } catch {
    // Invalid selector context in some hosts.
  }
  const tree = root.querySelectorAll?.('*') ?? [];
  for (const child of tree) {
    if (child.shadowRoot) {
      const inner = child.shadowRoot.querySelector(FOCUSABLE);
      if (inner) return inner;
    }
  }
  return null;
}

function focusFirstIn(root) {
  const frame = root.querySelector?.('iframe.gmixer-ui-frame');
  if (frame && typeof frame.focus === 'function') {
    frame.focus();
    return;
  }
  const target = firstFocusable(root);
  if (target && typeof target.focus === 'function') target.focus();
}

function focusablesIn(root) {
  /** @type {HTMLElement[]} */
  const out = [];
  const visit = (node) => {
    if (!node) return;
    if (node.shadowRoot) visit(node.shadowRoot);
    const list = node.querySelectorAll?.(FOCUSABLE);
    if (!list) return;
    for (const el of list) {
      out.push(el);
      if (el.shadowRoot) visit(el.shadowRoot);
    }
  };
  visit(root);
  return out.filter((el) => {
    if (el.disabled || el.getAttribute?.('aria-hidden') === 'true') return false;
    const style = typeof getComputedStyle === 'function' ? getComputedStyle(el) : null;
    return !style || (style.visibility !== 'hidden' && style.display !== 'none');
  });
}

function trapTab(event, root) {
  if (event.key !== 'Tab' || !root) return;
  const items = focusablesIn(root);
  if (items.length === 0) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const activeInside =
    root.contains(active) ||
    items.includes(/** @type {HTMLElement} */ (active));
  if (event.shiftKey) {
    if (!activeInside || active === first) {
      event.preventDefault();
      last.focus();
    }
  } else if (!activeInside || active === last) {
    event.preventDefault();
    first.focus();
  }
}

function isTypingTarget(target) {
  return isTypingContext(target);
}

async function onKeyDown(e) {
  if (e.key === 'Escape') {
    if (isWalkthroughOpen()) {
      e.preventDefault();
      await markWalkthroughCompleted();
      await closeWalkthroughPopover();
      return;
    }
    if (isPopoverOpen()) {
      e.preventDefault();
      await closeSettingsPopover();
      return;
    }
  }

  const activePopover = isWalkthroughOpen()
    ? document.getElementById(WALKTHROUGH_POPOVER_ID)
    : isPopoverOpen()
      ? document.getElementById(SETTINGS_POPOVER_ID)
      : null;
  if (activePopover) {
    trapTab(e, activePopover);
  }

  if (!(e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey)) return;
  if (isTypingTarget(e.target)) return;

  const key = e.key?.length === 1 ? e.key.toLowerCase() : e.key;
  if (key === 'm') {
    e.preventDefault();
    e.stopPropagation();
    await togglePreferredShell();
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
    togglePreferredShell()
      .then((open) => sendResponse({ ok: true, open }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  if (message?.type === MSG_OPEN_SETTINGS) {
    switchToShell('side-panel')
      .then(() => sendResponse({ ok: true, open: true }))
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
    switchToShell('walkthrough-modal')
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
}

function onUiFrameMessage(event) {
  if (event.data?.source !== 'gmixer-ui') return;

  if (event.data.type === 'switch-shell') {
    const shell =
      event.data.shell === 'walkthrough-modal' ? 'walkthrough-modal' : 'side-panel';
    void switchToShell(shell);
    return;
  }

  if (event.data.type !== 'close') return;
  const settings = document.getElementById(SETTINGS_POPOVER_ID);
  const walkthrough = document.getElementById(WALKTHROUGH_POPOVER_ID);
  const fromSettings = settings?.querySelector('iframe')?.contentWindow === event.source;
  const fromWalkthrough = walkthrough?.querySelector('iframe')?.contentWindow === event.source;
  if (fromWalkthrough) {
    void markWalkthroughCompleted();
    walkthrough?.hidePopover?.();
    return;
  }
  if (fromSettings) void closeSettingsPopover();
}

/** Call once from content-end. */
export function initSettingsHost() {
  document.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('message', onUiFrameMessage);
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

      if (!state?.global?.ui?.walkthroughCompleted && window === window.top) {
        void openWalkthroughPopover();
        void initializeWalkthrough();
      }
    })
    .catch((err) => {
      console.warn('[gMixer] settings host failed to initialize', err);
    });
}
