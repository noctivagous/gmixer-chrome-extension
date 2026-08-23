import { html, css } from 'lit';
import { StoreBoundElement } from '../../popup/components/store-bound-element.js';
import { FONT_CATEGORIES, FONTS, getFontById } from '../../config/fonts.js';
import { isFontSuitableForTarget, unsuitableReason } from '../../config/font-heuristics.js';
import { defineElement } from '../../lib/define-element.js';

const SAMPLE_DEFAULT = 'The quick brown fox jumps over the lazy dog';
const APPLY_TARGETS = [
  { key: 'headers', label: 'Headers' },
  { key: 'paragraph', label: 'Body' },
  { key: 'captions', label: 'Captions' },
];

/**
 * Font Book–style browser: browse the catalog by category, preview sample
 * text in each face, and assign a pick to a typography target.
 */
export class FontBrowser extends StoreBoundElement {
  static properties = {
    _category: { state: true },
    _query: { state: true },
    _sample: { state: true },
    _size: { state: true },
    _selectedId: { state: true },
    _roleFilter: { state: true },
    _showAll: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      max-width: none !important;
    }

    .toolbar {
      display: grid;
      gap: var(--gm-space-2, 16px);
      margin-bottom: var(--gm-baseline, 24px);
    }

    label {
      display: block;
      font-size: 11px;
      line-height: var(--gm-baseline, 24px);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.55;
    }

    .field {
      display: grid;
      gap: var(--gm-space-1, 8px);
    }

    input[type='search'],
    input[type='text'] {
      width: 100%;
      box-sizing: border-box;
      min-height: var(--gm-baseline, 24px);
      padding: var(--gm-space-1, 8px) var(--gm-space-2, 16px);
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-radius: var(--gm-space-1, 8px);
      background: rgba(255, 255, 255, 0.06);
      color: inherit;
      font: inherit;
    }

    input:focus-visible {
      outline: 2px solid var(--gm-accent, #7c3aed);
      outline-offset: 2px;
    }

    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: var(--gm-space-2, 16px);
    }

    .row .field {
      flex: 1 1 12rem;
      min-width: 0;
    }

    .size-field {
      flex: 0 0 10rem;
    }

