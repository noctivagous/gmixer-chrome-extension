/**
 * Shared labels and hit-test helpers for Live Preview inspect tooltips.
 */

/** @typedef {{ id: string, label: string }} PreviewColorRole */

/** Color roles shown in preview tooltips / pinned editors. */
export const PREVIEW_COLOR_ROLES = /** @type {const} */ ([
  { id: 'background', label: 'BG:Primary' },
  { id: 'backgroundSecondary', label: 'BG:Secondary' },
  { id: 'surfaceGui', label: 'Surface: GUI' },
  { id: 'surfaceContainers', label: 'Surface: Containers' },
  { id: 'guiButton', label: 'Surface:GUI:Button' },
  { id: 'guiInput', label: 'Surface:GUI:Input' },
  { id: 'guiTextarea', label: 'Surface:GUI:TextArea' },
  { id: 'guiSlider', label: 'Surface:GUI:Slider' },
  { id: 'text', label: 'Text' },
  { id: 'muted', label: 'Muted' },
  { id: 'accent', label: 'Accent' },
  { id: 'headingLarge', label: 'Accent:Heading-Large' },
  { id: 'headingMedium', label: 'Accent:Heading-Medium' },
  { id: 'headingSmall', label: 'Accent:Heading-Small' },
  { id: 'link', label: 'Link' },
  { id: 'linkHover', label: 'Link hover' },
  { id: 'navLink', label: 'Nav link' },
  { id: 'navLinkHover', label: 'Nav hover' },
  { id: 'border', label: 'Border' },
  { id: 'focus', label: 'Focus' },
]);

const ROLE_LABEL_BY_ID = Object.fromEntries(
  PREVIEW_COLOR_ROLES.map((role) => [role.id, role.label])
);

/** Media target label (no color override). */
export const PREVIEW_MEDIA_LABEL = 'Media';

/**
 * @param {string|null|undefined} roleId
 * @returns {string}
 */
export function previewRoleLabel(roleId) {
  if (!roleId) return '';
  return ROLE_LABEL_BY_ID[roleId] || roleId;
}

/**
 * Font slot descriptors used by the pinned inspector.
 * `path` is a dot path under `global.fonts` (e.g. `headings.h1`, `paragraph`).
 * `pickerTarget` is the gmixer-font-picker `target` attribute.
 *
 * @typedef {{ path: string, pickerTarget: string, label: string }} PreviewFontSlot
 */

/** @type {Record<string, PreviewFontSlot>} */
export const PREVIEW_FONT_SLOTS = {
  'headings.h1': { path: 'headings.h1', pickerTarget: 'headers', label: 'Hero / H1' },
  'headings.h2': { path: 'headings.h2', pickerTarget: 'headers', label: 'Subhead / H2' },
  'headings.h3': { path: 'headings.h3', pickerTarget: 'headers', label: 'H3' },
  'headings.h4': { path: 'headings.h4', pickerTarget: 'headers', label: 'H4' },
  'headings.h5': { path: 'headings.h5', pickerTarget: 'headers', label: 'H5' },
  'headings.h6': { path: 'headings.h6', pickerTarget: 'headers', label: 'H6' },
  paragraph: { path: 'paragraph', pickerTarget: 'paragraph', label: 'Paragraph' },
  captions: { path: 'captions', pickerTarget: 'captions', label: 'Captions' },
  ui: { path: 'ui', pickerTarget: 'ui', label: 'UI' },
  code: { path: 'code', pickerTarget: 'code', label: 'Code' },
};

/**
 * @typedef {{
 *   roleId: string|null,
 *   fontSlot: string|null,
 *   media: string|null,
 *   label: string,
 *   el: Element|null,
 * }} PreviewInspectTarget
 */

/**
 * Resolve the deepest annotated preview target from an event path / element.
 * Ignores nodes inside `[data-gmixer-preview-inspect]`.
 *
 * @param {EventTarget|null|undefined} start
 * @param {ParentNode|null} [root]
 * @returns {PreviewInspectTarget|null}
 */
export function resolvePreviewTarget(start, root = null) {
  // Duck-typed so unit tests can pass plain element mocks.
  let node =
    start && typeof start.getAttribute === 'function' && typeof start.hasAttribute === 'function'
      ? start
      : null;
  while (node) {
    if (root && node === root) break;
    if (node.hasAttribute('data-gmixer-preview-inspect')) return null;

    const roleId = node.getAttribute('data-gmixer-preview-role') || null;
    const fontSlot = node.getAttribute('data-gmixer-preview-font') || null;
    const media = node.getAttribute('data-gmixer-preview-media') || null;

    if (roleId || fontSlot || media) {
      const label = media
        ? PREVIEW_MEDIA_LABEL
        : previewRoleLabel(roleId) || (fontSlot ? PREVIEW_FONT_SLOTS[fontSlot]?.label : '') || 'Preview';
      return {
        roleId,
        fontSlot,
        media,
        label,
        // Concrete node for hover-link arrows when many share a role/slot.
        el: /** @type {Element} */ (node),
      };
    }

    if (root && typeof root.contains === 'function' && !root.contains(node)) break;
    node = node.parentElement;
  }
  return null;
}

/**
 * True when two inspect targets refer to the same editable region.
 * @param {PreviewInspectTarget|null|undefined} a
 * @param {PreviewInspectTarget|null|undefined} b
 */
export function samePreviewTarget(a, b) {
  if (!a || !b) return false;
  return a.roleId === b.roleId && a.fontSlot === b.fontSlot && a.media === b.media;
}

/**
 * Read the current fontId for a preview font slot from global.fonts.
 * @param {object|null|undefined} fonts
 * @param {string|null|undefined} slotKey
 * @returns {string}
 */
export function fontIdForPreviewSlot(fonts, slotKey) {
  if (!fonts || !slotKey) return 'system-body';
  const slot = PREVIEW_FONT_SLOTS[slotKey];
  if (!slot) return 'system-body';
  const parts = slot.path.split('.');
  let cur = fonts;
  for (const part of parts) {
    cur = cur?.[part];
  }
  if (cur?.fontId) return cur.fontId;
  // Compat fallbacks for heading slots.
  if (slotKey === 'headings.h1') return fonts.headers?.fontId || 'system-body';
  if (/^headings\.h[2-6]$/.test(slotKey)) {
    return fonts.subheadings?.fontId || fonts.headers?.fontId || 'system-body';
  }
  return 'system-body';
}

/**
 * Build a `fonts` patch for store.update from a preview font slot + fontId.
 * @param {string} slotKey
 * @param {string} fontId
 */
export function fontsPatchForPreviewSlot(slotKey, fontId) {
  const slot = PREVIEW_FONT_SLOTS[slotKey];
  if (!slot) return {};
  const parts = slot.path.split('.');
  if (parts.length === 1) {
    return { [parts[0]]: { fontId } };
  }
  if (parts.length === 2) {
    return { [parts[0]]: { [parts[1]]: { fontId } } };
  }
  return {};
}
