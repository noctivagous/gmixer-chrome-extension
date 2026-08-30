import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CLASSIFIER_CONFIDENCE_THRESHOLD,
  classifyElement,
  classifySubtree,
  isOverlayPanel,
  promotePaintedSurfaces,
  seedPageSheets,
  stampOpaquePaintTargets,
  assignToneSteps,
  ROLE_ATTR,
  MEDIA_ATTR,
  NATIVE_L_ATTR,
  TONE_STEP_ATTR,
} from '../src/content/page-classifier.js';

function el(tag, attrs = {}, children = []) {
  const attributes = { ...attrs };
  const node = {
    tagName: tag.toUpperCase(),
    nodeType: 1,
    id: attributes.id || '',
    classList: {
      contains: (name) => String(attributes.class || '').split(/\s+/).includes(name),
    },
    closest(selector) {
      if (selector === '#gmixer-settings' && this.id === 'gmixer-settings') return this;
      return null;
    },
    getAttribute(name) {
      return attributes[name] ?? null;
    },
    setAttribute(name, value) {
      attributes[name] = value;
    },
    removeAttribute(name) {
      delete attributes[name];
    },
    hasAttribute(name) {
      return name in attributes;
    },
    querySelectorAll(selector) {
      const out = [];
      const visit = (n) => {
        if (!n || n.nodeType !== 1) return;
        // Extremely small matcher for the selectors we use in tests.
        if (selector.includes('article') && !selector.includes('img') && n.tagName === 'ARTICLE') {
          out.push(n);
        }
        if (selector.includes('main') && n.tagName === 'MAIN') out.push(n);
        if (selector.includes('img') && n.tagName === 'IMG' && (n._inArticle || false)) {
          out.push(n);
        }
        for (const child of n._children || []) visit(child);
      };
      for (const child of this._children || []) visit(child);
      // Also match self when root is the element.
      visit(this);
      return out;
    },
    _children: children,
  };
  for (const child of children) {
    if (tag.toUpperCase() === 'ARTICLE' && child.tagName === 'IMG') child._inArticle = true;
    child._parent = node;
  }
  return node;
}

