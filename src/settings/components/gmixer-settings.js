import { html, css, svg, unsafeCSS } from 'lit';
import { StoreBoundElement } from '../../popup/components/store-bound-element.js';
import { store } from '../../state/store.js';
import { buildPalette, hexToHsl, hslToHex } from '../../lib/color-theory.js';
import { autoAssignSwatches } from '../../lib/swatch-board.js';
import { emptyColorOverrides } from '../../lib/effective-palette.js';
import { getFontById } from '../../config/fonts.js';

import '../../popup/components/theme-preview-panel.js';
import '../../popup/components/palette-swatches.js';
import '../../popup/components/color-panel.js';
import '../../popup/components/fonts-panel.js';
import '../../popup/components/image-filter-panel.js';
import '../../popup/components/clipping-panel.js';
import '../../popup/components/corners-panel.js';
import '../../popup/components/effects-panel.js';
import '../../popup/components/texture-panel.js';
import '../../popup/components/navigation-panel.js';
import '../../popup/components/site-toggle.js';
import { THEME_MODES, THEME_PACKS, getThemePackById } from '../../config/theme-packs.js';
import './font-browser.js';
import { defineElement } from '../../lib/define-element.js';
import { closeHostPopover, requestShellSwitch } from '../close-host-popover.js';
import { GRID_CSS_VARS } from '../tokens.js';
import {
  shellSegmentControlStyles,
  renderShellSegments,
} from '../shell-segment-control.js';
import {
  customizationLevelSelectStyles,
  effectiveCustomizationLevel,
  filterSectionsByCustomizationLevel,
  patchForCustomizationLevel,
  renderCustomizationLevelSelect,
  sectionVisibleAtLevel,
} from '../customization-level.js';
import {
  SETTINGS_FOCUS_OPTIONS,
  preferredOpenSectionForFocus,
  patchForSettingsFocus,
  visibleSectionsForFocus,
} from '../settings-focus.js';

/** @typedef {{ id: string, label: string, tag: string } | { type: 'divider' }} NavItem */

/**
 * Wrap Lucide-style 24×24 stroke markup in a 40×40 header icon.
 * Children must be `svg` templates so paths stay in the SVG namespace.
 * @param {import('lit').SVGTemplateResult|import('lit').SVGTemplateResult[]} children
 */
function navIcon(children) {
  return html`
    <svg
      class="icon"
      viewBox="0 0 24 24"
      width="40"
      height="40"
      fill="none"
      stroke="currentColor"
      stroke-width="1.75"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      ${children}
    </svg>
  `;
}

/** @type {Record<string, import('lit').TemplateResult>} */
const NAV_ICONS = {
  // palette
  theme: navIcon(svg`
    <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" stroke="none" />
    <path
      d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
    />
  `),
  // layout / preview card
  preview: navIcon(svg`
    <rect width="18" height="14" x="3" y="5" rx="2" />
    <path d="M7 5V3h10v2" />
    <path d="M7 15h4" />
    <path d="M7 11h10" />
  `),
  // half-light / half-dark circle
  tone: navIcon(svg`
    <circle cx="12" cy="12" r="8" />
    <path d="M12 4v16" />
  `),
  // droplet
  color: navIcon(svg`
    <path
      d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"
    />
  `),
  // dotted surface / texture
  texture: navIcon(svg`
    <rect x="4" y="4" width="16" height="16" rx="2" />
    <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="8" r="1" fill="currentColor" stroke="none" />
    <circle cx="8" cy="16" r="1" fill="currentColor" stroke="none" />
    <circle cx="16" cy="16" r="1" fill="currentColor" stroke="none" />
  `),
  // type (Aa)
  fonts: navIcon(svg`
    <path d="M4 7V4h16v3" />
    <path d="M9 20h6" />
    <path d="M12 4v16" />
  `),
  // image
  filter: navIcon(svg`
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  `),
  // crop + rounded corner — Clipping / Corners
  shape: navIcon(svg`
    <path d="M6 2v14a2 2 0 0 0 2 2h14" />
    <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    <path d="M21 3a12 12 0 0 0-12 12" />
  `),
  // sparkles
  effects: navIcon(svg`
    <path
      d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
    />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
    <path d="M4 17v2" />
    <path d="M5 18H3" />
  `),
  // mouse-pointer
  navigation: navIcon(svg`
    <path d="M12.586 12.586 19 19" />
    <path d="M3.688 3.037a.497.497 0 0 0-.651.604l2.094 9.065a.5.5 0 0 0 .294.334l5.797 2.232a.5.5 0 0 0 .651-.604L9.779 5.54a.5.5 0 0 0-.294-.334z" />
  `),
  // book
  'font-browser': navIcon(svg`
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  `),
};

/**
 * Decorative section artwork. These stay intentionally abstract so they
 * communicate the section's purpose without looking like another control.
 */
