import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { FONT_CATEGORIES, FONTS } from '../../config/fonts.js';
import '../../settings/components/font-picker.js';
import { defineElement } from '../../lib/define-element.js';

const TARGETS = [
  { key: 'headers', label: 'Headers (h1-h6)' },
  { key: 'paragraph', label: 'Paragraph / body' },
  { key: 'captions', label: 'Captions' },
];

export class FontsPanel extends StoreBoundElement {
  static styles = css`
    .target {
      margin-bottom: var(--gm-baseline, 24px);
    }
    label {
      display: block;
      font-size: 12px;
      line-height: var(--gm-baseline, 24px);
      opacity: 0.8;
      margin-bottom: var(--gm-space-1, 8px);
    }
    .upload-hint {
      font-size: 11px;
      line-height: var(--gm-baseline, 24px);
      opacity: 0.6;
      margin: var(--gm-baseline, 24px) 0 0;
    }
  `;

  render() {
    const fonts = this.state?.global?.fonts;
    if (!fonts) return html``;

    return html`
      ${TARGETS.map(
        (target) => html`
          <div class="target">
            <label>${target.label}</label>
            <gmixer-font-picker
              .value=${fonts[target.key]?.fontId || 'system-body'}
              @change=${(e) =>
                this.updateGlobal({ fonts: { [target.key]: { fontId: e.detail.value } } })}
            ></gmixer-font-picker>
          </div>
        `
      )}
      <p class="upload-hint">
        ${FONTS.filter((f) => f.file).length} Peter Wiegel freeware fonts
        (${FONT_CATEGORIES.filter((c) => c.id !== 'system')
          .map((c) => c.label.split(' / ')[0].toLowerCase())
          .join(' / ')}). Each menu row renders in its own typeface. Custom upload planned —
        fonts.customFonts.
      </p>
    `;
  }
}

defineElement('gmixer-fonts-panel', FontsPanel);
