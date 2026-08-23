import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  SETTINGS_FOCUS_OPTIONS,
  preferredOpenSectionForFocus,
  visibleSectionsForFocus,
} from '../src/settings/settings-focus.js';

const SECTIONS = [
  { id: 'tone' },
  { id: 'filter' },
  { id: 'color' },
  { id: 'fonts' },
];

describe('settings-focus', () => {
  it('lists the three product-description focus options', () => {
    assert.deepEqual(
      SETTINGS_FOCUS_OPTIONS.map((option) => option.id),
      ['media', 'tone', 'theme']
    );
  });

  it('shows only Tone for tone focus', () => {
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
});
