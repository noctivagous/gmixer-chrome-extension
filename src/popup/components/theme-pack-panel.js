import { html, css } from 'lit';
import { StoreBoundElement } from './store-bound-element.js';
import { defineElement } from '../../lib/define-element.js';
import './color-panel.js';

/**
 * @deprecated Tone lives in gmixer-color-panel. Kept as a thin tone-only
 * alias for older imports / debug callers.
 */
export class ThemePackPanel extends StoreBoundElement {
  static styles = css`
    :host {
      display: block;
    }
  `;

  render() {
    return html`<gmixer-color-panel tone-only></gmixer-color-panel>`;
  }
}

defineElement('gmixer-theme-pack-panel', ThemePackPanel);
