import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { defineElement } from '../../lib/define-element.js';

// Everything here is off by default and gated behind the master switch —
// see product description.txt > FEATURE 7. No key is ever bound unless the
// user explicitly opts in here.
export class NavigationPanel extends StoreBoundElement {
  static styles = css`
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
    }
    label.toggle-row {
      margin: 0;
      font-size: 12px;
    }
    .toggle-row label {
      margin: 0;
      font-size: 12px;
    }
    .sub {
      margin-left: 20px;
      opacity: 0.85;
    }
    .sub[aria-disabled='true'] {
      opacity: 0.4;
      pointer-events: none;
    }
    p {
      font-size: 10px;
      opacity: 0.6;
    }
  `;

  render() {
    const nav = this.state?.global?.navigation;
    if (!nav) return html``;

    return html`
      <label class="toggle-row">
        <input
          type="checkbox"
          role="switch"
          aria-checked=${nav.enabled}
          .checked=${nav.enabled}
          @change=${(e) => this.updateGlobal({ navigation: { enabled: e.target.checked } })}
        />
        <strong>Enable navigation keys</strong>
      </label>
      <p>Imported from KeyPilot. Off by default — nothing below binds a key until this is checked.</p>
      <p>When enabled: hover shows an outline on clickable elements; <strong>F</strong> clicks,
        <strong>D</strong> goes back, <strong>R</strong> goes forward. Keys are ignored while typing in fields.</p>

      <div class="sub" aria-disabled=${!nav.enabled}>
        <label class="toggle-row">
          <input
            type="checkbox"
            role="switch"
            aria-checked=${nav.clickElement}
            .checked=${nav.clickElement}
            @change=${(e) => this.updateGlobal({ navigation: { clickElement: e.target.checked } })}
          />
          Click Element (F)
        </label>
        <label class="toggle-row">
          <input
            type="checkbox"
            role="switch"
            aria-checked=${nav.back}
            .checked=${nav.back}
            @change=${(e) => this.updateGlobal({ navigation: { back: e.target.checked } })}
          />
          Back (D)
        </label>
        <label class="toggle-row">
          <input
            type="checkbox"
            role="switch"
            aria-checked=${nav.forward}
            .checked=${nav.forward}
            @change=${(e) => this.updateGlobal({ navigation: { forward: e.target.checked } })}
          />
          Forward (R)
        </label>
        <label class="toggle-row">
          <input
            type="checkbox"
            role="switch"
            aria-checked=${nav.hoverOutlineAnimated}
            .checked=${nav.hoverOutlineAnimated}
            @change=${(e) =>
              this.updateGlobal({ navigation: { hoverOutlineAnimated: e.target.checked } })}
          />
          Animated hover outline
        </label>
      </div>
    `;
  }
}

defineElement('gmixer-navigation-panel', NavigationPanel);
