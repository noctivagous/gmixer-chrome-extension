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
  };

  static styles = css`
    :host {
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
    .swatch-chips {
      display: flex;
      flex-wrap: wrap;
      align-content: flex-start;
      gap: 2px;
      width: 100%;
      min-width: 0;
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
  }

  updated() {
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
        draggable="true"
        style="color:${chipInk(hex)}"
        title=${`Move ${role.label}`}
        aria-label=${`Move ${role.label}`}
        @pointerdown=${(event) => this._onChipPointerDown(event, role.id)}
        @pointerup=${this._onChipPointerUp}
        @pointercancel=${this._onChipPointerUp}
        @keydown=${(event) => this._onChipKeyDown(event, role.id)}
      >
        ${role.short}
      </button>
    `;
  }

  _onChipPointerDown(event, roleId) {
    if (event.button != null && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    this._dragRole = roleId;
  }

  _onChipPointerUp(event) {
    const roleId = this._dragRole;
    this._dragRole = null;
    if (!roleId) return;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const node = pierceElementFromPoint(event.clientX, event.clientY);
    const cell = node?.closest?.('[data-swatch-cell]');
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
