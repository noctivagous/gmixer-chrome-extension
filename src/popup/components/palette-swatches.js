import { html, css, svg } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { THEME_PACKS } from '../../config/theme-packs.js';
import { buildPalette, hexToHsl } from '../../lib/color-theory.js';
import {
  applyColorOverrides,
  effectiveRoleColors,
  isPaletteCascadeLocked,
  paletteHasResettableOverrides,
  resetOverridesFromPrimary,
  resolveEffectivePalette,
} from '../../lib/effective-palette.js';
import { createDefaultState } from '../../state/schema.js';
import { defineElement } from '../../lib/define-element.js';

export const SWATCH_ROLES = [
  { id: 'background', label: 'BG:Primary · root' },
  { id: 'backgroundSecondary', label: 'BG:Secondary · sheet' },
  { id: 'surfaceGui', label: 'GUI' },
  { id: 'surfaceContainers', label: 'Containers' },
  { id: 'text', label: 'Text' },
  { id: 'muted', label: 'Muted' },
  { id: 'accent', label: 'Accent' },
  { id: 'link', label: 'Link' },
  { id: 'navLink', label: 'Nav' },
  { id: 'border', label: 'Border' },
  { id: 'focus', label: 'Focus' },
];

function paletteForPack(pack, mode = 'dark') {
  const base = createDefaultState().global.color;
  const color = { ...base, ...(pack.patch?.color || {}) };
  return buildPalette(color.baseColor, color.scheme, mode);
}

/** Readable label color on top of a swatch fill. */
export function labelColorFor(hex) {
  try {
    return hexToHsl(hex).l > 55 ? '#14121a' : '#f2eefc';
  } catch {
    return '#f2eefc';
  }
}

/**
 * Effective role colors for the active theme (live overrides when present).
 * When Primary is overridden and Secondary/surfaces are Auto, cascade like
 * buildPalette so UI swatches match page paint.
 * @param {object} palette
 * @param {Record<string, string>|undefined} overrides
 * @param {boolean} active
 */
export function roleColors(palette, overrides, active) {
  const {
    isDark: _isDark,
    surfaceLadder: _ladder,
    role: _role,
    cascadeFromPrimary: _cascade,
    ...colors
  } = applyColorOverrides(palette, overrides, { active });
  return colors;
}

export {
  effectiveRoleColors,
  isPaletteCascadeLocked,
  paletteHasResettableOverrides,
  resetOverridesFromPrimary,
  resolveEffectivePalette,
};

function lockIcon(locked) {
  if (locked) {
    return svg`
      <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.75" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
      </svg>
    `;
  }
  return svg`
    <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.75" />
      <path d="M8 11V8a4 4 0 0 1 7.5-1.9" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" />
    </svg>
  `;
}

function resetIcon() {
  return svg`
    <svg class="action-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
      />
      <path
        d="M4 5.5v4.5h4.5"
        fill="none"
        stroke="currentColor"
        stroke-width="1.75"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `;
}

/**
 * Full-bleed palette strip for the settings chrome — sits under the titlebar,
 * outside theme / accordion containers.
 */