const SECTION_ART = {
  preview: html`
    <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
      <rect x="20" y="12" width="148" height="48" rx="6" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M20 25h148M42 12v48" stroke="currentColor" stroke-width="1.5" />
      <path d="M54 36h46M54 44h74" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
      <circle cx="31" cy="18" r="2" fill="currentColor" />
      <circle cx="37" cy="18" r="2" fill="currentColor" />
    </svg>
  `,
  tone: html`
    <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
      <circle cx="142" cy="36" r="25" fill="currentColor" opacity=".18" />
      <path d="M142 11a25 25 0 0 1 0 50z" fill="currentColor" opacity=".5" />
      <path d="M142 11a25 25 0 0 0 0 50" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M103 20h18M103 36h25M103 52h18" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
    </svg>
  `,
  filter: html`
    <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
      <rect x="38" y="13" width="118" height="46" rx="5" fill="currentColor" opacity=".14" />
      <circle cx="70" cy="29" r="7" fill="currentColor" opacity=".52" />
      <path d="m43 53 29-20 16 11 17-15 45 24" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M169 19h25M169 36h17M169 53h25" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
    </svg>
  `,
  color: html`
    <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
      <circle cx="100" cy="36" r="22" fill="#a78bfa" opacity=".62" />
      <circle cx="132" cy="25" r="18" fill="#38bdf8" opacity=".48" />
      <circle cx="148" cy="49" r="19" fill="#f472b6" opacity=".5" />
      <path d="M48 18h26M48 36h18M48 54h26" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
    </svg>
  `,
  texture: html`
    <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
      <rect x="36" y="12" width="148" height="48" rx="6" fill="currentColor" opacity=".12" />
      <circle cx="56" cy="28" r="2.5" fill="currentColor" opacity=".55" />
      <circle cx="76" cy="40" r="2.5" fill="currentColor" opacity=".55" />
      <circle cx="96" cy="28" r="2.5" fill="currentColor" opacity=".55" />
      <circle cx="116" cy="40" r="2.5" fill="currentColor" opacity=".55" />
      <circle cx="136" cy="28" r="2.5" fill="currentColor" opacity=".55" />
      <circle cx="156" cy="40" r="2.5" fill="currentColor" opacity=".55" />
      <path d="M56 52h28M96 52h20M128 52h36" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
    </svg>
  `,
  fonts: html`
    <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
      <text x="42" y="50" fill="currentColor" font-family="Georgia,serif" font-size="48" font-weight="700">Aa</text>
      <path d="M122 20h54M122 36h42M122 52h60" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
    </svg>
  `,
  shape: html`
    <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
      <rect x="40" y="14" width="58" height="44" rx="14" fill="none" stroke="currentColor" stroke-width="3" />
      <path d="M120 14h55v44h-55z" fill="currentColor" opacity=".2" />
      <path d="M120 14h55L120 58z" fill="none" stroke="currentColor" stroke-width="2" />
    </svg>
  `,
  effects: html`
    <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
      <path d="m116 10 5 18 18 5-18 5-5 18-5-18-18-5 18-5z" fill="currentColor" opacity=".62" />
      <path d="M64 20v16M56 28h16M158 43v12M152 49h12" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
      <circle cx="171" cy="19" r="3" fill="currentColor" />
    </svg>
  `,
  navigation: html`
    <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
      <rect x="41" y="16" width="48" height="40" rx="5" fill="none" stroke="currentColor" stroke-width="2" />
      <path d="M51 28h28M51 38h20M51 48h24" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
      <path d="m124 20 22 20-11 2 7 15-7 3-7-15-8 8z" fill="currentColor" opacity=".5" />
    </svg>
  `,
  'font-browser': html`
    <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
      <path d="M45 57V15h40M45 15v42M45 36h28" fill="none" stroke="currentColor" stroke-width="3" />
      <path d="M112 20h58M112 36h42M112 52h64" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
      <circle cx="96" cy="20" r="3" fill="currentColor" />
      <circle cx="96" cy="36" r="3" fill="currentColor" />
      <circle cx="96" cy="52" r="3" fill="currentColor" />
    </svg>
  `,
};

/**
 * Accordion order: Theme Preview first, then Tone → Color Scheme → Texture →
 * Media → Typography → Clipping/Corners → Effects → Navigation → Font browser.
 * Texture + Clipping/Corners stay in this list for restore order but are
 * filtered out while deferred (0.1.0 → return 0.1.1; see RELEASE-GOALS.md).
 *
 * Header On/Off is persisted section enablement (page effects).
 * Expand/collapse is local UI state only — never the same bit.
 *
 * @type {{ id: string, label: string, tags: string[] }[]}
 */
const SECTIONS = [
  { id: 'preview', label: 'Theme Preview', tags: ['gmixer-theme-preview-panel'] },
  { id: 'tone', label: 'Tone', tags: ['gmixer-color-panel'] },
  { id: 'color', label: 'Color Scheme', tags: ['gmixer-color-panel'] },
  { id: 'texture', label: 'Texture', tags: ['gmixer-texture-panel'] }, // deferred 0.1.0
  { id: 'filter', label: 'Media', tags: ['gmixer-image-filter-panel'] },
  { id: 'fonts', label: 'Typography', tags: ['gmixer-fonts-panel'] },
  {
    id: 'shape',
    label: 'Clipping / Corners',
    tags: ['gmixer-clipping-panel', 'gmixer-corners-panel'],
  }, // deferred 0.1.0
  { id: 'effects', label: 'Effects', tags: ['gmixer-effects-panel'] },
  { id: 'navigation', label: 'Navigation', tags: ['gmixer-navigation-panel'] },
  { id: 'font-browser', label: 'Font browser', tags: ['gmixer-font-browser'] },
];

/**
 * In-page settings shell: titlebar + single-column, one-open-at-a-time accordion.
 * Baseline grid: 8px module / 24px line (see settings/tokens.js).
 */
