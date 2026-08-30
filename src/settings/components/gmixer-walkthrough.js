import { html, css, svg, unsafeCSS } from 'lit';
import { StoreBoundElement } from '../../popup/components/store-bound-element.js';
import { THEME_MODES } from '../../config/theme-packs.js';
import { buildPalette, SCHEMES, hexToHsl, hslToHex } from '../../lib/color-theory.js';
import { autoAssignSwatches } from '../../lib/swatch-board.js';
import { schemeHslTrackStyle } from '../../lib/hsl-slider-track.js';
import { defineElement } from '../../lib/define-element.js';
import { closeHostPopover, requestShellSwitch } from '../close-host-popover.js';
import {
  shellSegmentControlStyles,
  renderShellSegments,
} from '../shell-segment-control.js';
import {
  WALKTHROUGH_SLIDES,
  customizationLevelSelectStyles,
  effectiveCustomizationLevel,
  patchForCustomizationLevel,
  renderCustomizationLevelSelect,
  visibleWalkthroughSlides,
} from '../customization-level.js';
import { GRID_CSS_VARS } from '../tokens.js';

import '../../popup/components/color-panel.js';
import '../../popup/components/gmixer-color-wheel.js';
import '../../popup/components/gmixer-color-scheme-scales.js';
import {
  colorModeIcon,
  colorPickerFlowArrow,
  colorSchemePickerStyles,
  pickerFieldsetLegend,
} from '../../popup/components/color-scheme-picker-styles.js';
import '../../popup/components/image-filter-panel.js';
import '../../popup/components/fonts-panel.js';
import '../../popup/components/effects-panel.js';
import '../../popup/components/texture-panel.js';
import '../../popup/components/theme-preview-panel.js';
import '../../popup/components/clipping-panel.js';
import '../../popup/components/corners-panel.js';
import '../../popup/components/navigation-panel.js';
import './font-browser.js';

/** @param {number} angleDeg 0 = top, clockwise */
function schemeDot(angleDeg, fill, radius = 7) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const cx = 12 + Math.cos(rad) * radius;
  const cy = 12 + Math.sin(rad) * radius;
  return svg`<circle cx=${cx.toFixed(2)} cy=${cy.toFixed(2)} r="2.6" fill=${fill} />`;
}

function schemeIconRing() {
  return svg`
    <circle
      cx="12"
      cy="12"
      r="7"
      fill="none"
      stroke="currentColor"
      stroke-opacity="0.28"
      stroke-width="1"
    />
  `;
}

/** @param {string} schemeId */
function schemeCategoryIcon(schemeId) {
  const base = '#ef4444';
  const warm = '#f97316';
  const gold = '#eab308';
  const green = '#22c55e';
  const teal = '#14b8a6';
  const blue = '#3b82f6';
  const indigo = '#6366f1';

  /** @type {import('lit').TemplateResult} */
  let dots = svg``;
  switch (schemeId) {
    case 'analog':
      dots = svg`
        ${schemeDot(-28, warm)}
        ${schemeDot(0, base)}
        ${schemeDot(28, gold)}
      `;
      break;
    case 'complement':
      dots = svg`${schemeDot(0, base)} ${schemeDot(180, green)}`;
      break;
    case 'splitComplement':
      dots = svg`
        ${schemeDot(0, base)}
        ${schemeDot(152, teal)}
        ${schemeDot(208, indigo)}
      `;
      break;
    case 'triadic':
      dots = svg`
        ${schemeDot(0, base)}
        ${schemeDot(120, green)}
        ${schemeDot(240, blue)}
      `;
      break;
    case 'tetradic':
      dots = svg`
        ${schemeDot(0, base)}
        ${schemeDot(90, gold)}
        ${schemeDot(180, green)}
        ${schemeDot(270, blue)}
      `;
      break;
    default:
      dots = svg`${schemeDot(0, base)}`;
      break;
  }

  return html`
    <svg
      class="scheme-icon"
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
    >
      ${schemeIconRing()} ${dots}
    </svg>
  `;
}

/** @param {string} slideId */
function walkthroughTabIcon(slideId) {
  /** @type {Record<string, import('lit').SVGTemplateResult>} */
  const icons = {
    tone: svg`
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16" />
    `,
    color: svg`
      <path d="M12 3C7 3 3 7 3 12s4 9 9 9c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1a1.6 1.6 0 0 1 1.6-1.6h2c3.1 0 5.6-2.5 5.6-5.6C22 6.4 17.5 3 12 3Z" />
      <circle cx="8" cy="9" r=".6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7" r=".6" fill="currentColor" stroke="none" />
      <circle cx="16" cy="9" r=".6" fill="currentColor" stroke="none" />
    `,
    texture: svg`
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
    `,
    filter: svg`
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m4 17 4.5-4 3.5 3 3-3 5 4" />
    `,
    fonts: svg`
      <path d="M5 6V4h14v2" />
      <path d="M12 4v16" />
      <path d="M8 20h8" />
    `,
    effects: svg`
      <path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z" />
      <path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" />
    `,
    preview: svg`
      <rect width="18" height="14" x="3" y="5" rx="2" />
      <path d="M7 5V3h10v2" />
      <path d="M7 15h4" />
      <path d="M7 11h10" />
    `,
    shape: svg`
      <path d="M6 6h8l4 4v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z" />
      <path d="M14 6v4h4" />
    `,
    navigation: svg`
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3" />
      <path d="M12 18v3" />
      <path d="M3 12h3" />
      <path d="M18 12h3" />
    `,
    'font-browser': svg`
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
    `,
  };
  return html`
    <svg
      class="tab-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      ${icons[slideId] || icons.tone}
    </svg>
  `;
}

/**
 * Color Scheme HSL slider defaults per Tone. Dark is a low-chroma night
 * canvas; Light mirrors that as a pale wash; Gray stays mid-value with
 * less saturation so mid-lightness does not read as a strong tint.
 * @type {Record<'light'|'gray'|'dark', { s: number, l: number }>}
 */
const COLOR_SCHEME_HSL_BY_TONE = {
  dark: { s: 15, l: 15 },
  // Mid-canvas Gray must stay below ~45 L so dark-mode text/accents keep contrast.
  gray: { s: 10, l: 42 },
  light: { s: 18, l: 85 },
};

