import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SETTINGS_FOCUS_OPTIONS,
  preferredOpenSectionForFocus,
  patchForSettingsFocus,
  sectionAllowedByFocus,
  visibleSectionsForFocus,
} from '../src/settings/settings-focus.js';

const SECTIONS = [
  { id: 'tone' },
  { id: 'color' },
  { id: 'filter' },
  { id: 'fonts' },
];

describe('settings-focus', () => {
  it('lists the three product-description focus options', () => {
    assert.deepEqual(
      SETTINGS_FOCUS_OPTIONS.map((option) => option.id),
      ['media', 'tone', 'theme']
    );
  });

  it('shows Tone for tone focus', () => {
    assert.deepEqual(
      visibleSectionsForFocus(SECTIONS, 'tone').map((section) => section.id),
      ['tone']
    );
  });

  it('shows only Media for media focus', () => {
    assert.deepEqual(
      visibleSectionsForFocus(SECTIONS, 'media').map((section) => section.id),
      ['filter']
    );
  });

  it('shows all sections for theme focus and unknown values', () => {
    assert.equal(visibleSectionsForFocus(SECTIONS, 'theme').length, SECTIONS.length);
    assert.equal(visibleSectionsForFocus(SECTIONS, null).length, SECTIONS.length);
    assert.equal(visibleSectionsForFocus(SECTIONS, 'nope').length, SECTIONS.length);
  });

  it('prefers opening the focused section', () => {
    assert.equal(preferredOpenSectionForFocus('tone'), 'tone');
    assert.equal(preferredOpenSectionForFocus('media'), 'filter');
    assert.equal(preferredOpenSectionForFocus('theme'), null);
  });

  it('enables Media accordion, monochrome filter, and reveal-on-hover for media focus', () => {
    const patch = patchForSettingsFocus('media');
    assert.equal(patch.ui.settingsFocus, 'media');
    assert.equal(patch.ui.openSection, 'filter');
    assert.equal(patch.sections.filter, true);
    assert.equal(patch.imageFilter.enabled, true);
    assert.equal(patch.imageFilter.categories.images, 'monochrome');
    assert.equal(patch.imageFilter.categories.bgImages, 'monochrome');
    assert.equal(patch.imageFilter.revealOnHover, true);
  });

  it('enables Tone with Color Scheme Off (walkthrough slide 0 baseline)', () => {
    const patch = patchForSettingsFocus('tone');
    assert.equal(patch.sections.tone, true);
    assert.equal(patch.sections.color, false);
    assert.equal(patch.ui.openSection, 'tone');
    assert.equal(patch.color.scheme, 'monochrome');
    assert.equal(patch.color.identityMode, 'restyle');
    assert.equal(patch.color.intensity, 100);
  });

  it('gates non-Media sections when focus is media-only', () => {
    assert.equal(sectionAllowedByFocus('media', 'filter'), true);
    assert.equal(sectionAllowedByFocus('media', 'tone'), false);
    assert.equal(sectionAllowedByFocus('media', 'color'), false);
    assert.equal(sectionAllowedByFocus('media', 'fonts'), false);
    assert.equal(sectionAllowedByFocus('media', 'navigation'), false);
  });

  it('gates non-Tone sections when focus is tone-only', () => {
    assert.equal(sectionAllowedByFocus('tone', 'color'), false);
    assert.equal(sectionAllowedByFocus('tone', 'tone'), true);
    assert.equal(sectionAllowedByFocus('tone', 'filter'), false);
    assert.equal(sectionAllowedByFocus('tone', 'fonts'), false);
  });

  it('allows all sections under Theme focus', () => {
    assert.equal(sectionAllowedByFocus('theme', 'color'), true);
    assert.equal(sectionAllowedByFocus('theme', 'filter'), true);
    assert.equal(sectionAllowedByFocus(null, 'fonts'), true);
  });
});
