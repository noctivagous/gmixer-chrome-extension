import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { hexToHsl, hslToHex, hueRingHex, accentHueOffsets } from '../../lib/color-theory.js';
import { defineElement } from '../../lib/define-element.js';

export class GmixerColorWheel extends StoreBoundElement {
  static properties = {
    monochrome: { type: Boolean, reflect: true },
  };

  static styles = css`
    :host {
      display: block;
      width: 160px;
      height: 160px;
      position: relative;
      user-select: none;
    }
    .wheel {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: conic-gradient(
        from 0deg,
        #ff0000,
        #ffff00,
        #00ff00,
        #00ffff,
        #0000ff,
        #ff00ff,
        #ff0000
      );
      position: relative;
      cursor: crosshair;
      touch-action: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }
    .wheel.monochrome {
      background: conic-gradient(
        from 180deg,
        #ffffff,
        #d9d9d9,
        #b3b3b3,
        #8c8c8c,
        #666666,
        #404040,
        #1a1a1a,
        #404040,
        #666666,
        #8c8c8c,
        #b3b3b3,
        #d9d9d9,
        #ffffff
      );
    }
    .wheel::after {
      content: '';
      position: absolute;
      inset: 20px;
      background: var(--gm-bg, #14121a);
      border-radius: 50%;
      box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.5);
    }
    .handle {
      position: absolute;
      width: 16px;
      height: 16px;
      border: 2px solid white;
      border-radius: 50%;
      background: var(--current-color, #fff);
      box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 2;
    }
    .accent-dot {
      position: absolute;
      width: 8px;
      height: 8px;
      border: 1px solid rgba(255, 255, 255, 0.8);
      border-radius: 50%;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1;
      pointer-events: none;
    }
  `;

  constructor() {
    super();
    this.monochrome = false;
  }

  render() {
    const color = this.state?.global?.color;
    if (!color) return html``;

    const { h, l } = hexToHsl(color.baseColor);
    const radius = 60;
    const wheelAngle = this.monochrome ? (l / 100) * 360 : h;
    const mainPos = this._getPos(wheelAngle, radius + 10);
    const offsets = this.monochrome ? [] : accentHueOffsets(color.scheme);
    // Ring samples are always s=1.0, l=0.5 — this is the base-color pick,
    // not the working color after saturation/lightness sliders.
    const ringColor = hueRingHex(h);

    return html`
      <div
        class="wheel ${this.monochrome ? 'monochrome' : ''}"
        @pointerdown=${this._onPointerDown}
        @pointermove=${this._onPointerMove}
        @pointerup=${this._onPointerUp}
        @pointercancel=${this._onPointerUp}
        style="--current-color: ${this.monochrome ? color.baseColor : ringColor}"
      >
        <div
          class="handle"
          style="transform: translate(calc(-50% + ${mainPos.x}px), calc(-50% + ${mainPos.y}px))"
        ></div>
        ${offsets.map((offset) => {
          const accentPos = this._getPos(h + offset, radius);
          const accentColor = hueRingHex(h + offset);
          return html`
            <div
              class="accent-dot"
              style="
                background: ${accentColor};
                transform: translate(calc(-50% + ${accentPos.x}px), calc(-50% + ${accentPos.y}px))
              "
            ></div>
          `;
        })}
      </div>
    `;
  }

  _getPos(hue, radius) {
    const rad = ((hue - 90) * Math.PI) / 180;
    return {
      x: Math.cos(rad) * radius,
      y: Math.sin(rad) * radius,
    };
  }

  _onPointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId);
    this._updateHue(event);
  }

  _onPointerMove(event) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    this._updateHue(event);
  }

  _onPointerUp(event) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  _updateHue(e) {
    const wheel = this.renderRoot.querySelector('.wheel');
    const rect = wheel.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;

    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;

    const color = this.state?.global?.color;
    if (!color) return;

    const hsl = hexToHsl(color.baseColor);
    if (this.monochrome) {
      const lightness = Math.max(8, Math.min(92, Math.round((angle / 360) * 100)));
      const newHex = hslToHex({ h: hsl.h, s: 0, l: lightness });
      this.updateGlobal({ color: { baseColor: newHex, schemeBaseColor: newHex } });
      return;
    }

    // Pipeline step 2: pick hue from the ring (s=1.0, l=0.5). Scheme (step 1)
    // is left alone; saturation and lightness stay with step 3.
    const newHex = hslToHex({ ...hsl, h: angle });

    this.updateGlobal({ color: { baseColor: newHex, schemeBaseColor: newHex } });
  }
}

defineElement('gmixer-color-wheel', GmixerColorWheel);