export class GmixerSettings extends StoreBoundElement {
  static styles = [
    shellSegmentControlStyles,
    customizationLevelSelectStyles,
    css`
    :host {
      all: initial;
      ${unsafeCSS(GRID_CSS_VARS)}
      display: flex;
      flex-direction: column;
      box-sizing: border-box;
      width: 100%;
      height: 100%;
      min-height: 0;
      color: var(--gm-text, #f2eefc);
      background: var(--gm-bg, #14121a);
      font: 13px/var(--gm-line, 24px) system-ui, sans-serif;
    }

    .titlebar {
      flex: 0 0 var(--gm-titlebar, 48px);
      display: grid;
      grid-template-columns: auto auto minmax(0, 1fr) auto;
      align-items: stretch;
      gap: 0;
      padding: 0;
      border-bottom: 0;
      box-sizing: border-box;
    }

    gmixer-palette-swatches {
      flex: 0 0 auto;
      width: 100%;
    }

    .settings-focus-picker {
      flex: 0 0 auto;
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: center;
      gap: var(--gm-space-2, 16px);
      padding: var(--gm-space-1, 8px) var(--gm-space-2, 16px);
      border-bottom: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      box-sizing: border-box;
      background: rgba(0, 0, 0, 0.18);
    }

    .settings-focus-picker label {
      font-size: 11px;
      opacity: 0.78;
      white-space: nowrap;
    }

    .settings-focus-picker select {
      width: 100%;
      min-width: 0;
      padding: 7px 8px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.18));
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.22);
      color: inherit;
      box-sizing: border-box;
    }

    h1 {
      margin: 0;
      padding: 0 var(--gm-space-2, 16px);
      display: flex;
      align-items: center;
      font-size: 16px;
      font-weight: 600;
      line-height: var(--gm-baseline, 24px);
      letter-spacing: 0.02em;
      border-right: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
    }

    .titlebar gmixer-site-toggle {
      min-width: 0;
    }

    .shortcut {
      display: inline-flex;
      align-items: center;
      justify-self: end;
      gap: 4px;
      margin-right: var(--gm-space-2, 16px);
      font-size: 12px;
      line-height: var(--gm-baseline, 24px);
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
      white-space: nowrap;
    }

    kbd {
      display: inline-block;
      min-width: var(--gm-space-3, 24px);
      padding: 0 6px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
      border-bottom-width: 2px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.06);
      font: 11px/var(--gm-baseline, 24px) ui-monospace, monospace;
      text-align: center;
      color: var(--gm-text, #f2eefc);
    }

    .close {
      /* Stay in the trailing column even if .shortcut is display:none. */
      grid-column: -1;
      width: var(--gm-titlebar, 48px);
      height: 100%;
      border: 0;
      border-left: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      border-radius: 0;
      background: transparent;
      color: inherit;
      cursor: pointer;
      line-height: 1;
      font-size: 16px;
    }

    .close:hover {
      background: rgba(255, 255, 255, 0.06);
    }

    .body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: var(--gm-space-3, 24px);
      box-sizing: border-box;
      background:
        radial-gradient(circle at 100% 0%, rgba(124, 58, 237, 0.1), transparent 34%),
        var(--gm-bg, #0b0d12);
      scrollbar-width: thin;
      scrollbar-color: #6d36c9 #11151c;
      scrollbar-gutter: stable;
    }

    .body::-webkit-scrollbar {
      width: 10px;
    }

    .body::-webkit-scrollbar-track {
      background: #11151c;
      border-left: 1px solid rgba(255, 255, 255, 0.06);
    }

    .body::-webkit-scrollbar-thumb {
      min-height: 42px;
      background: linear-gradient(180deg, #8b5cf6, #5b21b6);
      border: 2px solid #11151c;
      border-radius: 999px;
    }

    .body::-webkit-scrollbar-thumb:hover {
      background: linear-gradient(180deg, #a78bfa, #7c3aed);
    }

    .intro {
      max-width: 48rem;
      margin: 0 0 var(--gm-space-3, 24px);
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
      font-size: 12px;
      line-height: 1.5;
    }

    .shell-picker {
      max-width: 48rem;
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 8px 16px;
      margin: 0 0 var(--gm-space-3, 24px);
    }

    .shell-picker-main {
      display: grid;
      gap: 4px;
      flex: 1 1 220px;
      min-width: 0;
    }

    .shell-picker-label {
      font-size: 11px;
      opacity: 0.78;
    }

    .shell-picker .customization-level-picker {
      flex: 0 1 auto;
      padding-bottom: 1px;
    }

    .accordion {
      max-width: 48rem;
      display: grid;
      gap: var(--gm-space-1, 8px);
    }

    .theme-pack-picker {
      max-width: 48rem;
      display: grid;
      gap: 4px;
      margin: 0 0 var(--gm-space-2, 16px);
    }

    .theme-pack-picker label {
      font-size: 11px;
      opacity: 0.78;
    }

    .theme-pack-picker select {
      width: 100%;
      padding: 7px 8px;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.18));
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.22);
      color: inherit;
      box-sizing: border-box;
    }

    .section {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      align-items: start;
      gap: var(--gm-space-1, 8px);
      background: transparent;
      border: 0;
      box-shadow: none;
      overflow: visible;
    }

    .section[data-enableable='false'] {
      grid-template-columns: minmax(0, 1fr);
    }

    .section-panel {
      position: relative;
      min-width: 0;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.015));
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.14);
      transition:
        border-color 160ms ease,
        box-shadow 160ms ease,
        background 160ms ease,
        opacity 160ms ease;
    }

    .section-art {
      position: absolute;
      z-index: 0;
      inset: 0 0 0 34%;
      display: flex;
      justify-content: flex-end;
      pointer-events: none;
      color: var(--gm-accent, #8b5cf6);
      opacity: 0.14;
      -webkit-mask-image: linear-gradient(90deg, transparent 0%, black 30%, black 100%);
      mask-image: linear-gradient(90deg, transparent 0%, black 30%, black 100%);
      transition: opacity 160ms ease;
    }

    .section-art svg {
      display: block;
      width: 100%;
      height: 100%;
      overflow: visible;
    }

    .section[data-enabled='true'] .section-art {
      opacity: 0.22;
    }

    .section[data-enabled='false'] .section-art {
      opacity: 0.08;
    }

    .section[open] .section-art {
      opacity: 0.12;
    }

    .section[data-enabled='true'][open] .section-art {
      opacity: 0.18;
    }

    /* Enabled = layer is applying to the page (switch On). */
    .section[data-enabled='true'] .section-panel {
      border-color: rgba(139, 92, 246, 0.72);
      background:
        linear-gradient(90deg, rgba(124, 58, 237, 0.22), transparent 76px),
        linear-gradient(135deg, rgba(139, 92, 246, 0.18), rgba(255, 255, 255, 0.04));
      box-shadow:
        0 12px 32px rgba(0, 0, 0, 0.28),
        0 0 0 1px rgba(124, 58, 237, 0.16),
        inset 3px 0 0 #8b5cf6;
    }

    .section[data-enabled='true'] .section-label {
      color: #f5f0ff;
    }

    .section[data-enabled='true'] .section-hint {
      color: rgba(196, 181, 253, 0.82);
    }

    .section[data-enabled='true'] .section-toggle .icon {
      color: #c4b5fd;
    }

    .section[data-enabled='true'] .section-switch {
      background: rgba(124, 58, 237, 0.22);
      border-color: rgba(167, 139, 250, 0.55);
    }

    /* Disabled = switch Off; quieter panel regardless of expand. */
    .section[data-enabled='false'] .section-panel {
      opacity: 0.78;
      border-color: rgba(255, 255, 255, 0.07);
      background: rgba(255, 255, 255, 0.02);
      box-shadow: none;
    }

    .section[data-enabled='false'] .section-label {
      color: rgba(242, 238, 252, 0.72);
    }

    .section[data-enabled='false'] .section-toggle .icon,
    .section[data-enabled='false'] .chevron {
      color: rgba(242, 238, 252, 0.38);
    }

    .section[data-enabled='false'] .section-switch {
      opacity: 0.85;
    }

    /* Expanded is independent of enabled — lift the panel, keep enable chrome. */
    .section[open] .section-panel {
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.32);
    }

    .section[data-enabled='true'][open] .section-panel {
      border-color: rgba(167, 139, 250, 0.9);
      box-shadow:
        0 16px 40px rgba(0, 0, 0, 0.36),
        0 0 0 1px rgba(139, 92, 246, 0.28),
        inset 3px 0 0 #a78bfa;
    }

    .section[data-enabled='false'][open] .section-panel {
      opacity: 0.92;
      border-color: rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.035);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
    }

    .section-toggle {
      display: grid;
      position: relative;
      z-index: 1;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--gm-space-2, 16px);
      width: 100%;
      min-height: 64px;
      padding: var(--gm-space-1, 8px) var(--gm-space-2, 16px);
      border: 0;
      background: transparent;
      color: var(--gm-text, #f2eefc);
      text-align: left;
      cursor: pointer;
      box-sizing: border-box;
    }

    .section-switch {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 1fr;
      flex: 0 0 auto;
      align-self: start;
      width: 72px;
      height: 28px;
      margin: 18px 0 0;
      padding: 0;
      border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.18));
      border-radius: 3px;
      background: rgba(0, 0, 0, 0.28);
      box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.06),
        0 1px 0 rgba(0, 0, 0, 0.35);
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
      cursor: pointer;
      font: 9px/1 ui-monospace, monospace;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      box-sizing: border-box;
      overflow: hidden;
    }

    .section-switch:focus-visible {
      z-index: 1;
      outline: 2px solid var(--gm-accent, #8b5cf6);
      outline-offset: 1px;
    }

    .section-switch .switch-label {
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      user-select: none;
    }

    .section-switch .switch-thumb {
      position: absolute;
      inset: 1px auto 1px 1px;
      width: calc(50% - 1px);
      border-radius: 2px;
      background: var(--gm-accent-soft, rgba(124, 58, 237, 0.42));
      box-shadow: inset 0 -1px 0 var(--gm-accent, #7c3aed);
      transition: transform 120ms ease;
    }

    .section-switch[aria-checked='true'] .switch-thumb {
      transform: translateX(100%);
    }

    .section-switch[aria-checked='true'] .switch-on,
    .section-switch[aria-checked='false'] .switch-off {
      color: var(--gm-text, #f2eefc);
    }

    .section-toggle:hover,
    .section-toggle:focus-visible {
      background: rgba(139, 92, 246, 0.1);
    }

    .section-toggle:focus-visible {
      outline: 2px solid var(--gm-accent, #8b5cf6);
      outline-offset: -2px;
    }

    .section-toggle .icon {
      display: block;
      flex: 0 0 40px;
      width: 40px;
      height: 40px;
      color: #a78bfa;
      opacity: 1;
    }

    .section-heading {
      min-width: 0;
    }

    .section-label {
      display: block;
      font-size: 14px;
      font-weight: 650;
      letter-spacing: 0.01em;
      line-height: 20px;
    }

    .section-hint {
      display: block;
      margin-top: 2px;
      color: var(--gm-muted, rgba(242, 238, 252, 0.62));
      font-size: 11px;
      line-height: 16px;
    }

    .chevron {
      color: rgba(242, 238, 252, 0.55);
      font-size: 16px;
      transition: transform 160ms ease;
    }

    .section[open] .chevron {
      transform: rotate(180deg);
      color: #c4b5fd;
    }

    .section-content {
      position: relative;
      z-index: 1;
      padding: 0 var(--gm-space-2, 16px) var(--gm-space-2, 16px);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    .section-preview {
      display: flex;
      align-items: center;
      gap: var(--gm-space-2, 16px);
      min-height: 58px;
      margin: var(--gm-space-2, 16px) 0;
      padding: var(--gm-space-1, 8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      background: #0b0d12;
      color: #f2eefc;
    }

    .preview-copy {
      min-width: 0;
      font-size: 11px;
      line-height: 16px;
    }

    .preview-title {
      display: block;
      color: #c4b5fd;
      font-size: 13px;
      font-weight: 650;
    }

    .preview-muted {
      display: block;
      color: rgba(242, 238, 252, 0.55);
    }

    .preview-swatch {
      flex: 0 0 44px;
      width: 44px;
      height: 44px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      border-radius: 7px;
    }

    .section-content > *:last-child {
      margin-bottom: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .section-panel,
      .section-art,
      .chevron,
      .section-switch .switch-thumb {
        transition: none;
      }
    }

    /* Panel is ~520px; only drop the hint on very narrow hosts. Keep .close on
       grid-column:-1 so hiding the shortcut does not pull it off the right edge. */
    @media (max-width: 360px) {
      .body {
        padding: var(--gm-space-2, 16px);
      }
      .shortcut {
        display: none;
      }
    }
  `,
  ];

