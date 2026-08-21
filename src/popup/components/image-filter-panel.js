import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { defineElement } from '../../lib/define-element.js';

const PRESETS = ['grayscale', 'sepia', 'invert', 'duotone', 'monochrome', 'custom'];
const SCOPES = [
  { id: 'images', label: 'Images/video only' },
  { id: 'backgrounds', label: 'Background images only' },
  { id: 'both', label: 'Both' },
];

export class ImageFilterPanel extends StoreBoundElement {
  static styles = css`
    label {
      display: block;
      font-size: 11px;
      opacity: 0.8;
      margin: 8px 0 4px;
    }
    select,
    input[type='text'] {
      width: 100%;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: inherit;
      border-radius: 4px;
      padding: 4px;
    }
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  `;

  render() {
    const filter = this.state?.global?.imageFilter;
    if (!filter) return html``;

    return html`
      <div class="toggle-row">
        <input
          type="checkbox"
          .checked=${filter.enabled}
          @change=${(e) => this.updateGlobal({ imageFilter: { enabled: e.target.checked } })}
        />
        <label style="margin:0">Enable image filter</label>
      </div>

      <label>Preset</label>
      <select @change=${(e) => this.updateGlobal({ imageFilter: { preset: e.target.value } })}>
        ${PRESETS.map(
          (preset) => html`<option value=${preset} ?selected=${preset === filter.preset}>${preset}</option>`
        )}
      </select>

      ${filter.preset === 'custom'
        ? html`
            <label>Custom filter()</label>
            <input
              type="text"
              placeholder="e.g. grayscale(1) contrast(1.1)"
              .value=${filter.customFilter}
              @input=${(e) => this.updateGlobal({ imageFilter: { customFilter: e.target.value } })}
            />
          `
        : html``}

      <label>Apply to</label>
      <select @change=${(e) => this.updateGlobal({ imageFilter: { scope: e.target.value } })}>
        ${SCOPES.map(
          (scope) => html`<option value=${scope.id} ?selected=${scope.id === filter.scope}>${scope.label}</option>`
        )}
      </select>
    `;
  }
}

defineElement('gmixer-image-filter-panel', ImageFilterPanel);
