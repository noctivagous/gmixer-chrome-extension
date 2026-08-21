import { LitElement, html, css } from 'lit';
import { store } from '../../state/store.js';

import '../../popup/components/theme-pack-panel.js';
import '../../popup/components/color-panel.js';
import '../../popup/components/fonts-panel.js';
import '../../popup/components/image-filter-panel.js';
import '../../popup/components/clipping-panel.js';
import '../../popup/components/effects-panel.js';
import '../../popup/components/navigation-panel.js';
import '../../popup/components/site-toggle.js';
import './theme-preview.js';
import { defineElement } from '../../lib/define-element.js';

const SECTIONS = [
  { id: 'theme', label: 'Theme Pack', tag: 'gmixer-theme-pack-panel' },
  { id: 'color', label: 'Color', tag: 'gmixer-color-panel' },
  { id: 'fonts', label: 'Fonts', tag: 'gmixer-fonts-panel' },
  { id: 'filter', label: 'Image Filter', tag: 'gmixer-image-filter-panel' },
  { id: 'clipping', label: 'Clipping', tag: 'gmixer-clipping-panel' },
  { id: 'effects', label: 'Effects', tag: 'gmixer-effects-panel' },
  { id: 'navigation', label: 'Navigation', tag: 'gmixer-navigation-panel' },
];

/**
 * In-page settings shell: titlebar + left tab rail + main + preview.
 * Baseline grid: 8px module / 24px line (see settings/tokens.js).
 */
export class GmixerSettings extends LitElement {
  static properties = {
    _activeSection: { state: true },
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      min-height: 0;
      color: var(--gm-text, #f2eefc);
      background: var(--gm-bg, #14121a);
      font: 13px/var(--gm-line, 24px) system-ui, sans-serif;
    }

    .titlebar {
      flex: 0 0 var(--gm-titlebar, 48px);
      display: grid;
      grid-template-columns: 1fr auto auto;
      align-items: center;
      gap: var(--gm-space-2, 16px);
      padding: 0 var(--gm-space-2, 16px);
      border-bottom: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      box-sizing: border-box;
    }

    h1 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      line-height: var(--gm-baseline, 24px);
      letter-spacing: 0.02em;
    }

    .shortcut {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      line-height: var(--gm-baseline, 24px);
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
    }

    kbd {
      display: inline-block;
      min-width: var(--gm-space-3, 24px);
      padding: 0 6px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-bottom-width: 2px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.06);
      font: 11px/var(--gm-baseline, 24px) ui-monospace, monospace;
      text-align: center;
      color: var(--gm-text, #f2eefc);
    }

    .close {
      width: var(--gm-baseline, 24px);
      height: var(--gm-baseline, 24px);
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-radius: 4px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      line-height: 1;
      font-size: 14px;
    }

    .body {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: var(--gm-rail, 192px) minmax(0, 1fr) var(--gm-preview, 240px);
    }

    nav {
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: var(--gm-space-2, 16px) 0;
      border-right: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      overflow-y: auto;
      background: var(--gm-surface, #1c1826);
    }

    nav button {
      display: block;
      width: 100%;
      text-align: left;
      border: 0;
      border-left: 3px solid transparent;
      background: transparent;
      color: inherit;
      padding: 0 var(--gm-space-2, 16px);
      min-height: var(--gm-baseline, 24px);
      line-height: var(--gm-baseline, 24px);
      font-size: 13px;
      cursor: pointer;
    }

    nav button[aria-selected='true'] {
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
      border-left-color: var(--gm-accent, #7c3aed);
    }

    .main {
      min-width: 0;
      min-height: 0;
      overflow-y: auto;
      padding: var(--gm-space-3, 24px) var(--gm-space-3, 24px);
      box-sizing: border-box;
    }

    .main > * {
      max-width: 40rem;
    }

    gmixer-theme-preview {
      min-width: 0;
      min-height: 0;
    }

    @media (max-width: 720px) {
      .body {
        grid-template-columns: var(--gm-rail, 192px) minmax(0, 1fr);
        grid-template-rows: minmax(0, 1fr) 200px;
      }
      gmixer-theme-preview {
        grid-column: 1 / -1;
        border-left: 0;
        border-top: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      }
    }
  `;

  constructor() {
    super();
    this._activeSection = SECTIONS[0].id;
  }

  _close() {
    const popover =
      this.parentElement?.id === 'gmixer-settings'
        ? this.parentElement
        : document.getElementById('gmixer-settings');
    if (popover && typeof popover.hidePopover === 'function') {
      popover.hidePopover();
    }
  }

  render() {
    const current = SECTIONS.find((s) => s.id === this._activeSection) ?? SECTIONS[0];
    return html`
      <header class="titlebar">
        <h1>gMixer <gmixer-site-toggle></gmixer-site-toggle></h1>
        <span class="shortcut" title="Toggle settings (also remappable in extension shortcuts)">
          <kbd>Alt</kbd>+<kbd>M</kbd>
        </span>
        <button type="button" class="close" aria-label="Close settings" @click=${() => this._close()}>
          ×
        </button>
      </header>
      <div class="body">
        <nav role="tablist" aria-orientation="vertical">
          ${SECTIONS.map(
            (section) => html`
              <button
                role="tab"
                aria-selected=${section.id === this._activeSection}
                @click=${() => (this._activeSection = section.id)}
              >
                ${section.label}
              </button>
            `
          )}
        </nav>
        <div class="main" role="tabpanel">${this._renderSection(current)}</div>
        <gmixer-theme-preview></gmixer-theme-preview>
      </div>
    `;
  }

  _renderSection(section) {
    switch (section.tag) {
      case 'gmixer-theme-pack-panel':
        return html`<gmixer-theme-pack-panel></gmixer-theme-pack-panel>`;
      case 'gmixer-color-panel':
        return html`<gmixer-color-panel></gmixer-color-panel>`;
      case 'gmixer-fonts-panel':
        return html`<gmixer-fonts-panel></gmixer-fonts-panel>`;
      case 'gmixer-image-filter-panel':
        return html`<gmixer-image-filter-panel></gmixer-image-filter-panel>`;
      case 'gmixer-clipping-panel':
        return html`<gmixer-clipping-panel></gmixer-clipping-panel>`;
      case 'gmixer-effects-panel':
        return html`<gmixer-effects-panel></gmixer-effects-panel>`;
      case 'gmixer-navigation-panel':
        return html`<gmixer-navigation-panel></gmixer-navigation-panel>`;
      default:
        return html``;
    }
  }
}

defineElement('gmixer-settings', GmixerSettings);

store.ready;
