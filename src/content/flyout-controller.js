// Interaction-driven discovery for CSS-only and script-opened flyouts.
// MutationObserver cannot see :hover/:focus-within, and many menu libraries
// change layout a frame or two after their activation event.
import {
  CONFIDENCE_ATTR,
  OVERLAY_ATTR,
  REASONS_ATTR,
  ROLE_ATTR,
  isOverlayPanel,
} from './page-classifier.js';
import { isGmixerUiElement } from './open-trees.js';

const ACTIVE_ITEM_SELECTOR =
  'li, [aria-haspopup], [aria-expanded], [role="menuitem"], button, [role="button"]';
const EXPLICIT_PANEL_SELECTOR =
  '[role="menu"], [role="listbox"], [role="dialog"], [popover]:popover-open, dialog[open]';
const PANEL_CANDIDATE_SELECTOR = 'div, section, ul, ol, nav, aside, dialog, menu';

function isGmixerOwned(element) {
  return isGmixerUiElement(element);
}

function controlledElements(el) {
  const ids = (el?.getAttribute?.('aria-controls') || '').split(/\s+/).filter(Boolean);
  const out = [];
  for (const id of ids) {
    const controlled = document.getElementById(id);
    if (controlled) out.push(controlled);
  }
  return out;
}

/**
 * @param {(roots: Element[]) => void} onCandidates
 * @returns {() => void}
 */
export function startFlyoutController(onCandidates) {
  const pending = new Set();
  let firstFrame = 0;
  let secondFrame = 0;

  const flush = () => {
    secondFrame = 0;
    const roots = new Set();
    for (const target of pending) {
      const activeItem = target.closest?.(ACTIVE_ITEM_SELECTOR);
      if (activeItem) roots.add(activeItem);
      for (const controlled of controlledElements(target)) roots.add(controlled);
      for (const controlled of controlledElements(activeItem)) roots.add(controlled);
    }
    pending.clear();

    // Portaled platform/ARIA panels are not descendants of their trigger.
    for (const panel of document.querySelectorAll(EXPLICIT_PANEL_SELECTOR)) {
      roots.add(panel);
    }
    if (roots.size) onCandidates([...roots]);
  };

  const schedule = () => {
    if (firstFrame || secondFrame) return;
    firstFrame = requestAnimationFrame(() => {
      firstFrame = 0;
      secondFrame = requestAnimationFrame(flush);
    });
  };

  const onInteraction = (event) => {
    const target = event.target;
    if (!target || target.nodeType !== Node.ELEMENT_NODE) return;
    if (isGmixerOwned(target)) return;
    pending.add(target);
    schedule();
  };

  document.addEventListener('pointerover', onInteraction, true);
  document.addEventListener('focusin', onInteraction, true);
  document.addEventListener('click', onInteraction, true);

  return () => {
    document.removeEventListener('pointerover', onInteraction, true);
    document.removeEventListener('focusin', onInteraction, true);
    document.removeEventListener('click', onInteraction, true);
    if (firstFrame) cancelAnimationFrame(firstFrame);
    if (secondFrame) cancelAnimationFrame(secondFrame);
    pending.clear();
  };
}

/**
 * Stamp visible overlay panels below interaction roots. This path intentionally
 * uses only semantics and geometry; native color capture remains in the
 * adaptive classifier's theme-suspended transaction.
 * @param {Element[]} roots
 * @param {number} [max]
 * @returns {number}
 */
export function stampVisibleFlyouts(roots, max = 160) {
  const candidates = [];
  const seen = new Set();
  const add = (element) => {
    if (
      !element ||
      isGmixerOwned(element) ||
      seen.has(element) ||
      candidates.length >= max
    ) {
      return;
    }
    seen.add(element);
    candidates.push(element);
  };

  for (const root of roots || []) {
    if (root?.matches?.(PANEL_CANDIDATE_SELECTOR)) add(root);
    for (const candidate of root?.querySelectorAll?.(PANEL_CANDIDATE_SELECTOR) || []) {
      add(candidate);
      if (candidates.length >= max) break;
    }
    if (candidates.length >= max) break;
  }

  let stamped = 0;
  for (const panel of candidates) {
    if (!isOverlayPanel(panel)) continue;
    panel.setAttribute(ROLE_ATTR, 'surface');
    panel.setAttribute(OVERLAY_ATTR, '');
    panel.setAttribute(CONFIDENCE_ATTR, '0.90');
    panel.setAttribute(REASONS_ATTR, 'visible interactive flyout');
    stamped += 1;
  }
  return stamped;
}

/** Start the production interaction observer. */
export function startFlyoutAnalysis() {
  return startFlyoutController((roots) => {
    stampVisibleFlyouts(roots);
  });
}
