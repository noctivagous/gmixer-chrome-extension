import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { defineElement } from '../../lib/define-element.js';

export class EffectsPanel extends StoreBoundElement {
  static styles = css`
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
      margin-left: 20px;
      font-size: 11px;
      opacity: 0.8;
    }
  `;

  render() {
    const effects = this.state?.global?.effects;
    if (!effects) return html``;

    return html`
      <div class="toggle-row">
        <input
          type="checkbox"
          .checked=${effects.glow.enabled}
          @change=${(e) => this.updateGlobal({ effects: { glow: { enabled: e.target.checked } } })}
        />
        <label>Glow</label>
      </div>
      ${effects.glow.enabled
        ? html`
            <div class="sub toggle-row">
              <input
                type="checkbox"
                .checked=${effects.glow.animated}
                @change=${(e) => this.updateGlobal({ effects: { glow: { animated: e.target.checked } } })}
              />
              <label>Animated pulse</label>
            </div>
          `
        : html``}

      <div class="toggle-row">
        <input
          type="checkbox"
          .checked=${effects.flash.enabled}
          @change=${(e) => this.updateGlobal({ effects: { flash: { enabled: e.target.checked } } })}
        />
        <label>Flashing</label>
      </div>

      <div class="toggle-row">
        <input
          type="checkbox"
          .checked=${effects.cursor.enabled}
          @change=${(e) => this.updateGlobal({ effects: { cursor: { enabled: e.target.checked } } })}
        />
        <label>Cursor mods</label>
      </div>

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
