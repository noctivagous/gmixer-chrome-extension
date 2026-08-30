import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CUSTOMIZATION_LEVEL_OPTIONS,
  DEFERRED_SECTION_IDS,
  WALKTHROUGH_SLIDES,
  effectiveCustomizationLevel,
  filterSectionsByCustomizationLevel,
  isDeferredSection,
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

/** Sections visible in 0.1.0 after Texture + Clipping/Corners are deferred. */
const ACTIVE_SECTION_IDS = SECTIONS.map((section) => section.id).filter(
  (id) => !DEFERRED_SECTION_IDS.has(id)
);

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

  it('defers Texture and Clipping/Corners for 0.1.0', () => {
    assert.equal(isDeferredSection('texture'), true);
    assert.equal(isDeferredSection('shape'), true);
    assert.equal(isDeferredSection('effects'), false);
    assert.deepEqual([...DEFERRED_SECTION_IDS].sort(), ['shape', 'texture']);
  });

  it('Level 1 shows only Tone…Effects sections (minus deferred)', () => {
    assert.deepEqual(
      filterSectionsByCustomizationLevel(SECTIONS, 1).map((section) => section.id),
      ['tone', 'color', 'filter', 'fonts', 'effects']
    );
  });

  it('Level 2 includes remaining current sections (minus deferred)', () => {
    assert.deepEqual(
      filterSectionsByCustomizationLevel(SECTIONS, 2).map((section) => section.id),
      ACTIVE_SECTION_IDS
    );
  });

  it('Level 3 matches Level 2 until Level 3 content exists', () => {
    assert.deepEqual(
      filterSectionsByCustomizationLevel(SECTIONS, 3).map((section) => section.id),
      filterSectionsByCustomizationLevel(SECTIONS, 2).map((section) => section.id)
    );
  });

  it('walkthrough Level 1 skips deferred Texture', () => {
    assert.deepEqual(
      visibleWalkthroughSlides(1).map((slide) => slide.label),
      ['Tone', 'Color Scheme', 'Chroming Media', 'Typography', 'Effects']
    );
  });

  it('walkthrough Level 2 appends remaining Settings sections (minus deferred)', () => {
    assert.deepEqual(
      visibleWalkthroughSlides(2).map((slide) => slide.id),
      WALKTHROUGH_SLIDES.map((slide) => slide.id).filter((id) => !DEFERRED_SECTION_IDS.has(id))
    );
  });

  it('gates paint by customization level and deferred sections', () => {
    assert.equal(sectionAllowedByCustomizationLevel({ customizationLevel: 1 }, 'navigation'), false);
    assert.equal(sectionAllowedByCustomizationLevel({ customizationLevel: 2 }, 'navigation'), true);
    assert.equal(sectionAllowedByCustomizationLevel({ customizationLevel: 2 }, 'shape'), false);
    assert.equal(sectionAllowedByCustomizationLevel({ customizationLevel: 1 }, 'texture'), false);
    assert.equal(sectionVisibleAtLevel('tone', 1), true);
    assert.equal(sectionVisibleAtLevel('texture', 1), false);
    assert.equal(sectionVisibleAtLevel('shape', 2), false);
  });

  it('saves enablement and disables sections when level drops beneath them', () => {
    const global = {
      ui: { customizationLevel: 2, customizationLevelSectionMemory: {} },
      sections: { navigation: true, effects: true, filter: true },
      navigation: { enabled: true },
      imageFilter: { enabled: true },
    };
    const patch = patchForCustomizationLevel(2, 1, global);
    assert.equal(patch.ui.customizationLevel, 1);
    assert.equal(patch.sections.navigation, false);
    assert.equal(patch.navigation.enabled, false);
    assert.equal(patch.ui.customizationLevelSectionMemory.navigation, true);
    assert.equal(patch.sections.effects, undefined);
    // Deferred shape/texture are skipped — no memory churn while suspended.
    assert.equal(patch.sections.shape, undefined);
    assert.equal(patch.sections.texture, undefined);
  });

  it('restores remembered enablement when level rises again', () => {
    const global = {
      ui: {
        customizationLevel: 1,
        customizationLevelSectionMemory: { navigation: false },
      },
      sections: { navigation: false },
      navigation: { enabled: false },
    };
    const patch = patchForCustomizationLevel(1, 2, global);
    assert.equal(patch.ui.customizationLevel, 2);
    assert.equal(patch.sections.navigation, false);
    assert.equal(patch.navigation.enabled, false);
    // null clears keys under store deepMerge.
    assert.equal(patch.ui.customizationLevelSectionMemory.navigation, null);
  });
});
