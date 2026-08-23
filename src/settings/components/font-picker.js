import { LitElement, html, css } from 'lit';
import { FONT_CATEGORIES, getFontById, getFontsForTarget } from '../../config/fonts.js';
import { defineElement } from '../../lib/define-element.js';

/**
 * Listbox font picker that renders each option in its own typeface.
 * Native <select>/<option> cannot do this reliably.
 *
 * Pass `target` (headers | subheadings | paragraph | ui | code | captions)
 * to apply role-policy filtering; pair with `showAll` to list every face.
 */
export class FontPicker extends LitElement {
  static properties = {
    value: { type: String },
    /** @type {'headers'|'subheadings'|'paragraph'|'ui'|'code'|'captions'|''} */
    target: { type: String },
    showAll: { type: Boolean, attribute: 'show-all' },
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
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--gm-space-2, 16px);
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
    .option-meta {
      flex-shrink: 0;
      font-size: 10px;
      line-height: var(--gm-baseline, 24px);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.55;
      font-family: system-ui, sans-serif;
    }
    .trigger-meta {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 0;
      min-width: 0;
    }
    .trigger-usage {
      font-size: 10px;
      line-height: var(--gm-baseline, 24px);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.55;
      font-family: system-ui, sans-serif;
    }
    .empty {
      padding: var(--gm-space-1, 8px) var(--gm-space-2, 16px);
      font-size: 12px;
      opacity: 0.6;
    }
  `;

  constructor() {
    super();
    this.value = '';
    this.target = '';
    this.showAll = false;
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

  _fonts() {
    if (this.target) {
      return getFontsForTarget(this.target, { showAll: this.showAll });
    }
    return getFontsForTarget('paragraph', { showAll: true });
  }

  _usageBits(font) {
    if (!font) return '';
    const bits = [font.usage];
    if (font.longForm) bits.push('long-form');
    return bits.join(' · ');
  }

  render() {
    const fonts = this._fonts();
    const current = getFontById(this.value) || fonts[0];
    const byCategory = FONT_CATEGORIES.map((category) => ({
      category,
      fonts: fonts.filter((f) => f.category === category.id),
    })).filter((g) => g.fonts.length > 0);

    return html`
      <button
        type="button"
        class="trigger"
        aria-haspopup="listbox"
        aria-expanded=${this.open}
        @click=${() => (this.open = !this.open)}
      >
        <span class="trigger-meta">
          <span style="font-family: ${current?.family || 'inherit'}">${current?.label || 'Font'}</span>
          ${current?.usage
            ? html`<span class="trigger-usage">${this._usageBits(current)}</span>`
            : null}
        </span>
        <span class="chevron">${this.open ? '▴' : '▾'}</span>
      </button>
      ${this.open
        ? html`
            <ul class="list" role="listbox">
              ${byCategory.length === 0
                ? html`<li class="empty">No fonts for this role — enable Show all.</li>`
                : byCategory.map(
                    ({ category, fonts: groupFonts }) => html`
                      <li class="group">${category.label}</li>
                      ${groupFonts.map(
                        (font) => html`
                          <li role="none">
                            <button
                              type="button"
                              class="option"
                              role="option"
                              aria-selected=${font.id === this.value}
                              @click=${() => this._pick(font.id)}
                            >
                              <span style="font-family: ${font.family}">${font.label}</span>
                              <span class="option-meta">${this._usageBits(font)}</span>
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
