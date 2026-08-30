import {
  TEXTURE_PREVIEW_SELECTORS,
  TEXTURE_SURFACES,
  normalizeTexture,
  texturePatternDeclarations,
  textureSurfaceEnabled,
} from '../config/texture-catalog.js';
import { isDeferredSection } from '../settings/customization-level.js';

/**
 * Whether Live Preview should inject texture CSS for this global state.
 * @param {object|null|undefined} global
 */
export function previewTextureActive(global) {
  // Texture UI/paint suspended for 0.1.0 (RELEASE-GOALS.md); return in 0.1.1.
  if (isDeferredSection('texture')) return false;
  if (!global || global.sections?.texture !== true) return false;
  const texture = normalizeTexture(global.texture);
  if (texture.mode === 'none') return false;
  return TEXTURE_SURFACES.some((surface) => texture.surfaces[surface.id]);
}

/**
 * Scoped CSS for the live theme preview blurb (settings + walkthrough).
 * Stage 2b: preview only — not page paint.
 *
 * @param {object|null|undefined} textureRaw
 * @param {string} [root='.theme-preview']
 * @returns {string}
 */
export function buildPreviewTextureCss(textureRaw, root = '.theme-preview') {
  const texture = normalizeTexture(textureRaw);
  if (texture.mode === 'none') return '';

  const pattern = texturePatternDeclarations(texture);
  const rot = texture.mode === 'grid' ? texture.gridRotation : 0;
  /** @type {string[]} */
  const rules = [];

  for (const surface of TEXTURE_SURFACES) {
    if (!textureSurfaceEnabled(texture, surface.id)) continue;
    const sel = TEXTURE_PREVIEW_SELECTORS[surface.id];
    if (!sel) continue;
    const scoped = sel
      .split(',')
      .map((part) => `${root} ${part.trim()}`)
      .join(', ');

    if (surface.family === 'fill' || surface.family === 'media') {
      const opacity = surface.family === 'media' ? 0.42 : 0.55;
      rules.push(`${scoped} {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}
${scoped}::after {
  content: '';
  position: absolute;
  inset: ${surface.family === 'fill' && rot ? '-35%' : '0'};
  ${pattern};
  ${rot ? `transform: rotate(${rot}deg); transform-origin: center;` : ''}
  pointer-events: none;
  opacity: ${opacity};
  mix-blend-mode: soft-light;
  border-radius: inherit;
}`);
      continue;
    }

    // Text family — patterned wash clipped to glyphs.
    rules.push(`${scoped} {
  ${pattern};
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}`);
  }

  return rules.join('\n');
}
