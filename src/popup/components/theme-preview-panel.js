import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { THEME_PACKS } from '../../config/theme-packs.js';
import { buildPalette } from '../../lib/color-theory.js';
import { getFontById } from '../../config/fonts.js';
import { createDefaultState } from '../../state/schema.js';
import { effectiveRoleColors, roleColors } from './palette-swatches.js';
import { buildPreviewEffectsCss, previewEffectsActive } from '../../lib/preview-effects-css.js';
import { imageFilterPresetCss } from '../../content/style-injector.js';
import { PALETTE_FILTER_PRESETS } from '../../config/image-filter-presets.js';
import { defineElement } from '../../lib/define-element.js';
import {
  PREVIEW_FONT_SLOTS,
  fontIdForPreviewSlot,
  fontsPatchForPreviewSlot,
  resolvePreviewTarget,
  samePreviewTarget,
} from './preview-inspect.js';
import '../../settings/components/font-picker.js';

function paletteForPack(pack, mode = 'dark') {
  const base = createDefaultState().global.color;
  const color = { ...base, ...(pack.patch?.color || {}) };
  return buildPalette(color.baseColor, color.scheme, mode);
}

function fontFamily(fontId) {
  return getFontById(fontId)?.family || 'system-ui, sans-serif';
}

const MEDIA_FILTER_PRESETS = [
  { id: 'none', label: 'none' },
  { id: 'grayscale', label: 'grayscale' },
  { id: 'sepia', label: 'sepia' },
  { id: 'invert', label: 'invert' },
  { id: 'monochrome', label: 'monochrome' },
  { id: 'duotone', label: 'duotone', requiresColor: true },
  { id: 'accent-tint', label: 'accent tint', requiresColor: true },
  { id: 'link-wash', label: 'link wash', requiresColor: true },
  { id: 'custom', label: 'custom' },
];

/** Colorful inline sample used in theme blurbs (no external asset). */
const SAMPLE_IMAGE_SVG = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120" width="160" height="120">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#6ec3ff"/>
      <stop offset="55%" stop-color="#f7c98a"/>
      <stop offset="100%" stop-color="#e07a5f"/>
    </linearGradient>
  </defs>
  <rect width="160" height="120" fill="url(#sky)"/>
  <circle cx="128" cy="28" r="16" fill="#ffe08a"/>
  <path d="M0 78 L28 52 L52 70 L78 40 L108 66 L132 50 L160 72 V120 H0 Z" fill="#3d6b4f"/>
  <path d="M0 92 L40 78 L70 88 L110 70 L160 86 V120 H0 Z" fill="#2f5540"/>
  <rect x="34" y="66" width="22" height="28" fill="#5c4033"/>
  <polygon points="34,66 45,52 56,66" fill="#8b3a2a"/>
