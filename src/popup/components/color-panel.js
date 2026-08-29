import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { buildPalette, hexToHsl, hslToHex, SCHEMES } from '../../lib/color-theory.js';
import { autoAssignSwatches } from '../../lib/swatch-board.js';
import { schemeHslTrackStyle } from '../../lib/hsl-slider-track.js';
import { THEME_MODES } from '../../config/theme-packs.js';
import { defineElement } from '../../lib/define-element.js';

import './gmixer-color-wheel.js';
import './gmixer-color-scheme-scales.js';
import {
  colorModeIcon,
  colorPickerFlowArrow,
  colorSchemePickerStyles,
  pickerFieldsetLegend,
} from './color-scheme-picker-styles.js';

const IDENTITY_MODES = [
  { id: 'preserve', label: 'Preserve site identity' },
  { id: 'harmonize', label: 'Harmonize site identity' },
  { id: 'restyle', label: 'Fully restyle' },
];

const ROLES = [
  { id: 'background', label: 'BG:Primary · root' },
  { id: 'backgroundSecondary', label: 'BG:Secondary · sheet' },
  { id: 'surfaceGui', label: 'Surface: GUI' },
  { id: 'surfaceContainers', label: 'Surface: Containers' },
  { id: 'text', label: 'Text' },
  { id: 'muted', label: 'Muted' },
  { id: 'accent', label: 'Accent' },
  { id: 'link', label: 'Link' },
  { id: 'linkHover', label: 'Link hover' },
  { id: 'navLink', label: 'Nav link' },
  { id: 'navLinkHover', label: 'Nav hover' },
  { id: 'border', label: 'Border' },
  { id: 'focus', label: 'Focus' },
];

/**
 * Color controls, split by settings sections: Tone (Light | Gray | Dark) and
 * Color Scheme (hue ring at s=1.0/l=0.5, then S/L sliders, scheme, identity).
 */
export class ColorPanel extends StoreBoundElement {
  static properties = {
    /** When true, only Light | Gray | Dark controls are shown. */
    toneOnly: { type: Boolean, attribute: 'tone-only' },
    /** When true, excludes Tone and shows only color-scheme controls. */
    schemeOnly: { type: Boolean, attribute: 'scheme-only' },
  };

  static styles = [
    colorSchemePickerStyles,
    css`
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
    .color-picker-flow {
      margin-bottom: 16px;
    }
    .scheme-fieldset .scheme-option {
      min-width: 0;
      padding: 8px 6px;
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
  `,
  ];

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
          >${colorModeIcon('color')} Color</button>
          <button
            type="button"
            class="color-mode-option"
            aria-pressed="true"
            @click=${() => this._setColorMode(false)}
          >${colorModeIcon('monochrome')} Monochrome</button>
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
        >${colorModeIcon('color')} Color</button>
        <button
          type="button"
          class="color-mode-option"
          aria-pressed=${!colorEnabled}
          @click=${() => this._setColorMode(false)}
        >${colorModeIcon('monochrome')} Monochrome</button>
      </div>

      <div class="color-picker-flow" aria-label="Color scheme pipeline">
        <fieldset class="picker-fieldset picker-group-fieldset">
          <legend>Pick Base Colors</legend>
          <div class="color-picker-pipeline">
            <fieldset class="picker-fieldset scheme-fieldset">
              ${pickerFieldsetLegend(1, 'Scheme')}
              <div class="scheme-options" role="group" aria-label="1. Scheme">
                ${SCHEMES.filter((scheme) => scheme.id !== 'monochrome').map(
                  (scheme) => html`
                    <button
                      type="button"
                      class="scheme-option"
                      aria-pressed=${color.scheme === scheme.id}
                      @click=${() => this._setScheme(scheme.id)}
                    >${scheme.label}</button>
                  `
                )}
              </div>
            </fieldset>
            ${colorPickerFlowArrow()}
            <fieldset class="picker-fieldset hue-fieldset">
              ${pickerFieldsetLegend(2, 'Hue')}
              <gmixer-color-wheel></gmixer-color-wheel>
              <span class="hue-caption">Hue</span>
            </fieldset>
            ${colorPickerFlowArrow()}
            <fieldset class="picker-fieldset hsl-fieldset">
              ${pickerFieldsetLegend(3, 'Saturation & Lightness')}
              <div class="hsl-sliders" aria-label="Saturation and lightness">
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
            </fieldset>
          </div>
        </fieldset>
        <fieldset class="picker-fieldset picker-group-fieldset">
          <legend>Page Color Assignments</legend>
          <gmixer-color-scheme-scales active-scheme-only></gmixer-color-scheme-scales>
        </fieldset>
      </div>
      <p class="hint">
        Pipeline: scheme, then hue, then saturation and lightness. Surfaces are pinned to swatches;
        drag a label to reassign. Hue and S/L recolor the boxes without moving the pins.
      </p>

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

  _setScheme(schemeId) {
    const color = this.state?.global?.color;
    if (!color) return;
    const base = color.schemeBaseColor || color.baseColor;
    const mode = this.state?.global?.themeMode || 'dark';
    this.updateGlobal({
      color: {
        scheme: schemeId,
        swatchAssignments: autoAssignSwatches(base, schemeId, mode),
      },
    });
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
    const mode = this.state?.global?.themeMode || 'dark';
    if (enabled) {
      const scheme = color.scheme === 'monochrome' ? 'analog' : color.scheme;
      const baseColor = hslToHex({ ...hsl, s: Math.max(hsl.s, 70) });
      this.updateGlobal({
        activeThemePackId: 'user-made',
        sections: { color: true },
        color: {
          scheme,
          baseColor,
          schemeBaseColor: baseColor,
          swatchAssignments: autoAssignSwatches(baseColor, scheme, mode),
        },
      });
      return;
    }
    this.updateGlobal({
      activeThemePackId: 'user-made',
      sections: { color: false },
      color: {
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
    const newHex = hslToHex({ h: hsl.h, s: 0, l: Number(value) });
    this.updateGlobal({
      color: { baseColor: newHex, schemeBaseColor: newHex },
    });
  }

  _setHsl(key, value) {
    const color = this.state?.global?.color;
    if (!color) return;
    const hsl = hexToHsl(color.baseColor);
    const newHex = hslToHex({ ...hsl, [key]: Number(value) });
    // Pipeline step 3: S/L refine the hue-ring pick. Do not rewrite scheme
    // (step 1) or hue (step 2). Keep scheme-base aligned with the working color.
    this.updateGlobal({ color: { baseColor: newHex, schemeBaseColor: newHex } });
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
