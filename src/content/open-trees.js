// Open shadow roots are a separate document tree: page <style> and
// querySelectorAll do not enter them. Theme/classify by tree shape, not by
// host or custom-element name. Closed shadows cannot be reached.
import { MAX_OPEN_SHADOW_ROOTS } from './scan-limits.js';

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