  constructor() {
    super();
    this._ignoreScrollWrite = false;
    this._scrollTimer = 0;
    this._onBodyScroll = () => {
      if (this._ignoreScrollWrite) return;
      clearTimeout(this._scrollTimer);
      this._scrollTimer = window.setTimeout(() => {
        const body = this.renderRoot?.querySelector?.('.body');
        if (!body) return;
        const top = Math.round(body.scrollTop);
        const saved = this.state?.global?.ui?.settingsScrollTop ?? 0;
        if (top === saved) return;
        this.updateGlobal({ ui: { settingsScrollTop: top } });
      }, 120);
    };
  }

  firstUpdated() {
    this._bindBodyScroll();
    this._syncBodyScrollFromState();
  }

  updated() {
    this._bindBodyScroll();
    this._syncBodyScrollFromState();
  }

  disconnectedCallback() {
    const body = this.renderRoot?.querySelector?.('.body');
    body?.removeEventListener?.('scroll', this._onBodyScroll);
    clearTimeout(this._scrollTimer);
    super.disconnectedCallback();
  }

  _bindBodyScroll() {
    const body = this.renderRoot?.querySelector?.('.body');
    if (!body || body.dataset.gmixerScrollBound === '1') return;
    body.dataset.gmixerScrollBound = '1';
    body.addEventListener('scroll', this._onBodyScroll, { passive: true });
  }

