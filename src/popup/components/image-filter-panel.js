import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { getThemePackById } from '../../config/theme-packs.js';
import { defineElement } from '../../lib/define-element.js';
import {
  PALETTE_FILTER_PRESETS,
  IMAGE_FILTER_PRESETS,
  DETAILED_CATEGORY_PRESETS,
  MEDIA_FILTER_CATEGORIES,
  normalizeImageFilter,
  resolveAutoMediaRoleFilter,
} from '../../config/image-filter-presets.js';
import { effectiveCustomizationLevel } from '../../settings/customization-level.js';

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
      margin-top: 10px;
    }
    .toggle-row label {
      margin: 0;
    }
    .category-row {
      display: grid;
      grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
      gap: 8px;
      align-items: center;
      margin-bottom: 8px;
    }
    .category-row span {
      font-size: 12px;
    }
    .category-row select {
      width: 100%;
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

  /**
   * @param {Partial<import('../../config/image-filter-presets.js').ImageFilterSettings>} patch
   */
  _patchFilter(patch) {
    this.updateGlobal({
      activeThemePackId: 'user-made',
      sections: { filter: true },
      imageFilter: { enabled: true, ...patch },
    });
  }

  /**
   * @param {import('../../config/image-filter-presets.js').MediaFilterCategoryId} id
   * @param {string} preset
   */
  _setCategory(id, preset) {
    this._patchFilter({
      categories: { [id]: preset },
    });
  }

  render() {
    const raw = this.state?.global?.imageFilter;
    if (!raw && raw !== undefined && !this.state?.global) return html``;
    const filter = normalizeImageFilter(raw);
    const global = this.state.global;
    const pack = getThemePackById(global.activeThemePackId);
    const overrides = global.mediaStyles || {};
    const colorOn = colorSectionOn(global);
    const level = effectiveCustomizationLevel(global.ui);
    const showDetailed = level >= 3;
    const usesCustom = Object.values(filter.categories).includes('custom');

    return html`
      <p class="hint">
        Choose a CSS filter per media kind. Article images override general images on classified
        nodes.
      </p>
      ${!colorOn
        ? html`<p class="hint">
            Color is off — accent tint, link wash, and duotone paint as monochrome until Color is
            enabled.
          </p>`
        : html``}

      ${MEDIA_FILTER_CATEGORIES.map((category) => {
        const current = filter.categories[category.id];
        const options = visiblePresets(IMAGE_FILTER_PRESETS, colorOn, current);
        return html`
          <div class="category-row">
            <span>${category.label}:</span>
            <select
              aria-label=${`${category.label} filter`}
              @change=${(e) => this._setCategory(category.id, e.target.value)}
            >
              ${options.map(
                (preset) => html`
                  <option value=${preset.id} ?selected=${preset.id === current}>
                    ${preset.label}
                  </option>
                `
              )}
            </select>
          </div>
        `;
      })}

      <div class="toggle-row">
        <input
          id="image-filter-reveal"
          type="checkbox"
          .checked=${filter.revealOnHover === true}
          @change=${(e) => this._patchFilter({ revealOnHover: e.target.checked })}
        />
        <label for="image-filter-reveal">Hover shows media unfiltered</label>
      </div>

      ${usesCustom
        ? html`
            <label>Custom filter()</label>
            <input
              type="text"
              placeholder="e.g. grayscale(1) contrast(1.1)"
              .value=${filter.customFilter}
              @input=${(e) => this._patchFilter({ customFilter: e.target.value })}
            />
          `
        : html``}

      ${showDetailed
        ? html`
            <details class="media-categories">
              <summary>Detailed Media Categories</summary>
              <div class="category-body">
                <p class="hint">
                  Category overrides win over the primary rows. “Auto” follows the matching primary
                  Chroming Media row.
                </p>
                ${MEDIA_ROLES.map(([role, label]) => {
                  const current = {
                    filter: 'auto',
                    outline: 'none',
                    ...(pack?.media?.[role] || {}),
                    ...(overrides[role] || {}),
                  };
                  const categoryOptions = visiblePresets(
                    DETAILED_CATEGORY_PRESETS,
                    colorOn,
                    current.filter
                  );
                  const autoResolved = resolveAutoMediaRoleFilter(role, filter.categories);
                  return html`
                    <div class="category">
                      <span>${label}</span>
                      <select
                        aria-label=${`${label} filter`}
                        @change=${(e) =>
                          this.updateGlobal({
                            mediaStyles: { [role]: { filter: e.target.value } },
                          })}
                      >
                        ${categoryOptions.map(
                          (preset) => html`
                            <option value=${preset.id} ?selected=${preset.id === current.filter}>
                              ${preset.id === 'auto'
                                ? `auto (${autoResolved})`
                                : preset.label}
                            </option>
                          `
                        )}
                      </select>
                    </div>
                    <div class="category">
                      <span>${label} outline</span>
                      <select
                        aria-label=${`${label} outline`}
                        @change=${(e) =>
                          this.updateGlobal({
                            mediaStyles: { [role]: { outline: e.target.value } },
                          })}
                      >
                        ${['none', 'accent'].map(
                          (outline) => html`
                            <option value=${outline} ?selected=${outline === current.outline}>
                              ${outline}
                            </option>
                          `
                        )}
                      </select>
                    </div>
                  `;
                })}
              </div>
            </details>
          `
        : html``}
    `;
  }

  updateGlobal(patch) {
    super.updateGlobal(patch);
    this.dispatchEvent(
      new CustomEvent('change', {
        bubbles: true,
        composed: true,
        detail: { filterEnabled: patch.imageFilter?.enabled !== false },
      })
    );
  }
}

defineElement('gmixer-image-filter-panel', ImageFilterPanel);