export class PaletteSwatches extends StoreBoundElement {
  static styles = css`
    :host {
      display: block;
      flex: 0 0 auto;
      width: 100%;
    }

    .swatches {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      width: 100%;
      border-bottom: 1px solid var(--gm-border, rgba(255, 255, 255, 0.1));
      box-sizing: border-box;
    }

    .swatch {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      margin: 0;
      padding: 4px 2px;
      border: 0;
      border-right: 1px solid rgba(0, 0, 0, 0.28);
      box-sizing: border-box;
      cursor: pointer;
      overflow: hidden;
    }

    .swatch:nth-child(5n) {
      border-right: 0;
    }

    .swatch:focus-within {
      z-index: 1;
      outline: 2px solid var(--gm-accent, #8b5cf6);
      outline-offset: -2px;
    }

    .swatch-label {
      position: relative;
      z-index: 1;
      pointer-events: none;
      font: 600 9px/1.1 ui-monospace, monospace;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      text-align: center;
      text-shadow: 0 1px 1px rgba(0, 0, 0, 0.35);
      user-select: none;
    }

    .swatch input[type='color'] {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      border: 0;
      opacity: 0;
      cursor: pointer;
    }

    .swatch-action {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      min-height: 36px;
      margin: 0;
      padding: 4px 2px;
      border: 0;
      border-right: 1px solid rgba(255, 255, 255, 0.08);
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.04);
      color: var(--gm-muted, rgba(242, 238, 252, 0.72));
      cursor: pointer;
      font: 600 8px/1.1 ui-monospace, monospace;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .swatch-action:hover,
    .swatch-action:focus-visible {
      color: var(--gm-text, #f2eefc);
      background: rgba(255, 255, 255, 0.1);
      outline: none;
    }

    .swatch-action:focus-visible {
      outline: 2px solid var(--gm-accent, #8b5cf6);
      outline-offset: -2px;
    }

    .swatch-action[aria-pressed='true'] {
      color: var(--gm-text, #f2eefc);
      background: rgba(139, 92, 246, 0.18);
    }

    .swatch-action:disabled {
      opacity: 0.45;
      cursor: default;
    }

    .action-icon {
      display: block;
      width: 14px;
      height: 14px;
    }
  `;

  render() {
    const global = this.state?.global;
    const overrides = global?.color?.overrides ?? {};
    const locked = isPaletteCascadeLocked(overrides);
    const canReset = paletteHasResettableOverrides(overrides);
    const colors = global?.color
      ? effectiveRoleColors(global)
      : roleColors(
          paletteForPack(
            THEME_PACKS.find((item) => item.id === global?.activeThemePackId) || THEME_PACKS[0],
            global?.themeMode || 'dark'
          ),
          {},
          false
        );

    return html`
      <div class="swatches" role="group" aria-label="Theme palette">
        ${SWATCH_ROLES.map((role) => {
          const hex = colors[role.id] || '#1c1826';
          return html`
            <label
              class="swatch"
              style="background:${hex};color:${labelColorFor(hex)}"
              title=${`Edit ${role.label} color`}
            >
              <span class="swatch-label">${role.label}</span>
              <input
                type="color"
                .value=${hex}
                aria-label=${`${role.label} color`}
                @input=${(e) => this._setRoleColor(role.id, e.target.value)}
              />
            </label>
          `;
        })}
        <button
          type="button"
          class="swatch-action"
          aria-pressed=${locked}
          aria-label=${locked ? 'Palette cascade locked' : 'Re-lock palette cascade from Primary'}
          title=${locked
            ? 'Locked — roles follow BG:Primary (Primary/Secondary edits stay locked)'
            : 'Unlocked — click to re-lock and re-derive from BG:Primary'}
          ?disabled=${locked}
          @click=${this._relockFromPrimary}
        >
          ${lockIcon(locked)}
          <span>${locked ? 'Locked' : 'Unlocked'}</span>
        </button>
        <button
          type="button"
          class="swatch-action"
          aria-label="Reset palette cascade from Primary"
          title="Reset — clear non-Primary overrides so all roles derive from BG:Primary"
          ?disabled=${!canReset}
          @click=${this._resetFromPrimary}
        >
          ${resetIcon()}
          <span>Reset</span>
        </button>
      </div>
    `;
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

  /** Re-lock cascade: keep Primary, clear Secondary and downstream overrides. */
  _relockFromPrimary() {
    const overrides = this.state?.global?.color?.overrides ?? {};
    if (isPaletteCascadeLocked(overrides)) return;
    this.updateGlobal({
      color: { overrides: resetOverridesFromPrimary(overrides) },
    });
  }

  _resetFromPrimary() {
    const overrides = this.state?.global?.color?.overrides ?? {};
    this.updateGlobal({
      color: { overrides: resetOverridesFromPrimary(overrides) },
    });
  }
}

defineElement('gmixer-palette-swatches', PaletteSwatches);
