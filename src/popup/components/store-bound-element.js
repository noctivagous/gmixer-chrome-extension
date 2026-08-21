import { LitElement } from 'lit';
import { store } from '../../state/store.js';

/**
 * Base class for panels that read/write the shared settings store.
 * Subclasses get `this.state` (the full store state, reactive) and call
 * `this.updateGlobal(patch)` to write. Centralizing subscribe/unsubscribe
 * here is the whole point of a binding layer — panels never import
 * storage-adapter.js or chrome.storage themselves.
 */
export class StoreBoundElement extends LitElement {
  static properties = {
    state: { state: true },
  };

  connectedCallback() {
    super.connectedCallback();
    this.state = store.getState();
    this._unsubscribe = store.subscribe((next) => {
      this.state = next;
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unsubscribe?.();
  }

  updateGlobal(patch) {
    store.update(patch);
  }
}
