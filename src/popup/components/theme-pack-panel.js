import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { THEME_PACKS, getThemePackById } from '../../config/theme-packs.js';
import { buildPalette } from '../../lib/color-theory.js';
import { createDefaultState } from '../../state/schema.js';
import { defineElement } from '../../lib/define-element.js';

function paletteForPack(pack) {
  const base = createDefaultState().global.color;
  const color = { ...base, ...(pack.patch?.color || {}) };
  return buildPalette(color.baseColor, color.scheme);
}

export class ThemePackPanel extends StoreBoundElement {
  static styles = css`
    ul {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--gm-space-2, 16px);
    }
    li button {
      width: 100%;
      text-align: left;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      border-radius: var(--gm-space-1, 8px);
      padding: var(--gm-space-2, 16px);
      color: inherit;
      cursor: pointer;
    }
    li button[aria-pressed='true'] {
      border-color: var(--gm-accent, #7c3aed);
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
    }
    strong {
      display: block;
      font-size: 14px;
      line-height: var(--gm-baseline, 24px);
    }
    .desc {
      display: block;
      font-size: 12px;
      line-height: var(--gm-baseline, 24px);
      opacity: 0.7;
      margin-top: 0;
    }
    .swatches {
      display: flex;
      gap: var(--gm-space-1, 8px);
      margin-top: var(--gm-space-2, 16px);
    }
    .swatch {
      flex: 1;
      height: var(--gm-baseline, 24px);
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.12);
    }
  `;

  render() {
    const activeId = this.state?.global?.activeThemePackId;
    return html`
      <ul>
        ${THEME_PACKS.map((pack) => {
          const palette = paletteForPack(pack);
          return html`
            <li>
              <button aria-pressed=${pack.id === activeId} @click=${() => this._select(pack.id)}>
                <strong>${pack.label}</strong>
                <span class="desc">${pack.description}</span>
                <div class="swatches" aria-hidden="true">
                  ${['background', 'text', 'accent', 'link', 'border'].map(
                    (role) => html`<div class="swatch" style="background:${palette[role]}"></div>`
                  )}
                </div>
              </button>
            </li>
          `;
        })}
      </ul>
    `;
  }

  _select(packId) {
    const pack = getThemePackById(packId);
    if (!pack) return;
    this.updateGlobal({ activeThemePackId: packId, ...pack.patch });
  }
}

defineElement('gmixer-theme-pack-panel', ThemePackPanel);
