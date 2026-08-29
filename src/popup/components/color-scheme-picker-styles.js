import { html, css, svg } from 'lit';

/**
 * Shared Color Scheme picker chrome — a one-way pipeline:
 *   1 Scheme → 2 Hue ring (s=1.0, l=0.5) → 3 Saturation & Lightness
 * Each step feeds the next. Later steps must not rewrite earlier ones
 * (scheme stays put when hue moves; hue stays put when S/L move).
 */
export const colorSchemePickerStyles = css`
  .color-picker-flow {
    display: grid;
    gap: 12px;
    width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }

  .picker-group-fieldset {
    width: 100%;
  }

  .color-picker-pipeline {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 6px;
    align-items: stretch;
    width: 100%;
    min-width: 0;
  }

  .color-picker-flow gmixer-color-scheme-scales {
    display: block;
    width: 100%;
    min-width: 0;
  }

  .color-mode-option {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .color-mode-icon {
    display: block;
    flex: 0 0 18px;
    width: 18px;
    height: 18px;
    overflow: visible;
  }

  .picker-fieldset {
    margin: 0;
    min-width: 0;
    padding: 8px 8px 10px;
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.18);
    box-sizing: border-box;
  }

  .picker-fieldset legend {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 6px;
    color: var(--gm-text, #f2eefc);
    font: 650 11px/1.2 system-ui, sans-serif;
    letter-spacing: 0.02em;
  }

  .picker-step-index {
    display: grid;
    flex: 0 0 auto;
    place-items: center;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--gm-accent, #7c3aed);
    color: #fff;
    font: 700 9px/1 system-ui, sans-serif;
  }

  .scheme-fieldset {
    flex: 1 1 140px;
    align-self: stretch;
  }

  .scheme-fieldset .scheme-options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
    gap: 6px;
    align-content: start;
    width: 100%;
    min-width: 0;
    margin: 0;
  }

  .hue-fieldset {
    display: grid;
    flex: 0 0 auto;
    justify-items: center;
    align-content: center;
    gap: 8px;
    width: max-content;
    align-self: stretch;
  }

  .hue-fieldset gmixer-color-wheel {
    width: 160px;
  }

  .hue-caption {
    color: var(--gm-muted, rgba(242, 238, 252, 0.7));
    font: 700 9px/1 system-ui, sans-serif;
    letter-spacing: 0.04em;
  }

  .hsl-fieldset {
    display: grid;
    flex: 0 0 auto;
    justify-items: center;
    align-content: center;
    width: max-content;
    align-self: stretch;
  }

  .picker-flow-arrow {
    display: grid;
    flex: 0 0 auto;
    align-self: stretch;
    place-items: center;
    width: 16px;
    color: var(--gm-muted, rgba(242, 238, 252, 0.7));
  }

  .picker-flow-arrow svg {
    display: block;
  }

  .hsl-sliders {
    display: grid;
    grid-template-columns: repeat(2, 50px);
    gap: 6px;
    justify-content: center;
    min-height: 160px;
  }

  .hsl-slider {
    display: grid;
    grid-template-rows: 1fr auto;
    gap: 5px;
    justify-items: center;
    color: var(--gm-muted, rgba(242, 238, 252, 0.7));
    font: 700 9px/1 system-ui, sans-serif;
  }

  .hsl-slider-shell {
    position: relative;
    width: 50px;
    height: 150px;
  }

  .hsl-track {
    position: absolute;
    inset: 0;
    border: 1px solid rgba(255, 255, 255, 0.18);
    border-radius: 4px;
    background-image:
      linear-gradient(to top, var(--hsl-band-0-a), var(--hsl-band-0-b)),
      linear-gradient(to top, var(--hsl-band-1-a), var(--hsl-band-1-b)),
      linear-gradient(to top, var(--hsl-band-2-a), var(--hsl-band-2-b)),
      linear-gradient(to top, var(--hsl-band-3-a), var(--hsl-band-3-b));
    background-size: calc(100% / var(--hsl-band-count, 1)) 100%;
    background-position:
      calc(0 * 100% / var(--hsl-band-count, 1)) 0,
      calc(1 * 100% / var(--hsl-band-count, 1)) 0,
      calc(2 * 100% / var(--hsl-band-count, 1)) 0,
      calc(3 * 100% / var(--hsl-band-count, 1)) 0;
    background-repeat: no-repeat;
    pointer-events: none;
  }

  .hsl-slider input {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 150px;
    height: 50px;
    margin: 0;
    transform: translate(-50%, -50%) rotate(-90deg);
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
  }

  .hsl-slider input::-webkit-slider-runnable-track {
    appearance: none;
    -webkit-appearance: none;
    background: transparent;
    border: 0;
    height: 50px;
  }

  .hsl-slider input::-webkit-slider-thumb {
    appearance: none;
    -webkit-appearance: none;
    width: 10px;
    height: 48px;
    margin: 0;
    border: 1px solid rgba(255, 255, 255, 0.85);
    border-radius: 2px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
    cursor: grab;
  }

  @media (max-width: 560px) {
    .hsl-sliders {
      grid-template-columns: repeat(2, minmax(120px, 1fr));
      width: 100%;
      min-height: auto;
    }

    .hsl-slider-shell {
      width: 100%;
      height: 50px;
    }

    .hsl-track {
      background-image:
        linear-gradient(to right, var(--hsl-band-0-a), var(--hsl-band-0-b)),
        linear-gradient(to right, var(--hsl-band-1-a), var(--hsl-band-1-b)),
        linear-gradient(to right, var(--hsl-band-2-a), var(--hsl-band-2-b)),
        linear-gradient(to right, var(--hsl-band-3-a), var(--hsl-band-3-b));
      background-size: 100% calc(100% / var(--hsl-band-count, 1));
      background-position:
        0 calc(0 * 100% / var(--hsl-band-count, 1)),
        0 calc(1 * 100% / var(--hsl-band-count, 1)),
        0 calc(2 * 100% / var(--hsl-band-count, 1)),
        0 calc(3 * 100% / var(--hsl-band-count, 1));
    }

    .hsl-slider input {
      left: 0;
      top: 0;
      width: 100%;
      height: 50px;
      transform: none;
    }

    .hsl-slider input::-webkit-slider-runnable-track {
      width: 100%;
      height: 50px;
    }

    .hsl-slider input::-webkit-slider-thumb {
      width: 10px;
      height: 48px;
    }
  }
`;

