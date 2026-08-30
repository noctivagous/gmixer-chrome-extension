import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { FONT_CATEGORIES, FONTS, getFontById, getFontsForTarget } from '../../config/fonts.js';
import { isFontSuitableForTarget, unsuitableReason } from '../../config/font-heuristics.js';
import '../../settings/components/font-picker.js';
import { defineElement } from '../../lib/define-element.js';
import {
  HOVER_LINK_EVENT,
  HoverLinkOverlay,
  emitHoverLink,
  previewElForFontSlot,
} from '../../lib/hover-link.js';

const HEADING_TARGETS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map((tag) => ({
  key: tag,
  label: tag.toUpperCase(),
  hint: tag === 'h1' ? 'Primary heading · display / both' : 'Heading level · display / both',
}));

/** Hidden for this release: bulk-select headings and apply one shared face. */
const SHOW_HEADING_GROUPS = false;

const TARGETS = [
  {
    key: 'paragraph',
    label: 'Paragraph / body',
    hint: 'Prefers text · both that are long-form safe',
  },
  {
    key: 'ui',
    label: 'UI chrome (buttons, nav, forms)',
    hint: 'Text · both — kept separate so controls don\u2019t inherit body copy',
  },
  {
    key: 'code',
    label: 'Code',
    hint: 'Sans/Technical · System · Typewriter — monospace-adjacent only',
  },
  {
    key: 'captions',
    label: 'Captions',
    hint: 'Text · both, or script / typewriter / display',
  },
];

function fontSlotKey(targetKey) {
  return /^h[1-6]$/.test(targetKey) ? `headings.${targetKey}` : targetKey;
}

export class FontsPanel extends StoreBoundElement {
  static properties = {
    _showAll: { state: true },
    _selectedHeadings: { state: true },
    _linkedSlot: { state: true },
  };

  static styles = css`
    .intro {
      margin: 0 0 var(--gm-baseline, 24px);
      font-size: 12px;
      line-height: var(--gm-baseline, 24px);
      opacity: 0.75;
    }

    .show-all {
      display: flex;
      align-items: center;
      gap: var(--gm-space-1, 8px);
      margin-bottom: var(--gm-baseline, 24px);
      font-size: 12px;
      line-height: var(--gm-baseline, 24px);
      opacity: 0.85;
      cursor: pointer;
    }

    .show-all input {
      margin: 0;
      accent-color: var(--gm-accent, #7c3aed);
    }

    .target {
      margin: 0 0 var(--gm-baseline, 24px);
      min-width: 0;
      padding: 8px 10px 10px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.18);
      box-sizing: border-box;
      outline: 1px solid transparent;
      outline-offset: 2px;
      transition: outline-color 0.12s ease;
    }

    .target legend {
      display: inline-flex;
      align-items: center;
      padding: 0 6px;
      color: var(--gm-text, #f2eefc);
      font: 650 11px/1.2 system-ui, sans-serif;
      letter-spacing: 0.02em;
    }

    .target[data-linked='true'],
    .heading-check[data-linked='true'] {
      outline-color: rgba(196, 181, 253, 0.75);
    }

    .headers-group {
      margin: 0 0 var(--gm-baseline, 24px);
      min-width: 0;
      padding: 8px 10px 2px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.03);
      box-sizing: border-box;
    }

    .headers-group > legend {
      display: inline-flex;
      align-items: center;
      padding: 0 6px;
      color: var(--gm-text, #f2eefc);
      font: 650 11px/1.2 system-ui, sans-serif;
      letter-spacing: 0.04em;
      text-transform: lowercase;
    }

    .headers-group > .target {
      margin-bottom: var(--gm-space-2, 16px);
    }

    .headers-group > .target:last-of-type {
      margin-bottom: var(--gm-space-1, 8px);
    }

    .heading-tools {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--gm-space-1, 8px);
      margin: 0 0 var(--gm-baseline, 24px);
      padding: var(--gm-space-1, 8px);
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-radius: var(--gm-space-1, 8px);
      background: rgba(255, 255, 255, 0.04);
    }

    .heading-tools-label {
      flex: 1 0 100%;
      margin: 0;
      font-size: 11px;
      line-height: var(--gm-baseline, 24px);
      opacity: 0.7;
    }

    .heading-check {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      line-height: var(--gm-baseline, 24px);
      cursor: pointer;
      outline: 1px solid transparent;
      outline-offset: 2px;
      border-radius: 4px;
    }

    .heading-check input {
      margin: 0;
      accent-color: var(--gm-accent, #7c3aed);
    }

    .heading-tools gmixer-font-picker {
      flex: 1 1 180px;
      min-width: 160px;
    }

    .target-hint {
      margin: 0 0 var(--gm-space-1, 8px);
      font-size: 11px;
      line-height: var(--gm-baseline, 24px);
      opacity: 0.55;
    }

    .meta {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--gm-space-1, 8px);
      margin-top: var(--gm-space-1, 8px);
      font-size: 11px;
      line-height: var(--gm-baseline, 24px);
    }

    .badge {
      display: inline-block;
      padding: 0 6px;
      border-radius: 4px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.2));
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.8;
      font-family: system-ui, sans-serif;
    }

    .count {
      opacity: 0.55;
    }

    .warn {
      color: #f0c674;
      opacity: 0.95;
    }

    .upload-hint {
      font-size: 11px;
      line-height: var(--gm-baseline, 24px);
      opacity: 0.6;
      margin: var(--gm-baseline, 24px) 0 0;
    }
  `;