  /** Keep scroll position in lockstep with store (including other tabs). */
  _syncBodyScrollFromState() {
    const body = this.renderRoot?.querySelector?.('.body');
    if (!body) return;
    const top = Number(this.state?.global?.ui?.settingsScrollTop) || 0;
    if (Math.round(body.scrollTop) === top) return;
    this._ignoreScrollWrite = true;
    body.scrollTop = top;
    requestAnimationFrame(() => {
      this._ignoreScrollWrite = false;
    });
  }

  _close() {
    this.updateGlobal({ ui: { settingsOpen: false } });
    closeHostPopover();
  }

  /**
   * @param {string} packId
   */
  _selectThemePack(packId) {
    const pack = getThemePackById(packId);
    if (!pack) return;
    this.updateGlobal({
      activeThemePackId: packId,
      ...pack.patch,
      color: {
        ...pack.patch.color,
        schemeBaseColor: pack.patch.color?.baseColor,
        // Pack personality replaces prior manual role tweaks.
        overrides: emptyColorOverrides(),
      },
    });
  }

  /**
   * @param {import('../../state/schema.js').SettingsFocus|string} focus
   */
  _setSettingsFocus(focus) {
    this.updateGlobal(patchForSettingsFocus(focus));
  }

  /**
   * @param {import('../../state/schema.js').PreferredShell} shell
   */
  _setPreferredShell(shell) {
    if (shell === 'side-panel') {
      this.updateGlobal({ ui: { preferredShell: 'side-panel' } });
      return;
    }
    this.updateGlobal({ ui: { preferredShell: 'walkthrough-modal' } });
    requestShellSwitch('walkthrough-modal');
  }

  /**
   * @param {import('../../state/schema.js').CustomizationLevel} level
   */
  _setCustomizationLevel(level) {
    const global = this.state?.global;
    if (!global) return;
    const from = effectiveCustomizationLevel(global.ui);
    if (from === level) return;
    const patch = patchForCustomizationLevel(from, level, global);
    const open = global.ui?.openSection;
    if (open && !sectionVisibleAtLevel(open, level)) {
      const focus = this._settingsFocus();
      const visible = filterSectionsByCustomizationLevel(
        visibleSectionsForFocus(SECTIONS, focus),
        level
      );
      /** @type {Record<string, unknown>} */ (patch.ui).openSection =
        preferredOpenSectionForFocus(focus) || visible[0]?.id || null;
    }
    this.updateGlobal(patch);
  }

  /** @returns {import('../../state/schema.js').SettingsFocus} */
  _settingsFocus() {
    const focus = this.state?.global?.ui?.settingsFocus;
    if (focus === 'tone' || focus === 'media' || focus === 'theme') return focus;
    return 'theme';
  }

  /** @returns {import('../../state/schema.js').PreferredShell} */
  _preferredShell() {
    return this.state?.global?.ui?.preferredShell === 'walkthrough-modal'
      ? 'walkthrough-modal'
      : 'side-panel';
  }

