// Caps for live-DOM walks. Huge pages (feeds, docs) must not stall the tab;
// leftover nodes keep native styles until the next full adaptive pass.
//
// Classifier is tighter than overlay tagging because each element may call
// getComputedStyle. Media effects iterate `document.images` (cheap to bound)
// but wrapping thousands of images still janks.
//
// These are global budgets — do not add per-host overrides.

/** Structural/media classification + native-luminance stamping. */
export const MAX_CLASSIFIER_SCAN = 2500;

/** Resolved background-image overlay tagging. */
export const MAX_BACKGROUND_IMAGE_SCAN = 3000;

/** Pan-scan / rotating-cube image wrapping. */
export const MAX_MEDIA_EFFECT_SCAN = 3000;

/** Skip wrapping chrome icons / avatars; layout reads on tiny images still jank. */
export const MIN_MEDIA_EFFECT_PX = 72;
