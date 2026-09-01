import { walkthroughLayoutMessage } from './walkthrough-frame-layout.js';

function postToHost(data) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(data, '*');
  }
}

/** Close the page-level Popover that hosts this UI iframe. */
export function closeHostPopover() {
  postToHost({ source: 'gmixer-ui', type: 'close' });
}

/**
 * Ask the host to match the walkthrough iframe box to the inner panel.
 * @param {'panel'|'completion'} layout
 * @param {{ width?: number, height?: number }|null} [metrics]
 */
export function notifyHostLayout(layout, metrics = null) {
  postToHost(walkthroughLayoutMessage(layout, metrics));
}

/**
 * Ask the content-script host to switch shells (closes this UI, opens the other).
 * @param {'side-panel' | 'walkthrough-modal'} shell
 */
export function requestShellSwitch(shell) {
  postToHost({ source: 'gmixer-ui', type: 'switch-shell', shell });
}
