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
    input[type='color'] {
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
