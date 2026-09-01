import { ensureDocumentFontFaces } from '../lib/font-faces.js';
import { notifyHostLayout } from '../settings/close-host-popover.js';
import '../settings/components/gmixer-walkthrough.js';

ensureDocumentFontFaces();

window.addEventListener('message', (event) => {
  if (event.data?.source !== 'gmixer-host') return;
  const el = document.querySelector('gmixer-walkthrough');
  if (!el) return;
  if (event.data.type === 'reset') {
    el.currentSlide = 0;
    el.showCompletion = false;
    notifyHostLayout('panel');
  }
});
