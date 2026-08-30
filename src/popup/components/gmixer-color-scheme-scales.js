import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { SCHEMES, hexToHsl } from '../../lib/color-theory.js';
import {
  SWATCH_ASSIGN_ROLES,
  autoAssignSwatches,
  buildSwatchBoard,
  coordKey,
  hasSwatchAssignments,
  resolveSwatchAssignments,
} from '../../lib/swatch-board.js';
import { defineElement } from '../../lib/define-element.js';
import {
  HOVER_LINK_EVENT,
  HoverLinkOverlay,
  emitHoverLink,
  previewElForRole,
} from '../../lib/hover-link.js';

function chipInk(hex) {
  try {
    return hexToHsl(hex).l > 55 ? '#14121a' : '#f2eefc';
  } catch {
    return '#f2eefc';
  }
}

function pierceElementFromPoint(x, y) {
  let node = document.elementFromPoint(x, y);
  while (node?.shadowRoot) {
    const inner = node.shadowRoot.elementFromPoint(x, y);
    if (!inner || inner === node) break;
    node = inner;
  }
  return node;
}

export class GmixerColorSchemeScales extends StoreBoundElement {
  static properties = {
    monochrome: { type: Boolean, reflect: true },
    activeSchemeOnly: { type: Boolean, attribute: 'active-scheme-only', reflect: true },
    compact: { type: Boolean, reflect: true },
    _dragRole: { state: true },
    _linkRole: { state: true },
    /** @type {{ roleId: string, label: string, hex: string, x: number, y: number }|null} */
    _chipTip: { state: true },
  };

  static styles = css`
    :host {
      position: relative;
      display: grid;
      gap: var(--gm-space-2, 16px);
      width: 100%;
      outline: none;
    }
    :host([compact]) {
      gap: 4px;
      width: 100%;
      max-width: 160px;
      height: 160px;
    }
    .scheme-row {
      display: grid;
      grid-template-columns: 100px 1fr;
      align-items: center;
      gap: 12px;
      outline: none;
    }
    .scheme-row.compact {
      grid-template-columns: minmax(0, 1fr);
      gap: 0;
    }
    :host([compact]) .scheme-row {
      gap: 0;
      height: 100%;
    }
    .scheme-label {
      font-size: 11px;
      font-weight: 600;
      color: var(--gm-muted, rgba(242, 238, 252, 0.65));
    }
    .scales-grid {
      display: grid;
      grid-template-rows: repeat(3, auto);
      gap: 4px;
      outline: none;
    }
    :host([compact]) .scales-grid {
      grid-template-rows: repeat(4, minmax(0, 1fr));
      gap: 3px;
      height: 100%;
    }
    .scale {
      display: flex;
      gap: 2px;
      min-width: 0;
    }
    .scale.scheme-colors {
      gap: 8px;
      align-items: center;
      width: 100%;
    }
    .scheme-color-swatches {
      display: flex;
      flex: 1 1 auto;
      gap: 1px;
      min-width: 0;
      background: rgba(255, 255, 255, 0.14);
    }
    .scheme-color-swatches .swatch-cell {
      flex: 1 1 0;
      width: auto;
      min-height: 52px;
      aspect-ratio: auto;
      border: 0;
      border-radius: 0;
    }
    :host([compact]) .scale {
      gap: 1px;
      align-items: center;
      min-height: 0;
    }
    .swatch-cell {
      position: relative;
      display: flex;
      flex: 1 1 0;
      width: 100%;
      aspect-ratio: 1;
      border-radius: 2px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      min-width: 0;
      min-height: 0;
      padding: 2px;
      box-sizing: border-box;
      outline: none;
    }
    :host([compact]) .swatch-cell {
      border-radius: 1px;
      height: 100%;
      aspect-ratio: auto;
    }
    .swatch-cell[data-drop-ok='true'] {
      box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.85);
    }
    :host([data-dragging='true']) .swatch-cell {
      cursor: copy;
    }
    .swatch-chips {
      display: flex;
      flex-wrap: wrap;
      align-content: flex-start;
      gap: 2px;
      width: 100%;
      min-width: 0;
      min-height: 100%;
      height: 100%;
      pointer-events: none;
    }
    .role-chip {
      margin: 0;
      padding: 1px 4px;
      border: 0;
      border-radius: 3px;
      background: rgba(0, 0, 0, 0.5);
      color: inherit;
      cursor: grab;
      font: 700 8px/1.3 system-ui, sans-serif;
      letter-spacing: 0.02em;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      pointer-events: auto;
      touch-action: none;
      user-select: none;
    }
    .role-chip:active,
    .role-chip[data-dragging='true'] {
      cursor: grabbing;
      opacity: 0.55;
    }
    .role-chip:focus-visible {
      outline: 1px solid #fff;
      outline-offset: 1px;
    }
    .role-chip[data-linked='true'] {
      box-shadow: 0 0 0 1px #fff, 0 0 10px var(--gm-accent, #7c3aed);
    }
    .chip-tooltip {
      position: absolute;
      z-index: 30;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      max-width: min(280px, calc(100% - 16px));
      padding: 4px 8px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.16);
      background: rgba(20, 16, 28, 0.94);
      color: #f2eefc;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      font: 600 11px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
      letter-spacing: 0.02em;
      white-space: nowrap;
      pointer-events: none;
      box-sizing: border-box;
    }
    .chip-tooltip-swatch {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      border: 1px solid rgba(255, 255, 255, 0.35);
      flex: 0 0 auto;
    }
    .scale-label {
      min-width: 3.5rem;
      color: var(--gm-muted, rgba(242, 238, 252, 0.55));
      font-size: 10px;
    }
    .scale-label.base-colors {
      line-height: 1.15;
      text-align: right;
    }
    :host([compact]) .scale-label {
      min-width: 30px;
      font-size: 8px;
    }
    .board-hint {
      margin: 0;
      color: var(--gm-muted, rgba(242, 238, 252, 0.62));
      font: 10px/1.35 system-ui, sans-serif;
    }
  `;

