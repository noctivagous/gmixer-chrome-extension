// Builds and injects the override <style> tag that actually re-themes the
// page. Deliberately CSS-only (no per-element JS styling) so it can be
// generated once per state change and applies live to any element the
// selectors match — including nodes added later, without extra JS work.
import {
  deriveSurfaceLadder,
  hexToHsl,
  resolveGlowColor,
} from '../lib/color-theory.js';
import {
  applyColorOverrides,
  resolveEffectivePalette,
} from '../lib/effective-palette.js';
import { resolveImageFilterPreset } from '../config/image-filter-presets.js';
import { normalizeEffects } from '../config/effects-catalog.js';
import { getFontById } from '../config/fonts.js';
import { getThemePackById } from '../config/theme-packs.js';
import { fontFaceRules } from '../lib/font-faces.js';
import { cornersRule } from '../lib/corners-css.js';
import { blendWithPageSample, deriveBrandFamily } from './page-sampler.js';
import { sectionAllowedByFocus } from '../settings/settings-focus.js';
import { sectionAllowedByCustomizationLevel } from '../settings/customization-level.js';
import { collectOpenShadowRoots, isGmixerUiShadowRoot } from './open-trees.js';

export { PALETTE_FILTER_PRESETS, resolveImageFilterPreset } from '../config/image-filter-presets.js';

export const STYLE_ELEMENT_ID = 'gmixer-style';
const HOST_STYLE_ID = 'gmixer-settings-host-style';
/** Page overlay paint must not hit our Popover API hosts. */
const GMIXER_UI_HOST_NOT = ':not(#gmixer-settings):not(#gmixer-walkthrough-host)';

// Safer than "p, li, span, div" — avoid restyling every layout node and
// wrecking icon fonts / UI chrome that happens to live in a span/div.
//
// Typography roles keep headings, UI chrome, prose, code, and captions
// independent. Heading slots are emitted separately so h1-h6 can be
// customized individually; legacy headers/subheadings state is used as a
// fallback for persisted settings from before heading slots existed.
const TARGET_SELECTORS = {
  paragraph:
    'p, li, td, th, blockquote, article, main, [role="main"], .content, .post, .entry-content',
  ui:
    'button, [role="button"], input, textarea, select, label, ' +
    'nav a, nav li, nav button, [role="navigation"] a, [role="navigation"] li, ' +
    '[role="tab"], [role="menuitem"], [role="menu"], .btn, [class*="btn-"], .button',
  code: 'pre, code, kbd, samp, var',
  captions: 'figcaption, caption, small, time, .caption, [class*="caption"]',
};

function fontRule(target, fontConfig) {
  const font = getFontById(fontConfig?.fontId);
  if (!font) return '';
  return `${TARGET_SELECTORS[target]} { font-family: ${font.family} !important; }`;
}

function headingFontRules(fonts) {
  const fallback = {
    h1: fonts?.headers,
    h2: fonts?.subheadings,
    h3: fonts?.subheadings,
    h4: fonts?.subheadings,
    h5: fonts?.subheadings,
    h6: fonts?.subheadings,
  };
  const headings = fonts?.headings || {};
  return Object.entries(fallback)
    .map(([tag, legacyConfig]) => {
      const config = headings[tag] || legacyConfig;
      const font = getFontById(config?.fontId);
      if (!font) return '';
      const level = tag.slice(1);
      const role = `[role="heading"][aria-level="${level}"]`;
      // Sites often wrap headline text in <a>; page `a { font-family }` would
      // otherwise override the heading face. Match color's heading-link treatment.
      return (
        `${tag}, ${role}, ${tag} a, ${role} a ` +
        `{ font-family: ${font.family} !important; }`
      );
    })
    .join('\n');
}

/**
 * When the page already has strong heading hierarchy, leave sizes alone.
 * When it's flat (low variance), apply a gentle scale so restyle doesn't
 * invent a hierarchy the page never had — just a mild lift.
 */
function headingScaleRules(headerSizeVariance) {
  if (headerSizeVariance == null) return '';
  if (headerSizeVariance >= 0.35) return ''; // page already has hierarchy
  return `
    h1, [role="heading"][aria-level="1"] { font-size: 1.65em !important; }
    h2, [role="heading"][aria-level="2"] { font-size: 1.4em !important; }
    h3, [role="heading"][aria-level="3"] { font-size: 1.2em !important; }
  `;
}

// CSS `[style*="background-image"]` only catches inline styles — most
// sites set hero/card background images from an external stylesheet class,
// which CSS alone can't detect. `BACKGROUND_IMAGE_ATTR` is a data attribute
// that background-image-tagger.js stamps onto elements after checking
// computed style, so this selector also reaches those.
export const BACKGROUND_IMAGE_ATTR = 'data-gmixer-bgimg';

/** sepia(1) lands near ~35deg; rotate from there to a palette hex hue. */
function hueRotateFromSepia(hex) {
  const hue = hexToHsl(hex ?? '#7c3aed').h;
  return Math.round(((hue - 35) % 360 + 360) % 360);
}

/**
 * @param {string} preset
 * @param {{ accent?: string, link?: string, isDark?: boolean }} palette
 * @param {string} [customFilter]
 * @param {{ colorOn?: boolean }} [options]
 */
export function imageFilterPresetCss(preset, palette, customFilter, options = {}) {
  const resolved = resolveImageFilterPreset(preset, options.colorOn !== false);
  const accentRotate = hueRotateFromSepia(palette.accent);
  const linkRotate = hueRotateFromSepia(palette.link ?? palette.accent);
  const presets = {
    grayscale: 'grayscale(1)',
    sepia: 'sepia(0.8)',
    invert: 'invert(1)',
    // Adaptive: dark themes want the wash brightened slightly (grayscale
    // photos read muddy on dark backgrounds), light themes want it left
    // closer to neutral so it doesn't blow out highlights.
    monochrome: palette.isDark
      ? 'grayscale(1) contrast(1.1) brightness(1.08)'
      : 'grayscale(1) contrast(1.08) brightness(0.98)',
    duotone: `grayscale(1) sepia(1) hue-rotate(${accentRotate}deg) saturate(1.4)`,
    // Softer brand cast than full duotone.
    'accent-tint': `grayscale(1) sepia(0.55) hue-rotate(${accentRotate}deg) saturate(0.85)`,
    'link-wash': `grayscale(1) sepia(1) hue-rotate(${linkRotate}deg) saturate(1.4)`,
    custom: customFilter || 'none',
  };
  return presets[resolved] ?? 'none';
}

function backgroundOverlayForPreset(preset, palette) {
  if (preset === 'invert') {
    return { color: '#ffffff', blend: 'difference', opacity: 1 };
  }
  if (preset === 'duotone' || preset === 'sepia') {
    return { color: palette.accent, blend: 'color', opacity: 0.72 };
  }
  if (preset === 'accent-tint') {
    return { color: palette.accent, blend: 'color', opacity: 0.45 };
  }
  if (preset === 'link-wash') {
    return { color: palette.link || palette.accent, blend: 'color', opacity: 0.72 };
  }
  return { color: '#808080', blend: 'saturation', opacity: 0.72 };
}

