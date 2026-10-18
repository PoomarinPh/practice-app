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
 * @property {'split'|'side-by-side'|'separated'} [viewMode='split'] - Initial display mode.
 * @property {boolean} [isGrayscale=false] - Whether grayscale tonal aid is enabled.
 * @property {HTMLElement|null} [targetContainer=null] - Dedicated mount element for target swatch.
 * @property {HTMLElement|null} [guessContainer=null] - Dedicated mount element for guess swatch.
 */

export class SwatchViewer {
  /**
   * @param {HTMLElement|null} container - Parent element to attach swatches, or null if using separate containers.
   * @param {SwatchViewerOptions} [options={}] - Configuration options.
   */
  constructor(container, options = {}) {
    this.container = container;
    this.targetContainer = options.targetContainer || null;
    this.guessContainer = options.guessContainer || null;

    this.target = options.target || { h: 0, s: 1, v: 1, hex: '#ff0000' };
    this.guess = options.guess || { h: 0, s: 1, v: 1, hex: '#ff0000' };
    this.viewMode = options.viewMode || (this.targetContainer && this.guessContainer ? 'separated' : 'split');
    this.isGrayscale = Boolean(options.isGrayscale);

    this.wrapperEl = null;
    this.targetWrapperEl = null;
    this.guessWrapperEl = null;
    this.targetEl = null;
    this.guessEl = null;

    this.render();
  }

  /**
   * Initializes and renders the DOM elements.
   */
  render() {
    if (this.targetContainer && this.guessContainer) {
      // Screen-separated mode: Reference on top, Guess on bottom
      this.targetContainer.innerHTML = '';
      this.guessContainer.innerHTML = '';

      this.targetWrapperEl = document.createElement('div');
      this.targetWrapperEl.className = `swatch-viewer mode-separated swatch-single-target${this.isGrayscale ? ' tonal-grayscale' : ''}`;

      this.targetEl = document.createElement('div');
      this.targetEl.className = 'swatch-card swatch-target';
      this.targetEl.innerHTML = '<span class="swatch-label">Reference</span>';
      this.targetWrapperEl.appendChild(this.targetEl);
      this.targetContainer.appendChild(this.targetWrapperEl);

      this.guessWrapperEl = document.createElement('div');
      this.guessWrapperEl.className = `swatch-viewer mode-separated swatch-single-guess${this.isGrayscale ? ' tonal-grayscale' : ''}`;

      this.guessEl = document.createElement('div');
      this.guessEl.className = 'swatch-card swatch-guess';
      this.guessEl.innerHTML = '<span class="swatch-label">Your Match</span>';
      this.guessWrapperEl.appendChild(this.guessEl);
      this.guessContainer.appendChild(this.guessWrapperEl);
    } else if (this.container) {
      // Single container mode: Both swatches together
      this.container.innerHTML = '';

      this.wrapperEl = document.createElement('div');
      this.wrapperEl.className = `swatch-viewer mode-${this.viewMode}${this.isGrayscale ? ' tonal-grayscale' : ''}`;

      this.targetEl = document.createElement('div');
      this.targetEl.className = 'swatch-card swatch-target';
      this.targetEl.innerHTML = '<span class="swatch-label">Reference</span>';

      this.guessEl = document.createElement('div');
      this.guessEl.className = 'swatch-card swatch-guess';
      this.guessEl.innerHTML = '<span class="swatch-label">Your Match</span>';

      this.wrapperEl.appendChild(this.targetEl);
      this.wrapperEl.appendChild(this.guessEl);
      this.container.appendChild(this.wrapperEl);
    }

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
    const wrappers = [this.wrapperEl, this.targetWrapperEl, this.guessWrapperEl].filter(Boolean);
    for (const wrapper of wrappers) {
      if (this.isGrayscale) {
        wrapper.classList.add('tonal-grayscale');
      } else {
        wrapper.classList.remove('tonal-grayscale');
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
