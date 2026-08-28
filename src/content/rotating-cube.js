import { MAX_MEDIA_EFFECT_SCAN, MIN_MEDIA_EFFECT_PX } from './scan-limits.js';

export const SCENE_ATTR = 'data-gmixer-rotating-cube-scene';
export const CUBE_ATTR = 'data-gmixer-rotating-cube';
export const FACE_ATTR = 'data-gmixer-rotating-cube-face';

/**
 * Wrap page images in a CSS 3D cuboid that spins horizontally (rotateY).
 * Front face keeps the live image at its original aspect; side/back faces
 * use clones. Depth uses the shorter edge so wide/tall photos stay cuboids.
 *
 * @param {object} resolved
 */
export function syncRotatingCube(resolved) {
  const enabled =
    resolved?.enabled !== false &&
    resolved?.sections?.effects === true &&
    resolved?.effects?.categories?.images?.effect === 'rotating-cube';

  if (!enabled) {
    removeCubes();
    return;
  }

  addCubes();
}

function addCubes() {
  const media = new Set();
  const images = document.images;
  const limit = Math.min(images.length, MAX_MEDIA_EFFECT_SCAN);
  for (let i = 0; i < limit; i++) {
    const image = images[i];
    if (image.closest(`#gmixer-settings, [${SCENE_ATTR}], [data-gmixer-pan-scan-frame]`)) {
      continue;
    }
    if (image.hasAttribute('data-gmixer-pan-scan-rest')) continue;
    if (image.hasAttribute(FACE_ATTR)) continue;
    media.add(image.closest('picture') || image);
  }

  /** @type {{ element: HTMLElement, width: number, height: number, computed: CSSStyleDeclaration }[]} */
  const measured = [];
  for (const element of media) {
    if (!(element instanceof HTMLElement)) continue;
    if (element.parentElement?.hasAttribute(SCENE_ATTR)) continue;
    if (element.parentElement?.hasAttribute(FACE_ATTR)) continue;
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    if (width < MIN_MEDIA_EFFECT_PX || height < MIN_MEDIA_EFFECT_PX) continue;
    measured.push({ element, width, height, computed: getComputedStyle(element) });
  }

  for (const { element, width, height, computed } of measured) {
    if (element.parentElement?.hasAttribute(SCENE_ATTR)) continue;
    if (element.parentElement?.hasAttribute(FACE_ATTR)) continue;

    // Keep the original WxH face; depth follows the shorter side for a cuboid.
    const depth = Math.max(32, Math.round(Math.min(width, height)));

    const scene = document.createElement('span');
    scene.setAttribute(SCENE_ATTR, '');
    scene.style.display = computed.display === 'block' ? 'block' : 'inline-block';
    scene.style.verticalAlign = computed.verticalAlign;
    scene.style.width = `${width}px`;
    scene.style.height = `${height}px`;
    scene.style.perspective = `${Math.round(Math.max(width, height) * 2.2)}px`;
    scene.style.perspectiveOrigin = '50% 50%';
    scene.style.lineHeight = '0';
    scene.style.borderRadius = computed.borderRadius;
    scene.style.overflow = 'visible';
    scene.style.setProperty('--gmixer-cube-w', `${width}px`);
    scene.style.setProperty('--gmixer-cube-h', `${height}px`);
    scene.style.setProperty('--gmixer-cube-d', `${depth}px`);
    scene.style.setProperty('--gmixer-cube-half-w', `${width / 2}px`);
    scene.style.setProperty('--gmixer-cube-half-d', `${depth / 2}px`);

    const cube = document.createElement('span');
    cube.setAttribute(CUBE_ATTR, '');

    const faces = [
      { name: 'front', content: element },
      { name: 'back', content: cloneFaceMedia(element) },
      { name: 'right', content: cloneFaceMedia(element) },
      { name: 'left', content: cloneFaceMedia(element) },
    ];

    element.parentNode?.insertBefore(scene, element);
    scene.appendChild(cube);

    for (const face of faces) {
      const panel = document.createElement('span');
      panel.setAttribute(FACE_ATTR, face.name);
      panel.appendChild(face.content);
      cube.appendChild(panel);
    }
  }
}

/**
 * @param {HTMLElement} element
 * @returns {HTMLElement}
 */
function cloneFaceMedia(element) {
  const clone = /** @type {HTMLElement} */ (element.cloneNode(true));
  clone.removeAttribute('id');
  clone.setAttribute('aria-hidden', 'true');
  for (const img of clone.querySelectorAll?.('img') || []) {
    img.setAttribute(FACE_ATTR, 'clone');
    img.removeAttribute('id');
  }
  if (clone.tagName === 'IMG') clone.setAttribute(FACE_ATTR, 'clone');
  return clone;
}

function removeCubes() {
  for (const scene of document.querySelectorAll(`[${SCENE_ATTR}]`)) {
    const front = scene.querySelector(`[${FACE_ATTR}="front"]`);
    const original = front?.firstElementChild;
    const parent = scene.parentNode;
    if (parent && original) {
      parent.insertBefore(original, scene);
    }
    scene.remove();
  }
}
