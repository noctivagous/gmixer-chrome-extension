import { html, css } from 'lit';
import { StoreBoundElement } from '../../popup/components/store-bound-element.js';
import { buildPalette } from '../../lib/color-theory.js';
import { getFontById } from '../../config/fonts.js';
import { defineElement } from '../../lib/define-element.js';

/**
 * Live mini-page preview of current theme parameters (WYSIWYG while backdrop
 * blur hides the real page).
 */
export class ThemePreview extends StoreBoundElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      min-height: 0;
      height: 100%;
      border-left: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      background: var(--gm-surface, #1c1826);
    }
    .label {
      flex: 0 0 var(--gm-baseline, 24px);
      display: flex;
      align-items: center;
      padding: 0 var(--gm-space-2, 16px);
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      opacity: 0.55;
      border-bottom: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
    }
    .stage {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: var(--gm-space-2, 16px);
    }
    .page {
      min-height: 100%;
      padding: var(--gm-space-2, 16px);
      border-radius: var(--gm-space-1, 8px);
      box-sizing: border-box;
    }
    h1 {
      margin: 0 0 var(--gm-baseline, 24px);
      font-size: 22px;
      line-height: var(--gm-baseline, 24px);
      font-weight: 600;
    }
    p {
      margin: 0 0 var(--gm-baseline, 24px);
      font-size: 14px;
      line-height: var(--gm-baseline, 24px);
    }
    .caption {
      margin: 0 0 var(--gm-baseline, 24px);
      font-size: 12px;
      line-height: var(--gm-baseline, 24px);
      opacity: 0.85;
    }
    a {
      line-height: var(--gm-baseline, 24px);
    }
    .media {
      display: block;
      width: 100%;
      height: calc(var(--gm-baseline, 24px) * 4);
      margin: 0 0 var(--gm-baseline, 24px);
      border: 0;
      background: linear-gradient(135deg, #666, #222);
    }
    .card {
      padding: var(--gm-space-2, 16px);
      border: 1px solid currentColor;
      margin: 0 0 var(--gm-baseline, 24px);
      font-size: 13px;
      line-height: var(--gm-baseline, 24px);
    }
    .btn {
      display: inline-block;
      padding: 0 var(--gm-space-2, 16px);
      min-height: var(--gm-baseline, 24px);
      line-height: var(--gm-baseline, 24px);
      border: 1px solid currentColor;
      background: transparent;
      color: inherit;
      cursor: default;
      font-size: 13px;
    }
  `;

  render() {
    const g = this.state?.global;
    if (!g) return html``;

    const palette = buildPalette(g.color.baseColor, g.color.scheme);
    const o = g.color.overrides || {};
    const bg = o.background || palette.background;
    const text = o.text || palette.text;
    const accent = o.accent || palette.accent;
    const link = o.link || palette.link;
    const border = o.border || palette.border;

    const headerFont = getFontById(g.fonts.headers?.fontId)?.family || 'system-ui';
    const bodyFont = getFontById(g.fonts.paragraph?.fontId)?.family || 'system-ui';
    const captionFont = getFontById(g.fonts.captions?.fontId)?.family || 'system-ui';

    const filter = this._filterCss(g.imageFilter, palette);
    const clip = this._clipCss(g.clipping);
    const glow = g.effects?.glow?.enabled
      ? `0 0 8px ${g.effects.glow.color || accent}`
      : 'none';

    return html`
      <div class="label">Preview</div>
      <div class="stage">
        <div
          class="page"
          style="background:${bg}; color:${text}; border:1px solid ${border}"
        >
          <h1 style="font-family:${headerFont}; color:${accent}">Sample Heading</h1>
          <p style="font-family:${bodyFont}">
            Body text remixes the page toward your theme. Intensity and fonts update here live.
          </p>
          <p class="caption" style="font-family:${captionFont}">Caption / secondary line</p>
          <p>
            <a href="#" style="color:${link}; text-shadow:${glow}" @click=${(e) => e.preventDefault()}
              >Sample link</a
            >
          </p>
          <div class="media" style="filter:${filter}; ${clip}"></div>
          <div class="card" style="border-color:${border}; ${clip}">
            Card surface — clipping & corner shape preview
          </div>
          <span class="btn" style="border-color:${border}; color:${accent}; ${clip}">Button</span>
        </div>
      </div>
    `;
  }

  _filterCss(imageFilter, palette) {
    if (!imageFilter?.enabled) return 'none';
    const presets = {
      grayscale: 'grayscale(1)',
      sepia: 'sepia(0.8)',
      invert: 'invert(1)',
      monochrome: 'grayscale(1) contrast(1.05)',
      duotone: `grayscale(1) brightness(1.05) sepia(1) hue-rotate(${palette.isDark ? '260deg' : '20deg'})`,
      custom: imageFilter.customFilter || 'none',
    };
    return presets[imageFilter.preset] ?? 'none';
  }

  _clipCss(clipping) {
    if (!clipping?.enabled || clipping.preset === 'none') return '';
    const shapes = {
      round: 'corner-shape: superellipse(2); border-radius: 14px;',
      notch: 'corner-shape: bevel; border-radius: 10px;',
      mixed:
        'corner-shape: superellipse(2) bevel superellipse(2) bevel; border-radius: 14px 10px 14px 10px;',
    };
    return shapes[clipping.preset] ?? '';
  }
}

defineElement('gmixer-theme-preview', ThemePreview);