/**
 * gMixer Onboarding Walkthrough: 5 slides in a centered popover modal.
 */
export class GmixerWalkthrough extends StoreBoundElement {
  static properties = {
    currentSlide: { type: Number, state: true },
    showCompletion: { type: Boolean, reflect: true },
  };

  static styles = [
    colorSchemePickerStyles,
    shellSegmentControlStyles,
    customizationLevelSelectStyles,
    css`
    :host {
      all: initial;
      ${unsafeCSS(GRID_CSS_VARS)}
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      width: min(1120px, calc(90vw + 80px), calc(100vw - 32px));
      height: min(840px, calc(85vh + 80px));
      max-width: none;
      max-height: none;
      color: var(--gm-text, #f2eefc);
      background: var(--gm-bg, #14121a);
      font: 13px/var(--gm-line, 24px) system-ui, sans-serif;
      border-radius: 12px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      overflow: hidden;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
    }

    :host([showcompletion]) {
      position: fixed;
      inset: 0;
      margin: auto;
      width: min(440px, calc(100vw - 32px));
      height: fit-content;
    }

    .completion-dialog {
      display: grid;
      gap: 20px;
      padding: 28px;
      text-align: center;
    }

    .completion-dialog p {
      margin: 0;
      color: var(--gm-text, #f2eefc);
      font: 650 16px/1.45 system-ui, sans-serif;
    }

    .completion-dialog kbd {
      display: inline-block;
      padding: 2px 6px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.2));
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.08);
      font: 700 0.9em/1 system-ui, sans-serif;
    }

    .completion-dialog .nav {
      justify-self: center;
    }

    .header {
      padding: 0 0 var(--gm-space-2, 16px);
      border-bottom: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      text-align: center;
    }

    .titlebar {
      display: grid;
      grid-template-columns: 40px minmax(0, 1fr) 40px;
      align-items: center;
      gap: 8px;
      padding: var(--gm-space-2, 16px) var(--gm-space-3, 24px);
      border-bottom: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
    }

    .titlebar.revisit {
      grid-template-columns: minmax(0, 1.2fr) auto minmax(0, 1fr);
      gap: 12px;
    }

    .titlebar .brand {
      grid-column: 2;
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.01em;
      text-align: center;
    }

    .titlebar .shell-segments {
      grid-column: 1;
      justify-self: start;
      max-width: 280px;
      width: 100%;
    }

    .titlebar .titlebar-trailing {
      grid-column: 3;
      display: inline-flex;
      align-items: center;
      justify-self: end;
      gap: 10px;
    }

    .titlebar .shortcut {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      line-height: 1;
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
      white-space: nowrap;
    }

    .titlebar kbd {
      display: inline-block;
      min-width: 22px;
      padding: 0 6px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-bottom-width: 2px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.06);
      font: 11px/20px ui-monospace, monospace;
      text-align: center;
      color: var(--gm-text, #f2eefc);
    }

    .titlebar .close {
      grid-column: 3;
      justify-self: end;
      position: static;
      top: auto;
      right: auto;
      padding: 4px 8px;
      border: 0;
      background: transparent;
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
    }

    .titlebar.revisit .close {
      grid-column: auto;
      justify-self: auto;
    }

    .titlebar .close:hover,
    .titlebar .close:focus-visible {
      color: var(--gm-text, #f2eefc);
    }

    @media (max-width: 720px) {
      .titlebar.revisit {
        grid-template-columns: minmax(0, 1fr) auto;
        grid-template-rows: auto auto;
      }

      .titlebar.revisit .shell-segments {
        grid-column: 1 / -1;
        grid-row: 2;
        max-width: none;
      }

      .titlebar.revisit .brand {
        grid-column: 1;
        text-align: left;
      }

      .titlebar.revisit .titlebar-trailing {
        grid-column: 2;
      }
    }

    .tabs-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 10px 16px;
      margin: 16px var(--gm-space-3, 24px) 0;
    }

    .tabs {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-start;
      gap: 8px;
      flex: 1 1 auto;
      min-width: 0;
    }

    .tabs-row .customization-level-picker {
      flex: 0 0 auto;
      margin-left: auto;
    }

    .step-description {
      margin: 16px var(--gm-space-3, 24px) 0;
      padding: 12px 14px;
      border-radius: 8px;
      background: #2a2a2e;
      font-size: 14px;
      line-height: 1.45;
      text-align: left;
      color: var(--gm-muted, rgba(242, 238, 252, 0.75));
    }

    .step-description b {
      color: var(--gm-text, #f2eefc);
      font-weight: 650;
    }

    .tab {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 32px;
      padding: 6px 12px 6px 8px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.04);
      color: var(--gm-muted, rgba(242, 238, 252, 0.72));
      cursor: pointer;
      font: 650 11px/1.2 system-ui, sans-serif;
      letter-spacing: 0.02em;
      transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
    }

    .tab-icon {
      display: block;
      flex: 0 0 18px;
      width: 18px;
      height: 18px;
      opacity: 0.55;
    }

    .tab:hover,
    .tab:focus-visible {
      color: var(--gm-text, #f2eefc);
      border-color: rgba(255, 255, 255, 0.28);
      background: rgba(139, 92, 246, 0.12);
    }

    .tab:focus-visible {
      outline: 2px solid var(--gm-accent, #7c3aed);
      outline-offset: 2px;
    }

    .tab[aria-selected='true'] {
      color: var(--gm-text, #f2eefc);
      border-color: var(--gm-accent, #7c3aed);
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
    }

    .tab[aria-selected='true'] .tab-icon {
      opacity: 1;
      box-shadow: 0 0 8px var(--gm-accent, #7c3aed);
    }

    .content {
      flex: 1;
      min-width: 0;
      padding: var(--gm-space-3, 24px);
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #6d36c9 #11151c;
    }

    .main {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(300px, 360px);
      flex: 1;
      min-height: 0;
    }

    .preview {
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      padding: 0;
      overflow: hidden;
      border-left: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      background: rgba(0, 0, 0, 0.16);
    }

    .preview-card {
      display: flex;
      flex-direction: column;
      min-height: 0;
      flex: 1;
      overflow: hidden;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.12));
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.22);
    }

    .preview-titlebar {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 4px 12px;
      border-bottom: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      background: rgba(255, 255, 255, 0.04);
      color: var(--gm-text, #f2eefc);
      font: 700 11px/1.2 system-ui, sans-serif;
      letter-spacing: 0.04em;
      text-align: center;
    }

    .preview-body {
      flex: 1;
      min-height: 0;
      padding: 12px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #6d36c9 #11151c;
    }

    .slide {
      animation: fadeIn 300ms ease-out;
    }

    .slide:focus,
    .slide:focus-visible {
      outline: none;
    }

    gmixer-color-scheme-scales {
      outline: none;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: var(--gm-space-2, 16px) var(--gm-space-3, 24px);
      border-top: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      background: rgba(0, 0, 0, 0.18);
    }

    button.nav {
      padding: 8px 16px;
      border-radius: 6px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      background: rgba(255, 255, 255, 0.05);
      color: inherit;
      cursor: pointer;
      font-weight: 600;
      transition: all 150ms ease;
    }

    button.nav:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.25);
    }

    button.nav.primary {
      background: var(--gm-accent, #7c3aed);
      border-color: transparent;
      color: white;
    }

    button.nav.primary:hover {
      background: #8b5cf6;
      box-shadow: 0 0 12px rgba(124, 58, 237, 0.4);
    }

    button.nav.next {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    button.nav.next .tab-icon {
      opacity: 1;
      flex: 0 0 18px;
    }

    button.nav:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .scheme-options {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
    }

    .scheme-option {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 10px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.04);
      color: inherit;
      cursor: pointer;
      font: 600 12px/1.2 system-ui, sans-serif;
    }

    .scheme-option .scheme-icon {
      display: block;
      flex: 0 0 20px;
      width: 20px;
      height: 20px;
      overflow: visible;
    }

    .scheme-option:hover,
    .scheme-option[aria-pressed='true'] {
      border-color: var(--gm-accent, #7c3aed);
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
    }

    .color-mode-switch {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      overflow: hidden;
      width: min(100%, 280px);
      margin: 0 auto 20px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.25);
    }

    .color-mode-option {
      margin: 0;
      padding: 10px 12px;
      border: 0;
      border-right: 1px solid rgba(255, 255, 255, 0.1);
      background: transparent;
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
      cursor: pointer;
      font: 700 12px/1.2 system-ui, sans-serif;
      letter-spacing: 0.02em;
      text-align: center;
      transition: background 150ms ease, color 150ms ease, box-shadow 150ms ease;
    }

    .color-mode-option:last-child {
      border-right: 0;
    }

    .color-mode-option:hover {
      background: rgba(139, 92, 246, 0.1);
      color: var(--gm-text, #f2eefc);
    }

    .color-mode-option[aria-pressed='true'] {
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
      box-shadow: inset 0 -3px 0 var(--gm-accent, #7c3aed);
      color: var(--gm-text, #f2eefc);
    }

    .color-slide {
      display: grid;
      gap: 24px;
      justify-items: center;
    }

    .color-picker-flow {
      justify-self: stretch;
    }

    .scheme-fieldset .scheme-option {
      justify-content: center;
      min-width: 0;
    }

    .scheme-fieldset .scheme-option span {
      min-width: 0;
    }

    .grayscale-control {
      display: grid;
      gap: 10px;
      width: min(100%, 360px);
      padding: 16px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.12));
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.18);
    }

    .grayscale-control-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: baseline;
      color: var(--gm-text, #f2eefc);
      font: 700 12px/1.2 system-ui, sans-serif;
    }

    .grayscale-control output {
      color: var(--gm-muted, rgba(242, 238, 252, 0.72));
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    .grayscale-range {
      width: 100%;
      margin: 0;
      accent-color: var(--gm-accent, #7c3aed);
    }

    .grayscale-track {
      height: 10px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 999px;
      background: linear-gradient(to right, #161616, #ffffff);
    }

    .grayscale-hint {
      margin: 0;
      color: var(--gm-muted, rgba(242, 238, 252, 0.7));
      font: 11px/1.4 system-ui, sans-serif;
    }

    .tone-picker {
      display: grid;
      grid-template-columns: minmax(148px, 180px) minmax(0, 1fr);
      gap: 20px;
      align-items: stretch;
      margin-top: 8px;
    }

    .tone-tabs {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .tone-tab {
      display: grid;
      grid-template-columns: 56px minmax(0, 1fr);
      gap: 10px;
      align-items: center;
      padding: 10px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.12));
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.03);
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
      cursor: pointer;
      text-align: left;
      transition: border-color 150ms ease, background 150ms ease, box-shadow 150ms ease;
    }

    .tone-tab:hover {
      background: rgba(139, 92, 246, 0.08);
      border-color: rgba(255, 255, 255, 0.22);
    }

    .tone-tab[aria-selected='true'] {
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.22));
      border-color: var(--gm-accent, #7c3aed);
      box-shadow: inset 3px 0 0 var(--gm-accent, #7c3aed);
      color: var(--gm-text, #f2eefc);
    }

    .tone-tab:focus-visible {
      outline: 2px solid var(--gm-accent, #7c3aed);
      outline-offset: 2px;
    }

    .tone-tab-copy {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .tone-name {
      font: 700 13px/1.2 system-ui, sans-serif;
      letter-spacing: 0.01em;
    }

    .tone-caption {
      font: 10px/1.3 system-ui, sans-serif;
      opacity: 0.75;
    }

    .tone-tab[aria-selected='true'] .tone-caption {
      opacity: 0.9;
    }

    .tone-mock {
      width: 56px;
      height: 44px;
      border-radius: 6px;
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
    }

    .tone-mock-page {
      display: grid;
      grid-template-rows: 10px 1fr;
      width: 100%;
      height: 100%;
      border: 1px solid;
      border-radius: 6px;
      overflow: hidden;
    }

    .tone-mock-header {
      width: 100%;
      height: 100%;
    }

    .tone-mock-body {
      display: grid;
      gap: 3px;
      align-content: start;
      padding: 4px;
    }

    .tone-mock-card {
      width: 100%;
      height: 10px;
      border: 1px solid;
      border-radius: 2px;
    }

    .tone-mock-line {
      width: 100%;
      height: 2px;
      border-radius: 999px;
      opacity: 0.92;
    }

    .tone-mock-line.short {
      width: 72%;
    }

    .tone-detail {
      display: grid;
      gap: 16px;
      padding: 16px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.12));
      border-radius: 10px;
      background: rgba(0, 0, 0, 0.18);
    }

    .tone-detail-title {
      margin: 0;
      font: 700 15px/1.2 system-ui, sans-serif;
      color: var(--gm-text, #f2eefc);
    }

    .tone-detail-copy {
      margin: 0;
      font: 13px/1.45 system-ui, sans-serif;
      color: var(--gm-muted, rgba(242, 238, 252, 0.75));
    }

    .tone-detail-preview {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
      gap: 14px;
      align-items: center;
    }

    .tone-detail-mock {
      width: 100%;
      max-width: 220px;
      aspect-ratio: 4 / 3;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    }

    .tone-detail-mock .tone-mock-page {
      grid-template-rows: 18px 1fr;
      height: 100%;
      border-radius: 8px;
    }

    .tone-detail-mock .tone-mock-body {
      gap: 6px;
      padding: 10px;
    }

    .tone-detail-mock .tone-mock-card {
      height: 28px;
      border-radius: 4px;
    }

    .tone-detail-mock .tone-mock-line {
      height: 3px;
    }

    .tone-affects {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .tone-affects li {
      display: grid;
      grid-template-columns: 14px minmax(0, 1fr);
      gap: 8px;
      align-items: start;
      font: 12px/1.35 system-ui, sans-serif;
      color: var(--gm-muted, rgba(242, 238, 252, 0.78));
    }

    .tone-affects .swatch {
      width: 14px;
      height: 14px;
      margin-top: 1px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 3px;
    }

    @media (max-width: 560px) {
      .tone-picker {
        grid-template-columns: minmax(0, 1fr);
      }

      .tone-detail-preview {
        grid-template-columns: minmax(0, 1fr);
      }
    }

    @media (max-width: 760px) {
      :host {
        width: min(640px, 90vw);
      }

      .main {
        grid-template-columns: minmax(0, 1fr);
      }

      .preview {
        display: none;
      }
    }
  `,
  ];

