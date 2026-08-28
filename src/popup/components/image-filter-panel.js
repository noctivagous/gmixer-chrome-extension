import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { getThemePackById } from '../../config/theme-packs.js';
import { defineElement } from '../../lib/define-element.js';
import { PALETTE_FILTER_PRESETS } from '../../config/image-filter-presets.js';

const PRESETS = [
  { id: 'grayscale', label: 'grayscale' },
  { id: 'sepia', label: 'sepia' },
  { id: 'invert', label: 'invert' },
  { id: 'monochrome', label: 'monochrome' },
  { id: 'duotone', label: 'duotone', requiresColor: true },
  { id: 'accent-tint', label: 'accent tint', requiresColor: true },
  { id: 'link-wash', label: 'link wash', requiresColor: true },
  { id: 'custom', label: 'custom' },
];

const CATEGORY_PRESETS = [
  { id: 'auto', label: 'auto' },
  { id: 'none', label: 'none' },
  { id: 'monochrome', label: 'monochrome' },
  { id: 'grayscale', label: 'grayscale' },
  { id: 'sepia', label: 'sepia' },
  { id: 'duotone', label: 'duotone', requiresColor: true },
  { id: 'accent-tint', label: 'accent tint', requiresColor: true },
  { id: 'link-wash', label: 'link wash', requiresColor: true },
];

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

function colorSectionOn(global) {
  const sections = global?.sections;
  if (!sections) return true;
  if (sections.color === true || sections.tone === true) return true;
  if (sections.color === false && sections.tone === false) return false;
  if (sections.color !== undefined) return sections.color === true;
  if (sections.tone !== undefined) return sections.tone === true;
  return true;
}

function visiblePresets(list, colorOn, currentId) {
  return list.filter((preset) => !preset.requiresColor || colorOn || preset.id === currentId);
}

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
    .apply-filter-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .apply-filter-row label {
      flex: 0 0 auto;
      margin: 0;
      white-space: nowrap;
    }
    .apply-filter-row select {
      flex: 1;
      min-width: 0;
    }
    .media-categories {
      margin: 16px 0 0;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.14);
    }
    .media-categories > summary {
      cursor: pointer;
      list-style: none;
      padding: 8px 10px;
      font-size: 12px;
      font-weight: 600;
      user-select: none;
    }
    .media-categories > summary::-webkit-details-marker {
      display: none;
    }
    .media-categories > summary::before {
      content: '▸';
      display: inline-block;
      width: 1em;
      margin-right: 4px;
      opacity: 0.7;
      transition: transform 120ms ease;
    }
    .media-categories[open] > summary::before {
      transform: rotate(90deg);
    }
    .media-categories[open] > summary {
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    .category-body {
      padding: 8px 10px 10px;
    }
    .hint {
      margin: 0 0 8px;
      font-size: 10px;
      opacity: 0.65;
      line-height: 1.4;
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
    const colorOn = colorSectionOn(global);
    const presetOptions = visiblePresets(PRESETS, colorOn, filter.preset);

    return html`
      <label>Preset</label>
      <select @change=${(e) => this.updateGlobal({ imageFilter: { preset: e.target.value } })}>
        ${presetOptions.map(
          (preset) => html`<option value=${preset.id} ?selected=${preset.id === filter.preset}>
            ${preset.label}
          </option>`
        )}
      </select>
      ${!colorOn && PALETTE_FILTER_PRESETS.has(filter.preset)
        ? html`<p class="hint">
            Color is off — this palette wash paints as monochrome until Color is enabled.
          </p>`
        : !colorOn
          ? html`<p class="hint">Turn on Color to unlock accent tint, link wash, and duotone.</p>`
          : html``}

      <div class="apply-filter-row">
        <input
          id="image-filter-enabled"
          type="checkbox"
          .checked=${filter.enabled}
          @change=${(event) => {
            const enabled = event.target.checked;
            /** @type {Record<string, unknown>} */
            const imageFilter = { enabled };
            // Blank-slate default is preset "none"; turning the filter on
            // without a visible preset still looks like a no-op.
            if (enabled && (!filter.preset || filter.preset === 'none')) {
              imageFilter.preset = 'monochrome';
            }
            this.updateGlobal({ imageFilter });
          }}
        />
        <label for="image-filter-scope">Apply filter to</label>
        <select
          id="image-filter-scope"
          .value=${filter.scope || 'images'}
          @change=${(event) => {
            this.updateGlobal({ imageFilter: { scope: event.target.value } });
          }}
        >
          ${SCOPES.map(
            (scope) => html`<option value=${scope.id}>${scope.label}</option>`
          )}
        </select>
      </div>
      <div class="toggle-row">
        <input
          type="checkbox"
          .checked=${filter.revealOnHover === true}
          @change=${(e) =>
            this.updateGlobal({ imageFilter: { revealOnHover: e.target.checked } })}
        />
        <label style="margin:0">Hover shows media unfiltered</label>
      </div>

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

      <details class="media-categories">
        <summary>Recognized media categories</summary>
        <div class="category-body">
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
            const categoryOptions = visiblePresets(CATEGORY_PRESETS, colorOn, current.filter);
            return html`
              <div class="category">
                <span>${label}</span>
                <select
                  aria-label=${`${label} filter`}
                  @change=${(e) =>
                    this.updateGlobal({ mediaStyles: { [role]: { filter: e.target.value } } })}
                >
                  ${categoryOptions.map(
                    (preset) =>
                      html`<option value=${preset.id} ?selected=${preset.id === current.filter}>
                        ${preset.label}
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
        </div>
      </details>
    `;
  }

  updateGlobal(patch) {
    super.updateGlobal(patch);
    this.dispatchEvent(
      new CustomEvent('change', {
        bubbles: true,
        composed: true,
        detail: { filterEnabled: patch.imageFilter?.enabled },
      })
    );
  }
}

defineElement('gmixer-image-filter-panel', ImageFilterPanel);
