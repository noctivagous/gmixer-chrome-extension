// Baseline grid / print-layout tokens for the in-page settings slide-out.
// Module 8px, baseline 24px — vertical rhythm snaps to 24.

export const GRID = Object.freeze({
  module: 8,
  baseline: 24,
  railWidth: 192, // 24 × 8
  titlebarHeight: 48, // 2 × 24
  panelWidth: 520,
  /** Min page strip visible beside the drawer (so live theme stays in view). */
  panelPagePeek: 48,
});

/** CSS custom properties injected on the popover host (light DOM). */
export const GRID_CSS_VARS = `
  --gm-module: ${GRID.module}px;
  --gm-baseline: ${GRID.baseline}px;
  --gm-rail: ${GRID.railWidth}px;
  --gm-titlebar: ${GRID.titlebarHeight}px;
  --gm-space-1: ${GRID.module}px;
  --gm-space-2: ${GRID.module * 2}px;
  --gm-space-3: ${GRID.module * 3}px;
  --gm-space-4: ${GRID.module * 4}px;
  --gm-line: ${GRID.baseline}px;
  --gm-bg: #14121a;
  --gm-surface: #1c1826;
  --gm-border: rgba(255, 255, 255, 0.1);
  --gm-text: #f2eefc;
  --gm-muted: rgba(242, 238, 252, 0.65);
  --gm-accent: #7c3aed;
  --gm-accent-soft: rgba(124, 58, 237, 0.28);
`;
