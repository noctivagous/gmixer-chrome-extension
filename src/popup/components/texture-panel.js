import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { defineElement } from '../../lib/define-element.js';
import {
  TEXTURE_MODES,
  TEXTURE_GRID_STYLES,
  TEXTURE_DISTANCE_MIN,
  TEXTURE_DISTANCE_MAX,
  TEXTURE_ROTATION_MIN,
  TEXTURE_ROTATION_MAX,
  normalizeTexture,
  texturePreviewStyle,
} from '../../config/texture-catalog.js';

export class TexturePanel extends StoreBoundElement {
  static styles = css`
    :host {
      display: block;
    }

    .hint {
      margin: 0 0 10px;
      font-size: 10px;
      opacity: 0.65;
      line-height: 1.4;
    }

    .mode-segments {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      overflow: hidden;
      margin-bottom: 12px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.18);
    }

    .mode-segment {
      margin: 0;
      padding: 7px 10px;
      border: 0;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 0;
      background: transparent;
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
      font: 650 11px/1.2 system-ui, sans-serif;
      letter-spacing: 0.01em;
      cursor: pointer;
      box-sizing: border-box;
      text-align: center;
      white-space: nowrap;
    }

    .mode-segment:last-child {
      border-right: 0;
    }

    .mode-segment:hover {
      background: rgba(139, 92, 246, 0.1);
    }

    .mode-segment:focus-visible {
      z-index: 1;
      outline: 2px solid var(--gm-accent, #8b5cf6);
      outline-offset: -2px;
    }

    .mode-segment[aria-pressed='true'] {
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
      box-shadow: inset 0 -2px 0 var(--gm-accent, #7c3aed);
      color: var(--gm-text, #f2eefc);
    }

    .preview {
      position: relative;
      overflow: hidden;
      height: 72px;
      margin-bottom: 12px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.28);
    }

    .preview-fill {
      position: absolute;
      inset: -30%;
      background-repeat: repeat;
      transform: rotate(var(--gm-texture-rot, 0deg));
      transform-origin: center;
    }

    .preview-caption {
      position: absolute;
      right: 8px;
      bottom: 6px;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.45);
      font: 650 10px/1.2 system-ui, sans-serif;
      letter-spacing: 0.02em;
      opacity: 0.85;
    }

    .style-options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px;
      margin-bottom: 10px;
    }

    .style-option {
      margin: 0;
      padding: 8px 10px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      color: inherit;
      font: 650 11px/1.2 system-ui, sans-serif;
      cursor: pointer;
      text-align: left;
    }

    .style-option:hover {
      background: rgba(139, 92, 246, 0.1);
    }

    .style-option:focus-visible {
      outline: 2px solid var(--gm-accent, #8b5cf6);
      outline-offset: 1px;
    }

    .style-option[aria-pressed='true'] {
      border-color: var(--gm-accent, #8b5cf6);
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
      box-shadow: inset 0 -2px 0 var(--gm-accent, #7c3aed);
    }

    .param-fieldset {
      margin: 0 0 12px;
      padding: 10px 12px 8px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 6px;
      min-width: 0;
    }

    .param-fieldset legend {
      padding: 0 6px;
      font: 650 11px/1.2 system-ui, sans-serif;
      letter-spacing: 0.02em;
      color: var(--gm-text, #f2eefc);
    }

    .parameter {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      margin: 0 0 10px;
      font-size: 11px;
    }

    .parameter:last-child {
      margin-bottom: 2px;
    }

    .parameter label {
      display: grid;
      grid-template-columns: 92px minmax(0, 1fr);
      gap: 8px;
      align-items: center;
    }

    .parameter input[type='range'] {
      width: 100%;
      padding: 0;
      accent-color: var(--gm-accent, #8b5cf6);
      background: transparent;
    }

    .parameter output {
      min-width: 42px;
      text-align: right;
      opacity: 0.75;
      font-variant-numeric: tabular-nums;
    }
  `;

