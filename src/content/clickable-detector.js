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

function hasExplicitPointerCursor(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  if (el === document.body || el === document.documentElement) return false;

  try {
    if (el.style?.cursor?.toLowerCase() === 'pointer') return true;
  } catch {
    // Continue with class/computed-style checks.
  }

  try {
    const className =
      typeof el.className === 'string'
        ? el.className
        : el.className && typeof el.className.baseVal === 'string'
          ? el.className.baseVal
          : '';
    if (/\bcursor-pointer\b/i.test(className) || /\bcursorPointer\b/.test(className)) {
      return true;
    }
  } catch {
    // Continue with computed-style checks.
  }

  // `cursor` is inherited. Only treat it as an explicit signal when the
  // nearest parent does not also report pointer; otherwise a page-level
  // cursor:pointer would make every descendant appear interactive.
  try {
    if (getComputedStyle(el).cursor !== 'pointer') return false;
    let parent = el.parentElement;
    if (!parent && typeof el.getRootNode === 'function') {
      const root = el.getRootNode();
      if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
        parent = root.host || null;
      }
    }
    if (!parent || parent === document.body || parent === document.documentElement) {
      return true;
    }
    return getComputedStyle(parent).cursor !== 'pointer';
  } catch {
    return false;
  }
}

function matchesSemanticClickable(el) {
  try {
    return !!el?.matches?.(CLICKABLE_SELECTOR);
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

  // KeyPilot's important ordering: walk from the hit leaf and return the
  // nearest semantic target before considering cursor:pointer. `closest()`
  // gives the same result in ordinary DOM, but does not cross open shadow
  // roots and makes the ordering less obvious.
  let node = el;
  let depth = 0;
  let cursorCandidate = null;
  while (node && node !== document.body && node !== document.documentElement && depth < 20) {
    if (!isGmixerChrome(node) && matchesSemanticClickable(node)) {
      return node;
    }
    if (!cursorCandidate && !isGmixerChrome(node) && hasExplicitPointerCursor(node)) {
      cursorCandidate = node;
    }

    node =
      node.parentElement ||
      (typeof node.getRootNode === 'function' &&
      typeof ShadowRoot !== 'undefined' &&
      node.getRootNode() instanceof ShadowRoot
        ? node.getRootNode().host
        : null);
    depth++;
  }

  return cursorCandidate;
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
