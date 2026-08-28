import { normalizeEffects } from '../config/effects-catalog.js';
import { MAX_MEDIA_EFFECT_SCAN } from './scan-limits.js';

export const FRAME_ATTR = 'data-gmixer-pan-scan-frame';
export const TARGET_ATTR = 'data-gmixer-pan-scan-target';
export const REST_ATTR = 'data-gmixer-pan-scan-rest';

/** 9×9 focus grid inside the crop frame (indices 0–8). */
export const GRID_SIZE = 9;
const GRID_CENTER = 4;

/** @type {ReturnType<typeof normalizeEffects>['panScan']|null} */
let activePanScan = null;

/**
 * Wrap pan/scan media in a fixed-size overflow container and drive per-image
 * scan targets on a 9×9 grid. Cross-dissolve mode keeps a rest twin so the
 * return to origin blends the zoomed crop into the original framing.
 *
 * @param {object} resolved
 */
export function syncPanScan(resolved) {
  const enabled =
    resolved?.enabled !== false &&
    resolved?.sections?.effects === true &&
    resolved?.effects?.categories?.images?.effect === 'pan-scan';

  if (!enabled) {
    activePanScan = null;
    teardown();
    return;
  }

  const panScan = normalizeEffects(resolved.effects).panScan;
  activePanScan = panScan;
  addFrames();
  bindTargets(panScan);
}

function teardown() {
  unbindTargets();
  removeFrames();
}

function addFrames() {
  const media = new Set();
  const images = document.images;
  const limit = Math.min(images.length, MAX_MEDIA_EFFECT_SCAN);
  for (let i = 0; i < limit; i++) {
    const image = images[i];
    if (image.hasAttribute(REST_ATTR)) continue;
    if (image.closest(`#gmixer-settings, [${FRAME_ATTR}]`)) continue;
    media.add(image.closest('picture') || image);
  }

  for (const element of media) {
    if (!(element instanceof HTMLElement) || element.parentElement?.hasAttribute(FRAME_ATTR)) {
      continue;
    }

    const width = element.offsetWidth;
    const height = element.offsetHeight;
    if (!width || !height) continue;

    const frame = document.createElement('span');
    frame.setAttribute(FRAME_ATTR, '');
    const computed = getComputedStyle(element);
    frame.style.display = computed.display === 'block' ? 'block' : 'inline-block';
    frame.style.position = 'relative';
    frame.style.width = `${width}px`;
    frame.style.height = `${height}px`;
    frame.style.overflow = 'hidden';
    frame.style.verticalAlign = computed.verticalAlign;
    frame.style.borderRadius = computed.borderRadius;
    frame.style.lineHeight = '0';

    element.parentNode?.insertBefore(frame, element);
    frame.appendChild(element);
  }
}

function removeFrames() {
  for (const frame of document.querySelectorAll(`[${FRAME_ATTR}]`)) {
    frame.querySelectorAll(`[${REST_ATTR}]`).forEach((node) => node.remove());
    const parent = frame.parentNode;
    if (!parent) continue;
    while (frame.firstChild) parent.insertBefore(frame.firstChild, frame);
    frame.remove();
  }
}

/**
 * @param {{ speed: number, zoom: number, distance: number, loop: 'fade'|'oscillate', motion: 'scan'|'pan'|'tilt' }} panScan
 */
function bindTargets(panScan) {
  /** @type {Set<string>} */
  const usedInitial = new Set();

  for (const frame of document.querySelectorAll(`[${FRAME_ATTR}]`)) {
    if (!(frame instanceof HTMLElement)) continue;
    const image = frame.querySelector(`img:not([${REST_ATTR}])`);
    if (!(image instanceof HTMLElement)) continue;

    syncRestTwin(frame, image, panScan);

    if (image.dataset.gmixerPanScanBound === '1') {
      applyParams(image, panScan);
      if (image.dataset.gmixerPanScanMotion !== panScan.motion) {
        image.dataset.gmixerPanScanMotion = panScan.motion;
        pickNextGridPoint(image, panScan, usedInitial);
      } else {
        applyGridOrigin(image, panScan.distance);
      }
      continue;
    }

    image.dataset.gmixerPanScanBound = '1';
    image.dataset.gmixerPanScanMotion = panScan.motion;
    applyParams(image, panScan);
    pickNextGridPoint(image, panScan, usedInitial);

    const onIteration = () => {
      const ps = activePanScan;
      if (!ps) return;
      if (ps.loop === 'oscillate') {
        const count = Number(image.dataset.gmixerPanScanIters || 0) + 1;
        image.dataset.gmixerPanScanIters = String(count);
        if (count % 2 !== 0) return;
      }
      pickNextGridPoint(image, ps, null);
    };

    image._gmixerPanScanOnIteration = onIteration;
    image.addEventListener('animationiteration', onIteration);
  }
}

/**
 * @param {HTMLElement} frame
 * @param {HTMLElement} primary
 * @param {{ loop: string }} panScan
 */
