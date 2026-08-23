import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { SCHEMES, getColorScale } from '../../lib/color-theory.js';
import { defineElement } from '../../lib/define-element.js';

export class GmixerColorSchemeScales extends StoreBoundElement {
  static styles = css`
    :host {
      display: grid;
      gap: var(--gm-space-2, 16px);
      width: 100%;
    }
    .scheme-row {
      display: grid;
      grid-template-columns: 100px 1fr;
      align-items: center;
      gap: 12px;
    }
    .scheme-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
    }
    .scales-grid {
      display: grid;
      grid-template-rows: repeat(3, auto);
      gap: 4px;
    }
    .scale {
      display: flex;
      gap: 2px;
    }
    .swatch {
      width: 100%;
      aspect-ratio: 1;
      border-radius: 2px;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: transform 120ms ease, box-shadow 120ms ease;
    }
    .swatch:hover {
      transform: scale(1.1);
      z-index: 1;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    }
    .swatch.active {
      outline: 2px solid var(--gm-accent, #8b5cf6);
      outline-offset: 1px;
    }
  `;

  render() {
    const color = this.state?.global?.color;
    if (!color) return html``;

    return html`
      ${SCHEMES.map((scheme) => this._renderScheme(scheme, color))}
    `;
  }

  _renderScheme(scheme, currentColor) {
    const steps = 5;
    const tints = getColorScale(currentColor.baseColor, 'tint', steps);
    const shades = getColorScale(currentColor.baseColor, 'shade', steps);
    const tones = getColorScale(currentColor.baseColor, 'tone', steps);

    return html`
      <div class="scheme-row">
        <span class="scheme-label">${scheme.label}</span>
        <div class="scales-grid">
          <div class="scale">${tints.map((c) => this._renderSwatch(c, scheme.id, currentColor))}</div>
          <div class="scale">${shades.map((c) => this._renderSwatch(c, scheme.id, currentColor))}</div>
          <div class="scale">${tones.map((c) => this._renderSwatch(c, scheme.id, currentColor))}</div>
        </div>
      </div>
    `;
  }

  _renderSwatch(hex, schemeId, currentColor) {
    const isActive = currentColor.baseColor.toLowerCase() === hex.toLowerCase() && currentColor.scheme === schemeId;
    return html`
      <div
        class="swatch ${isActive ? 'active' : ''}"
        style="background: ${hex}"
        title="${hex}"
        @click=${() => this._select(hex, schemeId)}
      ></div>
    `;
  }

  _select(hex, schemeId) {
    this.updateGlobal({
      color: {
        baseColor: hex,
        scheme: schemeId
      }
    });
  }
}

defineElement('gmixer-color-scheme-scales', GmixerColorSchemeScales);
