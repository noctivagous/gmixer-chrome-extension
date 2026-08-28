import { html, css, svg } from 'lit';
import { StoreBoundElement } from '../../popup/components/store-bound-element.js';
import { THEME_MODES } from '../../config/theme-packs.js';
import { buildPalette, SCHEMES, hexToHsl, hslToHex } from '../../lib/color-theory.js';
import { schemeHslTrackStyle } from '../../lib/hsl-slider-track.js';
import { defineElement } from '../../lib/define-element.js';

import '../../popup/components/color-panel.js';
import '../../popup/components/gmixer-color-wheel.js';
import '../../popup/components/gmixer-color-scheme-scales.js';
import '../../popup/components/image-filter-panel.js';
import '../../popup/components/fonts-panel.js';
import '../../popup/components/effects-panel.js';
import '../../popup/components/theme-preview-panel.js';

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

/** @param {number} index */
function walkthroughTabIcon(index) {
  const icons = [
    svg`
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16" />
    `,
    svg`
      <path d="M12 3C7 3 3 7 3 12s4 9 9 9c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1a1.6 1.6 0 0 1 1.6-1.6h2c3.1 0 5.6-2.5 5.6-5.6C22 6.4 17.5 3 12 3Z" />
      <circle cx="8" cy="9" r=".6" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7" r=".6" fill="currentColor" stroke="none" />
      <circle cx="16" cy="9" r=".6" fill="currentColor" stroke="none" />
    `,
    svg`
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9" r="1.5" />
      <path d="m4 17 4.5-4 3.5 3 3-3 5 4" />
    `,
    svg`
      <path d="M5 6V4h14v2" />
      <path d="M12 4v16" />
      <path d="M8 20h8" />
    `,
    svg`
      <path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z" />
      <path d="m19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z" />
    `,
  ];
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
      ${icons[index] || icons[0]}
    </svg>
  `;
}

/**
 * gMixer Onboarding Walkthrough: 5 slides in a centered popover modal.
 */
export class GmixerWalkthrough extends StoreBoundElement {
  static properties = {
    currentSlide: { type: Number, state: true },
    showCompletion: { type: Boolean, reflect: true },
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
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
      width: min(440px, calc(100vw - 32px));
      height: auto;
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

    .titlebar .brand {
      grid-column: 2;
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.01em;
      text-align: center;
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

    .titlebar .close:hover,
    .titlebar .close:focus-visible {
      color: var(--gm-text, #f2eefc);
    }

    .tabs {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 8px;
      margin: 16px var(--gm-space-3, 24px) 0;
    }

    .step-description {
      margin: 16px 0 0;
      padding: 14px var(--gm-space-3, 24px) 0;
      border-top: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      font-size: 14px;
      line-height: 1.45;
      text-align: left;
      color: var(--gm-muted, rgba(242, 238, 252, 0.75));
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
      padding: var(--gm-space-2, 16px);
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

    .color-picker-row {
      display: grid;
      grid-template-columns: 160px 106px minmax(0, 1fr);
      gap: 16px;
      align-items: start;
      justify-self: start;
      width: 100%;
      min-width: 0;
      max-width: 100%;
      box-sizing: border-box;
    }

    .color-picker-stack {
      display: grid;
      gap: 12px;
      width: 160px;
    }

    .color-picker-stack gmixer-color-scheme-scales {
      width: 160px;
    }

    .color-picker-row .scheme-options {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      align-content: start;
      width: 100%;
      min-width: 0;
    }

    .color-picker-row .scheme-option {
      justify-content: center;
      min-width: 0;
    }

    .color-picker-row .scheme-option span {
      min-width: 0;
      overflow-wrap: anywhere;
    }

    .hsl-sliders {
      display: grid;
      grid-template-columns: repeat(2, 50px);
      gap: 6px;
      justify-content: center;
      min-height: 160px;
    }

    .hsl-slider {
      display: grid;
      grid-template-rows: 1fr auto;
      gap: 5px;
      justify-items: center;
      color: var(--gm-muted, rgba(242, 238, 252, 0.7));
      font: 700 9px/1 system-ui, sans-serif;
    }

    .hsl-slider-shell {
      position: relative;
      width: 50px;
      height: 150px;
    }

    .hsl-track {
      position: absolute;
      inset: 0;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 4px;
      background-image:
        linear-gradient(to top, var(--hsl-band-0-a), var(--hsl-band-0-b)),
        linear-gradient(to top, var(--hsl-band-1-a), var(--hsl-band-1-b)),
        linear-gradient(to top, var(--hsl-band-2-a), var(--hsl-band-2-b)),
        linear-gradient(to top, var(--hsl-band-3-a), var(--hsl-band-3-b));
      background-size: calc(100% / var(--hsl-band-count, 1)) 100%;
      background-position:
        calc(0 * 100% / var(--hsl-band-count, 1)) 0,
        calc(1 * 100% / var(--hsl-band-count, 1)) 0,
        calc(2 * 100% / var(--hsl-band-count, 1)) 0,
        calc(3 * 100% / var(--hsl-band-count, 1)) 0;
      background-repeat: no-repeat;
      pointer-events: none;
    }

    .hsl-slider input {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 150px;
      height: 50px;
      margin: 0;
      transform: translate(-50%, -50%) rotate(-90deg);
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
      border: 0;
      padding: 0;
      cursor: pointer;
    }

    .hsl-slider input::-webkit-slider-runnable-track {
      appearance: none;
      -webkit-appearance: none;
      background: transparent;
      border: 0;
      height: 50px;
    }

    .hsl-slider input::-webkit-slider-thumb {
      appearance: none;
      -webkit-appearance: none;
      width: 10px;
      height: 48px;
      margin: 0;
      border: 1px solid rgba(255, 255, 255, 0.85);
      border-radius: 2px;
      background: rgba(255, 255, 255, 0.92);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
      cursor: grab;
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

    @media (max-width: 960px) {
      .color-picker-row {
        grid-template-columns: minmax(0, 1fr);
        justify-self: stretch;
      }

      .color-picker-stack,
      .color-picker-row .scheme-options {
        justify-self: center;
      }

      .color-picker-row .scheme-options {
        width: min(100%, 360px);
      }
    }

    @media (max-width: 560px) {
      .tone-picker {
        grid-template-columns: minmax(0, 1fr);
      }

      .tone-detail-preview {
        grid-template-columns: minmax(0, 1fr);
      }

      .color-picker-row {
        grid-template-columns: minmax(0, 1fr);
      }

      .hsl-sliders {
        grid-template-columns: repeat(2, minmax(120px, 1fr));
        width: 100%;
        min-height: auto;
      }

      .hsl-slider-shell {
        width: 100%;
        height: 50px;
      }

      .hsl-track {
        background-image:
          linear-gradient(to right, var(--hsl-band-0-a), var(--hsl-band-0-b)),
          linear-gradient(to right, var(--hsl-band-1-a), var(--hsl-band-1-b)),
          linear-gradient(to right, var(--hsl-band-2-a), var(--hsl-band-2-b)),
          linear-gradient(to right, var(--hsl-band-3-a), var(--hsl-band-3-b));
        background-size: 100% calc(100% / var(--hsl-band-count, 1));
        background-position:
          0 calc(0 * 100% / var(--hsl-band-count, 1)),
          0 calc(1 * 100% / var(--hsl-band-count, 1)),
          0 calc(2 * 100% / var(--hsl-band-count, 1)),
          0 calc(3 * 100% / var(--hsl-band-count, 1));
      }

      .hsl-slider input {
        left: 0;
        top: 0;
        width: 100%;
        height: 50px;
        transform: none;
      }

      .hsl-slider input::-webkit-slider-runnable-track {
        width: 100%;
        height: 50px;
      }

      .hsl-slider input::-webkit-slider-thumb {
        width: 10px;
        height: 48px;
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
  `;

  constructor() {
    super();
    this.currentSlide = 0;
    this.showCompletion = false;
    this._activatedSlides = new Set([0]);
  }

  _next() {
    if (this.currentSlide < 4) {
      this._selectSlide(this.currentSlide + 1);
    } else {
      this._finish();
    }
  }

  _prev() {
    if (this.currentSlide > 0) {
      this.currentSlide--;
    }
  }

  _selectSlide(index) {
    this._applySlideDefaults(index);
    this.currentSlide = index;
    this.updateComplete.then(() => {
      this.renderRoot.querySelector(`#walkthrough-slide-${index}`)?.focus();
    });
  }

  _onTabKeyDown(event, index) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = event.key === 'ArrowRight' ? (index + 1) % 5 : (index + 4) % 5;
    this._selectSlide(next);
    this.updateComplete.then(() => {
      this.renderRoot.querySelector(`.tab[aria-controls="walkthrough-slide-${next}"]`)?.focus();
    });
  }

  _close() {
    this._dismissWalkthrough();
  }

  _finish() {
    this.updateGlobal({ ui: { walkthroughCompleted: true } });
    this.showCompletion = true;
    this.updateComplete.then(() => {
      this.renderRoot.querySelector('.completion-dialog button')?.focus();
    });
  }

  _closeCompletion() {
    const popover = document.getElementById('gmixer-walkthrough-host');
    if (popover && typeof popover.hidePopover === 'function') {
      popover.hidePopover();
    }
  }

  /** Closing or finishing both permanently dismiss auto-open onboarding. */
  _dismissWalkthrough() {
    this.updateGlobal({ ui: { walkthroughCompleted: true } });
    const popover = document.getElementById('gmixer-walkthrough-host');
    if (popover && typeof popover.hidePopover === 'function') {
      popover.hidePopover();
    }
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
    this.updateGlobal(patch);
  }

  _applySlideDefaults(index) {
    if (this._activatedSlides.has(index)) return;
    this._activatedSlides.add(index);

    const color = this.state?.global?.color;
    const hsl = hexToHsl(color?.baseColor || '#8a8a8a');

    switch (index) {
      case 1: {
        const baseColor = hslToHex({ ...hsl, s: Math.max(hsl.s, 70) });
        this.updateGlobal({
          activeThemePackId: 'user-made',
          sections: { color: true },
          color: { baseColor, schemeBaseColor: baseColor, scheme: 'triadic' },
        });
        break;
      }
      case 2:
        this.updateGlobal({
          activeThemePackId: 'user-made',
          sections: { filter: true },
          imageFilter: {
            enabled: true,
            preset: 'monochrome',
            scope: 'both',
            revealOnHover: true,
          },
        });
        break;
      case 3:
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
      case 4:
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
    this.updateGlobal({ themeMode: mode });
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

  _setColorMode(useColor) {
    const color = this.state?.global?.color;
    if (!color) return;
    const hsl = hexToHsl(color.baseColor);

    if (useColor) {
      const scheme = color.scheme === 'monochrome' ? 'analog' : color.scheme;
      this.updateGlobal({
        activeThemePackId: 'user-made',
        sections: { color: true },
        color: {
          scheme,
          baseColor: hslToHex({ ...hsl, s: Math.max(hsl.s, 70) }),
          schemeBaseColor: hslToHex({ ...hsl, s: Math.max(hsl.s, 70) }),
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
    this.updateGlobal({
      activeThemePackId: 'user-made',
      sections: { color: false },
      color: { baseColor: hslToHex({ h: hsl.h, s: 0, l: lightness }), scheme: 'monochrome' },
    });
  }

  _setColorHsl(key, value) {
    const color = this.state?.global?.color;
    if (!color) return;
    const hsl = hexToHsl(color.baseColor);
    this.updateGlobal({
      activeThemePackId: 'user-made',
      sections: { color: true },
      color: { baseColor: hslToHex({ ...hsl, [key]: Number(value) }) },
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

    return html`
      <div class="header">
        <div class="titlebar">
          <h2 class="brand">Welcome to gMixer</h2>
          <button type="button" class="close" aria-label="Close walkthrough" @click=${this._close}>×</button>
        </div>
        <div class="tabs" role="tablist" aria-label="Walkthrough steps">
          ${[0, 1, 2, 3, 4].map(
            (i) => html`
              <button
                type="button"
                class="tab"
                role="tab"
                aria-label=${`Step ${i + 1}: ${this._getTitle(i)}`}
                aria-selected=${i === this.currentSlide}
                aria-controls=${`walkthrough-slide-${i}`}
                tabindex=${i === this.currentSlide ? '0' : '-1'}
                @click=${() => this._selectSlide(i)}
                @keydown=${(event) => this._onTabKeyDown(event, i)}
              >${walkthroughTabIcon(i)}<span>${this._getTabLabel(i)}</span></button>
            `
          )}
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
          ?disabled=${this.currentSlide === 0}
          @click=${this._prev}
        >
          Back
        </button>
        <button class="nav primary next" @click=${this._next}>
          ${this.currentSlide === 4
            ? 'Finish'
            : html`${walkthroughTabIcon(this.currentSlide + 1)}
                <span>Next: ${this._getTabLabel(this.currentSlide + 1)}</span>`}
        </button>
      </div>
    `;
  }

  _getTitle(index = this.currentSlide) {
    const titles = [
      'Tone',
      'Color Scheme',
      'Chroming Media',
      'Typography',
      'Effects',
    ];
    return titles[index];
  }

  _getTabLabel(index = this.currentSlide) {
    const labels = ['Tone', 'Color Scheme', 'Chroming Media', 'Typography', 'Effects'];
    return labels[index] || this._getTitle(index);
  }

  _getDescription(index = this.currentSlide) {
    if (index === 1) {
      return this._isColorSchemeEnabled()
        ? 'How do you want it to look? Pick a base color and a scheme.'
        : 'Keep it neutral. Pick a gray base for your theme, or switch to Color for relationships.';
    }
    const descriptions = [
      'Welcome to gMixer, a web page themer. To start, choose the light mode for pages.',
      '',
      'How do you want images and videos to look?',
      'Choose the typefaces that fit your style.',
      'Finally, add some visual effects to the page.',
    ];
    return descriptions[index] || '';
  }

  _renderSlide() {
    switch (this.currentSlide) {
      case 0:
        return this._renderSlide1();
      case 1:
        return this._renderSlide2();
      case 2:
        return this._renderSlide3();
      case 3:
        return this._renderSlide4();
      case 4:
        return this._renderSlide5();
      default:
        return html``;
    }
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
          Monochrome
        </button>
        <button
          type="button"
          class="color-mode-option"
          aria-pressed=${colorEnabled}
          @click=${() => this._setColorMode(true)}
        >
          Color
        </button>
      </div>
      <div class="color-slide">
        ${colorEnabled
          ? html`
              <div class="color-picker-row">
                <div class="color-picker-stack">
                  <gmixer-color-wheel></gmixer-color-wheel>
                  <gmixer-color-scheme-scales
                    compact
                    active-scheme-only
                  ></gmixer-color-scheme-scales>
                </div>
                <div class="hsl-sliders" aria-label="Color adjustments">
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
                <div class="scheme-options" role="group" aria-label="Color scheme">
                  ${colorSchemes.map(
                    (scheme) => html`
                      <button
                        type="button"
                        class="scheme-option"
                        aria-pressed=${color?.scheme === scheme.id}
                        @click=${() =>
                          this.updateGlobal({
                            activeThemePackId: 'user-made',
                            sections: { color: true },
                            color: { scheme: scheme.id },
                          })}
                      >
                        ${schemeCategoryIcon(scheme.id)}
                        <span>${scheme.label}</span>
                      </button>
                    `
                  )}
                </div>
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
}

defineElement('gmixer-walkthrough', GmixerWalkthrough);
