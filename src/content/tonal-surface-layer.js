// Adds a dedicated background layer to rendered page surfaces. This keeps
// the original surface colors and content intact while allowing dark themes
// to tone them toward the generated theme background.

export const TONAL_SURFACE_CLASS = 'gmixer-tonal-surface';
export const TONAL_OVERLAY_CLASS = 'gmixer-tonal-overlay';

const SKIP_TAGS = new Set([
  'CANVAS',
  'IFRAME',
  'IMG',
  'LINK',
  'NOSCRIPT',
  'PICTURE',
  'SCRIPT',
  'SOURCE',
  'STYLE',
  'SVG',
  'VIDEO',
]);

const MAX_SCAN = 4000;

function isCandidate(element) {
  return (
    element.nodeType === Node.ELEMENT_NODE &&
    !SKIP_TAGS.has(element.tagName) &&
    !element.classList.contains(TONAL_OVERLAY_CLASS) &&
    !element.closest('#gmixer-settings') &&
    element.id !== 'gmixer-settings' &&
    element.id !== 'gmixer-hover-outline'
  );
}

function hasPaintedSurface(element) {
  const style = getComputedStyle(element);
  const backgroundColor = style.backgroundColor;
  const hasColor =
    backgroundColor &&
    backgroundColor !== 'transparent' &&
    !backgroundColor.endsWith(', 0)') &&
    !backgroundColor.endsWith('/ 0)');
  const hasImage = style.backgroundImage && style.backgroundImage !== 'none';
  return hasColor || hasImage;
}

/** Add one overlay layer to each rendered surface under `root` (default: body). */
export function ensureTonalSurfaceLayers(root = document.body) {
  if (!root || typeof root.querySelectorAll !== 'function') return;

  const scope =
    root.nodeType === Node.ELEMENT_NODE && root !== document.body
      ? [root, ...Array.from(root.querySelectorAll('*'))]
      : Array.from(root.querySelectorAll('*'));

  let scanned = 0;
  for (const element of scope) {
    if (scanned >= MAX_SCAN) break;
    if (!isCandidate(element)) continue;
    scanned++;
    if (!hasPaintedSurface(element)) continue;

    element.classList.add(TONAL_SURFACE_CLASS);
    if (element.querySelector(`:scope > .${TONAL_OVERLAY_CLASS}`)) continue;

    const overlay = document.createElement('span');
    overlay.className = TONAL_OVERLAY_CLASS;
    overlay.setAttribute('aria-hidden', 'true');
    element.prepend(overlay);
  }
}

/** Remove layers/classes when the tonal strategy is no longer needed. */
export function removeTonalSurfaceLayers() {
  document.querySelectorAll(`.${TONAL_OVERLAY_CLASS}`).forEach((overlay) => overlay.remove());
  document.querySelectorAll(`.${TONAL_SURFACE_CLASS}`).forEach((element) => {
    element.classList.remove(TONAL_SURFACE_CLASS);
  });
}
