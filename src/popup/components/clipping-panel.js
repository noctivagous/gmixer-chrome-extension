import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { defineElement } from '../../lib/define-element.js';

// Opera GX current-Chromium-only scope means we can rely on `corner-shape`
// directly — see product description.txt > FEATURE 4.
const PRESETS = [
  { id: 'none', label: 'None' },
  { id: 'round', label: 'Round (squircle)' },
  { id: 'notch', label: 'Notch (cut corners)' },
  { id: 'mixed', label: 'Mixed (round + notch per corner)' },
];
const SCOPES = [
  { id: 'images', label: 'Images' },
  { id: 'cards', label: 'Cards / containers' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'all', label: 'All of the above' },
];

export class ClippingPanel extends StoreBoundElement {
  static styles = css`
    label {
      display: block;
      font-size: 11px;
      opacity: 0.8;
      margin: 8px 0 4px;
    }
    select {
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
    label.toggle-row {
      margin: 0;
      opacity: 1;
      font-size: 12px;
    }
  `;

  render() {
    const clipping = this.state?.global?.clipping;
    if (!clipping) return html``;

    return html`
      <label class="toggle-row">
        <input
          type="checkbox"
          role="switch"
          aria-checked=${clipping.enabled}
          .checked=${clipping.enabled}
          @change=${(e) => this.updateGlobal({ clipping: { enabled: e.target.checked } })}
        />
        Enable corner clipping
      </label>

      <label>Preset</label>
      <select @change=${(e) => this.updateGlobal({ clipping: { preset: e.target.value } })}>
        ${PRESETS.map(
          (preset) => html`<option value=${preset.id} ?selected=${preset.id === clipping.preset}>${preset.label}</option>`
        )}
      </select>

      <label>Apply to</label>
      <select @change=${(e) => this.updateGlobal({ clipping: { scope: e.target.value } })}>
        ${SCOPES.map(
          (scope) => html`<option value=${scope.id} ?selected=${scope.id === clipping.scope}>${scope.label}</option>`
        )}
      </select>
    `;
  }
}

defineElement('gmixer-clipping-panel', ClippingPanel);
