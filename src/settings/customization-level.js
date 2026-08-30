import { html, css } from 'lit';

/** @typedef {1 | 2 | 3} CustomizationLevel */

/** @type {ReadonlyArray<{ id: CustomizationLevel, label: string }>} */
export const CUSTOMIZATION_LEVEL_OPTIONS = [
  { id: 1, label: 'Customization Level 1' },
  { id: 2, label: 'Customization Level 2' },
  { id: 3, label: 'Customization Level 3' },
];

/**
 * Minimum customization level required to show each settings/walkthrough section.
 * Level 3 is reserved (no sections yet).
 * Texture + Clipping/Corners stay catalogued here for 0.1.1 but are suspended
 * via {@link DEFERRED_SECTION_IDS} for release 0.1.0 (see RELEASE-GOALS.md).
 * @type {Readonly<Record<string, CustomizationLevel>>}
 */
export const SECTION_CUSTOMIZATION_LEVEL = {
  tone: 1,
  color: 1,
  texture: 1, // deferred 0.1.0 → return 0.1.1
  filter: 1,
  fonts: 1,
  effects: 1,
  preview: 2,
  shape: 2, // Clipping / Corners — deferred 0.1.0 → return 0.1.1
  navigation: 2,
  'font-browser': 2,
};

/**
 * Settings / walkthrough / page-paint sections suspended for 0.1.0.
 * Remove an id here (and keep its customization level) to restore it in 0.1.1.
 * @type {ReadonlySet<string>}
 */
export const DEFERRED_SECTION_IDS = new Set(['texture', 'shape']);

/** @param {string} sectionId */
export function isDeferredSection(sectionId) {
  return DEFERRED_SECTION_IDS.has(sectionId);
}

/** Sections with an On/Off switch whose enablement is remembered across level drops. */
const SECTIONS_WITH_ENABLE_MEMORY = new Set([
  'color',
  'texture',
  'filter',
  'fonts',
  'shape',
  'effects',
  'navigation',
]);

/**
 * Walkthrough tab order: Level 1, then Level 2 in Settings order.
 * Texture and Clipping/Corners remain listed for 0.1.1 restore order;
 * {@link visibleWalkthroughSlides} hides them while deferred.
 * @type {ReadonlyArray<{ id: string, label: string, level: CustomizationLevel }>}
 */
export const WALKTHROUGH_SLIDES = [
  { id: 'tone', label: 'Tone', level: 1 },
  { id: 'color', label: 'Color Scheme', level: 1 },
  { id: 'texture', label: 'Texture', level: 1 }, // deferred 0.1.0
  { id: 'filter', label: 'Chroming Media', level: 1 },
  { id: 'fonts', label: 'Typography', level: 1 },
  { id: 'effects', label: 'Effects', level: 1 },
  { id: 'preview', label: 'Theme Preview', level: 2 },
  { id: 'shape', label: 'Clipping / Corners', level: 2 }, // deferred 0.1.0
  { id: 'navigation', label: 'Navigation', level: 2 },
  { id: 'font-browser', label: 'Font browser', level: 2 },
];

export const customizationLevelSelectStyles = css`
  .customization-level-picker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .customization-level-picker label {
    font-size: 11px;
    opacity: 0.78;
    white-space: nowrap;
  }

  .customization-level-picker select {
    min-width: 0;
    max-width: 100%;
    padding: 7px 8px;
    border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.18));
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.22);
    color: inherit;
    font: 650 11px/1.2 system-ui, sans-serif;
    box-sizing: border-box;
  }
`;

/**
 * @param {unknown} value
 * @returns {value is CustomizationLevel}
 */
export function isCustomizationLevel(value) {
  return value === 1 || value === 2 || value === 3;
}

/**
 * Explicit 1|2|3 wins. Missing/invalid (legacy installs) → 2 so existing
 * Level-2 sections stay visible until the user changes the dropdown.
 * @param {{ customizationLevel?: unknown } | null | undefined} ui
 * @returns {CustomizationLevel}
 */
export function effectiveCustomizationLevel(ui) {
  return isCustomizationLevel(ui?.customizationLevel) ? ui.customizationLevel : 2;
}

/**
 * @param {string} sectionId
 * @returns {CustomizationLevel}
 */
export function sectionCustomizationLevel(sectionId) {
  return SECTION_CUSTOMIZATION_LEVEL[sectionId] || 1;
}

/**
 * @param {string} sectionId
 * @param {CustomizationLevel|number} level
 */
export function sectionVisibleAtLevel(sectionId, level) {
  if (isDeferredSection(sectionId)) return false;
  return sectionCustomizationLevel(sectionId) <= level;
}

