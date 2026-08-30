import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEDIA_FILTER_CATEGORIES,
  DEFAULT_MEDIA_FILTER_CATEGORIES,
  normalizeImageFilter,
  migrateLegacyImageFilterCategories,
  resolveAutoMediaRoleFilter,
  imageFilterAppliesToBackgrounds,
} from '../src/config/image-filter-presets.js';
import { buildCss } from '../src/content/style-injector.js';
import { createDefaultState } from '../src/state/schema.js';
import { effectiveCustomizationLevel } from '../src/settings/customization-level.js';

describe('image-filter categories', () => {
  it('lists the five primary Chroming Media rows', () => {
    assert.deepEqual(
      MEDIA_FILTER_CATEGORIES.map((category) => category.id),
      ['articleImages', 'images', 'bgImages', 'videos', 'videoPlayback']
    );
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
      videos: 'link-wash',
      videoPlayback: 'invert',
    };
    assert.equal(resolveAutoMediaRoleFilter('articleImage', cats), 'accent-tint');
    assert.equal(resolveAutoMediaRoleFilter('videoThumbnail', cats), 'link-wash');
    assert.equal(resolveAutoMediaRoleFilter('avatar', cats), 'monochrome');
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
        videos: 'link-wash',
        videoPlayback: 'sepia',
      },
    };
    const css = buildCss(global, null);
    assert.match(css, /data-gmixer-media="article-image"/);
    assert.match(css, /img:not\(\[data-gmixer-media="article-image"\]\)/);
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
