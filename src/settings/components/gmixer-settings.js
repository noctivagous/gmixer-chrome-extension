import { html, css } from 'lit';
import { StoreBoundElement } from '../../popup/components/store-bound-element.js';
import { store } from '../../state/store.js';
import { buildPalette } from '../../lib/color-theory.js';
import { getFontById } from '../../config/fonts.js';

import '../../popup/components/theme-pack-panel.js';
import '../../popup/components/palette-swatches.js';
import '../../popup/components/color-panel.js';
import '../../popup/components/fonts-panel.js';
import '../../popup/components/image-filter-panel.js';
import '../../popup/components/clipping-panel.js';
import '../../popup/components/corners-panel.js';
import '../../popup/components/effects-panel.js';
import '../../popup/components/navigation-panel.js';
import '../../popup/components/site-toggle.js';
import { THEME_PACKS, getThemePackById } from '../../config/theme-packs.js';
import './font-browser.js';
import { defineElement } from '../../lib/define-element.js';

/** @typedef {{ id: string, label: string, tag: string } | { type: 'divider' }} NavItem */

/**
 * Wrap Lucide-style 24×24 stroke markup in a sized decorative SVG.
 * @param {import('lit').TemplateResult|import('lit').TemplateResult[]} children
 */
function navIcon(children) {
  return html`
    <svg
      class="icon"
      viewBox="0 0 24 24"
      width="16"
      height="16"
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
  theme: navIcon(html`
    <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" stroke="none" />
    <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" stroke="none" />
    <path
      d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
    />
  `),
  // droplet
  color: navIcon(html`
    <path
      d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"
    />
  `),
  // type (Aa)
  fonts: navIcon(html`
    <path d="M4 7V4h16v3" />
    <path d="M9 20h6" />
    <path d="M12 4v16" />
  `),
  // image + funnel hybrid: image
  filter: navIcon(html`
    <rect width="18" height="18" x="3" y="3" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
  `),
  // crop + rounded corner — Clipping / Corners
  shape: navIcon(html`
    <path d="M6 2v14a2 2 0 0 0 2 2h14" />
    <path d="M18 22V8a2 2 0 0 0-2-2H2" />
    <path d="M21 3a12 12 0 0 0-12 12" />
  `),
  // sparkles
  effects: navIcon(html`
    <path
      d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
    />
    <path d="M20 3v4" />
    <path d="M22 5h-4" />
    <path d="M4 17v2" />
    <path d="M5 18H3" />
  `),
  // mouse-pointer
  navigation: navIcon(html`
    <path d="M12.586 12.586 19 19" />
    <path d="M3.688 3.037a.497.497 0 0 0-.651.604l2.094 9.065a.5.5 0 0 0 .294.334l5.797 2.232a.5.5 0 0 0 .651-.604L9.779 5.54a.5.5 0 0 0-.294-.334z" />
  `),
  // book
  'font-browser': navIcon(html`
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  `),
};

/**
 * Accordion order: Theme preview first, then Media → Color → Typography →
 * Clipping/Corners → Effects → Navigation → Font browser.
 *
 * Header On/Off is persisted section enablement (page effects).
 * Expand/collapse is local UI state only — never the same bit.
 *
 * @type {{ id: string, label: string, tags: string[] }[]}
 */
const SECTIONS = [
  { id: 'tone', label: 'Theme', tags: ['gmixer-theme-pack-panel'] },
  { id: 'filter', label: 'Media', tags: ['gmixer-image-filter-panel'] },
  { id: 'color', label: 'Color', tags: ['gmixer-color-panel'] },
  { id: 'fonts', label: 'Typography', tags: ['gmixer-fonts-panel'] },
  {
    id: 'shape',
    label: 'Clipping / Corners',
    tags: ['gmixer-clipping-panel', 'gmixer-corners-panel'],
  },
  { id: 'effects', label: 'Effects', tags: ['gmixer-effects-panel'] },
  { id: 'navigation', label: 'Navigation', tags: ['gmixer-navigation-panel'] },
  { id: 'font-browser', label: 'Font browser', tags: ['gmixer-font-browser'] },
];

/**
 * In-page settings shell: titlebar + single-column, one-open-at-a-time accordion.
 * Baseline grid: 8px module / 24px line (see settings/tokens.js).
 */
export class GmixerSettings extends StoreBoundElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
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

    /* Enabled = layer is applying to the page (switch On). */
    .section[data-enabled='true'] {
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

    /* Disabled = switch Off; quieter than enabled regardless of expand. */
    .section[data-enabled='false'] {
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

    /* Expanded is independent of enabled — lift the panel, keep enable chrome. */
    .section[open] {
      box-shadow: 0 14px 36px rgba(0, 0, 0, 0.32);
    }

    .section[data-enabled='true'][open] {
      border-color: rgba(167, 139, 250, 0.9);
      box-shadow:
        0 16px 40px rgba(0, 0, 0, 0.36),
        0 0 0 1px rgba(139, 92, 246, 0.28),
        inset 3px 0 0 #a78bfa;
    }

    .section[data-enabled='false'][open] {
      opacity: 0.92;
      border-color: rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.035);
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
    }

    .section-toggle {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      align-items: center;
      gap: var(--gm-space-2, 16px);
      flex: 1;
      width: 100%;
      min-height: 64px;
      padding: var(--gm-space-1, 8px) var(--gm-space-2, 16px);
      border: 0;
      background: transparent;
      color: var(--gm-text, #f2eefc);
      text-align: left;
      cursor: pointer;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0;
      min-height: 64px;
    }

    .section-switch {
      position: relative;
      display: grid;
      grid-template-columns: 1fr 1fr;
      flex: 0 0 auto;
      align-self: center;
      width: 72px;
      height: 28px;
      margin: 4pt;
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
      color: #a78bfa;
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

    @media (max-width: 560px) {
      .body {
        padding: var(--gm-space-2, 16px);
      }
      .shortcut {
        display: none;
      }
    }
  `;

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
    const popover =
      this.parentElement?.id === 'gmixer-settings'
        ? this.parentElement
        : document.getElementById('gmixer-settings');
    if (popover && typeof popover.hidePopover === 'function') {
      popover.hidePopover();
    }
  }

  /**
   * @param {string} packId
   */
  _selectThemePack(packId) {
    const pack = getThemePackById(packId);
    if (!pack) return;
    this.updateGlobal({ activeThemePackId: packId, themeMode: 'dark', ...pack.patch });
  }

  render() {
    const activeId = this.state?.global?.activeThemePackId;
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
      <gmixer-palette-swatches></gmixer-palette-swatches>
      <main class="body">
        <div class="theme-pack-picker">
          <label for="theme-pack">Theme</label>
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
        <div class="accordion">
          ${SECTIONS.map((section) => {
            const isOpen = openSection === section.id;
            const isEnabled = this._isSectionEnabled(section.id);
            return html`
              <section
                class="section"
                ?open=${isOpen}
                data-enabled=${isEnabled ? 'true' : 'false'}
              >
                <div class="section-header">
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
                  <button
                    type="button"
                    class="section-toggle"
                    aria-expanded=${isOpen}
                    aria-controls=${`section-${section.id}`}
                    @click=${() => this._toggleExpanded(section.id)}
                  >
                    ${NAV_ICONS[section.id === 'tone' ? 'theme' : section.id]}
                    <span class="section-heading">
                      <span class="section-label">${section.label}</span>
                      <span class="section-hint">${this._sectionHint(section.id)}</span>
                    </span>
                    <span class="chevron" aria-hidden="true">⌄</span>
                  </button>
                </div>
                ${isOpen
                  ? html`
                      <div class="section-content" id=${`section-${section.id}`}>
                        ${this._renderPreview(section.id)}
                        ${this._renderSection(section)}
                      </div>
                    `
                  : null}
              </section>
            `;
          })}
        </div>
      </main>
    `;
  }

  /** @returns {string|null} */
  _openSectionId() {
    const open = this.state?.global?.ui?.openSection;
    return open === undefined ? null : open;
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
    return id === 'tone' || id === 'color' || id === 'fonts' || id === 'font-browser';
  }

  /**
   * @param {string} id
   * @param {boolean} enabled
   */
  _setSectionEnabled(id, enabled) {
    /** @type {Record<string, unknown>} */
    const patch = { sections: { [id]: enabled } };
    if (id === 'navigation') {
      patch.navigation = { enabled };
    }
    this.updateGlobal(patch);
  }

  _sectionHint(id) {
    const hints = {
      tone: 'Live preview, tone, and type sample',
      filter: 'Style images, video, and background media',
      color: 'Palette, contrast, and tonal surfaces',
      fonts: 'Separate roles for hierarchy and UI',
      shape: 'Clip paths, radius, and corner geometry',
      effects: 'Glow, motion, and interaction energy',
      navigation: 'Keyboard-first page navigation',
      'font-browser': 'Browse the complete type catalog',
    };
    return hints[id] || 'Customize this layer';
  }

  _renderPreview(id) {
    // Theme accordion hosts the full theme-pack preview — no mini strip.
    if (id === 'tone') return null;
    const g = this.state?.global;
    const palette = g?.color
      ? buildPalette(g.color.baseColor, g.color.scheme, g.themeMode || 'dark')
      : null;
    if (id === 'color') {
      return html`
        <div class="section-preview">
          ${['background', 'backgroundSecondary', 'surfaceGui', 'surfaceContainers'].map(
            (role) => html`<span
              class="preview-swatch"
              style="background:${palette?.[role] || '#1c1826'}"
            ></span>`
          )}
          <span class="preview-copy">
            <span class="preview-title">Live palette</span>
            <span class="preview-muted">Contrast and surfaces update as you tune them.</span>
          </span>
        </div>
      `;
    }
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

  _renderPanel(tag) {
    switch (tag) {
      case 'gmixer-theme-pack-panel':
        return html`<gmixer-theme-pack-panel></gmixer-theme-pack-panel>`;
      case 'gmixer-color-panel':
        return html`<gmixer-color-panel></gmixer-color-panel>`;
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
      case 'gmixer-navigation-panel':
        return html`<gmixer-navigation-panel></gmixer-navigation-panel>`;
      case 'gmixer-font-browser':
        return html`<gmixer-font-browser></gmixer-font-browser>`;
      default:
        return html``;
    }
  }

  _renderSection(section) {
    return html`${section.tags.map((tag) => this._renderPanel(tag))}`;
  }
}

defineElement('gmixer-settings', GmixerSettings);

store.ready;
