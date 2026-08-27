import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { defineElement } from '../../lib/define-element.js';
import {
  EFFECT_CATEGORIES,
  anyCategoryUsesGlow,
  normalizeEffects,
} from '../../config/effects-catalog.js';

export class EffectsPanel extends StoreBoundElement {
  static styles = css`
    .category {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 1.2fr;
      gap: 8px;
      align-items: center;
      margin-bottom: 10px;
    }
    .category span {
      font-size: 12px;
    }
    select,
    input[type='color'],
    input[type='range'] {
      width: 100%;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: inherit;
      border-radius: 4px;
      padding: 4px;
    }
    input[type='range'] {
      padding: 0;
      accent-color: var(--gm-accent, #8b5cf6);
    }
    .parameter {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      margin: -2px 0 10px 4px;
      font-size: 11px;
    }
    .parameter label {
      display: grid;
      grid-template-columns: 92px minmax(0, 1fr);
      gap: 8px;
      align-items: center;
    }
    .parameter output {
      min-width: 42px;
      text-align: right;
      opacity: 0.75;
      font-variant-numeric: tabular-nums;
    }
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
    }
    .toggle-row label {
      margin: 0;
      font-size: 12px;
    }
    .sub {
      margin-left: 4px;
      font-size: 11px;
      opacity: 0.85;
    }
    .divider {
      border: 0;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      margin: 14px 0 12px;
    }
    .hint {
      margin: 0 0 10px;
      font-size: 10px;
      opacity: 0.65;
      line-height: 1.4;
    }
  `;

  render() {
    const raw = this.state?.global?.effects;
    if (!raw) return html``;
    const effects = normalizeEffects(raw);
    const showGlowOptions = anyCategoryUsesGlow(effects);
    const showPanScanOptions = effects.categories.images.effect === 'pan-scan';
    const updatePanScan = (key, value) =>
      this.updateGlobal({
        effects: {
          panScan: {
            [key]: key === 'loop' || key === 'motion' ? value : Number(value),
          },
        },
      });

    return html`
      <p class="hint">Pick one effect per category. Cursor and background motion stay page-wide.</p>

      ${Object.entries(EFFECT_CATEGORIES).map(([categoryId, meta]) => {
        const current = effects.categories[categoryId]?.effect || 'none';
        return html`
          <div class="category">
            <span>${meta.label}</span>
            <select
              aria-label=${`${meta.label} effect`}
              @change=${(e) =>
                this.updateGlobal({
                  effects: {
                    categories: {
                      [categoryId]: { effect: e.target.value },
                    },
                  },
                })}
            >
              ${meta.effects.map(
                (effect) => html`
                  <option value=${effect.id} ?selected=${effect.id === current}>
                    ${effect.label}
                  </option>
                `
              )}
            </select>
          </div>
        `;
      })}

      ${showPanScanOptions
        ? html`
            <div class="parameter">
              <label for="pan-scan-speed">
                <span>Speed</span>
                <input
                  id="pan-scan-speed"
                  type="range"
                  min="4"
                  max="40"
                  step="1"
                  .value=${String(effects.panScan.speed)}
                  @input=${(e) => updatePanScan('speed', e.target.value)}
                />
              </label>
              <output>${effects.panScan.speed}s</output>
            </div>
            <div class="parameter">
              <label for="pan-scan-zoom">
                <span>Zoom</span>
                <input
                  id="pan-scan-zoom"
                  type="range"
                  min="4"
                  max="40"
                  step="1"
                  .value=${String(effects.panScan.zoom)}
                  @input=${(e) => updatePanScan('zoom', e.target.value)}
                />
              </label>
              <output>${effects.panScan.zoom}%</output>
            </div>
            <div class="parameter">
              <label for="pan-scan-distance">
                <span>Pan distance</span>
                <input
                  id="pan-scan-distance"
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  .value=${String(effects.panScan.distance)}
                  @input=${(e) => updatePanScan('distance', e.target.value)}
                />
              </label>
              <output>${effects.panScan.distance}%</output>
            </div>
            <div class="parameter">
              <label for="pan-scan-motion">
                <span>Variation</span>
                <select
                  id="pan-scan-motion"
                  .value=${effects.panScan.motion}
                  @change=${(e) => updatePanScan('motion', e.target.value)}
                >
                  <option value="scan">Scan (2D)</option>
                  <option value="pan">Pan (horizontal)</option>
                  <option value="tilt">Tilt (vertical)</option>
                </select>
              </label>
              <output></output>
            </div>
            <div class="parameter">
              <label for="pan-scan-loop">
                <span>Loop</span>
                <select
                  id="pan-scan-loop"
                  .value=${effects.panScan.loop}
                  @change=${(e) => updatePanScan('loop', e.target.value)}
                >
                  <option value="fade">Cross dissolve</option>
                  <option value="oscillate">Oscillate</option>
                </select>
              </label>
              <output></output>
            </div>
          `
        : html``}

      ${showGlowOptions
        ? html`
            <div class="sub toggle-row">
              <input
                type="checkbox"
                .checked=${effects.glow.animated}
                @change=${(e) =>
                  this.updateGlobal({ effects: { glow: { animated: e.target.checked } } })}
              />
              <label>Animated glow pulse</label>
            </div>
            <div class="sub toggle-row">
              <label for="glow-color">Glow color</label>
              <input
                id="glow-color"
                type="color"
                .value=${effects.glow.color || '#a08a7f'}
                @change=${(e) =>
                  this.updateGlobal({ effects: { glow: { color: e.target.value } } })}
              />
            </div>
          `
        : html``}

      <hr class="divider" />

      <div class="toggle-row">
        <input
          type="checkbox"
          .checked=${effects.cursor.enabled}
          @change=${(e) => this.updateGlobal({ effects: { cursor: { enabled: e.target.checked } } })}
        />
        <label>Cursor mods</label>
      </div>
      ${effects.cursor.enabled
        ? html`
            <div class="sub toggle-row">
              <label for="cursor-style">Cursor style</label>
              <select
                id="cursor-style"
                .value=${effects.cursor.style || 'default'}
                @change=${(e) =>
                  this.updateGlobal({ effects: { cursor: { style: e.target.value } } })}
              >
                <option value="default">Default</option>
                <option value="pointer">Pointer</option>
                <option value="crosshair">Crosshair</option>
                <option value="help">Help</option>
                <option value="wait">Wait</option>
              </select>
            </div>
          `
        : html``}

      <div class="toggle-row">
        <input
          type="checkbox"
          .checked=${effects.backgroundMotion.enabled}
          @change=${(e) =>
            this.updateGlobal({ effects: { backgroundMotion: { enabled: e.target.checked } } })}
        />
        <label>Animated background motion</label>
      </div>
    `;
  }
}

defineElement('gmixer-effects-panel', EffectsPanel);
