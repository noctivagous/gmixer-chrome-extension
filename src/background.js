// Service worker: toolbar click + Alt+M open Settings; Alt+N toggles site theming.
// Right-click context menus open Settings or Walkthrough on the clicked tab.
import {
  MSG_OPEN_SETTINGS,
  MSG_OPEN_WALKTHROUGH,
  MSG_TOGGLE_SETTINGS,
  MSG_TOGGLE_SITE,
} from './messaging/messages.js';

const MENU_OPEN_SETTINGS = 'gmixer-open-settings';
const MENU_OPEN_WALKTHROUGH = 'gmixer-open-walkthrough';

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
}

chrome.runtime.onInstalled.addListener(() => {
  void ensureContextMenus();
});

// Service workers can restart without onInstalled; recreate menus on boot.
void ensureContextMenus();
void enableSessionCacheForContentScripts();

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId === MENU_OPEN_SETTINGS) {
    void sendToTab(tab.id, MSG_OPEN_SETTINGS, tab.url);
  } else if (info.menuItemId === MENU_OPEN_WALKTHROUGH) {
    void sendToTab(tab.id, MSG_OPEN_WALKTHROUGH, tab.url);
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
