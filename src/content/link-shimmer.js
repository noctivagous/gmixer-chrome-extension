/**
 * Cycles a soft sheen across viewport article/teaser title links, one at a time.
 * Paint is a borderless fixed overlay (Strategy C) so the sweep stays visible
 * over clipped/full-bleed card media without restyling the link itself.
 */

import { sectionAllowedByFocus } from '../settings/settings-focus.js';
import { sectionAllowedByCustomizationLevel } from '../settings/customization-level.js';
import { isLinkShimmerEnabled } from '../config/effects-catalog.js';
import { buildPalette } from '../lib/color-theory.js';
import {
  LINK_SHIMMER_ATTR,
  collectViewportArticleCards,
  elementInViewport,
  nextShimmerIndex,
} from './article-card-detector.js';

const CYCLE_MS = 3200;
const RESCAN_SCROLL_MS = 200;
export const OVERLAY_CLASS = 'gmixer-link-shimmer-overlay';

function effectsSectionOn(resolved) {
  if (!sectionAllowedByFocus(resolved?.ui?.settingsFocus, 'effects')) return false;
  if (!sectionAllowedByCustomizationLevel(resolved?.ui, 'effects')) return false;
  return resolved?.sections?.effects === true;
}

/** @type {ReturnType<typeof collectViewportArticleCards>} */
let candidates = [];
let index = -1;
/** @type {ReturnType<typeof setTimeout>|0} */
let cycleTimer = 0;
/** @type {ReturnType<typeof setTimeout>|0} */
let scrollTimer = 0;
let running = false;
/** @type {Element|null} */
let activeLink = null;
let shimmerColor = '#a78bfa';

function removeOverlay() {
  document.querySelectorAll?.(`.${OVERLAY_CLASS}`).forEach((overlay) => overlay.remove());
}

function positionOverlay() {
  const overlay = document.querySelector?.(`.${OVERLAY_CLASS}`);
  if (!overlay) return;
  const target = /** @type {HTMLElement & { _gmixerTarget?: Element }} */ (overlay)._gmixerTarget;
  if (!target?.isConnected || !elementInViewport(target)) {
    clearActive();
    return;
  }
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    clearActive();
    return;
  }
  overlay.style.left = `${rect.left}px`;
  overlay.style.top = `${rect.top}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.setProperty('--gmixer-shimmer-color', shimmerColor);
}

function mountSheen(target) {
  if (!target || !elementInViewport(target)) return;
  const rect = target.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const overlay = document.createElement('div');
  overlay.className = OVERLAY_CLASS;
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.setProperty('--gmixer-shimmer-color', shimmerColor);
  /** @type {HTMLElement & { _gmixerTarget?: Element }} */ (overlay)._gmixerTarget = target;
  document.body.appendChild(overlay);
  positionOverlay();
}

function clearActive() {
  removeOverlay();
  if (activeLink) {
    try {
      activeLink.removeAttribute(LINK_SHIMMER_ATTR);
    } catch {
      /* ignore */
    }
    activeLink = null;
  }
  try {
    document.querySelectorAll?.(`[${LINK_SHIMMER_ATTR}]`).forEach((el) => {
      el.removeAttribute(LINK_SHIMMER_ATTR);
    });
  } catch {
    /* ignore */
  }
}

function stampLink(pair) {
  clearActive();
  if (!pair?.link || !elementInViewport(pair.link)) return;
  activeLink = pair.link;
  try {
    activeLink.setAttribute(LINK_SHIMMER_ATTR, 'link');
  } catch {
    activeLink = null;
    return;
  }
  mountSheen(activeLink);
}

function refreshCandidates() {
  candidates = collectViewportArticleCards(document.body).filter((pair) =>
    elementInViewport(pair.link)
  );
  if (index >= candidates.length) index = -1;
  if (activeLink && !elementInViewport(activeLink)) {
    clearActive();
  }
}

function tick() {
  if (!running || typeof document === 'undefined') return;
  if (document.hidden) {
    scheduleNext();
    return;
  }
  refreshCandidates();
  if (!candidates.length) {
    clearActive();
    scheduleNext();
    return;
  }

  // Advance until we land on a still-in-viewport link (list can churn mid-cycle).
  let attempts = 0;
  let pair = null;
  while (attempts < candidates.length) {
    index = nextShimmerIndex(index, candidates.length);
    pair = candidates[index];
    if (pair?.link && elementInViewport(pair.link)) break;
    pair = null;
    attempts += 1;
  }
  if (pair) stampLink(pair);
  else clearActive();
  scheduleNext();
}

function scheduleNext() {
  clearTimeout(cycleTimer);
  if (!running) return;
  cycleTimer = setTimeout(tick, CYCLE_MS);
}

function onScrollOrResize() {
  if (!running) return;
  clearTimeout(scrollTimer);
  scrollTimer = setTimeout(() => {
    refreshCandidates();
    positionOverlay();
  }, RESCAN_SCROLL_MS);
}

function bindViewportListeners() {
  window.addEventListener('scroll', onScrollOrResize, { passive: true, capture: true });
  window.addEventListener('resize', onScrollOrResize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
}

function unbindViewportListeners() {
  window.removeEventListener('scroll', onScrollOrResize, { capture: true });
  window.removeEventListener('resize', onScrollOrResize);
  document.removeEventListener('visibilitychange', onVisibility);
}

function onVisibility() {
  if (!running) return;
  if (document.hidden) {
    clearTimeout(cycleTimer);
    cycleTimer = 0;
  } else {
    scheduleNext();
  }
}

function resolveShimmerColor(resolved) {
  const override = resolved?.color?.overrides?.accent;
  if (typeof override === 'string' && override.trim()) return override.trim();
  const palette = buildPalette(
    resolved?.color?.baseColor || '#7c3aed',
    resolved?.color?.scheme || 'analogous',
    resolved?.themeMode || 'dark',
    resolved?.themeIntensity
  );
  return palette.accent || '#a78bfa';
}

export function startLinkShimmer() {
  if (running) {
    refreshCandidates();
    return;
  }
  running = true;
  bindViewportListeners();
  refreshCandidates();
  index = -1;
  tick();
}

export function stopLinkShimmer() {
  running = false;
  clearTimeout(cycleTimer);
  clearTimeout(scrollTimer);
  cycleTimer = 0;
  scrollTimer = 0;
  unbindViewportListeners();
  clearActive();
  candidates = [];
  index = -1;
}

/**
 * Start or stop based on resolved settings.
 * @param {object} resolved
 */
export function syncLinkShimmer(resolved) {
  const enabled = effectsSectionOn(resolved) && isLinkShimmerEnabled(resolved?.effects);
  if (enabled) {
    shimmerColor = resolveShimmerColor(resolved);
    startLinkShimmer();
    positionOverlay();
  } else {
    stopLinkShimmer();
  }
}

/** Notify cycler that DOM may have changed (subtree mutations). */
export function rescanLinkShimmer() {
  if (!running) return;
  refreshCandidates();
}
