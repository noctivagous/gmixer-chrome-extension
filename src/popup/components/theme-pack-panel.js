import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { THEME_MODES } from '../../config/theme-packs.js';
import { defineElement } from '../../lib/define-element.js';

/**
 * Light / Gray / Dark tone direction controls.
 * Live theme preview lives in gmixer-theme-preview-panel.
 */
export class ThemePackPanel extends StoreBoundElement {
  static styles = css`
    :host {
      display: grid;
      gap: var(--gm-space-2, 16px);
    }
    .mode-picker {
      display: grid;
      gap: 8px;
    }
    .mode-picker > .field-label {
      font-size: 11px;
      opacity: 0.75;
    }
    .tone-segments {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      overflow: hidden;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.18);
    }
    .tone-segment {
      display: grid;
      gap: 4px;
      align-content: center;
      justify-items: center;
      min-height: 56px;
      margin: 0;
      padding: 8px 6px;
      border: 0;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 0;
      background: transparent;
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
      cursor: pointer;
      box-sizing: border-box;
      text-align: center;
    }
    .tone-segment:last-child {
      border-right: 0;
    }
    .tone-segment:hover {
      background: rgba(139, 92, 246, 0.1);
    }
    .tone-segment:focus-visible {
      z-index: 1;
      outline: 2px solid var(--gm-accent, #8b5cf6);
      outline-offset: -2px;
    }
    .tone-segment[aria-pressed='true'] {
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
      box-shadow: inset 0 -2px 0 var(--gm-accent, #7c3aed);
      color: var(--gm-text, #f2eefc);
    }
    .tone-name {
      font: 650 12px/1.1 system-ui, sans-serif;
      letter-spacing: 0.02em;
    }
    .tone-caption {
      max-width: 11ch;
      font: 10px/1.25 system-ui, sans-serif;
      opacity: 0.72;
    }
    .tone-segment[aria-pressed='true'] .tone-caption {
      opacity: 0.9;
    }
  `;

  render() {
    const activeMode = this.state?.global?.themeMode || 'dark';

    return html`
      <div class="mode-picker">
        <span class="field-label" id="theme-mode-label">Tone</span>
        <div
          class="tone-segments"
          role="group"
          aria-labelledby="theme-mode-label"
        >
          ${THEME_MODES.map(
            (mode) => html`
              <button
                type="button"
                class="tone-segment"
                aria-pressed=${mode.id === activeMode}
                title=${mode.description}
                @click=${() => this.updateGlobal({ themeMode: mode.id })}
              >
                <span class="tone-name">${mode.label}</span>
                <span class="tone-caption">${mode.description}</span>
              </button>
            `
          )}
        </div>
      </div>
    `;
  }
}

defineElement('gmixer-theme-pack-panel', ThemePackPanel);
