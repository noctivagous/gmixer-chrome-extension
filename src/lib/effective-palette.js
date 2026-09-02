// Shared Color Scheme resolution for page paint, Live palette, and theme preview.
// Keeps Only: Tone / Color Off / override cascade rules in one place.
import {
  buildPalette,
  deriveGuiControlFills,
  deriveSurface,
  deriveSurfaceLadder,
  ensureContrast,
  hexToHsl,
} from './color-theory.js';
import {
  applySwatchAssignments,
  hasSwatchAssignments,
  resolveSwatchAssignments,
} from './swatch-board.js';
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
  const themeIntensity = global?.themeIntensity;
  const generatedPalette = buildPalette(
    paletteBaseColor,
    paletteScheme,
    themeMode,
    themeIntensity
  );
  const storedAssignments = global?.color?.swatchAssignments;
  const useAssignments =
    colorOn && !toneFocus && hasSwatchAssignments(storedAssignments);
  const { board, assignments } = useAssignments
    ? resolveSwatchAssignments(
        storedAssignments,
        paletteBaseColor,
        paletteScheme,
        themeMode,
        themeIntensity
      )
    : { board: null, assignments: {} };
  const themePalette = useAssignments
    ? applySwatchAssignments(generatedPalette, assignments, board)
    : generatedPalette;
  const overrides = toneFocus ? {} : { ...(global?.color?.overrides ?? {}) };

  return {
    toneFocus,
    colorOn,
    paletteScheme,
    paletteBaseColor,
    themeMode,
    themePalette,
    overrides,
    swatchBoard: board,
    swatchAssignments: assignments,
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
  const muted = pick('muted');
  const accent = pick('accent');

  // Surface:GUI:*, Accent:Heading-*, Link:*, Muted:* — fine-grained roles that
  // fall back to their coarse parent (surfaceGui/accent/link/muted) when Auto.
  // Link:Heading intentionally has no override of its own: it inherits
  // whichever heading-tier color applies, same as the heading it sits in.
  const pickSub = (key, fallback) =>
    hasOverride(o, key) ? o[key].trim() : baseRoles?.[key] || fallback;
  const autoGui = deriveGuiControlFills({
    background,
    backgroundSecondary,
    surfaceGui,
    surfaceContainers,
    accent,
    isDark,
  });
  const pickGui = (key) => {
    if (hasOverride(o, key)) return o[key].trim();
    if (cascadeFromPrimary) return autoGui[key];
    return baseRoles?.[key] || autoGui[key];
  };
  const guiButton = pickGui('guiButton');
  const guiInput = pickGui('guiInput');
  const guiTextarea = pickGui('guiTextarea');
  const guiSlider = pickGui('guiSlider');

  // Re-check body/control ink against each surface's FINAL fill (post
  // override) — a manually-overridden bright surface still needs legible
  // text, not the stale contrast check from the un-overridden theme default.
  const text = pick('text');
  const textOnBackgroundSecondary = ensureContrast(text, backgroundSecondary, 4.5);
  const textOnSurfaceGui = ensureContrast(text, surfaceGui, 4.5);
  const textOnSurfaceContainers = ensureContrast(text, surfaceContainers, 4.5);
  const textOnGuiButton = ensureContrast(text, guiButton, 4.5);
  const textOnGuiInput = ensureContrast(text, guiInput, 4.5);
  const textOnGuiTextarea = ensureContrast(text, guiTextarea, 4.5);
  const textOnSurface0 = ensureContrast(text, surfaceLadder[0], 4.5);
  const textOnSurface1 = ensureContrast(text, surfaceLadder[1], 4.5);
  const textOnSurface2 = ensureContrast(text, surfaceLadder[2], 4.5);

  const headingLarge = pickSub('headingLarge', accent);
  const headingMedium = pickSub('headingMedium', accent);
  const headingSmall = pickSub('headingSmall', accent);
  const linkBare = pickSub('linkBare', link);
  const linkArticle = pickSub('linkArticle', link);
  const mutedKicker = pickSub('mutedKicker', muted);
  const mutedPhotoCaption = pickSub('mutedPhotoCaption', muted);
  const mutedAsideNotes = pickSub('mutedAsideNotes', muted);

  const colors = {
    background,
    backgroundSecondary,
    surfaceGui,
    surfaceContainers,
    text,
    muted,
    accent,
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
    guiButton,
    guiInput,
    guiTextarea,
    guiSlider,
    headingLarge,
    headingMedium,
    headingSmall,
    linkBare,
    linkArticle,
    mutedKicker,
    mutedPhotoCaption,
    mutedAsideNotes,
    textOnBackgroundSecondary,
    textOnSurfaceGui,
    textOnSurfaceContainers,
    textOnGuiButton,
    textOnGuiInput,
    textOnGuiTextarea,
    textOnSurface0,
    textOnSurface1,
    textOnSurface2,
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
