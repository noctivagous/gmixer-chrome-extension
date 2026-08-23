// Builds and injects the override <style> tag that actually re-themes the
// page. Deliberately CSS-only (no per-element JS styling) so it can be
// generated once per state change and applies live to any element the
// selectors match — including nodes added later, without extra JS work.
import { buildPalette, deriveSurface, hexToHsl } from '../lib/color-theory.js';
import { getFontById } from '../config/fonts.js';
import { getThemePackById } from '../config/theme-packs.js';
import { fontFaceRules } from '../lib/font-faces.js';
import { cornersRule } from '../lib/corners-css.js';
import { blendWithPageSample } from './page-sampler.js';

export const STYLE_ELEMENT_ID = 'gmixer-style';

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
      return `${tag}, [role="heading"][aria-level="${tag.slice(1)}"] { font-family: ${font.family} !important; }`;
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

export function imageFilterPresetCss(preset, palette, customFilter) {
  const accentHue = hexToHsl(palette.accent ?? '#7c3aed').h;
  // sepia(1) lands the image around a ~35deg (brown) hue; rotate from there
  // toward the theme's actual accent hue so "duotone" reads as *this*
  // theme's color, not a fixed brown/violet default.
  const duotoneRotate = Math.round(((accentHue - 35) % 360 + 360) % 360);
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
    duotone: `grayscale(1) sepia(1) hue-rotate(${duotoneRotate}deg) saturate(1.4)`,
    custom: customFilter || 'none',
  };
  return presets[preset] ?? 'none';
}

function imageFilterRule(filter, palette) {
  if (!filter?.enabled) return '';
  const bgSelector = `[style*="background-image"], [${BACKGROUND_IMAGE_ATTR}]`;
  const targets =
    filter.scope === 'images'
      ? 'img, video, picture source'
      : filter.scope === 'backgrounds'
        ? ''
        : `img, video, picture source`;

  const value = imageFilterPresetCss(filter.preset, palette, filter.customFilter);
  const imageRule = targets ? `${targets} { filter: ${value} !important; }` : '';
  if (filter.scope === 'images') return imageRule;

  // Never put filter/background declarations on the element that owns the
  // page's background-image: that also filters its text and can replace the
  // site's image. A separate layer blends over the original image instead.
  const overlayColor =
    filter.preset === 'invert'
      ? '#ffffff'
      : filter.preset === 'sepia' || filter.preset === 'duotone'
        ? palette.accent
        : '#808080';
  const blendMode =
    filter.preset === 'invert'
      ? 'difference'
      : filter.preset === 'sepia' || filter.preset === 'duotone'
        ? 'color'
        : 'saturation';
  const overlayRule = `
    [${BACKGROUND_IMAGE_ATTR}] {
      position: relative !important;
      isolation: isolate !important;
    }
    [${BACKGROUND_IMAGE_ATTR}] > .gmixer-bgimg-overlay {
      position: absolute !important;
      inset: 0 !important;
      z-index: 0 !important;
      pointer-events: none !important;
      background: ${overlayColor} !important;
      opacity: ${filter.preset === 'invert' ? 1 : 0.72} !important;
      mix-blend-mode: ${blendMode} !important;
    }
    [${BACKGROUND_IMAGE_ATTR}] > .gmixer-bgimg-overlay ~ * {
      position: relative;
      z-index: 1;
    }
    ${filter.revealOnHover ? `[${BACKGROUND_IMAGE_ATTR}]:hover > .gmixer-bgimg-overlay { opacity: 0 !important; }` : ''}
  `;
  return [imageRule, overlayRule].filter(Boolean).join('\n');
}

