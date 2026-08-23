import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { getThemePackById } from '../../config/theme-packs.js';
import { defineElement } from '../../lib/define-element.js';

const PRESETS = ['grayscale', 'sepia', 'invert', 'duotone', 'monochrome', 'custom'];
const SCOPES = [
  { id: 'images', label: 'Images/video only' },
  { id: 'backgrounds', label: 'Background images only' },
  { id: 'both', label: 'Both' },
];
const MEDIA_ROLES = [
  ['articleImage', 'Article images'],
  ['videoThumbnail', 'Video thumbnails'],
  ['avatar', 'Avatars'],
  ['logo', 'Logos'],
  ['ad', 'Ads'],
  ['hero', 'Hero media'],
];

export class ImageFilterPanel extends StoreBoundElement {
  static styles = css`
    label {
      display: block;
      font-size: 11px;
      opacity: 0.8;
      margin: 8px 0 4px;
    }
    select,
    input[type='text'] {
      width: 100%;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: inherit;
      border-radius: 4px;
      padding: 4px;
    }
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .category-heading {
      margin: 20px 0 4px;
      font-size: 12px;
      font-weight: 600;
    }
    .category {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 1fr;
      gap: 6px;
      align-items: center;
      margin-top: 8px;
    }
    .category span {
      font-size: 11px;
      opacity: 0.8;
    }
    .category select {
      width: 100%;
    }
  `;

  render() {
    const filter = this.state?.global?.imageFilter;
    if (!filter) return html``;
    const global = this.state.global;
    const pack = getThemePackById(global.activeThemePackId);
    const overrides = global.mediaStyles || {};

    return html`
      <div class="toggle-row">
        <input
          type="checkbox"
          .checked=${filter.enabled}
          @change=${(e) => this.updateGlobal({ imageFilter: { enabled: e.target.checked } })}
        />
        <label style="margin:0">Enable image filter</label>
      </div>
      <div class="toggle-row">
        <input
          type="checkbox"
          .checked=${filter.revealOnHover === true}
          @change=${(e) =>
            this.updateGlobal({ imageFilter: { revealOnHover: e.target.checked } })}
        />
        <label style="margin:0">Reveal original media on hover</label>
      </div>

      <label>Preset</label>
      <select @change=${(e) => this.updateGlobal({ imageFilter: { preset: e.target.value } })}>
        ${PRESETS.map(
          (preset) => html`<option value=${preset} ?selected=${preset === filter.preset}>${preset}</option>`
        )}
      </select>

      ${filter.preset === 'custom'
        ? html`
            <label>Custom filter()</label>
            <input
              type="text"
              placeholder="e.g. grayscale(1) contrast(1.1)"
              .value=${filter.customFilter}
              @input=${(e) => this.updateGlobal({ imageFilter: { customFilter: e.target.value } })}
            />
          `
        : html``}

      <label>Apply to</label>
      <select @change=${(e) => this.updateGlobal({ imageFilter: { scope: e.target.value } })}>
        ${SCOPES.map(
          (scope) => html`<option value=${scope.id} ?selected=${scope.id === filter.scope}>${scope.label}</option>`
        )}
      </select>

      <p class="category-heading">Recognized media categories</p>
      <p class="hint">
        Category overrides win over the global filter. “Auto” follows the global setting.
      </p>
      ${MEDIA_ROLES.map(([role, label]) => {
        const current = {
          filter: 'auto',
          outline: 'none',
          ...(pack?.media?.[role] || {}),
          ...(overrides[role] || {}),
        };
        return html`
          <div class="category">
            <span>${label}</span>
            <select
              aria-label=${`${label} filter`}
              @change=${(e) =>
                this.updateGlobal({ mediaStyles: { [role]: { filter: e.target.value } } })}
            >
              ${['auto', 'none', 'monochrome', 'grayscale', 'sepia', 'duotone'].map(
                (preset) =>
                  html`<option value=${preset} ?selected=${preset === current.filter}>
                    ${preset}
                  </option>`
              )}
            </select>
          </div>
          <div class="category">
            <span>${label} outline</span>
            <select
              aria-label=${`${label} outline`}
              @change=${(e) =>
                this.updateGlobal({ mediaStyles: { [role]: { outline: e.target.value } } })}
            >
              ${['none', 'accent'].map(
                (outline) =>
                  html`<option value=${outline} ?selected=${outline === current.outline}>
                    ${outline}
                  </option>`
              )}
            </select>
          </div>
        `;
      })}
    `;
  }
}

defineElement('gmixer-image-filter-panel', ImageFilterPanel);
