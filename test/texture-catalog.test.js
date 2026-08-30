import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TEXTURE_MODES,
  TEXTURE_GRID_STYLES,
  TEXTURE_DISTANCE_MIN,
  TEXTURE_DISTANCE_MAX,
  TEXTURE_ROTATION_MIN,
  TEXTURE_ROTATION_MAX,
  createDefaultTexture,
  normalizeTexture,
  texturePreviewStyle,
} from '../src/config/texture-catalog.js';

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

  it('returns stable defaults', () => {
    assert.deepEqual(createDefaultTexture(), {
      mode: 'none',
      xDistance: 12,
      yDistance: 12,
      gridRotation: 0,
      gridStyle: 'square-dots',
    });
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

  it('builds preview CSS for noise and grid', () => {
    const noise = texturePreviewStyle({ ...createDefaultTexture(), mode: 'noise' });
    assert.match(noise, /radial-gradient/);

    const grid = texturePreviewStyle({
      mode: 'grid',
      xDistance: 16,
      yDistance: 20,
      gridRotation: 15,
      gridStyle: 'square-dots',
    });
    assert.match(grid, /--gm-texture-rot: 15deg/);
    assert.match(grid, /16px 20px/);
  });

  it('returns transparent preview when off', () => {
    assert.equal(texturePreviewStyle(createDefaultTexture()), 'background: transparent;');
  });
});
