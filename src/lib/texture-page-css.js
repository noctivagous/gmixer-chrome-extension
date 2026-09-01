// Page-paint CSS for Texture surfaces (Stage 2c).
// Preview styling lives in preview-texture-css.js; this module is content-only.

import {
  TEXTURE_SURFACES,
  normalizeTexture,
  texturePatternDeclarations,
  textureSurfaceEnabled,
} from '../config/texture-catalog.js';

/**
 * Page selectors per shipped surface. Reserved surfaces omitted until UI ships.
 * @type {Readonly<Record<string, { family: 'fill' | 'text' | 'media', selectors: string }>>}
 */
export const TEXTURE_PAGE_TARGETS = {
  'gui.button': {
    family: 'fill',
    selectors: [
      'body button',
      'body [role="button"]',
      'body input[type="button"]',
      'body input[type="submit"]',
      'body input[type="reset"]',
    ].join(', '),
  },
  'gui.input': {
    family: 'fill',
    selectors: [
      'body input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]):not([type="range"]):not([type="color"]):not([type="image"])',
      'body [role="textbox"]:not(textarea)',
      'body [role="searchbox"]',
      'body [contenteditable="true"]',
    ].join(', '),
  },
  'gui.textarea': {
    family: 'fill',
    selectors: 'body textarea',
  },
  'gui.slider': {
    family: 'fill',
    selectors: 'body input[type="range"], body [role="slider"]',
  },
  'media.articleImage': {
    family: 'media',
    selectors: [
      'body :is(figure, picture, a, div, span, li, article, section):has(> img[data-gmixer-media="article-image"])',
      'body :is(figure, picture, a, div, span, li, article, section):has(> [data-gmixer-media="article-image"])',
      'body img[data-gmixer-media="article-image"]',
    ].join(', '),
  },
  'media.videoThumb': {
    family: 'media',
    // Chrome drops `video:paused` from the CSSOM; use stamped play/pause state.
    // Playing videos stay clear of thumbnail texture (paused / poster / non-video thumbs only).
    selectors: [
      'body :is(figure, picture, a, div, span, li, article, section):has(> video[data-gmixer-video-state="paused"])',
      'body :is(figure, picture, a, div, span, li, article, section):has(> video[poster][data-gmixer-video-state="paused"])',
      'body :is(figure, picture, a, div, span, li, article, section):has(> [data-gmixer-media="video-thumbnail"]:not(video))',
      'body :is(figure, picture, a, div, span, li, article, section):has(> video[data-gmixer-media="video-thumbnail"][data-gmixer-video-state="paused"])',
      'body video[data-gmixer-video-state="paused"]',
      'body video[data-gmixer-media="video-thumbnail"][data-gmixer-video-state="paused"]',
      'body [data-gmixer-media="video-thumbnail"]:not(video)',
    ].join(', '),
  },
  'accent.headingLarge': {
    family: 'text',
    selectors: 'body h1, body h2, body [role="heading"][aria-level="1"], body [role="heading"][aria-level="2"]',
  },
  'accent.headingMedium': {
    family: 'text',
    selectors: 'body h3, body h4, body [role="heading"][aria-level="3"], body [role="heading"][aria-level="4"]',
  },
  'accent.headingSmall': {
    family: 'text',
    selectors: 'body h5, body h6, body [role="heading"][aria-level="5"], body [role="heading"][aria-level="6"]',
  },
  'link.bare': {
    family: 'text',
    selectors: [
      'body main a[href]',
      'body [role="main"] a[href]',
      'body article p a[href]',
      'body main p a[href]',
      'body [role="main"] p a[href]',
    ].join(', '),
  },
  'link.article': {
    family: 'text',
    selectors: [
      'body article :is(h1, h2, h3, h4) a[href]',
      'body [class*="card"] :is(h1, h2, h3, h4) a[href]',
      'body [class*="teaser"] a[href]',
      'body a[href]:has(> img[data-gmixer-media="article-image"])',
      'body [data-gmixer-link-shimmer]',
    ].join(', '),
  },
  'link.heading': {
    family: 'text',
    selectors: [
      'body h1 a[href]',
      'body h2 a[href]',
      'body h3 a[href]',
      'body h4 a[href]',
      'body h5 a[href]',
      'body h6 a[href]',
      'body [role="heading"] a[href]',
    ].join(', '),
  },
  'muted.kicker': {
    family: 'text',
    selectors: [
      'body .kicker',
      'body .eyebrow',
      'body .overline',
      'body [class*="kicker"]',
      'body [class*="eyebrow"]',
      'body [class*="overline"]',
    ].join(', '),
  },
  'muted.photoCaption': {
    family: 'text',
    selectors: 'body figcaption',
  },
  'muted.asideNotes': {
    family: 'text',
    selectors: [
      'body aside',
      'body small',
      'body time',
      'body .meta',
      'body [class*="meta"]',
      'body [class*="caption"]:not(figcaption)',
    ].join(', '),
  },
};