function colorModeRingWedges(fills) {
  const r = 8;
  const cx = 12;
  const cy = 12;
  const toXY = (deg) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [cx + Math.cos(rad) * r, cy + Math.sin(rad) * r];
  };
  return fills.map((fill, i) => {
    const start = toXY(i * 60);
    const end = toXY((i + 1) * 60);
    return svg`<path
      fill=${fill}
      d=${`M${cx} ${cy}L${start[0].toFixed(2)} ${start[1].toFixed(2)}A${r} ${r} 0 0 1 ${end[0].toFixed(2)} ${end[1].toFixed(2)}Z`}
    />`;
  });
}

/**
 * @param {'monochrome'|'color'} mode
 */
export function colorModeIcon(mode) {
  const wedges =
    mode === 'monochrome'
      ? colorModeRingWedges(['#f4f4f5', '#d4d4d8', '#a1a1aa', '#71717a', '#3f3f46', '#18181b'])
      : colorModeRingWedges(['#ef4444', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#a855f7']);
  return html`
    <svg
      class="color-mode-icon"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      focusable="false"
    >
      ${wedges}
      <circle cx="12" cy="12" r="3.25" fill="var(--gm-bg, #14121a)" />
      <circle
        cx="12"
        cy="12"
        r="8"
        fill="none"
        stroke="currentColor"
        stroke-opacity="0.35"
        stroke-width="1"
      />
    </svg>
  `;
}

export function colorPickerFlowArrow() {
  return html`
    <span class="picker-flow-arrow" aria-hidden="true">
      <svg viewBox="0 0 24 24" width="16" height="16" focusable="false">
        <path
          d="M5 12h12m0 0-5-5m5 5-5 5"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
  `;
}

/**
 * Numbered fieldset caption: filled circle + label (1 Scheme, 2 Hue, …).
 * @param {number} step
 * @param {string} label
 */
export function pickerFieldsetLegend(step, label) {
  return html`
    <legend>
      <span class="picker-step-index">${step}</span>
      ${label}
    </legend>
  `;
}
