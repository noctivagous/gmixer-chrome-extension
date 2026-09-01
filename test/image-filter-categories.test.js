import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEDIA_FILTER_CATEGORIES,
  DEFAULT_MEDIA_FILTER_CATEGORIES,
  IMAGE_FILTER_PRESETS,
  COLOR_CAST_PRESETS,
  normalizeImageFilter,
  migrateLegacyImageFilterCategories,
  resolveAutoMediaRoleFilter,
  imageFilterAppliesToBackgrounds,
  isImageFilterPresetId,
  paletteHexForFilterPreset,
} from '../src/config/image-filter-presets.js';
import { buildCss } from '../src/content/style-injector.js';
import { createDefaultState } from '../src/state/schema.js';
import { effectiveCustomizationLevel } from '../src/settings/customization-level.js';

describe('image-filter categories', () => {
  it('lists the primary Chroming Media rows including covers and avatars', () => {
    assert.deepEqual(
      MEDIA_FILTER_CATEGORIES.map((category) => category.id),
      ['articleImages', 'images', 'bgImages', 'covers', 'avatars', 'videos', 'videoPlayback']
    );
  });

  it('appends surface color casts at the bottom of the preset list (before custom)', () => {
    const ids = IMAGE_FILTER_PRESETS.map((preset) => preset.id);
    assert.equal(ids.at(-1), 'custom');
    const castIds = COLOR_CAST_PRESETS.map((preset) => preset.id);
    assert.deepEqual(ids.slice(-(castIds.length + 1), -1), castIds);
    assert.ok(castIds.includes('bg:secondary'));
    assert.ok(isImageFilterPresetId('bg:secondary'));
    assert.ok(isImageFilterPresetId('surface:gui'));
  });

  it('resolves palette hexes for surface color casts', () => {
    const palette = {
      background: '#111111',
      backgroundSecondary: '#222222',
      surfaceGui: '#333333',
      accent: '#3366ff',
    };
    assert.equal(paletteHexForFilterPreset('bg:secondary', palette), '#222222');
    assert.equal(paletteHexForFilterPreset('surface:gui', palette), '#333333');
    assert.equal(paletteHexForFilterPreset('accent', palette), '#3366ff');
  });

  it('migrates legacy preset+scope into categories', () => {
    const categories = migrateLegacyImageFilterCategories({
      enabled: true,
      preset: 'sepia',
      scope: 'both',
    });
    assert.equal(categories.images, 'sepia');
    assert.equal(categories.bgImages, 'sepia');
    assert.equal(categories.articleImages, 'sepia');
    assert.equal(categories.videos, 'sepia');
  });

  it('migrates backgrounds-only scope without touching images', () => {
    const categories = migrateLegacyImageFilterCategories({
      enabled: true,
      preset: 'monochrome',
      scope: 'backgrounds',
    });
    assert.equal(categories.bgImages, 'monochrome');
    assert.equal(categories.images, 'none');
    assert.equal(categories.articleImages, 'none');
  });

  it('keeps explicit categories when present', () => {
    const normalized = normalizeImageFilter({
      enabled: true,
      categories: {
        ...DEFAULT_MEDIA_FILTER_CATEGORIES,
        images: 'grayscale',
      },
    });
    assert.equal(normalized.categories.images, 'grayscale');
    assert.equal(normalized.categories.articleImages, 'accent-tint');
  });

  it('resolves Auto detailed roles onto primary categories', () => {
    const cats = {
      articleImages: 'accent-tint',
      images: 'monochrome',
      bgImages: 'sepia',
      covers: 'grayscale',
      avatars: 'grayscale',
      videos: 'link-wash',
      videoPlayback: 'invert',
    };
    assert.equal(resolveAutoMediaRoleFilter('articleImage', cats), 'accent-tint');
    assert.equal(resolveAutoMediaRoleFilter('videoThumbnail', cats), 'link-wash');
    assert.equal(resolveAutoMediaRoleFilter('coverImage', cats), 'grayscale');
    assert.equal(resolveAutoMediaRoleFilter('avatar', cats), 'grayscale');
  });

  it('detects background chroming from categories', () => {
    assert.equal(
      imageFilterAppliesToBackgrounds({
        enabled: true,
        categories: { ...DEFAULT_MEDIA_FILTER_CATEGORIES, bgImages: 'none' },
      }),
      false
    );
    assert.equal(
      imageFilterAppliesToBackgrounds({
        enabled: true,
        categories: DEFAULT_MEDIA_FILTER_CATEGORIES,
      }),
      true
    );
  });
});

describe('chroming media page paint', () => {
  it('emits per-category selectors from buildCss', () => {
    const global = createDefaultState().global;
    global.sections.filter = true;
    global.imageFilter = {
      enabled: true,
      revealOnHover: true,
      categories: {
        articleImages: 'accent-tint',
        images: 'monochrome',
        bgImages: 'monochrome',
        covers: 'grayscale',
        avatars: 'grayscale',
        videos: 'link-wash',
        videoPlayback: 'sepia',
      },
    };
    const css = buildCss(global, null);
    assert.match(css, /data-gmixer-media="article-image"/);
    assert.match(css, /data-gmixer-media="cover-image"/);
    assert.match(css, /data-gmixer-media="avatar"/);
    assert.match(
      css,
      /img:not\(\[data-gmixer-media="article-image"\]\):not\(\[data-gmixer-media="cover-image"\]\):not\(\[data-gmixer-media="logo"\]\):not\(\[data-gmixer-media="video-thumbnail"\]\):not\(\[data-gmixer-media="avatar"\]\)/
    );
    assert.match(css, /img\[data-gmixer-media="video-thumbnail"\]/);
    assert.match(css, /data-gmixer-video-state="paused"/);
    assert.match(css, /data-gmixer-video-state="playing"/);
    assert.doesNotMatch(css, /video:paused/);
    assert.doesNotMatch(css, /video:not\(:paused\)/);
    assert.match(css, /data-gmixer-bgimg/);
  });

  it('skips chroming CSS when the Media section is off', () => {
    const global = createDefaultState().global;
    global.sections.filter = false;
    global.imageFilter = {
      enabled: true,
      categories: DEFAULT_MEDIA_FILTER_CATEGORIES,
    };
    const css = buildCss(global, null);
    assert.doesNotMatch(css, /data-gmixer-media="article-image"/);
  });
});

describe('detailed media categories level gate', () => {
  it('Level 3 is the threshold for detailed category UI', () => {
    assert.equal(effectiveCustomizationLevel({ customizationLevel: 1 }), 1);
    assert.equal(effectiveCustomizationLevel({ customizationLevel: 3 }), 3);
  });
});
