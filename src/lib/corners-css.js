// Shared corner override CSS for style-injector + theme preview.
// Precedence: when Clipping and Corners both apply to the same element,
// Corners wins — its rules are emitted after Clipping and use !important
// on border-radius / corner-shape.

const SCOPES = {
  images: 'img, video, picture',
  buttons: 'button, [role="button"], input[type="button"], input[type="submit"]',
  all: 'img, video, picture, button, [role="button"], input[type="button"], input[type="submit"]',
};

/**
 * @param {{ enabled?: boolean, radius?: number, bevel?: {
 *   topLeft?: boolean, topRight?: boolean, bottomRight?: boolean, bottomLeft?: boolean
 * }, scope?: string } | null | undefined} corners
 * @returns {string} CSS declarations (no selector), or '' when disabled
 */
export function cornersDeclarations(corners) {
  if (!corners?.enabled) return '';

  const radius = Math.max(0, Math.min(48, Number(corners.radius) || 0));
  const bevel = corners.bevel ?? {};
  const shape = (cut) => (cut ? 'bevel' : 'round');
  const cornerShape = [
    shape(bevel.topLeft),
    shape(bevel.topRight),
    shape(bevel.bottomRight),
    shape(bevel.bottomLeft),
  ].join(' ');

  const hasBevel =
    bevel.topLeft || bevel.topRight || bevel.bottomRight || bevel.bottomLeft;

  const parts = [`border-radius: ${radius}px !important`];
  if (hasBevel) {
    parts.push(`corner-shape: ${cornerShape} !important`);
  }
  return `${parts.join('; ')};`;
}

/**
 * @param {Parameters<typeof cornersDeclarations>[0]} corners
 * @returns {string} Full CSS rule, or ''
 */
export function cornersRule(corners) {
  const decls = cornersDeclarations(corners);
  if (!decls) return '';
  const targets = SCOPES[corners.scope] ?? SCOPES.all;
  return `${targets} { ${decls} }`;
}
