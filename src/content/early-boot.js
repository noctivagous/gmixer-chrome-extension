// Tiny document_start entry. Parses in a few KB so the remembered canvas
// can paint before content-start.js (the full static-theme bundle) evaluates.
// Must not import store or style-injector. chrome.storage.session is used only
// to upgrade the uncached first-load guess to the last-known tone ladder.
import {
  hydrateGlobalToneCanvas,
  paintEarlyCanvas,
  paintProvisionalCanvas,
  readEarlyCanvas,
} from './early-canvas.js';
import { toneCanvas } from '../lib/tone-canvas.js';

const cached = paintEarlyCanvas();
const provisional = cached ? false : paintProvisionalCanvas(toneCanvas('dark'));
if (!cached) {
  hydrateGlobalToneCanvas((canvas) => {
    if (readEarlyCanvas()) return;
    if (typeof document !== 'undefined' && document.getElementById('gmixer-style')) return;
    paintProvisionalCanvas(canvas);
  });
}
if (typeof __GMIXER_DEBUG__ !== 'undefined' && __GMIXER_DEBUG__) {
  if (cached) console.info('[gmixer-timing]', 'gmixer:early-canvas', `${Math.round(performance.now())}ms`);
  else if (provisional) console.info('[gmixer-timing]', 'gmixer:provisional-canvas', `${Math.round(performance.now())}ms`);
}
