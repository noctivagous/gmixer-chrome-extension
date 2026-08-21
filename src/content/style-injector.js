// Builds and injects the override <style> tag that actually re-themes the
// page. Deliberately CSS-only (no per-element JS styling) so it can be
// generated once per state change and applies live to any element the
// selectors match — including nodes added later, without extra JS work.
import { buildPalette } from '../lib/color-theory.js';
import { getFontById } from '../config/fonts.js';
import { fontFaceRules } from '../lib/font-faces.js';
import { blendWithPageSample } from './page-sampler.js';

export const STYLE_ELEMENT_ID = 'gmixer-style';

// Safer than "p, li, span, div" — avoid restyling every layout node and
// wrecking icon fonts / UI chrome that happens to live in a span/div.
const TARGET_SELECTORS = {
  headers: 'h1, h2, h3, h4, h5, h6, [role="heading"]',
  paragraph:
    'p, li, td, th, blockquote, label, article, main, [role="main"], .content, .post, .entry-content',
  captions: 'figcaption, caption, small, time, .caption, [class*="caption"]',
};

function fontRule(target, fontConfig) {
  const font = getFontById(fontConfig?.fontId);
  if (!font) return '';
  return `${TARGET_SELECTORS[target]} { font-family: ${font.family} !important; }`;
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

function imageFilterRule(filter, palette) {
  if (!filter?.enabled) return '';
  const targets =
    filter.scope === 'images'
      ? 'img, video, picture source'
      : filter.scope === 'backgrounds'
        ? '[style*="background-image"]'
        : 'img, video, picture source, [style*="background-image"]';

  const presets = {
    grayscale: 'grayscale(1)',
    sepia: 'sepia(0.8)',
    invert: 'invert(1)',
    monochrome: 'grayscale(1) contrast(1.05)',
    duotone: `grayscale(1) brightness(1.05) sepia(1) hue-rotate(${palette.isDark ? '260deg' : '20deg'})`,
    custom: filter.customFilter || 'none',
  };

  return `${targets} { filter: ${presets[filter.preset] ?? 'none'} !important; }`;
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

function effectsRules(effects, palette) {
  const rules = [];
  const glowColor = effects.glow.color || palette.accent;

  if (effects.glow.enabled) {
    rules.push(
      `a, button, [role="button"] { text-shadow: 0 0 8px ${glowColor}; }`,
      effects.glow.animated
        ? `@keyframes gmixer-glow-pulse { 0%, 100% { filter: drop-shadow(0 0 2px ${glowColor}); } 50% { filter: drop-shadow(0 0 10px ${glowColor}); } }
           a, button, [role="button"] { animation: gmixer-glow-pulse 2.4s ease-in-out infinite; }`
        : ''
    );
  }

  if (effects.flash.enabled) {
    rules.push(
      `@keyframes gmixer-flash { 0%, 90%, 100% { opacity: 1; } 95% { opacity: 0.6; } }
       .gmixer-flash-target { animation: gmixer-flash 3s linear infinite; }`
    );
  }

  if (effects.cursor.enabled) {
    rules.push(
      `html, body { cursor: ${effects.cursor.style === 'default' ? 'pointer' : effects.cursor.style}; }`
    );
  }

  if (effects.backgroundMotion.enabled) {
    rules.push(
      `@keyframes gmixer-bg-motion { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }
       html { background-size: 200% 200% !important; animation: gmixer-bg-motion 12s ease-in-out infinite alternate; }`
    );
  }

  return rules.join('\n');
}

function roleCss(role) {
  return `
    :root {
      --gmixer-bg: ${role('background')};
      --gmixer-text: ${role('text')};
      --gmixer-accent: ${role('accent')};
      --gmixer-link: ${role('link')};
      --gmixer-border: ${role('border')};
    }

    html, body {
      background-color: var(--gmixer-bg) !important;
      color: var(--gmixer-text) !important;
    }

    main, article, section, aside, header, footer, nav,
    [role="main"], .content, .post, .entry-content {
      color: var(--gmixer-text);
    }

    h1, h2, h3, h4, h5, h6, [role="heading"] {
      color: var(--gmixer-accent) !important;
    }

    a, a:link, a:visited {
      color: var(--gmixer-link) !important;
    }

    hr, fieldset, input, textarea, select, button,
    .card, [class*="card"] {
      border-color: var(--gmixer-border) !important;
    }
  `;
}

/**
 * @param {ReturnType<import('../state/schema.js').createDefaultState>['global']} resolved
 * @param {ReturnType<import('./page-sampler.js').samplePageRoles>|null} [pageSample]
 */
export function buildCss(resolved, pageSample = null) {
  const themePalette = buildPalette(resolved.color.baseColor, resolved.color.scheme);
  const intensity = resolved.color.intensity ?? 80;
  const blended = blendWithPageSample(themePalette, pageSample, intensity);
  const overrides = resolved.color.overrides ?? {};
  const role = (key) => overrides[key] || blended[key];

  return [
    fontFaceRules(),
    roleCss(role),
    headingScaleRules(blended.headerSizeVariance),
    fontRule('headers', resolved.fonts.headers),
    fontRule('paragraph', resolved.fonts.paragraph),
    fontRule('captions', resolved.fonts.captions),
    imageFilterRule(resolved.imageFilter, blended),
    clippingRule(resolved.clipping),
    effectsRules(resolved.effects, blended),
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
}

export function removeStyle() {
  document.getElementById(STYLE_ELEMENT_ID)?.remove();
}
