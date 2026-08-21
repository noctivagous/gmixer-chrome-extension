import { LitElement, html, css } from 'lit';
import { FONT_CATEGORIES, FONTS, getFontById } from '../../config/fonts.js';
import { defineElement } from '../../lib/define-element.js';

/**
 * Listbox font picker that renders each option in its own typeface.
 * Native <select>/<option> cannot do this reliably.
 */
export class FontPicker extends LitElement {
  static properties = {
    value: { type: String },
    open: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      position: relative;
    }
    .trigger {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--gm-space-2, 16px);
      min-height: var(--gm-baseline, 24px);
      padding: var(--gm-space-1, 8px) var(--gm-space-2, 16px);
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-radius: var(--gm-space-1, 8px);
      color: inherit;
      cursor: pointer;
      text-align: left;
      font-size: 14px;
      line-height: var(--gm-baseline, 24px);
    }
    .trigger:focus-visible {
      outline: 2px solid var(--gm-accent, #7c3aed);
      outline-offset: 2px;
    }
    .chevron {
      opacity: 0.55;
      font-size: 10px;
      flex-shrink: 0;
    }
    .list {
      position: absolute;
      z-index: 20;
      left: 0;
      right: 0;
      top: calc(100% + var(--gm-space-1, 8px));
      max-height: calc(var(--gm-baseline, 24px) * 12);
      overflow: auto;
      margin: 0;
      padding: var(--gm-space-1, 8px) 0;
      list-style: none;
      background: var(--gm-surface, #1c1826);
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-radius: var(--gm-space-1, 8px);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
    }
    .group {
      padding: var(--gm-space-1, 8px) var(--gm-space-2, 16px) 0;
      font-size: 11px;
      line-height: var(--gm-baseline, 24px);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.55;
    }
    .option {
      display: block;
      width: 100%;
      border: 0;
      background: transparent;
      color: inherit;
      text-align: left;
      padding: 0 var(--gm-space-2, 16px);
      min-height: var(--gm-baseline, 24px);
      line-height: var(--gm-baseline, 24px);
      font-size: 16px;
      cursor: pointer;
    }
    .option:hover,
    .option[aria-selected='true'] {
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
    }
  `;

  constructor() {
    super();
    this.value = '';
    this.open = false;
    this._onDocClick = (e) => {
      if (!this.open) return;
      if (!e.composedPath().includes(this)) this.open = false;
    };
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._onDocClick, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onDocClick, true);
  }

  render() {
    const current = getFontById(this.value) || FONTS[0];
    return html`
      <button
        type="button"
        class="trigger"
        aria-haspopup="listbox"
        aria-expanded=${this.open}
        @click=${() => (this.open = !this.open)}
      >
        <span style="font-family: ${current?.family || 'inherit'}">${current?.label || 'Font'}</span>
        <span class="chevron">${this.open ? '▴' : '▾'}</span>
      </button>
      ${this.open
        ? html`
            <ul class="list" role="listbox">
              ${FONT_CATEGORIES.map(
                (category) => html`
                  <li class="group">${category.label}</li>
                  ${FONTS.filter((f) => f.category === category.id).map(
                    (font) => html`
                      <li role="none">
                        <button
                          type="button"
                          class="option"
                          role="option"
                          aria-selected=${font.id === this.value}
                          style="font-family: ${font.family}"
                          @click=${() => this._pick(font.id)}
                        >
                          ${font.label}
                        </button>
                      </li>
                    `
                  )}
                `
              )}
            </ul>
          `
        : null}
    `;
  }

  _pick(id) {
    this.value = id;
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('change', { detail: { value: id }, bubbles: true, composed: true })
    );
  }
}

defineElement('gmixer-font-picker', FontPicker);
