// Generic viewport SVG arrows between a control and a Live Preview target.
// Used for color-role chips, typography slots, and later mappings.

export const HOVER_LINK_EVENT = 'gmixer-hover-link';

/** @typedef {'control'|'preview'} HoverLinkSource */

/**
 * @param {{ kind: string, id: string|null, source: HoverLinkSource }} detail
 */
export function emitHoverLink(detail) {
  window.dispatchEvent(
    new CustomEvent(HOVER_LINK_EVENT, {
      detail: {
        kind: detail.kind,
        id: detail.id || null,
        source: detail.source,
      },
    })
  );
}

/** @deprecated color-role alias */
export const ROLE_HOVER_EVENT = HOVER_LINK_EVENT;

/** Map preview-only hover roles onto a swatch chip. */
export function chipRoleForPreview(roleId) {
  if (roleId === 'linkHover') return 'link';
  if (roleId === 'navLinkHover') return 'navLink';
  return roleId || null;
}

/**
 * @param {string|null} roleId
 * @param {'swatch'|'preview'|'control'} source
 */
export function emitRoleHover(roleId, source) {
  emitHoverLink({
    kind: 'color-role',
    id: roleId,
    source: source === 'swatch' ? 'control' : source,
  });
}

/**
 * Walk shadow hosts from `start` to find the first match for `selector`.
 * @param {Element} start
 * @param {string} selector
 * @returns {Element|null}
 */
export function findInAncestorTree(start, selector) {
  let node = /** @type {Element|ShadowRoot|Document|null} */ (start);
  const seen = new Set();
  while (node && !seen.has(node)) {
    seen.add(node);
    if (typeof node.querySelector === 'function') {
      const hit = node.querySelector(selector);
      if (hit) return hit;
    }
    if (node instanceof Element && node.shadowRoot) {
      const hit = node.shadowRoot.querySelector(selector);
      if (hit) return hit;
    }
    if (node instanceof Element) {
      const root = node.getRootNode();
      node = root instanceof ShadowRoot ? root.host : node.parentElement;
      continue;
    }
    if (node instanceof ShadowRoot) {
      node = node.host;
      continue;
    }
    break;
  }
  return document.querySelector(selector);
}

/**
 * @param {Element} from
 * @param {string} attr
 * @param {string} value
 */
export function previewElForAttr(from, attr, value) {
  const panel = findInAncestorTree(from, 'gmixer-theme-preview-panel');
  return panel?.shadowRoot?.querySelector(`[${attr}="${CSS.escape(value)}"]`) || null;
}

/** @param {Element} from @param {string} roleId */
export function previewElForRole(from, roleId) {
  return previewElForAttr(from, 'data-gmixer-preview-role', roleId);
}

/** @param {Element} from @param {string} fontSlot */
export function previewElForFontSlot(from, fontSlot) {
  return previewElForAttr(from, 'data-gmixer-preview-font', fontSlot);
}

/**
 * Point on the rect edge facing (tx, ty).
 * @param {DOMRect} rect
 * @param {number} tx
 * @param {number} ty
 */
export function rectEdgeToward(rect, tx, ty) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = Math.max(rect.width / 2, 1);
  const hh = Math.max(rect.height / 2, 1);
  const sx = dx === 0 ? Infinity : hw / Math.abs(dx);
  const sy = dy === 0 ? Infinity : hh / Math.abs(dy);
  const t = Math.min(sx, sy);
  return { x: cx + dx * t, y: cy + dy * t };
}

/**
 * Cubic path from one rect to another, plus endpoint for the arrowhead.
 * @param {DOMRect} from
 * @param {DOMRect} to
 */
export function linkCurve(from, to) {
  const toCenter = { x: to.left + to.width / 2, y: to.top + to.height / 2 };
  const fromCenter = { x: from.left + from.width / 2, y: from.top + from.height / 2 };
  const start = rectEdgeToward(from, toCenter.x, toCenter.y);
  const end = rectEdgeToward(to, fromCenter.x, fromCenter.y);
  const dx = end.x - start.x;
  const c1x = start.x + dx * 0.45;
  const c2x = end.x - dx * 0.45;
  return {
    d: `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} C ${c1x.toFixed(1)} ${start.y.toFixed(1)}, ${c2x.toFixed(1)} ${end.y.toFixed(1)}, ${end.x.toFixed(1)} ${end.y.toFixed(1)}`,
    start,
    end,
  };
}

