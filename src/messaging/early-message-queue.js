import {
  MSG_OPEN_SETTINGS,
  MSG_OPEN_WALKTHROUGH,
  MSG_TOGGLE_SETTINGS,
  MSG_TOGGLE_SITE,
} from './messages.js';

const QUEUEABLE_TYPES = new Set([
  MSG_TOGGLE_SETTINGS,
  MSG_TOGGLE_SITE,
  MSG_OPEN_SETTINGS,
  MSG_OPEN_WALKTHROUGH,
]);

const QUEUE_KEY = '__gmixerPendingRuntimeMessages';
const READY_KEY = '__gmixerSettingsHostReady';

function pendingQueue() {
  if (!Array.isArray(globalThis[QUEUE_KEY])) globalThis[QUEUE_KEY] = [];
  return globalThis[QUEUE_KEY];
}

/**
 * Accept toolbar/command messages during document_start. The full handler
 * lives in content-end because opening Settings needs the lazy Lit bundle.
 */
export function installEarlyMessageQueue() {
  try {
    if (typeof chrome === 'undefined' || !chrome.runtime?.onMessage) return;
    chrome.runtime.onMessage.addListener((message) => {
      if (globalThis[READY_KEY]) return;
      if (QUEUEABLE_TYPES.has(message?.type)) {
        pendingQueue().push(message.type);
      }
    });
  } catch {
    // A stale content script can outlive an extension reload briefly.
  }
}

/** @returns {string[]} */
export function drainEarlyMessageQueue() {
  const queued = pendingQueue().splice(0);
  globalThis[READY_KEY] = true;
  return queued;
}
