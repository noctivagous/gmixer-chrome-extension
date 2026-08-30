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
import { collectOpenShadowRoots, isGmixerUiElement } from './open-trees.js';

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
  let stopped = false;
  let lastUrl = globalThis.location?.href ?? '';
  /** @type {Set<Element>} */
  let pendingRoots = new Set();
  let cascadeThreat = false;
  /** @type {() => void} */
  let rediscoverOpenShadows = () => {};

  const isGmixerNode = (node) =>
    node.nodeType === Node.ELEMENT_NODE &&
    (isGmixerUiElement(node) ||
      node.id === 'gmixer-style' ||
      node.id === 'gmixer-settings-host-style' ||
      node.id === 'gmixer-font-faces' ||
      node.id === 'gmixer-hover-outline' ||
      node.classList?.contains('gmixer-tonal-overlay') ||
      node.classList?.contains('gmixer-link-shimmer-overlay') ||
      node.classList?.contains('gmixer-bgimg-overlay') ||
      node.classList?.contains('gmixer-ui-frame') ||
      node.hasAttribute?.('data-gmixer-pan-scan-frame') ||
      node.hasAttribute?.('data-gmixer-pan-scan-rest') ||
      node.hasAttribute?.('data-gmixer-rotating-cube-scene') ||
      node.hasAttribute?.('data-gmixer-rotating-cube') ||
      node.hasAttribute?.('data-gmixer-rotating-cube-face') ||
      node.closest?.('[data-gmixer-pan-scan-frame]') ||
      node.closest?.('[data-gmixer-rotating-cube-scene]'));

  const flush = () => {
    if (stopped) return;
    pending = false;
    // Page-world attachShadow calls are invisible to an isolated-world
    // prototype patch. Bounded rediscovery catches newly open trees whenever
    // the page is already producing mutation work.
    rediscoverOpenShadows();
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
    if (stopped || pending) return;
    pending = true;
    queueMicrotask(flush);
  };

  const observedShadows = new Set();
  /** @type {(root: ShadowRoot|null|undefined) => boolean} */
  let observeShadow = () => false;

  const observeOpts = {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [
      'aria-expanded',
      'aria-hidden',
      'aria-controls',
      'data-state',
      'data-open',
      'hidden',
      'open',
      'popover',
      // Instagram collapsed nav expands via inline width + background-color.
      // Keep this gated in the callback — raw style traffic is huge.
      'style',
    ],
  };

  /** Inline style expands that reveal opaque chrome (not scroll/transform churn). */
  const STYLE_SHEET_RE =
    /(?:^|;)\s*(?:background(?:-color)?|width|min-width|max-width)\s*:/i;

  const observer = new MutationObserver((mutations) => {
    if (stopped) return;
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') {
        const target = mutation.target;
        if (!target || target.nodeType !== Node.ELEMENT_NODE || isGmixerNode(target)) continue;
        if (mutation.attributeName === 'style') {
          const styleText = /** @type {Element} */ (target).getAttribute?.('style') || '';
          if (!STYLE_SHEET_RE.test(styleText)) continue;
        }
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
    if (!root || observedShadows.has(root)) return false;
    observedShadows.add(root);
    observer.observe(root, observeOpts);
    return true;
  };

  rediscoverOpenShadows = () => {
    if (!document.documentElement) return;
    for (const sr of collectOpenShadowRoots(document.documentElement)) {
      if (observeShadow(sr) && sr.host && !isGmixerNode(sr.host)) {
        pendingRoots.add(sr.host);
      }
    }
  };

  observer.observe(document.documentElement, observeOpts);
  rediscoverOpenShadows();
  // Initial classification is owned by content-end's full adaptive pass.
  pendingRoots = new Set();

  return () => {
    stopped = true;
    pending = false;
    pendingRoots.clear();
    cascadeThreat = false;
    observer.disconnect();
  };
}
