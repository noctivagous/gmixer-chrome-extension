// Generates a page-role palette from ONE base color, using standard
// color-theory relationships. See product description.txt > FEATURE 1.
import {
  normalizeThemeIntensity,
  toneBand,
  toneCanvasLightness,
  toneIsDark,
  toneModeBias,
} from './tone-canvas.js';

/** @param {string} hex e.g. "#7c3aed" */
export function hexToHsl(hex) {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.substring(0, 2), 16) / 255;
  const g = parseInt(normalized.substring(2, 4), 16) / 255;
  const b = parseInt(normalized.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;

  let h = 0;
  let s = 0;
  if (delta !== 0) {
    s = delta / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / delta) % 6;
        break;
      case g:
        h = (b - r) / delta + 2;
        break;
      default:
        h = (r - g) / delta + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }

  return { h, s: s * 100, l: l * 100 };
}

/**
 * Hue-ring sample (pipeline step 2): a full hue distribution (H spans 0–360°)
 * at saturation 1.0 and lightness 0.5. Scheme (step 1) is unchanged by this
 * pick; saturation and lightness sliders (step 3) refine it afterward.
 */
export const HUE_RING = Object.freeze({ s: 100, l: 50 });

/** @param {number} hueDeg */
export function hueRingHex(hueDeg) {
  return hslToHex({ h: hueDeg, s: HUE_RING.s, l: HUE_RING.l });
}