  constructor() {
    super();
    this._showAll = false;
    this._selectedHeadings = new Set();
    this._linkedSlot = null;
    this._hoverLink = null;
    this._onHoverLink = this._onHoverLink.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this._hoverLink = new HoverLinkOverlay({
      kind: 'font-slot',
      findControl: (id) =>
        this.renderRoot.querySelector(`.target[data-gmixer-font-slot="${CSS.escape(id)}"]`) ||
        this.renderRoot.querySelector(`[data-gmixer-font-slot="${CSS.escape(id)}"]`),
      findPreview: (id) => previewElForFontSlot(this, id),
    });
    window.addEventListener(HOVER_LINK_EVENT, this._onHoverLink);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener(HOVER_LINK_EVENT, this._onHoverLink);
    this._hoverLink?.destroy();
    this._hoverLink = null;
    emitHoverLink({ kind: 'font-slot', id: null, source: 'control' });
  }

  _hoverSlot(slot, on) {
    if (on) {
      this._linkedSlot = slot;
      emitHoverLink({ kind: 'font-slot', id: slot, source: 'control' });
      return;
    }
    if (this._linkedSlot === slot) {
      this._linkedSlot = null;
      emitHoverLink({ kind: 'font-slot', id: null, source: 'control' });
    }
  }

  _onHoverLink(event) {
    if (event.detail?.kind !== 'font-slot') return;
    if (event.detail?.source !== 'preview') return;
    this._linkedSlot = event.detail.id || null;
  }

  _usageLabel(font) {
    if (!font) return '';
    const bits = [font.usage];
    if (font.longForm) bits.push('long-form');
    if (font.pairGroup) bits.push(font.pairGroup);
    if (font.textSafe === false) bits.push('ornament');
    return bits.join(' · ');
  }

