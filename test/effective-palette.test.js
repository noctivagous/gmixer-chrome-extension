import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyColorOverrides,
  effectiveRoleColors,
  emptyColorOverrides,
  isPaletteCascadeLocked,
  paletteHasResettableOverrides,
  resetOverridesFromPrimary,
  resolveEffectivePalette,
} from '../src/lib/effective-palette.js';
import { buildPalette, deriveSurface, hexToHsl } from '../src/lib/color-theory.js';
import { createDefaultState } from '../src/state/schema.js';

describe('effective-palette', () => {
  it('includes schemeBaseColor in schema defaults', () => {
    const color = createDefaultState().global.color;
    assert.equal(color.schemeBaseColor, '#8a8a8a');
    assert.equal(color.baseColor, color.schemeBaseColor);
  });

  it('emptyColorOverrides matches install Auto overrides', () => {
    assert.deepEqual(emptyColorOverrides(), createDefaultState().global.color.overrides);
  });

  it('Only: Tone forces neutral monochrome and ignores overrides', () => {
    const global = createDefaultState().global;
    global.ui.settingsFocus = 'tone';
    global.sections.color = true;
    global.color.baseColor = '#7c3aed';
    global.color.scheme = 'triadic';
    global.color.overrides.background = '#ff0000';

    const resolved = resolveEffectivePalette(global, { colorSectionOn: true });
    assert.equal(resolved.toneFocus, true);
    assert.equal(resolved.paletteBaseColor, '#8a8a8a');
    assert.equal(resolved.paletteScheme, 'monochrome');
    assert.deepEqual(resolved.overrides, {});
    assert.equal(resolved.applyOverrides, false);

    const expected = buildPalette('#8a8a8a', 'monochrome', 'dark');
    assert.equal(resolved.themePalette.background, expected.background);
    assert.equal(effectiveRoleColors(global).background, expected.background);
  });

  it('Color Off forces monochrome while keeping baseColor', () => {
    const global = createDefaultState().global;
    global.sections.color = false;
    global.color.baseColor = '#7c3aed';
    global.color.scheme = 'triadic';
    const resolved = resolveEffectivePalette(global);
    assert.equal(resolved.paletteScheme, 'monochrome');
    assert.equal(resolved.paletteBaseColor, '#7c3aed');
  });

  it('cascades Auto Secondary/surfaces from a Primary override', () => {
    const palette = buildPalette('#8a8a8a', 'monochrome', 'dark');
    const applied = applyColorOverrides(palette, { background: '#112233' });
    const isDark = hexToHsl('#112233').l < 50;
    assert.equal(applied.background, '#112233');
    assert.equal(applied.backgroundSecondary, deriveSurface('#112233', isDark));
    assert.equal(
      applied.surfaceGui,
      deriveSurface(applied.backgroundSecondary, isDark)
    );
    assert.equal(applied.cascadeFromPrimary, true);
  });

  it('keeps an explicit Secondary override beside Primary', () => {
    const palette = buildPalette('#8a8a8a', 'monochrome', 'dark');
    const applied = applyColorOverrides(palette, {
      background: '#112233',
      backgroundSecondary: '#abcdef',
    });
    assert.equal(applied.backgroundSecondary, '#abcdef');
    assert.equal(applied.cascadeFromPrimary, false);
  });

  it('treats Primary/Secondary-only overrides as cascade-locked', () => {
    assert.equal(isPaletteCascadeLocked({}), true);
    assert.equal(isPaletteCascadeLocked({ background: '#112233' }), true);
    assert.equal(
      isPaletteCascadeLocked({ background: '#112233', backgroundSecondary: '#abcdef' }),
      true
    );
    assert.equal(isPaletteCascadeLocked({ accent: '#ff00aa' }), false);
    assert.equal(isPaletteCascadeLocked({ text: '#ffffff', background: '#000' }), false);
  });

  it('reset keeps Primary and clears Secondary plus downstream roles', () => {
    const next = resetOverridesFromPrimary({
      background: '#112233',
      backgroundSecondary: '#abcdef',
      accent: '#ff00aa',
      text: '#eeeeee',
    });
    assert.equal(next.background, '#112233');
    assert.equal(next.backgroundSecondary, '');
    assert.equal(next.accent, '');
    assert.equal(next.text, '');
    assert.equal(isPaletteCascadeLocked(next), true);
    assert.equal(paletteHasResettableOverrides(next), false);
    assert.equal(
      paletteHasResettableOverrides({ background: '#112233', backgroundSecondary: '#abcdef' }),
      true
    );
  });
});
