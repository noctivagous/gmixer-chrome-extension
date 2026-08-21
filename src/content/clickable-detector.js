// Simplified clickable detection for gMixer's opt-in navigation.
// Intentionally much smaller than KeyPilot's ElementDetector — semantic
// clickables + cursor:pointer ancestors, no listener tracking / shadow pierce.

const CLICKABLE_SELECTOR = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  'video[controls]',
  'audio[controls]',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="option"]',
  '[role="switch"]',
  '[onclick]',
  '[data-href]',
  '[data-action]',
  '[contenteditable="true"]',
].join(', ');

function isGmixerChrome(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el.id === 'gmixer-style' || el.id === 'gmixer-hover-outline') return true;
  return !!el.closest?.('#gmixer-hover-outline');
}

function hasPointerCursor(el) {
  try {
    return getComputedStyle(el).cursor === 'pointer';
  } catch {
    return false;
  }
}

/**
 * Walk from the element under the cursor up to find the best click target.
 * @param {number} x
 * @param {number} y
 * @returns {Element|null}
 */
export function findClickableAtPoint(x, y) {
  let el = null;
  try {
    el = document.elementFromPoint(x, y);
  } catch {
    return null;
  }
  if (!el || isGmixerChrome(el)) return null;

  // Prefer the nearest semantic clickable.
  const semantic = el.closest?.(CLICKABLE_SELECTOR);
  if (semantic && !isGmixerChrome(semantic)) return semantic;

  // Fallback: nearest ancestor advertising cursor:pointer (common for JS widgets).
  let node = el;
  for (let depth = 0; node && depth < 8; depth++) {
    if (node.nodeType === Node.ELEMENT_NODE && hasPointerCursor(node) && !isGmixerChrome(node)) {
      return node;
    }
    node = node.parentElement;
  }

  return null;
}

/** True when the user is typing in a field — nav keys must not fire. */
export function isTypingContext(target) {
  const el =
    target === undefined
      ? typeof document !== 'undefined'
        ? document.activeElement
        : null
      : target;
  if (!el) return false;
  if (
    typeof document !== 'undefined' &&
    (el === document.body || el === document.documentElement)
  ) {
    return false;
  }
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  const role = el.getAttribute?.('role');
  return role === 'textbox' || role === 'searchbox' || role === 'combobox';
}
