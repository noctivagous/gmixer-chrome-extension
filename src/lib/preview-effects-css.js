import { normalizeEffects } from '../config/effects-catalog.js';

/**
 * Scoped CSS for the live theme preview blurb (settings + walkthrough).
 * Mirrors page effects in miniature without page-wide selectors.
 *
 * @param {object|null|undefined} effects
 * @param {{ accent?: string }} palette
 * @param {string} [root='.theme-preview']
 * @returns {string}
 */
export function buildPreviewEffectsCss(effects, palette, root = '.theme-preview') {
  const normalized = normalizeEffects(effects);
  const accent = palette?.accent || '#a78bfa';
  const glowColor = normalized.glow.color || accent;
  /** @type {string[]} */
  const rules = [];

  const img = `${root} .blurb-image`;
  const imgWrap = `${root} .blurb-image-wrap`;
  const nav = `${root} .blurb-button, ${root} .blurb-link`;
  const link = `${root} .blurb-link`;
  const blurb = `${root} .blurb`;

  const imageEffect = normalized.categories.images.effect;
  const navEffect = normalized.categories.navigation.effect;
  const articleEffect = normalized.categories.articles.effect;

  const usesAnimatedGlow =
    normalized.glow.animated &&
    (imageEffect === 'glow' || navEffect === 'glow');

  if (usesAnimatedGlow) {
    rules.push(`@keyframes gmixer-preview-glow-pulse {
  0%, 100% { filter: drop-shadow(0 0 1px ${glowColor}); }
  50% { filter: drop-shadow(0 0 8px ${glowColor}); }
}`);
    rules.push(`@keyframes gmixer-preview-glow-box-pulse {
  0%, 100% { box-shadow: 0 0 4px ${glowColor}; }
  50% { box-shadow: 0 0 14px ${glowColor}; }
}`);
  }

  if (imageEffect === 'glow') {
    rules.push(
      normalized.glow.animated
        ? `${img} { animation: gmixer-preview-glow-box-pulse 2.4s ease-in-out infinite; }`
        : `${img} { box-shadow: 0 0 12px ${glowColor}; }`
    );
  } else if (imageEffect === 'pan-scan') {
    const { speed, zoom, loop } = normalized.panScan;
    const zoomScale = 1 + zoom / 100;
    rules.push(`${imgWrap} { overflow: hidden; border-radius: 4px; }`);
    if (loop === 'oscillate') {
      rules.push(`@keyframes gmixer-preview-pan-scan-oscillate {
  0% { transform: scale(1.04); }
  100% { transform: scale(${zoomScale}); }
}`);
      rules.push(
        `${img} { transform-origin: 35% 45%; animation: gmixer-preview-pan-scan-oscillate ${speed}s ease-in-out infinite alternate; }`
      );
    } else {
      rules.push(`@keyframes gmixer-preview-pan-scan-fade {
  0% { transform: scale(1); opacity: 1; }
  40% { transform: scale(${zoomScale}); opacity: 1; }
  70% { transform: scale(${zoomScale}); opacity: 0.72; }
  100% { transform: scale(1); opacity: 1; }
}`);
      rules.push(
        `${img} { transform-origin: 35% 45%; animation: gmixer-preview-pan-scan-fade ${speed}s ease-in-out infinite; }`
      );
    }
  } else if (imageEffect === 'rotating-cube') {
    rules.push(`@keyframes gmixer-preview-rotating-cube {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(360deg); }
}`);
    rules.push(`${imgWrap} { perspective: 420px; overflow: visible; }`);
    rules.push(
      `${img} { animation: gmixer-preview-rotating-cube 12s linear infinite; transform-style: preserve-3d; }`
    );
  }

  if (navEffect === 'glow') {
    rules.push(`${nav} { text-shadow: 0 0 8px ${glowColor}; }`);
    if (normalized.glow.animated) {
      rules.push(`${nav} { animation: gmixer-preview-glow-pulse 2.4s ease-in-out infinite; }`);
    }
  } else if (navEffect === 'flash') {
    rules.push(`@keyframes gmixer-preview-flash {
  0%, 90%, 100% { opacity: 1; }
  95% { opacity: 0.55; }
}`);
    rules.push(`${nav} { animation: gmixer-preview-flash 3s linear infinite; }`);
  }

  if (articleEffect === 'link-shimmer') {
    const sheen = accent;
    rules.push(`@keyframes gmixer-preview-link-shimmer {
  0% { transform: translateX(-120%); }
  100% { transform: translateX(220%); }
}`);
    rules.push(`${link} { position: relative; display: inline-block; overflow: hidden; }`);
    rules.push(`${link}::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
    105deg,
    transparent 38%,
    color-mix(in srgb, ${sheen} 55%, transparent) 50%,
    transparent 62%
  );
  animation: gmixer-preview-link-shimmer 1.35s ease-in-out infinite;
  pointer-events: none;
}`);
  }

  if (normalized.cursor.enabled) {
    rules.push(`${root} { cursor: ${normalized.cursor.style || 'default'}; }`);
  }

  if (normalized.backgroundMotion.enabled) {
    rules.push(`@keyframes gmixer-preview-bg-motion {
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}`);
    rules.push(
      `${blurb} { background-size: 200% 200% !important; animation: gmixer-preview-bg-motion 12s ease-in-out infinite alternate; }`
    );
  }

  return rules.filter(Boolean).join('\n');
}

/**
 * True when preview should render any effect styling.
 * @param {object|null|undefined} global
 */
export function previewEffectsActive(global) {
  if (!global || global.sections?.effects !== true) return false;
  const normalized = normalizeEffects(global.effects);
  if (normalized.cursor.enabled || normalized.backgroundMotion.enabled) return true;
  return Object.values(normalized.categories).some((slot) => slot.effect !== 'none');
}
