// Hover outline overlay for opt-in navigation.
// Same job as KeyPilot's focus ring, but CSS-animated by default (product
// description Feature 7 — heavier GX-style effects).

const OUTLINE_ID = 'gmixer-hover-outline';

export class HoverOutline {
  /**
   * @param {{ animated?: boolean, color?: string }} [options]
   */
  constructor(options = {}) {
    this.animated = options.animated !== false;
    this.color = options.color || '#a78bfa';
    /** @type {Element|null} */
    this.current = null;
    /** @type {HTMLElement|null} */
    this.overlay = null;
    this._raf = 0;
    this._lastX = 0;
    this._lastY = 0;
    this._onMove = (e) => {
      this._lastX = e.clientX;
      this._lastY = e.clientY;
      if (this._raf) return;
      this._raf = requestAnimationFrame(() => {
        this._raf = 0;
        this._paintAt(this._lastX, this._lastY);
      });
    };
    this._flashTimer = 0;
    this._onScroll = () => {
      if (this.current) this._positionOver(this.current);
    };
  }

  setOptions({ animated, color } = {}) {
    if (typeof animated === 'boolean') this.animated = animated;
    if (typeof color === 'string' && color) this.color = color;
    if (this.overlay) this._applyVisual();
  }

  start() {
    if (this.overlay) return;
    this.overlay = document.createElement('div');
    this.overlay.id = OUTLINE_ID;
    this.overlay.setAttribute('aria-hidden', 'true');
    Object.assign(this.overlay.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483646',
      boxSizing: 'border-box',
      borderRadius: '6px',
      display: 'none',
      left: '0px',
      top: '0px',
      width: '0px',
      height: '0px',
    });
    this._applyVisual();
    (document.documentElement || document.body).appendChild(this.overlay);
    document.addEventListener('mousemove', this._onMove, { passive: true, capture: true });
    window.addEventListener('scroll', this._onScroll, { passive: true, capture: true });
  }

  stop() {
    document.removeEventListener('mousemove', this._onMove, { capture: true });
    window.removeEventListener('scroll', this._onScroll, { capture: true });
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = 0;
    if (this._flashTimer) clearTimeout(this._flashTimer);
    this._flashTimer = 0;
    this.current = null;
    this.overlay?.remove();
    this.overlay = null;
  }

  getCurrentElement() {
    return this.current;
  }

  /** Click the currently outlined element (F key). */
  clickCurrent() {
    const el = this.current;
    if (!el) return false;
    try {
      if (typeof el.click === 'function') {
        el.click();
      } else {
        el.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true, view: window })
        );
      }
      this._flash();
      return true;
    } catch {
      return false;
    }
  }

  /** @private */
  _applyVisual() {
    if (!this.overlay) return;
    const c = this.color;
    this.overlay.style.border = `2px solid ${c}`;
    this.overlay.style.boxShadow = `0 0 0 1px rgba(0,0,0,0.35), 0 0 12px ${c}`;
    this.overlay.style.transition = this.animated
      ? 'left 120ms ease-out, top 120ms ease-out, width 120ms ease-out, height 120ms ease-out, opacity 120ms ease-out, box-shadow 240ms ease-out'
      : 'none';
    if (this.animated) {
      this.overlay.style.animation = 'gmixer-outline-pulse 1.6s ease-in-out infinite';
      this._ensureKeyframes();
    } else {
      this.overlay.style.animation = 'none';
    }
  }

  /** @private */
  _ensureKeyframes() {
    if (document.getElementById('gmixer-outline-keyframes')) return;
    const style = document.createElement('style');
    style.id = 'gmixer-outline-keyframes';
    style.textContent = `
      @keyframes gmixer-outline-pulse {
        0%, 100% { box-shadow: 0 0 0 1px rgba(0,0,0,0.35), 0 0 8px var(--gmixer-outline-color, #a78bfa); }
        50% { box-shadow: 0 0 0 1px rgba(0,0,0,0.35), 0 0 18px var(--gmixer-outline-color, #a78bfa); }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  /** @private */
  _paintAt(x, y) {
    // Lazy import path avoided — caller passes detector via setFinder
    if (!this._finder) return;
    const el = this._finder(x, y);
    if (el === this.current) {
      if (el) this._positionOver(el);
      return;
    }
    this.current = el;
    if (!el) {
      if (this.overlay) this.overlay.style.display = 'none';
      return;
    }
    this._positionOver(el);
  }

  /**
   * @param {(x: number, y: number) => Element|null} finder
   */
  setFinder(finder) {
    this._finder = finder;
  }

  /** @private */
  _positionOver(el) {
    if (!this.overlay) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 && rect.height < 1) {
      this.overlay.style.display = 'none';
      return;
    }
    const pad = 3;
    this.overlay.style.setProperty('--gmixer-outline-color', this.color);
    this.overlay.style.display = 'block';
    this.overlay.style.left = `${Math.max(0, rect.left - pad)}px`;
    this.overlay.style.top = `${Math.max(0, rect.top - pad)}px`;
    this.overlay.style.width = `${rect.width + pad * 2}px`;
    this.overlay.style.height = `${rect.height + pad * 2}px`;
  }

  /** @private */
  _flash() {
    if (!this.overlay || !this.animated) return;
    const prev = this.overlay.style.boxShadow;
    this.overlay.style.boxShadow = `0 0 0 3px ${this.color}, 0 0 28px ${this.color}`;
    if (this._flashTimer) clearTimeout(this._flashTimer);
    this._flashTimer = window.setTimeout(() => {
      this._flashTimer = 0;
      if (this.overlay) this.overlay.style.boxShadow = prev;
    }, 160);
  }
}
