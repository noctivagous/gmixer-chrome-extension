import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TONE_SPECTRUM,
  toneCanvas,
  toneCanvasLightness,
  toneStop,
} from '../src/lib/tone-canvas.js';

describe('tone canvas ladder', () => {
  it('keeps the current Light/Gray/Dark canonical lightness', () => {
    assert.equal(toneCanvasLightness('light'), 96);
    assert.equal(toneCanvasLightness('gray'), 42);
    assert.equal(toneCanvasLightness('dark'), 8);
  });

  it('places Light Gray and Dark Gray on the 5-stop spectrum', () => {
    assert.deepEqual(
      TONE_SPECTRUM.map((stop) => stop.id),
      ['light', 'light-gray', 'gray', 'dark-gray', 'dark']
    );
    assert.ok(toneCanvasLightness('light-gray') < toneCanvasLightness('light'));
    assert.ok(toneCanvasLightness('light-gray') > toneCanvasLightness('gray'));
    assert.ok(toneCanvasLightness('dark-gray') < toneCanvasLightness('gray'));
    assert.ok(toneCanvasLightness('dark-gray') > toneCanvasLightness('dark'));
  });

  it('maps intensity 0 to the lighter end of a tone and 1 to the darker end', () => {
    assert.ok(toneCanvasLightness('light', 0) > toneCanvasLightness('light', 1));
    assert.ok(toneCanvasLightness('dark', 0) > toneCanvasLightness('dark', 1));
    assert.ok(toneCanvasLightness('dark', 1) <= 8);
    assert.ok(toneCanvasLightness('light', 0) >= 96);
  });

  it('builds a dark canvas with elevated secondary/surface and light text', () => {
    const canvas = toneCanvas('dark');
    assert.equal(canvas.scheme, 'dark');
    assert.match(canvas.bg, /^#[0-9a-f]{6}$/);
    assert.notEqual(canvas.bg, canvas.secondary);
    assert.notEqual(canvas.secondary, canvas.surface);
    assert.equal(canvas.text, '#ebebeb');
  });

  it('builds a light canvas with lowered secondary/surface and dark text', () => {
    const canvas = toneCanvas('light');
    assert.equal(canvas.scheme, 'light');
    assert.equal(toneStop('light').scheme, 'light');
    assert.equal(canvas.text, '#1f1f1f');
  });

  it('falls unknown tone ids back to dark', () => {
    assert.equal(toneStop('sepia').id, 'dark');
    assert.equal(toneCanvasLightness('sepia'), 8);
  });
});
