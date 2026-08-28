import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { buildPalette, hexToHsl, hslToHex, SCHEMES } from '../../lib/color-theory.js';
import { schemeHslTrackStyle } from '../../lib/hsl-slider-track.js';
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
 * Color controls, split by settings sections: Tone (Light | Gray | Dark) and
 * Color Scheme (base color, relationships, identity, intensity, overrides).
 */
export class ColorPanel extends StoreBoundElement {
  static properties = {
    /** When true, only Light | Gray | Dark controls are shown. */
    toneOnly: { type: Boolean, attribute: 'tone-only' },
    /** When true, excludes Tone and shows only color-scheme controls. */
    schemeOnly: { type: Boolean, attribute: 'scheme-only' },
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
      grid-template-columns: auto 106px 1fr;
      gap: 16px;
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
    .color-mode-switch {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.18);
    }
    .color-mode-option,
    .scheme-option {
      border: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font: 650 11px/1.2 system-ui, sans-serif;
    }
    .color-mode-option {
      padding: 8px;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
    }
    .color-mode-option:last-child {
      border-right: 0;
    }
    .color-mode-option[aria-pressed='true'],
    .scheme-option[aria-pressed='true'] {
      color: var(--gm-text, #f2eefc);
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
      box-shadow: inset 0 -2px 0 var(--gm-accent, #7c3aed);
    }
    .hsl-sliders {
      display: grid;
      grid-template-columns: repeat(2, 50px);
      gap: 6px;
      justify-content: center;
      min-height: 160px;
    }
    .hsl-slider {
      display: grid;
      grid-template-rows: 1fr auto;
      gap: 5px;
      justify-items: center;
      font-size: 9px;
      opacity: 0.9;
      color: var(--gm-muted, rgba(242, 238, 252, 0.7));
      font-weight: 700;
    }
    .hsl-slider-shell {
      position: relative;
      width: 50px;
      height: 150px;
    }
    .hsl-track {
      position: absolute;
      inset: 0;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 4px;
      background-image:
        linear-gradient(to top, var(--hsl-band-0-a), var(--hsl-band-0-b)),
        linear-gradient(to top, var(--hsl-band-1-a), var(--hsl-band-1-b)),
        linear-gradient(to top, var(--hsl-band-2-a), var(--hsl-band-2-b)),
        linear-gradient(to top, var(--hsl-band-3-a), var(--hsl-band-3-b));
      background-size: calc(100% / var(--hsl-band-count, 1)) 100%;
      background-position:
        calc(0 * 100% / var(--hsl-band-count, 1)) 0,
        calc(1 * 100% / var(--hsl-band-count, 1)) 0,
        calc(2 * 100% / var(--hsl-band-count, 1)) 0,
        calc(3 * 100% / var(--hsl-band-count, 1)) 0;
      background-repeat: no-repeat;
      pointer-events: none;
    }
    .hsl-slider input {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 150px;
      height: 50px;
      margin: 0;
      transform: translate(-50%, -50%) rotate(-90deg);
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
      border: 0;
      padding: 0;
      cursor: pointer;
    }
    .hsl-slider input::-webkit-slider-runnable-track {
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
      border: 0;
      height: 50px;
    }
    .hsl-slider input::-webkit-slider-thumb {
      appearance: none;
      -webkit-appearance: none;
      width: 10px;
      height: 48px;
      margin: 0;
      border: 1px solid rgba(255, 255, 255, 0.85);
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
      cursor: grab;
    }
    .scheme-options {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0 0 10px;
    }
    .scheme-option {
      padding: 6px 8px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }
    .grayscale-control {
      display: grid;
      gap: 8px;
      width: 100%;
    }
    .grayscale-control-header {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      opacity: 0.8;
    }
    .grayscale-track {
      height: 8px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 999px;
      background: linear-gradient(to right, #161616, #fff);
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
    this.schemeOnly = false;
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
    const colorEnabled = this.state?.global?.sections?.color === true;
    const hsl = hexToHsl(color.baseColor);
    const intensity = color.intensity ?? 100;
    const identityMode = color.identityMode || 'restyle';
    const overrides = color.overrides ?? {};

    if (!colorEnabled) {
      return html`
        ${this.schemeOnly ? null : toneControls}
        <div class="color-mode-switch" role="group" aria-label="Color mode">
          <button
            type="button"
            class="color-mode-option"
            aria-pressed="false"
            @click=${() => this._setColorMode(true)}
          >Color</button>
          <button
            type="button"
            class="color-mode-option"
            aria-pressed="true"
            @click=${() => this._setColorMode(false)}
          >Monochrome</button>
        </div>
        <label class="grayscale-control">
          <span class="grayscale-control-header">
            <span>Theme grayscale</span><output>${Math.round(hsl.l)}%</output>
          </span>
          <input
            type="range"
            min="8"
            max="92"
            step="1"
            .value=${String(Math.round(hsl.l))}
            @input=${(event) => this._setMonochromeLightness(event.target.value)}
          />
          <span class="grayscale-track" aria-hidden="true"></span>
        </label>
        <gmixer-color-scheme-scales monochrome active-scheme-only></gmixer-color-scheme-scales>
      `;
    }

    return html`
      ${this.schemeOnly ? null : toneControls}

      <div class="color-mode-switch" role="group" aria-label="Color mode">
        <button
          type="button"
          class="color-mode-option"
          aria-pressed=${colorEnabled}
          @click=${() => this._setColorMode(true)}
        >Color</button>
        <button
          type="button"
          class="color-mode-option"
          aria-pressed=${!colorEnabled}
          @click=${() => this._setColorMode(false)}
        >Monochrome</button>
      </div>

      <div class="color-selection-grid">
        <gmixer-color-wheel></gmixer-color-wheel>
        <div class="hsl-sliders" aria-label="Color adjustments">
          ${this._renderVerticalHslSlider(
            'S',
            'Saturation',
            hsl.s,
            0,
            100,
            's',
            color.schemeBaseColor || color.baseColor,
            color.scheme
          )}
          ${this._renderVerticalHslSlider(
            'L',
            'Lightness',
            hsl.l,
            8,
            92,
            'l',
            color.schemeBaseColor || color.baseColor,
            color.scheme
          )}
        </div>
        <div>
          <div class="scheme-options" role="group" aria-label="Color scheme">
            ${SCHEMES.filter((scheme) => scheme.id !== 'monochrome').map(
              (scheme) => html`
                <button
                  type="button"
                  class="scheme-option"
                  aria-pressed=${color.scheme === scheme.id}
                  @click=${() => this.updateGlobal({ color: { scheme: scheme.id } })}
                >${scheme.label}</button>
              `
            )}
          </div>
          <gmixer-color-scheme-scales active-scheme-only></gmixer-color-scheme-scales>
        </div>
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

  _setColorMode(enabled) {
    const color = this.state?.global?.color;
    if (!color) return;
    const hsl = hexToHsl(color.baseColor);
    this.updateGlobal({
      activeThemePackId: 'user-made',
      sections: { color: enabled },
      color: enabled
        ? {
            scheme: color.scheme === 'monochrome' ? 'analog' : color.scheme,
            baseColor: hslToHex({ ...hsl, s: Math.max(hsl.s, 70) }),
            schemeBaseColor: hslToHex({ ...hsl, s: Math.max(hsl.s, 70) }),
          }
        : {
            scheme: 'monochrome',
            baseColor: hslToHex({ h: hsl.h, s: 0, l: hsl.l }),
            schemeBaseColor: hslToHex({ h: hsl.h, s: 0, l: hsl.l }),
          },
    });
  }

  _setMonochromeLightness(value) {
    const color = this.state?.global?.color;
    if (!color) return;
    const hsl = hexToHsl(color.baseColor);
    this.updateGlobal({
      color: { baseColor: hslToHex({ h: hsl.h, s: 0, l: Number(value) }) },
    });
  }

  _setHsl(key, value) {
    const color = this.state?.global?.color;
    if (!color) return;
    const hsl = hexToHsl(color.baseColor);
    this.updateGlobal({ color: { baseColor: hslToHex({ ...hsl, [key]: Number(value) }) } });
  }

  _renderVerticalHslSlider(shortLabel, label, value, min, max, key, baseColor, scheme) {
    return html`
      <label class="hsl-slider">
        <span class="hsl-slider-shell">
          <span
            class="hsl-track"
            style=${schemeHslTrackStyle(baseColor, scheme, key)}
            aria-hidden="true"
          ></span>
          <input
            type="range"
            min=${min}
            max=${max}
            step="1"
            .value=${String(Math.round(value))}
            aria-label=${label}
            @input=${(event) => this._setHsl(key, event.target.value)}
          />
        </span>
        <span>${shortLabel}</span>
      </label>
    `;
  }
}

defineElement('gmixer-color-panel', ColorPanel);
