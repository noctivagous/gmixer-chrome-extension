import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEXTURE_MODES,
  TEXTURE_GRID_STYLES,
  TEXTURE_SURFACES,
  TEXTURE_SURFACE_GROUPS,
  TEXTURE_DISTANCE_MIN,
  TEXTURE_DISTANCE_MAX,
  TEXTURE_ROTATION_MIN,
  TEXTURE_ROTATION_MAX,
  createDefaultTexture,
  normalizeTexture,
  texturePreviewStyle,
  textureSurfaceEnabled,
} from '../src/config/texture-catalog.js';
import {
  buildPreviewTextureCss,
  previewTextureActive,
} from '../src/lib/preview-texture-css.js';
import { texturePageRules } from '../src/lib/texture-page-css.js';
import { buildCss } from '../src/content/style-injector.js';
import { createDefaultState } from '../src/state/schema.js';

describe('texture-catalog', () => {
  it('lists Off, Noise, and Grid modes', () => {
    assert.deepEqual(
      TEXTURE_MODES.map((mode) => mode.id),
      ['none', 'noise', 'grid']
    );
  });

  it('lists the four grid styles', () => {
    assert.deepEqual(
      TEXTURE_GRID_STYLES.map((style) => style.id),
      ['diamond-x', 'diamond-y', 'rect-dots', 'square-dots']
    );
  });

  it('ships UI surfaces for GUI, media, accent, link, and muted groups', () => {
    assert.deepEqual(TEXTURE_SURFACE_GROUPS, [
      'Surface:GUI',
      'Media',
      'Accent headings',
      'Links',
      'Muted captions',
    ]);
    const uiIds = TEXTURE_SURFACES.filter((surface) => surface.inUi).map((surface) => surface.id);
    assert.deepEqual(uiIds, [
      'gui.button',
      'gui.input',
      'gui.textarea',
      'gui.slider',
      'media.articleImage',
      'media.videoThumb',
      'accent.headingLarge',
      'accent.headingMedium',
      'accent.headingSmall',
      'link.bare',
      'link.article',
      'link.heading',
      'muted.kicker',
      'muted.photoCaption',
      'muted.asideNotes',
    ]);
  });

  it('returns stable defaults with GUI button/input on', () => {
    const defaults = createDefaultTexture();
    assert.equal(defaults.mode, 'none');
    assert.equal(defaults.gridStyle, 'square-dots');
    assert.equal(defaults.surfaces['gui.button'], true);
    assert.equal(defaults.surfaces['gui.input'], true);
    assert.equal(defaults.surfaces['gui.textarea'], false);
    assert.equal(defaults.surfaces['media.articleImage'], false);
    assert.equal(defaults.surfaces.containers, false);
  });

  it('normalizes invalid mode and style to defaults', () => {
    const normalized = normalizeTexture({
      mode: 'sparkles',
      gridStyle: 'hex',
      xDistance: 12,
      yDistance: 12,
      gridRotation: 0,
    });
    assert.equal(normalized.mode, 'none');
    assert.equal(normalized.gridStyle, 'square-dots');
  });

  it('clamps distance and rotation into range', () => {
    const normalized = normalizeTexture({
      mode: 'grid',
      gridStyle: 'rect-dots',
      xDistance: 999,
      yDistance: 1,
      gridRotation: -20,
    });
    assert.equal(normalized.xDistance, TEXTURE_DISTANCE_MAX);
    assert.equal(normalized.yDistance, TEXTURE_DISTANCE_MIN);
    assert.equal(normalized.gridRotation, TEXTURE_ROTATION_MIN);
    assert.equal(normalized.mode, 'grid');
    assert.equal(normalized.gridStyle, 'rect-dots');
  });

  it('clamps rotation to the upper bound', () => {
    const normalized = normalizeTexture({
      mode: 'grid',
      gridStyle: 'diamond-x',
      xDistance: 20,
      yDistance: 20,
      gridRotation: 180,
    });
    assert.equal(normalized.gridRotation, TEXTURE_ROTATION_MAX);
  });

  it('normalizes surface flags and ignores unknown keys', () => {
    const normalized = normalizeTexture({
      mode: 'noise',
      surfaces: {
        'gui.button': false,
        'accent.headingLarge': true,
        'not.a.surface': true,
      },
    });
    assert.equal(normalized.surfaces['gui.button'], false);
    assert.equal(normalized.surfaces['gui.input'], true);
    assert.equal(normalized.surfaces['accent.headingLarge'], true);
    assert.equal(normalized.surfaces['not.a.surface'], undefined);
  });

  it('reports surface enabled only when mode is active', () => {
    const off = createDefaultTexture();
    assert.equal(textureSurfaceEnabled(off, 'gui.button'), false);
    assert.equal(
      textureSurfaceEnabled({ ...off, mode: 'noise' }, 'gui.button'),
      true
    );
  });

  it('builds preview CSS for noise and grid', () => {
    const noise = texturePreviewStyle({ ...createDefaultTexture(), mode: 'noise' });
    assert.match(noise, /radial-gradient/);

    const grid = texturePreviewStyle({
      mode: 'grid',
      xDistance: 16,
      yDistance: 20,
      gridRotation: 15,
      gridStyle: 'square-dots',
      surfaces: createDefaultTexture().surfaces,
    });
    assert.match(grid, /--gm-texture-rot: 15deg/);
    assert.match(grid, /16px 20px/);
  });

  it('returns transparent preview when off', () => {
    assert.equal(texturePreviewStyle(createDefaultTexture()), 'background: transparent;');
  });
});

