import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { hexToHsl, hslToHex, accentHueOffsets } from '../../lib/color-theory.js';
import { defineElement } from '../../lib/define-element.js';

export class GmixerColorWheel extends StoreBoundElement {
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
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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
    this._isDragging = false;
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
  }

  render() {
    const color = this.state?.global?.color;
    if (!color) return html``;

    const { h, s, l } = hexToHsl(color.baseColor);
    const offsets = accentHueOffsets(color.scheme);

    const radius = 60; // radius for dots positioning
    const mainPos = this._getPos(h, radius + 10);

    return html`
      <div
        class="wheel"
        @mousedown=${this._onMouseDown}
        style="--current-color: ${color.baseColor}"
      >
        <div
          class="handle"
          style="transform: translate(calc(-50% + ${mainPos.x}px), calc(-50% + ${mainPos.y}px))"
        ></div>
        ${offsets.map((offset) => {
          const accentPos = this._getPos(h + offset, radius);
          const accentColor = hslToHex({ h: h + offset, s, l });
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

  _onMouseDown(e) {
    this._isDragging = true;
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    this._updateHue(e);
  }

  _onMouseMove(e) {
    if (!this._isDragging) return;
    this._updateHue(e);
  }

  _onMouseUp() {
    this._isDragging = false;
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
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
    const newHex = hslToHex({ ...hsl, h: angle });

    this.updateGlobal({ color: { baseColor: newHex } });
  }
}

defineElement('gmixer-color-wheel', GmixerColorWheel);
