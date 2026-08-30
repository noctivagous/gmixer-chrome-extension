/** Close the page-level Popover that hosts this UI iframe. */
export function closeHostPopover() {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ source: 'gmixer-ui', type: 'close' }, '*');
  }
}

/**
 * Ask the content-script host to switch shells (closes this UI, opens the other).
 * @param {'side-panel' | 'walkthrough-modal'} shell
 */
export function requestShellSwitch(shell) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ source: 'gmixer-ui', type: 'switch-shell', shell }, '*');
  }
}
