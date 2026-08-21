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

function rotate(h, degrees) {
  return (h + degrees + 360) % 360;
}

/**
 * Given a base color + scheme name, returns hue offsets (in degrees, from
 * the base hue) for a small set of "accent" hues. Lightness/saturation
 * shaping for actual page roles (bg/text/accent/link/border) happens in
 * buildPalette below.
 */
function accentHueOffsets(scheme) {
  switch (scheme) {
    case 'analog':
      return [-30, 30];
    case 'complement':
      return [180];
    case 'splitComplement':
      return [150, 210];
    case 'monochrome':
      return [];
    default:
      return [180];
  }
}

/**
 * @param {string} baseColorHex
 * @param {'analog'|'complement'|'splitComplement'|'monochrome'} scheme
 * @returns {{ background: string, text: string, accent: string, link: string, border: string, isDark: boolean }}
 */
export function buildPalette(baseColorHex, scheme) {
  const base = hexToHsl(baseColorHex);
  const offsets = accentHueOffsets(scheme);
  const accentHue = offsets.length ? rotate(base.h, offsets[0]) : base.h;
  const linkHue = offsets.length > 1 ? rotate(base.h, offsets[1]) : accentHue;

  // Lean dark by default (gx-er / cyber aesthetic per audience research),
  // deriving lightness from the base rather than hardcoding pure black/white.
  const isDark = true;

  const background = hslToHex({ h: base.h, s: Math.min(base.s, 25), l: isDark ? 8 : 96 });
  const text = hslToHex({ h: base.h, s: Math.min(base.s, 10), l: isDark ? 92 : 12 });
  const accent = hslToHex({ h: accentHue, s: Math.max(base.s, 65), l: isDark ? 62 : 45 });
  const link = hslToHex({ h: linkHue, s: Math.max(base.s, 60), l: isDark ? 68 : 42 });
  const border = hslToHex({ h: base.h, s: Math.min(base.s, 20), l: isDark ? 22 : 84 });

  return { background, text, accent, link, border, isDark };
}
