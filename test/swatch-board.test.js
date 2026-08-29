import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildPalette, hexToHsl } from '../src/lib/color-theory.js';
import {
  SWATCH_ASSIGN_ROLES,
  autoAssignSwatches,
  buildSwatchBoard,
  cellHex,
  hasSwatchAssignments,
  isValidCoord,
  resolveSwatchAssignments,
} from '../src/lib/swatch-board.js';
import { effectiveRoleColors } from '../src/lib/effective-palette.js';
import { createDefaultState } from '../src/state/schema.js';

describe('swatch-board', () => {
  it('sizes the family grid by scheme hue count', () => {
    const analog = buildSwatchBoard('#7c3aed', 'analog');
    const complement = buildSwatchBoard('#7c3aed', 'complement');
    const triadic = buildSwatchBoard('#7c3aed', 'triadic');
    const tetradic = buildSwatchBoard('#7c3aed', 'tetradic');
    assert.equal(analog.hues, 3);
    assert.equal(complement.hues, 2);
    assert.equal(triadic.hues, 3);
    assert.equal(tetradic.hues, 4);
    assert.equal(triadic.rows.colors.length, 3);
    assert.equal(triadic.rows.tint.length, 15);
    assert.equal(triadic.cells.length, 3 + 15 + 15 + 15);
  });

  it('auto-assigns every surface role onto a valid cell', () => {
    const base = '#7c3aed';
    const assignments = autoAssignSwatches(base, 'triadic', 'dark');
    const board = buildSwatchBoard(base, 'triadic');
    for (const role of SWATCH_ASSIGN_ROLES) {
      assert.equal(isValidCoord(assignments[role.id], board), true, role.id);
    }
    const palette = buildPalette(base, 'triadic', 'dark');
    const bg = hexToHsl(cellHex(board, assignments.background));
    const expected = hexToHsl(palette.background);
    assert.ok(Math.abs(bg.l - expected.l) < 25);
  });

  it('keeps assignment coordinates when lightness changes', () => {
    const start = autoAssignSwatches('#7c3aed', 'triadic', 'dark');
    const darker = '#2c1a5c';
    const { assignments } = resolveSwatchAssignments(start, darker, 'triadic', 'dark');
    assert.deepEqual(assignments.background, start.background);
    const lightHex = cellHex(buildSwatchBoard('#7c3aed', 'triadic'), start.background);
    const darkHex = cellHex(buildSwatchBoard(darker, 'triadic'), assignments.background);
    assert.notEqual(lightHex.toLowerCase(), darkHex.toLowerCase());
  });

  it('rebuilds out-of-range hues after a scheme change', () => {
    const tetra = autoAssignSwatches('#7c3aed', 'tetradic', 'dark');
    tetra.accent = { scale: 'colors', hue: 3, step: 0 };
    const { board, assignments } = resolveSwatchAssignments(tetra, '#7c3aed', 'complement', 'dark');
    assert.equal(board.hues, 2);
    assert.equal(isValidCoord(assignments.accent, board), true);
    assert.ok(assignments.accent.hue < 2);
  });

  it('effectiveRoleColors uses pinned cell hex when assignments exist', () => {
    const global = createDefaultState().global;
    global.sections.color = true;
    global.color.scheme = 'triadic';
    global.color.baseColor = '#7c3aed';
    global.color.schemeBaseColor = '#7c3aed';
    const board = buildSwatchBoard('#7c3aed', 'triadic');
    const pin = { scale: 'colors', hue: 1, step: 0 };
    global.color.swatchAssignments = {
      ...autoAssignSwatches('#7c3aed', 'triadic', 'dark'),
      background: pin,
    };
    const colors = effectiveRoleColors(global);
    assert.equal(colors.background.toLowerCase(), cellHex(board, pin).toLowerCase());
  });

  it('treats empty swatchAssignments as unset', () => {
    assert.equal(hasSwatchAssignments({}), false);
    assert.equal(hasSwatchAssignments({ background: { scale: 'colors', hue: 0, step: 0 } }), true);
  });
});
