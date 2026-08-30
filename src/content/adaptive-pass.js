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
import { stampLogoAlpha } from './logo-alpha.js';
import {
  shouldTagBackgroundImages,
  tagBackgroundImageElements,
  removeBackgroundImageOverlays,
} from './background-image-tagger.js';
import { removeStyle } from './style-injector.js';
import { collectOpenShadowRoots } from './open-trees.js';
import {
  syncVideoPlaybackState,
  stopVideoPlaybackState,
} from './video-playback-state.js';

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
  removeBackgroundImageOverlays();
  const classification = classifyPage();
  stampLogoAlpha();
  syncVideoPlaybackState(document);
  // Classification marks ads before the sample walk so identity scoring can
  // reject sponsor/creative colors that are unrelated to the site's brand.
  const sample = samplePageRoles();

  const colorOn = resolved?.sections?.color !== false;
  const bgCategory = resolved?.imageFilter?.categories?.bgImages;
  const filterOverlays =
    !!resolved?.imageFilter?.enabled &&
    (bgCategory
      ? bgCategory !== 'none'
      : resolved.imageFilter.scope !== 'images');
  if (shouldTagBackgroundImages(resolved.imageFilter, resolved.mediaStyles, { colorOn })) {
    const tagOpts = { createOverlays: filterOverlays };
    tagBackgroundImageElements(document.body, tagOpts);
    for (const shadow of collectOpenShadowRoots(document.documentElement)) {
      tagBackgroundImageElements(shadow, tagOpts);
    }
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
function runNativeSubtreePass(root, resolved) {
  const classification = classifySubtree(root, { skipClassified: true });
  stampLogoAlpha(root);
  syncVideoPlaybackState(root);
  const colorOn = resolved?.sections?.color !== false;
  const bgCategory = resolved?.imageFilter?.categories?.bgImages;
  const filterOverlays =
    !!resolved?.imageFilter?.enabled &&
    (bgCategory
      ? bgCategory !== 'none'
      : resolved.imageFilter.scope !== 'images');
  if (shouldTagBackgroundImages(resolved.imageFilter, resolved.mediaStyles, { colorOn })) {
    const tagOpts = { createOverlays: filterOverlays };
    tagBackgroundImageElements(root, tagOpts);
    for (const shadow of collectOpenShadowRoots(root)) {
      tagBackgroundImageElements(shadow, tagOpts);
    }
  }
  return classification;
}

export function runAdaptiveSubtreePass(root, resolved) {
  return runNativeSubtreePass(root, resolved);
}

/**
 * Incremental mutation work. Do not suspend the theme stylesheet here —
 * removing it on a busy page (Windows Central, Gmail) restyles the whole
 * document on every batch and stalls Settings/walkthrough.
 */
export function runAdaptiveSubtreePasses(roots, resolved) {
  return (roots || []).map((root) => runNativeSubtreePass(root, resolved));
}

/** Tear down adaptive DOM annotations when gMixer is disabled for the host. */
export function clearAdaptivePass() {
  removeBackgroundImageOverlays();
  stopVideoPlaybackState();
  // Link shimmer is owned by content-end (stopLinkShimmer) so we do not import
  // it here and create a cycle with style-injector consumers.
}
