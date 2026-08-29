// MutationObserver bridge for the ADAPTIVE pass (document_end only).
//
// Reacts to post-load DOM growth — SPA route swaps, infinite scroll,
// lazy sections/images, and sites that inject their own <style>/<link>
// after ours (which would otherwise win same-specificity by document order).
//
// Never imported from content-start.js. Classification of new subtrees is
// the adaptive pass's job; this module only detects relevant mutations and
// forwards roots to the caller. Route handling uses URL shape (path vs hash),
// not hostname.

import { isDocumentNavigation } from './adaptive-timing.js';
import { collectOpenShadowRoots } from './open-trees.js';

/**
 * @typedef {object} MutationHandlers
 * @property {(roots: Element[]) => void} onSubtree
 *   New element subtrees that may need classification / tonal / bg tagging.
 * @property {() => void} onCascadeThreat
 *   A <style>, <link>, or <head> addition that may out-order our override.
 * @property {() => void} [onNavigation]
 *   The page URL changed while DOM mutations were arriving (for routers that
 *   do not use History APIs directly).
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
  const onNavigation = typeof handlers === 'function' ? () => {} : handlers.onNavigation ?? (() => {});

  let pending = false;
  let lastUrl = globalThis.location?.href ?? '';
  /** @type {Set<Element>} */
  let pendingRoots = new Set();
  let cascadeThreat = false;

  const isGmixerNode = (node) =>
    node.nodeType === Node.ELEMENT_NODE &&
    (node.id === 'gmixer-style' ||
      node.id === 'gmixer-settings' ||
      node.id === 'gmixer-hover-outline' ||
      node.classList?.contains('gmixer-tonal-overlay') ||
      node.classList?.contains('gmixer-link-shimmer-overlay') ||
      node.hasAttribute?.('data-gmixer-pan-scan-frame') ||
      node.hasAttribute?.('data-gmixer-pan-scan-rest') ||
      node.hasAttribute?.('data-gmixer-rotating-cube-scene') ||
      node.hasAttribute?.('data-gmixer-rotating-cube') ||
      node.hasAttribute?.('data-gmixer-rotating-cube-face') ||
      node.closest?.('#gmixer-settings') ||
      node.closest?.('[data-gmixer-pan-scan-frame]') ||
      node.closest?.('[data-gmixer-rotating-cube-scene]'));

  const flush = () => {
    pending = false;
    const previousUrl = lastUrl;
    const currentUrl = globalThis.location?.href ?? '';
    const urlChanged = currentUrl !== previousUrl;
    lastUrl = currentUrl;
    const roots = Array.from(pendingRoots);
    const threatened = cascadeThreat;
    pendingRoots = new Set();
    cascadeThreat = false;

    // Path/search change: skip incremental classify so we don't paint the
    // new DOM with the previous route's identity sample. Hash-only swaps
    // keep the same document — classify the added roots. (URL shape, not host.)
    if (urlChanged && isDocumentNavigation(previousUrl, currentUrl)) {
      onNavigation();
      return;
    }
    if (roots.length) onSubtree(roots);
    if (threatened) onCascadeThreat();
  };

  const schedule = () => {
    if (pending) return;
    pending = true;
    queueMicrotask(flush);
  };

  const observedShadows = new Set();
  /** @type {(root: ShadowRoot|null|undefined) => void} */
  let observeShadow = () => {};

  const observeOpts = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-expanded', 'hidden', 'open', 'popover'],
  };

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        const target = mutation.target;
        if (!target || target.nodeType !== Node.ELEMENT_NODE || isGmixerNode(target)) continue;
        pendingRoots.add(/** @type {Element} */ (target));
        if (target.parentElement) pendingRoots.add(target.parentElement);
        schedule();
        continue;
      }
      for (const node of mutation.addedNodes || []) {
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
        if (node.shadowRoot) observeShadow(node.shadowRoot);
        schedule();
      }
    }
  });

  observeShadow = (root) => {
    if (!root || observedShadows.has(root)) return;
    observedShadows.add(root);
    observer.observe(root, observeOpts);
  };

  observer.observe(document.documentElement, observeOpts);
  if (document.documentElement) {
    for (const sr of collectOpenShadowRoots(document.documentElement)) {
      observeShadow(sr);
    }
  }

  // Hosts often exist in light DOM before they attach an open shadow
  // (custom element upgrade). childList does not see attachShadow.
  const elementProto = globalThis.Element?.prototype;
  const originalAttach = elementProto?.attachShadow;
  if (typeof originalAttach === 'function') {
    elementProto.attachShadow = function attachShadowPatched(init) {
      const sr = originalAttach.call(this, init);
      observeShadow(sr);
      if (!isGmixerNode(this)) {
        pendingRoots.add(this);
        schedule();
      }
      return sr;
    };
  }

  return () => {
    observer.disconnect();
    if (elementProto && originalAttach) elementProto.attachShadow = originalAttach;
  };
}
