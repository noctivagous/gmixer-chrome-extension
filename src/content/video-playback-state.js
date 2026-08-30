// Chrome does not support the CSS media pseudo-classes `:paused` / `:playing`
// in stylesheets (`CSS.supports('selector(video:paused)') === false`). Bare
// `video:paused` in a selector list drops the entire rule from the CSSOM, so
// Chroming Media video filters never applied. Stamp play/pause from JS instead.

export const VIDEO_STATE_ATTR = 'data-gmixer-video-state';

/** @param {{ paused?: boolean } | null | undefined} video */
export function videoPlaybackState(video) {
  return video?.paused ? 'paused' : 'playing';
}

/** @param {Element | null | undefined} video */
function isVideoElement(video) {
  return !!video && video.nodeType === 1 && String(video.tagName).toUpperCase() === 'VIDEO';
}

/** @param {Element} video */
export function stampVideoElementState(video) {
  if (!isVideoElement(video)) return;
  video.setAttribute(VIDEO_STATE_ATTR, videoPlaybackState(/** @type {{ paused?: boolean }} */ (video)));
}

/**
 * Stamp every `<video>` under root (including root when it is a video).
 * @param {ParentNode|Element|Document|null|undefined} [root]
 * @returns {number} stamped count
 */
export function stampVideoPlaybackState(root = document) {
  if (!root) return 0;
  /** @type {Element[]} */
  const videos = [];
  if (isVideoElement(/** @type {Element} */ (root))) videos.push(/** @type {Element} */ (root));
  if (typeof root.querySelectorAll === 'function') {
    videos.push(...root.querySelectorAll('video'));
  }
  for (const video of videos) stampVideoElementState(video);
  return videos.length;
}

/** Remove stamped play/pause state (host disabled / teardown). */
export function clearVideoPlaybackState(root = document) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const nodes = isVideoElement(/** @type {Element} */ (root))
    ? [/** @type {Element} */ (root)]
    : root.querySelectorAll(`video[${VIDEO_STATE_ATTR}]`);
  nodes.forEach((el) => el.removeAttribute(VIDEO_STATE_ATTR));
}

/** @type {((event: Event) => void) | null} */
let onMediaEvent = null;

function ensureListener() {
  if (onMediaEvent) return;
  onMediaEvent = (event) => {
    const t = event.target;
    if (isVideoElement(/** @type {Element} */ (t))) stampVideoElementState(/** @type {Element} */ (t));
  };
  // Capture so play/pause inside open shadow trees still reach us when the
  // event retargets to the host; stamping still runs on the real video.
  document.addEventListener('play', onMediaEvent, true);
  document.addEventListener('playing', onMediaEvent, true);
  document.addEventListener('pause', onMediaEvent, true);
  document.addEventListener('ended', onMediaEvent, true);
  document.addEventListener('emptied', onMediaEvent, true);
}

/** Start listening + stamp the current document (and optional subtree). */
export function syncVideoPlaybackState(root = document) {
  ensureListener();
  return stampVideoPlaybackState(root);
}

export function stopVideoPlaybackState() {
  if (!onMediaEvent) return;
  document.removeEventListener('play', onMediaEvent, true);
  document.removeEventListener('playing', onMediaEvent, true);
  document.removeEventListener('pause', onMediaEvent, true);
  document.removeEventListener('ended', onMediaEvent, true);
  document.removeEventListener('emptied', onMediaEvent, true);
  onMediaEvent = null;
  clearVideoPlaybackState(document);
}
