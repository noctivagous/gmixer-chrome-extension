import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { THEME_PACKS } from '../../config/theme-packs.js';
import { buildPalette } from '../../lib/color-theory.js';
import { getFontById } from '../../config/fonts.js';
import { createDefaultState } from '../../state/schema.js';
import { effectiveRoleColors, roleColors } from './palette-swatches.js';
import { buildPreviewEffectsCss, previewEffectsActive } from '../../lib/preview-effects-css.js';
import { imageFilterPresetCss } from '../../content/style-injector.js';
import { defineElement } from '../../lib/define-element.js';

function paletteForPack(pack, mode = 'dark') {
  const base = createDefaultState().global.color;
  const color = { ...base, ...(pack.patch?.color || {}) };
  return buildPalette(color.baseColor, color.scheme, mode);
}

function fontFamily(fontId) {
  return getFontById(fontId)?.family || 'system-ui, sans-serif';
}

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
 */
export class ThemePreviewPanel extends StoreBoundElement {
  static properties = {
    hidePackName: { type: Boolean, attribute: 'hide-pack-name' },
  };

  static styles = css`
    :host {
      display: grid;
      gap: var(--gm-space-2, 16px);
    }
    .theme-preview {
      display: grid;
      gap: 8px;
    }
    strong.pack-name {
      display: block;
      font-size: 14px;
      line-height: var(--gm-baseline, 24px);
    }
    .blurb {
      display: grid;
      gap: 12px;
      padding: 12px;
      border: 1px solid transparent;
      border-radius: 8px;
      box-sizing: border-box;
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
    const previewImage = (face = '') => html`
      <img
        class=${`blurb-image ${face}`.trim()}
        src=${SAMPLE_IMAGE_SRC}
        alt=""
        width="160"
        height="120"
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
          class="blurb"
          style="
            background: ${colors.background};
            color: ${colors.text};
            border-color: ${colors.border};
          "
          aria-label="${pack.label} preview"
        >
          <p
            class="blurb-nav"
            style="font-family: ${uiFamily}; border-color: ${colors.border}"
          >
            <span class="blurb-nav-link" style="color: ${colors.navLink}">Home</span>
            <span class="blurb-nav-link" style="color: ${colors.navLink}">Topics</span>
            <span class="blurb-nav-link" style="color: ${colors.navLink}">About</span>
          </p>
          <div class="blurb-top">
            <div class="blurb-copy">
              <p
                class="blurb-kicker"
                style="font-family: ${captionFamily}; color: ${colors.muted}"
              >
                Caption / kicker
              </p>
              <p
                class="blurb-title"
                style="font-family: ${headerFamily}; color: ${colors.accent}"
              >
                ${pack.label} headline
              </p>
              <p
                class="blurb-subhead"
                style="font-family: ${subheadFamily}; color: ${colors.link}"
              >
                Subheading for section hierarchy
              </p>
              <p class="blurb-body" style="font-family: ${bodyFamily}">
                ${pack.description}
              </p>
              <p
                class="blurb-caption"
                style="font-family: ${captionFamily}; color: ${colors.muted}"
              >
                Caption text for asides, timestamps, and supporting notes.
              </p>
              <p class="blurb-meta">
                <span
                  class="blurb-link"
                  style="font-family: ${bodyFamily}; color: ${colors.link}"
                  >Sample link</span
                >
                <code
                  class="blurb-code"
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
                class="blurb-image-caption"
                style="font-family: ${captionFamily}; color: ${colors.muted}"
              >
                Sample photo caption
              </figcaption>
            </figure>
          </div>
          <div class="blurb-surfaces">
            <div
              class="blurb-card"
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
                class="blurb-card-title"
                style="font-family: ${headerFamily}; color: ${colors.accent}"
              >
                Card title
              </p>
              <p class="blurb-card-body" style="font-family: ${bodyFamily}">
                Larger regions like cards and dialogs.
              </p>
            </div>
            <div
              class="blurb-gui"
              style="
                background: ${colors.backgroundSecondary};
                border-color: ${colors.border};
                color: ${colors.text};
              "
            >
              <p class="blurb-gui-label" style="font-family: ${uiFamily}">
                Surface: GUI
              </p>
              <input
                class="blurb-field"
                type="text"
                readonly
                tabindex="-1"
                value="Text input"
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
                class="blurb-button"
                tabindex="-1"
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
      </div>
    `;
  }
}

defineElement('gmixer-theme-preview-panel', ThemePreviewPanel);