  /** @returns {import('../../state/schema.js').CustomizationLevel} */
  _customizationLevel() {
    return effectiveCustomizationLevel(this.state?.global?.ui);
  }

  /** @returns {typeof SECTIONS} */
  _visibleSections() {
    const focusSections = visibleSectionsForFocus(SECTIONS, this._settingsFocus());
    return filterSectionsByCustomizationLevel(focusSections, this._customizationLevel());
  }

  render() {
    const activeId = this.state?.global?.activeThemePackId;
    const settingsFocus = this._settingsFocus();
    const preferredShell = this._preferredShell();
    const customizationLevel = this._customizationLevel();
    const visibleSections = this._visibleSections();
    const openSection = this._openSectionId();
    return html`
      <header class="titlebar">
        <h1>gMixer</h1>
        <gmixer-site-toggle></gmixer-site-toggle>
        <span class="shortcut" title="Toggle settings panel (also remappable in extension shortcuts)">
          <kbd>Alt</kbd>+<kbd>M</kbd>
        </span>
        <button type="button" class="close" aria-label="Close settings" @click=${() => this._close()}>
          ×
        </button>
      </header>
      <div class="settings-focus-picker">
        <label for="settings-focus">Settings</label>
        <select
          id="settings-focus"
          @change=${(e) => this._setSettingsFocus(e.target.value)}
        >
          ${SETTINGS_FOCUS_OPTIONS.map(
            (option) => html`<option value=${option.id} ?selected=${option.id === settingsFocus}>
              ${option.label}
            </option>`
          )}
        </select>
      </div>
      ${settingsFocus === 'theme'
        ? html`<gmixer-palette-swatches></gmixer-palette-swatches>`
        : null}
      <main class="body">
        ${settingsFocus === 'theme'
          ? html`
              <div class="shell-picker">
                <div class="shell-picker-main">
                  <span class="shell-picker-label" id="shell-picker-label">Editor</span>
                  ${renderShellSegments({
                    value: preferredShell,
                    labelledBy: 'shell-picker-label',
                    onSelect: (shell) => this._setPreferredShell(shell),
                  })}
                </div>
                ${renderCustomizationLevelSelect({
                  value: customizationLevel,
                  id: 'settings-customization-level',
                  onChange: (level) => this._setCustomizationLevel(level),
                })}
              </div>
              <div class="theme-pack-picker">
                <label for="theme-pack">Theme pack</label>
                <select
                  id="theme-pack"
                  @change=${(e) => this._selectThemePack(e.target.value)}
                >
                  ${THEME_PACKS.map(
                    (pack) => html`<option value=${pack.id} ?selected=${pack.id === activeId}>
                      ${pack.label}
                    </option>`
                  )}
                </select>
              </div>
            `
          : null}
        <div class="accordion">
          ${visibleSections.map((section) => {
            const isOpen = openSection === section.id;
            const hasEnableSwitch = this._sectionHasEnableSwitch(section.id);
            const isEnabled = hasEnableSwitch ? this._isSectionEnabled(section.id) : true;
            return html`
              <section
                class="section"
                ?open=${isOpen}
                data-enabled=${isEnabled ? 'true' : 'false'}
                data-enableable=${hasEnableSwitch ? 'true' : 'false'}
              >
                ${hasEnableSwitch
                  ? html`
                      <button
                        type="button"
                        class="section-switch"
                        role="switch"
                        aria-checked=${isEnabled}
                        aria-label=${`${isEnabled ? 'Disable' : 'Enable'} ${section.label}`}
                        @click=${(e) => {
                          e.stopPropagation();
                          this._setSectionEnabled(section.id, !isEnabled);
                        }}
                      >
                        <span class="switch-thumb" aria-hidden="true"></span>
                        <span class="switch-label switch-off">Off</span>
                        <span class="switch-label switch-on">On</span>
                      </button>
                    `
                  : null}
                <div class="section-panel">
                  <div class="section-art" aria-hidden="true">
                    ${this._sectionArt(section.id)}
                  </div>
                  <button
                    type="button"
                    class="section-toggle"
                    aria-expanded=${isOpen}
                    aria-controls=${`section-${section.id}`}
                    @click=${() => this._toggleExpanded(section.id)}
                  >
                    ${NAV_ICONS[section.id === 'preview' ? 'preview' : section.id]}
                    <span class="section-heading">
                      <span class="section-label">${section.label}</span>
                      <span class="section-hint">${this._sectionHint(section.id)}</span>
                    </span>
                    <span class="chevron" aria-hidden="true">⌄</span>
                  </button>
                  ${isOpen
                    ? html`
                        <div class="section-content" id=${`section-${section.id}`}>
                          ${this._renderPreview(section.id)}
                          ${this._renderSection(section)}
                        </div>
                      `
                    : null}
                </div>
              </section>
            `;
          })}
        </div>
      </main>
    `;
  }

  /**
   * Theme Preview, Tone, and Font browser do not have a section switch.
   * Tone is the always-active base layer.
   * @param {string} id
   */
  _sectionHasEnableSwitch(id) {
    return id !== 'preview' && id !== 'tone' && id !== 'font-browser';
  }

  /** @returns {string|null} */
  _openSectionId() {
    const open = this.state?.global?.ui?.openSection;
    if (open === undefined || open === null) return null;
    const visible = this._visibleSections();
    if (!visible.some((section) => section.id === open)) {
      return preferredOpenSectionForFocus(this._settingsFocus()) || visible[0]?.id || null;
    }
    return open;
  }

  _toggleExpanded(id) {
    const next = this._openSectionId() === id ? null : id;
    this.updateGlobal({ ui: { openSection: next } });
  }