function imageFilterRule(filter, palette, options = {}) {
  if (!filter?.enabled) return '';
  const applyToImages = filter.scope !== 'backgrounds';
  const applyToBackgrounds = filter.scope !== 'images';
  const colorOn = options.colorOn !== false;
  const effectivePreset = resolveImageFilterPreset(filter.preset, colorOn);
  const value = imageFilterPresetCss(filter.preset, palette, filter.customFilter, { colorOn });
  const rules = [];

  if (applyToImages) {
    // Filter the visible replaced elements — not <source>, which never paints.
    rules.push(`img, video { filter: ${value} !important; }`);
    if (filter.revealOnHover) {
      rules.push(`img:hover, video:hover,
picture:hover img, picture:hover video,
a:hover img, a:hover video,
figure:hover img, figure:hover video {
  filter: none !important;
}`);
    }
  }

  if (!applyToBackgrounds) return rules.join('\n');

  // Never put filter/background declarations on the element that owns the
  // page's background-image: that also filters its text and can replace the
  // site's image. A separate layer blends over the original image instead.
  const overlay = backgroundOverlayForPreset(effectivePreset, palette);
  rules.push(`
    [${BACKGROUND_IMAGE_ATTR}] {
      position: relative !important;
      isolation: isolate !important;
    }
    [${BACKGROUND_IMAGE_ATTR}] > .gmixer-bgimg-overlay {
      position: absolute !important;
      inset: 0 !important;
      z-index: 0 !important;
      pointer-events: none !important;
      background: ${overlay.color} !important;
      opacity: ${overlay.opacity} !important;
      mix-blend-mode: ${overlay.blend} !important;
    }
    [${BACKGROUND_IMAGE_ATTR}] > .gmixer-bgimg-overlay ~ * {
      position: relative;
      z-index: 1;
    }
    ${
      filter.revealOnHover
        ? `[${BACKGROUND_IMAGE_ATTR}]:hover > .gmixer-bgimg-overlay { opacity: 0 !important; }`
        : ''
    }
  `);

  return rules.filter(Boolean).join('\n');
}

function themeMediaRule(activeThemePackId, mediaOverrides, palette, revealOnHover, options = {}) {
  const packMedia = getThemePackById(activeThemePackId)?.media;
  if (!packMedia) return '';
  const media = { ...packMedia };
  for (const [role, override] of Object.entries(mediaOverrides || {})) {
    media[role] = { ...(media[role] || {}), ...override };
  }
  const colorOn = options.colorOn !== false;

  return Object.entries(media)
    .filter(([role]) => role !== 'defaultFilter')
    .map(([role, style]) => {
      const selector = `[data-gmixer-media="${role}"], [data-gmixer-role="${role}"]`;
      const filterSelector = selector
        .split(',')
        .map((part) => `${part.trim()}:not([${BACKGROUND_IMAGE_ATTR}])`)
        .join(', ');
      const declarations = [];
      const rules = [];
      if (style?.filter && style.filter !== 'auto' && style.filter !== 'original') {
        rules.push(
          `${filterSelector} { filter: ${imageFilterPresetCss(style.filter, palette, '', { colorOn })} !important; }`
        );
      }
      if (style?.outline === 'accent') {
        declarations.push('outline: 2px solid var(--gmixer-accent) !important; outline-offset: 2px;');
      }
      if (declarations.length) {
        rules.push(`${selector} { ${declarations.join(' ')} }`);
      }
      if (revealOnHover && style?.filter && style.filter !== 'auto' && style.filter !== 'original') {
        rules.push(`${filterSelector}:hover { filter: none !important; }`);
      }
      return rules.join('\n');
    })
    .filter(Boolean)
    .join('\n');
}

function clippingRule(clipping) {
  if (!clipping?.enabled || clipping.preset === 'none') return '';
  const scopes = {
    images: 'img, video, picture',
    cards: '.card, [class*="card"], article, section, aside',
    buttons: 'button, [role="button"], input[type="button"], input[type="submit"]',
    all: 'img, video, picture, button, [role="button"], .card, [class*="card"], article, section, aside',
  };
  const targets = scopes[clipping.scope] ?? scopes.cards;

  // corner-shape / superellipse — Opera GX current-Chromium-only.
  const shapes = {
    round: 'corner-shape: superellipse(2); border-radius: 14px;',
    notch: 'corner-shape: bevel; border-radius: 10px;',
    mixed:
      'corner-shape: superellipse(2) bevel superellipse(2) bevel; border-radius: 14px 10px 14px 10px;',
  };

  return `${targets} { ${shapes[clipping.preset] ?? ''} }`;
}

const EFFECTS_IMAGE_SELECTORS = 'img, picture img';
const EFFECTS_VIDEO_SELECTORS = 'video';
const CHROME_LINK_SELECTORS = [
  'header a',
  'footer a',
  'nav a',
  '[role="banner"] a',
  '[role="contentinfo"] a',
  '[role="navigation"] a',
  '[data-gmixer-role="header"] a',
  '[data-gmixer-role="footer"] a',
  '[data-gmixer-role="navigation"] a',
];
const HEADING_LINK_SELECTORS = [
  'h1 a',
  'h2 a',
  'h3 a',
  'h4 a',
  'h5 a',
  'h6 a',
  '[role="heading"] a',
];
const EFFECTS_NAV_SELECTORS = [...CHROME_LINK_SELECTORS, 'button', '[role="button"]'].join(', ');
const EFFECTS_BODY_LINK_CANCEL_SELECTORS = [...CHROME_LINK_SELECTORS, ...HEADING_LINK_SELECTORS].join(
  ', '
);

function chromeLinkSelectorList(suffix = '') {
  const base = CHROME_LINK_SELECTORS.map((selector) => `${selector}${suffix}`);
  const nested = CHROME_LINK_SELECTORS.map((selector) => `[data-gmixer-role] ${selector}${suffix}`);
  return [...base, ...nested].join(',\n    ');
}

function textGlowKeyframes(name, color) {
  return `@keyframes ${name} {
  0%, 100% { filter: drop-shadow(0 0 2px ${color}); }
  50% { filter: drop-shadow(0 0 10px ${color}); }
}`;
}

function boxGlowKeyframes(name, color, spreadPx = 0) {
  const spread = spreadPx ? ` ${spreadPx}px` : '';
  return `@keyframes ${name} {
  0%, 100% { box-shadow: 0 0 4px${spread} ${color}; }
  50% { box-shadow: 0 0 14px${spread} ${color}; }
}`;
}

function dropGlowKeyframes(name, color) {
  return `@keyframes ${name} {
  0%, 100% { filter: drop-shadow(0 0 4px ${color}); }
  50% { filter: drop-shadow(0 0 14px ${color}); }
}`;
}

