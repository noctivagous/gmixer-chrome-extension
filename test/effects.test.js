import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEffects } from '../src/config/effects-catalog.js';
import { buildCss } from '../src/content/style-injector.js';
import { createDefaultState } from '../src/state/schema.js';

describe('effects catalog', () => {
  it('clamps invalid category effects to none', () => {
    const normalized = normalizeEffects({
      categories: {
        images: { effect: 'not-a-real-effect' },
        videos: { effect: 'glow' },
        navigation: { effect: 'pan-scan' },
      },
      glow: { animated: false, color: '#ff00aa' },
    });
    assert.equal(normalized.categories.images.effect, 'none');
    assert.equal(normalized.categories.videos.effect, 'glow');
    assert.equal(normalized.categories.navigation.effect, 'none');
    assert.equal(normalized.glow.animated, false);
    assert.equal(normalized.glow.color, '#ff00aa');
  });
});

describe('effectsRules category paint', () => {
  function withEffects(patch) {
    const global = createDefaultState().global;
    global.sections.effects = true;
    global.effects = normalizeEffects({
      ...global.effects,
      ...patch,
      categories: {
        ...global.effects.categories,
        ...(patch.categories || {}),
      },
    });
    return global;
  }

  it('emits pan-scan keyframes for images', () => {
    const css = buildCss(
      withEffects({
        categories: { images: { effect: 'pan-scan' } },
      }),
      null
    );
    assert.match(css, /@keyframes gmixer-pan-scan/);
    assert.match(css, /img, picture img \{[\s\S]*animation: gmixer-pan-scan/);
  });

  it('emits navigation glow on nav/header selectors, not bare a', () => {
    const css = buildCss(
      withEffects({
        categories: { navigation: { effect: 'glow' } },
        glow: { animated: true, color: '' },
      }),
      null
    );
    assert.match(css, /nav a/);
    assert.match(css, /\[role="navigation"\] a/);
    assert.match(css, /button, \[role="button"\]/);
    assert.doesNotMatch(css, /(?:^|\n)\s*a, button, \[role="button"\]/);
  });

  it('omits effects CSS when the Effects section is off', () => {
    const global = withEffects({
      categories: { images: { effect: 'pan-scan' }, navigation: { effect: 'glow' } },
    });
    global.sections.effects = false;
    const css = buildCss(global, null);
    assert.doesNotMatch(css, /gmixer-pan-scan/);
    assert.doesNotMatch(css, /gmixer-glow-pulse/);
  });
});