  constructor() {
    super();
    this.currentSlide = 0;
    this.showCompletion = false;
    this._activatedSlides = new Set(['tone']);
  }

  /**
   * @param {Map<string, unknown>} changed
   */
  updated(changed) {
    super.updated?.(changed);
    this._clampSlideToVisible();
  }

  _isRevisit() {
    return !!this.state?.global?.ui?.walkthroughCompleted;
  }

  /** @returns {import('../../state/schema.js').CustomizationLevel} */
  _customizationLevel() {
    return effectiveCustomizationLevel(this.state?.global?.ui);
  }

  _visibleSlides() {
    return visibleWalkthroughSlides(this._customizationLevel());
  }

  /** Absolute indexes into WALKTHROUGH_SLIDES that are visible at the current level. */
  _visibleIndexes() {
    const level = this._customizationLevel();
    /** @type {number[]} */
    const indexes = [];
    WALKTHROUGH_SLIDES.forEach((slide, index) => {
      if (slide.level <= level) indexes.push(index);
    });
    return indexes;
  }

  _slideMeta(index = this.currentSlide) {
    return WALKTHROUGH_SLIDES[index] || WALKTHROUGH_SLIDES[0];
  }

  _clampSlideToVisible() {
    const visible = this._visibleIndexes();
    if (!visible.length) return;
    if (visible.includes(this.currentSlide)) return;
    const previous = [...visible].reverse().find((index) => index < this.currentSlide);
    this.currentSlide = previous ?? visible[0];
  }