  updateGlobal(patch) {
    super.updateGlobal(patch);
    this.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true }));
  }

  /**
   * @param {Partial<import('../../config/texture-catalog.js').TextureSettings>} patch
   */
  _patchTexture(patch) {
    this.updateGlobal({
      activeThemePackId: 'user-made',
      sections: { texture: true },
      texture: patch,
    });
  }

  /**
   * @param {import('../../config/texture-catalog.js').TextureMode} mode
   */
  _setMode(mode) {
    this._patchTexture({ mode });
  }

  /**
   * @param {import('../../config/texture-catalog.js').TextureGridStyle} gridStyle
   */
  _setGridStyle(gridStyle) {
    this._patchTexture({ mode: 'grid', gridStyle });
  }

  /**
   * @param {'xDistance' | 'yDistance' | 'gridRotation'} key
   * @param {string|number} value
   */
  _setNumber(key, value) {
    this._patchTexture({ mode: 'grid', [key]: Number(value) });
  }

  render() {
    const texture = normalizeTexture(this.state?.global?.texture);
    const styleLabel =
      TEXTURE_GRID_STYLES.find((style) => style.id === texture.gridStyle)?.label ||
      texture.gridStyle;
    const previewCaption =
      texture.mode === 'none'
        ? 'Off'
        : texture.mode === 'noise'
          ? 'Noise'
          : styleLabel;
    const showGridControls = texture.mode === 'grid';

    return html`
      <p class="hint">
        Pick one texture mode. Grid spacing and rotation are shared across grid styles. Page paint
        comes in a later stage — this panel stores your choice.
      </p>

      <div class="mode-segments" role="group" aria-label="Texture mode">
        ${TEXTURE_MODES.map(
          (mode) => html`
            <button
              type="button"
              class="mode-segment"
              aria-pressed=${mode.id === texture.mode}
              @click=${() => this._setMode(mode.id)}
            >
              ${mode.label}
            </button>
          `
        )}
      </div>

      <div class="preview" aria-hidden="true">
        <div class="preview-fill" style=${texturePreviewStyle(texture)}></div>
        <span class="preview-caption">${previewCaption}</span>
      </div>

      ${showGridControls
        ? html`
            <fieldset class="param-fieldset">
              <legend>Grid style</legend>
              <div class="style-options" role="group" aria-label="Grid style">
                ${TEXTURE_GRID_STYLES.map(
                  (style) => html`
                    <button
                      type="button"
                      class="style-option"
                      aria-pressed=${style.id === texture.gridStyle}
                      @click=${() => this._setGridStyle(style.id)}
                    >
                      ${style.label}
                    </button>
                  `
                )}
              </div>
            </fieldset>

            <fieldset class="param-fieldset">
              <legend>Grid spacing &amp; rotation</legend>
              <div class="parameter">
                <label for="texture-x-distance">
                  <span>xDistance</span>
                  <input
                    id="texture-x-distance"
                    type="range"
                    min=${TEXTURE_DISTANCE_MIN}
                    max=${TEXTURE_DISTANCE_MAX}
                    step="1"
                    .value=${String(texture.xDistance)}
                    @input=${(e) => this._setNumber('xDistance', e.target.value)}
                  />
                </label>
                <output>${texture.xDistance}</output>
              </div>
              <div class="parameter">
                <label for="texture-y-distance">
                  <span>yDistance</span>
                  <input
                    id="texture-y-distance"
                    type="range"
                    min=${TEXTURE_DISTANCE_MIN}
                    max=${TEXTURE_DISTANCE_MAX}
                    step="1"
                    .value=${String(texture.yDistance)}
                    @input=${(e) => this._setNumber('yDistance', e.target.value)}
                  />
                </label>
                <output>${texture.yDistance}</output>
              </div>
              <div class="parameter">
                <label for="texture-grid-rotation">
                  <span>gridRotation</span>
                  <input
                    id="texture-grid-rotation"
                    type="range"
                    min=${TEXTURE_ROTATION_MIN}
                    max=${TEXTURE_ROTATION_MAX}
                    step="1"
                    .value=${String(texture.gridRotation)}
                    @input=${(e) => this._setNumber('gridRotation', e.target.value)}
                  />
                </label>
                <output>${texture.gridRotation}°</output>
              </div>
            </fieldset>
          `
        : texture.mode === 'noise'
          ? html`<p class="hint">Noise uses a fine grain wash. Grid unlocks spacing and style controls.</p>`
          : html`<p class="hint">Texture is off. Choose Noise or Grid to opt in.</p>`}
    `;
  }
}

defineElement('gmixer-texture-panel', TexturePanel);
