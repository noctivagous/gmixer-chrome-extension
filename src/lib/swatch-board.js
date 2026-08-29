// Scheme family grid + surface-role assignments. Cells are identified by
// (scale, hue, step) so hue/S/L can cascade without freezing hex.

import { accentHueOffsets, buildPalette, getColorScale, hexToHsl, hslToHex } from './color-theory.js';

export const SWATCH_SCALE_STEPS = 5;

export const SWATCH_ASSIGN_ROLES = [
  { id: 'background', label: 'BG:Primary · root', short: 'BG' },
  { id: 'backgroundSecondary', label: 'BG:Secondary · sheet', short: 'Sheet' },
  { id: 'surfaceGui', label: 'GUI', short: 'GUI' },
  { id: 'surfaceContainers', label: 'Containers', short: 'Box' },
  { id: 'text', label: 'Text', short: 'Text' },
  { id: 'muted', label: 'Muted', short: 'Muted' },
  { id: 'accent', label: 'Accent', short: 'Accent' },
  { id: 'link', label: 'Link', short: 'Link' },
  { id: 'navLink', label: 'Nav', short: 'Nav' },
  { id: 'border', label: 'Border', short: 'Line' },
  { id: 'focus', label: 'Focus', short: 'Focus' },
];

/** @param {string} hex */
export function schemeHueHexes(hex, scheme) {
  const hsl = hexToHsl(hex || '#8a8a8a');
  return [0, ...accentHueOffsets(scheme)].map((offset) =>
    hslToHex({ ...hsl, h: (hsl.h + offset + 360) % 360 })
  );
}

/**
 * @param {string} baseColorHex
 * @param {string} scheme
 * @returns {{ hues: number, steps: number, cells: { scale: string, hue: number, step: number, hex: string }[], rows: { colors: string[], tint: string[], shade: string[], tone: string[] } }}
 */
export function buildSwatchBoard(baseColorHex, scheme) {
  const hues = schemeHueHexes(baseColorHex, scheme);
  const steps = SWATCH_SCALE_STEPS;
  /** @type {{ scale: string, hue: number, step: number, hex: string }[]} */
  const cells = [];
  hues.forEach((hex, hue) => {
    cells.push({ scale: 'colors', hue, step: 0, hex });
  });
  for (const scale of /** @type {const} */ (['tint', 'shade', 'tone'])) {
    hues.forEach((hex, hue) => {
      getColorScale(hex, scale, steps).forEach((cellHex, step) => {
        cells.push({ scale, hue, step, hex: cellHex });
      });
    });
  }
  const rowOf = (scale) => cells.filter((cell) => cell.scale === scale).map((cell) => cell.hex);
  return {
    hues: hues.length,
    steps,
    cells,
    rows: {
      colors: rowOf('colors'),
      tint: rowOf('tint'),
      shade: rowOf('shade'),
      tone: rowOf('tone'),
    },
  };
}

/** @param {{ scale?: string, hue?: number, step?: number }|null|undefined} coord */
export function isValidCoord(coord, board) {
  if (!coord || !board) return false;
  const hue = Number(coord.hue);
  const step = Number(coord.step);
  if (!Number.isFinite(hue) || hue < 0 || hue >= board.hues) return false;
  if (coord.scale === 'colors') return step === 0;
  if (coord.scale === 'tint' || coord.scale === 'shade' || coord.scale === 'tone') {
    return Number.isFinite(step) && step >= 0 && step < board.steps;
  }
  return false;
}

export function coordKey(coord) {
  if (!coord) return '';
  return `${coord.scale}:${coord.hue}:${coord.step}`;
}

/** @param {string} a @param {string} b */
export function hslDistance(a, b) {
  const left = hexToHsl(a);
  const right = hexToHsl(b);
  let dh = Math.abs(left.h - right.h);
  if (dh > 180) dh = 360 - dh;
  return dh / 180 + Math.abs(left.s - right.s) / 100 + Math.abs(left.l - right.l) / 100;
}

function scaleRank(scale) {
  if (scale === 'colors') return 0;
  if (scale === 'tint') return 1;
  if (scale === 'shade') return 2;
  return 3;
}

export function nearestCell(board, hex) {
  let best = board.cells[0];
  let bestScore = Infinity;
  for (const cell of board.cells) {
    const dist = hslDistance(cell.hex, hex);
    if (dist < bestScore - 1e-9) {
      best = cell;
      bestScore = dist;
      continue;
    }
    if (Math.abs(dist - bestScore) <= 1e-9) {
      if (
        scaleRank(cell.scale) < scaleRank(best.scale) ||
        (cell.scale === best.scale && (cell.step < best.step || (cell.step === best.step && cell.hue < best.hue)))
      ) {
        best = cell;
      }
    }
  }
  return { scale: best.scale, hue: best.hue, step: best.step };
}

export function autoAssignSwatches(baseColorHex, scheme, themeMode = 'dark') {
  const board = buildSwatchBoard(baseColorHex, scheme);
  const palette = buildPalette(baseColorHex, scheme, themeMode);
  /** @type {Record<string, { scale: string, hue: number, step: number }>} */
  const assignments = {};
  for (const role of SWATCH_ASSIGN_ROLES) {
    assignments[role.id] = nearestCell(board, palette[role.id] || palette.background);
  }
  return assignments;
}

export function hasSwatchAssignments(stored) {
  if (!stored || typeof stored !== 'object') return false;
  return SWATCH_ASSIGN_ROLES.some((role) => isBareCoord(stored[role.id]));
}

function isBareCoord(value) {
  return !!(value && typeof value === 'object' && typeof value.scale === 'string');
}

/**
 * Valid stored coords win; missing/invalid roles fall back to auto-assign.
 * @param {Record<string, { scale: string, hue: number, step: number }>|null|undefined} stored
 */
export function resolveSwatchAssignments(stored, baseColorHex, scheme, themeMode = 'dark') {
  const board = buildSwatchBoard(baseColorHex, scheme);
  const auto = autoAssignSwatches(baseColorHex, scheme, themeMode);
  /** @type {Record<string, { scale: string, hue: number, step: number }>} */
  const assignments = {};
  for (const role of SWATCH_ASSIGN_ROLES) {
    const coord = stored?.[role.id];
    assignments[role.id] = isValidCoord(coord, board) ? { scale: coord.scale, hue: coord.hue, step: coord.step } : auto[role.id];
  }
  return { board, assignments };
}

export function cellHex(board, coord) {
  if (!isValidCoord(coord, board)) return '';
  const found = board.cells.find(
    (cell) => cell.scale === coord.scale && cell.hue === coord.hue && cell.step === coord.step
  );
  return found?.hex || '';
}

/**
 * Overlay assignment hexes onto a generated palette. Hover roles follow link/nav
 * when they have no chip.
 * @param {object} palette
 * @param {Record<string, { scale: string, hue: number, step: number }>} assignments
 */
export function applySwatchAssignments(palette, assignments, board) {
  if (!board || !assignments) return palette;
  const next = { ...palette };
  for (const role of SWATCH_ASSIGN_ROLES) {
    const hex = cellHex(board, assignments[role.id]);
    if (hex) next[role.id] = hex;
  }
  return next;
}
