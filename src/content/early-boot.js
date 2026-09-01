// Tiny document_start entry. Parses in a few KB so the remembered canvas
// can paint before content-start.js (the full static-theme bundle) evaluates.
// Must not import store, style-injector, or anything that touches chrome.storage.
import { paintEarlyCanvas } from './early-canvas.js';

if (paintEarlyCanvas() && typeof __GMIXER_DEBUG__ !== 'undefined' && __GMIXER_DEBUG__) {
  console.info('[gmixer-timing]', 'gmixer:early-canvas', `${Math.round(performance.now())}ms`);
}