/** Direct parent overflow:hidden crops drop-shadow on the child. */
function unclipGlow(selectors) {
  const items = selectors
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const self = items.join(', ');
  const parents = items.map((item) => `:has(> ${item})`).join(', ');
  return `${self},
${parents} {
  overflow: visible !important;
}
:has(> a) > a {
  border-radius: inherit;
}
:has(> a) > a img,
:has(> a) > a video,
:has(> a) > a picture {
  border-radius: inherit;
}`;
}

function effectsRules(effects, palette) {
  const normalized = normalizeEffects(effects);
  const rules = [];
  const mediaGlowColor = resolveGlowColor(normalized.glow.color, palette.accent);
  const categories = normalized.categories;

  const imageEffect = categories.images.effect;
  const videoEffect = categories.videos.effect;
  const linkEffect = categories.hyperlinks.effect;
  const navEffect = categories.navigation.effect;
  const bodyInk = palette.link || palette.accent;
  const navInk = palette.navLink || bodyInk;
  const linkGlowColor = resolveGlowColor(categories.hyperlinks.glow?.color, bodyInk);
  const navGlowColor = resolveGlowColor(categories.navigation.glow?.color, navInk);

  if ((imageEffect === 'glow' || videoEffect === 'glow') && normalized.glow.animated) {
    rules.push(boxGlowKeyframes('gmixer-glow-box-pulse', mediaGlowColor));
  }
  if (linkEffect === 'glow' && categories.hyperlinks.glow?.animated !== false) {
    rules.push(textGlowKeyframes('gmixer-glow-pulse-link', linkGlowColor));
  }
  if (navEffect === 'glow' && categories.navigation.glow?.animated !== false) {
    rules.push(textGlowKeyframes('gmixer-glow-pulse-nav', navGlowColor));
  }

  if (imageEffect === 'glow') {
    rules.push(unclipGlow(EFFECTS_IMAGE_SELECTORS));
    // Prefer box-shadow so Media section filter: !important does not wipe glow.
    // Logos are cropped tight: outset the box 3px. Transparent logos skip the
    // box (it would halo empty corners) and pulse a drop-shadow on the glyph.
    const nonLogoImages = EFFECTS_IMAGE_SELECTORS.split(',')
      .map((part) => `${part.trim()}:not([data-gmixer-media="logo"])`)
      .join(', ');
    const opaqueLogo = '[data-gmixer-media="logo"]:not([data-gmixer-alpha])';
    const alphaLogo = '[data-gmixer-media="logo"][data-gmixer-alpha]';
    if (normalized.glow.animated) {
      rules.push(boxGlowKeyframes('gmixer-glow-logo-box-pulse', mediaGlowColor, 3));
      rules.push(dropGlowKeyframes('gmixer-glow-logo-drop-pulse', mediaGlowColor));
      rules.push(`${nonLogoImages} { animation: gmixer-glow-box-pulse 2.4s ease-in-out infinite; }`);
      rules.push(`${opaqueLogo} { animation: gmixer-glow-logo-box-pulse 2.4s ease-in-out infinite; }`);
      rules.push(`${alphaLogo} { animation: gmixer-glow-logo-drop-pulse 2.4s ease-in-out infinite; }`);
    } else {
      rules.push(`${nonLogoImages} { box-shadow: 0 0 12px ${mediaGlowColor}; }`);
      rules.push(`${opaqueLogo} { box-shadow: 0 0 12px 3px ${mediaGlowColor}; }`);
      rules.push(`${alphaLogo} { filter: drop-shadow(0 0 12px ${mediaGlowColor}); }`);
    }
  } else if (imageEffect === 'pan-scan') {
    const { speed, zoom, loop } = normalized.panScan;
    const zoomScale = 1 + zoom / 100;
    // Per-image --gmixer-pan-ox/oy are 9×9 grid origins set by pan-scan.js.
    const ox = `var(--gmixer-pan-ox, 50%)`;
    const oy = `var(--gmixer-pan-oy, 50%)`;
    const fz = `var(--gmixer-pan-zoom, ${zoomScale})`;
    const targetSel = `[data-gmixer-pan-scan-target="${loop}"]`;

    if (loop === 'oscillate') {
      rules.push(`@keyframes gmixer-pan-scan-oscillate {
  0% { transform: scale(1.04); }
  100% { transform: scale(${fz}); }
}
${targetSel} {
  transform-origin: ${ox} ${oy};
  animation: gmixer-pan-scan-oscillate ${speed}s ease-in-out infinite alternate;
}`);
    } else {
      // Cross-dissolve: zoom toward a grid point, hold, dissolve into a rest
      // twin at original framing, jump-cut primary back, then next grid point.
      rules.push(`@keyframes gmixer-pan-scan-fade {
  0% { transform: scale(1); opacity: 1; }
  12% { transform: scale(1.04); opacity: 1; }
  40% { transform: scale(${fz}); opacity: 1; }
  62% { transform: scale(${fz}); opacity: 1; }
  78% { transform: scale(${fz}); opacity: 0; }
  79% { transform: scale(1); opacity: 0; }
  92% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes gmixer-pan-scan-rest {
  0%, 62% { opacity: 0; }
  78%, 88% { opacity: 1; }
  100% { opacity: 0; }
}
${targetSel} {
  transform-origin: ${ox} ${oy};
  animation: gmixer-pan-scan-fade ${speed}s ease-in-out infinite;
}
[data-gmixer-pan-scan-rest] {
  transform: none !important;
  transform-origin: center center;
  animation: gmixer-pan-scan-rest ${speed}s ease-in-out infinite;
}`);
    }
  } else if (imageEffect === 'rotating-cube') {
    // Horizontal spin on the Y axis. Front/back keep the image aspect (W×H);
    // left/right use depth×H. Depth vars come from rotating-cube.js.
    rules.push(`@keyframes gmixer-rotating-cube {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(360deg); }
}
[data-gmixer-rotating-cube-scene] {
  position: relative;
  transform-style: preserve-3d;
}
[data-gmixer-rotating-cube] {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transform-origin: center center;
  animation: gmixer-rotating-cube 12s linear infinite;
}
[data-gmixer-rotating-cube-face] {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  background: #111;
  transform-style: preserve-3d;
  box-sizing: border-box;
}
[data-gmixer-rotating-cube-face] > img,
[data-gmixer-rotating-cube-face] > picture,
[data-gmixer-rotating-cube-face] > picture img {
  width: 100% !important;
  height: 100% !important;
  max-width: none !important;
  max-height: none !important;
  object-fit: cover !important;
  display: block !important;
}
[data-gmixer-rotating-cube-face="front"],
[data-gmixer-rotating-cube-face="back"] {
  inset: 0;
  width: 100%;
  height: 100%;
}
[data-gmixer-rotating-cube-face="front"] {
  transform: translateZ(var(--gmixer-cube-half-d, 40px));
}
[data-gmixer-rotating-cube-face="back"] {
  transform: rotateY(180deg) translateZ(var(--gmixer-cube-half-d, 40px));
}
[data-gmixer-rotating-cube-face="right"],
[data-gmixer-rotating-cube-face="left"] {
  top: 0;
  left: 50%;
  width: var(--gmixer-cube-d, 80px);
  height: 100%;
  margin-left: calc(var(--gmixer-cube-d, 80px) / -2);
}
[data-gmixer-rotating-cube-face="right"] {
  transform: rotateY(90deg) translateZ(var(--gmixer-cube-half-w, 60px));
}
[data-gmixer-rotating-cube-face="left"] {
  transform: rotateY(-90deg) translateZ(var(--gmixer-cube-half-w, 60px));
}`);
  }

  if (videoEffect === 'glow') {
    rules.push(unclipGlow(EFFECTS_VIDEO_SELECTORS));
    rules.push(
      normalized.glow.animated
        ? `${EFFECTS_VIDEO_SELECTORS} { animation: gmixer-glow-box-pulse 2.4s ease-in-out infinite; }`
        : `${EFFECTS_VIDEO_SELECTORS} { box-shadow: 0 0 12px ${mediaGlowColor}; }`
    );
  }

  if (linkEffect === 'glow' || linkEffect === 'flash') {
    if (linkEffect === 'glow') {
      const animated = categories.hyperlinks.glow?.animated !== false;
      rules.push(unclipGlow('a'));
      rules.push(`a { text-shadow: 0 0 8px ${linkGlowColor}; }`);
      if (animated) {
        rules.push(`a { animation: gmixer-glow-pulse-link 2.4s ease-in-out infinite; }`);
      }
    } else {
      rules.push(`@keyframes gmixer-flash-link { 0%, 90%, 100% { opacity: 1; } 95% { opacity: 0.6; } }
a { animation: gmixer-flash-link 3s linear infinite; }`);
    }
    rules.push(
      `${EFFECTS_BODY_LINK_CANCEL_SELECTORS} { text-shadow: none; animation: none; filter: none; }`
    );
  }

  if (navEffect === 'glow') {
    const animated = categories.navigation.glow?.animated !== false;
    rules.push(unclipGlow('a, button, [role="button"]'));
    rules.push(`${EFFECTS_NAV_SELECTORS} { text-shadow: 0 0 8px ${navGlowColor}; }`);
    if (animated) {
      rules.push(
        `${EFFECTS_NAV_SELECTORS} { animation: gmixer-glow-pulse-nav 2.4s ease-in-out infinite; }`
      );
    }
  } else if (navEffect === 'flash') {
    rules.push(`@keyframes gmixer-flash-nav { 0%, 90%, 100% { opacity: 1; } 95% { opacity: 0.6; } }
${EFFECTS_NAV_SELECTORS} { animation: gmixer-flash-nav 3s linear infinite; }`);
  }

  if (categories.articles?.effect === 'link-shimmer') {
    // Soft sheen only — no border/outline. Color follows theme accent/swatch
    // via --gmixer-shimmer-color on the overlay (fallback: palette accent).
    const sheen = `var(--gmixer-shimmer-color, ${palette.accent})`;
    rules.push(`@keyframes gmixer-link-shimmer-sweep {
  0% { background-position: -140% 0; }
  100% { background-position: 240% 0; }
}
.gmixer-link-shimmer-overlay {
  position: fixed !important;
  z-index: 2147483646 !important;
  pointer-events: none !important;
  box-sizing: border-box !important;
  border: 0 !important;
  outline: none !important;
  box-shadow: none !important;
  border-radius: 2px !important;
  background-image: linear-gradient(
    105deg,
    transparent 38%,
    color-mix(in srgb, ${sheen} 42%, transparent) 50%,
    transparent 62%
  ) !important;
  background-color: transparent !important;
  background-size: 240% 100% !important;
  background-repeat: no-repeat !important;
  animation: gmixer-link-shimmer-sweep 1.35s ease-in-out 1 both !important;
}`);
  }

  if (normalized.cursor.enabled) {
    rules.push(`html, body { cursor: ${normalized.cursor.style || 'default'}; }`);
  }

  if (normalized.backgroundMotion.enabled) {
    rules.push(
      `@keyframes gmixer-bg-motion { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
       html { background-size: 200% 200% !important; animation: gmixer-bg-motion 12s ease-in-out infinite alternate; }`
    );
  }

  return rules.filter(Boolean).join('\n');
}