  render() {
    const fonts = this.state?.global?.fonts;
    if (!fonts) return html``;

    const total = FONTS.length;

    return html`
      <p class="intro">
        Customize every heading level independently. UI chrome, body, code, and captions remain
        separate. Each role lists faces suited to it (display vs body heuristics). Enable Show all
        to force any typeface onto any role.
      </p>
      <label class="show-all">
        <input
          type="checkbox"
          .checked=${this._showAll}
          @change=${(e) => (this._showAll = e.target.checked)}
        />
        Show all fonts (bypass display / body filter)
      </label>
      ${SHOW_HEADING_GROUPS
        ? html`<div class="heading-tools">
        <p class="heading-tools-label">Heading groups — select levels, then choose a shared face</p>
        ${HEADING_TARGETS.map(
          (target) => html`
            <label
              class="heading-check"
              data-gmixer-font-slot=${fontSlotKey(target.key)}
              data-linked=${this._linkedSlot === fontSlotKey(target.key)}
              @pointerenter=${() => this._hoverSlot(fontSlotKey(target.key), true)}
              @pointerleave=${() => this._hoverSlot(fontSlotKey(target.key), false)}
            >
              <input
                type="checkbox"
                .checked=${this._selectedHeadings.has(target.key)}
                @change=${(e) => this._toggleHeading(target.key, e.target.checked)}
              />
              ${target.label}
            </label>
          `
        )}
        ${this._selectedHeadings.size >= 2
          ? html`
              <gmixer-font-picker
                target="headers"
                .showAll=${this._showAll}
                .value=${this._groupFontId(fonts)}
                @change=${(e) => this._applyHeadingGroup(e.detail.value)}
              ></gmixer-font-picker>
            `
          : html`<span class="count">Select at least two levels to create a group.</span>`}
      </div>`
        : null}
      <fieldset class="headers-group">
        <legend>headers</legend>
        ${HEADING_TARGETS.map((target) => this._renderTarget(target, fonts, total))}
      </fieldset>
      ${TARGETS.map((target) => this._renderTarget(target, fonts, total))}
      <p class="upload-hint">
        ${FONTS.filter((f) => f.file).length} Peter Wiegel freeware fonts
        (${FONT_CATEGORIES.filter((c) => c.id !== 'system')
          .map((c) => c.label.split(' / ')[0].toLowerCase())
          .join(' / ')}). Open a menu to browse filtered faces; each row renders in its own
        typeface. Custom upload planned — fonts.customFonts.
      </p>
    `;
  }

  _headingFont(fonts, tag) {
    return (
      fonts.headings?.[tag] ||
      (tag === 'h1' ? fonts.headers : fonts.subheadings) || {
        fontId: 'system-body',
      }
    );
  }

  _renderTarget(target, fonts, total) {
    const isHeading = target.key.startsWith('h');
    const fontId = isHeading
      ? this._headingFont(fonts, target.key).fontId
      : fonts[target.key]?.fontId || 'system-body';
    const pickerTarget = isHeading ? 'headers' : target.key;
    const current = getFontById(fontId);
    const suitable = current
      ? isFontSuitableForTarget(current, pickerTarget, { showAll: false })
      : true;
    const available = getFontsForTarget(pickerTarget, { showAll: this._showAll }).length;
    const reason = current && !suitable ? unsuitableReason(current, pickerTarget) : '';

    const slot = fontSlotKey(target.key);
    return html`
      <fieldset
        class="target"
        data-gmixer-font-slot=${slot}
        data-linked=${this._linkedSlot === slot}
        @pointerenter=${() => this._hoverSlot(slot, true)}
        @pointerleave=${() => this._hoverSlot(slot, false)}
      >
        <legend>${target.label}</legend>
        <p class="target-hint">${target.hint}</p>
        <gmixer-font-picker
          .target=${pickerTarget}
          .showAll=${this._showAll}
          .value=${fontId}
          @change=${(e) =>
            isHeading
              ? this.updateGlobal({ fonts: { headings: { [target.key]: { fontId: e.detail.value } } } })
              : this.updateGlobal({ fonts: { [target.key]: { fontId: e.detail.value } } })}
        ></gmixer-font-picker>
        <div class="meta">
          ${current ? html`<span class="badge">${this._usageLabel(current)}</span>` : null}
          <span class="count">${this._showAll ? `${total} fonts` : `${available} suited · ${total} total`}</span>
          ${reason ? html`<span class="warn" title=${reason}>Not recommended for this role</span>` : null}
        </div>
      </fieldset>
    `;
  }

  _toggleHeading(tag, checked) {
    const selected = new Set(this._selectedHeadings);
    if (checked) selected.add(tag);
    else selected.delete(tag);
    this._selectedHeadings = selected;
  }

  _groupFontId(fonts) {
    const ids = [...this._selectedHeadings].map((tag) => this._headingFont(fonts, tag).fontId);
    return ids.every((id) => id === ids[0]) ? ids[0] : '';
  }

  _applyHeadingGroup(fontId) {
    const headings = Object.fromEntries(
      [...this._selectedHeadings].map((tag) => [tag, { fontId }])
    );
    this.updateGlobal({ fonts: { headings } });
  }
}

defineElement('gmixer-fonts-panel', FontsPanel);