</svg>
`.trim());

const SAMPLE_IMAGE_SRC = `data:image/svg+xml,${SAMPLE_IMAGE_SVG}`;

/**
 * Live theme pack preview (type, surfaces, sample media).
 * Tone Light/Gray/Dark controls live in gmixer-color-panel (merged Color module).
 * Hover shows a role tooltip; click pins compact editors for that region.
 */
export class ThemePreviewPanel extends StoreBoundElement {
  static properties = {
    hidePackName: { type: Boolean, attribute: 'hide-pack-name' },
    /** @type {import('./preview-inspect.js').PreviewInspectTarget|null} */
    _hoverTarget: { state: true },
    /** @type {import('./preview-inspect.js').PreviewInspectTarget|null} */
    _pinnedTarget: { state: true },
    _tooltipX: { state: true },
    _tooltipY: { state: true },
    _pinX: { state: true },
    _pinY: { state: true },
  };

  static styles = css`
    :host {
      display: grid;
      gap: var(--gm-space-2, 16px);
    }
    .theme-preview {
      position: relative;
      display: grid;
      gap: 8px;
    }
    strong.pack-name {
      display: block;
      font-size: 14px;
      line-height: var(--gm-baseline, 24px);
    }
    .blurb {
      position: relative;
      display: grid;
      gap: 12px;
      padding: 12px;
      border: 1px solid transparent;
      border-radius: 8px;
      box-sizing: border-box;
      cursor: crosshair;
    }
    .blurb-top {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 12px;
      align-items: start;
    }
    .blurb-copy {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .blurb-kicker,
    .blurb-title,
    .blurb-subhead,
    .blurb-body,
    .blurb-caption {
      margin: 0;
    }
    .blurb-kicker {
      font-size: 10px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .blurb-title {
      font-size: 20px;
      font-weight: 700;
      line-height: 1.2;
    }
    .blurb-subhead {
      font-size: 14px;
      font-weight: 600;
      line-height: 1.3;
    }
    .blurb-body {
      font-size: 12px;
      line-height: 1.45;
    }
    .blurb-caption {
      font-size: 11px;
      line-height: 1.35;
    }
    .blurb-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin: 0;
    }
    .blurb-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 0 0 2px;
      padding: 4px 0 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      font-size: 11px;
    }
    .blurb-nav-link,
    .blurb-link {
      text-decoration: underline;
      font-size: 12px;
    }
    .blurb-nav-link {
      font-size: 11px;
      font-weight: 600;
    }
    .blurb-code {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;
    }
    .blurb-figure {
      margin: 0;
      display: grid;
      gap: 4px;
      width: 120px;
    }
    .blurb-image-wrap {
      display: block;
      width: 100%;
      border-radius: 4px;
    }
    .blurb-cube-scene {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      perspective: 420px;
      perspective-origin: 50% 50%;
    }
    .blurb-cube {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
    }
    .blurb-cube-face {
      position: absolute;
      inset: 0;
      display: block;
      overflow: hidden;
      backface-visibility: hidden;
    }
    .blurb-cube-face.front { transform: translateZ(45px); }
    .blurb-cube-face.back { transform: rotateY(180deg) translateZ(45px); }
    .blurb-cube-face.right { transform: rotateY(90deg) translateZ(60px); }
    .blurb-cube-face.left { transform: rotateY(-90deg) translateZ(60px); }
    .blurb-cube-face .blurb-image {
      width: 100%;
      height: 100%;
      aspect-ratio: auto;
      border-radius: 0;
    }
    .blurb-image {
      display: block;
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      border-radius: 4px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: #2a2438;
    }
    .blurb-image-caption {
      margin: 0;
      font-size: 10px;
      line-height: 1.3;
      font-style: italic;
      text-align: center;
    }
    .blurb-surfaces {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 8px;
    }
    .blurb-card {
      display: grid;
      gap: 6px;
      padding: 10px;
      border: 1px solid transparent;
      border-radius: 6px;
      box-sizing: border-box;
    }
    .blurb-card-label {
      margin: 0;
      font-size: 9px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0.72;
      pointer-events: none;
    }
    .blurb-card-title {
      margin: 0;
      font-size: 13px;
      font-weight: 650;
      line-height: 1.25;
    }
    .blurb-card-body {
      margin: 0;
      font-size: 11px;
      line-height: 1.4;
    }
    .blurb-gui {
      display: grid;
      gap: 8px;
      padding: 10px;
      border: 1px solid transparent;
      border-radius: 6px;
      box-sizing: border-box;
    }
    .blurb-gui-label {
      margin: 0;
      font-size: 9px;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      opacity: 0.72;
      pointer-events: none;
    }
    .blurb-field {
      width: 100%;
      margin: 0;
      padding: 6px 8px;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font-size: 11px;
      line-height: 1.3;
      box-sizing: border-box;
      pointer-events: auto;
    }
    .blurb-button {
      justify-self: start;
      margin: 0;
      padding: 5px 10px;
      border: 1px solid transparent;
      border-radius: 4px;
      background: transparent;
      color: inherit;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.3;
    }
    [data-gmixer-preview-role],
    [data-gmixer-preview-media] {
      outline: 1px solid transparent;
      outline-offset: 1px;
      transition: outline-color 0.12s ease;
    }
    .is-hovered {
      outline-color: rgba(167, 139, 250, 0.55) !important;
    }
    .is-pinned {
      outline-color: rgba(167, 139, 250, 0.95) !important;
      outline-width: 2px;
    }

    .preview-inspect {
      position: absolute;
      z-index: 30;
      max-width: min(280px, calc(100% - 16px));
      pointer-events: none;
      box-sizing: border-box;
    }
    .preview-inspect[data-mode='pinned'] {
      pointer-events: auto;
    }
    .inspect-tooltip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(20, 16, 28, 0.94);
      color: #f2eefc;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      font: 600 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: 0.02em;
      white-space: nowrap;
    }
    .inspect-swatch {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      border: 1px solid rgba(255, 255, 255, 0.35);
      flex: 0 0 auto;
    }
    .inspect-panel {
      display: grid;
      gap: 8px;
      min-width: 220px;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(20, 16, 28, 0.96);
      color: #f2eefc;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    }
    .inspect-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .inspect-title {
      margin: 0;
      font: 700 12px/1.2 system-ui, sans-serif;
      letter-spacing: 0.02em;
    }
    .inspect-dismiss {
      margin: 0;
      padding: 0 4px;
      border: 0;
      background: transparent;
      color: inherit;
      font-size: 16px;
      line-height: 1;
      cursor: pointer;
      opacity: 0.7;
    }
    .inspect-dismiss:hover,
    .inspect-dismiss:focus-visible {
      opacity: 1;
      outline: none;
    }
    .inspect-row {
      display: grid;
      grid-template-columns: 1fr auto auto;
      gap: 6px;
      align-items: center;
    }
    .inspect-row.stack {
      grid-template-columns: 1fr;
    }
    .inspect-label {
      margin: 0;
      font-size: 10px;
      opacity: 0.7;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .inspect-panel input[type='color'] {
      width: 36px;
      height: 28px;
      padding: 0;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
    }
    .inspect-panel select,
    .inspect-panel button.auto {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: inherit;
      border-radius: 4px;
      font-size: 11px;
      padding: 4px 6px;
      cursor: pointer;
    }
    .inspect-panel button.auto:disabled {
      opacity: 0.35;
      cursor: default;
    }
    .inspect-panel .toggle-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
    }
    .inspect-panel gmixer-font-picker {
      display: block;
      width: 100%;
    }
    @media (max-width: 560px) {
      .blurb-top {
        grid-template-columns: 1fr;
      }
      .blurb-figure {
        width: 100%;
        max-width: 160px;
      }
    }
  `;

  constructor() {
    super();
    this.hidePackName = false;
    this._hoverTarget = null;
    this._pinnedTarget = null;
    this._tooltipX = 0;
    this._tooltipY = 0;
    this._pinX = 0;
    this._pinY = 0;
    this._onDocKeyDown = this._onDocKeyDown.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('keydown', this._onDocKeyDown);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this._onDocKeyDown);
  }

  _onDocKeyDown(event) {
    if (event.key === 'Escape' && this._pinnedTarget) {
      this._pinnedTarget = null;
      this._hoverTarget = null;
    }
  }

  /**
   * @param {PointerEvent} event
   */
  _localPoint(event) {
    const root = this.renderRoot?.querySelector?.('.theme-preview');
    if (!root) return { x: 0, y: 0 };
    const rect = root.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  /**
   * @param {Event} event
   */
  _targetFromEvent(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    for (const node of path) {
      if (!(node instanceof Element)) continue;
      if (node.hasAttribute('data-gmixer-preview-inspect')) return null;
      const hit = resolvePreviewTarget(node, this.renderRoot);
      if (hit) return hit;
    }
    return resolvePreviewTarget(event.target, this.renderRoot);
  }

  /**
   * @param {PointerEvent} event
   */
  _onPreviewPointerMove(event) {
    if (this._pinnedTarget) return;
    const point = this._localPoint(event);
    this._tooltipX = point.x + 12;
    this._tooltipY = point.y + 14;
    this._hoverTarget = this._targetFromEvent(event);
  }

  _onPreviewPointerLeave() {
    if (!this._pinnedTarget) this._hoverTarget = null;
  }

  /**
   * @param {MouseEvent} event
   */
  _onPreviewClick(event) {
    if (event.target instanceof Element && event.target.closest('[data-gmixer-preview-inspect]')) {
      return;
    }
    const target = this._targetFromEvent(event);
    if (!target) {
      this._pinnedTarget = null;
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (samePreviewTarget(this._pinnedTarget, target)) {
      this._pinnedTarget = null;
      this._hoverTarget = target;
      return;
    }
    const point = this._localPoint(event);
    this._pinX = point.x + 12;
    this._pinY = point.y + 14;
    this._pinnedTarget = target;
    this._hoverTarget = null;
  }

  _dismissPinned(event) {
    event?.stopPropagation?.();
    this._pinnedTarget = null;
  }

  /**
   * @param {string} roleId
   * @param {string} hex
   */
  _setRoleColor(roleId, hex) {
    this.updateGlobal({
      color: {
        overrides: {
          [roleId]: hex,
        },
      },
    });
  }

  /**
   * @param {string} roleId
   */
  _clearRoleColor(roleId) {
    this._setRoleColor(roleId, '');
  }

  /**
   * @param {string} slotKey
   * @param {string} fontId
   */
  _setFontSlot(slotKey, fontId) {
    this.updateGlobal({
      fonts: fontsPatchForPreviewSlot(slotKey, fontId),
    });
  }

  /**
   * @param {Partial<{enabled: boolean, preset: string}>} patch
   */
  _setImageFilter(patch) {
    const next = { imageFilter: { ...patch } };
    if (patch.enabled === true) {
      next.sections = { filter: true };
      const current = this.state?.global?.imageFilter;
      if ((!current?.preset || current.preset === 'none') && !patch.preset) {
        next.imageFilter.preset = 'monochrome';
      }
    }
    this.updateGlobal(next);
  }

  /**
   * Combine hover + pin highlight for a leaf's annotation identity.
   * @param {{ roleId?: string|null, fontSlot?: string|null, media?: string|null }} leaf
   */
  _leafHighlightClass(leaf) {
    const asTarget = {
      roleId: leaf.roleId ?? null,
      fontSlot: leaf.fontSlot ?? null,
      media: leaf.media ?? null,
      label: '',
    };
    if (samePreviewTarget(this._pinnedTarget, asTarget)) return 'is-pinned';
    if (!this._pinnedTarget && samePreviewTarget(this._hoverTarget, asTarget)) return 'is-hovered';
    return '';
  }

  /**
   * Clamp floating UI inside the preview card.
   * @param {number} x
   * @param {number} y
   * @param {number} [width]
   * @param {number} [height]
   */
  _clampPos(x, y, width = 240, height = 40) {
    const root = this.renderRoot?.querySelector?.('.theme-preview');
    const rw = root?.clientWidth || 320;
    const rh = root?.clientHeight || 240;
    const left = Math.max(8, Math.min(x, rw - width - 8));
    const top = Math.max(8, Math.min(y, rh - height - 8));
    return { left, top };
  }

  _renderInspector(colors) {
    const pinned = this._pinnedTarget;
    const hover = !pinned ? this._hoverTarget : null;
    if (!pinned && !hover) return null;

    if (hover) {
      const { left, top } = this._clampPos(this._tooltipX, this._tooltipY, 180, 28);
      const swatch = hover.roleId ? colors[hover.roleId] : null;
      return html`
        <div
          class="preview-inspect"
          data-mode="hover"
          data-gmixer-preview-inspect
          style="left:${left}px;top:${top}px"
        >
          <div class="inspect-tooltip" role="status">
            ${swatch
              ? html`<span class="inspect-swatch" style="background:${swatch}"></span>`
              : null}
            <span>${hover.label}</span>
          </div>
        </div>
      `;
    }

    const { left, top } = this._clampPos(this._pinX, this._pinY, 260, 160);
    const roleId = pinned.roleId;
    const override = roleId ? this.state?.global?.color?.overrides?.[roleId] || '' : '';
    const effective = roleId ? override || colors[roleId] : '';
    const fontSlot = pinned.fontSlot ? PREVIEW_FONT_SLOTS[pinned.fontSlot] : null;
    const fonts = this.state?.global?.fonts;
    const fontId = fontSlot ? fontIdForPreviewSlot(fonts, pinned.fontSlot) : '';
    const filter = this.state?.global?.imageFilter || {};
    const colorOn = this.state?.global?.sections?.color !== false;
    const filterOn = this.state?.global?.sections?.filter === true && filter.enabled;
    const presetOptions = MEDIA_FILTER_PRESETS.filter(
      (preset) => !preset.requiresColor || colorOn || preset.id === filter.preset
    );

    return html`
      <div
        class="preview-inspect"
        data-mode="pinned"
        data-gmixer-preview-inspect
        style="left:${left}px;top:${top}px"
        @pointerdown=${(e) => e.stopPropagation()}
        @click=${(e) => e.stopPropagation()}
      >
        <div
          class="inspect-panel"
          role="dialog"
          aria-label=${`Edit ${pinned.label}`}
        >
          <div class="inspect-header">
            <p class="inspect-title">${pinned.label}</p>
            <button
              type="button"
              class="inspect-dismiss"
              aria-label="Close"
              @click=${this._dismissPinned}
            >×</button>
          </div>

          ${roleId
            ? html`
                <div class="inspect-row">
                  <p class="inspect-label">Color</p>
                  <input
                    type="color"
                    .value=${effective || '#000000'}
                    aria-label=${`${pinned.label} color`}
                    title=${override ? 'Custom override' : 'Generated — change to override'}
                    @input=${(e) => this._setRoleColor(roleId, e.target.value)}
                  />
                  <button
                    type="button"
                    class="auto"
                    ?disabled=${!override}
                    @click=${() => this._clearRoleColor(roleId)}
                  >Auto</button>
                </div>
              `
            : null}

          ${fontSlot
            ? html`
                <div class="inspect-row stack">
                  <p class="inspect-label">${fontSlot.label} font</p>
                  <gmixer-font-picker
                    .target=${fontSlot.pickerTarget}
                    .value=${fontId}
                    @change=${(e) => this._setFontSlot(pinned.fontSlot, e.detail.value)}
                  ></gmixer-font-picker>
                </div>
              `
            : null}

          ${pinned.media === 'image'
            ? html`
                <div class="inspect-row stack">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      .checked=${filterOn}
                      @change=${(e) => this._setImageFilter({ enabled: e.target.checked })}
                    />
                    Apply image filter
                  </label>
                  <select
                    aria-label="Image filter preset"
                    .value=${filter.preset || 'none'}
                    @change=${(e) => {
                      const preset = e.target.value;
                      this._setImageFilter({
                        preset,
                        enabled: preset !== 'none',
                      });
                    }}
                  >
                    ${presetOptions.map(
                      (preset) => html`
                        <option value=${preset.id} ?selected=${preset.id === (filter.preset || 'none')}>
                          ${preset.label}
                        </option>
                      `
                    )}
                  </select>
                  ${!colorOn && PALETTE_FILTER_PRESETS.has(filter.preset)
                    ? html`<p class="inspect-label">Palette wash needs Color on</p>`
                    : null}
                </div>
              `
            : null}
        </div>
      </div>
    `;
  }

  render() {
    const global = this.state?.global;
    const activeId = global?.activeThemePackId;
    const activeMode = global?.themeMode || 'dark';
    const pack = THEME_PACKS.find((item) => item.id === activeId) || THEME_PACKS[0];
    const basePalette = paletteForPack(pack, activeMode);
    const colors = global?.color
      ? effectiveRoleColors(global)
      : roleColors(basePalette, {}, false);
    const fonts = {
      ...(pack.patch?.fonts || {}),
      ...(global?.fonts || {}),
    };
    const headerFamily = fontFamily(
      fonts.headings?.h1?.fontId || fonts.headers?.fontId
    );
    const subheadFamily = fontFamily(
      fonts.headings?.h2?.fontId || fonts.subheadings?.fontId || fonts.headers?.fontId
    );
    const bodyFamily = fontFamily(fonts.paragraph?.fontId);
    const captionFamily = fontFamily(fonts.captions?.fontId);
    const uiFamily = fontFamily(fonts.ui?.fontId || fonts.paragraph?.fontId);
    const codeFamily = fontFamily(fonts.code?.fontId);
    const filterState = global?.imageFilter;
    const filterSectionOn = global?.sections?.filter === true;
    const colorOn = global?.sections?.color === true;
    // Match page paint: Media section + imageFilter.enabled, and only when
    // scope includes images (the sample is an <img>, not a background).
    const applyPreviewFilter =
      filterSectionOn &&
      filterState?.enabled &&
      filterState.scope !== 'backgrounds' &&
      filterState.preset &&
      filterState.preset !== 'none';
    const packFallbackFilter =
      !applyPreviewFilter && pack.media?.defaultFilter && pack.media.defaultFilter !== 'none'
        ? pack.media.defaultFilter
        : !applyPreviewFilter && pack.patch?.imageFilter?.enabled
          ? pack.patch.imageFilter.preset
          : 'none';
    const mediaFilter = applyPreviewFilter ? filterState.preset : packFallbackFilter;
    const mediaFilterCss =
      mediaFilter && mediaFilter !== 'none'
        ? imageFilterPresetCss(mediaFilter, colors, filterState?.customFilter || '', { colorOn })
        : 'none';
    const effectsOn = previewEffectsActive(global);
    const previewEffectsCss = effectsOn
      ? buildPreviewEffectsCss(global.effects, {
          accent: colors.accent,
          link: colors.link,
          navLink: colors.navLink,
        })
      : '';
    const useRotatingCube =
      effectsOn && global.effects?.categories?.images?.effect === 'rotating-cube';

    const hl = (leaf) => this._leafHighlightClass(leaf);

    const previewImage = (face = '') => html`
      <img
        class=${`blurb-image ${face} ${hl({ media: 'image' })}`.trim()}
        src=${SAMPLE_IMAGE_SRC}
        alt=""
        width="160"
        height="120"
        data-gmixer-preview-media="image"
        data-filter=${mediaFilter === 'none' ? '' : mediaFilter}
        style=${mediaFilterCss !== 'none' ? `filter: ${mediaFilterCss}` : ''}
        draggable="false"
      />
    `;

    return html`
      ${previewEffectsCss
        ? html`<style>${previewEffectsCss}</style>`
        : null}
      <div class="theme-preview">
        ${this.hidePackName ? null : html`<strong class="pack-name">${pack.label}</strong>`}
        <div
          class=${`blurb ${hl({ roleId: 'background' })}`.trim()}
          data-gmixer-preview-role="background"
          style="
            background: ${colors.background};
            color: ${colors.text};
            border-color: ${colors.border};
          "
          aria-label="${pack.label} preview"
          @pointermove=${this._onPreviewPointerMove}
          @pointerleave=${this._onPreviewPointerLeave}
          @click=${this._onPreviewClick}
        >
          <p
            class="blurb-nav"
            style="font-family: ${uiFamily}; border-color: ${colors.border}"
          >
            <span
              class=${`blurb-nav-link ${hl({ roleId: 'navLink', fontSlot: 'ui' })}`.trim()}
              data-gmixer-preview-role="navLink"
              data-gmixer-preview-font="ui"
              style="color: ${colors.navLink}"
              >Home</span
            >
            <span
              class=${`blurb-nav-link ${hl({ roleId: 'navLink', fontSlot: 'ui' })}`.trim()}
              data-gmixer-preview-role="navLink"
              data-gmixer-preview-font="ui"
              style="color: ${colors.navLink}"
              >Topics</span
            >
            <span
              class=${`blurb-nav-link ${hl({ roleId: 'navLink', fontSlot: 'ui' })}`.trim()}
              data-gmixer-preview-role="navLink"
              data-gmixer-preview-font="ui"
              style="color: ${colors.navLink}"
              >About</span
            >
          </p>
          <div class="blurb-top">
            <div class="blurb-copy">
              <p
                class=${`blurb-kicker ${hl({ roleId: 'muted', fontSlot: 'captions' })}`.trim()}
                data-gmixer-preview-role="muted"
                data-gmixer-preview-font="captions"
                style="font-family: ${captionFamily}; color: ${colors.muted}"
              >
                Caption / kicker
              </p>
              <p
                class=${`blurb-title ${hl({ roleId: 'accent', fontSlot: 'headings.h1' })}`.trim()}
                data-gmixer-preview-role="accent"
                data-gmixer-preview-font="headings.h1"
                style="font-family: ${headerFamily}; color: ${colors.accent}"
              >
                ${pack.label} headline
              </p>
              <p
                class=${`blurb-subhead ${hl({ roleId: 'link', fontSlot: 'headings.h2' })}`.trim()}
                data-gmixer-preview-role="link"
                data-gmixer-preview-font="headings.h2"
                style="font-family: ${subheadFamily}; color: ${colors.link}"
              >
                Subheading for section hierarchy
              </p>
              <p
                class=${`blurb-body ${hl({ roleId: 'text', fontSlot: 'paragraph' })}`.trim()}
                data-gmixer-preview-role="text"
                data-gmixer-preview-font="paragraph"
                style="font-family: ${bodyFamily}; color: ${colors.text}"
              >
                ${pack.description}
              </p>
              <p
                class=${`blurb-caption ${hl({ roleId: 'muted', fontSlot: 'captions' })}`.trim()}
                data-gmixer-preview-role="muted"
                data-gmixer-preview-font="captions"
                style="font-family: ${captionFamily}; color: ${colors.muted}"
              >
                Caption text for asides, timestamps, and supporting notes.
              </p>
              <p class="blurb-meta">
                <span
                  class=${`blurb-link ${hl({ roleId: 'link', fontSlot: 'paragraph' })}`.trim()}
                  data-gmixer-preview-role="link"
                  data-gmixer-preview-font="paragraph"
                  style="font-family: ${bodyFamily}; color: ${colors.link}"
                  >Sample link</span
                >
                <code
                  class=${`blurb-code ${hl({ roleId: 'surfaceContainers', fontSlot: 'code' })}`.trim()}
                  data-gmixer-preview-role="surfaceContainers"
                  data-gmixer-preview-font="code"
                  style="
                    font-family: ${codeFamily};
                    background: ${colors.surfaceContainers};
                    border: 1px solid ${colors.border};
                    color: ${colors.text};
                  "
                  >code.sample()</code
                >
              </p>
            </div>
            <figure class="blurb-figure">
              <span class="blurb-image-wrap">
                ${useRotatingCube
                  ? html`
                      <span class="blurb-cube-scene">
                        <span class="blurb-cube">
                          <span class="blurb-cube-face front">${previewImage()}</span>
                          <span class="blurb-cube-face back">${previewImage()}</span>
                          <span class="blurb-cube-face right">${previewImage()}</span>
                          <span class="blurb-cube-face left">${previewImage()}</span>
                        </span>
                      </span>
                    `
                  : previewImage()}
              </span>
              <figcaption
                class=${`blurb-image-caption ${hl({ roleId: 'muted', fontSlot: 'captions' })}`.trim()}
                data-gmixer-preview-role="muted"
                data-gmixer-preview-font="captions"
                style="font-family: ${captionFamily}; color: ${colors.muted}"
              >
                Sample photo caption
              </figcaption>
            </figure>
          </div>
          <div class="blurb-surfaces">
            <div
              class=${`blurb-card ${hl({ roleId: 'surfaceContainers' })}`.trim()}
              data-gmixer-preview-role="surfaceContainers"
              style="
                background: ${colors.surfaceContainers};
                border-color: ${colors.border};
                color: ${colors.text};
              "
            >
              <p class="blurb-card-label" style="font-family: ${uiFamily}">
                Surface: Containers
              </p>
              <p
                class=${`blurb-card-title ${hl({ roleId: 'accent', fontSlot: 'headings.h1' })}`.trim()}
                data-gmixer-preview-role="accent"
                data-gmixer-preview-font="headings.h1"
                style="font-family: ${headerFamily}; color: ${colors.accent}"
              >
                Card title
              </p>
              <p
                class=${`blurb-card-body ${hl({ roleId: 'text', fontSlot: 'paragraph' })}`.trim()}
                data-gmixer-preview-role="text"
                data-gmixer-preview-font="paragraph"
                style="font-family: ${bodyFamily}"
              >
                Larger regions like cards and dialogs.
              </p>
            </div>
            <div
              class=${`blurb-gui ${hl({ roleId: 'backgroundSecondary' })}`.trim()}
              data-gmixer-preview-role="backgroundSecondary"
              style="
                background: ${colors.backgroundSecondary};
                border-color: ${colors.border};
                color: ${colors.text};
              "
            >
              <p class="blurb-gui-label" style="font-family: ${uiFamily}">
                BG:Secondary
              </p>
              <input
                class=${`blurb-field ${hl({ roleId: 'surfaceGui', fontSlot: 'ui' })}`.trim()}
                type="text"
                readonly
                tabindex="-1"
                value="Text input"
                data-gmixer-preview-role="surfaceGui"
                data-gmixer-preview-font="ui"
                style="
                  font-family: ${uiFamily};
                  background: ${colors.surfaceGui};
                  border-color: ${colors.border};
                  color: ${colors.text};
                  outline-color: ${colors.focus};
                "
              />
              <button
                type="button"
                class=${`blurb-button ${hl({ roleId: 'surfaceGui', fontSlot: 'ui' })}`.trim()}
                tabindex="-1"
                data-gmixer-preview-role="surfaceGui"
                data-gmixer-preview-font="ui"
                style="
                  font-family: ${uiFamily};
                  background: ${colors.surfaceGui};
                  border-color: ${colors.border};
                  color: ${colors.text};
                  box-shadow: 0 0 0 1px ${colors.focus};
                "
              >
                Button
              </button>
            </div>
          </div>
        </div>
        ${this._renderInspector(colors)}
      </div>
    `;
  }
}

defineElement('gmixer-theme-preview-panel', ThemePreviewPanel);
