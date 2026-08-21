// Opt-in navigation controller (product description Feature 7).
// Off by default — no keys bind until navigation.enabled is true.
// Keys (right-handed, fixed): F = click outlined element, D = back, R = forward.

import { findClickableAtPoint, isTypingContext } from './clickable-detector.js';
import { HoverOutline } from './hover-outline.js';
import { buildPalette } from '../lib/color-theory.js';

const KEY = {
  click: 'f',
  back: 'd',
  forward: 'r',
};

export class NavigationController {
  /**
   * @param {() => object} getResolved  returns resolved global settings for this host
   */
  constructor(getResolved) {
    this.getResolved = getResolved;
    this.enabled = false;
    this.outline = new HoverOutline();
    this.outline.setFinder(findClickableAtPoint);
    this._onKeyDown = (e) => this._handleKey(e);
  }

  /** Sync with latest settings — start/stop listeners as needed. */
  sync() {
    const resolved = this.getResolved();
    const nav = resolved?.navigation;
    const want = !!nav?.enabled && resolved?.enabled !== false;

    const palette = buildPalette(
      resolved?.color?.baseColor || '#7c3aed',
      resolved?.color?.scheme || 'splitComplement'
    );
    const color = resolved?.color?.overrides?.accent || palette.accent;

    this.outline.setOptions({
      animated: nav?.hoverOutlineAnimated !== false,
      color,
    });

    if (want && !this.enabled) {
      this._start(nav);
    } else if (!want && this.enabled) {
      this._stop();
    } else if (want && this.enabled) {
      // already on — options already applied above
      this._flags = nav;
    }
  }

  destroy() {
    this._stop();
  }

  /** @private */
  _start(nav) {
    this.enabled = true;
    this._flags = nav;
    this.outline.start();
    document.addEventListener('keydown', this._onKeyDown, true);
  }

  /** @private */
  _stop() {
    this.enabled = false;
    this._flags = null;
    this.outline.stop();
    document.removeEventListener('keydown', this._onKeyDown, true);
  }

  /** @private */
  _handleKey(e) {
    if (!this.enabled || e.defaultPrevented) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (isTypingContext(e.target)) return;

    const key = e.key?.length === 1 ? e.key.toLowerCase() : e.key;
    const flags = this._flags || {};

    if (key === KEY.click && flags.clickElement !== false) {
      e.preventDefault();
      e.stopPropagation();
      this.outline.clickCurrent();
      return;
    }

    if (key === KEY.back && flags.back !== false) {
      e.preventDefault();
      e.stopPropagation();
      history.back();
      return;
    }

    if (key === KEY.forward && flags.forward !== false) {
      e.preventDefault();
      e.stopPropagation();
      history.forward();
    }
  }
}
