/** Close the page-level Popover that hosts this UI iframe. */
export function closeHostPopover() {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ source: 'gmixer-ui', type: 'close' }, '*');
  }
}