  constructor() {
    super();
    this.monochrome = false;
    this.activeSchemeOnly = false;
    this._dragRole = null;
    this._dropKey = null;
    this._linkRole = null;
    this._chipTip = null;
    this._hoverLink = null;
    this._onRoleHover = this._onRoleHover.bind(this);
    this._onWindowPointerMove = this._onChipPointerMove.bind(this);
    this._onWindowPointerUp = this._onChipPointerUp.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this._hoverLink = new HoverLinkOverlay({
      kind: 'color-role',
      findControl: (id) => this.renderRoot.querySelector(`.role-chip[data-role="${id}"]`),
      findPreview: (id) => previewElForRole(this, id),
      isPaused: () => !!this._dragRole,
    });
    window.addEventListener(HOVER_LINK_EVENT, this._onRoleHover);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener(HOVER_LINK_EVENT, this._onRoleHover);
    this._unbindDragListeners();
    this._clearDropOk();
    this._hoverLink?.destroy();
    this._hoverLink = null;
  }

  _bindDragListeners() {
    window.addEventListener('pointermove', this._onWindowPointerMove, true);
    window.addEventListener('pointerup', this._onWindowPointerUp, true);
    window.addEventListener('pointercancel', this._onWindowPointerUp, true);
  }

  _unbindDragListeners() {
    window.removeEventListener('pointermove', this._onWindowPointerMove, true);
    window.removeEventListener('pointerup', this._onWindowPointerUp, true);
    window.removeEventListener('pointercancel', this._onWindowPointerUp, true);
  }

  updated() {
    if (this._dragRole) this.setAttribute('data-dragging', 'true');
    else this.removeAttribute('data-dragging');
    // Lit re-renders wipe imperative data-drop-ok; re-apply while dragging.
    this._clearDropOk();
    if (this._dragRole && this._dropKey) {
      this.renderRoot
        ?.querySelector?.(`[data-swatch-cell="${CSS.escape(this._dropKey)}"]`)
        ?.setAttribute('data-drop-ok', 'true');
    }

    const global = this.state?.global;
    const color = global?.color;
    if (!color || global?.sections?.color !== true) return;
    if (this.monochrome) return;
    if (hasSwatchAssignments(color.swatchAssignments)) return;
    const scheme = color.scheme || 'analog';
    const base = color.schemeBaseColor || color.baseColor;
    this.updateGlobal({
      color: {
        swatchAssignments: autoAssignSwatches(base, scheme, global.themeMode || 'dark'),
      },
    });
  }

  render() {
    const color = this.state?.global?.color;
    if (!color) return html``;

    let schemes = this.monochrome
      ? SCHEMES.filter((scheme) => scheme.id === 'monochrome')
      : SCHEMES.filter((scheme) => scheme.id !== 'monochrome');

    if (this.activeSchemeOnly) {
      const activeId = color.scheme || 'monochrome';
      schemes = schemes.filter((scheme) => scheme.id === activeId);
      if (!schemes.length) {
        const fallback = SCHEMES.find((scheme) => scheme.id === activeId);
        schemes = fallback ? [fallback] : schemes;
      }
    }

    return html`
      ${this.monochrome
        ? null
        : html`<p class="board-hint">
            Surfaces sit on the family the extension picked. Drag a label onto another swatch to
            reassign it. Hue and saturation/lightness recolor the boxes in place.
          </p>`}
      ${schemes.map((scheme) => this._renderScheme(scheme, color))}
      ${this._renderChipTooltip()}
    `;
  }

