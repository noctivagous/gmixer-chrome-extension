// Shared Color Scheme resolution for page paint, Live palette, and theme preview.
// Keeps Only: Tone / Color Off / override cascade rules in one place.
import {
  buildPalette,
  deriveSurface,
  deriveSurfaceLadder,
  hexToHsl,
} from './color-theory.js';
import { createDefaultState } from '../state/schema.js';

/** Empty Auto overrides (install / theme-pack reset baseline). */
export function emptyColorOverrides() {
  return { ...createDefaultState().global.color.overrides };
}

/** Roles that may be edited without unlocking the cascade lock. */
export const CASCADE_ROOT_ROLES = new Set(['background', 'backgroundSecondary']);

/**
 * @param {Record<string, string>|null|undefined} overrides
 * @param {string} key
 */
function hasOverride(overrides, key) {
  const override = overrides?.[key];
  return typeof override === 'string' && override.trim().length > 0;
}

/**
 * True when only BG:Primary / BG:Secondary (or nothing) are overridden —
 * downstream roles still cascade from Primary.
 * @param {Record<string, string>|null|undefined} overrides
 */
export function isPaletteCascadeLocked(overrides) {
  if (!overrides) return true;
  for (const [key, value] of Object.entries(overrides)) {
    if (CASCADE_ROOT_ROLES.has(key)) continue;
    if (typeof value === 'string' && value.trim()) return false;
  }
  return true;
}

/**
 * True when Reset would change anything (Secondary or downstream overrides).
 * Primary alone is kept by design.
 * @param {Record<string, string>|null|undefined} overrides
 */
export function paletteHasResettableOverrides(overrides) {
  if (!overrides) return false;
  for (const [key, value] of Object.entries(overrides)) {
    if (key === 'background') continue;
    if (typeof value === 'string' && value.trim()) return true;
  }
  return false;
}

/**
 * Reset strip to cascade-from-Primary: keep Primary override if set, clear
 * Secondary and every other role so they re-derive.
 * @param {Record<string, string>|null|undefined} overrides
 */
export function resetOverridesFromPrimary(overrides) {
  const next = emptyColorOverrides();
  if (hasOverride(overrides, 'background')) {
    next.background = overrides.background.trim();
  }
  return next;
}

/**
 * Resolve buildPalette inputs for the current global theme state.
 * Only: Tone matches walkthrough slide 0 — neutral monochrome, no overrides.
 *
 * @param {object|null|undefined} global
 * @param {{ colorSectionOn?: boolean }} [opts]
 *   Page paint should pass `colorSectionOn` from `isSectionEnabled(..., 'color')`
 *   (includes settings-focus gating). UI can omit it and use `sections.color`.
 */
export function resolveEffectivePalette(global, opts = {}) {
  const toneFocus = global?.ui?.settingsFocus === 'tone';
  const colorOn =
    opts.colorSectionOn !== undefined
      ? !!opts.colorSectionOn
      : global?.sections?.color === true;
  const paletteScheme =
    colorOn && !toneFocus ? global?.color?.scheme || 'monochrome' : 'monochrome';
  const paletteBaseColor = toneFocus
    ? '#8a8a8a'
    : global?.color?.baseColor || '#8a8a8a';
  const themeMode = global?.themeMode || 'dark';
  const themePalette = buildPalette(paletteBaseColor, paletteScheme, themeMode);
  const overrides = toneFocus ? {} : { ...(global?.color?.overrides ?? {}) };

  return {
    toneFocus,
    colorOn,
    paletteScheme,
    paletteBaseColor,
    themeMode,
    themePalette,
    overrides,
    applyOverrides: !toneFocus,
  };
}

/**
 * Apply role overrides onto a generated or page-blended palette.
 * When Primary is overridden and Secondary/surfaces are Auto, cascade like
 * buildPalette so the sheet and surfaces follow the new root.
 *
 * @param {object} baseRoles
 * @param {Record<string, string>|null|undefined} overrides
 * @param {{ active?: boolean }} [opts]
 */
export function applyColorOverrides(baseRoles, overrides = {}, opts = {}) {
  const active = opts.active !== false;
  const o = active ? overrides || {} : {};

  const pick = (key) => {
    if (hasOverride(o, key)) return o[key].trim();
    return baseRoles?.[key] ?? '#1c1826';
  };

  const background = pick('background');
  const isDark = hexToHsl(background).l < 50;
  const cascadeFromPrimary =
    hasOverride(o, 'background') && !hasOverride(o, 'backgroundSecondary');

  const backgroundSecondary = hasOverride(o, 'backgroundSecondary')
    ? o.backgroundSecondary.trim()
    : cascadeFromPrimary
      ? deriveSurface(background, isDark)
      : baseRoles?.backgroundSecondary || deriveSurface(background, isDark);

  const surfaceGui =
    hasOverride(o, 'surfaceGui') || hasOverride(o, 'surface')
      ? (o.surfaceGui || o.surface).trim()
      : cascadeFromPrimary
        ? deriveSurface(backgroundSecondary, isDark)
        : baseRoles?.surfaceGui ||
          baseRoles?.surface ||
          deriveSurface(background, isDark);

  const surfaceContainers = hasOverride(o, 'surfaceContainers')
    ? o.surfaceContainers.trim()
    : cascadeFromPrimary
      ? deriveSurface(surfaceGui, isDark)
      : baseRoles?.surfaceContainers || deriveSurface(surfaceGui, isDark);

  const surfaceLadder = cascadeFromPrimary
    ? deriveSurfaceLadder(background, isDark, 3)
    : baseRoles?.surfaceLadder || deriveSurfaceLadder(background, isDark, 3);

  const link = pick('link');
  const navLink = hasOverride(o, 'navLink') ? o.navLink.trim() : baseRoles?.navLink || link;

  const colors = {
    background,
    backgroundSecondary,
    surfaceGui,
    surfaceContainers,
    text: pick('text'),
    muted: pick('muted'),
    accent: pick('accent'),
    link,
    linkHover: hasOverride(o, 'linkHover')
      ? o.linkHover.trim()
      : baseRoles?.linkHover || link,
    navLink,
    navLinkHover: hasOverride(o, 'navLinkHover')
      ? o.navLinkHover.trim()
      : baseRoles?.navLinkHover || navLink,
    border: pick('border'),
    focus: pick('focus'),
  };

  /** @param {string} key */
  const role = (key) => {
    if (key === 'background') return colors.background;
    if (key === 'backgroundSecondary') return colors.backgroundSecondary;
    if (key === 'surfaceGui' || key === 'surface') return colors.surfaceGui;
    if (key === 'surfaceContainers') return colors.surfaceContainers;
    if (Object.prototype.hasOwnProperty.call(colors, key)) return colors[key];
    return pick(key);
  };

  return { ...colors, isDark, surfaceLadder, role, cascadeFromPrimary };
}

/**
 * Settings / preview convenience: generated palette + overrides (no page blend).
 * @param {object|null|undefined} global
 * @param {{ colorSectionOn?: boolean }} [opts]
 */
export function effectiveRoleColors(global, opts = {}) {
  const resolved = resolveEffectivePalette(global, opts);
  return applyColorOverrides(resolved.themePalette, resolved.overrides, {
    active: resolved.applyOverrides,
  });
}
