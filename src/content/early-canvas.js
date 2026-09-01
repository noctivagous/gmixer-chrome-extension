// Synchronous canvas boot for document_start.
//
// chrome.storage.session is async, so the existing CSS cache cannot paint
// before the first frame. After the first themed load we remember this
// origin's canvas colors in the page's sessionStorage/localStorage (sync)
// and re-apply them as the first statement of a tiny document_start script.
// That closes the white flash on same-origin navigations.

import { toneCanvas } from '../lib/tone-canvas.js';

export const EARLY_CANVAS_STYLE_ID = 'gmixer-early-canvas';
export const EARLY_CANVAS_STORAGE_KEY = 'gmixer.earlyCanvas.v1';
export const PROVISIONAL_STYLE_ID = 'gmixer-provisional-canvas';
export const GLOBAL_TONE_STORAGE_KEY = 'gmixer_tone_canvas';

/**
 * First-load guesses that mirror the static theme's semantic targets, without
 * `[data-gmixer-native-l]` (classification has not run). Not `div` — too many
 * layout wrappers. Landmarks and cards are the usual opaque sheets.
 */
const PROVISIONAL_SECONDARY_SHEETS = [
  'body > section',
  'body > main',
  'body > header',
  'body > footer',
  'body > nav',
  'body > aside',
  'main',
  'header',
  'footer',
  'nav',
  'aside',
  '#main',
  '[role="main"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="navigation"]',
  '[role="complementary"]',
].join(', ');

const PROVISIONAL_SURFACE_SHEETS = [
  'article',
  'section',
  '.card',
  '[role="article"]',
  'dialog',
  '[role="dialog"]',
  '[role="menu"]',
].join(', ');
const MAX_EARLY_SHEETS = 10;

/**
 * Structural sheets the static theme already knows about, but only paints
 * after classification stamps `[data-gmixer-native-l]`. Repeat visits can
 * paint them immediately so a native-white landmark does not sit behind
 * already-themed article text.
 */
const EARLY_STRUCTURAL_SHEETS =
  'body > section, body > main, body #main, [role="main"]';