  /**
   * Persisted On/Off for page effects — independent from accordion expand state.
   * @param {string} id
   */
  _isSectionEnabled(id) {
    const g = this.state?.global;
    if (!g) return false;
    if (id === 'navigation') return !!g.navigation?.enabled;
    if (g.sections && g.sections[id] !== undefined) {
      return g.sections[id] === true;
    }
    return id === 'tone';
  }

  /**
   * @param {string} id
   * @param {boolean} enabled
   */
  _setSectionEnabled(id, enabled) {
    if (!this._sectionHasEnableSwitch(id)) return;
    /** @type {Record<string, unknown>} */
    const patch = { sections: { [id]: enabled } };
    if (id === 'navigation') {
      patch.navigation = { enabled };
    }
    // Tone without Color Scheme uses a neutral monochrome palette, so its
    // Light|Gray|Dark surface direction remains independent of hue choices.
    if (id === 'tone' && enabled) {
      const hsl = hexToHsl(this.state?.global?.color?.baseColor || '#8a8a8a');
      patch.color = {
        scheme: 'monochrome',
        baseColor: hslToHex({ h: hsl.h, s: 0, l: hsl.l }),
        schemeBaseColor: hslToHex({ h: hsl.h, s: 0, l: hsl.l }),
        identityMode: 'restyle',
        intensity: 100,
      };
    }
    if (id === 'color' && enabled) {
      const color = this.state?.global?.color;
      const hsl = hexToHsl(color?.baseColor || '#8a8a8a');
      const scheme = color?.scheme === 'monochrome' ? 'analog' : color?.scheme || 'analog';
      // Gray has H=0; use blue (210°) instead of red when raising saturation.
      const h = hsl.s < 5 ? 210 : hsl.h;
      const baseColor = hslToHex({ ...hsl, h, s: Math.max(hsl.s, 70) });
      const mode = this.state?.global?.themeMode || 'dark';
      const intensity = this.state?.global?.themeIntensity;
      patch.activeThemePackId = 'user-made';
      patch.color = {
        scheme,
        baseColor,
        schemeBaseColor: baseColor,
        swatchAssignments: autoAssignSwatches(baseColor, scheme, mode, intensity),
      };
    }
    if (id === 'color' && !enabled) {
      const hsl = hexToHsl(this.state?.global?.color?.baseColor || '#8a8a8a');
      patch.color = {
        scheme: 'monochrome',
        baseColor: hslToHex({ h: hsl.h, s: 0, l: hsl.l }),
        schemeBaseColor: hslToHex({ h: hsl.h, s: 0, l: hsl.l }),
      };
    }
    this.updateGlobal(patch);
  }

  _sectionHint(id) {
    const hints = {
      preview: 'Live sample of the active theme pack',
      filter: 'Style images, video, and background media',
      tone: 'Light through Dark surface direction',
      color: 'Pipeline: scheme → hue → S/L; drag surfaces onto swatches',
      texture: 'Noise or grid surface texture (spacing + rotation)',
      fonts: 'Separate roles for hierarchy and UI',
      shape: 'Clip paths, radius, and corner geometry',
      effects: 'Per-category glow, pan & scan, flash, and page motion',
      navigation: 'Keyboard-first page navigation',
      'font-browser': 'Browse the complete type catalog',
    };
    return hints[id] || 'Customize this layer';
  }

  _sectionArt(id) {
    const global = this.state?.global;
    const palette = global?.color
      ? buildPalette(
          global.color.baseColor,
          global.sections?.color === true ? global.color.scheme : 'monochrome',
          global.themeMode || 'dark',
          global.themeIntensity
        )
      : null;

    if (id === 'tone' && palette) {
      return html`
        <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
          ${THEME_MODES.map((mode, index) => {
            const tone = buildPalette(
              global.color.baseColor,
              'monochrome',
              mode.id,
              global.themeIntensity
            );
            return html`
              <rect
                x=${86 + index * 22}
                y="17"
                width="18"
                height="38"
                rx="4"
                fill=${tone.background}
                stroke=${global.themeMode === mode.id ? palette.accent : 'currentColor'}
                stroke-width=${global.themeMode === mode.id ? '3' : '1'}
              />
            `;
          })}
          <path d="M42 24h36M42 36h28M42 48h36" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
        </svg>
      `;
    }

    if (id === 'color' && palette) {
      return html`
        <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
          <circle cx="112" cy="36" r="23" fill=${palette.backgroundSecondary} stroke=${palette.border} stroke-width="2" />
          <circle cx="138" cy="24" r="17" fill=${palette.accent} />
          <circle cx="152" cy="49" r="18" fill=${palette.link} />
          <circle cx="91" cy="50" r="13" fill=${palette.surfaceContainers} />
          <path d="M42 24h28M42 36h20M42 48h28" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
        </svg>
      `;
    }

    if (id === 'filter') {
      const cats = global?.imageFilter?.categories;
      const preset = global?.imageFilter?.enabled
        ? cats?.articleImages || cats?.images || 'none'
        : 'none';
      const monochrome = preset === 'monochrome' || preset === 'grayscale';
      return html`
        <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
          <rect x="41" y="13" width="86" height="46" rx="5" fill=${monochrome ? '#8b8b8b' : palette?.accent || '#a78bfa'} opacity=".4" />
          <circle cx="62" cy="27" r="6" fill=${monochrome ? '#d8d8d8' : '#facc15'} />
          <path d="m45 53 23-17 14 9 15-13 27 21" fill="none" stroke="currentColor" stroke-width="2" />
          <text x="163" y="40" text-anchor="middle" fill="currentColor" font-size="8" font-weight="700">${preset === 'none' ? 'RAW' : String(preset).toUpperCase().slice(0, 6)}</text>
        </svg>
      `;
    }

    if (id === 'fonts') {
      const family = getFontById(global?.fonts?.headings?.h1?.fontId || global?.fonts?.headers?.fontId)?.family || 'Georgia,serif';
      return html`
        <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
          <text x="42" y="50" fill="currentColor" font-family=${family} font-size="48" font-weight="700">Aa</text>
          <path d="M122 20h54M122 36h42M122 52h60" stroke="currentColor" stroke-linecap="round" stroke-width="3" />
        </svg>
      `;
    }

    if (id === 'shape') {
      const radius = Math.min(Math.max(Number(global?.corners?.radius) || 0, 0), 22);
      return html`
        <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
          <rect x="40" y="14" width="58" height="44" rx=${radius} fill="none" stroke="currentColor" stroke-width="3" />
          <path d=${global?.clipping?.preset === 'notch' ? 'M120 14h48l7 7v37h-55z' : 'M120 14h55v44h-55z'} fill="currentColor" opacity=".2" />
          <path d="M120 14h55L120 58z" fill="none" stroke="currentColor" stroke-width="2" />
        </svg>
      `;
    }

    if (id === 'effects') {
      const effect = global?.effects?.categories?.images?.effect || 'none';
      const glow = global?.effects?.glow?.color || palette?.accent || '#a78bfa';
      return html`
        <svg viewBox="0 0 220 72" preserveAspectRatio="xMidYMid slice">
          <path d="m116 10 5 18 18 5-18 5-5 18-5-18-18-5 18-5z" fill=${glow} opacity=".75" />
          <rect x="47" y="21" width="34" height="30" rx="4" fill="none" stroke="currentColor" stroke-width="2" />
          <text x="163" y="40" text-anchor="middle" fill="currentColor" font-size="8" font-weight="700">${effect === 'none' ? 'CALM' : effect.toUpperCase().slice(0, 7)}</text>
        </svg>
      `;
    }

    return SECTION_ART[id];
  }

