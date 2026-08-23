import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { buildPalette, SCHEMES } from '../../lib/color-theory.js';
import { THEME_MODES } from '../../config/theme-packs.js';
import { defineElement } from '../../lib/define-element.js';

import './gmixer-color-wheel.js';
import './gmixer-color-scheme-scales.js';

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

/**
 * Color module — includes Tone (Light | Gray | Dark) plus base color, scheme,
 * identity, intensity, and per-role overrides. Under "Only: Tone" settings
 * focus, only the Tone controls are shown.
 */
export class ColorPanel extends StoreBoundElement {
  static properties = {
    /** When true, only Light | Gray | Dark (Only: Tone settings focus). */
    toneOnly: { type: Boolean, attribute: 'tone-only' },
  };

  static styles = css`
    :host {
      display: grid;
      gap: var(--gm-space-2, 16px);
    }
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
    .mode-picker {
      display: grid;
      gap: 8px;
    }
    .mode-picker > .field-label {
      font-size: 11px;
      opacity: 0.75;
    }
    .color-selection-grid {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 24px;
      align-items: start;
      margin-bottom: 16px;
      padding: 16px;
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    @media (max-width: 480px) {
      .color-selection-grid {
        grid-template-columns: 1fr;
        justify-items: center;
      }
    }
    .tone-segments {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      overflow: hidden;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.18);
    }
    .tone-segment {
      display: grid;
      gap: 4px;
      align-content: center;
      justify-items: center;
      min-height: 56px;
      margin: 0;
      padding: 8px 6px;
      border: 0;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 0;
      background: transparent;
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
      cursor: pointer;
      box-sizing: border-box;
      text-align: center;
    }
    .tone-segment:last-child {
      border-right: 0;
    }
    .tone-segment:hover {
      background: rgba(139, 92, 246, 0.1);
    }
    .tone-segment:focus-visible {
      z-index: 1;
      outline: 2px solid var(--gm-accent, #8b5cf6);
      outline-offset: -2px;
    }
    .tone-segment[aria-pressed='true'] {
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
      box-shadow: inset 0 -2px 0 var(--gm-accent, #7c3aed);
      color: var(--gm-text, #f2eefc);
    }
    .tone-name {
      font: 650 12px/1.1 system-ui, sans-serif;
      letter-spacing: 0.02em;
    }
    .tone-caption {
      max-width: 11ch;
      font: 10px/1.25 system-ui, sans-serif;
      opacity: 0.72;
    }
    .tone-segment[aria-pressed='true'] .tone-caption {
      opacity: 0.9;
    }
  `;

  constructor() {
    super();
    this.toneOnly = false;
  }

  render() {
    const color = this.state?.global?.color;
    if (!color) return html``;
    const activeMode = this.state?.global?.themeMode || 'dark';
    const toneControls = html`
      <div class="mode-picker">
        <span class="field-label" id="theme-mode-label">Tone</span>
        <div class="tone-segments" role="group" aria-labelledby="theme-mode-label">
          ${THEME_MODES.map(
            (mode) => html`
              <button
                type="button"
                class="tone-segment"
                aria-pressed=${mode.id === activeMode}
                title=${mode.description}
                @click=${() => this.updateGlobal({ themeMode: mode.id })}
              >
                <span class="tone-name">${mode.label}</span>
                <span class="tone-caption">${mode.description}</span>
              </button>
            `
          )}
        </div>
        <p class="hint">
          Light, Gray, or Dark sets the full surface direction — the same control used by Only:
          Tone.
        </p>
      </div>
    `;

    if (this.toneOnly) return toneControls;

    const palette = buildPalette(color.baseColor, color.scheme, activeMode);
    const intensity = color.intensity ?? 100;
    const identityMode = color.identityMode || 'restyle';
    const overrides = color.overrides ?? {};

    return html`
      ${toneControls}

      <div class="color-selection-grid">
        <gmixer-color-wheel></gmixer-color-wheel>
        <gmixer-color-scheme-scales></gmixer-color-scheme-scales>
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
        Preserve keeps brand colors while restyling neutrals. Harmonize maps brand hue to the theme
        accent. Fully restyle applies Tone’s full Light|Gray|Dark surfaces (including headers).
      </p>

      <div class="row" style="margin-bottom:10px">
        <input
          type="checkbox"
          id="paint-opaque-only"
          .checked=${color.paintOpaqueOnly !== false}
          @change=${(e) =>
            this.updateGlobal({ color: { paintOpaqueOnly: e.target.checked } })}
        />
        <label for="paint-opaque-only" style="margin:0">
          Only paint surfaces that already had a background
        </label>
      </div>
      <p class="hint">
        On by default. Skips fills on transparent layout wrappers so they share the page canvas.
        Turn off to restore painting every matched header, section, article, and control.
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
      <p class="hint">
        Lower keeps more of the page’s own colors; higher pushes toward the theme. Only: Tone always
        uses 100%.
      </p>

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
