// Service worker: toolbar click + Alt+M open Settings; Alt+N toggles site theming.
// Right-click context menus open Settings or Walkthrough on the clicked tab.
import {
  MSG_DEBUG_INSPECT_SURFACES,
  MSG_DEBUG_INSPECT_TAB,
  MSG_DEBUG_OPEN_SURFACES,
  MSG_OPEN_SETTINGS,
  MSG_OPEN_WALKTHROUGH,
  MSG_TOGGLE_SETTINGS,
  MSG_TOGGLE_SITE,
} from './messaging/messages.js';

const MENU_OPEN_SETTINGS = 'gmixer-open-settings';
const MENU_OPEN_WALKTHROUGH = 'gmixer-open-walkthrough';
const MENU_INSPECT_SURFACES = 'gmixer-inspect-surfaces';
const DEBUG_ENABLED = typeof __GMIXER_DEBUG__ !== 'undefined' && !!__GMIXER_DEBUG__;

// Content scripts are untrusted extension contexts. Explicitly expose the
// session CSS cache so document_start can read it without waiting for settings.
// The session bucket only stores generated CSS text plus a fingerprint of the
// resolved theme (see css-cache.js) — never per-site settings or credentials.
async function enableSessionCacheForContentScripts() {
  try {
    await chrome.storage.session.setAccessLevel({
      accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS',
    });
  } catch {
    // Older Chromium builds or restricted profiles may not support this.
  }
}

function isRestrictedUrl(url) {
  return !!url && /^(chrome|opera|about|edge|devtools|chrome-extension):/i.test(url);
}

async function sendToTab(tabId, type, tabUrl) {
  if (!tabId || isRestrictedUrl(tabUrl)) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type });
  } catch {
    // Content script may not be injected yet — ignore.
  }
}

async function sendToActiveTab(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  await sendToTab(tab.id, type, tab.url);
}

async function ensureContextMenus() {
  if (!chrome.contextMenus) return;
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: MENU_OPEN_SETTINGS,
    title: 'Open gMixer Settings',
    contexts: ['page', 'selection', 'image', 'video', 'link'],
  });
  chrome.contextMenus.create({
    id: MENU_OPEN_WALKTHROUGH,
    title: 'Open gMixer Walkthrough',
    contexts: ['page', 'selection', 'image', 'video', 'link'],
  });
  if (DEBUG_ENABLED) {
    chrome.contextMenus.create({
      id: MENU_INSPECT_SURFACES,
      title: 'Inspect live gMixer surfaces',
      contexts: ['page', 'selection', 'image', 'video', 'link'],
    });
  }
}

function debugSurfacesUrl(tabId) {
  const url = chrome.runtime.getURL('debug-surfaces.html');
  return tabId ? `${url}?tab=${tabId}` : url;
}

async function openSurfaceInspector(tabId) {
  await chrome.tabs.create({ url: debugSurfacesUrl(tabId) });
}

function isDebugSurfacesTab(tab) {
  const pageUrl = chrome.runtime.getURL('debug-surfaces.html');
  return !!tab?.url?.startsWith(pageUrl);
}

async function resolveInspectTabId(requestedId, senderTabId) {
  const parsed = Number(requestedId);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  if (senderTabId) return senderTabId;
  const tabs = await chrome.tabs.query({ lastFocusedWindow: true });
  const page = tabs.find(
    (tab) => tab.id && !isRestrictedUrl(tab.url) && !isDebugSurfacesTab(tab)
  );
  return page?.id ?? null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!DEBUG_ENABLED) return undefined;
  if (message?.type === MSG_DEBUG_OPEN_SURFACES) {
    void openSurfaceInspector(sender.tab?.id).then(
      () => sendResponse({ ok: true }),
      (err) => sendResponse({ ok: false, error: String(err) })
    );
    return true;
  }
  if (message?.type === MSG_DEBUG_INSPECT_TAB) {
    void (async () => {
      const tabId = await resolveInspectTabId(message.tabId, sender.tab?.id);
      if (!tabId) {
        return {
          ok: false,
          error: 'No inspectable tab. Focus a web page, then refresh this inspector.',
        };
      }
      try {
        const tab = await chrome.tabs.get(tabId).catch(() => null);
        const result = await chrome.tabs.sendMessage(tabId, {
          type: MSG_DEBUG_INSPECT_SURFACES,
        });
        if (!result || result.ok === false) {
          return {
            ok: false,
            tabId,
            tabUrl: tab?.url || '',
            tabTitle: tab?.title || '',
            error:
              result?.error ||
              'This tab has no debug API. Reload the extension after npm run build:debug, then reload the page.',
          };
        }
        return {
          ok: true,
          tabId,
          tabUrl: tab?.url || '',
          tabTitle: tab?.title || '',
          surfaces: result.surfaces || null,
        };
      } catch (err) {
        return {
          ok: false,
          tabId,
          error:
            'Could not read this tab. Use a debug build (npm run build:debug), reload the extension, then reload the page.',
          detail: String(err),
        };
      }
    })().then(sendResponse);
    return true;
  }
  return undefined;
});

chrome.runtime.onInstalled.addListener(() => {
  void ensureContextMenus();
});

// Service workers can restart without onInstalled; recreate menus on boot.
void ensureContextMenus();
void enableSessionCacheForContentScripts().then(async () => {
  // Warm the session bucket with the last-known tone canvas so document_start
  // on a new origin can hydrate without waiting on local storage.
  try {
    const key = 'gmixer_tone_canvas';
    const local = await chrome.storage.local.get(key);
    if (local[key]) await chrome.storage.session.set({ [key]: local[key] });
  } catch {
    /* ignore */
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === MENU_OPEN_SETTINGS) {
    void sendToTab(tab.id, MSG_OPEN_SETTINGS, tab.url);
  } else if (info.menuItemId === MENU_OPEN_WALKTHROUGH) {
    void sendToTab(tab.id, MSG_OPEN_WALKTHROUGH, tab.url);
  } else if (DEBUG_ENABLED && info.menuItemId === MENU_INSPECT_SURFACES) {
    void openSurfaceInspector(tab.id);
  }
});

chrome.action.onClicked.addListener(() => {
  sendToActiveTab(MSG_TOGGLE_SETTINGS);
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-settings') {
    sendToActiveTab(MSG_TOGGLE_SETTINGS);
  } else if (command === 'toggle-site') {
    sendToActiveTab(MSG_TOGGLE_SITE);
  }
});
