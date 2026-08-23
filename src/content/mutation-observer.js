// MutationObserver bridge for the ADAPTIVE pass (document_end only).
//
// Reacts to post-load DOM growth — SPA route swaps, infinite scroll,
// lazy sections/images, and sites that inject their own <style>/<link>
// after ours (which would otherwise win same-specificity by document order).
//
// Never imported from content-start.js. Classification of new subtrees is
// the adaptive pass's job; this module only detects relevant mutations and
// forwards roots to the caller.

/**
 * @typedef {object} MutationHandlers
 * @property {(roots: Element[]) => void} onSubtree
 *   New element subtrees that may need classification / tonal / bg tagging.
 * @property {() => void} onCascadeThreat
 *   A <style>, <link>, or <head> addition that may out-order our override.
 */

/**
 * @param {MutationHandlers | (() => void)} handlers
 *   Object form preferred. A bare function is treated as both handlers
 *   (back-compat for tests).
 */
export function startMutationObserver(handlers) {
  const onSubtree =
    typeof handlers === 'function' ? handlers : handlers.onSubtree ?? (() => {});
  const onCascadeThreat =
    typeof handlers === 'function' ? handlers : handlers.onCascadeThreat ?? onSubtree;

  let pending = false;
  /** @type {Set<Element>} */
  let pendingRoots = new Set();
  let cascadeThreat = false;

  const isGmixerNode = (node) =>
    node.nodeType === Node.ELEMENT_NODE &&
    (node.id === 'gmixer-style' ||
      node.id === 'gmixer-settings' ||
      node.id === 'gmixer-hover-outline' ||
      node.classList?.contains('gmixer-tonal-overlay') ||
      node.closest?.('#gmixer-settings'));

  const flush = () => {
    pending = false;
    const roots = Array.from(pendingRoots);
    const threatened = cascadeThreat;
    pendingRoots = new Set();
    cascadeThreat = false;

    if (roots.length) onSubtree(roots);
    if (threatened) onCascadeThreat();
  };

  const schedule = () => {
    if (pending) return;
    pending = true;
    queueMicrotask(flush);
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        // injectStyle() / tonal overlays append their own nodes. Ignore
        // gMixer-owned DOM or this observer schedules itself forever.
        if (isGmixerNode(node)) continue;

        const tag = node.tagName;
        if (tag === 'STYLE' || tag === 'LINK' || tag === 'HEAD') {
          cascadeThreat = true;
          schedule();
          continue;
        }

        pendingRoots.add(/** @type {Element} */ (node));
        schedule();
      }
    }
  });

  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => observer.disconnect();
}
