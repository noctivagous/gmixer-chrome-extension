import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  EARLY_CANVAS_STORAGE_KEY,
  EARLY_CANVAS_STYLE_ID,
  clearEarlyCanvas,
  collectEarlySheets,
  paintEarlyCanvas,
  readEarlyCanvas,
  sanitizeCanvasColor,
  sanitizeSheetSelector,
  stableSheetSelector,
  writeEarlyCanvas,
} from '../src/content/early-canvas.js';

const originals = {
  sessionStorage: globalThis.sessionStorage,
  localStorage: globalThis.localStorage,
  document: globalThis.document,
  getComputedStyle: globalThis.getComputedStyle,
  innerWidth: globalThis.innerWidth,
  innerHeight: globalThis.innerHeight,
};

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

afterEach(() => {
  Object.assign(globalThis, originals);
});

describe('early canvas persistence', () => {
  it('accepts hex and rgb canvas colors and rejects CSS injection', () => {
    assert.equal(sanitizeCanvasColor('#111316'), '#111316');
    assert.equal(sanitizeCanvasColor('rgb(17, 19, 22)'), 'rgb(17, 19, 22)');
    assert.equal(sanitizeCanvasColor('red; } html { color: lime'), null);
    assert.equal(sanitizeCanvasColor('url(javascript:alert(1))'), null);
  });

  it('round-trips canvas colors through session and local storage', () => {
    globalThis.sessionStorage = memoryStorage();
    globalThis.localStorage = memoryStorage();
    writeEarlyCanvas({
      bg: '#111316',
      text: '#c1c8d1',
      secondary: '#1a1e24',
      scheme: 'dark',
    });
    const stored = JSON.parse(globalThis.sessionStorage.getItem(EARLY_CANVAS_STORAGE_KEY));
    assert.equal(stored.bg, '#111316');
    assert.equal(globalThis.localStorage.getItem(EARLY_CANVAS_STORAGE_KEY), globalThis.sessionStorage.getItem(EARLY_CANVAS_STORAGE_KEY));
    assert.deepEqual(readEarlyCanvas(), {
      bg: '#111316',
      text: '#c1c8d1',
      secondary: '#1a1e24',
      scheme: 'dark',
      sheets: [],
    });
  });

  it('paints html/body synchronously from the remembered canvas', () => {
    globalThis.sessionStorage = memoryStorage();
    globalThis.localStorage = memoryStorage();
    writeEarlyCanvas({ bg: '#111316', text: '#c1c8d1', scheme: 'dark' });

    const props = {};
    const created = [];
    globalThis.document = {
      documentElement: {
        style: {
          setProperty(name, value) {
            props[name] = value;
          },
          appendChild(node) {
            created.push(node);
            return node;
          },
        },
        appendChild(node) {
          created.push(node);
          return node;
        },
      },
      getElementById() {
        return created.find((node) => node.id === EARLY_CANVAS_STYLE_ID) || null;
      },
      createElement() {
        return { id: '', textContent: '' };
      },
    };

    assert.equal(paintEarlyCanvas(), true);
    assert.equal(props['background-color'], '#111316');
    assert.equal(props['color-scheme'], 'dark');
    assert.equal(created.length, 1);
    assert.equal(created[0].id, EARLY_CANVAS_STYLE_ID);
    assert.match(created[0].textContent, /background-color: #111316/);
    assert.match(created[0].textContent, /color-scheme: dark/);
  });

  it('clears remembered canvas when theming is disabled', () => {
    globalThis.sessionStorage = memoryStorage();
    globalThis.localStorage = memoryStorage();
    writeEarlyCanvas({ bg: '#111316', scheme: 'dark' });
    writeEarlyCanvas({ enabled: false });
    assert.equal(readEarlyCanvas(), null);
    clearEarlyCanvas();
    assert.equal(globalThis.sessionStorage.getItem(EARLY_CANVAS_STORAGE_KEY), null);
  });

  it('accepts structural sheet selectors and rejects CSS injection', () => {
    assert.equal(sanitizeSheetSelector('body > section'), 'body > section');
    assert.equal(sanitizeSheetSelector('div.main-content'), 'div.main-content');
    assert.equal(sanitizeSheetSelector('[role="main"]'), '[role="main"]');
    assert.equal(sanitizeSheetSelector('div.main-content { color: red }'), null);
    assert.equal(sanitizeSheetSelector('body > section, img'), null);
  });

  it('builds stable selectors for landmarks and main-content classes', () => {
    const body = { tagName: 'BODY' };
    const section = { tagName: 'SECTION', id: '', parentElement: body, classList: [] };
    const main = {
      tagName: 'DIV',
      id: '',
      parentElement: section,
      classList: ['main-content', 'grid_2'],
    };
    globalThis.document = { documentElement: {}, body };
    assert.equal(stableSheetSelector(section), 'body > section');
    assert.equal(stableSheetSelector(main), 'div.main-content');
    const generated = {
      tagName: 'DIV',
      id: 'firehose-112729O59',
      parentElement: section,
      classList: ['ntv-preview-img-wrapper'],
    };
    assert.equal(stableSheetSelector(generated), null);
  });

  it('paints remembered sheets and structural mains with the early overlay', () => {
    globalThis.sessionStorage = memoryStorage();
    globalThis.localStorage = memoryStorage();
    writeEarlyCanvas({
      bg: '#111316',
      secondary: '#191c21',
      scheme: 'dark',
      sheets: [{ selector: 'div.main-content', color: 'rgb(69, 78, 91)' }],
    });
    const created = [];
    globalThis.document = {
      documentElement: {
        style: { setProperty() {} },
        appendChild(node) {
          created.push(node);
          return node;
        },
      },
      getElementById() {
        return created[0] || null;
      },
      createElement() {
        return { id: '', textContent: '' };
      },
    };
    paintEarlyCanvas();
    assert.match(created[0].textContent, /body > section/);
    assert.match(created[0].textContent, /div\.main-content/);
    assert.match(created[0].textContent, /rgb\(69, 78, 91\)/);
  });

  it('collects large classified sheets for the next document_start', () => {
    const body = { tagName: 'BODY' };
    const section = {
      tagName: 'SECTION',
      id: '',
      parentElement: body,
      classList: [],
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 }),
    };
    const main = {
      tagName: 'DIV',
      id: '',
      parentElement: section,
      classList: ['main-content'],
      getBoundingClientRect: () => ({ left: 0, top: 0, right: 640, bottom: 600, width: 640, height: 600 }),
    };
    globalThis.innerWidth = 800;
    globalThis.innerHeight = 600;
    globalThis.document = {
      documentElement: {},
      body,
      querySelectorAll() {
        return [section, main];
      },
    };
    globalThis.getComputedStyle = (el) => {
      if (el === section) {
        return { backgroundColor: 'rgb(69, 78, 91)', getPropertyValue: () => '' };
      }
      if (el === globalThis.document.documentElement) {
        return {
          backgroundColor: 'rgb(17, 19, 22)',
          getPropertyValue: (name) => (name === '--gmixer-bg-secondary' ? '#191c21' : ''),
        };
      }
      return { backgroundColor: 'rgba(0, 0, 0, 0)', getPropertyValue: () => '' };
    };
    const sheets = collectEarlySheets();
    assert.deepEqual(
      sheets.map((sheet) => sheet.selector),
      ['body > section', 'div.main-content']
    );
    assert.equal(sheets[0].color, 'rgb(69, 78, 91)');
    assert.equal(sheets[1].color, '#191c21');
  });
});
