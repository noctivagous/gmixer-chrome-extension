// Generic viewport SVG arrows between a control and a Live Preview target.
// Used for color-role chips, typography slots, and later mappings.

export const HOVER_LINK_EVENT = 'gmixer-hover-link';

/** @typedef {'control'|'preview'} HoverLinkSource */

/**
 * @param {{
 *   kind: string,
 *   id: string|null,
 *   source: HoverLinkSource,
 *   el?: Element|null,
 * }} detail
 */
export function emitHoverLink(detail) {
  window.dispatchEvent(
    new CustomEvent(HOVER_LINK_EVENT, {
      detail: {
        kind: detail.kind,
        id: detail.id || null,
        source: detail.source,
        // Specific Live Preview node when several share a role/font slot.
        el: detail.el || null,
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

/** @typedef {{ left: number, top: number, right: number, bottom: number, width: number, height: number }} LinkRect */

/**
 * @param {Pick<DOMRect, 'left'|'top'|'right'|'bottom'|'width'|'height'>} rect
 * @returns {LinkRect}
 */
export function asLinkRect(rect) {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

/**
 * @param {LinkRect} a
 * @param {LinkRect} b
 * @returns {LinkRect|null}
 */
export function intersectRects(a, b) {
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  if (right - left < 1 || bottom - top < 1) return null;
  return { left, top, right, bottom, width: right - left, height: bottom - top };
}

/**
 * When a target is fully scrolled/clipped out of a container, pin a stub rect
 * to the clip edge so the arrow still points “up there” / “down there”.
 *
 * @param {LinkRect} elRect
 * @param {LinkRect} clipRect
 * @returns {LinkRect}
 */
export function clippedEdgeStub(elRect, clipRect) {
  const EDGE = 2;
  const midX = elRect.left + elRect.width / 2;
  const midY = elRect.top + elRect.height / 2;
  const x = Math.min(Math.max(midX, clipRect.left), clipRect.right);
  const y = Math.min(Math.max(midY, clipRect.top), clipRect.bottom);

  if (elRect.bottom <= clipRect.top) {
    return {
      left: x - EDGE,
      top: clipRect.top,
      right: x + EDGE,
      bottom: clipRect.top + EDGE,
      width: EDGE * 2,
      height: EDGE,
    };
  }
  if (elRect.top >= clipRect.bottom) {
    return {
      left: x - EDGE,
      top: clipRect.bottom - EDGE,
      right: x + EDGE,
      bottom: clipRect.bottom,
      width: EDGE * 2,
      height: EDGE,
    };
  }
  if (elRect.right <= clipRect.left) {
    return {
      left: clipRect.left,
      top: y - EDGE,
      right: clipRect.left + EDGE,
      bottom: y + EDGE,
      width: EDGE,
      height: EDGE * 2,
    };
  }
  if (elRect.left >= clipRect.right) {
    return {
      left: clipRect.right - EDGE,
      top: y - EDGE,
      right: clipRect.right,
      bottom: y + EDGE,
      width: EDGE,
      height: EDGE * 2,
    };
  }
  // Degenerate overlap (sub-pixel): fall back to clip center stub.
  return {
    left: x - EDGE,
    top: y - EDGE,
    right: x + EDGE,
    bottom: y + EDGE,
    width: EDGE * 2,
    height: EDGE * 2,
  };
}

/**
 * Intersect `elRect` with viewport + clip rects. If fully clipped, return an
 * edge stub on the nearest clip boundary (top/bottom/left/right).
 *
 * @param {LinkRect} elRect
 * @param {LinkRect[]} clipRects
 * @param {LinkRect} [viewport]
 * @returns {LinkRect|null}
 */
export function clampRectToVisible(elRect, clipRects, viewport) {
  if (!elRect || (elRect.width < 1 && elRect.height < 1)) return null;

  let clip = viewport
    ? asLinkRect(viewport)
    : {
        left: 0,
        top: 0,
        right: typeof window !== 'undefined' ? window.innerWidth : 10000,
        bottom: typeof window !== 'undefined' ? window.innerHeight : 10000,
        width: typeof window !== 'undefined' ? window.innerWidth : 10000,
        height: typeof window !== 'undefined' ? window.innerHeight : 10000,
      };

  for (const next of clipRects || []) {
    const hit = intersectRects(clip, asLinkRect(next));
    if (!hit) {
      // Nested clips with no overlap — treat as fully clipped against prior clip.
      return clippedEdgeStub(elRect, clip);
    }
    clip = hit;
  }

  const visible = intersectRects(elRect, clip);
  if (visible) return visible;
  return clippedEdgeStub(elRect, clip);
}

/**
 * Collect overflow/clip ancestor rects (crosses open shadow boundaries).
 * @param {Element} el
 * @returns {LinkRect[]}
 */
export function clipRectsForElement(el) {
  /** @type {LinkRect[]} */
  const clips = [];
  if (!el || typeof getComputedStyle !== 'function') return clips;

  /** @type {Element|null} */
  let node = el.parentElement;
  while (node) {
    let style;
    try {
      style = getComputedStyle(node);
    } catch {
      break;
    }
    const ox = style.overflowX;
    const oy = style.overflowY;
    const clipsX = ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip';
    const clipsY = oy === 'auto' || oy === 'scroll' || oy === 'hidden' || oy === 'clip';
    if (clipsX || clipsY) {
      clips.push(asLinkRect(node.getBoundingClientRect()));
    }
    if (node.parentElement) {
      node = node.parentElement;
      continue;
    }
    const root = node.getRootNode();
    node = root instanceof ShadowRoot ? root.host : null;
  }
  return clips;
}

/**
 * Visible (or edge-stub) rect for arrow targeting. Updates naturally as
 * ancestors scroll because callers re-read layout each animation frame.
 * @param {Element|null|undefined} el
 * @returns {LinkRect|null}
 */
export function visibleLinkRect(el) {
  if (!el || typeof el.getBoundingClientRect !== 'function') return null;
  const rect = asLinkRect(el.getBoundingClientRect());
  if (rect.width < 1 && rect.height < 1) return null;
  const viewport = {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
  };
  return clampRectToVisible(rect, clipRectsForElement(el), viewport);
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
    /** @type {Element|null} Specific preview node when source is preview. */
    this._anchorEl = null;
    this._raf = 0;
    /** @type {HTMLElement|null} */
    this._host = null;
    this._svg = null;
    this._path = null;
    this._onEvent = this._onEvent.bind(this);
    this._ensureSvg();
    window.addEventListener(HOVER_LINK_EVENT, this._onEvent);
  }

  _onEvent(event) {
    const { kind, id, source, el } = event.detail || {};
    if (kind !== this.kind) return;
    this.setLink(id || null, source || 'preview', el || null);
  }

  /**
   * @param {string|null} id
   * @param {HoverLinkSource} source
   * @param {Element|null} [el]
   */
  setLink(id, source, el = null) {
    this._linkId = id;
    this._source = id ? source : null;
    this._anchorEl = id && source === 'preview' ? el : null;
    if (id) this._start();
    else this._stop();
  }

  destroy() {
    window.removeEventListener(HOVER_LINK_EVENT, this._onEvent);
    this._stop();
    this._host?.remove();
    this._host = null;
    this._svg = null;
    this._path = null;
  }

  _ensureSvg() {
    if (this._svg) return this._svg;
    const NS = 'http://www.w3.org/2000/svg';
    // HTMLElement popover host (SVGElement does not support Popover API).
    // Top layer keeps the arrow above Live Preview in settings/walkthrough.
    const host = document.createElement('div');
    host.setAttribute('popover', 'manual');
    host.setAttribute('data-gmixer-hover-link', this.kind);
    host.setAttribute(
      'style',
      [
        'position:fixed',
        'inset:0',
        'width:100%',
        'height:100%',
        'margin:0',
        'padding:0',
        'border:none',
        'background:transparent',
        'pointer-events:none',
        'overflow:visible',
        // Fallback when Popover API is unavailable.
        'z-index:2147483647',
      ].join(';')
    );
    host.setAttribute('aria-hidden', 'true');

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute(
      'style',
      'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none'
    );
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
    host.appendChild(svg);
    document.body.appendChild(host);
    this._host = host;
    this._svg = svg;
    this._path = path;
    this._hideOverlay();
    return svg;
  }

  _supportsPopover() {
    return typeof this._host?.showPopover === 'function';
  }

  _showOverlay() {
    this._ensureSvg();
    const host = this._host;
    if (!host) return;
    if (this._supportsPopover()) {
      try {
        if (!host.matches(':popover-open')) host.showPopover();
        return;
      } catch {
        // Fall through to visibility fallback.
      }
    }
    host.style.visibility = 'visible';
  }

  _hideOverlay() {
    const host = this._host;
    if (!host) return;
    if (this._supportsPopover()) {
      try {
        if (host.matches(':popover-open')) host.hidePopover();
        return;
      } catch {
        // Fall through to visibility fallback.
      }
    }
    host.style.visibility = 'hidden';
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
    this._anchorEl = null;
    this._hideOverlay();
  }

  _previewEl(id) {
    const anchor = this._anchorEl;
    if (this._source === 'preview' && anchor && anchor.isConnected !== false) {
      return anchor;
    }
    return this.findPreview(id);
  }

  _paint() {
    this._ensureSvg();
    const path = this._path;
    const id = this._linkId;
    if (!path || !id || this.isPaused()) {
      this._hideOverlay();
      return;
    }
    const control = this.findControl(id);
    const preview = this._previewEl(id);
    const fromEl = this._source === 'preview' ? preview : control;
    const toEl = this._source === 'preview' ? control : preview;
    // Clamp to overflow/clip ancestors so Typography (and other) targets that
    // scroll out of Live Preview still get an edge indicator; rAF re-paints
    // as the container scrolls.
    const from = visibleLinkRect(fromEl);
    const to = visibleLinkRect(toEl);
    if (!from || !to) {
      this._hideOverlay();
      return;
    }
    path.setAttribute('d', linkCurve(from, to).d);
    this._showOverlay();
  }
}