  /**
   * @param {import('../../state/schema.js').CustomizationLevel} level
   */
  _setCustomizationLevel(level) {
    const global = this.state?.global;
    if (!global) return;
    const from = effectiveCustomizationLevel(global.ui);
    if (from === level) return;
    this.updateGlobal(patchForCustomizationLevel(from, level, global));
  }

  _next() {
    const visible = this._visibleIndexes();
    const position = visible.indexOf(this.currentSlide);
    if (position < 0) {
      this._selectSlide(visible[0] ?? 0);
      return;
    }
    if (position < visible.length - 1) {
      this._selectSlide(visible[position + 1]);
      return;
    }
    this._finish();
  }

  _prev() {
    const visible = this._visibleIndexes();
    const position = visible.indexOf(this.currentSlide);
    if (position > 0) {
      this.currentSlide = visible[position - 1];
    }
  }

  _selectSlide(index) {
    if (!this._isRevisit()) {
      this._applySlideDefaults(index);
    }
    this.currentSlide = index;
    this.updateComplete.then(() => {
      this.renderRoot.querySelector(`#walkthrough-slide-${index}`)?.focus();
    });
  }

  _onTabKeyDown(event, index) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const visible = this._visibleIndexes();
    const position = visible.indexOf(index);
    if (position < 0) return;
    const nextPosition =
      event.key === 'ArrowRight'
        ? (position + 1) % visible.length
        : (position - 1 + visible.length) % visible.length;
    const next = visible[nextPosition];
    this._selectSlide(next);
    this.updateComplete.then(() => {
      this.renderRoot.querySelector(`.tab[aria-controls="walkthrough-slide-${next}"]`)?.focus();
    });
  }

  _close() {
    this._dismissWalkthrough();
  }

  _finish() {
    const revisit = this._isRevisit();
    this.updateGlobal({ ui: { walkthroughCompleted: true } });
    if (revisit) {
      closeHostPopover();
      return;
    }
    this.showCompletion = true;
    this.updateComplete.then(() => {
      this.renderRoot.querySelector('.completion-dialog button')?.focus();
    });
  }

  _closeCompletion() {
    closeHostPopover();
  }

  /** Closing or finishing both permanently dismiss auto-open onboarding. */
  _dismissWalkthrough() {
    this.updateGlobal({ ui: { walkthroughCompleted: true } });
    closeHostPopover();
  }

  /**
   * @param {import('../../state/schema.js').PreferredShell} shell
   */
  _setPreferredShell(shell) {
    if (shell === 'walkthrough-modal') {
      this.updateGlobal({ ui: { preferredShell: 'walkthrough-modal' } });
      return;
    }
    this.updateGlobal({ ui: { preferredShell: 'side-panel' } });
    requestShellSwitch('side-panel');
  }

  _activateSection(id, event) {
    const control = event?.composedPath?.().find(
      (node) => node?.tagName === 'INPUT' || node?.tagName === 'SELECT'
    );
    // An explicit "off" checkbox selection is a choice not to opt in.
    if (
      (control?.tagName === 'INPUT' && control.type === 'checkbox' && !control.checked) ||
      event?.detail?.filterEnabled === false
    ) {
      return;
    }

    const patch = {
      activeThemePackId: 'user-made',
      sections: { [id]: true },
    };
    if (id === 'filter') patch.imageFilter = { enabled: true };
    if (id === 'navigation') patch.navigation = { enabled: true };
    this.updateGlobal(patch);
  }

  _applySlideDefaults(index) {
    const slideId = WALKTHROUGH_SLIDES[index]?.id;
    if (!slideId || this._activatedSlides.has(slideId)) return;
    this._activatedSlides.add(slideId);

    switch (slideId) {
      case 'color': {
        const baseColor = this._colorSchemeBaseForTone();
        const mode = this.state?.global?.themeMode || 'dark';
        this.updateGlobal({
          activeThemePackId: 'user-made',
          sections: { color: true },
          color: {
            baseColor,
            schemeBaseColor: baseColor,
            scheme: 'triadic',
            swatchAssignments: autoAssignSwatches(baseColor, 'triadic', mode),
          },
        });
        break;
      }
      case 'texture':
        this.updateGlobal({
          activeThemePackId: 'user-made',
          sections: { texture: true },
          texture: {
            mode: 'noise',
            surfaces: {
              'gui.button': true,
              'gui.input': true,
            },
          },
        });
        break;
      case 'filter':
        this.updateGlobal({
          activeThemePackId: 'user-made',
          sections: { filter: true },
          imageFilter: {
            enabled: true,
            revealOnHover: true,
            categories: {
              articleImages: 'accent-tint',
              images: 'monochrome',
              bgImages: 'monochrome',
              videos: 'link-wash',
              videoPlayback: 'link-wash',
            },
          },
        });
        break;
      case 'fonts':
        this.updateGlobal({
          activeThemePackId: 'user-made',
          sections: { fonts: true },
          fonts: {
            headings: {
              h1: { fontId: 'din-breit', customFontId: null },
              h2: { fontId: 'raleway', customFontId: null },
              h3: { fontId: 'outfit', customFontId: null },
              h4: { fontId: 'outfit', customFontId: null },
              h5: { fontId: 'outfit', customFontId: null },
              h6: { fontId: 'outfit', customFontId: null },
            },
            paragraph: { fontId: 'dm-sans', customFontId: null },
            captions: { fontId: 'tippa', customFontId: null },
          },
        });
        break;
      case 'effects':
        this.updateGlobal({
          activeThemePackId: 'user-made',
          sections: { effects: true },
          effects: {
            categories: {
              images: { effect: 'glow' },
              navigation: { effect: 'glow' },
            },
          },
        });
        break;
      case 'shape':
        this.updateGlobal({
          activeThemePackId: 'user-made',
          sections: { shape: true },
        });
        break;
      case 'navigation':
        this.updateGlobal({
          activeThemePackId: 'user-made',
          sections: { navigation: true },
          navigation: { enabled: true },
        });
        break;
      default:
        break;
    }
  }

  _tonePalette(mode) {
    const baseColor = this.state?.global?.color?.baseColor || '#8a8a8a';
    return buildPalette(baseColor, 'monochrome', mode);
  }

  _renderToneMock(palette, { detail = false } = {}) {
    const rootClass = detail ? 'tone-detail-mock' : 'tone-mock';
    return html`
      <div class=${rootClass} aria-hidden="true">
        <div
          class="tone-mock-page"
          style="background:${palette.background};border-color:${palette.border}"
        >
          <div class="tone-mock-header" style="background:${palette.backgroundSecondary}"></div>
          <div class="tone-mock-body">
            <div
              class="tone-mock-card"
              style="background:${palette.surfaceContainers};border-color:${palette.border}"
            ></div>
            <div class="tone-mock-line" style="background:${palette.text}"></div>
            <div class="tone-mock-line short" style="background:${palette.muted}"></div>
            <div class="tone-mock-line" style="background:${palette.text}"></div>
          </div>
        </div>
      </div>
    `;
  }

  _toneAffects(mode) {
    const affects = {
      light: [
        { label: 'Page background stays bright and airy', role: 'background' },
        { label: 'Body text shifts to dark ink on light surfaces', role: 'text' },
        { label: 'Cards and panels use soft gray elevation', role: 'surfaceContainers' },
        { label: 'Borders and dividers stay subtle and light', role: 'border' },
      ],
      gray: [
        { label: 'Page background settles into a neutral mid-tone', role: 'background' },
        { label: 'Text stays high-contrast without full dark mode', role: 'text' },
        { label: 'Cards and panels step up one shade for depth', role: 'surfaceContainers' },
        { label: 'Borders stay visible but not harsh', role: 'border' },
      ],
      dark: [
        { label: 'Page background drops to a low-light canvas', role: 'background' },
        { label: 'Body text flips to bright type on dark surfaces', role: 'text' },
        { label: 'Cards and panels lift slightly above the page', role: 'surfaceContainers' },
        { label: 'Borders and dividers stay dim but readable', role: 'border' },
      ],
    };
    return affects[mode] || affects.dark;
  }

  _selectTone(mode) {
    /** @type {Record<string, unknown>} */
    const patch = { themeMode: mode };
    if (this._isColorSchemeEnabled()) {
      const baseColor = this._colorSchemeBaseForTone(mode);
      patch.activeThemePackId = 'user-made';
      patch.color = { baseColor, schemeBaseColor: baseColor };
    }
    this.updateGlobal(patch);
  }

  _onToneTabKeyDown(event, index) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    const next = event.key === 'ArrowDown' ? (index + 1) % 3 : (index + 2) % 3;
    const mode = THEME_MODES[next]?.id;
    if (!mode) return;
    this._selectTone(mode);
    this.updateComplete.then(() => {
      this.renderRoot.querySelector(`.tone-tab[data-tone="${mode}"]`)?.focus();
    });
  }

  _isColorSchemeEnabled() {
    return this.state?.global?.sections?.color === true;
  }

  /**
   * Working color for the current tone after a hue pick. Hue comes from the
   * ring (s=1.0, l=0.5); tone supplies the default saturation/lightness.
   * @param {'light'|'gray'|'dark'} [mode]
   * @returns {string}
   */
  _colorSchemeBaseForTone(mode) {
    const themeMode = mode || this.state?.global?.themeMode || 'dark';
    const hsl = hexToHsl(this.state?.global?.color?.baseColor || '#8a8a8a');
    const defaults = COLOR_SCHEME_HSL_BY_TONE[themeMode] || COLOR_SCHEME_HSL_BY_TONE.dark;
    // Gray has H=0; use blue (210°) instead of red when Color is enabled.
    const h = hsl.s < 5 ? 210 : hsl.h;
    return hslToHex({ h, s: defaults.s, l: defaults.l });
  }

  _setScheme(schemeId) {
    const color = this.state?.global?.color;
    if (!color) return;
    const base = color.schemeBaseColor || color.baseColor;
    const mode = this.state?.global?.themeMode || 'dark';
    this.updateGlobal({
      activeThemePackId: 'user-made',
      sections: { color: true },
      color: {
        scheme: schemeId,
        swatchAssignments: autoAssignSwatches(base, schemeId, mode),
      },
    });
  }

  _setColorMode(useColor) {
    const color = this.state?.global?.color;
    if (!color) return;
    const hsl = hexToHsl(color.baseColor);

    if (useColor) {
      const scheme = color.scheme === 'monochrome' ? 'analog' : color.scheme;
      const baseColor = this._colorSchemeBaseForTone();
      const mode = this.state?.global?.themeMode || 'dark';
      this.updateGlobal({
        activeThemePackId: 'user-made',
        sections: { color: true },
        color: {
          scheme,
          baseColor,
          schemeBaseColor: baseColor,
          swatchAssignments: autoAssignSwatches(baseColor, scheme, mode),
        },
      });
      return;
    }

    this.updateGlobal({
      sections: { color: false },
      color: {
        scheme: 'monochrome',
        baseColor: hslToHex({ h: hsl.h, s: 0, l: hsl.l }),
        schemeBaseColor: hslToHex({ h: hsl.h, s: 0, l: hsl.l }),
      },
    });
  }

  _setMonochromeLightness(value) {
    const color = this.state?.global?.color;
    if (!color) return;
    const hsl = hexToHsl(color.baseColor);
    const lightness = Math.max(8, Math.min(92, Number(value)));
    const newHex = hslToHex({ h: hsl.h, s: 0, l: lightness });
    this.updateGlobal({
      activeThemePackId: 'user-made',
      sections: { color: false },
      color: {
        baseColor: newHex,
        schemeBaseColor: newHex,
        scheme: 'monochrome',
      },
    });
  }

  _setColorHsl(key, value) {
    const color = this.state?.global?.color;
    if (!color) return;
    const hsl = hexToHsl(color.baseColor);
    // Pipeline step 3: S/L refine the hue-ring pick. Do not rewrite scheme or hue.
    const newHex = hslToHex({ ...hsl, [key]: Number(value) });
    this.updateGlobal({
      activeThemePackId: 'user-made',
      sections: { color: true },
      color: { baseColor: newHex, schemeBaseColor: newHex },
    });
  }

  _renderColorHslSlider(shortLabel, label, value, min, max, key, baseColor, scheme) {
    return html`
      <label class="hsl-slider">
        <span class="hsl-slider-shell">
          <span
            class="hsl-track"
            style=${schemeHslTrackStyle(baseColor, scheme, key)}
            aria-hidden="true"
          ></span>
          <input
            type="range"
            min=${min}
            max=${max}
            step="1"
            .value=${String(Math.round(value))}
            aria-label=${label}
            @input=${(event) => this._setColorHsl(key, event.target.value)}
          />
        </span>
        <span>${shortLabel}</span>
      </label>
    `;
  }

  render() {
    // First-time Finish sets walkthroughCompleted before the completion dialog;
    // keep showing that dialog until OK rather than flipping into revisit chrome.
    if (this.showCompletion) {
      return html`
        <section
          class="completion-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="walkthrough-completion-message"
        >
          <p id="walkthrough-completion-message">
            Access gMixer Settings with <kbd>Alt</kbd>+<kbd>M</kbd> or the gMixer extension
            icon in your browser toolbar.
          </p>
          <button class="nav primary" @click=${this._closeCompletion}>OK</button>
        </section>
      `;
    }

    const revisit = this._isRevisit();
    const customizationLevel = this._customizationLevel();
    const visibleIndexes = this._visibleIndexes();
    const visiblePosition = visibleIndexes.indexOf(this.currentSlide);
    const isFirstVisible = visiblePosition <= 0;
    const isLastVisible = visiblePosition === visibleIndexes.length - 1;
    const nextIndex = !isLastVisible ? visibleIndexes[visiblePosition + 1] : -1;
    const nextMeta = nextIndex >= 0 ? this._slideMeta(nextIndex) : null;
    return html`
      <div class="header">
        <div class="titlebar ${revisit ? 'revisit' : ''}">
          ${revisit
            ? renderShellSegments({
                value: 'walkthrough-modal',
                onSelect: (shell) => this._setPreferredShell(shell),
              })
            : null}
          <h2 class="brand">${revisit ? 'gMixer' : 'Welcome to gMixer'}</h2>
          ${revisit
            ? html`
                <div class="titlebar-trailing">
                  <span
                    class="shortcut"
                    title="Toggle editor (also remappable in extension shortcuts)"
                  >
                    <kbd>Alt</kbd>+<kbd>M</kbd>
                  </span>
                  <button
                    type="button"
                    class="close"
                    aria-label="Close walkthrough"
                    @click=${this._close}
                  >
                    ×
                  </button>
                </div>
              `
            : html`
                <button
                  type="button"
                  class="close"
                  aria-label="Close walkthrough"
                  @click=${this._close}
                >
                  ×
                </button>
              `}
        </div>
        <div class="tabs-row">
          <div class="tabs" role="tablist" aria-label="Walkthrough steps">
            ${visibleIndexes.map((i, step) => {
              const meta = this._slideMeta(i);
              return html`
                <button
                  type="button"
                  class="tab"
                  role="tab"
                  aria-label=${`Step ${step + 1}: ${meta.label}`}
                  aria-selected=${i === this.currentSlide}
                  aria-controls=${`walkthrough-slide-${i}`}
                  tabindex=${i === this.currentSlide ? '0' : '-1'}
                  @click=${() => this._selectSlide(i)}
                  @keydown=${(event) => this._onTabKeyDown(event, i)}
                >${walkthroughTabIcon(meta.id)}<span>${meta.label}</span></button>
              `;
            })}
          </div>
          ${renderCustomizationLevelSelect({
            value: customizationLevel,
            id: 'walkthrough-customization-level',
            onChange: (level) => this._setCustomizationLevel(level),
          })}
        </div>
        <p class="step-description">${this._getDescription()}</p>
      </div>
      <div class="main">
        <div class="content">
          <div
            class="slide"
            id=${`walkthrough-slide-${this.currentSlide}`}
            role="tabpanel"
            tabindex="-1"
            aria-label=${this._getTitle()}
          >${this._renderSlide()}</div>
        </div>
        <aside class="preview">
          <div class="preview-card" aria-labelledby="walkthrough-preview-title">
            <div class="preview-titlebar" id="walkthrough-preview-title">Live Preview</div>
            <div class="preview-body">
              <gmixer-theme-preview-panel ?hide-pack-name=${true}></gmixer-theme-preview-panel>
            </div>
          </div>
        </aside>
      </div>
      <div class="footer">
        <button
          class="nav"
          ?disabled=${isFirstVisible}
          @click=${this._prev}
        >
          Back
        </button>
        <button class="nav primary next" @click=${this._next}>
          ${isLastVisible
            ? revisit
              ? 'Done'
              : 'Finish'
            : html`${walkthroughTabIcon(nextMeta.id)}
                <span>Next: ${nextMeta.label}</span>`}
        </button>
      </div>
    `;
  }

  _getTitle(index = this.currentSlide) {
    return this._slideMeta(index).label;
  }

  _getTabLabel(index = this.currentSlide) {
    return this._getTitle(index);
  }

  _getDescription(index = this.currentSlide) {
    const slideId = this._slideMeta(index).id;
    if (slideId === 'color') {
      return this._isColorSchemeEnabled()
        ? html`How do you want it to look? Scheme, then hue, then saturation and lightness. Surfaces are pinned to swatches — drag a label to move them.<br/>
            <b>We chose a Triadic color scheme for you.</b>`
        : html`Keep it neutral. Pick a gray base for your theme, or switch to Color for relationships.`;
    }
    const revisit = this._isRevisit();
    /** @type {Record<string, import('lit').TemplateResult>} */
    const descriptions = {
      tone: revisit
        ? html`Choose the light mode for pages.<br/>
            <b>We chose Dark tone for you.</b>`
        : html`Welcome to gMixer, a web page themer. To start, choose the light mode for pages.<br/>
            <b>We chose Dark tone for you.</b>`,
      texture: html`Add a surface texture layer — fine Noise, or a spaced Grid.<br/>
        <b>We chose Noise for you.</b>`,
      filter: html`How do you want images and videos to look?<br/>
        <b>We set accent-tint on article images, monochrome on images/bg, and link-wash on video.</b>`,
      fonts: html`Choose the typefaces that fit your style.<br/>
        <b>We set up some typefaces for you</b>`,
      effects: revisit
        ? html`Add visual effects to the page.<br/>
            <b>We made images and navigation glow.</b>`
        : html`Finally, add some visual effects to the page.<br/>
            <b>We made images and navigation glow.</b>`,
      preview: html`Preview how your theme reads on a sample page.<br/>
        <b>Live Preview updates as you customize.</b>`,
      shape: html`Clip images and round corners to match your style.<br/>
        <b>Shape controls stay off until you opt in.</b>`,
      navigation: html`Navigate pages with the keyboard outline and hotkeys.<br/>
        <b>Press F to click, D to go back, R to go forward.</b>`,
      'font-browser': html`Browse the full type catalog and assign fonts to roles.<br/>
        <b>Open any face to preview it in context.</b>`,
    };
    return descriptions[slideId] || html``;
  }

  _renderSlide() {
    switch (this._slideMeta().id) {
      case 'tone':
        return this._renderSlide1();
      case 'color':
        return this._renderSlide2();
      case 'texture':
        return this._renderTextureSlide();
      case 'filter':
        return this._renderSlide3();
      case 'fonts':
        return this._renderSlide4();
      case 'effects':
        return this._renderSlide5();
      case 'preview':
        return this._renderPreviewSlide();
      case 'shape':
        return this._renderShapeSlide();
      case 'navigation':
        return this._renderNavigationSlide();
      case 'font-browser':
        return this._renderFontBrowserSlide();
      default:
        return html``;
    }
  }

  _renderTextureSlide() {
    return html`
      <gmixer-texture-panel
        @change=${(event) => this._activateSection('texture', event)}
      ></gmixer-texture-panel>
    `;
  }

  _renderSlide1() {
    const activeMode = this.state?.global?.themeMode || 'dark';
    const activeModeMeta = THEME_MODES.find((mode) => mode.id === activeMode) || THEME_MODES[2];
    const activePalette = this._tonePalette(activeMode);
    return html`
      <div class="tone-picker">
        <div class="tone-tabs" role="tablist" aria-label="Select tone">
          ${THEME_MODES.map((mode, index) => {
            const palette = this._tonePalette(mode.id);
            return html`
              <button
                type="button"
                class="tone-tab"
                role="tab"
                data-tone=${mode.id}
                aria-selected=${mode.id === activeMode}
                aria-controls="walkthrough-tone-detail"
                tabindex=${mode.id === activeMode ? '0' : '-1'}
                title=${mode.description}
                @click=${() => this._selectTone(mode.id)}
                @keydown=${(event) => this._onToneTabKeyDown(event, index)}
              >
                ${this._renderToneMock(palette)}
                <span class="tone-tab-copy">
                  <span class="tone-name">${mode.label}</span>
                  <span class="tone-caption">${mode.description}</span>
                </span>
              </button>
            `;
          })}
        </div>
        <div
          class="tone-detail"
          id="walkthrough-tone-detail"
          role="tabpanel"
          aria-label=${`${activeModeMeta.label} tone preview`}
        >
          <h3 class="tone-detail-title">${activeModeMeta.label} tone</h3>
          <p class="tone-detail-copy">${activeModeMeta.description}</p>
          <div class="tone-detail-preview">
            ${this._renderToneMock(activePalette, { detail: true })}
            <ul class="tone-affects">
              ${this._toneAffects(activeMode).map(
                (item) => html`
                  <li>
                    <span
                      class="swatch"
                      style="background:${activePalette[item.role] || activePalette.background}"
                    ></span>
                    <span>${item.label}</span>
                  </li>
                `
              )}
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  _renderSlide2() {
    const color = this.state?.global?.color;
    const colorEnabled = this._isColorSchemeEnabled();
    const colorSchemes = SCHEMES.filter((scheme) => scheme.id !== 'monochrome');
    const monochromeLightness = Math.round(hexToHsl(color?.baseColor || '#8a8a8a').l);
    const colorHsl = hexToHsl(color?.baseColor || '#8a8a8a');
    return html`
      <div class="color-mode-switch" role="group" aria-label="Color mode">
        <button
          type="button"
          class="color-mode-option"
          aria-pressed=${!colorEnabled}
          @click=${() => this._setColorMode(false)}
        >
          ${colorModeIcon('monochrome')}
          Monochrome
        </button>
        <button
          type="button"
          class="color-mode-option"
          aria-pressed=${colorEnabled}
          @click=${() => this._setColorMode(true)}
        >
          ${colorModeIcon('color')}
          Color
        </button>
      </div>
      <div class="color-slide">
        ${colorEnabled
          ? html`
              <div class="color-picker-flow" aria-label="Color scheme pipeline">
                <fieldset class="picker-fieldset picker-group-fieldset">
                  <legend>Pick Base Colors</legend>
                  <div class="color-picker-pipeline">
                    <fieldset class="picker-fieldset scheme-fieldset">
                      ${pickerFieldsetLegend(1, 'Scheme')}
                      <div class="scheme-options" role="group" aria-label="1. Scheme">
                        ${colorSchemes.map(
                          (scheme) => html`
                            <button
                              type="button"
                              class="scheme-option"
                              aria-pressed=${color?.scheme === scheme.id}
                              @click=${() => this._setScheme(scheme.id)}
                            >
                              ${schemeCategoryIcon(scheme.id)}
                              <span>${scheme.label}</span>
                            </button>
                          `
                        )}
                      </div>
                    </fieldset>
                    ${colorPickerFlowArrow()}
                    <fieldset class="picker-fieldset hue-fieldset">
                      ${pickerFieldsetLegend(2, 'Hue')}
                      <gmixer-color-wheel></gmixer-color-wheel>
                      <span class="hue-caption">Hue</span>
                    </fieldset>
                    ${colorPickerFlowArrow()}
                    <fieldset class="picker-fieldset hsl-fieldset">
                      ${pickerFieldsetLegend(3, 'Saturation & Lightness')}
                      <div class="hsl-sliders" aria-label="Saturation and lightness">
                        ${this._renderColorHslSlider(
                          'S',
                          'Saturation',
                          colorHsl.s,
                          0,
                          100,
                          's',
                          color?.schemeBaseColor || color?.baseColor || '#8a8a8a',
                          color?.scheme || 'analog'
                        )}
                        ${this._renderColorHslSlider(
                          'L',
                          'Lightness',
                          colorHsl.l,
                          8,
                          92,
                          'l',
                          color?.schemeBaseColor || color?.baseColor || '#8a8a8a',
                          color?.scheme || 'analog'
                        )}
                      </div>
                    </fieldset>
                  </div>
                </fieldset>
                <fieldset class="picker-fieldset picker-group-fieldset">
                  <legend>Page Color Assignments</legend>
                  <gmixer-color-scheme-scales
                    active-scheme-only
                  ></gmixer-color-scheme-scales>
                </fieldset>
              </div>
            `
          : html`
              <label class="grayscale-control">
                <span class="grayscale-control-header">
                  <span>Theme grayscale</span>
                  <output>${monochromeLightness}%</output>
                </span>
                <input
                  class="grayscale-range"
                  type="range"
                  min="8"
                  max="92"
                  step="1"
                  .value=${String(monochromeLightness)}
                  aria-label="Theme grayscale"
                  @input=${(event) => this._setMonochromeLightness(event.target.value)}
                />
                <span class="grayscale-track" aria-hidden="true"></span>
                <span class="grayscale-hint">
                  Brighten or deepen the neutral surfaces while keeping this theme monochrome.
                </span>
              </label>
            `}
      </div>
    `;
  }

  _renderSlide3() {
    return html`
      <gmixer-image-filter-panel
        @change=${(event) => this._activateSection('filter', event)}
      ></gmixer-image-filter-panel>
    `;
  }

  _renderSlide4() {
    return html`
      <gmixer-fonts-panel
        @change=${(event) => this._activateSection('fonts', event)}
      ></gmixer-fonts-panel>
    `;
  }

  _renderSlide5() {
    return html`
      <gmixer-effects-panel
        @change=${(event) => this._activateSection('effects', event)}
      ></gmixer-effects-panel>
    `;
  }

  _renderPreviewSlide() {
    return html`<gmixer-theme-preview-panel></gmixer-theme-preview-panel>`;
  }

  _renderShapeSlide() {
    return html`
      <gmixer-clipping-panel
        @change=${(event) => this._activateSection('shape', event)}
      ></gmixer-clipping-panel>
      <gmixer-corners-panel
        @change=${(event) => this._activateSection('shape', event)}
      ></gmixer-corners-panel>
    `;
  }

  _renderNavigationSlide() {
    return html`
      <gmixer-navigation-panel
        @change=${(event) => this._activateSection('navigation', event)}
      ></gmixer-navigation-panel>
    `;
  }

  _renderFontBrowserSlide() {
    return html`<gmixer-font-browser></gmixer-font-browser>`;
  }
}

defineElement('gmixer-walkthrough', GmixerWalkthrough);
