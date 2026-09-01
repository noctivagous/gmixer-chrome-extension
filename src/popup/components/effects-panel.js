import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { defineElement } from '../../lib/define-element.js';
import {
  EFFECT_CATEGORIES,
  IMAGE_MOTION_EFFECTS,
  isGlowLike,
  normalizeEffects,
} from '../../config/effects-catalog.js';

export class EffectsPanel extends StoreBoundElement {
  static styles = css`
    .category {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 1.2fr;
      gap: 8px;
      align-items: center;
      margin-bottom: 10px;
    }
    .category span {
      font-size: 12px;
    }
    select,
    input[type='color'],
    input[type='range'] {
      width: 100%;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: inherit;
      border-radius: 4px;
      padding: 4px;
    }
    input[type='range'] {
      padding: 0;
      accent-color: var(--gm-accent, #8b5cf6);
    }
    .parameter {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: center;
      margin: -2px 0 10px 4px;
      font-size: 11px;
    }
    .parameter label {
      display: grid;
      grid-template-columns: 92px minmax(0, 1fr);
      gap: 8px;
      align-items: center;
    }
    .parameter output {
      min-width: 42px;
      text-align: right;
      opacity: 0.75;
      font-variant-numeric: tabular-nums;
    }
    .toggle-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 10px;
    }
    .toggle-row label {
      margin: 0;
      font-size: 12px;
    }
    .toggle-row.unavailable {
      opacity: 0.4;
    }
    .toggle-row.unavailable,
    .toggle-row.unavailable label {
      cursor: not-allowed;
    }
    .sub {
      margin-left: 4px;
      font-size: 11px;
      opacity: 0.85;
    }
    .param-fieldset {
      margin: 0 0 12px;
      padding: 10px 12px 8px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 6px;
      min-width: 0;
    }
    .param-fieldset legend {
      padding: 0 6px;
      font: 650 11px/1.2 system-ui, sans-serif;
      letter-spacing: 0.02em;
      color: var(--gm-text, #f2eefc);
    }
    .param-fieldset .parameter {
      margin-left: 0;
    }
    .param-fieldset .sub {
      margin-left: 0;
    }
    .divider {
      border: 0;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      margin: 14px 0 12px;
    }
    .hint {
      margin: 0 0 10px;
      font-size: 10px;
      opacity: 0.65;
      line-height: 1.4;
    }
  `;

  updateGlobal(patch) {
    super.updateGlobal(patch);
    this.dispatchEvent(new CustomEvent('change', { bubbles: true, composed: true }));
  }

