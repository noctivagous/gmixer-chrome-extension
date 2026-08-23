// Adaptive pass — document_end (+ MutationObserver) only.
//
// BOUNDARY (enforced):
// - content-start.js / static pass: cache read + buildCss(resolved, null).
//   No DOM sampling, no classification, no tonal layers, no background tagging.
// - This module: expensive live-DOM work that needs a parsed tree.
//
// Call sites: content-end.js (full pass) and mutation-observer consumers
// (subtree reclassification when the page grows).

import { samplePageRoles } from './page-sampler.js';
import { classifyPage, classifySubtree } from './page-classifier.js';
import {
  shouldTagBackgroundImages,
  tagBackgroundImageElements,
  removeBackgroundImageOverlays,
} from './background-image-tagger.js';
import {
  removeTonalSurfaceLayers,
} from './tonal-surface-layer.js';
import { removeStyle } from './style-injector.js';

/**
 * @typedef {object} AdaptivePassResult
 * @property {ReturnType<typeof samplePageRoles>|null} sample
 * @property {{ stamped: number, scanned: number }} classification
 */

/**
 * Full adaptive pass for document_end / settings reapply.
 * Samples roles, classifies structure/media, and tags background images.
 *
 * @param {object} resolved  resolved global settings for this host
 * @returns {AdaptivePassResult}
 */
export function runAdaptivePass(resolved) {
  // The static pass may already have painted the roots. Remove that temporary
  // stylesheet (and any overlays) while sampling so intensity is based on the
  // site's own colors, not on gMixer's previous pass. This is synchronous, so
  // no paint occurs between removal and the caller's replacement stylesheet.
  removeStyle();
  removeTonalSurfaceLayers();
  removeBackgroundImageOverlays();
  const classification = classifyPage();
  // Classification marks ads before the sample walk so identity scoring can
  // reject sponsor/creative colors that are unrelated to the site's brand.
  const sample = samplePageRoles();

  if (shouldTagBackgroundImages(resolved.imageFilter, resolved.mediaStyles)) {
    tagBackgroundImageElements();
  }

  return { sample, classification };
}

/**
 * Re-run adaptive classification on a newly added subtree (MutationObserver).
 * Skips full-page color resampling — that stays on full reapply / first end.
 *
 * @param {ParentNode|Element} root
 * @param {object} resolved
 * @returns {{ stamped: number, scanned: number }}
 */
export function runAdaptiveSubtreePass(root, resolved) {
  const classification = classifySubtree(root);

  if (shouldTagBackgroundImages(resolved.imageFilter, resolved.mediaStyles)) {
    tagBackgroundImageElements(root);
  }

  return classification;
}

/** Tear down adaptive DOM annotations when gMixer is disabled for the host. */
export function clearAdaptivePass() {
  removeTonalSurfaceLayers();
  removeBackgroundImageOverlays();
}
