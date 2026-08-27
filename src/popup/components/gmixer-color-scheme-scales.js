import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { SCHEMES, accentHueOffsets, getColorScale, hexToHsl, hslToHex } from '../../lib/color-theory.js';
import { defineElement } from '../../lib/define-element.js';

export class GmixerColorSchemeScales extends StoreBoundElement {
  static properties = {
    monochrome: { type: Boolean, reflect: true },
    activeSchemeOnly: { type: Boolean, attribute: 'active-scheme-only', reflect: true },
  };

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
    .scheme-row.compact {
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
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
      display: block;
      width: 100%;
      aspect-ratio: 1;
      border-radius: 2px;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 0;
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
    .scale-label {
      min-width: 3.5rem;
      color: var(--gm-muted, rgba(242, 238, 252, 0.55));
      font-size: 10px;
    }
  `;

  constructor() {
    super();
    this.monochrome = false;
    this.activeSchemeOnly = false;
  }

  render() {
    const color = this.state?.global?.color;
    if (!color) return html``;

    let schemes = this.monochrome
      ? SCHEMES.filter((scheme) => scheme.id === 'monochrome')
      : SCHEMES.filter((scheme) => scheme.id !== 'monochrome');

    if (this.activeSchemeOnly) {
      const activeId = color.scheme || 'monochrome';
      schemes = schemes.filter((scheme) => scheme.id === activeId);
      if (!schemes.length) {
        const fallback = SCHEMES.find((scheme) => scheme.id === activeId);
        schemes = fallback ? [fallback] : schemes;
      }
    }

    return html`
      ${schemes.map((scheme) => this._renderScheme(scheme, color))}
    `;
  }

  _renderScheme(scheme, currentColor) {
    const steps = 5;
    const schemeColors = this._schemeColors(currentColor.baseColor, scheme.id);
    const tints = schemeColors.flatMap((color) => getColorScale(color, 'tint', steps));
    const shades = schemeColors.flatMap((color) => getColorScale(color, 'shade', steps));
    const tones = schemeColors.flatMap((color) => getColorScale(color, 'tone', steps));
    const compact = this.activeSchemeOnly;

    return html`
      <div class="scheme-row ${compact ? 'compact' : ''}">
        ${compact ? null : html`<span class="scheme-label">${scheme.label}</span>`}
        <div class="scales-grid">
          <div class="scale">
            <span class="scale-label">Colors</span>
            ${schemeColors.map((color) =>
              this._renderSwatch(color, scheme.id, currentColor, scheme.label)
            )}
          </div>
          <div class="scale"><span class="scale-label">Tint</span>${tints.map((c) => this._renderSwatch(c, scheme.id, currentColor, 'Tint'))}</div>
          <div class="scale"><span class="scale-label">Shade</span>${shades.map((c) => this._renderSwatch(c, scheme.id, currentColor, 'Shade'))}</div>
          <div class="scale"><span class="scale-label">Tone</span>${tones.map((c) => this._renderSwatch(c, scheme.id, currentColor, 'Tone'))}</div>
        </div>
      </div>
    `;
  }

  _schemeColors(baseColor, schemeId) {
    const hsl = hexToHsl(baseColor);
    return [0, ...accentHueOffsets(schemeId)].map((offset) =>
      hslToHex({ ...hsl, h: (hsl.h + offset + 360) % 360 })
    );
  }

  _renderSwatch(hex, schemeId, currentColor, scaleLabel) {
    const isActive = currentColor.baseColor.toLowerCase() === hex.toLowerCase() && currentColor.scheme === schemeId;
    return html`
      <button
        type="button"
        class="swatch ${isActive ? 'active' : ''}"
        style="background: ${hex}"
        title=${`${scaleLabel}: ${hex}`}
        aria-label=${`${schemeId} ${scaleLabel} ${hex}`}
        @click=${() => this._select(hex, schemeId)}
      ></button>
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
