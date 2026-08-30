import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOMIZATION_LEVEL_OPTIONS,
  WALKTHROUGH_SLIDES,
  effectiveCustomizationLevel,
  filterSectionsByCustomizationLevel,
  patchForCustomizationLevel,
  sectionAllowedByCustomizationLevel,
  sectionVisibleAtLevel,
  visibleWalkthroughSlides,
} from '../src/settings/customization-level.js';

const SECTIONS = [
  { id: 'preview' },
  { id: 'tone' },
  { id: 'color' },
  { id: 'texture' },
  { id: 'filter' },
  { id: 'fonts' },
  { id: 'shape' },
  { id: 'effects' },
  { id: 'navigation' },
  { id: 'font-browser' },
];

describe('customization-level', () => {
  it('lists three customization levels', () => {
    assert.deepEqual(
      CUSTOMIZATION_LEVEL_OPTIONS.map((option) => option.id),
      [1, 2, 3]
    );
  });

  it('defaults missing level to 2 for legacy installs', () => {
    assert.equal(effectiveCustomizationLevel({}), 2);
    assert.equal(effectiveCustomizationLevel({ customizationLevel: 1 }), 1);
    assert.equal(effectiveCustomizationLevel({ customizationLevel: 99 }), 2);
  });

  it('Level 1 shows only Tone…Effects sections', () => {
    assert.deepEqual(
      filterSectionsByCustomizationLevel(SECTIONS, 1).map((section) => section.id),
      ['tone', 'color', 'texture', 'filter', 'fonts', 'effects']
    );
  });

  it('Level 2 includes remaining current sections', () => {
    assert.deepEqual(
      filterSectionsByCustomizationLevel(SECTIONS, 2).map((section) => section.id),
      SECTIONS.map((section) => section.id)
    );
  });

  it('Level 3 matches Level 2 until Level 3 content exists', () => {
    assert.deepEqual(
      filterSectionsByCustomizationLevel(SECTIONS, 3).map((section) => section.id),
      filterSectionsByCustomizationLevel(SECTIONS, 2).map((section) => section.id)
    );
  });

  it('walkthrough Level 1 includes Texture after Color Scheme', () => {
    assert.deepEqual(
      visibleWalkthroughSlides(1).map((slide) => slide.label),
      ['Tone', 'Color Scheme', 'Texture', 'Chroming Media', 'Typography', 'Effects']
    );
  });

  it('walkthrough Level 2 appends remaining Settings sections', () => {
    assert.deepEqual(
      visibleWalkthroughSlides(2).map((slide) => slide.id),
      WALKTHROUGH_SLIDES.map((slide) => slide.id)
    );
  });

  it('gates paint by customization level', () => {
    assert.equal(sectionAllowedByCustomizationLevel({ customizationLevel: 1 }, 'shape'), false);
    assert.equal(sectionAllowedByCustomizationLevel({ customizationLevel: 2 }, 'shape'), true);
    assert.equal(sectionVisibleAtLevel('tone', 1), true);
  });

  it('saves enablement and disables sections when level drops beneath them', () => {
    const global = {
      ui: { customizationLevel: 2, customizationLevelSectionMemory: {} },
      sections: { shape: true, navigation: true, effects: true },
      navigation: { enabled: true },
    };
    const patch = patchForCustomizationLevel(2, 1, global);
    assert.equal(patch.ui.customizationLevel, 1);
    assert.equal(patch.sections.shape, false);
    assert.equal(patch.sections.navigation, false);
    assert.equal(patch.navigation.enabled, false);
    assert.equal(patch.ui.customizationLevelSectionMemory.shape, true);
    assert.equal(patch.ui.customizationLevelSectionMemory.navigation, true);
    assert.equal(patch.sections.effects, undefined);
  });

  it('restores remembered enablement when level rises again', () => {
    const global = {
      ui: {
        customizationLevel: 1,
        customizationLevelSectionMemory: { shape: true, navigation: false },
      },
      sections: { shape: false, navigation: false },
      navigation: { enabled: false },
    };
    const patch = patchForCustomizationLevel(1, 2, global);
    assert.equal(patch.ui.customizationLevel, 2);
    assert.equal(patch.sections.shape, true);
    assert.equal(patch.sections.navigation, false);
    assert.equal(patch.navigation.enabled, false);
    // null clears keys under store deepMerge.
    assert.equal(patch.ui.customizationLevelSectionMemory.shape, null);
    assert.equal(patch.ui.customizationLevelSectionMemory.navigation, null);
  });
});