function usableRect(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return null;
  const rect = el.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  return rect;
}

let overlaySeq = 0;

/**
 * One overlay instance per mapping (color-role, font-slot, …).
 * Listens for `HOVER_LINK_EVENT` of its `kind` and draws a viewport arrow.
 */
export class HoverLinkOverlay {
  /**
   * @param {{
   *   kind: string,
   *   findControl: (id: string) => Element|null,
   *   findPreview: (id: string) => Element|null,
   *   isPaused?: () => boolean,
   * }} options
   */
  constructor(options) {
    this.kind = options.kind;
    this.findControl = options.findControl;
    this.findPreview = options.findPreview;
    this.isPaused = options.isPaused || (() => false);
    this._markerId = `gmixer-hover-link-${++overlaySeq}`;
    this._linkId = null;
    /** @type {HoverLinkSource|null} */
    this._source = null;
    this._raf = 0;
    this._svg = null;
    this._path = null;
    this._onEvent = this._onEvent.bind(this);
    this._ensureSvg();
    window.addEventListener(HOVER_LINK_EVENT, this._onEvent);
  }

  _onEvent(event) {
    const { kind, id, source } = event.detail || {};
    if (kind !== this.kind) return;
    this.setLink(id || null, source || 'preview');
  }

  /**
   * @param {string|null} id
   * @param {HoverLinkSource} source
   */
  setLink(id, source) {
    this._linkId = id;
    this._source = id ? source : null;
    if (id) this._start();
    else this._stop();
  }

  destroy() {
    window.removeEventListener(HOVER_LINK_EVENT, this._onEvent);
    this._stop();
    this._svg?.remove();
    this._svg = null;
    this._path = null;
  }

  _ensureSvg() {
    if (this._svg) return this._svg;
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute(
      'style',
      'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:2147483000;overflow:visible'
    );
    svg.setAttribute('aria-hidden', 'true');
    const defs = document.createElementNS(NS, 'defs');
    const marker = document.createElementNS(NS, 'marker');
    marker.setAttribute('id', this._markerId);
    marker.setAttribute('viewBox', '0 0 10 10');
    marker.setAttribute('refX', '8');
    marker.setAttribute('refY', '5');
    marker.setAttribute('markerWidth', '7');
    marker.setAttribute('markerHeight', '7');
    marker.setAttribute('orient', 'auto-start-reverse');
    const tip = document.createElementNS(NS, 'path');
    tip.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
    tip.setAttribute('fill', '#c4b5fd');
    marker.appendChild(tip);
    defs.appendChild(marker);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#c4b5fd');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('marker-end', `url(#${this._markerId})`);
    path.setAttribute('opacity', '0.92');
    svg.appendChild(defs);
    svg.appendChild(path);
    svg.hidden = true;
    document.body.appendChild(svg);
    this._svg = svg;
    this._path = path;
    return svg;
  }

  _start() {
    if (this._raf) return;
    const loop = () => {
      this._paint();
      if (this._linkId) this._raf = requestAnimationFrame(loop);
      else this._raf = 0;
    };
    this._raf = requestAnimationFrame(loop);
  }

  _stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (this._svg) this._svg.hidden = true;
  }

  _paint() {
    const svg = this._ensureSvg();
    const path = this._path;
    const id = this._linkId;
    if (!path || !id || this.isPaused()) {
      svg.hidden = true;
      return;
    }
    const control = this.findControl(id);
    const preview = this.findPreview(id);
    const fromEl = this._source === 'preview' ? preview : control;
    const toEl = this._source === 'preview' ? control : preview;
    const from = usableRect(fromEl);
    const to = usableRect(toEl);
    if (!from || !to) {
      svg.hidden = true;
      return;
    }
    path.setAttribute('d', linkCurve(from, to).d);
    svg.hidden = false;
  }
}
