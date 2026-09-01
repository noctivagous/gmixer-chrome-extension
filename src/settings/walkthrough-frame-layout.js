/** Walkthrough iframe box vs. inner host — keep these in lockstep. */

export const WALKTHROUGH_LAYOUT_PANEL = 'panel';
export const WALKTHROUGH_LAYOUT_COMPLETION = 'completion';

export const WALKTHROUGH_COMPLETION_FRAME_CSS = {
  width: 'min(440px, calc(100vw - 32px))',
  height: '320px',
};

/** Never undersize the iframe or the inner document shows a scrollbar. */
export function iframeBoxPx(size) {
  return Math.max(1, Math.ceil(size));
}

/**
 * @param {'panel'|'completion'} layout
 * @param {{ width?: number, height?: number }|null} [metrics]
 */
export function walkthroughLayoutMessage(layout, metrics = null) {
  return {
    source: 'gmixer-ui',
    type: 'layout',
    layout: layout === WALKTHROUGH_LAYOUT_COMPLETION ? WALKTHROUGH_LAYOUT_COMPLETION : WALKTHROUGH_LAYOUT_PANEL,
    width: Number.isFinite(metrics?.width) ? metrics.width : null,
    height: Number.isFinite(metrics?.height) ? metrics.height : null,
  };
}

/**
 * Size the outer walkthrough iframe to the inner host's completion/panel box.
 * @param {HTMLElement|null|undefined} popover
 * @param {{ layout?: string, width?: number|null, height?: number|null }} payload
 * @param {HTMLIFrameElement|null} [iframe]
 */
export function applyWalkthroughFrameLayout(popover, payload, iframe = null) {
  if (!popover) return;
  const frame =
    iframe ||
    (typeof popover.querySelector === 'function'
      ? popover.querySelector('iframe.gmixer-ui-frame')
      : null);
  const compact = payload?.layout === WALKTHROUGH_LAYOUT_COMPLETION;
  if (compact) {
    popover.setAttribute('data-gmixer-layout', WALKTHROUGH_LAYOUT_COMPLETION);
  } else {
    popover.removeAttribute('data-gmixer-layout');
  }
  if (!frame?.style) return;
  if (compact && payload.width > 0 && payload.height > 0) {
    frame.style.width = `${iframeBoxPx(payload.width)}px`;
    frame.style.height = `${iframeBoxPx(payload.height)}px`;
    frame.style.maxWidth = 'none';
    frame.style.maxHeight = 'none';
    return;
  }
  frame.style.removeProperty('width');
  frame.style.removeProperty('height');
  frame.style.removeProperty('max-width');
  frame.style.removeProperty('max-height');
}