/**
 * Header / nav chrome — semantic + classified only. Sites that fill headers via
 * CSS variables (e.g. `background-color: var(--site-header-background-color)`)
 * are handled by remapping those vars on the same selectors, not by naming
 * individual components or hosts.
 */
const HEADER_CHROME_SELECTORS = [
  'body header',
  'body [role="banner"]',
  'body .masthead',
  'body #header',
  'body #masthead',
  'body [data-gmixer-role="header"]',
].join(',\n    ');

const NAV_CHROME_SELECTORS = [
  'body nav',
  'body [role="navigation"]',
  'body .nav',
  'body .navbar',
  'body [data-gmixer-role="navigation"]',
].join(',\n    ');

function themeTokenCss(role, surfaceGui, surfaceContainers, ladder, isDark, brandFamily) {
  return `
    :root {
      --gmixer-bg-primary: ${role('background')};
      --gmixer-bg-secondary: ${role('backgroundSecondary')};
      --gmixer-bg: var(--gmixer-bg-primary);
      --gmixer-surface-gui: ${role('surfaceGui') || role('surface') || surfaceGui};
      --gmixer-surface-containers: ${role('surfaceContainers') || surfaceContainers};
      --gmixer-surface-0: ${ladder[0]};
      --gmixer-surface-1: ${ladder[1]};
      --gmixer-surface-2: ${ladder[2]};
      --gmixer-text: ${role('text')};
      --gmixer-muted: ${role('muted')};
      --gmixer-accent: ${role('accent')};
      --gmixer-link: ${role('link')};
      --gmixer-link-hover: ${role('linkHover') || role('link')};
      --gmixer-link-active: ${role('linkActive') || role('link')};
      --gmixer-nav-link: ${role('navLink') || role('link')};
      --gmixer-nav-link-hover: ${role('navLinkHover') || role('navLink') || role('link')};
      --gmixer-nav-link-active: ${role('navLinkActive') || role('navLink') || role('link')};
      --gmixer-border: ${role('border')};
      --gmixer-focus: ${role('focus')};
      --gmixer-brand: ${brandFamily.brand};
      --gmixer-brand-tint: ${brandFamily.tint};
      --gmixer-brand-shade: ${brandFamily.shade};
      --gmixer-brand-text: ${brandFamily.textOnBrand};
      --gmixer-brand-hover: ${brandFamily.hover};
      --gmixer-brand-active: ${brandFamily.active};
      --gmixer-masthead: ${role('masthead') || role('accent')};
      --gmixer-masthead-text: ${deriveBrandFamily(role('masthead') || role('accent'), isDark).textOnBrand};
      --gmixer-nav: ${role('nav') || role('accent')};
      --gmixer-nav-text: ${deriveBrandFamily(role('nav') || role('accent'), isDark).textOnBrand};
      color-scheme: ${isDark ? 'dark' : 'light'};
    }
  `;
}

