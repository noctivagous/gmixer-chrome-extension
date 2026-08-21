import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { store } from '../../state/store.js';
import { defineElement } from '../../lib/define-element.js';

/** Per-site enable/disable for the page hosting the in-page settings popover. */
export class SiteToggle extends StoreBoundElement {
  static properties = {
    ...StoreBoundElement.properties,
    _hostname: { state: true },
  };

  static styles = css`
    .row {
      display: inline-flex;
      align-items: center;
      gap: var(--gm-space-1, 8px);
      margin-left: var(--gm-space-2, 16px);
      font-size: 12px;
      line-height: var(--gm-baseline, 24px);
      font-weight: 400;
    }
    code {
      opacity: 0.75;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    try {
      this._hostname = location.hostname || null;
    } catch {
      this._hostname = null;
    }
  }

  render() {
    if (!this._hostname) return html``;
    const override = this.state?.perSite?.[this._hostname];
    const enabled = override?.enabled !== false;

    return html`
      <span class="row">
        <input
          type="checkbox"
          .checked=${enabled}
          @change=${(e) => this._toggle(e.target.checked)}
        />
        <label>On <code>${this._hostname}</code></label>
      </span>
    `;
  }

  _toggle(enabled) {
    store.update({ enabled }, { hostname: this._hostname });
  }
}

defineElement('gmixer-site-toggle', SiteToggle);
