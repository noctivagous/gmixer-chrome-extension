// Settings focus / prioritization — which accordion sections the panel shows.
// See product description.txt lines 6–12 and BRANDED_SITE_THEMING_AUDIT.md.
//
// Tone (Light | Gray | Dark) lives inside the Color module. "Only: Tone" still
// focuses that layer: the Color accordion opens in tone-only UI, and paint uses
// full Light|Gray|Dark restyle (same as Color with identity = Fully restyle).

/** @typedef {'theme' | 'tone' | 'media'} SettingsFocus */

/** @type {{ id: SettingsFocus, label: string }[]} */
export const SETTINGS_FOCUS_OPTIONS = [
  { id: 'media', label: 'Only: Monochrome Page Media' },
  { id: 'tone', label: 'Only: Tone Light | Gray | Dark Mode' },
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
  // Tone focus shows the Color module (tone-only chrome); Color owns Tone UI.
  if (focus === 'tone') return sections.filter((section) => section.id === 'color');
  if (focus === 'media') return sections.filter((section) => section.id === 'filter');
  return sections;
}

/**
 * Preferred open accordion when entering a focused mode.
 * @param {SettingsFocus|string|null|undefined} focus
 * @returns {string|null}
 */
export function preferredOpenSectionForFocus(focus) {
  if (focus === 'tone') return 'color';
  if (focus === 'media') return 'filter';
  return null;
}

/**
 * Whether a section may paint / run while this settings focus is active.
 * "Only" modes hard-gate other layers even if their section switches are On.
 * @param {SettingsFocus|string|null|undefined} focus
 * @param {string} sectionId
 */
export function sectionAllowedByFocus(focus, sectionId) {
  if (focus === 'media') return sectionId === 'filter';
  // Tone focus paints through the Color section (merged Tone + Color module).
  if (focus === 'tone') return sectionId === 'color' || sectionId === 'tone';
  return true;
}

/**
 * Store patch applied when the user picks a settings focus.
 * Media focus turns on the Media accordion + monochrome filter + reveal-on-hover.
 * Tone focus turns on Color (Tone lives there) for full Light|Gray|Dark paint.
 * Other layers stay as stored; paint is gated by {@link sectionAllowedByFocus}.
 *
 * @param {SettingsFocus|string|null|undefined} focus
 * @returns {Record<string, unknown>}
 */
export function patchForSettingsFocus(focus) {
  const preferred = preferredOpenSectionForFocus(focus);
  /** @type {Record<string, unknown>} */
  const ui = { settingsFocus: focus };
  if (preferred) ui.openSection = preferred;

  if (focus === 'media') {
    return {
      ui,
      sections: { filter: true },
      imageFilter: {
        enabled: true,
        preset: 'monochrome',
        revealOnHover: true,
      },
    };
  }

  if (focus === 'tone') {
    return {
      ui,
      sections: { color: true, tone: true },
      color: { identityMode: 'restyle', intensity: 100 },
    };
  }

  return { ui };
}