  render() {
    const raw = this.state?.global?.effects;
    if (!raw) return html``;
    const effects = normalizeEffects(raw);
    const showPanScanOptions = effects.categories.images.motion === 'pan-scan';
    const imageMotion = effects.categories.images.motion || 'none';
    const linkGlowCategories = new Set(['hyperlinks', 'navigation']);
    const imageGlowLike = isGlowLike(effects.categories.images.effect);
    const videoGlowLike = isGlowLike(effects.categories.videos.effect);
    const articleGlowLike = isGlowLike(effects.categories.articles.effect);
    const updateCategoryGlow = (categoryId, patch) =>
      this.updateGlobal({
        effects: {
          categories: {
            [categoryId]: { glow: patch },
          },
        },
      });
    const updatePanScan = (key, value) =>
      this.updateGlobal({
        effects: {
          panScan: {
            [key]: key === 'loop' || key === 'motion' ? value : Number(value),
          },
        },
      });
    const panScanFieldset = showPanScanOptions
      ? html`
          <fieldset class="param-fieldset">
            <legend>Images: Pan &amp; scan</legend>
            <div class="parameter">
              <label for="pan-scan-speed">
                <span>Speed</span>
                <input
                  id="pan-scan-speed"
                  type="range"
                  min="4"
                  max="40"
                  step="1"
                  .value=${String(effects.panScan.speed)}
                  @input=${(e) => updatePanScan('speed', e.target.value)}
                />
              </label>
              <output>${effects.panScan.speed}s</output>
            </div>
            <div class="parameter">
              <label for="pan-scan-zoom">
                <span>Zoom</span>
                <input
                  id="pan-scan-zoom"
                  type="range"
                  min="4"
                  max="40"
                  step="1"
                  .value=${String(effects.panScan.zoom)}
                  @input=${(e) => updatePanScan('zoom', e.target.value)}
                />
              </label>
              <output>${effects.panScan.zoom}%</output>
            </div>
            <div class="parameter">
              <label for="pan-scan-distance">
                <span>Pan distance</span>
                <input
                  id="pan-scan-distance"
                  type="range"
                  min="0"
                  max="12"
                  step="1"
                  .value=${String(effects.panScan.distance)}
                  @input=${(e) => updatePanScan('distance', e.target.value)}
                />
              </label>
              <output>${effects.panScan.distance}%</output>
            </div>
            <div class="parameter">
              <label for="pan-scan-motion">
                <span>Variation</span>
                <select
                  id="pan-scan-motion"
                  .value=${effects.panScan.motion}
                  @change=${(e) => updatePanScan('motion', e.target.value)}
                >
                  <option value="scan">Scan (2D)</option>
                  <option value="pan">Pan (horizontal)</option>
                  <option value="tilt">Tilt (vertical)</option>
                </select>
              </label>
              <output></output>
            </div>
            <div class="parameter">
              <label for="pan-scan-loop">
                <span>Loop</span>
                <select
                  id="pan-scan-loop"
                  .value=${effects.panScan.loop}
                  @change=${(e) => updatePanScan('loop', e.target.value)}
                >
                  <option value="fade">Cross dissolve</option>
                  <option value="oscillate">Oscillate</option>
                </select>
              </label>
              <output></output>
            </div>
          </fieldset>
        `
      : html``;
    const mediaGlowFieldset = (legend) => html`
      <fieldset class="param-fieldset">
        <legend>${legend}</legend>
        <div class="sub toggle-row">
          <input
            type="checkbox"
            .checked=${effects.glow.animated}
            @change=${(e) =>
              this.updateGlobal({ effects: { glow: { animated: e.target.checked } } })}
          />
          <label>Animated glow pulse</label>
        </div>
        <div class="sub toggle-row">
          <label for="glow-color">Glow color</label>
          <input
            id="glow-color"
            type="color"
            .value=${effects.glow.color || '#a08a7f'}
            @change=${(e) =>
              this.updateGlobal({ effects: { glow: { color: e.target.value } } })}
          />
        </div>
      </fieldset>
    `;

    return html`
      <p class="hint">Chrome effects (glow, drop glow, marquee) are separate from image motion. Glow is centered; drop glow is offset. Cursor and background motion stay page-wide.</p>

      ${Object.entries(EFFECT_CATEGORIES).map(([categoryId, meta]) => {
        const current = effects.categories[categoryId]?.effect || 'none';
        const glow = effects.categories[categoryId]?.glow;
        const showLinkGlow =
          linkGlowCategories.has(categoryId) && (current === 'glow' || current === 'drop-glow');
        const effectLabel =
          meta.effects.find((effect) => effect.id === current)?.label || current;
        return html`
          <div class="category">
            <span>${meta.label}</span>
            <select
              aria-label=${`${meta.label} effect`}
              @change=${(e) =>
                this.updateGlobal({
                  effects: {
                    categories: {
                      [categoryId]: { effect: e.target.value },
                    },
                  },
                })}
            >
              ${meta.effects.map(
                (effect) => html`
                  <option value=${effect.id} ?selected=${effect.id === current}>
                    ${effect.label}
                  </option>
                `
              )}
            </select>
          </div>
          ${categoryId === 'images' && imageGlowLike
            ? mediaGlowFieldset(`Images: ${effectLabel}`)
            : html``}
          ${categoryId === 'images'
            ? html`
                <div class="category">
                  <span>Image motion</span>
                  <select
                    aria-label="Image motion effect"
                    @change=${(e) =>
                      this.updateGlobal({
                        effects: {
                          categories: {
                            images: { motion: e.target.value },
                          },
                        },
                      })}
                  >
                    ${IMAGE_MOTION_EFFECTS.map(
                      (effect) => html`
                        <option value=${effect.id} ?selected=${effect.id === imageMotion}>
                          ${effect.label}
                        </option>
                      `
                    )}
                  </select>
                </div>
                ${panScanFieldset}
              `
            : html``}
          ${categoryId === 'videos' && videoGlowLike && !imageGlowLike
            ? mediaGlowFieldset(`Videos: ${effectLabel}`)
            : html``}
          ${categoryId === 'articles' && articleGlowLike && !imageGlowLike && !videoGlowLike
            ? mediaGlowFieldset(`Articles: ${effectLabel}`)
            : html``}
          ${showLinkGlow
            ? html`
                <fieldset class="param-fieldset">
                  <legend>${meta.label}: ${effectLabel}</legend>
                  <div class="sub toggle-row">
                    <input
                      type="checkbox"
                      .checked=${glow?.animated !== false}
                      @change=${(e) =>
                        updateCategoryGlow(categoryId, { animated: e.target.checked })}
                    />
                    <label>Animated glow pulse</label>
                  </div>
                  <div class="sub toggle-row">
                    <label for=${`glow-color-${categoryId}`}>Glow color</label>
                    <input
                      id=${`glow-color-${categoryId}`}
                      type="color"
                      .value=${glow?.color || '#a08a7f'}
                      @change=${(e) => updateCategoryGlow(categoryId, { color: e.target.value })}
                    />
                  </div>
                </fieldset>
              `
            : html``}
        `;
      })}

      <hr class="divider" />

      <div class="toggle-row unavailable" title="Unavailable">
        <input
          type="checkbox"
          .checked=${effects.cursor.enabled}
          disabled
        />
        <label>Cursor mods (not yet available)</label>
      </div>

      <div class="toggle-row unavailable" title="Unavailable">
        <input
          type="checkbox"
          .checked=${effects.backgroundMotion.enabled}
          disabled
        />
        <label>Animated background motion (not yet available)</label>
      </div>
    `;
  }
}

defineElement('gmixer-effects-panel', EffectsPanel);
