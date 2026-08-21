// Service worker: toolbar click + Alt+M open the in-page settings popover.
import { MSG_TOGGLE_SETTINGS } from './messaging/messages.js';

async function toggleSettingsInActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  if (tab.url && /^(chrome|opera|about|edge|devtools|chrome-extension):/i.test(tab.url)) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: MSG_TOGGLE_SETTINGS });
  } catch {
    // Content script may not be injected yet — ignore.
  }
}

chrome.action.onClicked.addListener(() => {
  toggleSettingsInActiveTab();
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-settings') {
    toggleSettingsInActiveTab();
  }
});
