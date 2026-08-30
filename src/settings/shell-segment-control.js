import { html, css, nothing } from 'lit';

/** @typedef {import('../state/schema.js').PreferredShell} PreferredShell */

/** @type {ReadonlyArray<{ id: PreferredShell, label: string }>} */
export const SHELL_OPTIONS = [
  { id: 'side-panel', label: 'Side Panel' },
  { id: 'walkthrough-modal', label: 'Walkthrough Modal' },
];

export const shellSegmentControlStyles = css`
  .shell-segments {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid var(--gm-border, rgba(255, 255, 255, 0.15));
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.18);
  }

  .shell-segment {
    margin: 0;
    padding: 7px 10px;
    border: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0;
    background: transparent;
    color: var(--gm-muted, rgba(242, 238, 252, 0.65));
    font: 650 11px/1.2 system-ui, sans-serif;
    letter-spacing: 0.01em;
    cursor: pointer;
    box-sizing: border-box;
    text-align: center;
    white-space: nowrap;
  }

  .shell-segment:last-child {
    border-right: 0;
  }

  .shell-segment:hover {
    background: rgba(139, 92, 246, 0.1);
  }

  .shell-segment:focus-visible {
    z-index: 1;
    outline: 2px solid var(--gm-accent, #8b5cf6);
    outline-offset: -2px;
  }

  .shell-segment[aria-pressed='true'] {
    background: var(--gm-accent-soft, rgba(124, 58, 237, 0.28));
    box-shadow: inset 0 -2px 0 var(--gm-accent, #7c3aed);
    color: var(--gm-text, #f2eefc);
  }
`;

/**
 * @param {{
 *   value: PreferredShell,
 *   labelledBy?: string,
 *   onSelect: (shell: PreferredShell) => void,
 * }} options
 */
export function renderShellSegments({ value, labelledBy, onSelect }) {
  return html`
    <div
      class="shell-segments"
      role="group"
      aria-labelledby=${labelledBy || nothing}
    >
      ${SHELL_OPTIONS.map(
        (option) => html`
          <button
            type="button"
            class="shell-segment"
            aria-pressed=${option.id === value}
            @click=${() => onSelect(option.id)}
          >
            ${option.label}
          </button>
        `
      )}
    </div>
  `;
}