function syncRestTwin(frame, primary, panScan) {
  let rest = frame.querySelector(`[${REST_ATTR}]`);
  if (panScan.loop !== 'fade') {
    rest?.remove();
    return;
  }

  if (!(rest instanceof HTMLElement)) {
    rest = /** @type {HTMLElement} */ (primary.cloneNode(true));
    rest.setAttribute(REST_ATTR, '');
    rest.setAttribute('aria-hidden', 'true');
    rest.removeAttribute(TARGET_ATTR);
    rest.removeAttribute('id');
    rest.removeAttribute('data-gmixer-pan-scan-bound');
    delete rest.dataset.gmixerPanScanBound;
    delete rest.dataset.gmixerPanScanIters;
    delete rest.dataset.gmixerPanScanGx;
    delete rest.dataset.gmixerPanScanGy;
    frame.appendChild(rest);
  }

  const width = primary.offsetWidth || frame.offsetWidth;
  const height = primary.offsetHeight || frame.offsetHeight;
  rest.style.position = 'absolute';
  rest.style.left = '0';
  rest.style.top = '0';
  rest.style.width = width ? `${width}px` : '100%';
  rest.style.height = height ? `${height}px` : '100%';
  rest.style.margin = '0';
  rest.style.pointerEvents = 'none';
  rest.style.objectFit = getComputedStyle(primary).objectFit || 'fill';
  rest.style.transformOrigin = 'center center';
  rest.style.transform = 'none';
}

function unbindTargets() {
  for (const target of document.querySelectorAll(`[${TARGET_ATTR}]`)) {
    if (!(target instanceof HTMLElement)) continue;
    const handler = target._gmixerPanScanOnIteration;
    if (handler) target.removeEventListener('animationiteration', handler);
    delete target._gmixerPanScanOnIteration;
    delete target.dataset.gmixerPanScanBound;
    delete target.dataset.gmixerPanScanIters;
    delete target.dataset.gmixerPanScanGx;
    delete target.dataset.gmixerPanScanGy;
    delete target.dataset.gmixerPanScanMotion;
    target.removeAttribute(TARGET_ATTR);
    target.style.removeProperty('--gmixer-pan-ox');
    target.style.removeProperty('--gmixer-pan-oy');
    target.style.removeProperty('--gmixer-pan-zoom');
  }
}

/**
 * @param {HTMLElement} target
 * @param {{ zoom: number, loop: string }} panScan
 */
function applyParams(target, panScan) {
  target.setAttribute(TARGET_ATTR, panScan.loop);
  target.style.setProperty('--gmixer-pan-zoom', String(1 + panScan.zoom / 100));
}

/**
 * Map a 0–8 grid index to a transform-origin percentage.
 * Distance widens how far from center the grid can reach.
 * @param {number} index
 * @param {number} distance
 */
export function gridIndexToPercent(index, distance) {
  const i = Math.min(GRID_SIZE - 1, Math.max(0, Math.round(index)));
  const t = i / (GRID_SIZE - 1); // 0..1
  const span = Math.min(50, 12 + Number(distance || 0) * 3.2);
  return Math.round((50 + (t * 2 - 1) * span) * 10) / 10;
}

/**
 * @param {number} min
 * @param {number} maxInclusive
 */
function randInt(min, maxInclusive) {
  return min + Math.floor(Math.random() * (maxInclusive - min + 1));
}

/**
 * Choose the next 9×9 focus cell for an image.
 * - scan: any cell
 * - pan: horizontal only (row locked to center)
 * - tilt: vertical only (column locked to center)
 *
 * @param {HTMLElement} target
 * @param {{ distance: number, motion: 'scan'|'pan'|'tilt' }} panScan
 * @param {Set<string>|null} usedInitial
 */
export function pickNextGridPoint(target, panScan, usedInitial = null) {
  const motion = panScan.motion || 'scan';
  const prev = target.dataset.gmixerPanScanGx
    ? `${target.dataset.gmixerPanScanGx},${target.dataset.gmixerPanScanGy}`
    : '';

  let gx = GRID_CENTER;
  let gy = GRID_CENTER;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (motion === 'pan') {
      gx = randInt(0, GRID_SIZE - 1);
      gy = GRID_CENTER;
      if (gx === GRID_CENTER && attempt < 12) continue;
    } else if (motion === 'tilt') {
      gx = GRID_CENTER;
      gy = randInt(0, GRID_SIZE - 1);
      if (gy === GRID_CENTER && attempt < 12) continue;
    } else {
      gx = randInt(0, GRID_SIZE - 1);
      gy = randInt(0, GRID_SIZE - 1);
      if (gx === GRID_CENTER && gy === GRID_CENTER && attempt < 12) continue;
    }

    const key = `${gx},${gy}`;
    if (key === prev && attempt < 14) continue;
    if (usedInitial?.has(key) && attempt < 16) continue;
    break;
  }

  const key = `${gx},${gy}`;
  usedInitial?.add(key);
  target.dataset.gmixerPanScanGx = String(gx);
  target.dataset.gmixerPanScanGy = String(gy);
  applyGridOrigin(target, panScan.distance);
}

/**
 * @param {HTMLElement} target
 * @param {number} distance
 */
function applyGridOrigin(target, distance) {
  const gx = Number(target.dataset.gmixerPanScanGx);
  const gy = Number(target.dataset.gmixerPanScanGy);
  const ox = Number.isFinite(gx) ? gridIndexToPercent(gx, distance) : 50;
  const oy = Number.isFinite(gy) ? gridIndexToPercent(gy, distance) : 50;
  target.style.setProperty('--gmixer-pan-ox', `${ox}%`);
  target.style.setProperty('--gmixer-pan-oy', `${oy}%`);
}
