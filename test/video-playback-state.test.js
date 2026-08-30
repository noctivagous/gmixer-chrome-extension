import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  VIDEO_STATE_ATTR,
  stampVideoElementState,
  stampVideoPlaybackState,
  clearVideoPlaybackState,
  videoPlaybackState,
} from '../src/content/video-playback-state.js';

function videoEl(paused = true) {
  const attributes = {};
  return {
    nodeType: 1,
    tagName: 'VIDEO',
    paused,
    getAttribute(name) {
      return attributes[name] ?? null;
    },
    setAttribute(name, value) {
      attributes[name] = String(value);
    },
    removeAttribute(name) {
      delete attributes[name];
    },
    hasAttribute(name) {
      return name in attributes;
    },
  };
}

describe('video playback state', () => {
  it('maps paused flag to state tokens', () => {
    assert.equal(videoPlaybackState({ paused: true }), 'paused');
    assert.equal(videoPlaybackState({ paused: false }), 'playing');
  });

  it('stamps paused and playing on video elements', () => {
    const paused = videoEl(true);
    const playing = videoEl(false);
    stampVideoElementState(/** @type {any} */ (paused));
    stampVideoElementState(/** @type {any} */ (playing));
    assert.equal(paused.getAttribute(VIDEO_STATE_ATTR), 'paused');
    assert.equal(playing.getAttribute(VIDEO_STATE_ATTR), 'playing');
  });

  it('stampVideoPlaybackState walks querySelectorAll("video")', () => {
    const paused = videoEl(true);
    const playing = videoEl(false);
    const root = {
      querySelectorAll(selector) {
        assert.equal(selector, 'video');
        return [paused, playing];
      },
    };
    assert.equal(stampVideoPlaybackState(/** @type {any} */ (root)), 2);
    assert.equal(paused.getAttribute(VIDEO_STATE_ATTR), 'paused');
    assert.equal(playing.getAttribute(VIDEO_STATE_ATTR), 'playing');
  });

  it('clearVideoPlaybackState removes the attribute', () => {
    const video = videoEl(true);
    video.setAttribute(VIDEO_STATE_ATTR, 'paused');
    const root = {
      querySelectorAll(selector) {
        assert.equal(selector, `video[${VIDEO_STATE_ATTR}]`);
        return [video];
      },
    };
    clearVideoPlaybackState(/** @type {any} */ (root));
    assert.equal(video.hasAttribute(VIDEO_STATE_ATTR), false);
  });
});
