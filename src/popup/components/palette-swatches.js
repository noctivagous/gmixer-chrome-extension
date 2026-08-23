import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { THEME_PACKS, getThemePackById } from '../../config/theme-packs.js';
import { buildPalette, deriveSurface, hexToHsl } from '../../lib/color-theory.js';
import { createDefaultState } from '../../state/schema.js';
import { defineElement } from '../../lib/define-element.js';

export const SWATCH_ROLES = [
  { id: 'background', label: 'BG:Primary' },
  { id: 'backgroundSecondary', label: 'BG:Secondary' },
  { id: 'surfaceGui', label: 'GUI' },
  { id: 'surfaceContainers', label: 'Containers' },
  { id: 'text', label: 'Text' },
  { id: 'muted', label: 'Muted' },
  { id: 'accent', label: 'Accent' },
  { id: 'link', label: 'Link' },
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
 * @param {object} palette
 * @param {Record<string, string>|undefined} overrides
 * @param {boolean} active
 */
export function roleColors(palette, overrides, active) {
  const pick = (role) => (active && overrides?.[role]) || palette[role] || '#1c1826';
  const background = pick('background');
  const isDark = hexToHsl(background).l < 50;
  const surfaceGui =
    (active && (overrides?.surfaceGui || overrides?.surface)) ||
    palette.surfaceGui ||
    palette.surface ||
    deriveSurface(background, isDark);
  return {
    background,
    backgroundSecondary: pick('backgroundSecondary') || deriveSurface(background, isDark),
    surfaceGui,
    surfaceContainers:
      (active && overrides?.surfaceContainers) ||
      palette.surfaceContainers ||
      deriveSurface(surfaceGui, isDark),
    text: pick('text'),
    muted: pick('muted'),
    accent: pick('accent'),
    link: pick('link'),
    border: pick('border'),
    focus: pick('focus'),
  };
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
  `;

  render() {
    const global = this.state?.global;
    const activeId = global?.activeThemePackId;
    const activeMode = global?.themeMode || 'dark';
    const overrides = global?.color?.overrides ?? {};
    const pack = THEME_PACKS.find((item) => item.id === activeId) || THEME_PACKS[0];
    const basePalette = paletteForPack(pack, activeMode);
    const livePalette = global?.color
      ? buildPalette(global.color.baseColor, global.color.scheme, activeMode)
      : basePalette;
    const colors = roleColors(livePalette, overrides, true);

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
      </div>
    `;
  }

  /**
   * @param {string} roleId
   * @param {string} hex
   */
  _setRoleColor(roleId, hex) {
    const packId = this.state?.global?.activeThemePackId;
    if (packId && !getThemePackById(packId)) return;
    this.updateGlobal({
      color: {
        overrides: {
          [roleId]: hex,
        },
      },
    });
  }
}

defineElement('gmixer-palette-swatches', PaletteSwatches);