/**
 * @param {string} sectionId
 * @param {{ customizationLevel?: unknown } | null | undefined} ui
 */
export function sectionAllowedByCustomizationLevel(ui, sectionId) {
  return sectionVisibleAtLevel(sectionId, effectiveCustomizationLevel(ui));
}

/**
 * @template {{ id: string }} T
 * @param {T[]} sections
 * @param {CustomizationLevel|number} level
 * @returns {T[]}
 */
export function filterSectionsByCustomizationLevel(sections, level) {
  return sections.filter((section) => sectionVisibleAtLevel(section.id, level));
}

/**
 * @param {CustomizationLevel|number} level
 */
export function visibleWalkthroughSlides(level) {
  return WALKTHROUGH_SLIDES.filter(
    (slide) => !isDeferredSection(slide.id) && slide.level <= level
  );
}

/**
 * Current enablement for a remembered section.
 * @param {Record<string, unknown>} global
 * @param {string} id
 */
function readSectionEnabled(global, id) {
  if (id === 'navigation') return !!global?.navigation?.enabled;
  const sections = /** @type {Record<string, boolean>|undefined} */ (global?.sections);
  return sections?.[id] === true;
}

/**
 * Build a store patch when the user changes customization level.
 * Saves enablement for sections that drop out of range, forces them off,
 * and restores remembered values when they re-enter range.
 *
 * @param {CustomizationLevel|number} fromLevel
 * @param {CustomizationLevel|number} toLevel
 * @param {Record<string, unknown>} global current global state
 * @returns {Record<string, unknown>}
 */
export function patchForCustomizationLevel(fromLevel, toLevel, global) {
  const from = isCustomizationLevel(fromLevel) ? fromLevel : effectiveCustomizationLevel(global?.ui);
  const to = isCustomizationLevel(toLevel) ? toLevel : 1;
  const priorMemory =
    /** @type {Record<string, boolean|null|undefined>} */ (
      /** @type {{ customizationLevelSectionMemory?: Record<string, boolean|null> }} */ (global?.ui)
        ?.customizationLevelSectionMemory || {}
    );
  /** @type {Record<string, boolean|null>} */
  const memoryPatch = {};
  /** @type {Record<string, boolean>} */
  const sectionsPatch = {};
  /** @type {Record<string, unknown>} */
  const patch = {
    ui: {
      customizationLevel: to,
      customizationLevelSectionMemory: memoryPatch,
    },
  };

  for (const id of SECTIONS_WITH_ENABLE_MEMORY) {
    if (isDeferredSection(id)) continue;
    const minLevel = sectionCustomizationLevel(id);
    const wasVisible = minLevel <= from;
    const willBeVisible = minLevel <= to;
    const remembered =
      priorMemory[id] === true || priorMemory[id] === false ? priorMemory[id] : undefined;

    if (wasVisible && !willBeVisible) {
      // Only write memory once per drop so a second drop cannot overwrite it.
      memoryPatch[id] = remembered === undefined ? readSectionEnabled(global, id) : remembered;
      sectionsPatch[id] = false;
      if (id === 'navigation') {
        patch.navigation = { enabled: false };
      }
      if (id === 'filter') {
        patch.imageFilter = { enabled: false };
      }
      continue;
    }

    if (!wasVisible && willBeVisible && remembered !== undefined) {
      const restored = remembered === true;
      sectionsPatch[id] = restored;
      if (id === 'navigation') {
        patch.navigation = { enabled: restored };
      }
      if (id === 'filter') {
        patch.imageFilter = { enabled: restored };
      }
      // deepMerge only clears keys when patched to null.
      memoryPatch[id] = null;
    }
  }

  if (Object.keys(sectionsPatch).length) {
    patch.sections = sectionsPatch;
  }

  return patch;
}

/**
 * @param {{
 *   value: CustomizationLevel,
 *   id?: string,
 *   onChange: (level: CustomizationLevel) => void,
 * }} options
 */
export function renderCustomizationLevelSelect({ value, id = 'customization-level', onChange }) {
  const labelId = `${id}-label`;
  return html`
    <div class="customization-level-picker">
      <label id=${labelId} for=${id}>Customization Level:</label>
      <select
        id=${id}
        aria-labelledby=${labelId}
        @change=${(event) => {
          const next = Number(event.target.value);
          if (isCustomizationLevel(next)) onChange(next);
        }}
      >
        ${CUSTOMIZATION_LEVEL_OPTIONS.map(
          (option) => html`
            <option value=${option.id} ?selected=${option.id === value}>${option.label}</option>
          `
        )}
      </select>
    </div>
  `;
}