  _renderScheme(scheme, currentColor) {
    const themeMode = this.state?.global?.themeMode || 'dark';
    const baseColor = currentColor.schemeBaseColor || currentColor.baseColor;
    const { board, assignments } = resolveSwatchAssignments(
      currentColor.swatchAssignments,
      baseColor,
      scheme.id,
      themeMode
    );
    const chipsByCell = new Map();
    for (const role of SWATCH_ASSIGN_ROLES) {
      const key = coordKey(assignments[role.id]);
      if (!chipsByCell.has(key)) chipsByCell.set(key, []);
      chipsByCell.get(key).push(role);
    }
    const compact = this.activeSchemeOnly;
    const cellsFor = (scale) => board.cells.filter((cell) => cell.scale === scale);

    return html`
      <div class="scheme-row ${compact ? 'compact' : ''}">
        ${compact ? null : html`<span class="scheme-label">${scheme.label}</span>`}
        <div class="scales-grid">
          <div class="scale scheme-colors">
            <span class="scale-label base-colors">Base<br />Colors</span>
            <div class="scheme-color-swatches">
              ${cellsFor('colors').map((cell) => this._renderCell(cell, chipsByCell))}
            </div>
          </div>
          <div class="scale">
            <span class="scale-label">Tint</span>
            ${cellsFor('tint').map((cell) => this._renderCell(cell, chipsByCell))}
          </div>
          <div class="scale">
            <span class="scale-label">Shade</span>
            ${cellsFor('shade').map((cell) => this._renderCell(cell, chipsByCell))}
          </div>
          <div class="scale">
            <span class="scale-label">Tone</span>
            ${cellsFor('tone').map((cell) => this._renderCell(cell, chipsByCell))}
          </div>
        </div>
      </div>
    `;
  }

  _renderCell(cell, chipsByCell) {
    const key = coordKey(cell);
    const roles = chipsByCell.get(key) || [];
    const ink = chipInk(cell.hex);
    return html`
      <div
        class="swatch-cell"
        data-swatch-cell=${key}
        data-scale=${cell.scale}
        data-hue=${String(cell.hue)}
        data-step=${String(cell.step)}
        style="background:${cell.hex};color:${ink}"
        title=${`${cell.scale} ${cell.hex}`}
      >
        <div class="swatch-chips">
          ${roles.map((role) => this._renderChip(role, cell.hex))}
        </div>
      </div>
    `;
  }

  _renderChip(role, hex) {
    return html`
      <button
        type="button"
        class="role-chip"
        data-role=${role.id}
        data-dragging=${this._dragRole === role.id}
        data-linked=${this._linkRole === role.id}
        style="color:${chipInk(hex)}"
        aria-label=${`Move ${role.label}`}
        @pointerenter=${(event) => this._hoverChip(event, role, hex, true)}
        @pointerleave=${(event) => this._hoverChip(event, role, hex, false)}
        @pointerdown=${(event) => this._onChipPointerDown(event, role.id)}
        @pointermove=${(event) => {
          if (!this._dragRole) this._onChipPointerMove(event);
        }}
        @keydown=${(event) => this._onChipKeyDown(event, role.id)}
      >
        ${role.short}
      </button>
    `;
  }

  _renderChipTooltip() {
    const tip = this._chipTip;
    if (!tip || this._dragRole) return null;
    const { left, top } = this._clampTip(tip.x, tip.y);
    return html`
      <div class="chip-tooltip" role="status" style="left:${left}px;top:${top}px">
        <span class="chip-tooltip-swatch" style="background:${tip.hex}"></span>
        <span>${tip.label}</span>
      </div>
    `;
  }

  _clampTip(x, y, width = 180, height = 28) {
    const rw = this.clientWidth || 320;
    const rh = this.clientHeight || 240;
    const left = Math.max(8, Math.min(x, rw - width - 8));
    const top = Math.max(8, Math.min(y, rh - height - 8));
    return { left, top };
  }

  _hoverChip(event, role, hex, on) {
    if (this._dragRole) return;
    if (on) {
      this._linkRole = role.id;
      const rect = this.getBoundingClientRect();
      this._chipTip = {
        roleId: role.id,
        label: role.label,
        hex,
        x: event.clientX - rect.left + 12,
        y: event.clientY - rect.top + 14,
      };
      emitHoverLink({ kind: 'color-role', id: role.id, source: 'control' });
      return;
    }
    if (this._chipTip?.roleId === role.id) this._chipTip = null;
    if (this._linkRole === role.id) {
      this._linkRole = null;
      emitHoverLink({ kind: 'color-role', id: null, source: 'control' });
    }
  }