export function hslToHex({ h, s, l }) {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let r;
  let g;
  let b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function relativeLuminance(hex) {
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** @returns {number} WCAG contrast ratio between two hex colors. */
export function contrastRatio(firstHex, secondHex) {
  const first = relativeLuminance(firstHex);
  const second = relativeLuminance(secondHex);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * sRGB hex → CIE Lab (D65). Used for perceptual clustering / ΔE.
 * @param {string} hex
 * @returns {{ L: number, a: number, b: number }}
 */
export function hexToLab(hex) {
  const normalized = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  );
  const [r, g, b] = linear;
  // sRGB D65 → XYZ
  const x = (r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047;
  const y = (r * 0.2126729 + g * 0.7151522 + b * 0.072175);
  const z = (r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883;

  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * CIE76 ΔE — enough for clustering nearby brand colors.
 * @param {{ L: number, a: number, b: number }} first
 * @param {{ L: number, a: number, b: number }} second
 */
export function labDistance(first, second) {
  const dL = first.L - second.L;
  const da = first.a - second.a;
  const db = first.b - second.b;
  return Math.sqrt(dL * dL + da * da + db * db);
}

/** @param {string} firstHex @param {string} secondHex */
export function hexLabDistance(firstHex, secondHex) {
  return labDistance(hexToLab(firstHex), hexToLab(secondHex));
}

/**
 * Approximate OKLCH from hex via Lab → OKLab-ish chroma/hue for debug keys.
 * Clustering uses Lab ΔE; this is for readable cluster labels.
 * @param {string} hex
 * @returns {{ L: number, C: number, H: number }}
 */
export function hexToOklchApprox(hex) {
  const lab = hexToLab(hex);
  const C = Math.sqrt(lab.a * lab.a + lab.b * lab.b);
  let H = (Math.atan2(lab.b, lab.a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L: lab.L / 100, C: C / 100, H };
}

/**
 * Preserve a generated color's hue where possible while meeting a contrast
 * threshold. User overrides are applied outside this function and are never
 * adjusted.
 */
export function ensureContrast(foreground, background, minimumRatio) {
  if (contrastRatio(foreground, background) >= minimumRatio) return foreground;

  const source = hexToHsl(foreground);
  let best = null;
  let bestDistance = Infinity;
  for (let lightness = 0; lightness <= 100; lightness += 1) {
    const candidate = hslToHex({ ...source, l: lightness });
    if (contrastRatio(candidate, background) < minimumRatio) continue;
    const distance = Math.abs(lightness - source.l);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  if (best) return best;
  return contrastRatio('#ffffff', background) >= contrastRatio('#000000', background)
    ? '#ffffff'
    : '#000000';
}

/** Fill keys that receive per-surface ink (body, headings, links, muted, nav). */
export const SURFACE_INK_FILL_KEYS = [
  'backgroundSecondary',
  'surfaceGui',
  'surfaceContainers',
  'guiButton',
  'guiInput',
  'guiTextarea',
  'guiButtonOnBackgroundSecondary',
  'guiInputOnBackgroundSecondary',
  'guiTextareaOnBackgroundSecondary',
  'guiButtonOnSurfaceContainers',
  'guiInputOnSurfaceContainers',
  'guiTextareaOnSurfaceContainers',
  'surface0',
  'surface1',
  'surface2',
];

/** CSS custom-property suffix after `--gmixer-link-` etc. */
export const SURFACE_INK_CSS_SUFFIX = {
  backgroundSecondary: 'on-bg-secondary',
  surfaceGui: 'on-surface-gui',
  surfaceContainers: 'on-surface-containers',
  guiButton: 'on-gui-button',
  guiInput: 'on-gui-input',
  guiTextarea: 'on-gui-textarea',
  guiButtonOnBackgroundSecondary: 'on-gui-button-on-bg-secondary',
  guiInputOnBackgroundSecondary: 'on-gui-input-on-bg-secondary',
  guiTextareaOnBackgroundSecondary: 'on-gui-textarea-on-bg-secondary',
  guiButtonOnSurfaceContainers: 'on-gui-button-on-surface-containers',
  guiInputOnSurfaceContainers: 'on-gui-input-on-surface-containers',
  guiTextareaOnSurfaceContainers: 'on-gui-textarea-on-surface-containers',
  surface0: 'on-surface-0',
  surface1: 'on-surface-1',
  surface2: 'on-surface-2',
};

function fillKeyToPascal(fillKey) {
  return fillKey.charAt(0).toUpperCase() + fillKey.slice(1);
}

/** Flat palette key, e.g. headingLarge + surfaceContainers → headingLargeOnSurfaceContainers. */
export function inkOnRoleKey(roleId, fillKey) {
  return `${roleId}On${fillKeyToPascal(fillKey)}`;
}

/**
 * @param {{ backgroundSecondary: string, surfaceGui: string, surfaceContainers: string, guiButton: string, guiInput: string, guiTextarea: string, surfaceLadder: string[] }} palette
 */
export function paletteSurfaceFills(palette) {
  const ladder = palette.surfaceLadder || [];
  return {
    backgroundSecondary: palette.backgroundSecondary,
    surfaceGui: palette.surfaceGui,
    surfaceContainers: palette.surfaceContainers,
    guiButton: palette.guiButton,
    guiInput: palette.guiInput,
    guiTextarea: palette.guiTextarea,
    guiButtonOnBackgroundSecondary: palette.guiButtonOnBackgroundSecondary,
    guiInputOnBackgroundSecondary: palette.guiInputOnBackgroundSecondary,
    guiTextareaOnBackgroundSecondary: palette.guiTextareaOnBackgroundSecondary,
    guiButtonOnSurfaceContainers: palette.guiButtonOnSurfaceContainers,
    guiInputOnSurfaceContainers: palette.guiInputOnSurfaceContainers,
    guiTextareaOnSurfaceContainers: palette.guiTextareaOnSurfaceContainers,
    surface0: ladder[0],
    surface1: ladder[1],
    surface2: ladder[2],
  };
}

/**
 * Lightness-only contrast check of one ink against each independently-derived fill.
 * @param {string} ink
 * @param {Record<string, string>} fills
 * @param {number} [minimumRatio=4.5]
 */
export function contrastInkOnSurfaces(ink, fills, minimumRatio = 4.5) {
  /** @type {Record<string, string>} */
  const on = {};
  for (const fillKey of SURFACE_INK_FILL_KEYS) {
    on[fillKey] = ensureContrast(ink, fills[fillKey], minimumRatio);
  }
  return on;
}

/**
 * Flatten contrastInkOnSurfaces for every role into textOnSurfaceGui-style keys.
 * @param {Record<string, string>} roleInks
 * @param {Record<string, string>} fills
 * @param {number} [minimumRatio=4.5]
 */
export function inkOnTokens(roleInks, fills, minimumRatio = 4.5) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const [roleId, ink] of Object.entries(roleInks)) {
    const on = contrastInkOnSurfaces(ink, fills, minimumRatio);
    for (const fillKey of SURFACE_INK_FILL_KEYS) {
      out[inkOnRoleKey(roleId, fillKey)] = on[fillKey];
    }
  }
  return out;
}

function rotate(h, degrees) {
  return (h + degrees + 360) % 360;
}

function sameHex(first, second) {
  if (!first || !second) return false;
  return first.replace('#', '').toLowerCase() === second.replace('#', '').toLowerCase();
}

/**
 * Slightly nudge a rest color for hover/focus. Same hue; lightness only.
 * @param {string} hex
 * @param {boolean} [isDark=true]
 */
export function deriveHoverColor(hex, isDark = true) {
  const base = hexToHsl(hex);
  return hslToHex({
    ...base,
    l: Math.max(0, Math.min(100, base.l + (isDark ? 8 : -8))),
  });
}

/** Pressed-state companion to {@link deriveHoverColor}. */
export function deriveActiveColor(hex, isDark = true) {
  const base = hexToHsl(hex);
  return hslToHex({
    ...base,
    l: Math.max(0, Math.min(100, base.l + (isDark ? -6 : 6))),
  });
}

/**
 * Halo color for text glow. Related hue, but never identical to the ink it
 * sits behind — a same-color glow just looks like a blur of the letters.
 * @param {string} inkHex
 */
export function deriveGlowColor(inkHex) {
  const { h, s, l } = hexToHsl(inkHex || '#888888');
  const glowL = l >= 50 ? Math.max(12, l - 20) : Math.min(88, l + 20);
  let glowS = s < 12 ? s : Math.min(100, s + 14);
  let candidate = hslToHex({ h, s: glowS, l: glowL });
  if (sameHex(candidate, inkHex)) {
    candidate = hslToHex({
      h,
      s: glowS,
      l: l >= 50 ? Math.max(0, l - 28) : Math.min(100, l + 28),
    });
  }
  if (sameHex(candidate, inkHex)) {
    candidate = hslToHex({
      h: rotate(h, 12),
      s: Math.max(glowS, 18),
      l: glowL,
    });
  }
  return candidate;
}

/**
 * Prefer a configured glow color, but replace it when it matches the ink.
 * Empty / missing configured values use {@link deriveGlowColor}.
 * @param {string|null|undefined} configured
 * @param {string} inkHex
 */
export function resolveGlowColor(configured, inkHex) {
  const trimmed = typeof configured === 'string' ? configured.trim() : '';
  const candidate = trimmed || deriveGlowColor(inkHex);
  if (sameHex(candidate, inkHex)) return deriveGlowColor(inkHex);
  return candidate;
}

export const SCHEMES = [
  { id: 'analog', label: 'Analogous' },
  { id: 'complement', label: 'Complementary' },
  { id: 'splitComplement', label: 'Split-Complementary' },
  { id: 'triadic', label: 'Triadic' },
  { id: 'tetradic', label: 'Tetradic' },
  { id: 'monochrome', label: 'Monochrome' },
];

/**
 * Given a base color + scheme name, returns hue offsets (in degrees, from
 * the base hue) for a small set of "accent" hues. Lightness/saturation
 * shaping for actual page roles (bg/text/accent/link/border) happens in
 * buildPalette below.
 */
export function accentHueOffsets(scheme) {
  switch (scheme) {
    case 'analog':
      return [-30, 30];
    case 'complement':
      return [180];
    case 'splitComplement':
      return [150, 210];
    case 'triadic':
      return [120, 240];
    case 'tetradic':
      return [90, 180, 270];
    case 'monochrome':
      return [];
    default:
      return [180];
  }
}

/**
 * Generates a scale of variations for a color.
 * @param {string} hex
 * @param {'tint'|'shade'|'tone'} type
 * @param {number} steps
 * @returns {string[]}
 */
export function getColorScale(hex, type, steps = 5) {
  const { h, s, l } = hexToHsl(hex);
  const scale = [];
  for (let i = 0; i < steps; i++) {
    const factor = i / (steps - 1);
    let newS = s;
    let newL = l;

    if (type === 'tint') {
      newL = l + (100 - l) * factor;
    } else if (type === 'shade') {
      newL = l * (1 - factor);
    } else if (type === 'tone') {
      newS = s * (1 - factor);
    }

    scale.push(hslToHex({ h, s: newS, l: newL }));
  }
  return scale;
}

/**
 * Elevated surface color derived from a lower visual layer. Used first for
 * GUI controls, then once more for cards and other larger containers.
 * Keeps hue with the page bg so themed shells do not read as leftover slabs.
 * At the lightness boundary, shifts hue/saturation instead so repeated
 * elevation never collapses adjacent roles onto the same color.
 *
 * @param {string} backgroundHex
 * @param {boolean} [isDark] Whether elevated layers should be lighter.
 */
function fillsTooClose(a, b) {
  if (!a || !b) return false;
  if (a.toLowerCase() === b.toLowerCase()) return true;
  const left = hexToHsl(a);
  const right = hexToHsl(b);
  let dh = Math.abs(left.h - right.h);
  if (dh > 180) dh = 360 - dh;
  return dh < 18 && Math.abs(left.s - right.s) < 14 && Math.abs(left.l - right.l) < 7;
}

/**
 * Nudge a fill until it is visually distinct from parent/sibling surfaces.
 * Used so GUI controls do not disappear into Surface:Containers or BG:Secondary.
 *
 * @param {string} fromHex
 * @param {string[]} [avoidHexes]
 * @param {boolean} [isDark]
 * @returns {string}
 */
export function deriveDistinctFill(fromHex, avoidHexes = [], isDark = hexToHsl(fromHex).l < 50) {
  const base = hexToHsl(fromHex);
  const dir = isDark ? 1 : -1;
  let { h, s, l } = base;
  let candidate = fromHex;
  for (let step = 0; step < 5; step += 1) {
    const clash = avoidHexes.some((hex) => fillsTooClose(candidate, hex));
    if (!clash) return candidate;
    l = Math.max(6, Math.min(92, l + dir * (8 + step * 3)));
    if (step >= 2) h = (h + (isDark ? 10 : -10) + 360) % 360;
    if (step >= 3 && s < 18) s = Math.min(28, s + 10);
    candidate = hslToHex({ h, s, l });
  }
  return candidate;
}

/**
 * Auto GUI control fills that stay on the Color Scheme ladder but do not
 * copy Surface:GUI / Surface:Containers (those are the usual parent sheets).
 *
 * @param {{ background: string, backgroundSecondary: string, surfaceGui: string, surfaceContainers: string, accent?: string, isDark: boolean }} layers
 */
export function deriveGuiControlFills(layers) {
  const isDark = Boolean(layers.isDark);
  const avoid = [
    layers.background,
    layers.backgroundSecondary,
    layers.surfaceGui,
    layers.surfaceContainers,
  ].filter(Boolean);
  const guiInput = deriveDistinctFill(layers.background, avoid, isDark);
  const guiTextarea = deriveDistinctFill(guiInput, [...avoid, guiInput], isDark);
  const guiButton = deriveDistinctFill(layers.surfaceGui, [...avoid, guiInput, guiTextarea], isDark);
  const guiSlider = layers.accent || guiButton;
  return { guiInput, guiTextarea, guiButton, guiSlider };
}

const GUI_FILL_DELTA_SECONDARY = 10;
const GUI_FILL_DELTA_CONTAINERS = 14;
const GUI_BORDER_DELTA = 8;

/**
 * Same hue/saturation; step lightness away from the parent fill
 * (darker on lighter, lighter on darker).
 * @param {string} hex
 * @param {string} parentHex
 * @param {number} delta
 */
export function restyleHexAgainstParent(hex, parentHex, delta) {
  const src = hexToHsl(hex);
  const parent = hexToHsl(parentHex);
  const dir = parent.l >= src.l ? -1 : 1;
  let next = hslToHex({
    ...src,
    l: Math.max(6, Math.min(94, src.l + dir * delta)),
  });
  if (fillsTooClose(next, parentHex)) {
    next = deriveDistinctFill(next, [parentHex], parent.l < 50);
  }
  return next;
}

/**
 * Per-control outlines on BG:Primary, distinct from each other and the fill.
 * @param {string} border
 * @param {{ guiButton: string, guiInput: string, guiTextarea: string }} fills
 * @param {boolean} isDark
 */
export function deriveGuiControlBorders(border, fills, isDark) {
  const guiInputBorder = deriveDistinctFill(border, [fills.guiInput, fills.guiButton, fills.guiTextarea], isDark);
  const guiTextareaBorder = deriveDistinctFill(guiInputBorder, [fills.guiTextarea, guiInputBorder], isDark);
  const guiButtonBorder = deriveDistinctFill(border, [fills.guiButton, guiInputBorder, guiTextareaBorder], isDark);
  return { guiButtonBorder, guiInputBorder, guiTextareaBorder };
}

/**
 * Assigned fill/border is the BG:Primary look. Secondary and Containers are
 * hardcoded restyles of that assignment — not extra swatch chips.
 * @param {string} assignedFill
 * @param {string} assignedBorder
 * @param {{ backgroundSecondary: string, surfaceContainers: string }} parents
 */
export function guiControlOnParents(assignedFill, assignedBorder, parents) {
  const secondaryFill = restyleHexAgainstParent(
    assignedFill,
    parents.backgroundSecondary,
    GUI_FILL_DELTA_SECONDARY
  );
  const containersFill = restyleHexAgainstParent(
    assignedFill,
    parents.surfaceContainers,
    GUI_FILL_DELTA_CONTAINERS
  );
  const secondaryBorder = ensureContrast(
    restyleHexAgainstParent(assignedBorder, parents.backgroundSecondary, GUI_BORDER_DELTA),
    secondaryFill,
    3
  );
  const containersBorder = ensureContrast(
    restyleHexAgainstParent(assignedBorder, parents.surfaceContainers, GUI_BORDER_DELTA),
    containersFill,
    3
  );
  return {
    background: { fill: assignedFill, border: assignedBorder },
    backgroundSecondary: { fill: secondaryFill, border: secondaryBorder },
    surfaceContainers: { fill: containersFill, border: containersBorder },
  };
}

/**
 * Flatten one control's parent variants onto palette keys
 * (guiButtonOnBackgroundSecondary, guiButtonBorder, …).
 * @param {'guiButton'|'guiInput'|'guiTextarea'} role
 * @param {ReturnType<typeof guiControlOnParents>} onParents
 */
export function flattenGuiControlOnParents(role, onParents) {
  return {
    [`${role}OnBackgroundSecondary`]: onParents.backgroundSecondary.fill,
    [`${role}OnSurfaceContainers`]: onParents.surfaceContainers.fill,
    [`${role}Border`]: onParents.background.border,
    [`${role}BorderOnBackgroundSecondary`]: onParents.backgroundSecondary.border,
    [`${role}BorderOnSurfaceContainers`]: onParents.surfaceContainers.border,
  };
}

export function deriveSurface(backgroundHex, isDark = hexToHsl(backgroundHex).l < 50) {
  const { h, s, l } = hexToHsl(backgroundHex);
  const surfaceIsDark = Boolean(isDark);
  const targetLightness = surfaceIsDark ? Math.min(l + 10, 88) : Math.max(l - 8, 12);
  const candidate = hslToHex({ h, s, l: targetLightness });
  const isClamped = candidate.toLowerCase() === backgroundHex.toLowerCase();

  if (!isClamped) return candidate;

  return hslToHex({
    // Hue shifts are ineffective on neutral colors, so also ensure a small
    // saturation change. A hue shift keeps highly saturated colors distinct.
    h: isClamped ? (h + (surfaceIsDark ? 8 : -8) + 360) % 360 : h,
    s: isClamped ? (s < 90 ? Math.min(s + 10, 100) : Math.max(s - 10, 0)) : s,
    l: targetLightness,
  });
}

/**
 * Build an ordered elevated-surface ladder from a page background.
 * Index 0 = darkest elevated stop; higher indices are progressively raised.
 * Used to remap a page's native light/dark surface ranking into Light|Gray|Dark.
 *
 * @param {string} backgroundHex
 * @param {boolean} isDark
 * @param {number} [steps=3]
 * @returns {string[]}
 */
export function deriveSurfaceLadder(backgroundHex, isDark, steps = 3) {
  const count = Math.max(1, Math.min(6, steps | 0));
  /** @type {string[]} */
  const ladder = [];
  let current = backgroundHex;
  for (let i = 0; i < count; i += 1) {
    current = deriveSurface(current, isDark);
    ladder.push(current);
  }
  return ladder;
}

/**
 * @param {string} baseColorHex
 * @param {'analog'|'complement'|'splitComplement'|'triadic'|'tetradic'|'monochrome'} scheme
 * @param {'light'|'light-gray'|'gray'|'dark-gray'|'dark'} [mode='dark']
 * @param {number} [intensity=0.5] 0–1 position in the tone band (0.5 = named tone)
 * @returns {{ background: string, backgroundSecondary: string, surface: string, surfaceGui: string, surfaceContainers: string, text: string, muted: string, accent: string, link: string, linkHover: string, navLink: string, navLinkHover: string, border: string, focus: string, textOnBackgroundSecondary: string, textOnSurfaceGui: string, textOnSurfaceContainers: string, textOnGuiButton: string, textOnGuiInput: string, textOnGuiTextarea: string, textOnSurface0: string, textOnSurface1: string, textOnSurface2: string, isDark: boolean }}
 */
export function buildPalette(baseColorHex, scheme, mode = 'dark', intensity = 0.5) {
  const base = hexToHsl(baseColorHex);
  const offsets = accentHueOffsets(scheme);
  // Relationship hues after the base. Spread later stops across chrome roles
  // so triadic's 3rd and tetradic's 4th show up beyond body links.
  const relationshipHues = offsets.map((offset) => rotate(base.h, offset));
  const accentHue = relationshipHues[0] ?? base.h;
  const linkHue = relationshipHues[1] ?? accentHue;
  const navLinkHue = relationshipHues[2] ?? relationshipHues[1] ?? accentHue;
  const focusHue = relationshipHues[1] ?? accentHue;
  const borderHue = relationshipHues[0] ?? base.h;
  // Tone-only / monochrome themes must not introduce a saturated accent.
  // A gray source has an arbitrary hue (usually 0°), which otherwise becomes
  // orange/red when the regular accent rule enforces high saturation.
  const relationshipSaturation = scheme === 'monochrome'
    ? Math.min(base.s, 12)
    : Math.max(base.s, 65);
  const linkSaturation = scheme === 'monochrome'
    ? Math.min(base.s, 12)
    : Math.max(base.s, 60);
  const borderSaturation = scheme === 'monochrome'
    ? Math.min(base.s, 20)
    : Math.min(Math.max(base.s, 28), 42);

  const isDark = toneIsDark(mode);
  const t = normalizeThemeIntensity(intensity);
  // Monochrome: the 5-stop Tone spectrum owns the canvas; picker L is a small nudge.
  // Chromatic: picker H/S/L is the color; mode only biases lightness so a
  // lime pick can still be lime (not a 25% gray-green).
  let backgroundLightness;
  if (scheme === 'monochrome') {
    const band = toneBand(mode);
    const tonalBase = toneCanvasLightness(mode, t);
    const neutralOffset = (base.l - 50) * 0.24;
    const lo = Math.min(band.lighter, band.darker);
    const hi = Math.max(band.lighter, band.darker);
    backgroundLightness = Math.max(lo, Math.min(hi, tonalBase + neutralOffset));
  } else {
    backgroundLightness = Math.max(4, Math.min(96, base.l + toneModeBias(mode)));
  }
  const backgroundSaturation = scheme === 'monochrome' ? Math.min(base.s, 8) : base.s;
  const textLightness = isDark ? 92 : 12;
  const mutedLightness = isDark ? 66 : 44;
  const accentLightness = isDark ? 62 : 45;
  const linkLightness = isDark ? 68 : 42;
  // Nav chrome prefers a later scheme stop (tetradic 4th / triadic 3rd) at a
  // distinct lightness so it stays in-scheme without matching body-link ink.
  const navLinkLightness = isDark ? 74 : 36;
  const borderLightness = isDark ? 22 : 84;
  const focusLightness = isDark ? 74 : 50;

  const background = hslToHex({
    h: base.h,
    s: backgroundSaturation,
    l: backgroundLightness,
  });
  const backgroundSecondary = deriveSurface(background, isDark);
  const surfaceGui = deriveSurface(backgroundSecondary, isDark);
  const surfaceContainers = deriveSurface(surfaceGui, isDark);
  // Three ranked elevated stops for preserving on-page tonal steps
  // (e.g. white post body vs #f2f2f2 meta strip vs darker secondary nav).
  const surfaceLadder = deriveSurfaceLadder(background, isDark, 3);
  const text = ensureContrast(
    hslToHex({ h: base.h, s: Math.min(base.s, 10), l: textLightness }),
    background,
    4.5
  );
  const muted = ensureContrast(
    hslToHex({ h: base.h, s: Math.min(base.s, 12), l: mutedLightness }),
    background,
    4.5
  );
  const accent = ensureContrast(
    hslToHex({ h: accentHue, s: relationshipSaturation, l: accentLightness }),
    background,
    4.5
  );
  const link = ensureContrast(
    hslToHex({ h: linkHue, s: linkSaturation, l: linkLightness }),
    background,
    4.5
  );
  const navLink = ensureContrast(
    hslToHex({ h: navLinkHue, s: linkSaturation, l: navLinkLightness }),
    background,
    4.5
  );
  const border = ensureContrast(
    hslToHex({ h: borderHue, s: borderSaturation, l: borderLightness }),
    background,
    3
  );
  const focus = ensureContrast(
    hslToHex({ h: focusHue, s: relationshipSaturation, l: focusLightness }),
    surfaceGui,
    3
  );
  const {
    guiButton,
    guiInput,
    guiTextarea,
    guiSlider,
  } = deriveGuiControlFills({
    background,
    backgroundSecondary,
    surfaceGui,
    surfaceContainers,
    accent,
    isDark,
  });
  const primaryBorders = deriveGuiControlBorders(border, { guiButton, guiInput, guiTextarea }, isDark);
  const guiParents = { backgroundSecondary, surfaceContainers };
  const guiOn = {
    ...flattenGuiControlOnParents(
      'guiButton',
      guiControlOnParents(guiButton, primaryBorders.guiButtonBorder, guiParents)
    ),
    ...flattenGuiControlOnParents(
      'guiInput',
      guiControlOnParents(guiInput, primaryBorders.guiInputBorder, guiParents)
    ),
    ...flattenGuiControlOnParents(
      'guiTextarea',
      guiControlOnParents(guiTextarea, primaryBorders.guiTextareaBorder, guiParents)
    ),
  };

  // Each independently-derived surface can drift lighter/darker than the
  // page's nominal isDark direction (hue-rotation escape hatches in
  // deriveSurface/deriveDistinctFill), so ink is re-checked per surface
  // rather than assumed safe from the global pick against `background`.
  const linkHover = deriveHoverColor(link, isDark);
  const linkActive = deriveActiveColor(link, isDark);
  const navLinkHover = deriveHoverColor(navLink, isDark);
  const navLinkActive = deriveActiveColor(navLink, isDark);
  const headingLarge = accent;
  const headingMedium = accent;
  const headingSmall = accent;
  const linkBare = link;
  const linkArticle = link;
  const mutedKicker = muted;
  const mutedPhotoCaption = muted;
  const mutedAsideNotes = muted;
  const inkOn = inkOnTokens(
    {
      text,
      accent,
      headingLarge,
      headingMedium,
      headingSmall,
      link,
      linkHover,
      linkActive,
      linkBare,
      linkArticle,
      muted,
      mutedKicker,
      mutedPhotoCaption,
      mutedAsideNotes,
      navLink,
      navLinkHover,
      navLinkActive,
    },
    paletteSurfaceFills({
      backgroundSecondary,
      surfaceGui,
      surfaceContainers,
      guiButton,
      guiInput,
      guiTextarea,
      surfaceLadder,
      ...guiOn,
    })
  );

  return {
    background,
    backgroundSecondary,
    // `surface` remains as a compatibility alias for saved state and callers
    // that predate the GUI/container split.
    surface: surfaceGui,
    surfaceGui,
    surfaceContainers,
    guiButton,
    guiInput,
    guiTextarea,
    guiSlider,
    surfaceLadder,
    text,
    muted,
    accent,
    link,
    linkHover,
    linkActive,
    navLink,
    navLinkHover,
    navLinkActive,
    border,
    focus,
    headingLarge,
    headingMedium,
    headingSmall,
    linkBare,
    linkArticle,
    mutedKicker,
    mutedPhotoCaption,
    mutedAsideNotes,
    ...guiOn,
    ...inkOn,
    isDark,
  };
}
