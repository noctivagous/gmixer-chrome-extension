// Stamp classified logos that have transparent pixels so glow can follow
// the glyph instead of a tightly cropped box.
import { LOGO_ALPHA_ATTR, MEDIA_ATTR } from './page-classifier.js';

const SAMPLE = 48;
const OPAQUE_ALPHA = 250;

function looksLikeSvg(src) {
  return /\.svg(\?|#|$)/i.test(src) || /^data:image\/svg/i.test(src);
}

function looksLikeAlphaFile(src) {
  return (
    looksLikeSvg(src) ||
    /\.(png|webp|gif)(\?|#|$)/i.test(src) ||
    /^data:image\/(png|webp|gif)/i.test(src)
  );
}

/**
 * @param {HTMLImageElement} img
 * @returns {boolean}
 */
export function imageHasTransparency(img) {
  const src = img.currentSrc || img.src || '';
  if (looksLikeSvg(src)) return true;
  if (!img.complete || !img.naturalWidth) return looksLikeAlphaFile(src);
  try {
    const w = Math.max(1, Math.min(img.naturalWidth, SAMPLE));
    const h = Math.max(1, Math.min(img.naturalHeight, SAMPLE));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return looksLikeAlphaFile(src);
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < OPAQUE_ALPHA) return true;
    }
    return false;
  } catch {
    return looksLikeAlphaFile(src);
  }
}

function stampOne(img) {
  if (imageHasTransparency(img)) img.setAttribute(LOGO_ALPHA_ATTR, '');
  else img.removeAttribute(LOGO_ALPHA_ATTR);
}

/**
 * @param {ParentNode} [root]
 */
export function stampLogoAlpha(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return 0;
  const logos = root.querySelectorAll(`img[${MEDIA_ATTR}="logo"]`);
  let stamped = 0;
  for (const img of logos) {
    if (img.complete && img.naturalWidth) {
      stampOne(img);
      stamped += 1;
      continue;
    }
    img.addEventListener(
      'load',
      () => {
        stampOne(img);
      },
      { once: true }
    );
  }
  return stamped;
}
