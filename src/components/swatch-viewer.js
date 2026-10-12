/**
 * @fileoverview SwatchViewer component.
 * Renders target and guess color swatches in Split contact-seam or Side-by-side layout,
 * with accurate ITU-R BT.709 relative luminance grayscale toggle for tonal evaluation.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

import { hexToRgb, hsvToHex, hsvToRgb, relativeLuminance } from '../utils/color.js';

/**
 * @typedef {Object} SwatchViewerOptions
 * @property {Object} [target] - Initial target color { h, s, v, hex }.
 * @property {Object} [guess] - Initial guess color { h, s, v, hex }.
 * @property {'split'|'side-by-side'} [viewMode='split'] - Initial display mode.
 * @property {boolean} [isGrayscale=false] - Whether grayscale tonal aid is enabled.
 */

export class SwatchViewer {
  /**
   * @param {HTMLElement} container - Parent element to attach swatches.
   * @param {SwatchViewerOptions} [options={}] - Configuration options.
   */
  constructor(container, options = {}) {
    this.container = container;
    this.target = options.target || { h: 0, s: 1, v: 1, hex: '#ff0000' };
    this.guess = options.guess || { h: 0, s: 1, v: 1, hex: '#ff0000' };
    this.viewMode = options.viewMode || 'split';
    this.isGrayscale = Boolean(options.isGrayscale);

    this.wrapperEl = null;
    this.targetEl = null;
    this.guessEl = null;

    this.render();
  }

  /**
   * Initializes and renders the DOM elements.
   */
  render() {
    this.container.innerHTML = '';

    this.wrapperEl = document.createElement('div');
    this.wrapperEl.className = `swatch-viewer mode-${this.viewMode}${this.isGrayscale ? ' tonal-grayscale' : ''}`;

    this.targetEl = document.createElement('div');
    this.targetEl.className = 'swatch-card swatch-target';
    this.targetEl.innerHTML = '<span class="swatch-label">Target</span>';

    this.guessEl = document.createElement('div');
    this.guessEl.className = 'swatch-card swatch-guess';
    this.guessEl.innerHTML = '<span class="swatch-label">Your Match</span>';

    this.wrapperEl.appendChild(this.targetEl);
    this.wrapperEl.appendChild(this.guessEl);
    this.container.appendChild(this.wrapperEl);

    this.applyColors();
  }

  /**
   * Computes display colors for target and guess, applying grayscale if active.
   * @private
   */
  applyColors() {
    if (!this.targetEl || !this.guessEl) {
      return;
    }

    const targetColor = this.getDisplayColor(this.target);
    const guessColor = this.getDisplayColor(this.guess);

    this.targetEl.style.backgroundColor = targetColor;
    this.guessEl.style.backgroundColor = guessColor;
  }

  /**
   * Resolves effective CSS color string taking grayscale luminance into account.
   * @private
   * @param {Object} colorObj - Color with hex or HSV properties.
   * @returns {string} CSS color string.
   */
  getDisplayColor(colorObj) {
    const rgb = colorObj.rgb || (colorObj.hex ? hexToRgb(colorObj.hex) : hsvToRgb(colorObj));

    if (this.isGrayscale) {
      const lum = relativeLuminance(rgb);
      const gray = Math.round(lum * 255);
      return `rgb(${gray}, ${gray}, ${gray})`;
    }

    return colorObj.hex || hsvToHex(colorObj);
  }

  /**
   * Updates swatches with new state data.
   * @param {Partial<SwatchViewerOptions>} updates - Updated properties.
   */
  update(updates = {}) {
    if (updates.target !== undefined) {
      this.target = updates.target;
    }
    if (updates.guess !== undefined) {
      this.guess = updates.guess;
    }
    if (updates.viewMode !== undefined) {
      this.setViewMode(updates.viewMode);
    }
    if (updates.isGrayscale !== undefined) {
      this.setGrayscale(updates.isGrayscale);
    }
    this.applyColors();
  }

  /**
   * Toggles or sets layout mode ('split' or 'side-by-side').
   * @param {'split'|'side-by-side'} mode - Desired mode.
   */
  setViewMode(mode) {
    this.viewMode = mode;
    if (this.wrapperEl) {
      this.wrapperEl.classList.remove('mode-split', 'mode-side-by-side');
      this.wrapperEl.classList.add(`mode-${mode}`);
    }
  }

  /**
   * Returns current layout mode.
   * @returns {'split'|'side-by-side'}
   */
  getViewMode() {
    return this.viewMode;
  }

  /**
   * Toggles or sets grayscale tonal inspection aid.
   * @param {boolean} active - Grayscale state.
   */
  setGrayscale(active) {
    this.isGrayscale = Boolean(active);
    if (this.wrapperEl) {
      if (this.isGrayscale) {
        this.wrapperEl.classList.add('tonal-grayscale');
      } else {
        this.wrapperEl.classList.remove('tonal-grayscale');
      }
    }
    this.applyColors();
  }

  /**
   * Returns whether grayscale tonal aid is currently active.
   * @returns {boolean}
   */
  isGrayscaleActive() {
    return this.isGrayscale;
  }

  /**
   * Returns current component state.
   * @returns {{ target: Object, guess: Object, viewMode: string, isGrayscale: boolean }}
   */
  getState() {
    return {
      target: this.target,
      guess: this.guess,
      viewMode: this.viewMode,
      isGrayscale: this.isGrayscale,
    };
  }
}
