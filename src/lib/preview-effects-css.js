import { normalizeEffects } from '../config/effects-catalog.js';
import { resolveGlowColor } from './color-theory.js';

/**
 * Scoped CSS for the live theme preview blurb (settings + walkthrough).
 * Mirrors page effects in miniature without page-wide selectors.
 *
 * @param {object|null|undefined} effects
 * @param {{ accent?: string, link?: string, navLink?: string }} palette
 * @param {string} [root='.theme-preview']
 * @returns {string}
 */
export function buildPreviewEffectsCss(effects, palette, root = '.theme-preview') {
  const normalized = normalizeEffects(effects);
  const accent = palette?.accent || '#a78bfa';
  const bodyInk = palette?.link || accent;
  const navInk = palette?.navLink || bodyInk;
  const mediaGlowColor = resolveGlowColor(normalized.glow.color, accent);
  const linkGlowColor = resolveGlowColor(normalized.categories.hyperlinks.glow?.color, bodyInk);
  const navGlowColor = resolveGlowColor(normalized.categories.navigation.glow?.color, navInk);
  /** @type {string[]} */
  const rules = [];

  const img = `${root} .blurb-image`;
  const imgWrap = `${root} .blurb-image-wrap`;
  const cube = `${root} .blurb-cube`;
  const nav = `${root} .blurb-button, ${root} .blurb-nav-link`;
  const link = `${root} .blurb-link`;
  const blurb = `${root} .blurb`;

  const imageEffect = normalized.categories.images.effect;
  const imageMotion = normalized.categories.images.motion || 'none';
  const videoEffect = normalized.categories.videos.effect;
  const linkEffect = normalized.categories.hyperlinks.effect;
  const navEffect = normalized.categories.navigation.effect;
  const articleEffect = normalized.categories.articles.effect;
  const video = `${root} .blurb-video-thumb`;
  const card = `${root} .blurb-card`;
  const dropGlowBox = `4px 10px 20px ${mediaGlowColor}, 1px 3px 8px ${mediaGlowColor}`;
  const dropGlowText = (color) => `2px 4px 10px ${color}`;

  if (imageEffect === 'glow' && normalized.glow.animated) {
    rules.push(`@keyframes gmixer-preview-glow-box-pulse {
  0%, 100% { box-shadow: 0 0 4px ${mediaGlowColor}; }
  50% { box-shadow: 0 0 14px ${mediaGlowColor}; }
}`);
  }
  if (linkEffect === 'glow' && normalized.categories.hyperlinks.glow?.animated !== false) {
    rules.push(`@keyframes gmixer-preview-glow-pulse-link {
  0%, 100% { filter: drop-shadow(0 0 1px ${linkGlowColor}); }
  50% { filter: drop-shadow(0 0 8px ${linkGlowColor}); }
}`);
  }
  if (navEffect === 'glow' && normalized.categories.navigation.glow?.animated !== false) {
    rules.push(`@keyframes gmixer-preview-glow-pulse-nav {
  0%, 100% { filter: drop-shadow(0 0 1px ${navGlowColor}); }
  50% { filter: drop-shadow(0 0 8px ${navGlowColor}); }
}`);
  }

  if (imageEffect === 'glow') {
    rules.push(
      normalized.glow.animated
        ? `${img} { animation: gmixer-preview-glow-box-pulse 2.4s ease-in-out infinite; }`
        : `${img} { box-shadow: 0 0 12px ${mediaGlowColor}; }`
    );
  } else if (imageEffect === 'drop-glow') {
    rules.push(`${img} { box-shadow: ${dropGlowBox}; }`);
  }

  const usesMarquee =
    imageEffect === 'marquee' || videoEffect === 'marquee' || articleEffect === 'marquee';
  if (usesMarquee) {
    rules.push(`@property --gmixer-preview-marquee-angle {
  syntax: "<angle>";
  inherits: false;
  initial-value: 0deg;
}
@keyframes gmixer-preview-marquee-spin {
  to { --gmixer-preview-marquee-angle: 360deg; }
}`);
  }
  if (imageEffect === 'marquee') {
    rules.push(`${img} {
  --gmixer-preview-marquee-angle: 0deg;
  border: 2px solid transparent;
  border-image-source: conic-gradient(from var(--gmixer-preview-marquee-angle), transparent 0deg, ${mediaGlowColor} 48deg, transparent 110deg, transparent 180deg, ${mediaGlowColor} 228deg, transparent 290deg);
  border-image-slice: 1;
  animation: gmixer-preview-marquee-spin 2.6s linear infinite;
}`);
  }

  if (imageMotion === 'pan-scan') {
    const { speed, zoom, distance, loop, motion } = normalized.panScan;
    const zoomScale = 1 + zoom / 100;
    const travel = distance / 2;
    const x = motion === 'tilt' ? 0 : travel;
    const y = motion === 'pan' ? 0 : travel;
    rules.push(`${imgWrap} { overflow: hidden; border-radius: 4px; }`);
    if (loop === 'oscillate') {
      rules.push(`@keyframes gmixer-preview-pan-scan-oscillate {
  0% { transform: translate(${-x}%, ${-y}%) scale(1.04); }
  100% { transform: translate(${x}%, ${y}%) scale(${zoomScale}); }
}`);
      rules.push(
        `${img} { transform-origin: 35% 45%; animation: gmixer-preview-pan-scan-oscillate ${speed}s ease-in-out infinite alternate; }`
      );
    } else {
      rules.push(`@keyframes gmixer-preview-pan-scan-fade {
  0% { transform: translate(${-x}%, ${-y}%) scale(1); opacity: 1; }
  40% { transform: translate(${x}%, ${y}%) scale(${zoomScale}); opacity: 1; }
  70% { transform: translate(${x}%, ${y}%) scale(${zoomScale}); opacity: 0.72; }
  100% { transform: translate(${-x}%, ${-y}%) scale(1); opacity: 1; }
}`);
      rules.push(
        `${img} { transform-origin: 35% 45%; animation: gmixer-preview-pan-scan-fade ${speed}s ease-in-out infinite; }`
      );
    }
  } else if (imageMotion === 'rotating-cube') {
    rules.push(`@keyframes gmixer-preview-rotating-cube {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(360deg); }
}`);
    rules.push(`${imgWrap} { overflow: visible; }`);
    rules.push(
      `${cube} { animation: gmixer-preview-rotating-cube 12s linear infinite; }`
    );
  }

  if (videoEffect === 'glow') {
    rules.push(
      normalized.glow.animated
        ? `${video} { animation: gmixer-preview-glow-box-pulse 2.4s ease-in-out infinite; }`
        : `${video} { box-shadow: 0 0 12px ${mediaGlowColor}; }`
    );
  } else if (videoEffect === 'drop-glow') {
    rules.push(`${video} { box-shadow: ${dropGlowBox}; }`);
  } else if (videoEffect === 'marquee') {
    rules.push(`${video} {
  --gmixer-preview-marquee-angle: 0deg;
  outline: 2px solid color-mix(in srgb, ${mediaGlowColor} 70%, transparent);
  outline-offset: 2px;
  animation: gmixer-preview-marquee-spin 2.6s linear infinite;
}`);
  }

  if (linkEffect === 'glow') {
    rules.push(`${link} { text-shadow: 0 0 8px ${linkGlowColor}; }`);
    if (normalized.categories.hyperlinks.glow?.animated !== false) {
      rules.push(`${link} { animation: gmixer-preview-glow-pulse-link 2.4s ease-in-out infinite; }`);
    }
  } else if (linkEffect === 'drop-glow') {
    rules.push(`${link} { text-shadow: ${dropGlowText(linkGlowColor)}; }`);
  } else if (linkEffect === 'flash') {
    rules.push(`@keyframes gmixer-preview-flash-link {
  0%, 90%, 100% { opacity: 1; }
  95% { opacity: 0.55; }
}`);
    rules.push(`${link} { animation: gmixer-preview-flash-link 3s linear infinite; }`);
  }

  if (navEffect === 'glow') {
    rules.push(`${nav} { text-shadow: 0 0 8px ${navGlowColor}; }`);
    if (normalized.categories.navigation.glow?.animated !== false) {
      rules.push(`${nav} { animation: gmixer-preview-glow-pulse-nav 2.4s ease-in-out infinite; }`);
    }
  } else if (navEffect === 'drop-glow') {
    rules.push(`${nav} { text-shadow: ${dropGlowText(navGlowColor)}; }`);
  } else if (navEffect === 'flash') {
    rules.push(`@keyframes gmixer-preview-flash {
  0%, 90%, 100% { opacity: 1; }
  95% { opacity: 0.55; }
}`);
    rules.push(`${nav} { animation: gmixer-preview-flash 3s linear infinite; }`);
  }

  if (articleEffect === 'drop-glow') {
    rules.push(`${card} { box-shadow: ${dropGlowBox}; }`);
  } else if (articleEffect === 'marquee') {
    rules.push(`${card} {
  position: relative;
  --gmixer-preview-marquee-angle: 0deg;
}
${card}::after {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: inherit;
  pointer-events: none;
  padding: 2px;
  box-sizing: border-box;
  background: conic-gradient(from var(--gmixer-preview-marquee-angle), transparent 0deg, ${accent} 48deg, transparent 110deg, transparent 180deg, ${accent} 228deg, transparent 290deg);
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  animation: gmixer-preview-marquee-spin 2.6s linear infinite;
}`);
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
  if (normalized.categories.images.motion && normalized.categories.images.motion !== 'none') {
    return true;
  }
  return Object.values(normalized.categories).some((slot) => slot.effect !== 'none');
}
