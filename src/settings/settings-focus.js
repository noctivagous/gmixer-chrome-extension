// Settings focus / prioritization — which accordion sections the panel shows.
// See product description.txt lines 6–12 and BRANDED_SITE_THEMING_AUDIT.md.

/** @typedef {'theme' | 'tone' | 'media'} SettingsFocus */

/** @type {{ id: SettingsFocus, label: string }[]} */
export const SETTINGS_FOCUS_OPTIONS = [
  { id: 'media', label: 'Only: Monochrome Page Media' },
  { id: 'tone', label: 'Only: Light | Gray | Dark Mode (Tone)' },
  { id: 'theme', label: 'Theme (Select Settings)' },
];

/**
 * Filter accordion sections by the user's settings focus.
 * @template {{ id: string }} T
 * @param {T[]} sections
 * @param {SettingsFocus|string|null|undefined} focus
 * @returns {T[]}
 */
export function visibleSectionsForFocus(sections, focus) {
  if (focus === 'tone') return sections.filter((section) => section.id === 'tone');
  if (focus === 'media') return sections.filter((section) => section.id === 'filter');
  return sections;
}

/**
 * Preferred open accordion when entering a focused mode.
 * @param {SettingsFocus|string|null|undefined} focus
 * @returns {string|null}
 */
export function preferredOpenSectionForFocus(focus) {
  if (focus === 'tone') return 'tone';
  if (focus === 'media') return 'filter';
  return null;
}
