import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { isMasterThemingEnabled, toggleSiteTheming } from '../../state/site-enable.js';
import { defineElement } from '../../lib/define-element.js';

/** Master theming enable/disable for every tab, inset in the settings titlebar. */
export class SiteToggle extends StoreBoundElement {
  static properties = {
    ...StoreBoundElement.properties,
    _hostname: { state: true },
  };

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      height: 100%;
      min-width: 0;
    }

    button.switch {
      position: relative;
      display: inline-grid;
      grid-template-columns: 1fr 1fr;
      align-items: stretch;
      align-self: center;
      width: 72px;
      height: 28px;
      margin: 4pt;
      padding: 0;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.18));
      border-radius: 3px;
      background: rgba(0, 0, 0, 0.28);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.06),
        0 1px 0 rgba(0, 0, 0, 0.35);
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
      cursor: pointer;
      box-sizing: border-box;
      overflow: hidden;
      font: 9px/1 ui-monospace, monospace;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    button.switch:focus-visible {
      outline: 2px solid var(--gm-accent, #7c3aed);
      outline-offset: 1px;
    }

    button.switch[aria-checked='true'] {
      background: rgba(124, 58, 237, 0.22);
      border-color: rgba(167, 139, 250, 0.55);
    }

    .label {
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
      pointer-events: none;
      user-select: none;
    }

    .thumb {
      position: absolute;
      inset: 1px auto 1px 1px;
      width: calc(50% - 1px);
      border-radius: 2px;
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.42));
      box-shadow: inset 0 -1px 0 var(--gm-accent, #7c3aed);
      transition: transform 120ms ease;
      z-index: 0;
    }

    button.switch[aria-checked='true'] .thumb {
      transform: translateX(100%);
    }

    button.switch[aria-checked='true'] .label-on,
    button.switch[aria-checked='false'] .label-off {
      color: var(--gm-text, #f2eefc);
    }

    .host {
      display: flex;
      align-items: center;
      padding: 0 var(--gm-space-2, 16px) 0 8px;
      max-width: 18rem;
      overflow: hidden;
      font-size: 11px;
      font-weight: 400;
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
      font-family: ui-monospace, monospace;
      border-right: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      align-self: stretch;
    }

    .host-name {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .switch-shortcut {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      gap: 2px;
      margin-right: 4pt;
      font-size: 10px;
      letter-spacing: 0.02em;
      color: var(--gm-muted, rgba(242, 238, 252, 0.55));
    }

    .switch-shortcut kbd {
      display: inline-block;
      min-width: 18px;
      padding: 0 4px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-bottom-width: 2px;
      border-radius: 3px;
      background: rgba(255, 255, 255, 0.06);
      font: 9px/16px ui-monospace, monospace;
      text-align: center;
      color: var(--gm-text, #f2eefc);
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
    const enabled = isMasterThemingEnabled();

    return html`
      <button
        type="button"
        class="switch"
        role="switch"
        aria-checked=${enabled}
        aria-label=${enabled ? 'Disable gMixer theming on all tabs' : 'Enable gMixer theming on all tabs'}
        title=${`Toggle gMixer theming on all tabs (Alt+N)`}
        @click=${() => toggleSiteTheming()}
      >
        <span class="thumb" aria-hidden="true"></span>
        <span class="label label-off">Off</span>
        <span class="label label-on">On</span>
      </button>
      <span class="switch-shortcut" aria-hidden="true" title="Alt+N toggles theming on all tabs">
        <kbd>Alt</kbd>+<kbd>N</kbd>
      </span>
      <span class="host" title="Theming master applies to every tab">
        <span class="host-name">All tabs</span>
      </span>
    `;
  }
}

defineElement('gmixer-site-toggle', SiteToggle);
