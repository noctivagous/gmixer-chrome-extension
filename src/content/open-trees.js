// Open shadow roots are a separate document tree: page <style> and
// querySelectorAll do not enter them. Theme/classify by tree shape, not by
// host or custom-element name. Closed shadows cannot be reached.
import { MAX_OPEN_SHADOW_ROOTS } from './scan-limits.js';

let shadowCapHits = 0;

export function getOpenTreeDiagnostics() {
  return { shadowCapHits };
}

/**
 * Open shadow roots under `root`, including nested open shadows, capped so
 * widget-heavy pages do not explode work.
 *
 * @param {ParentNode|Element|ShadowRoot|Document} root
 * @param {number} [max]
 * @returns {ShadowRoot[]}
 */
export function collectOpenShadowRoots(root, max = MAX_OPEN_SHADOW_ROOTS) {
  if (!root) return [];
  /** @type {ShadowRoot[]} */
  const out = [];
  const seen = new Set();

  /**
   * @param {Element} el
   */
  function visitElement(el) {
    if (!el || out.length >= max) return;
    // O(1) host check only — do not walk ancestors here. This runs on every
    // element during mutation flushes.
    if (isGmixerUiHost(el)) return;
    const sr = el.shadowRoot;
    if (!sr || seen.has(sr)) return;
    seen.add(sr);
    out.push(sr);
    visitRoot(sr);
  }

  /**
   * @param {ParentNode|Element|ShadowRoot|Document} r
   */
  function visitRoot(r) {
    if (!r || out.length >= max) return;
    if (r.nodeType === 1) visitElement(/** @type {Element} */ (r));
    if (typeof r.querySelectorAll !== 'function') return;
    const nodes = r.querySelectorAll('*');
    for (let i = 0; i < nodes.length && out.length < max; i += 1) {
      visitElement(nodes[i]);
    }
    if (out.length >= max && nodes.length > 0) shadowCapHits += 1;
  }

  visitRoot(root);
  return out;
}

/**
 * @param {ParentNode|Element|ShadowRoot|null|undefined} root
 * @returns {boolean}
 */
export function isShadowRoot(root) {
  return !!root && root.nodeType === 11 && typeof root.host !== 'undefined';
}

const GMIXER_UI_HOST_SELECTOR = '#gmixer-settings, #gmixer-walkthrough-host';

function isGmixerUiHost(el) {
  if (!el) return false;
  if (el.id === 'gmixer-settings' || el.id === 'gmixer-walkthrough-host') return true;
  const name = el.localName || (typeof el.tagName === 'string' ? el.tagName.toLowerCase() : '');
  return name.startsWith('gmixer-');
}

/**
 * Settings / walkthrough live in the page so they can use the Popover API,
 * but they are not themed page chrome. Classifier, flyouts, and adopted
 * theme sheets must leave these trees alone.
 * @param {Element|null|undefined} el
 * @returns {boolean}
 */
export function isGmixerUiElement(el) {
  if (!el) return false;
  if (isGmixerUiHost(el)) return true;
  if (el.closest?.(GMIXER_UI_HOST_SELECTOR)) return true;
  // closest() cannot cross shadow roots. Nested Lit panels live in the
  // settings/walkthrough shadow tree.
  let node = el.parentNode;
  const seen = new Set();
  while (node && !seen.has(node)) {
    seen.add(node);
    if (node.nodeType === 11 && node.host) {
      node = node.host;
      if (isGmixerUiHost(node) || node.closest?.(GMIXER_UI_HOST_SELECTOR)) return true;
      node = node.parentNode;
      continue;
    }
    if (isGmixerUiHost(node) || node.closest?.(GMIXER_UI_HOST_SELECTOR)) return true;
    node = node.parentElement || node.parentNode || null;
  }
  return false;
}

/**
 * @param {ShadowRoot|null|undefined} sr
 * @returns {boolean}
 */
export function isGmixerUiShadowRoot(sr) {
  return isGmixerUiElement(sr?.host);
}
