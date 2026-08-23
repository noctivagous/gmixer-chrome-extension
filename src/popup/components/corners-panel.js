import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { defineElement } from '../../lib/define-element.js';

const SCOPES = [
  { id: 'images', label: 'Images & video' },
  { id: 'buttons', label: 'Buttons' },
  { id: 'all', label: 'Images, video & buttons' },
];

const CORNER_KEYS = [
  { id: 'topLeft', label: 'Top left' },
  { id: 'topRight', label: 'Top right' },
  { id: 'bottomRight', label: 'Bottom right' },
  { id: 'bottomLeft', label: 'Bottom left' },
];

export class CornersPanel extends StoreBoundElement {
  static styles = css`
    label {
      display: block;
      font-size: 11px;
      opacity: 0.8;
      margin: 8px 0 4px;
    }
    select,
    input[type='range'] {
      width: 100%;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: inherit;
      border-radius: 4px;
      padding: 4px;
      box-sizing: border-box;
    }
    input[type='range'] {
      padding: 0;
      border: 0;
      background: transparent;
    }
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .toggle-row label {
      margin: 0;
    }
    .hint {
      margin: 4px 0 0;
      font-size: 11px;
      opacity: 0.65;
      line-height: 1.4;
    }
    .radius-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .radius-row input[type='range'] {
      flex: 1;
    }
    .radius-value {
      flex: 0 0 3ch;
      font-size: 12px;
      font-variant-numeric: tabular-nums;
      opacity: 0.85;
    }
    .corners-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px 12px;
      margin-top: 4px;
    }
    .corners-grid .toggle-row {
      margin: 0;
    }
      `;

  render() {
    const corners = this.state?.global?.corners;
    if (!corners) return html``;

    const radius = Number(corners.radius) || 0;
    const bevel = corners.bevel ?? {};

    return html`
      <div class="toggle-row">
        <input
          type="checkbox"
          .checked=${corners.enabled}
          @change=${(e) => this.updateGlobal({ corners: { enabled: e.target.checked } })}
        />
        <label>Override corner radius</label>
      </div>
      <p class="hint">
        Forces the same radius on matching elements (e.g. 0 for sharp corners on every site).
        When Clipping is also on, Corners wins on shared properties.
      </p>

      <label>Radius (${radius}px)</label>
      <div class="radius-row">
        <input
          type="range"
          min="0"
          max="48"
          step="1"
          .value=${String(radius)}
          @input=${(e) =>
            this.updateGlobal({ corners: { radius: Number(e.target.value) } })}
        />
        <span class="radius-value">${radius}</span>
      </div>

      <label>Diagonal cuts (bevel)</label>
      <p class="hint">Uses corner-shape: bevel on selected corners. Needs radius &gt; 0 to show.</p>
      <div class="corners-grid">
        ${CORNER_KEYS.map(
          (corner) => html`
            <div class="toggle-row">
              <input
                type="checkbox"
                .checked=${!!bevel[corner.id]}
                @change=${(e) =>
                  this.updateGlobal({
                    corners: { bevel: { [corner.id]: e.target.checked } },
                  })}
              />
              <label>${corner.label}</label>
            </div>
          `
        )}
      </div>

      <label>Apply to</label>
      <select @change=${(e) => this.updateGlobal({ corners: { scope: e.target.value } })}>
        ${SCOPES.map(
          (scope) => html`<option value=${scope.id} ?selected=${scope.id === corners.scope}>${scope.label}</option>`
        )}
      </select>
    `;
  }
}

defineElement('gmixer-corners-panel', CornersPanel);