  _renderPreview(id) {
    // Theme Preview hosts the full live blurb — no mini strip.
    // Color Scheme already has the hue ring / swatches; skip the duplicate strip.
    if (id === 'preview' || id === 'color') return null;
    const g = this.state?.global;
    if (id === 'fonts') {
      const header = getFontById(g?.fonts?.headers?.fontId)?.family || 'system-ui';
      const body = getFontById(g?.fonts?.paragraph?.fontId)?.family || 'system-ui';
      return html`
        <div class="section-preview">
          <div class="preview-copy" style="font-family:${header}">
            <span class="preview-title">A visual hierarchy</span>
            <span class="preview-muted" style="font-family:${body}">Hero · body · UI · code</span>
          </div>
        </div>
      `;
    }
    if (id === 'filter') {
      return html`
        <div class="section-preview">
          <span class="preview-swatch" style="background:linear-gradient(135deg,#f97316,#7c3aed);filter:grayscale(1)"></span>
          <span class="preview-copy">
            <span class="preview-title">Monochrome media</span>
            <span class="preview-muted">Keep the theme accent in control.</span>
          </span>
        </div>
      `;
    }
    if (id === 'shape') {
      return html`
        <div class="section-preview">
          <span class="preview-swatch" style="background:#29213d;border-radius:14px"></span>
          <span class="preview-copy">
            <span class="preview-title">Shape language</span>
            <span class="preview-muted">Cards and controls share one visual system.</span>
          </span>
        </div>
      `;
    }
    if (id === 'effects') {
      return html`
        <div class="section-preview">
          <span class="preview-title" style="text-shadow:0 0 10px #a78bfa">Signal online</span>
          <span class="preview-muted">Subtle motion, deliberate emphasis.</span>
        </div>
      `;
    }
    return html`
      <div class="section-preview">
        <span class="preview-copy">
          <span class="preview-title">${SECTIONS.find((section) => section.id === id)?.label}</span>
          <span class="preview-muted">Preview this section's effect as you customize it.</span>
        </span>
      </div>
    `;
  }

  _renderPanel(tag, section) {
    switch (tag) {
      case 'gmixer-theme-preview-panel':
        return html`<gmixer-theme-preview-panel></gmixer-theme-preview-panel>`;
      case 'gmixer-color-panel':
        return html`<gmixer-color-panel
          ?tone-only=${section.id === 'tone'}
          ?scheme-only=${section.id === 'color'}
        ></gmixer-color-panel>`;
      case 'gmixer-fonts-panel':
        return html`<gmixer-fonts-panel></gmixer-fonts-panel>`;
      case 'gmixer-image-filter-panel':
        return html`<gmixer-image-filter-panel></gmixer-image-filter-panel>`;
      case 'gmixer-clipping-panel':
        return html`<gmixer-clipping-panel></gmixer-clipping-panel>`;
      case 'gmixer-corners-panel':
        return html`<gmixer-corners-panel></gmixer-corners-panel>`;
      case 'gmixer-effects-panel':
        return html`<gmixer-effects-panel></gmixer-effects-panel>`;
      case 'gmixer-texture-panel':
        return html`<gmixer-texture-panel></gmixer-texture-panel>`;
      case 'gmixer-navigation-panel':
        return html`<gmixer-navigation-panel></gmixer-navigation-panel>`;
      case 'gmixer-font-browser':
        return html`<gmixer-font-browser></gmixer-font-browser>`;
      default:
        return html``;
    }
  }

  _renderSection(section) {
    return html`${section.tags.map((tag) => this._renderPanel(tag, section))}`;
  }
}

defineElement('gmixer-settings', GmixerSettings);

store.ready;
