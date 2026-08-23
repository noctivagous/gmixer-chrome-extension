import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { buildPalette } from '../../lib/color-theory.js';
import { defineElement } from '../../lib/define-element.js';

const SCHEMES = [
  { id: 'analog', label: 'Analogous' },
  { id: 'complement', label: 'Complementary' },
  { id: 'splitComplement', label: 'Split-Complementary' },
  { id: 'triadic', label: 'Triadic' },
  { id: 'tetradic', label: 'Tetradic' },
  { id: 'monochrome', label: 'Monochrome' },
];

const IDENTITY_MODES = [
  { id: 'preserve', label: 'Preserve site identity' },
  { id: 'harmonize', label: 'Harmonize site identity' },
  { id: 'restyle', label: 'Fully restyle' },
];

const ROLES = [
  { id: 'background', label: 'BG:Primary' },
  { id: 'backgroundSecondary', label: 'BG:Secondary' },
  { id: 'surfaceGui', label: 'Surface: GUI' },
  { id: 'surfaceContainers', label: 'Surface: Containers' },
  { id: 'text', label: 'Text' },
  { id: 'muted', label: 'Muted' },
  { id: 'accent', label: 'Accent' },
  { id: 'link', label: 'Link' },
  { id: 'border', label: 'Border' },
  { id: 'focus', label: 'Focus' },
];

export class ColorPanel extends StoreBoundElement {
  static styles = css`
    label {
      display: block;
      font-size: 11px;
      opacity: 0.8;
      margin-bottom: 4px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }
    select,
    input[type='color'],
    input[type='range'] {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: inherit;
      border-radius: 4px;
      padding: 3px;
    }
    input[type='range'] {
      width: 100%;
      padding: 0;
    }
    .roles {
      display: grid;
      gap: 8px;
      margin-top: 10px;
    }
    .role {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 6px;
      align-items: center;
    }
    .role span {
      font-size: 11px;
      text-transform: capitalize;
    }
    button.reset {
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: inherit;
      border-radius: 4px;
      font-size: 10px;
      padding: 2px 6px;
      cursor: pointer;
    }
    button.reset:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .hint {
      font-size: 10px;
      opacity: 0.6;
      margin: 8px 0 0;
    }
  `;

  render() {
    const color = this.state?.global?.color;
    if (!color) return html``;
    const palette = buildPalette(color.baseColor, color.scheme, this.state?.global?.themeMode || 'dark');
    const intensity = color.intensity ?? 80;
    const identityMode = color.identityMode || 'preserve';
    const overrides = color.overrides ?? {};

    return html`
      <div class="row">
        <label style="flex:1">
          Base color
          <input
            type="color"
            .value=${color.baseColor}
            @input=${(e) => this.updateGlobal({ color: { baseColor: e.target.value } })}
          />
        </label>
        <label style="flex:1">
          Scheme
          <select @change=${(e) => this.updateGlobal({ color: { scheme: e.target.value } })}>
            ${SCHEMES.map(
              (s) => html`<option value=${s.id} ?selected=${s.id === color.scheme}>${s.label}</option>`
            )}
          </select>
        </label>
      </div>

      <label>Site identity</label>
      <select
        style="width:100%;margin-bottom:10px"
        @change=${(e) => this.updateGlobal({ color: { identityMode: e.target.value } })}
      >
        ${IDENTITY_MODES.map(
          (mode) => html`<option value=${mode.id} ?selected=${mode.id === identityMode}>
            ${mode.label}
          </option>`
        )}
      </select>
      <p class="hint">
        Preserve keeps brand colors while restyling neutrals. Harmonize maps brand hue to the
        theme accent. Fully restyle blends everything by intensity.
      </p>

      <label>Restyle intensity (${intensity}%)</label>
      <input
        type="range"
        min="0"
        max="100"
        step="5"
        .value=${String(intensity)}
        @input=${(e) => this.updateGlobal({ color: { intensity: Number(e.target.value) } })}
      />
      <p class="hint">Lower keeps more of the page’s own colors; higher pushes toward the theme.</p>

      <div class="roles">
        ${ROLES.map((role) => {
          const override = overrides[role.id] || '';
          const effective = override || palette[role.id];
          return html`
            <div class="role">
              <span>${role.label}</span>
              <input
                type="color"
                .value=${effective}
                title=${override ? 'Custom override' : 'Generated — change to override'}
                @input=${(e) => this._setOverride(role.id, e.target.value)}
              />
              <button
                class="reset"
                ?disabled=${!override}
                @click=${() => this._setOverride(role.id, '')}
              >
                Auto
              </button>
            </div>
          `;
        })}
      </div>
    `;
  }

  _setOverride(roleId, value) {
    this.updateGlobal({
      color: {
        overrides: {
          [roleId]: value,
        },
      },
    });
  }
}

defineElement('gmixer-color-panel', ColorPanel);