const SAFE_COLOR =
  /^(#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})|rgba?\(\s*[\d.]+\s*(?:,\s*[\d.]+\s*){2,3}(?:,\s*[\d.]+\s*)?\)|hsla?\(\s*[\d.]+(?:deg)?\s*(?:,\s*[\d.]+%?\s*){2,3}(?:,\s*[\d.]+\s*)?\)|oklch\(\s*[^)]+\))$/i;

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function sanitizeCanvasColor(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return null;
  return SAFE_COLOR.test(trimmed) ? trimmed : null;
}

/**
 * @param {unknown} value
 * @returns {'dark'|'light'|null}
 */
export function sanitizeColorScheme(value) {
  return value === 'dark' || value === 'light' ? value : null;
}

/**
 * @param {unknown} raw
 * @returns {import('../lib/tone-canvas.js').ToneCanvas|null}
 */
export function sanitizeToneCanvas(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const data = /** @type {Record<string, unknown>} */ (raw);
  const bg = sanitizeCanvasColor(data.bg);
  if (!bg) return null;
  const fallback = toneCanvas(typeof data.tone === 'string' ? data.tone : 'dark');
  return {
    tone: typeof data.tone === 'string' ? data.tone : fallback.tone,
    intensity:
      typeof data.intensity === 'number' && Number.isFinite(data.intensity)
        ? Math.max(0, Math.min(1, data.intensity))
        : null,
    bg,
    secondary: sanitizeCanvasColor(data.secondary) || fallback.secondary,
    surface: sanitizeCanvasColor(data.surface) || fallback.surface,
    text: sanitizeCanvasColor(data.text) || fallback.text,
    scheme: sanitizeColorScheme(data.scheme) || fallback.scheme,
  };
}

const SAFE_IDENT = /^[A-Za-z][\w-]{0,40}$/;
const SHEET_CLASS_HINT = /(^|-)(content|main|wrap|container|page|header|heading|title|banner|feed|list|bar|row)$/i;
const SAFE_SHEET_SELECTOR =
  /^(?:body\s*>\s*[a-z][a-z0-9-]*|[a-z][a-z0-9-]*(?:\.[A-Za-z][\w-]{0,40})?|#[A-Za-z][\w-]{0,40}|\[role="(?:main|banner|contentinfo|navigation|complementary)"\])$/;

/**
 * @param {unknown} value
 * @returns {string|null}
 */
export function sanitizeSheetSelector(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return null;
  return SAFE_SHEET_SELECTOR.test(trimmed) ? trimmed : null;
}

/**
 * Stable, injectable selector for a large page sheet. Prefer id, then
 * `body > landmark`, then a content-ish class. Never emit arbitrary
 * attribute or descendant selectors from the page.
 *
 * @param {Element} el
 * @returns {string|null}
 */
function classCount(name) {
  try {
    return document.getElementsByClassName(name).length;
  } catch {
    return 0;
  }
}

function preferredSheetClass(el) {
  const classes = (el.classList ? [...el.classList] : String(el.className || '').split(/\s+/)).filter(
    (name) => SAFE_IDENT.test(name) && !/\d{3,}/.test(name)
  );
  const hinted = classes.find((name) => SHEET_CLASS_HINT.test(name));
  if (hinted) return hinted;
  // Repeating component class (stable name plus a one-off/hashed sibling).
  return (
    classes.find(
      (name) =>
        name.length >= 4 &&
        !/(img|image|ad|ads|preview|thumb|wrapper|sponsor)/i.test(name) &&
        classCount(name) >= 2
    ) || null
  );
}

function hasNativeL(el) {
  return typeof el.hasAttribute === 'function'
    ? el.hasAttribute('data-gmixer-native-l')
    : el.getAttribute?.('data-gmixer-native-l') != null;
}

export function stableSheetSelector(el) {
  if (!el || el === document.documentElement || el === document.body) return null;
  if (typeof el.id === 'string' && SAFE_IDENT.test(el.id) && !/\d{3,}/.test(el.id)) {
    return `#${el.id}`;
  }
  const tag = String(el.tagName || '').toLowerCase();
  if (!SAFE_IDENT.test(tag)) return null;
  if (el.parentElement === document.body && /^(section|main|header|footer|aside|nav|article)$/.test(tag)) {
    return `body > ${tag}`;
  }
  const sheetClass = preferredSheetClass(el);
  if (sheetClass) return `${tag}.${sheetClass}`;
  return null;
}

function isOpaqueCssColor(value) {
  const color = sanitizeCanvasColor(value);
  if (!color) return false;
  if (/^rgba?\(/i.test(color)) {
    const nums = color.match(/[\d.]+/g) || [];
    if (nums.length >= 4 && Number.parseFloat(nums[3]) < 0.4) return false;
    if (nums.length >= 3 && nums.slice(0, 3).every((n) => Number.parseFloat(n) === 0) && nums.length < 4) {
      /* rgb(0,0,0) is opaque */
    }
  }
  return true;
}

function coversLargeSheet(el) {
  if (typeof el.getBoundingClientRect !== 'function') return true;
  const rect = el.getBoundingClientRect();
  const vw = globalThis.innerWidth || 0;
  const vh = globalThis.innerHeight || 0;
  // Full-width chrome bars (section titles, feed headers) are short but opaque.
  if (
    hasNativeL(el) &&
    vw > 0 &&
    rect.width >= vw * 0.4 &&
    rect.height >= 22 &&
    rect.height <= 140
  ) {
    return true;
  }
  if (rect.width < 160 || rect.height < 80) return false;
  if (vw > 0 && vh > 0) {
    const cover = Math.max(0, Math.min(rect.right, vw) - Math.max(rect.left, 0)) *
      Math.max(0, Math.min(rect.bottom, vh) - Math.max(rect.top, 0));
    if (cover >= vw * vh * 0.18) return true;
  }
  return rect.width * rect.height >= 40000;
}

/**
 * Large classified sheets to paint on the next document_start, before
 * `[data-gmixer-native-l]` exists.
 *
 * @returns {{ selector: string, color: string }[]}
 */
export function collectEarlySheets() {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return [];
  const root = document.documentElement;
  if (!root) return [];
  const fallback =
    sanitizeCanvasColor(getComputedStyle(root).getPropertyValue('--gmixer-bg-secondary')) ||
    sanitizeCanvasColor(getComputedStyle(root).getPropertyValue('--gmixer-bg-primary'));
  /** @type {{ selector: string, color: string, native: boolean }[]} */
  const found = [];
  const seen = new Set();
  const nodes = document.querySelectorAll(
    '[data-gmixer-native-l], [data-gmixer-role="main"], [data-gmixer-role="surface"]'
  );
  for (const el of nodes) {
    if (!coversLargeSheet(el)) continue;
    const selector = sanitizeSheetSelector(stableSheetSelector(el));
    if (!selector || seen.has(selector)) continue;
    const cs = getComputedStyle(el);
    const painted = isOpaqueCssColor(cs.backgroundColor)
      ? sanitizeCanvasColor(cs.backgroundColor)
      : fallback;
    if (!painted) continue;
    const native = hasNativeL(el) && isOpaqueCssColor(cs.backgroundColor);
    seen.add(selector);
    found.push({ selector, color: painted, native });
  }
  found.sort((a, b) => Number(b.native) - Number(a.native));
  return found.slice(0, MAX_EARLY_SHEETS).map(({ selector, color }) => ({ selector, color }));
}

function storageGet(store) {
  try {
    return store?.getItem?.(EARLY_CANVAS_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function storageSet(store, raw) {
  try {
    store?.setItem?.(EARLY_CANVAS_STORAGE_KEY, raw);
  } catch {
    /* quota / disabled storage */
  }
}

function storageRemove(store) {
  try {
    store?.removeItem?.(EARLY_CANVAS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * @returns {{ bg: string, text: string|null, secondary: string|null, scheme: 'dark'|'light', sheets: { selector: string, color: string }[] }|null}
 */
export function readEarlyCanvas() {
  const raw = storageGet(globalThis.sessionStorage) || storageGet(globalThis.localStorage);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || data.enabled === false) return null;
    const bg = sanitizeCanvasColor(data.bg);
    if (!bg) return null;
    const sheets = Array.isArray(data.sheets)
      ? data.sheets
          .map((sheet) => ({
            selector: sanitizeSheetSelector(sheet?.selector),
            color: sanitizeCanvasColor(sheet?.color),
          }))
          .filter((sheet) => sheet.selector && sheet.color)
          .slice(0, MAX_EARLY_SHEETS)
      : [];
    return {
      bg,
      text: sanitizeCanvasColor(data.text),
      secondary: sanitizeCanvasColor(data.secondary),
      scheme: sanitizeColorScheme(data.scheme) || 'dark',
      sheets,
    };
  } catch {
    return null;
  }
}

/**
 * @param {{ bg: string, text?: string|null, secondary?: string|null, scheme?: string, enabled?: boolean }} canvas
 */
export function writeEarlyCanvas(canvas) {
  if (!canvas || canvas.enabled === false) {
    clearEarlyCanvas();
    return;
  }
  const bg = sanitizeCanvasColor(canvas.bg);
  if (!bg) return;
  const sheets = Array.isArray(canvas.sheets)
    ? canvas.sheets
        .map((sheet) => ({
          selector: sanitizeSheetSelector(sheet?.selector),
          color: sanitizeCanvasColor(sheet?.color),
        }))
        .filter((sheet) => sheet.selector && sheet.color)
        .slice(0, MAX_EARLY_SHEETS)
    : [];
  const payload = JSON.stringify({
    v: 2,
    enabled: true,
    bg,
    text: sanitizeCanvasColor(canvas.text) || undefined,
    secondary: sanitizeCanvasColor(canvas.secondary) || undefined,
    scheme: sanitizeColorScheme(canvas.scheme) || 'dark',
    sheets,
  });
  storageSet(globalThis.sessionStorage, payload);
  storageSet(globalThis.localStorage, payload);
}

export function clearEarlyCanvas() {
  storageRemove(globalThis.sessionStorage);
  storageRemove(globalThis.localStorage);
  removeEarlyCanvasStyle();
  removeProvisionalCanvas();
}

export function removeEarlyCanvasStyle() {
  if (typeof document === 'undefined') return;
  document.getElementById(EARLY_CANVAS_STYLE_ID)?.remove();
}

export function removeProvisionalCanvas() {
  if (typeof document === 'undefined') return;
  document.getElementById(PROVISIONAL_STYLE_ID)?.remove();
}

/**
 * First visit to an origin (no remembered sheets): paint html/body plus
 * semantic landmarks/cards from the last-known tone ladder (or default dark).
 * Skipped when origin cache already painted. Removed when real theme CSS injects.
 *
 * @param {import('../lib/tone-canvas.js').ToneCanvas|null} [canvas]
 * @returns {boolean}
 */
export function paintProvisionalCanvas(canvas = null) {
  if (typeof document === 'undefined' || readEarlyCanvas()) return false;
  const root = document.documentElement;
  if (!root) return false;
  const ladder = sanitizeToneCanvas(canvas) || toneCanvas('dark');
  let styleEl = document.getElementById(PROVISIONAL_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = PROVISIONAL_STYLE_ID;
    root.appendChild(styleEl);
  }
  const { bg, secondary, surface, text, scheme } = ladder;
  styleEl.textContent = `html { color-scheme: ${scheme}; }
html, body {
  background-color: ${bg} !important;
  background-image: none !important;
  color: ${text} !important;
}
${PROVISIONAL_SECONDARY_SHEETS} {
  background-color: ${secondary} !important;
  background-image: none !important;
  color: ${text} !important;
}
${PROVISIONAL_SURFACE_SHEETS} {
  background-color: ${surface} !important;
  background-image: none !important;
  color: ${text} !important;
}`;
  return true;
}

function hasChromeStorage() {
  return typeof chrome !== 'undefined' && !!chrome.storage;
}

/**
 * Last-known tone canvas, hostname-independent, for the next origin's first
 * paint. Session for this browser run; local so it survives a restart.
 *
 * @param {object} resolved
 */
export function persistGlobalToneCanvas(resolved) {
  if (!hasChromeStorage()) return;
  try {
    if (resolved?.enabled === false) {
      chrome.storage.session?.remove(GLOBAL_TONE_STORAGE_KEY);
      chrome.storage.local?.remove(GLOBAL_TONE_STORAGE_KEY);
      return;
    }
    const fromTone = toneCanvas(resolved.themeMode, resolved.themeIntensity);
    let computed = null;
    if (typeof document !== 'undefined' && typeof getComputedStyle === 'function' && document.documentElement) {
      const cs = getComputedStyle(document.documentElement);
      computed = sanitizeToneCanvas({
        tone: resolved.themeMode,
        intensity: resolved.themeIntensity,
        bg: cs.getPropertyValue('--gmixer-bg-primary') || cs.getPropertyValue('--gmixer-bg'),
        secondary: cs.getPropertyValue('--gmixer-bg-secondary'),
        surface: cs.getPropertyValue('--gmixer-surface-containers') || cs.getPropertyValue('--gmixer-surface-1'),
        text: cs.getPropertyValue('--gmixer-text'),
        scheme: /\bdark\b/i.test(cs.colorScheme || '') ? 'dark' : 'light',
      });
    }
    const canvas = computed || fromTone;
    const payload = { [GLOBAL_TONE_STORAGE_KEY]: canvas };
    chrome.storage.session?.set(payload);
    chrome.storage.local?.set(payload);
  } catch {
    /* quota / private mode */
  }
}

/**
 * @param {(canvas: import('../lib/tone-canvas.js').ToneCanvas) => void} apply
 */
export function hydrateGlobalToneCanvas(apply) {
  if (!hasChromeStorage() || typeof apply !== 'function') return;
  const use = (raw) => {
    const canvas = sanitizeToneCanvas(raw);
    if (canvas) apply(canvas);
  };
  try {
    chrome.storage.session.get(GLOBAL_TONE_STORAGE_KEY, (data) => {
      if (data?.[GLOBAL_TONE_STORAGE_KEY]) {
        use(data[GLOBAL_TONE_STORAGE_KEY]);
        return;
      }
      chrome.storage.local.get(GLOBAL_TONE_STORAGE_KEY, (localData) => {
        use(localData?.[GLOBAL_TONE_STORAGE_KEY]);
      });
    });
  } catch {
    /* ignore */
  }
}

/**
 * Paint html/body from the last themed visit. Must stay synchronous — no
 * chrome.storage, no imports of the theme bundle.
 *
 * @param {{ bg: string, text?: string|null, secondary?: string|null, scheme?: 'dark'|'light' }|null} [canvas]
 * @returns {boolean}
 */
export function paintEarlyCanvas(canvas = readEarlyCanvas()) {
  if (!canvas?.bg || typeof document === 'undefined') return false;
  const root = document.documentElement;
  if (!root) return false;

  root.style.setProperty('background-color', canvas.bg, 'important');
  root.style.setProperty('background-image', 'none', 'important');
  root.style.setProperty('color-scheme', canvas.scheme || 'dark');
  if (canvas.text) root.style.setProperty('color', canvas.text, 'important');

  let styleEl = document.getElementById(EARLY_CANVAS_STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = EARLY_CANVAS_STYLE_ID;
    root.appendChild(styleEl);
  }
  const text = canvas.text || 'inherit';
  const secondary = canvas.secondary || canvas.bg;
  const sheetFill = secondary;
  const remembered = (canvas.sheets || [])
    .map((sheet) => {
      const selector = sanitizeSheetSelector(sheet.selector);
      const color = sanitizeCanvasColor(sheet.color);
      if (!selector || !color) return '';
      const ink = canvas.text ? `\n  color: ${canvas.text} !important;` : '';
      return `${selector} {
  background-color: ${color} !important;
  background-image: none !important;${ink}
}`;
    })
    .filter(Boolean)
    .join('\n');
  styleEl.textContent = `html { color-scheme: ${canvas.scheme || 'dark'}; }
html, body {
  background-color: ${canvas.bg} !important;
  background-image: none !important;
  color: ${text} !important;
}
:root {
  --gmixer-bg-primary: ${canvas.bg};
  --gmixer-bg-secondary: ${secondary};
}
${EARLY_STRUCTURAL_SHEETS} {
  background-color: ${sheetFill} !important;
  background-image: none !important;
}
${remembered}`;
  return true;
}

/**
 * Snapshot the live theme canvas after injectStyle so the next navigation
 * can paint before chrome.storage returns.
 */
export function persistEarlyCanvasFromDocument() {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return;
  const root = document.documentElement;
  if (!root) return;
  const cs = getComputedStyle(root);
  const bg =
    sanitizeCanvasColor(cs.getPropertyValue('--gmixer-bg-primary')) ||
    sanitizeCanvasColor(cs.getPropertyValue('--gmixer-bg')) ||
    sanitizeCanvasColor(cs.backgroundColor);
  if (!bg) return;
  const scheme = /\bdark\b/i.test(cs.colorScheme || '') ? 'dark' : 'light';
  writeEarlyCanvas({
    bg,
    text:
      sanitizeCanvasColor(cs.getPropertyValue('--gmixer-text')) ||
      sanitizeCanvasColor(cs.color),
    secondary: sanitizeCanvasColor(cs.getPropertyValue('--gmixer-bg-secondary')),
    scheme,
    sheets: collectEarlySheets(),
    enabled: true,
  });
}
