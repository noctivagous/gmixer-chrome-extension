import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  drainEarlyMessageQueue,
  installEarlyMessageQueue,
} from '../src/messaging/early-message-queue.js';
import {
  MSG_OPEN_SETTINGS,
  MSG_OPEN_WALKTHROUGH,
  MSG_TOGGLE_SETTINGS,
  MSG_TOGGLE_SITE,
} from '../src/messaging/messages.js';

const QUEUE_KEY = '__gmixerPendingRuntimeMessages';
const READY_KEY = '__gmixerSettingsHostReady';

afterEach(() => {
  delete globalThis[QUEUE_KEY];
  delete globalThis[READY_KEY];
  delete globalThis.chrome;
});

describe('early-message-queue', () => {
  it('queues open-settings and walkthrough as well as toggles', () => {
    /** @type {((message: { type: string }) => void) | null} */
    let listener = null;
    globalThis.chrome = {
      runtime: {
        onMessage: {
          addListener(fn) {
            listener = fn;
          },
        },
      },
    };

    installEarlyMessageQueue();
    listener?.({ type: MSG_OPEN_SETTINGS });
    listener?.({ type: MSG_OPEN_WALKTHROUGH });
    listener?.({ type: MSG_TOGGLE_SETTINGS });
    listener?.({ type: MSG_TOGGLE_SITE });
    listener?.({ type: 'UNRELATED' });

    assert.deepEqual(drainEarlyMessageQueue(), [
      MSG_OPEN_SETTINGS,
      MSG_OPEN_WALKTHROUGH,
      MSG_TOGGLE_SETTINGS,
      MSG_TOGGLE_SITE,
    ]);
  });
});