/**
 * @param {object|null|undefined} textureRaw
 * @returns {string}
 */
export function texturePageRules(textureRaw) {
  const texture = normalizeTexture(textureRaw);
  if (texture.mode === 'none') return '';

  const pattern = texturePatternDeclarations(texture);
  const rot = texture.mode === 'grid' ? texture.gridRotation : 0;
  /** @type {string[]} */
  const rules = [];

  // Cancel chrome / heading links when bare body links are textured so
  // nav/footer/heading anchors do not inherit the main/article rules.
  if (textureSurfaceEnabled(texture, 'link.bare')) {
    rules.push(`${TEXTURE_PAGE_TARGETS['link.bare'].selectors} {
  ${textTextureDeclarations(pattern)}
}
${bareLinkCancelSelectors()} {
  background-image: none !important;
  -webkit-text-fill-color: unset !important;
  color: unset !important;
  -webkit-background-clip: unset !important;
  background-clip: unset !important;
}`);
  }

  for (const surface of TEXTURE_SURFACES) {
    if (!surface.inUi) continue;
    if (surface.id === 'link.bare') continue; // handled above with cancels
    if (!textureSurfaceEnabled(texture, surface.id)) continue;
    const target = TEXTURE_PAGE_TARGETS[surface.id];
    if (!target) continue;

    if (target.family === 'fill') {
      rules.push(`${target.selectors} {
  ${fillTextureDeclarations(pattern)}
}`);
      continue;
    }

    if (target.family === 'text') {
      rules.push(`${target.selectors} {
  ${textTextureDeclarations(pattern)}
}`);
      continue;
    }

    // Media — overlay on wrappers via ::after. Replaced img/video cannot host
    // pseudo-elements reliably, so prefer :has(...) parents from the catalog.
    const wrapperSelectors = target.selectors
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part.includes(':has('))
      .join(', ');

    if (wrapperSelectors) {
      const overlayPattern = withImportant(pattern);
      rules.push(`${wrapperSelectors} {
  position: relative !important;
  isolation: isolate;
}
${wrapperSelectors}::after {
  content: "" !important;
  position: absolute !important;
  inset: 0 !important;
  ${overlayPattern};
  ${rot ? `transform: rotate(${rot}deg) !important; transform-origin: center !important;` : ''}
  pointer-events: none !important;
  opacity: 0.4 !important;
  mix-blend-mode: soft-light !important;
  border-radius: inherit;
  z-index: 1 !important;
}`);
    }
  }

  return rules.filter(Boolean).join('\n\n');
}

/** @param {string} declarations semicolon-separated CSS decls without trailing `;` issues */
function withImportant(declarations) {
  return declarations
    .split(';')
    .map((decl) => decl.trim())
    .filter(Boolean)
    .map((decl) => (/!important\s*$/.test(decl) ? decl : `${decl} !important`))
    .join('; ');
}

/** @param {string} pattern */
function fillTextureDeclarations(pattern) {
  return withImportant(
    [
      pattern,
      // Blend the pattern with theme/page background-color.
      'background-blend-mode: soft-light',
      'background-clip: border-box',
    ].join('; ')
  );
}

/** @param {string} pattern */
function textTextureDeclarations(pattern) {
  return withImportant(
    [
      pattern,
      '-webkit-background-clip: text',
      'background-clip: text',
      '-webkit-text-fill-color: transparent',
      'color: transparent',
    ].join('; ')
  );
}

function bareLinkCancelSelectors() {
  return [
    'body header a[href]',
    'body footer a[href]',
    'body nav a[href]',
    'body [role="banner"] a[href]',
    'body [role="contentinfo"] a[href]',
    'body [role="navigation"] a[href]',
    'body [data-gmixer-role="header"] a[href]',
    'body [data-gmixer-role="footer"] a[href]',
    'body [data-gmixer-role="navigation"] a[href]',
    'body h1 a[href]',
    'body h2 a[href]',
    'body h3 a[href]',
    'body h4 a[href]',
    'body h5 a[href]',
    'body h6 a[href]',
    'body [role="heading"] a[href]',
  ].join(', ');
}