describe('page-classifier', () => {
  it('uses a conservative confidence threshold for unknown elements', () => {
    const unknown = el('div');
    assert.equal(classifyElement(unknown), null);
    assert.equal(classifyElement(el('div', { id: 'gmixer-walkthrough-host' })), null);
    assert.equal(CLASSIFIER_CONFIDENCE_THRESHOLD, 0.7);
  });

  it('stamps a linked video poster as video-thumbnail from URL + link class', () => {
    const img = el('img', { class: 'image__dam-img' });
    const link = el(
      'a',
      {
        class: 'container__link container__link--type-vertical-video',
        href: 'https://www.cnn.com/2026/08/29/world/video/example-digvid',
      },
      [img]
    );
    img.parentElement = link;
    img.closest = (selector) => {
      if (selector.startsWith('a[href]') || selector === 'a[href]') return link;
      if (selector.includes('article')) return null;
      if (selector.includes('card') || selector.includes('li') || selector.includes('figure')) {
        return null;
      }
      return null;
    };
    link.getAttribute = (name) => {
      if (name === 'href') return 'https://www.cnn.com/2026/08/29/world/video/example-digvid';
      if (name === 'class') return 'container__link container__link--type-vertical-video';
      return null;
    };
    const classified = classifyElement(img);
    assert.equal(classified?.media, 'video-thumbnail');
    assert.ok(classified.reasons.some((r) => /video URL|video\/thumbnail/i.test(r)));
  });

  it('prefers video-thumbnail over article-image when video cues are present', () => {
    const img = el('img', { class: 'video-thumbnail__image' });
    const article = el('article', {}, [img]);
    img.parentElement = article;
    img.closest = (selector) => {
      if (selector.includes('article')) return article;
      if (selector.startsWith('a[href]')) return null;
      if (selector.includes('card') || selector.includes('thumb')) return null;
      return null;
    };
    const classified = classifyElement(img);
    assert.equal(classified?.media, 'video-thumbnail');
  });

  it('stamps semantic article/main roles and article-image media', () => {
    const img = el('img');
    const article = el('article', {}, [img]);
    img._inArticle = true;
    img.parentElement = article;
    img.closest = (selector) => {
      if (selector.includes('article')) return article;
      if (selector.startsWith('a[href]')) return null;
      return null;
    };
    const root = el('div', {}, [el('main'), article]);

    // Make querySelectorAll on root find descendants by walking.
    root.querySelectorAll = (selector) => {
      const all = [];
      const walk = (n) => {
        all.push(n);
        for (const c of n._children || []) walk(c);
      };
      for (const c of root._children || []) walk(c);
      if (selector === '*') return all;
      if (selector.startsWith('main')) return all.filter((n) => n.tagName === 'MAIN');
      if (selector.startsWith('article') && !selector.includes('img')) {
        return all.filter((n) => n.tagName === 'ARTICLE');
      }
      if (selector.includes('img')) {
        return all.filter((n) => n.tagName === 'IMG' && n._inArticle);
      }
      return [];
    };

    const result = classifySubtree(root);
    assert.ok(result.scanned >= 2);
    assert.equal(root._children[0].getAttribute(ROLE_ATTR), 'main');
    assert.equal(article.getAttribute(ROLE_ATTR), 'article');
    assert.equal(img.getAttribute(MEDIA_ATTR), 'article-image');

    const skipped = classifySubtree(root, { skipClassified: true });
    assert.ok(skipped.scanned >= 2);
  });

  it('classifies positioned overlay panels as surface instead of navigation', () => {
    const panel = el('div', { class: 'menu__panel' });
    panel.getBoundingClientRect = () => ({
      width: 480,
      height: 220,
      top: 80,
      left: 40,
      right: 520,
      bottom: 300,
    });
    const previousCs = globalThis.getComputedStyle;
    const previousWin = globalThis.window;
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };
    globalThis.getComputedStyle = () => ({
      position: 'absolute',
      backgroundColor: 'rgb(255, 255, 255)',
      backgroundImage: 'none',
    });
    try {
      const classified = classifyElement(panel);
      assert.equal(classified?.role, 'surface');
      assert.match(classified?.reasons.join(' ') || '', /overlay/);
    } finally {
      globalThis.getComputedStyle = previousCs;
      globalThis.window = previousWin;
    }
  });

  it('recognizes compact semantic and Windows Central-shaped flyout panels', () => {
    const semantic = el('div', { role: 'menu' });
    const windowsCentral = el('ul', { class: 'meganav-item-list left-0' });
    semantic.getBoundingClientRect = () => ({ width: 96, height: 36 });
    windowsCentral.getBoundingClientRect = () => ({ width: 260, height: 180 });
    const previousCs = globalThis.getComputedStyle;
    const previousWin = globalThis.window;
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };
    globalThis.getComputedStyle = (node) => ({
      position: 'absolute',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      zIndex: '10',
      transform: 'none',
      backgroundColor: node === semantic ? 'rgb(30, 30, 30)' : 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });
    try {
      assert.equal(isOverlayPanel(semantic), true);
      assert.equal(isOverlayPanel(windowsCentral), true);
      assert.equal(classifyElement(windowsCentral)?.role, 'surface');
    } finally {
      globalThis.getComputedStyle = previousCs;
      globalThis.window = previousWin;
    }
  });

  it('rejects pointer-events-none layers as overlay panels', () => {
    const badges = el('div', { class: 'video-thumbnail__thumb-badges' });
    badges.getBoundingClientRect = () => ({ width: 259, height: 146, left: 0, top: 0, right: 259, bottom: 146 });
    const previousCs = globalThis.getComputedStyle;
    const previousWin = globalThis.window;
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };
    globalThis.getComputedStyle = () => ({
      position: 'absolute',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      zIndex: 'auto',
      transform: 'none',
      pointerEvents: 'none',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });
    try {
      assert.equal(isOverlayPanel(badges), false);
      assert.equal(classifyElement(badges), null);
    } finally {
      globalThis.getComputedStyle = previousCs;
      globalThis.window = previousWin;
    }
  });

  it('rejects a full-size sibling of an image as overlay even when it is clickable', () => {
    const img = el('img', { class: 'video-thumbnail__image' });
    img.getBoundingClientRect = () => ({
      width: 259,
      height: 146,
      left: 10,
      top: 20,
      right: 269,
      bottom: 166,
    });
    const overlay = el('div', { class: 'video-thumbnail__thumb-badges' });
    overlay.getBoundingClientRect = () => ({
      width: 259,
      height: 146,
      left: 10,
      top: 20,
      right: 269,
      bottom: 166,
    });
    const frame = el('a', { class: 'thumb-link' }, [img, overlay]);
    img.parentElement = frame;
    overlay.parentElement = frame;
    frame.children = [img, overlay];
    const previousCs = globalThis.getComputedStyle;
    const previousWin = globalThis.window;
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };
    globalThis.getComputedStyle = () => ({
      position: 'absolute',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      zIndex: 'auto',
      transform: 'none',
      pointerEvents: 'auto',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });
    try {
      assert.equal(isOverlayPanel(overlay), false);
      assert.equal(classifyElement(overlay), null);
    } finally {
      globalThis.getComputedStyle = previousCs;
      globalThis.window = previousWin;
    }
  });

  it('rejects a positioned wrapper that contains a video as overlay', () => {
    const video = el('video');
    video.getBoundingClientRect = () => ({
      width: 800,
      height: 450,
      left: 0,
      top: 0,
      right: 800,
      bottom: 450,
    });
    const stage = el('div', { class: 'player-stage' }, [video]);
    stage.getBoundingClientRect = () => ({
      width: 800,
      height: 450,
      left: 0,
      top: 0,
      right: 800,
      bottom: 450,
    });
    video.parentElement = stage;
    const previousCs = globalThis.getComputedStyle;
    const previousWin = globalThis.window;
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };
    globalThis.getComputedStyle = () => ({
      position: 'absolute',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      zIndex: 'auto',
      transform: 'none',
      pointerEvents: 'auto',
      backgroundColor: 'rgb(0, 0, 0)',
      backgroundImage: 'none',
    });
    try {
      assert.equal(isOverlayPanel(stage), false);
    } finally {
      globalThis.getComputedStyle = previousCs;
      globalThis.window = previousWin;
    }
  });

  it('rejects a bottom control strip over a sibling video as overlay', () => {
    const video = el('video');
    video.getBoundingClientRect = () => ({
      width: 800,
      height: 450,
      left: 0,
      top: 0,
      right: 800,
      bottom: 450,
    });
    const controls = el('div', { class: 'player-controls' });
    controls.getBoundingClientRect = () => ({
      width: 800,
      height: 50,
      left: 0,
      top: 400,
      right: 800,
      bottom: 450,
    });
    const player = el('div', { class: 'player' }, [video, controls]);
    video.parentElement = player;
    controls.parentElement = player;
    player.children = [video, controls];
    const previousCs = globalThis.getComputedStyle;
    const previousWin = globalThis.window;
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };
    globalThis.getComputedStyle = () => ({
      position: 'absolute',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      zIndex: '10',
      transform: 'none',
      pointerEvents: 'auto',
      backgroundColor: 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });
    try {
      assert.equal(isOverlayPanel(controls), false);
    } finally {
      globalThis.getComputedStyle = previousCs;
      globalThis.window = previousWin;
    }
  });

  it('still classifies a semantic menu that happens to sit next to an image', () => {
    const img = el('img');
    img.getBoundingClientRect = () => ({ width: 200, height: 120, left: 0, top: 0, right: 200, bottom: 120 });
    const menu = el('div', { role: 'menu' });
    menu.getBoundingClientRect = () => ({ width: 200, height: 120, left: 0, top: 0, right: 200, bottom: 120 });
    const frame = el('div', {}, [img, menu]);
    img.parentElement = frame;
    menu.parentElement = frame;
    frame.children = [img, menu];
    const previousCs = globalThis.getComputedStyle;
    const previousWin = globalThis.window;
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };
    globalThis.getComputedStyle = () => ({
      position: 'absolute',
      display: 'block',
      visibility: 'visible',
      opacity: '1',
      zIndex: '20',
      transform: 'none',
      pointerEvents: 'auto',
      backgroundColor: 'rgb(30, 30, 30)',
      backgroundImage: 'none',
    });
    try {
      assert.equal(isOverlayPanel(menu), true);
    } finally {
      globalThis.getComputedStyle = previousCs;
      globalThis.window = previousWin;
    }
  });

  it('rejects hidden flyouts until they have visible layout', () => {
    const panel = el('ul', { class: 'menu-panel' });
    panel.getBoundingClientRect = () => ({ width: 260, height: 180 });
    const previousCs = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => ({
      position: 'absolute',
      display: 'none',
      visibility: 'visible',
      opacity: '1',
      zIndex: '10',
      transform: 'none',
    });
    try {
      assert.equal(isOverlayPanel(panel), false);
    } finally {
      globalThis.getComputedStyle = previousCs;
    }
  });

  it('classifies data-testid sidebarColumn as sidebar', () => {
    const col = el('div', { 'data-testid': 'sidebarColumn' });
    assert.equal(classifyElement(col)?.role, 'sidebar');
  });

  it('does not classify phrasing nodes as background-image media from computed style', () => {
    const previous = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => ({
      backgroundImage: 'url("https://example.test/icon.png")',
      backgroundColor: 'transparent',
    });
    try {
      assert.equal(classifyElement(el('span', { class: 'icon' })), null);
      const stage = classifyElement(el('div', { class: 'photo-stage' }));
      assert.equal(stage?.media, 'background-image');
    } finally {
      globalThis.getComputedStyle = previous;
    }
  });

  it('does not classify Slashdot-style story title/byline spans as articles', () => {
    const title = el('span', { class: 'story-title' });
    const byline = el('span', { class: 'story-byline' });
    assert.equal(classifyElement(title), null);
    assert.equal(classifyElement(byline), null);

    // Real story containers still match.
    const story = el('div', { class: 'story' });
    const classified = classifyElement(story);
    assert.equal(classified?.role, 'article');
  });

  it('does not classify TNW-style heading titles as articles from camelCase class names', () => {
    const showcase = el('h3', { class: 'showcaseSubbrandsArticleTitle' });
    const sectionHeading = el('h2', { class: 'c-bodyNews__heading' });
    assert.equal(classifyElement(showcase), null);
    assert.equal(classifyElement(sectionHeading), null);

    // A real article-named container still matches via camelCase token split.
    const wrap = el('div', { class: 'showcaseSubbrandsArticle' });
    assert.equal(classifyElement(wrap)?.role, 'article');
  });

  it('promotes opaque nested slabs under classified hosts to surface', () => {
    const attrs = (initial = {}) => {
      const a = { ...initial };
      return {
        getAttribute: (name) => a[name] ?? null,
        setAttribute: (name, value) => {
          a[name] = String(value);
        },
        removeAttribute: (name) => {
          delete a[name];
        },
        hasAttribute: (name) => name in a,
      };
    };

    const details = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...attrs({ class: 'details' }),
      getBoundingClientRect: () => ({ width: 400, height: 32 }),
      _bg: 'rgb(242, 242, 242)',
    };
    const body = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...attrs({ class: 'body' }),
      getBoundingClientRect: () => ({ width: 400, height: 120 }),
      _bg: 'rgb(247, 247, 247)',
    };
    const article = {
      tagName: 'ARTICLE',
      nodeType: 1,
      children: [details, body],
      ...attrs({ [ROLE_ATTR]: 'article' }),
      getBoundingClientRect: () => ({ width: 400, height: 200 }),
      _bg: 'rgb(230, 230, 230)',
    };
    details.parentElement = article;
    body.parentElement = article;

    const root = {
      nodeType: 11,
      querySelectorAll: (selector) => {
        if (selector === `[${ROLE_ATTR}]`) return [article];
        return [];
      },
    };

    const previous = globalThis.getComputedStyle;
    globalThis.getComputedStyle = (node) => ({
      backgroundColor: node._bg || 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });

    try {
      const promoted = promotePaintedSurfaces(root);
      assert.equal(promoted, 2);
      assert.equal(details.getAttribute(ROLE_ATTR), 'surface');
      assert.equal(body.getAttribute(ROLE_ATTR), 'surface');

      // Darker native L → lower tone step; lighter → higher.
      details.setAttribute(NATIVE_L_ATTR, '0.90');
      body.setAttribute(NATIVE_L_ATTR, '0.99');
      article.setAttribute(NATIVE_L_ATTR, '0.80');
      const rankedRoot = {
        querySelectorAll: (selector) => {
          if (selector === `[${ROLE_ATTR}]`) return [article, details, body];
          return [];
        },
      };
      assert.equal(assignToneSteps(rankedRoot, 3), 3);
      assert.equal(article.getAttribute(TONE_STEP_ATTR), '0');
      assert.equal(details.getAttribute(TONE_STEP_ATTR), '1');
      assert.equal(body.getAttribute(TONE_STEP_ATTR), '2');
    } finally {
      globalThis.getComputedStyle = previous;
    }
  });

  it('keeps equal native luminance surfaces on the same tone step', () => {
    const first = el('div', { [ROLE_ATTR]: 'surface', [NATIVE_L_ATTR]: '0.75' });
    const second = el('div', { [ROLE_ATTR]: 'card', [NATIVE_L_ATTR]: '0.75' });
    const root = {
      querySelectorAll: (selector) => (selector === `[${ROLE_ATTR}]` ? [first, second] : []),
    };
    assert.equal(assignToneSteps(root, 3), 2);
    assert.equal(first.getAttribute(TONE_STEP_ATTR), second.getAttribute(TONE_STEP_ATTR));
  });

  it('does not promote opaque menu wrappers inside header chrome', () => {
    const attrs = (initial = {}) => {
      const a = { ...initial };
      return {
        getAttribute: (name) => a[name] ?? null,
        setAttribute: (name, value) => {
          a[name] = String(value);
        },
        removeAttribute: (name) => {
          delete a[name];
        },
        hasAttribute: (name) => name in a,
      };
    };

    const item = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...attrs({ class: 'menu-item' }),
      getBoundingClientRect: () => ({ width: 96, height: 40 }),
      _bg: 'rgb(20, 20, 20)',
    };
    const header = {
      tagName: 'HEADER',
      nodeType: 1,
      children: [item],
      ...attrs({ [ROLE_ATTR]: 'header' }),
      getBoundingClientRect: () => ({ width: 1200, height: 64 }),
      _bg: 'rgb(20, 20, 20)',
    };
    item.parentElement = header;

    const root = {
      nodeType: 11,
      querySelectorAll: (selector) => {
        if (selector === `[${ROLE_ATTR}]`) return [header];
        return [];
      },
    };

    const previous = globalThis.getComputedStyle;
    globalThis.getComputedStyle = (node) => ({
      backgroundColor: node._bg || 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });

    try {
      assert.equal(promotePaintedSurfaces(root), 0);
      assert.equal(item.getAttribute(ROLE_ATTR), null);
    } finally {
      globalThis.getComputedStyle = previous;
    }
  });

  function mockAttrs(initial = {}) {
    const a = { ...initial };
    return {
      getAttribute: (name) => a[name] ?? null,
      setAttribute: (name, value) => {
        a[name] = String(value);
      },
      removeAttribute: (name) => {
        delete a[name];
      },
      hasAttribute: (name) => name in a,
    };
  }

  it('seeds large opaque canvases through transparent layout wrappers', () => {
    const sheet = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...mockAttrs({ class: 'bg-white' }),
      getBoundingClientRect: () => ({
        width: 1200,
        height: 800,
        top: 0,
        left: 0,
        right: 1200,
        bottom: 800,
      }),
      _bg: 'rgb(255, 255, 255)',
    };
    const wrap = {
      tagName: 'DIV',
      nodeType: 1,
      children: [sheet],
      ...mockAttrs({ class: 'pagecont' }),
      getBoundingClientRect: () => ({
        width: 1200,
        height: 800,
        top: 0,
        left: 0,
        right: 1200,
        bottom: 800,
      }),
      _bg: 'rgba(0, 0, 0, 0)',
    };
    const column = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...mockAttrs({ id: 'countercol' }),
      getBoundingClientRect: () => ({
        width: 177,
        height: 500,
        top: 80,
        left: 900,
        right: 1077,
        bottom: 580,
      }),
      _bg: 'rgb(255, 255, 255)',
    };
    const body = {
      tagName: 'BODY',
      nodeType: 1,
      children: [wrap, column],
      ...mockAttrs({}),
      getBoundingClientRect: () => ({ width: 1200, height: 800 }),
      _bg: 'rgb(26, 15, 15)',
    };
    sheet.parentElement = wrap;
    wrap.parentElement = body;
    column.parentElement = body;

    const previousDoc = globalThis.document;
    const previousWin = globalThis.window;
    const previousCs = globalThis.getComputedStyle;
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };
    globalThis.document = { body, documentElement: body };
    globalThis.getComputedStyle = (node) => ({
      backgroundColor: node._bg || 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });

    try {
      const stamped = seedPageSheets(body);
      assert.equal(stamped, 2);
      assert.equal(sheet.getAttribute(ROLE_ATTR), 'surface');
      assert.equal(column.getAttribute(ROLE_ATTR), 'surface');
      assert.equal(wrap.getAttribute(ROLE_ATTR), null);

      // MutationObserver subtree pass receives the added canvas itself.
      const hydrated = {
        tagName: 'DIV',
        nodeType: 1,
        children: [],
        ...mockAttrs({ class: 'relative z-10 bg-white' }),
        getBoundingClientRect: () => ({
          width: 1200,
          height: 800,
          top: 0,
          left: 0,
          right: 1200,
          bottom: 800,
        }),
        _bg: 'rgb(255, 255, 255)',
      };
      assert.equal(seedPageSheets(hydrated), 1);
      assert.equal(hydrated.getAttribute(ROLE_ATTR), 'surface');
    } finally {
      globalThis.document = previousDoc;
      globalThis.window = previousWin;
      globalThis.getComputedStyle = previousCs;
    }
  });

  it('stamps native luminance from CSS gradient fills on transparent headers', () => {
    const header = {
      tagName: 'HEADER',
      nodeType: 1,
      children: [],
      ...mockAttrs({ class: 'Header_header' }),
      getBoundingClientRect: () => ({ width: 1200, height: 60 }),
      _bg: 'rgba(0, 0, 0, 0)',
      _bgImage: 'linear-gradient(208deg, rgb(0, 102, 203) 41.12%, rgb(0, 65, 129) 131.51%)',
    };
    const root = {
      nodeType: 11,
      querySelectorAll: (selector) => {
        if (String(selector).includes('header') || String(selector).includes('HEADER')) {
          return [header];
        }
        return [header];
      },
    };
    const previousCs = globalThis.getComputedStyle;
    globalThis.getComputedStyle = (node) => ({
      backgroundColor: node._bg || 'rgba(0, 0, 0, 0)',
      backgroundImage: node._bgImage || 'none',
    });
    try {
      assert.equal(stampOpaquePaintTargets(root), 1);
      assert.ok(header.hasAttribute(NATIVE_L_ATTR));
      assert.notEqual(header.getAttribute(NATIVE_L_ATTR), '0.0000');
    } finally {
      globalThis.getComputedStyle = previousCs;
    }
  });

  it('stamps native luminance from oklch() gradient stops (Tailwind v4 / HF)', () => {
    const surface = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...mockAttrs({ [ROLE_ATTR]: 'surface' }),
      getBoundingClientRect: () => ({ width: 800, height: 54 }),
      _bg: 'rgba(0, 0, 0, 0)',
      _bgImage:
        'linear-gradient(oklch(0.987 0.022 95.277) 0%, oklch(0.962 0.059 95.617) 100%)',
    };
    const root = {
      nodeType: 11,
      querySelectorAll: () => [surface],
    };
    const previousCs = globalThis.getComputedStyle;
    globalThis.getComputedStyle = (node) => ({
      backgroundColor: node._bg || 'rgba(0, 0, 0, 0)',
      backgroundImage: node._bgImage || 'none',
    });
    try {
      assert.equal(stampOpaquePaintTargets(root), 1);
      assert.ok(surface.hasAttribute(NATIVE_L_ATTR));
      const lum = Number(surface.getAttribute(NATIVE_L_ATTR));
      assert.ok(lum > 0.9, `expected near-white oklch L, got ${lum}`);
    } finally {
      globalThis.getComputedStyle = previousCs;
    }
  });

  it('does not treat a barely visible alpha tint as an opaque surface', () => {
    const panel = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...mockAttrs({ [ROLE_ATTR]: 'surface' }),
      closest: () => null,
    };
    const root = { querySelectorAll: () => [panel] };
    const previousCs = globalThis.getComputedStyle;
    globalThis.getComputedStyle = () => ({
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      backgroundImage: 'none',
    });
    try {
      assert.equal(stampOpaquePaintTargets(root), 0);
      assert.equal(panel.hasAttribute(NATIVE_L_ATTR), false);
    } finally {
      globalThis.getComputedStyle = previousCs;
    }
  });

  it('seeds large opaque sheets that embed small thumbnails (not media chrome)', () => {
    // Techmeme #qiobv / #podcasts: sidebar slabs with nested imgs must seed.
    // coversOrStripsMedia used to reject any box that merely contains media.
    const thumb = {
      tagName: 'IMG',
      nodeType: 1,
      children: [],
      ...mockAttrs({ class: 'ill' }),
      getBoundingClientRect: () => ({
        width: 135,
        height: 43,
        top: 200,
        left: 20,
        right: 155,
        bottom: 243,
      }),
    };
    const sponsor = {
      tagName: 'DIV',
      nodeType: 1,
      children: [thumb],
      ...mockAttrs({ id: 'qiobv' }),
      getBoundingClientRect: () => ({
        width: 365,
        height: 764,
        top: 80,
        left: 0,
        right: 365,
        bottom: 844,
      }),
      querySelector: (selector) => {
        if (String(selector).includes('img')) return thumb;
        return null;
      },
      _bg: 'rgb(244, 244, 244)',
    };
    thumb.parentElement = sponsor;

    const podArt = {
      tagName: 'IMG',
      nodeType: 1,
      children: [],
      ...mockAttrs({ class: 'podill' }),
      getBoundingClientRect: () => ({
        width: 115,
        height: 117,
        top: 900,
        left: 20,
        right: 135,
        bottom: 1017,
      }),
    };
    const podcasts = {
      tagName: 'DIV',
      nodeType: 1,
      children: [podArt],
      ...mockAttrs({ id: 'podcasts' }),
      getBoundingClientRect: () => ({
        width: 365,
        height: 900,
        top: 860,
        left: 0,
        right: 365,
        bottom: 1760,
      }),
      querySelector: (selector) => {
        if (String(selector).includes('img')) return podArt;
        return null;
      },
      _bg: 'rgb(240, 246, 253)',
    };
    podArt.parentElement = podcasts;

    // Near-full-size video stage must still be rejected as media chrome.
    const video = {
      tagName: 'VIDEO',
      nodeType: 1,
      children: [],
      ...mockAttrs({}),
      getBoundingClientRect: () => ({
        width: 800,
        height: 450,
        top: 0,
        left: 0,
        right: 800,
        bottom: 450,
      }),
    };
    const stage = {
      tagName: 'DIV',
      nodeType: 1,
      children: [video],
      ...mockAttrs({ class: 'player-stage' }),
      getBoundingClientRect: () => ({
        width: 800,
        height: 450,
        top: 0,
        left: 0,
        right: 800,
        bottom: 450,
      }),
      querySelector: (selector) => {
        if (String(selector).includes('video')) return video;
        return null;
      },
      _bg: 'rgb(0, 0, 0)',
    };
    video.parentElement = stage;

    const body = {
      tagName: 'BODY',
      nodeType: 1,
      children: [sponsor, podcasts, stage],
      ...mockAttrs({}),
      getBoundingClientRect: () => ({ width: 1200, height: 1800 }),
      querySelectorAll: (selector) => {
        if (String(selector).includes('section') || String(selector).includes('main')) return [];
        if (String(selector).includes('div')) return [sponsor, podcasts, stage];
        return [];
      },
      _bg: 'rgb(26, 15, 15)',
    };
    sponsor.parentElement = body;
    podcasts.parentElement = body;
    stage.parentElement = body;

    const previousDoc = globalThis.document;
    const previousWin = globalThis.window;
    const previousCs = globalThis.getComputedStyle;
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };
    globalThis.document = { body, documentElement: body };
    globalThis.getComputedStyle = (node) => ({
      backgroundColor: node._bg || 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });

    try {
      const stamped = seedPageSheets(body);
      assert.equal(stamped, 2);
      assert.equal(sponsor.getAttribute(ROLE_ATTR), 'surface');
      assert.equal(podcasts.getAttribute(ROLE_ATTR), 'surface');
      assert.equal(stage.getAttribute(ROLE_ATTR), null);
    } finally {
      globalThis.document = previousDoc;
      globalThis.window = previousWin;
      globalThis.getComputedStyle = previousCs;
    }
  });

  it('seeds mid-width opaque cards and composers as page sheets', () => {
    const card = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...mockAttrs({ class: 'widget' }),
      getBoundingClientRect: () => ({
        width: 350,
        height: 300,
        top: 80,
        left: 1200,
        right: 1550,
        bottom: 380,
      }),
      _bg: 'rgb(255, 255, 255)',
    };
    const composer = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...mockAttrs({ class: 'composer' }),
      getBoundingClientRect: () => ({
        width: 518,
        height: 56,
        top: 118,
        left: 660,
        right: 1178,
        bottom: 174,
      }),
      _bg: 'rgb(255, 255, 255)',
    };
    const previousDoc = globalThis.document;
    const previousWin = globalThis.window;
    const previousCs = globalThis.getComputedStyle;
    globalThis.window = { innerWidth: 1905, innerHeight: 940 };
    globalThis.document = {
      body: { tagName: 'BODY', nodeType: 1, children: [] },
      documentElement: { tagName: 'HTML', nodeType: 1 },
    };
    globalThis.getComputedStyle = (node) => ({
      backgroundColor: node._bg || 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });
    try {
      assert.equal(seedPageSheets(card), 1);
      assert.equal(card.getAttribute(ROLE_ATTR), 'surface');
      assert.equal(seedPageSheets(composer), 1);
      assert.equal(composer.getAttribute(ROLE_ATTR), 'surface');
    } finally {
      globalThis.document = previousDoc;
      globalThis.window = previousWin;
      globalThis.getComputedStyle = previousCs;
    }
  });

  it('seeds sizable opaque boxes that sit after a long feed in tree order', () => {
    const late = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...mockAttrs({ id: 'sidebar-slab' }),
      getBoundingClientRect: () => ({
        width: 365,
        height: 764,
        top: 80,
        left: 800,
        right: 1165,
        bottom: 844,
      }),
      _bg: 'rgb(244, 244, 244)',
    };
    const body = {
      tagName: 'BODY',
      nodeType: 1,
      children: [],
      ...mockAttrs({}),
      querySelectorAll: (selector) =>
        String(selector).includes('div') ? [late] : [],
      getBoundingClientRect: () => ({ width: 1200, height: 800 }),
      _bg: 'rgb(26, 15, 15)',
    };
    const previousDoc = globalThis.document;
    const previousWin = globalThis.window;
    const previousCs = globalThis.getComputedStyle;
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };
    globalThis.document = { body, documentElement: body };
    globalThis.getComputedStyle = (node) => ({
      backgroundColor: node._bg || 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });
    try {
      assert.equal(seedPageSheets(body), 1);
      assert.equal(late.getAttribute(ROLE_ATTR), 'surface');
    } finally {
      globalThis.document = previousDoc;
      globalThis.window = previousWin;
      globalThis.getComputedStyle = previousCs;
    }
  });

  it('seeds wide short list rows as page sheets', () => {
    const row = {
      tagName: 'TR',
      nodeType: 1,
      children: [],
      ...mockAttrs({ class: 'zA yO' }),
      getBoundingClientRect: () => ({
        width: 900,
        height: 40,
        top: 200,
        left: 0,
        right: 900,
        bottom: 240,
      }),
      _bg: 'rgb(242, 246, 252)',
    };
    const previousDoc = globalThis.document;
    const previousWin = globalThis.window;
    const previousCs = globalThis.getComputedStyle;
    globalThis.window = { innerWidth: 1000, innerHeight: 800 };
    globalThis.document = {
      body: { tagName: 'BODY', nodeType: 1, children: [] },
      documentElement: { tagName: 'HTML', nodeType: 1 },
    };
    globalThis.getComputedStyle = (node) => ({
      backgroundColor: node._bg || 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });
    try {
      assert.equal(seedPageSheets(row), 1);
      assert.equal(row.getAttribute(ROLE_ATTR), 'surface');
    } finally {
      globalThis.document = previousDoc;
      globalThis.window = previousWin;
      globalThis.getComputedStyle = previousCs;
    }
  });

  it('does not promote opaque strips inside classified navigation under a surface host', () => {
    const strip = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...mockAttrs({ class: 'bg-[#FAFAFA]' }),
      getBoundingClientRect: () => ({ width: 957, height: 48 }),
      _bg: 'rgb(250, 250, 250)',
    };
    const nav = {
      tagName: 'NAV',
      nodeType: 1,
      children: [strip],
      ...mockAttrs({ [ROLE_ATTR]: 'navigation' }),
      getBoundingClientRect: () => ({ width: 1200, height: 48 }),
      _bg: 'rgb(58, 35, 35)',
    };
    const surface = {
      tagName: 'DIV',
      nodeType: 1,
      children: [nav],
      ...mockAttrs({ [ROLE_ATTR]: 'surface' }),
      getBoundingClientRect: () => ({ width: 1200, height: 800 }),
      _bg: 'rgb(255, 255, 255)',
    };
    strip.parentElement = nav;
    nav.parentElement = surface;

    const root = {
      nodeType: 11,
      querySelectorAll: (selector) => {
        if (selector === `[${ROLE_ATTR}]`) return [surface, nav];
        return [];
      },
    };

    const previous = globalThis.getComputedStyle;
    globalThis.getComputedStyle = (node) => ({
      backgroundColor: node._bg || 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });

    try {
      assert.equal(promotePaintedSurfaces(root), 0);
      assert.equal(strip.getAttribute(ROLE_ATTR), null);
    } finally {
      globalThis.getComputedStyle = previous;
    }
  });

  it('promotes deep opaque list rows under a large page-sheet surface', () => {
    const row = {
      tagName: 'TR',
      nodeType: 1,
      children: [],
      ...mockAttrs({ class: 'zA' }),
      getBoundingClientRect: () => ({ width: 800, height: 40 }),
      _bg: 'rgb(242, 246, 252)',
    };
    let inner = row;
    for (let i = 0; i < 10; i += 1) {
      const wrap = {
        tagName: 'DIV',
        nodeType: 1,
        children: [inner],
        ...mockAttrs({ class: `nH-${i}` }),
        getBoundingClientRect: () => ({ width: 800, height: 600 }),
        _bg: 'rgba(0, 0, 0, 0)',
      };
      inner.parentElement = wrap;
      inner = wrap;
    }
    const surface = {
      tagName: 'DIV',
      nodeType: 1,
      children: [inner],
      ...mockAttrs({ [ROLE_ATTR]: 'surface' }),
      getBoundingClientRect: () => ({ width: 1000, height: 800 }),
      _bg: 'rgb(255, 255, 255)',
    };
    inner.parentElement = surface;

    const root = {
      nodeType: 11,
      querySelectorAll: (selector) => {
        if (selector === `[${ROLE_ATTR}]`) return [surface];
        return [];
      },
    };

    const previousCs = globalThis.getComputedStyle;
    const previousWin = globalThis.window;
    globalThis.window = { innerWidth: 1000, innerHeight: 800 };
    globalThis.getComputedStyle = (node) => ({
      backgroundColor: node._bg || 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });

    try {
      const promoted = promotePaintedSurfaces(root);
      assert.equal(promoted, 1);
      assert.equal(row.getAttribute(ROLE_ATTR), 'surface');
    } finally {
      globalThis.getComputedStyle = previousCs;
      globalThis.window = previousWin;
    }
  });

  it('stamps large opaque slabs inside open shadow trees', () => {
    const inner = {
      tagName: 'DIV',
      nodeType: 1,
      children: [],
      ...mockAttrs({ class: 'slot-inner' }),
      getBoundingClientRect: () => ({
        width: 1200,
        height: 56,
        top: 0,
        left: 0,
        right: 1200,
        bottom: 56,
      }),
      _bg: 'rgb(255, 255, 255)',
      closest: () => null,
      querySelectorAll: () => [],
    };
    const shadow = {
      nodeType: 11,
      host: {},
      children: [inner],
      querySelectorAll: (selector) => {
        if (selector === '*') return [inner];
        if (selector === `[${ROLE_ATTR}]`) {
          return inner.hasAttribute(ROLE_ATTR) ? [inner] : [];
        }
        return [];
      },
    };
    inner.parentNode = shadow;
    const host = {
      tagName: 'X-SLOT',
      nodeType: 1,
      shadowRoot: shadow,
      children: [],
      ...mockAttrs({}),
      closest: () => null,
      querySelectorAll: () => [],
    };
    shadow.host = host;

    const previousCs = globalThis.getComputedStyle;
    const previousWin = globalThis.window;
    const previousDoc = globalThis.document;
    globalThis.window = { innerWidth: 1200, innerHeight: 800 };
    globalThis.document = { body: host, documentElement: host };
    globalThis.getComputedStyle = (node) => ({
      backgroundColor: node._bg || 'rgba(0, 0, 0, 0)',
      backgroundImage: 'none',
    });

    try {
      const result = classifySubtree(host);
      assert.equal(inner.getAttribute(ROLE_ATTR), 'surface');
      assert.ok(result.surfaces >= 1);
    } finally {
      globalThis.getComputedStyle = previousCs;
      globalThis.window = previousWin;
      globalThis.document = previousDoc;
    }
  });
});