describe('preview-texture-css', () => {
  it('is inactive when the Texture section is off', () => {
    assert.equal(
      previewTextureActive({
        sections: { texture: false },
        texture: { mode: 'noise', surfaces: { 'gui.button': true } },
      }),
      false
    );
  });

  it('is inactive while Texture is deferred for 0.1.0 even if the section is on', () => {
    assert.equal(
      previewTextureActive({
        sections: { texture: true },
        texture: { mode: 'noise', surfaces: { 'gui.button': true } },
      }),
      false
    );
  });

  it('emits scoped rules for enabled fill and text surfaces', () => {
    const css = buildPreviewTextureCss({
      mode: 'noise',
      surfaces: {
        'gui.button': true,
        'accent.headingLarge': true,
        'media.articleImage': true,
      },
    });
    assert.match(css, /\.theme-preview \.blurb-button/);
    assert.match(css, /\.theme-preview \.blurb-title/);
    assert.match(css, /\.theme-preview \.blurb-image-wrap/);
    assert.match(css, /background-clip: text/);
    assert.match(css, /::after/);
  });
});

describe('texture-page-css', () => {
  it('emits nothing when mode is off', () => {
    assert.equal(texturePageRules(createDefaultTexture()), '');
  });

  it('emits Family A fill rules for GUI controls', () => {
    const css = texturePageRules({
      mode: 'noise',
      surfaces: {
        'gui.button': true,
        'gui.input': true,
        'gui.textarea': true,
      },
    });
    assert.match(css, /body button/);
    assert.match(css, /body textarea/);
    assert.match(css, /background-blend-mode:\s*soft-light\s*!important/);
  });

  it('emits Family B text-clip rules for headings and links', () => {
    const css = texturePageRules({
      mode: 'grid',
      gridStyle: 'square-dots',
      xDistance: 12,
      yDistance: 12,
      gridRotation: 0,
      surfaces: {
        'accent.headingLarge': true,
        'link.bare': true,
        'muted.photoCaption': true,
      },
    });
    assert.match(css, /body h1/);
    assert.match(css, /body main a\[href\]/);
    assert.match(css, /body figcaption/);
    assert.match(css, /background-clip:\s*text\s*!important/);
    assert.match(css, /body header a\[href\]/);
  });

  it('emits Family C media overlay rules on :has\\(\\) wrappers', () => {
    const css = texturePageRules({
      mode: 'noise',
      surfaces: {
        'media.articleImage': true,
        'media.videoThumb': true,
      },
    });
    assert.match(css, /data-gmixer-media="article-image"/);
    assert.match(css, /data-gmixer-video-state="paused"/);
    assert.doesNotMatch(css, /video:paused/);
    assert.match(css, /::after/);
    assert.match(css, /mix-blend-mode:\s*soft-light\s*!important/);
  });

  it('buildCss omits texture rules while Texture is deferred for 0.1.0', () => {
    const global = createDefaultState().global;
    global.sections.texture = true;
    global.texture = {
      mode: 'noise',
      surfaces: { 'gui.button': true },
    };
    assert.doesNotMatch(buildCss(global, null), /body button[\s\S]*background-blend-mode/);
  });
});
