import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { contrastRatio } from '../src/lib/color-theory.js';
import {
  blendWithPageSample,
  parseCssColor,
  samplePageRoles,
  selectRepresentativeCandidates,
} from '../src/content/page-sampler.js';

describe('page sampler color parsing', () => {
  it('parses modern space syntax, percentages, srgb, and alpha compositing', () => {
    assert.equal(parseCssColor('rgb(10 20 30 / 50%)', '#ffffff'), '#858a8f');
    assert.equal(parseCssColor('rgb(100% 0% 50%)'), '#ff0080');
    assert.equal(parseCssColor('color(srgb 1 0.5 0 / 25%)', '#000000'), '#402000');
    assert.equal(parseCssColor('#ff000080', '#ffffff'), '#ff7f7f');
    assert.equal(parseCssColor('hsl(120deg 100% 25%)'), '#008000');
    assert.equal(parseCssColor('rgb(0 0 0 / 0%)', '#ffffff'), null);
  });
});

describe('page sampler candidate selection', () => {
  it('takes a bounded spatial cross-section instead of the first DOM matches', () => {
    const previousWindow = globalThis.window;
    globalThis.window = { innerHeight: 600 };
    try {
      const candidates = Array.from({ length: 30 }, (_, index) => ({
        id: index,
        tagName: 'A',
        getAttribute: () => null,
        getBoundingClientRect: () => ({
          top: index * 180,
          bottom: index * 180 + 20,
          right: 100,
          width: 100,
          height: 20,
        }),
      }));
      const selected = selectRepresentativeCandidates(candidates, 6);
      assert.equal(selected.length, 6);
      assert.ok(selected.some(({ id }) => id >= 20));
      assert.notDeepEqual(
        selected.map(({ id }) => id),
        [0, 1, 2, 3, 4, 5]
      );
    } finally {
      globalThis.window = previousWindow;
    }
  });
});

describe('page sampler confidence and style reuse', () => {
  it('marks fallback-heavy samples weak and reads each root style once', () => {
    const previous = {
      document: globalThis.document,
      window: globalThis.window,
      getComputedStyle: globalThis.getComputedStyle,
    };
    const makeRoot = (tagName, backgroundColor, parentElement = null) => ({
      tagName,
      id: '',
      parentElement,
      getAttribute: () => null,
      getBoundingClientRect: () => ({
        top: 0,
        bottom: 600,
        right: 800,
        width: 800,
        height: 600,
      }),
    });
    const html = makeRoot('HTML', 'rgb(255 255 255)');
    const body = makeRoot('BODY', 'transparent', html);
    const styles = new Map([
      [html, { backgroundColor: 'rgb(255 255 255)', color: 'rgb(20 20 20)', fontSize: '16px' }],
      [body, { backgroundColor: 'transparent', color: 'rgb(20 20 20)', fontSize: '16px' }],
    ]);
    let styleReads = 0;
    globalThis.window = { innerWidth: 800, innerHeight: 600 };
    globalThis.document = {
      documentElement: html,
      body,
      querySelectorAll: () => [],
    };
    globalThis.getComputedStyle = (element) => {
      styleReads += 1;
      return styles.get(element);
    };

    try {
      const sample = samplePageRoles();
      assert.equal(sample.sampling.confidence, 'low');
      assert.equal(sample.sampling.weak, true);
      assert.equal(sample.sampling.provenance.muted, 'text-fallback');
      assert.equal(sample.sampling.provenance.focus, 'accent-fallback');
      assert.equal(styleReads, 2);
    } finally {
      globalThis.document = previous.document;
      globalThis.window = previous.window;
      globalThis.getComputedStyle = previous.getComputedStyle;
    }
  });
});

describe('page sampler post-blend contrast', () => {
  const theme = {
    background: '#151515',
    backgroundSecondary: '#202020',
    text: '#eeeeee',
    muted: '#bbbbbb',
    accent: '#8b5cf6',
    link: '#a78bfa',
    border: '#444444',
    focus: '#c4b5fd',
    isDark: true,
  };
  const page = {
    background: '#ffffff',
    backgroundSecondary: '#f4f4f4',
    text: '#dddddd',
    muted: '#cccccc',
    accent: '#eeeeee',
    link: '#dddddd',
    border: '#cccccc',
    focus: '#dddddd',
    structural: {
      background: '#ffffff',
      backgroundSecondary: '#f4f4f4',
      text: '#dddddd',
      muted: '#cccccc',
      border: '#cccccc',
      focus: '#dddddd',
    },
    identity: {
      accent: '#eeeeee',
      link: '#dddddd',
      masthead: '#eeeeee',
      nav: '#eeeeee',
    },
  };

  for (const mode of ['restyle', 'preserve', 'harmonize']) {
    it(`enforces readable foregrounds in ${mode} mode`, () => {
      const result = blendWithPageSample(theme, page, 35, mode);
      assert.ok(contrastRatio(result.text, result.background) >= 4.5);
      assert.ok(contrastRatio(result.muted, result.background) >= 4.5);
      assert.ok(contrastRatio(result.link, result.background) >= 4.5);
      assert.ok(contrastRatio(result.accent, result.background) >= 4.5);
      assert.ok(contrastRatio(result.focus, result.surfaceGui) >= 3);
    });
  }

  it('uses sampled muted and focus roles instead of dead fallback paths', () => {
    const result = blendWithPageSample(theme, {
      ...page,
      background: '#000000',
      backgroundSecondary: '#101010',
      text: '#ffffff',
      muted: '#70c0a0',
      focus: '#ffcc00',
      structural: {
        ...page.structural,
        background: '#000000',
        backgroundSecondary: '#101010',
        text: '#ffffff',
        muted: '#70c0a0',
        focus: '#ffcc00',
      },
    }, 0, 'restyle');
    assert.equal(result.muted, '#70c0a0');
    assert.equal(result.focus, '#ffcc00');
  });
});
