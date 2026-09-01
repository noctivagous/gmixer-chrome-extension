import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectLiveSurfaces, PALETTE_CSS_VARS } from '../src/debug/live-surfaces.js';

function paintStyle(fill, ink, vars = {}) {
  return {
    backgroundColor: fill,
    color: ink,
    getPropertyValue: (name) => vars[name] || '',
  };
}

describe('live-surfaces', () => {
  it('reads assigned palette tokens and grouped classifier stamps', () => {
    const vars = {
      '--gmixer-bg-primary': '#111111',
      '--gmixer-bg-secondary': '#222222',
      '--gmixer-surface-gui': '#333333',
      '--gmixer-surface-containers': '#333333',
      '--gmixer-text': '#eeeeee',
    };
    const card = {
      tagName: 'ARTICLE',
      id: 'story',
      className: 'card',
      getAttribute: (name) =>
        ({ 'data-gmixer-role': 'card', 'data-gmixer-tone-step': '1' }[name] ?? null),
      hasAttribute: (name) => name === 'data-gmixer-role' || name === 'data-gmixer-tone-step',
    };
    const doc = {
      documentElement: { tagName: 'HTML', id: '', className: '' },
      body: { tagName: 'BODY', id: '', className: '' },
      querySelectorAll: (selector) => {
        if (selector === '[data-gmixer-role]') return [card];
        return [];
      },
    };
    const win = {
      location: { href: 'https://example.test/post', hostname: 'example.test' },
      getComputedStyle: (el) => {
        if (el === doc.documentElement) {
          return paintStyle('rgb(17, 17, 17)', 'rgb(238, 238, 238)', vars);
        }
        if (el === doc.body) return paintStyle('rgb(17, 17, 17)', 'rgb(238, 238, 238)');
        if (el === card) return paintStyle('rgb(51, 51, 51)', 'rgb(238, 238, 238)');
        return paintStyle('transparent', 'rgb(238, 238, 238)');
      },
    };

    const snapshot = collectLiveSurfaces(doc, win);
    assert.equal(snapshot.hostname, 'example.test');
    assert.equal(snapshot.classifiedCount, 1);
    assert.equal(snapshot.palette.tokens.length, PALETTE_CSS_VARS.length);
    const primary = snapshot.palette.tokens.find((token) => token.id === 'background');
    assert.equal(primary.hex, '#111111');
    const gui = snapshot.palette.tokens.find((token) => token.id === 'surfaceGui');
    const containers = snapshot.palette.tokens.find((token) => token.id === 'surfaceContainers');
    assert.equal(gui.hex, containers.hex);
    assert.ok(
      snapshot.palette.collapses.some((note) => note.includes('Surface:Containers'))
    );
    assert.equal(snapshot.classified[0].role, 'card');
    assert.equal(snapshot.classified[0].fills[0].hex, '#333333');
    assert.equal(snapshot.classified[0].toneSteps['1'], 1);
    assert.ok(snapshot.texture.some((surface) => surface.id === 'gui.button'));
    assert.ok(snapshot.texture.some((surface) => surface.id === 'containers'));
  });
});