    input[type='range'] {
      width: 100%;
      margin: 0;
      padding: 0;
      accent-color: var(--gm-accent, #7c3aed);
    }

    .size-value {
      font-size: 12px;
      line-height: var(--gm-baseline, 24px);
      opacity: 0.7;
    }

    .cats {
      display: flex;
      flex-wrap: wrap;
      gap: var(--gm-space-1, 8px);
    }

    .cats button {
      min-height: var(--gm-baseline, 24px);
      padding: 0 var(--gm-space-2, 16px);
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-radius: var(--gm-space-1, 8px);
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .cats button[aria-pressed='true'] {
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
      border-color: var(--gm-accent, #7c3aed);
    }

    .detail {
      display: grid;
      gap: var(--gm-space-2, 16px);
      margin-bottom: var(--gm-baseline, 24px);
      padding: var(--gm-space-2, 16px);
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      border-radius: var(--gm-space-1, 8px);
      background: rgba(255, 255, 255, 0.03);
    }

    .detail-meta {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--gm-space-1, 8px);
    }

    .detail-name {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      line-height: var(--gm-baseline, 24px);
    }

    .detail-cat {
      font-size: 12px;
      line-height: var(--gm-baseline, 24px);
      opacity: 0.6;
    }

    .detail-preview {
      margin: 0;
      line-height: 1.35;
      word-break: break-word;
    }

    .apply {
      display: flex;
      flex-wrap: wrap;
      gap: var(--gm-space-1, 8px);
    }

    .apply button {
      min-height: var(--gm-baseline, 24px);
      padding: 0 var(--gm-space-2, 16px);
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-radius: var(--gm-space-1, 8px);
      background: rgba(255, 255, 255, 0.06);
      color: inherit;
      font: inherit;
      cursor: pointer;
    }

    .apply button[data-active='true'] {
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
      border-color: var(--gm-accent, #7c3aed);
    }

    .apply button[data-soft='true'] {
      opacity: 0.55;
    }

    .badge {
      display: inline-block;
      margin-left: var(--gm-space-1, 8px);
      padding: 0 6px;
      border-radius: 4px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.2));
      font-size: 10px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.75;
      font-family: system-ui, sans-serif;
    }

    .show-all {
      display: flex;
      align-items: center;
      gap: var(--gm-space-1, 8px);
      font-size: 12px;
      line-height: var(--gm-baseline, 24px);
      opacity: 0.85;
      cursor: pointer;
      text-transform: none;
      letter-spacing: normal;
    }

    .show-all input {
      margin: 0;
      accent-color: var(--gm-accent, #7c3aed);
    }

    .list {
      display: grid;
      gap: var(--gm-space-1, 8px);
    }

    .specimen {
      display: grid;
      gap: var(--gm-space-1, 8px);
      width: 100%;
      text-align: left;
      padding: var(--gm-space-2, 16px);
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      border-radius: var(--gm-space-1, 8px);
      background: transparent;
      color: inherit;
      cursor: pointer;
    }

    .specimen:hover,
    .specimen[aria-selected='true'] {
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
      border-color: var(--gm-accent, #7c3aed);
    }

    .specimen:focus-visible {
      outline: 2px solid var(--gm-accent, #7c3aed);
      outline-offset: 2px;
    }

    .specimen-meta {
      display: flex;
      justify-content: space-between;
      gap: var(--gm-space-2, 16px);
      font-size: 11px;
      line-height: var(--gm-baseline, 24px);
      letter-spacing: 0.03em;
      text-transform: uppercase;
      opacity: 0.55;
      font-family: system-ui, sans-serif;
    }

    .specimen-sample {
      margin: 0;
      line-height: 1.35;
      word-break: break-word;
    }

    .empty {
      margin: var(--gm-baseline, 24px) 0 0;
      font-size: 13px;
      line-height: var(--gm-baseline, 24px);
      opacity: 0.6;
    }
  `;

  constructor() {
    super();
    this._category = 'all';
    this._query = '';
    this._sample = SAMPLE_DEFAULT;
    this._size = 28;
    this._selectedId = '';
    this._roleFilter = 'all';
    this._showAll = false;
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this._selectedId) {
      const fonts = this.state?.global?.fonts;
      this._selectedId = fonts?.headers?.fontId || FONTS.find((f) => f.file)?.id || FONTS[0]?.id || '';
    }
  }

  _filteredFonts() {
    const q = this._query.trim().toLowerCase();
    return FONTS.filter((font) => {
      if (this._category !== 'all' && font.category !== this._category) return false;
      if (this._roleFilter !== 'all') {
        if (!isFontSuitableForTarget(font, this._roleFilter, { showAll: this._showAll })) {
          return false;
        }
      }
      if (!q) return true;
      return (
        font.label.toLowerCase().includes(q) ||
        font.id.toLowerCase().includes(q) ||
        font.usage?.toLowerCase().includes(q)
      );
    });
  }

  _categoryLabel(id) {
    return FONT_CATEGORIES.find((c) => c.id === id)?.label ?? id;
  }

  _usageLabel(font) {
    const bits = [font.usage];
    if (font.longForm) bits.push('long-form');
    if (font.pairGroup) bits.push(font.pairGroup);
    if (font.textSafe === false) bits.push('ornament');
    return bits.join(' · ');
  }

  _apply(targetKey) {
    if (!this._selectedId) return;
    this.updateGlobal({ fonts: { [targetKey]: { fontId: this._selectedId } } });
  }

  _isApplied(targetKey, fontId) {
    return this.state?.global?.fonts?.[targetKey]?.fontId === fontId;
  }

  render() {
    const fonts = this._filteredFonts();
    const selected = getFontById(this._selectedId) || fonts[0] || FONTS[0];
    const sample = this._sample.trim() || SAMPLE_DEFAULT;
    const size = `${this._size}px`;

    return html`
      <div class="toolbar">
        <div class="field">
          <label for="gm-font-sample">Sample text</label>
          <input
            id="gm-font-sample"
            type="text"
            .value=${this._sample}
            @input=${(e) => (this._sample = e.target.value)}
          />
        </div>
        <div class="row">
          <div class="field">
            <label for="gm-font-search">Search</label>
            <input
              id="gm-font-search"
              type="search"
              placeholder="Filter by name…"
              .value=${this._query}
              @input=${(e) => (this._query = e.target.value)}
            />
          </div>
          <div class="field size-field">
            <label for="gm-font-size">
              Size <span class="size-value">${this._size}px</span>
            </label>
            <input
              id="gm-font-size"
              type="range"
              min="14"
              max="64"
              step="1"
              .value=${String(this._size)}
              @input=${(e) => (this._size = Number(e.target.value))}
            />
          </div>
        </div>
        <div class="field">
          <label>Suitable for</label>
          <div class="cats" role="group" aria-label="Role filter">
            <button
              type="button"
              aria-pressed=${this._roleFilter === 'all'}
              @click=${() => (this._roleFilter = 'all')}
            >
              Any role
            </button>
            ${APPLY_TARGETS.map(
              (t) => html`
                <button
                  type="button"
                  aria-pressed=${this._roleFilter === t.key}
                  @click=${() => (this._roleFilter = t.key)}
                >
                  ${t.label}
                </button>
              `
            )}
          </div>
          <label class="show-all">
            <input
              type="checkbox"
              .checked=${this._showAll}
              @change=${(e) => (this._showAll = e.target.checked)}
            />
            Show all fonts (ignore role filter)
          </label>
        </div>
        <div class="field">
          <label>Category</label>
          <div class="cats" role="group" aria-label="Font categories">
            <button
              type="button"
              aria-pressed=${this._category === 'all'}
              @click=${() => (this._category = 'all')}
            >
              All
            </button>
            ${FONT_CATEGORIES.map(
              (cat) => html`
                <button
                  type="button"
                  aria-pressed=${this._category === cat.id}
                  @click=${() => (this._category = cat.id)}
                >
                  ${cat.label}
                </button>
              `
            )}
          </div>
        </div>
      </div>

      ${selected
        ? html`
            <section class="detail" aria-label="Selected font">
              <div class="detail-meta">
                <h2 class="detail-name">
                  ${selected.label}
                  <span class="badge">${this._usageLabel(selected)}</span>
                </h2>
                <span class="detail-cat">${this._categoryLabel(selected.category)}</span>
              </div>
              <p class="detail-preview" style="font-family: ${selected.family}; font-size: ${size}">
                ${sample}
              </p>
              <div class="apply">
                ${APPLY_TARGETS.map((t) => {
                  const ok = isFontSuitableForTarget(selected, t.key, { showAll: false });
                  const reason = ok ? '' : unsuitableReason(selected, t.key);
                  return html`
                    <button
                      type="button"
                      data-active=${this._isApplied(t.key, selected.id)}
                      data-soft=${!ok}
                      title=${reason || `Use for ${t.label}`}
                      @click=${() => this._apply(t.key)}
                    >
                      Use for ${t.label}${ok ? '' : ' *'}
                    </button>
                  `;
                })}
              </div>
            </section>
          `
        : null}

      ${fonts.length === 0
        ? html`<p class="empty">No fonts match this filter.</p>`
        : html`
            <div class="list" role="listbox" aria-label="Font specimens">
              ${fonts.map(
                (font) => html`
                  <button
                    type="button"
                    class="specimen"
                    role="option"
                    aria-selected=${font.id === selected?.id}
                    @click=${() => (this._selectedId = font.id)}
                  >
                    <div class="specimen-meta">
                      <span>${font.label} · ${font.usage}${font.longForm ? ' · long-form' : ''}</span>
                      <span>${this._categoryLabel(font.category)}</span>
                    </div>
                    <p
                      class="specimen-sample"
                      style="font-family: ${font.family}; font-size: ${size}"
                    >
                      ${sample}
                    </p>
                  </button>
                `
              )}
            </div>
          `}
    `;
  }
}

defineElement('gmixer-font-browser', FontBrowser);