  _onRoleHover(event) {
    if (event.detail?.kind !== 'color-role') return;
    if (event.detail?.source !== 'preview') return;
    this._linkRole = event.detail.id || null;
  }

  _clearDropOk() {
    this.renderRoot?.querySelectorAll?.('[data-drop-ok="true"]').forEach((el) => {
      el.removeAttribute('data-drop-ok');
    });
  }

  _setDropTarget(cell) {
    const key = cell?.dataset?.swatchCell || null;
    if (key === this._dropKey) {
      if (cell && cell.getAttribute('data-drop-ok') !== 'true') {
        this._clearDropOk();
        cell.setAttribute('data-drop-ok', 'true');
      }
      return;
    }
    this._dropKey = key;
    this._clearDropOk();
    cell?.setAttribute('data-drop-ok', 'true');
  }

  /**
   * Resolve the swatch under the pointer. Prefer elementFromPoint, then fall
   * back to bounding-box hit testing so empty cells and covered targets still
   * count as drop areas.
   */
  _cellFromPoint(clientX, clientY) {
    const node = pierceElementFromPoint(clientX, clientY);
    const pierced = node?.closest?.('[data-swatch-cell]');
    if (pierced && this.renderRoot?.contains?.(pierced)) return pierced;

    const cells = this.renderRoot?.querySelectorAll?.('.swatch-cell') || [];
    for (const candidate of cells) {
      const rect = candidate.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return candidate;
      }
    }
    return null;
  }

  _onChipPointerDown(event, roleId) {
    if (event.button != null && event.button !== 0) return;
    if (this._dragRole) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Inactive/synthetic pointers may reject capture; window listeners still drive the drag.
    }
    this._chipTip = null;
    this._dragRole = roleId;
    this._linkRole = null;
    emitHoverLink({ kind: 'color-role', id: null, source: 'control' });
    this._bindDragListeners();
    this._setDropTarget(this._cellFromPoint(event.clientX, event.clientY));
  }

  _onChipPointerMove(event) {
    if (this._dragRole) {
      this._setDropTarget(this._cellFromPoint(event.clientX, event.clientY));
      return;
    }
    if (!this._chipTip) return;
    const rect = this.getBoundingClientRect();
    this._chipTip = {
      ...this._chipTip,
      x: event.clientX - rect.left + 12,
      y: event.clientY - rect.top + 14,
    };
  }

  _onChipPointerUp(event) {
    const roleId = this._dragRole;
    if (!roleId) return;
    const cell = this._cellFromPoint(event.clientX, event.clientY);
    this._unbindDragListeners();
    this._dragRole = null;
    this._dropKey = null;
    this._clearDropOk();
    const target = event.currentTarget;
    if (target?.hasPointerCapture?.(event.pointerId)) {
      try {
        target.releasePointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
    }
    if (!cell) return;
    this._assignRole(roleId, {
      scale: cell.dataset.scale,
      hue: Number(cell.dataset.hue),
      step: Number(cell.dataset.step),
    });
  }

  _onChipKeyDown(event, roleId) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight' && event.key !== 'ArrowUp' && event.key !== 'ArrowDown') {
      return;
    }
    event.preventDefault();
    const color = this.state?.global?.color;
    if (!color) return;
    const scheme = color.scheme || 'analog';
    const base = color.schemeBaseColor || color.baseColor;
    const board = buildSwatchBoard(base, scheme);
    const stored = resolveSwatchAssignments(
      color.swatchAssignments,
      base,
      scheme,
      this.state?.global?.themeMode || 'dark'
    ).assignments[roleId];
    const index = board.cells.findIndex(
      (cell) => cell.scale === stored.scale && cell.hue === stored.hue && cell.step === stored.step
    );
    if (index < 0) return;
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
    const next = board.cells[(index + delta + board.cells.length) % board.cells.length];
    this._assignRole(roleId, { scale: next.scale, hue: next.hue, step: next.step });
  }

  _assignRole(roleId, coord) {
    const color = this.state?.global?.color;
    if (!color) return;
    const scheme = color.scheme || 'analog';
    const base = color.schemeBaseColor || color.baseColor;
    const { assignments } = resolveSwatchAssignments(
      color.swatchAssignments,
      base,
      scheme,
      this.state?.global?.themeMode || 'dark'
    );
    this.updateGlobal({
      color: {
        swatchAssignments: { ...assignments, [roleId]: coord },
      },
    });
  }
}

defineElement('gmixer-color-scheme-scales', GmixerColorSchemeScales);