/**
 * Page-role paint. Keep the fallback deliberately conservative: recolor the
 * document roots and common semantic text/control roles, then let classifier
 * attributes opt recognized cards and sidebars into elevated surfaces. Do not
 * add DOM overlay children or recolor arbitrary layout nodes such as div/span.
 *
 * @param {(key: string) => string} role
 * @param {string} surfaceGui
 * @param {string} surfaceContainers
 * @param {boolean} isDark
 * @param {ReturnType<typeof deriveBrandFamily>} brandFamily
 * @param {{ masthead: boolean, nav: boolean }} identityRegions
 * @param {string[]} [surfaceLadder]
 * @param {{ paintOpaqueOnly?: boolean }} [options]
 */
function roleCss(
  role,
  surfaceGui,
  surfaceContainers,
  isDark,
  brandFamily,
  identityRegions,
  surfaceLadder = [],
  options = {}
) {
  const paintOpaqueOnly = options.paintOpaqueOnly !== false;
  /** @param {string} selectors comma-separated selector list */
  const maybeOpaque = (selectors) =>
    paintOpaqueOnly
      ? selectors
          .split(',')
          .map((part) => `${part.trim()}[data-gmixer-native-l]`)
          .join(',\n    ')
      : selectors;
  /** Keep tagged photo backgrounds (overlay path); clear CSS gradients/fills. */
  const solidPaint = (selectors) =>
    selectors
      .split(',')
      .map((part) => `${part.trim()}:not([${BACKGROUND_IMAGE_ATTR}])`)
      .join(',\n    ');

  const ladder =
    surfaceLadder?.length >= 3
      ? surfaceLadder
      : deriveSurfaceLadder(role('background') || '#111111', isDark, 3);
  // Always tone header/nav chrome. Identity mode keeps sampled brand fills;
  // otherwise (pure Tone / no sample) use secondary surfaces so CSS-variable
  // brand mastheads cannot stay stuck on --color-primary-*.
  const headerFill = identityRegions.masthead
    ? 'var(--gmixer-masthead)'
    : 'var(--gmixer-bg-secondary)';
  const headerText = identityRegions.masthead
    ? 'var(--gmixer-masthead-text)'
    : 'var(--gmixer-text)';
  const navFill = identityRegions.nav ? 'var(--gmixer-nav)' : 'var(--gmixer-bg-secondary)';
  const navText = identityRegions.nav ? 'var(--gmixer-nav-text)' : 'var(--gmixer-text)';
  const chromeHostScope = `:is(
      body :is(
        header,
        [role="banner"],
        nav,
        [role="navigation"],
        .masthead,
        .navbar,
        #header,
        #masthead,
        [data-gmixer-role="header"],
        [data-gmixer-role="navigation"]
      ),
      [data-gmixer-role="header"],
      [data-gmixer-role="navigation"]
    )`;

  const chromeRules = `
    ${maybeOpaque(HEADER_CHROME_SELECTORS)} {
      /* Remap common header fill/text vars so var()-based utilities follow. */
      --site-header-background-color: ${headerFill} !important;
      --site-header-text-color: ${headerText} !important;
      --header-background-color: ${headerFill} !important;
      --header-bg: ${headerFill} !important;
      --header-color: ${headerText} !important;
      background-color: ${headerFill} !important;
      /* Gradients paint above background-color (NTD/Epoch-style mastheads). */
      background-image: none !important;
      color: ${headerText} !important;
    }

    ${maybeOpaque(NAV_CHROME_SELECTORS)} {
      background-color: ${navFill} !important;
      background-image: none !important;
      color: ${navText} !important;
    }

    /* Adopted sheets have no body ancestor. Classifier stamps provide the
       shadow-safe chrome boundary. */
    ${maybeOpaque(`[data-gmixer-role="header"]`)} {
      --site-header-background-color: ${headerFill} !important;
      --site-header-text-color: ${headerText} !important;
      --header-background-color: ${headerFill} !important;
      --header-bg: ${headerFill} !important;
      --header-color: ${headerText} !important;
      background-color: ${headerFill} !important;
      background-image: none !important;
      color: ${headerText} !important;
    }

    ${maybeOpaque(`[data-gmixer-role="navigation"]`)} {
      background-color: ${navFill} !important;
      background-image: none !important;
      color: ${navText} !important;
    }
  `;

  return `
    ${themeTokenCss(role, surfaceGui, surfaceContainers, ladder, isDark, brandFamily)}

    html, body {
      background-color: var(--gmixer-bg) !important;
      color: var(--gmixer-text) !important;
    }

    /* Semantic page regions — opaque-only skips transparent layout wrappers. */
    ${maybeOpaque(`body > header, body > footer, body footer, body [data-gmixer-role="footer"],
    body > nav, body > aside,
    body > section,
    body > [role="banner"], body > [role="contentinfo"],
    body > [role="navigation"], body > [role="complementary"]`)} {
      background-color: var(--gmixer-bg-secondary) !important;
      background-image: none !important;
      color: var(--gmixer-text) !important;
    }

    /* Main content sheet: opaque-aware (layout-only mains stay transparent). */
    ${solidPaint(
      maybeOpaque(`body main, body #main, body [role="main"], body [data-gmixer-role="main"]`)
    )} {
      background-color: var(--gmixer-bg-secondary) !important;
      /* Gradients paint above background-color (HF Tailwind rails/cards). */
      background-image: none !important;
      color: var(--gmixer-text) !important;
    }

    /* Compact controls use the GUI surface. */
    ${maybeOpaque(`body input, body textarea, body select, body button,
    body [role="textbox"], body [role="searchbox"], body [role="combobox"],
    body [role="button"], body [contenteditable="true"]`)} {
      background-color: var(--gmixer-surface-gui) !important;
      color: var(--gmixer-text) !important;
    }

    /* Header/nav in-bar items share one chrome fill. Do not elevate buttons,
       fields, or inline slabs into spaced darker blocks (Opera GX mastheads).
       Overlay flyouts are excluded — they need a solid sheet. */
    ${chromeHostScope} :is(
      ul,
      ol,
      li,
      div,
      menu,
      button,
      [role="button"],
      input,
      textarea,
      select,
      [role="textbox"],
      [role="searchbox"],
      [role="combobox"],
      [role="menuitem"]
    ):not([role="menu"]):not([role="listbox"]):not([role="dialog"]):not([popover]):not([data-gmixer-role="surface"]) {
      background-color: transparent !important;
    }

    /* Dropdown / flyout / popover panels nested in header/nav. Same
       specificity as the transparent flush so this later rule wins.
       No host-specific class names. */
    ${chromeHostScope} :is(
      [role="menu"],
      [role="listbox"],
      [role="dialog"],
      [popover],
      [data-gmixer-role="surface"]
    ):not([${BACKGROUND_IMAGE_ATTR}]) {
      background-color: var(--gmixer-surface-gui) !important;
      background-image: none !important;
      color: var(--gmixer-text) !important;
    }

    /* Explicit and stamped panels may be portaled to body or live in an
       adopted shadow sheet, so they cannot depend on header ancestry. */
    body :is(
      [role="menu"],
      [role="listbox"],
      [role="dialog"],
      [popover]:popover-open,
      dialog[open],
      [data-gmixer-overlay]
    )${GMIXER_UI_HOST_NOT}:not([${BACKGROUND_IMAGE_ATTR}]),
    :is(
      [role="menu"],
      [role="listbox"],
      [role="dialog"],
      [popover]:popover-open,
      dialog[open],
      [data-gmixer-overlay]
    )${GMIXER_UI_HOST_NOT}:not([${BACKGROUND_IMAGE_ATTR}]) {
      background-color: var(--gmixer-surface-gui) !important;
      background-image: none !important;
      color: var(--gmixer-text) !important;
    }

    /* Poster chrome is a full-size sibling of the image. Do not sheet-paint
       leftover overlay stamps on top of the thumbnail. Semantic menus keep
       the fill above. */
    :is(img, video, picture, canvas) ~ [data-gmixer-overlay]:not([role="menu"]):not([role="listbox"]):not([role="dialog"]):not([popover]):not(dialog),
    [data-gmixer-overlay]:not([role="menu"]):not([role="listbox"]):not([role="dialog"]):not([popover]):not(dialog):has(~ :is(img, video, picture, canvas)) {
      background-color: transparent !important;
      background-image: none !important;
    }

    ${chromeHostScope} :is(button, [role="button"], [role="menuitem"]):is(:hover, :focus-visible) {
      background-color: color-mix(in srgb, var(--gmixer-text) 12%, transparent) !important;
      color: inherit !important;
      border-color: transparent !important;
    }

    ${chromeHostScope} :is(button, [role="button"], [role="menuitem"]):active {
      background-color: color-mix(in srgb, var(--gmixer-text) 18%, transparent) !important;
      color: inherit !important;
    }

    /* Many sites put the visible radius on a field shell and leave the
       native control square inside it. Paint that shell and let its control
       inherit the existing geometry instead of creating a nested slab. */
    body :is(
      label,
      [class*="input"],
      [class*="field"],
      [class*="control"],
      [role="group"]
    ):has(> input, > textarea, > select, > [role="textbox"], > [role="combobox"]) {
      background-color: var(--gmixer-surface-gui) !important;
      border-color: var(--gmixer-border) !important;
      background-clip: padding-box !important;
    }

    body :is(
      label,
      [class*="input"],
      [class*="field"],
      [class*="control"],
      [role="group"]
    ):has(> input, > textarea, > select, > [role="textbox"], > [role="combobox"])
      > input,
    body :is(
      label,
      [class*="input"],
      [class*="field"],
      [class*="control"],
      [role="group"]
    ):has(> input, > textarea, > select, > [role="textbox"], > [role="combobox"])
      > textarea,
    body :is(
      label,
      [class*="input"],
      [class*="field"],
      [class*="control"],
      [role="group"]
    ):has(> input, > textarea, > select, > [role="textbox"], > [role="combobox"])
      > select,
    body :is(
      label,
      [class*="input"],
      [class*="field"],
      [class*="control"],
      [role="group"]
    ):has(> input, > textarea, > select, > [role="textbox"], > [role="combobox"])
      > [role="textbox"],
    body :is(
      label,
      [class*="input"],
      [class*="field"],
      [class*="control"],
      [role="group"]
    ):has(> input, > textarea, > select, > [role="textbox"], > [role="combobox"])
      > [role="combobox"] {
      background-color: transparent !important;
      border-color: transparent !important;
      border-radius: inherit !important;
      corner-shape: inherit !important;
    }

    /* Cards, articles, and promoted nested panels. Default mid ladder stop;
       data-gmixer-tone-step remaps to ranked elevated stops so native
       light/dark relationships survive Light|Gray|Dark. */
    ${solidPaint(
      maybeOpaque(`body .card,
    body article,
    body [data-gmixer-role="card"],
    body [data-gmixer-role="article"],
    body [data-gmixer-role="article-body"],
    body [data-gmixer-role="surface"],
    body [data-gmixer-role="sidebar"],
    body [data-gmixer-role="hero"],
    body pre, body code, body kbd, body samp,
    body dialog, body [role="dialog"]${GMIXER_UI_HOST_NOT}, body [role="menu"],
    body [role="listbox"], body [role="alert"]`)
    )} {
      background-color: var(--gmixer-surface-containers) !important;
      /* Gradients paint above background-color (HF Tailwind rails/cards). */
      background-image: none !important;
      color: var(--gmixer-text) !important;
    }

    /* Open shadow trees have no body ancestor, so the rules above miss
       stamped slabs (ad placements, widget chrome). Same role stamps, no
       host-specific selectors. */
    ${solidPaint(
      maybeOpaque(`[data-gmixer-role="card"],
    [data-gmixer-role="article"],
    [data-gmixer-role="article-body"],
    [data-gmixer-role="surface"],
    [data-gmixer-role="sidebar"],
    [data-gmixer-role="hero"],
    [data-gmixer-role="ad"]`)
    )} {
      background-color: var(--gmixer-surface-containers) !important;
      background-image: none !important;
      color: var(--gmixer-text) !important;
    }

    ${solidPaint(maybeOpaque(`[data-gmixer-role="main"]`))} {
      background-color: var(--gmixer-bg-secondary) !important;
      background-image: none !important;
      color: var(--gmixer-text) !important;
    }

    /* Keep text coverage semantic. In particular, never force colors on
       arbitrary div/span layout nodes or icon wrappers — except as
       descendants of hosts we already paint (modern sites often put the
       visible ink on nested spans inside links/headings). */
    p, li, td, th, blockquote, label,
    [role="main"], [role="region"], [role="complementary"],
    [role="search"], [role="status"], [role="alert"],
    [data-gmixer-role="main"],
    [data-gmixer-role="article"],
    [data-gmixer-role="article-body"],
    [data-gmixer-role="surface"],
    [data-gmixer-role="header"],
    [data-gmixer-role="footer"],
    [data-gmixer-role="sidebar"] {
      color: var(--gmixer-text) !important;
    }

    small, figcaption, caption,
    [aria-description], [data-gmixer-muted] {
      color: var(--gmixer-muted) !important;
    }

    h1, h2, h3, h4, h5, h6, [role="heading"] {
      color: var(--gmixer-accent) !important;
    }

    a, a:link, a:visited {
      color: var(--gmixer-link) !important;
      background-color: transparent !important;
    }

    a:hover, a:focus-visible {
      color: var(--gmixer-link-hover) !important;
    }

    a:active {
      color: var(--gmixer-link-active) !important;
    }

    /* Nested ink nodes inherit the host color we set above so site rules on
       span/div inside links and headings cannot keep dark text on dark tone.
       X/React apps put body copy on hashed span/div classes, not p/li. */
    a *,
    h1 *, h2 *, h3 *, h4 *, h5 *, h6 *,
    [role="heading"] *,
    p *, li *, td *, th *, blockquote *, label *,
    [data-gmixer-role="main"] :is(div, span),
    [data-gmixer-role="article"] :is(div, span),
    [data-gmixer-role="article-body"] :is(div, span),
    [data-gmixer-role="surface"] :is(div, span),
    [data-gmixer-role="sidebar"] :is(div, span),
    [data-gmixer-role="header"] :is(div, span),
    [data-gmixer-role="footer"] :is(div, span),
    [data-gmixer-role="card"] :is(div, span),
    [data-gmixer-role="hero"] :is(div, span),
    [role="main"] :is(div, span),
    [role="complementary"] :is(div, span) {
      color: inherit !important;
    }

    a:hover *, a:focus-visible * {
      color: inherit !important;
    }

    a:active * {
      color: inherit !important;
    }

    /* Beat painted-host span/div inherit so links/headings keep their roles. */
    [data-gmixer-role] a,
    [data-gmixer-role] a:link,
    [data-gmixer-role] a:visited {
      color: var(--gmixer-link) !important;
    }
    [data-gmixer-role] a * {
      color: inherit !important;
    }
    [data-gmixer-role] a:hover,
    [data-gmixer-role] a:focus-visible,
    [data-gmixer-role] a:hover *,
    [data-gmixer-role] a:focus-visible * {
      color: var(--gmixer-link-hover) !important;
    }
    [data-gmixer-role] a:active,
    [data-gmixer-role] a:active * {
      color: var(--gmixer-link-active) !important;
    }
    [data-gmixer-role] :is(h1, h2, h3, h4, h5, h6, [role="heading"]) {
      color: var(--gmixer-accent) !important;
    }
    [data-gmixer-role] :is(h1, h2, h3, h4, h5, h6, [role="heading"]) a,
    [data-gmixer-role] :is(h1, h2, h3, h4, h5, h6, [role="heading"]) a:link,
    [data-gmixer-role] :is(h1, h2, h3, h4, h5, h6, [role="heading"]) a:visited {
      color: var(--gmixer-accent) !important;
    }

    /* Heading links belong to the heading role, not ordinary body links. */
    h1 a, h1 a:link, h1 a:visited,
    h2 a, h2 a:link, h2 a:visited,
    h3 a, h3 a:link, h3 a:visited,
    h4 a, h4 a:link, h4 a:visited,
    h5 a, h5 a:link, h5 a:visited,
    h6 a, h6 a:link, h6 a:visited,
    [role="heading"] a, [role="heading"] a:link, [role="heading"] a:visited {
      color: var(--gmixer-accent) !important;
    }

    h1 a:hover, h1 a:focus-visible,
    h2 a:hover, h2 a:focus-visible,
    h3 a:hover, h3 a:focus-visible,
    h4 a:hover, h4 a:focus-visible,
    h5 a:hover, h5 a:focus-visible,
    h6 a:hover, h6 a:focus-visible,
    [role="heading"] a:hover, [role="heading"] a:focus-visible {
      color: var(--gmixer-brand-hover) !important;
    }

    ${chromeLinkSelectorList()},
    ${chromeLinkSelectorList(':link')},
    ${chromeLinkSelectorList(':visited')} {
      color: var(--gmixer-nav-link) !important;
    }
    ${chromeLinkSelectorList(' *')} {
      color: inherit !important;
    }
    ${chromeLinkSelectorList(':hover')},
    ${chromeLinkSelectorList(':focus-visible')},
    ${chromeLinkSelectorList(':hover *')},
    ${chromeLinkSelectorList(':focus-visible *')} {
      color: var(--gmixer-nav-link-hover) !important;
    }
    ${chromeLinkSelectorList(':active')},
    ${chromeLinkSelectorList(':active *')} {
      color: var(--gmixer-nav-link-active) !important;
    }

    body button:hover, body [role="button"]:hover,
    body button:focus-visible, body [role="button"]:focus-visible {
      background-color: var(--gmixer-brand-hover) !important;
      color: var(--gmixer-brand-text) !important;
      border-color: var(--gmixer-brand-shade) !important;
    }

    body button:active, body [role="button"]:active {
      background-color: var(--gmixer-brand-active) !important;
      color: var(--gmixer-brand-text) !important;
    }

    /* Content tonal steps (before chrome so identity header/nav can win). */
    body :is(
      [data-gmixer-role="surface"],
      [data-gmixer-role="article"],
      [data-gmixer-role="article-body"],
      [data-gmixer-role="card"],
      [data-gmixer-role="sidebar"],
      [data-gmixer-role="hero"],
      [data-gmixer-role="main"]
    )[data-gmixer-tone-step="0"] {
      background-color: var(--gmixer-surface-0) !important;
    }
    body :is(
      [data-gmixer-role="surface"],
      [data-gmixer-role="article"],
      [data-gmixer-role="article-body"],
      [data-gmixer-role="card"],
      [data-gmixer-role="sidebar"],
      [data-gmixer-role="hero"],
      [data-gmixer-role="main"]
    )[data-gmixer-tone-step="1"] {
      background-color: var(--gmixer-surface-1) !important;
    }
    body :is(
      [data-gmixer-role="surface"],
      [data-gmixer-role="article"],
      [data-gmixer-role="article-body"],
      [data-gmixer-role="card"],
      [data-gmixer-role="sidebar"],
      [data-gmixer-role="hero"],
      [data-gmixer-role="main"]
    )[data-gmixer-tone-step="2"] {
      background-color: var(--gmixer-surface-2) !important;
    }

    ${chromeRules}

    ${
      !identityRegions.masthead && !identityRegions.nav
        ? `
    /* Tone-only: keep relative header/nav depth (e.g. secondary wrap darker). */
    body :is(
      [data-gmixer-role="header"],
      [data-gmixer-role="navigation"]
    )[data-gmixer-tone-step="0"] {
      background-color: var(--gmixer-surface-0) !important;
    }
    body :is(
      [data-gmixer-role="header"],
      [data-gmixer-role="navigation"]
    )[data-gmixer-tone-step="1"] {
      background-color: var(--gmixer-surface-1) !important;
    }
    body :is(
      [data-gmixer-role="header"],
      [data-gmixer-role="navigation"]
    )[data-gmixer-tone-step="2"] {
      background-color: var(--gmixer-surface-2) !important;
    }`
        : ''
    }

    hr, fieldset, input, textarea, select, button,
    .card, [class*="card"] {
      border-color: var(--gmixer-border) !important;
    }

    :focus-visible {
      outline-color: var(--gmixer-focus) !important;
    }
  `;
}

/**
 * @param {ReturnType<import('../state/schema.js').createDefaultState>['global']} resolved
 * @param {ReturnType<import('./page-sampler.js').samplePageRoles>|null} [pageSample]
 */
/**
 * Whether an accordion section's page effects are active.
 * Expand/collapse is UI-only; this is the persisted On/Off master.
 * Settings focus ("Only: Media" / "Only: Tone") hard-gates other layers.
 * @param {ReturnType<import('../state/schema.js').createDefaultState>['global']} resolved
 * @param {string} id
 */
export function isSectionEnabled(resolved, id) {
  if (!sectionAllowedByFocus(resolved?.ui?.settingsFocus, id)) return false;
  if (!sectionAllowedByCustomizationLevel(resolved?.ui, id)) return false;
  if (id === 'navigation') return !!resolved?.navigation?.enabled;
  const sections = resolved?.sections;
  if (!sections || sections[id] === undefined) {
    return id === 'fonts' || id === 'font-browser';
  }
  return sections[id] === true;
}

export function buildCss(resolved, pageSample = null) {
  const colorOn = isSectionEnabled(resolved, 'color');
  const {
    toneFocus,
    themePalette,
    overrides,
  } = resolveEffectivePalette(resolved, { colorSectionOn: colorOn });
  const paintTone = isSectionEnabled(resolved, 'tone');
  const paintFonts = isSectionEnabled(resolved, 'fonts');
  const paintMedia = isSectionEnabled(resolved, 'filter');
  const paintShape = isSectionEnabled(resolved, 'shape');
  const paintEffects = isSectionEnabled(resolved, 'effects');
  // Tone uses the theme palette at full strength with structural header/nav
  // fills so Light|Gray|Dark is not muddied by page sampling / brand preserve.
  const identityMode = toneFocus
    ? 'restyle'
    : resolved.color.identityMode || 'restyle';
  const intensity = toneFocus ? 100 : (resolved.color.intensity ?? 100);
  const structuralChrome = toneFocus || identityMode === 'restyle';
  const blended = blendWithPageSample(themePalette, pageSample, intensity, identityMode);
  const applied = applyColorOverrides(blended, overrides, { active: true });
  const {
    surfaceGui,
    surfaceContainers,
    isDark,
    role: roleResolved,
    cascadeFromPrimary,
  } = applied;
  const surfaceLadder = cascadeFromPrimary
    ? applied.surfaceLadder
    : blended.surfaceLadder || themePalette.surfaceLadder || applied.surfaceLadder;

  const brandFamily =
    blended.brandFamily ||
    deriveBrandFamily(roleResolved('accent') || themePalette.accent, isDark);
  // samplePageRoles keeps masthead/nav under `identity`; older callers may
  // still pass them at the top level. Structural chrome (Tone / Fully restyle)
  // forces secondary fills so CSS-variable brand mastheads follow Light|Gray|Dark.
  const identityRegions = structuralChrome
    ? { masthead: false, nav: false }
    : {
        masthead: Boolean(pageSample?.identity?.masthead || pageSample?.masthead),
        nav: Boolean(pageSample?.identity?.nav || pageSample?.nav),
      };

  return [
    fontFaceRules(),
    paintTone
      ? roleCss(
          roleResolved,
          surfaceGui,
          surfaceContainers,
          isDark,
          brandFamily,
          identityRegions,
          surfaceLadder,
          { paintOpaqueOnly: resolved.color?.paintOpaqueOnly !== false }
        )
      : '',
    paintFonts ? headingScaleRules(blended.headerSizeVariance) : '',
    paintFonts ? headingFontRules(resolved.fonts) : '',
    paintFonts ? fontRule('paragraph', resolved.fonts.paragraph) : '',
    paintFonts ? fontRule('ui', resolved.fonts.ui) : '',
    paintFonts ? fontRule('code', resolved.fonts.code) : '',
    paintFonts ? fontRule('captions', resolved.fonts.captions) : '',
    paintMedia ? imageFilterRule(resolved.imageFilter, blended, { colorOn }) : '',
    paintMedia
      ? themeMediaRule(
          resolved.activeThemePackId,
          resolved.mediaStyles,
          blended,
          resolved.imageFilter?.revealOnHover,
          { colorOn }
        )
      : '',
    // Clipping first, then Corners — equal-specificity cascade + Corners'
    // !important means Corners overrides on overlapping targets.
    paintShape ? clippingRule(resolved.clipping) : '',
    paintShape ? cornersRule(resolved.corners) : '',
    paintEffects
      ? effectsRules(resolved.effects, {
          ...blended,
          accent: roleResolved('accent'),
          link: roleResolved('link'),
          navLink: roleResolved('navLink') || roleResolved('link'),
        })
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Creates (or updates) the override <style> tag and keeps it last in
 * <head>. At document_start, `document.head` may not exist yet — falls
 * back to `documentElement` (<html>) in that case; content-end's re-append
 * (see content-end.js) moves it into the real <head> once available.
 */
/** Shared constructed sheet adopted into open shadow roots. */
let adoptedSheet = null;

export function injectStyle(css) {
  let styleEl = document.getElementById(STYLE_ELEMENT_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ELEMENT_ID;
  }
  styleEl.textContent = css;

  const parent = document.head || document.documentElement;
  // Re-appending moves it to the end, keeping equal-specificity precedence
  // over the page's own stylesheets even if they load after us.
  parent.appendChild(styleEl);
  adoptThemeSheet(css);
  // Theme re-append would otherwise sit after the popover host reset and
  // restyle [popover]/[role="dialog"] chrome. Keep gMixer UI last.
  const hostStyle = document.getElementById(HOST_STYLE_ID);
  if (hostStyle && hostStyle !== styleEl) parent.appendChild(hostStyle);
}

/**
 * Attach the current theme sheet to any open shadow roots discovered after
 * the last inject (lazy widgets / ad slots). Does not rebuild CSS.
 */
export function syncAdoptedTheme() {
  if (!adoptedSheet) return;
  adoptIntoOpenShadows();
}

export function removeStyle() {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
  if (adoptedSheet && typeof document !== 'undefined') {
    adoptIntoOpenShadows({ remove: true });
  }
  adoptedSheet = null;
}

/**
 * Run native-style measurements without observing gMixer's own paint.
 * Removal and restoration are synchronous, so the browser cannot present an
 * unthemed frame between them.
 * @template T
 * @param {() => T} measure
 * @returns {T}
 */
export function withStyleSuspended(measure) {
  const css = document.getElementById(STYLE_ELEMENT_ID)?.textContent || '';
  if (!css) return measure();
  removeStyle();
  try {
    return measure();
  } finally {
    injectStyle(css);
  }
}

/**
 * @param {string} css
 */
function adoptThemeSheet(css) {
  if (typeof CSSStyleSheet !== 'function') return;
  try {
    if (!adoptedSheet) adoptedSheet = new CSSStyleSheet();
    adoptedSheet.replaceSync(css);
  } catch {
    adoptedSheet = null;
    return;
  }
  adoptIntoOpenShadows();
}

/**
 * @param {{ remove?: boolean }} [options]
 */
function adoptIntoOpenShadows(options = {}) {
  if (typeof document === 'undefined' || !document.documentElement) return;
  const sheet = adoptedSheet;
  if (!sheet && !options.remove) return;
  for (const sr of collectOpenShadowRoots(document.documentElement)) {
    const current = [...(sr.adoptedStyleSheets || [])];
    const without = current.filter((item) => item !== sheet);
    if (options.remove || isGmixerUiShadowRoot(sr)) {
      if (without.length !== current.length) sr.adoptedStyleSheets = without;
      continue;
    }
    // Always last so we beat the component's own adopted sheets.
    sr.adoptedStyleSheets = [...without, sheet];
  }
}
