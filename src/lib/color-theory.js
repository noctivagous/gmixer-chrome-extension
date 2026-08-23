// Generates a page-role palette from ONE base color, using standard
// color-theory relationships. See product description.txt > FEATURE 1.

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

export function hslToHex({ h, s, l }) {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lNorm - c / 2;

  let [r, g, b] = [0, 0, 0];
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
function ensureContrast(foreground, background, minimumRatio) {
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

function rotate(h, degrees) {
  return (h + degrees + 360) % 360;
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
 */
export function deriveSurface(backgroundHex, _isDark) {
  const { h, s, l } = hexToHsl(backgroundHex);
  const surfaceIsDark = l < 50;
  return hslToHex({
    h,
    s: Math.min(s, 25),
    l: surfaceIsDark ? Math.min(l + 10, 88) : Math.max(l - 8, 12),
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
 * @param {'light'|'gray'|'dark'} [mode='dark']
 * @returns {{ background: string, backgroundSecondary: string, surface: string, surfaceGui: string, surfaceContainers: string, text: string, muted: string, accent: string, link: string, border: string, focus: string, isDark: boolean }}
 */
export function buildPalette(baseColorHex, scheme, mode = 'dark') {
  const base = hexToHsl(baseColorHex);
  const offsets = accentHueOffsets(scheme);
  const accentHue = offsets.length ? rotate(base.h, offsets[0]) : base.h;
  const linkHue = offsets.length > 1 ? rotate(base.h, offsets[1]) : accentHue;

  const isDark = mode !== 'light';
  const backgroundLightness = mode === 'light' ? 96 : mode === 'gray' ? 42 : 8;
  const textLightness = isDark ? 92 : 12;
  const mutedLightness = isDark ? 66 : 44;
  const accentLightness = isDark ? 62 : 45;
  const linkLightness = isDark ? 68 : 42;
  const borderLightness = isDark ? 22 : 84;
  const focusLightness = isDark ? 74 : 50;

  const background = hslToHex({
    h: base.h,
    s: Math.min(base.s, mode === 'gray' ? 18 : 25),
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
    hslToHex({ h: accentHue, s: Math.max(base.s, 65), l: accentLightness }),
    background,
    4.5
  );
  const link = ensureContrast(
    hslToHex({ h: linkHue, s: Math.max(base.s, 60), l: linkLightness }),
    background,
    4.5
  );
  const border = ensureContrast(
    hslToHex({ h: base.h, s: Math.min(base.s, 20), l: borderLightness }),
    background,
    3
  );
  const focus = ensureContrast(
    hslToHex({ h: accentHue, s: Math.max(base.s, 65), l: focusLightness }),
    surfaceGui,
    3
  );

  return {
    background,
    backgroundSecondary,
    // `surface` remains as a compatibility alias for saved state and callers
    // that predate the GUI/container split.
    surface: surfaceGui,
    surfaceGui,
    surfaceContainers,
    surfaceLadder,
    text,
    muted,
    accent,
    link,
    border,
    focus,
    isDark,
  };
}
