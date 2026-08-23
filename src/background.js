// Service worker: toolbar click + Alt+M open Settings; Alt+N toggles site theming.
import { MSG_TOGGLE_SETTINGS, MSG_TOGGLE_SITE } from './messaging/messages.js';

async function sendToActiveTab(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  if (tab.url && /^(chrome|opera|about|edge|devtools|chrome-extension):/i.test(tab.url)) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type });
  } catch {
    // Content script may not be injected yet — ignore.
  }
}

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