function themeMediaRule(activeThemePackId, mediaOverrides, palette, revealOnHover) {
  const packMedia = getThemePackById(activeThemePackId)?.media;
  if (!packMedia) return '';
  const media = { ...packMedia };
  for (const [role, override] of Object.entries(mediaOverrides || {})) {
    media[role] = { ...(media[role] || {}), ...override };
  }

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
          `${filterSelector} { filter: ${imageFilterPresetCss(style.filter, palette, '')} !important; }`
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
 */
function roleCss(role, surfaceGui, surfaceContainers, isDark) {
  return `
    :root {
      --gmixer-bg-primary: ${role('background')};
      --gmixer-bg-secondary: ${role('backgroundSecondary')};
      --gmixer-bg: var(--gmixer-bg-primary);
      --gmixer-surface-gui: ${role('surfaceGui') || role('surface') || surfaceGui};
      --gmixer-surface-containers: ${role('surfaceContainers') || surfaceContainers};
      --gmixer-text: ${role('text')};
      --gmixer-muted: ${role('muted')};
      --gmixer-accent: ${role('accent')};
      --gmixer-link: ${role('link')};
      --gmixer-border: ${role('border')};
      --gmixer-focus: ${role('focus')};
      color-scheme: ${isDark ? 'dark' : 'light'};
    }

    html, body {
      background-color: var(--gmixer-bg) !important;
      color: var(--gmixer-text) !important;
    }

    /* Only semantic page regions receive the secondary background. */
    body > header, body > footer, body > nav, body > aside,
    body > [role="banner"], body > [role="contentinfo"],
    body > [role="navigation"], body > [role="complementary"] {
      background-color: var(--gmixer-bg-secondary) !important;
    }

    /* Compact controls use the GUI surface. */
    body input, body textarea, body select, body button,
    body [role="textbox"], body [role="searchbox"], body [role="combobox"],
    body [role="button"], body [contenteditable="true"] {
      background-color: var(--gmixer-surface-gui) !important;
      color: var(--gmixer-text) !important;
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

    /* Cards and larger semantic regions use the container surface. */
    body .card, body [class*="card"],
    body [data-gmixer-role="card"],
    body [data-gmixer-role="sidebar"],
    body [data-gmixer-role="hero"],
    body pre, body code, body kbd, body samp,
    body dialog, body [role="dialog"], body [role="menu"],
    body [role="listbox"], body [role="alert"] {
      background-color: var(--gmixer-surface-containers) !important;
      color: var(--gmixer-text) !important;
    }

    /* Keep text coverage semantic. In particular, never force colors on
       arbitrary div/span layout nodes or icon wrappers. */
    p, li, td, th, blockquote, label,
    [role="main"], [role="region"], [role="complementary"],
    [role="search"], [role="status"], [role="alert"] {
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
 * @param {ReturnType<import('../state/schema.js').createDefaultState>['global']} resolved
 * @param {string} id
 */
export function isSectionEnabled(resolved, id) {
  if (id === 'navigation') return !!resolved?.navigation?.enabled;
  const sections = resolved?.sections;
  if (!sections || sections[id] === undefined) {
    return id === 'tone' || id === 'color' || id === 'fonts' || id === 'font-browser';
  }
  return sections[id] === true;
}

export function buildCss(resolved, pageSample = null) {
  const themePalette = buildPalette(
    resolved.color.baseColor,
    resolved.color.scheme,
    resolved.themeMode || 'dark'
  );
  const intensity = resolved.color.intensity ?? 80;
  const blended = blendWithPageSample(themePalette, pageSample, intensity);
  const overrides = resolved.color.overrides ?? {};
  const role = (key) => overrides[key] || blended[key];
  const background = role('background');
  const isDark = hexToHsl(background).l < 50;
  const surfaceGui =
    overrides.surfaceGui || overrides.surface || blended.surfaceGui || blended.surface || deriveSurface(background, isDark);
  const surfaceContainers =
    overrides.surfaceContainers || blended.surfaceContainers || deriveSurface(surfaceGui, isDark);

  const paintTone = isSectionEnabled(resolved, 'tone') || isSectionEnabled(resolved, 'color');
  const paintFonts = isSectionEnabled(resolved, 'fonts');
  const paintMedia = isSectionEnabled(resolved, 'filter');
  const paintShape = isSectionEnabled(resolved, 'shape');
  const paintEffects = isSectionEnabled(resolved, 'effects');

  return [
    fontFaceRules(),
    paintTone ? roleCss(role, surfaceGui, surfaceContainers, isDark) : '',
    paintFonts ? headingScaleRules(blended.headerSizeVariance) : '',
    paintFonts ? headingFontRules(resolved.fonts) : '',
    paintFonts ? fontRule('paragraph', resolved.fonts.paragraph) : '',
    paintFonts ? fontRule('ui', resolved.fonts.ui) : '',
    paintFonts ? fontRule('code', resolved.fonts.code) : '',
    paintFonts ? fontRule('captions', resolved.fonts.captions) : '',
    paintMedia ? imageFilterRule(resolved.imageFilter, blended) : '',
    paintMedia
      ? themeMediaRule(
          resolved.activeThemePackId,
          resolved.mediaStyles,
          blended,
          resolved.imageFilter?.revealOnHover
        )
      : '',
    // Clipping first, then Corners — equal-specificity cascade + Corners'
    // !important means Corners overrides on overlapping targets.
    paintShape ? clippingRule(resolved.clipping) : '',
    paintShape ? cornersRule(resolved.corners) : '',
    paintEffects ? effectsRules(resolved.effects, blended) : '',
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
