/**
 * @fileoverview ResultModal / Feedback Sheet Component (Screen 3.5).
 * Reveals overall match percentage, accuracy tier, channel breakdowns,
 * and next question CTA after submission.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

import { getAccuracyTier } from '../utils/scoring.js';

/**
 * @typedef {Object} ResultModalOptions
 * @property {Function} [onNext] - Callback when user proceeds to next question.
 */

export class ResultModal {
  /**
   * @param {HTMLElement} container - DOM container to mount the modal/sheet into.
   * @param {ResultModalOptions} [options={}] - Options.
   */
  constructor(container, options = {}) {
    this.container = container;
    this.onNext = options.onNext || null;
    this.overlayEl = null;
    this.opened = false;
  }

  /**
   * Checks if the result sheet is currently visible.
   * @returns {boolean}
   */
  isOpen() {
    return this.opened;
  }

  /**
   * Reveals the result sheet with evaluated score metrics.
   * @param {Object} data - Evaluation data and colors.
   */
  show(data) {
    this.opened = true;
    const tier = getAccuracyTier(data.score);

    const targetHex = data.target?.hex || '#000000';
    const guessHex = data.guess?.hex || '#000000';

    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'result-sheet-overlay';

    this.overlayEl.innerHTML = `
      <div class="result-sheet-content">
        <div class="result-header">
          <div class="result-header-badges">
            <span class="result-tier-badge ${tier.badgeClass}">${tier.emoji} ${tier.title}</span>
            ${data.isCorrect && typeof data.timeSeconds === 'number' ? `<span class="result-time-badge">⏱ ${data.timeSeconds}s</span>` : ''}
          </div>
          <h2 class="result-score-title">
            <span class="result-score-val">${data.score.toFixed(1)}</span>
            <span class="result-score-symbol">% Match</span>
          </h2>
          <p class="result-subtitle">
            ${data.isCorrect ? '✨ Great observation! Correct guess and time recorded.' : 'Needs adjustment — compare channels below.'}
          </p>
        </div>

        <div class="result-swatches-row">
          <div class="result-swatch-box">
            <div class="result-swatch-preview" style="background-color: ${targetHex};"></div>
            <span class="result-swatch-name">Target</span>
            <span class="result-swatch-hex">${targetHex}</span>
          </div>
          <div class="result-swatch-vs">VS</div>
          <div class="result-swatch-box">
            <div class="result-swatch-preview" style="background-color: ${guessHex};"></div>
            <span class="result-swatch-name">Your Guess</span>
            <span class="result-swatch-hex">${guessHex}</span>
          </div>
        </div>

        <div class="result-breakdown-list">
          <div class="result-breakdown-item">
            <div class="breakdown-info">
              <span class="breakdown-label">Value (Luminance)</span>
              <span class="breakdown-val">${data.breakdown.value}%</span>
            </div>
            <div class="breakdown-bar-track">
              <div class="breakdown-bar-fill val-fill" style="width: ${data.breakdown.value}%;"></div>
            </div>
          </div>

          <div class="result-breakdown-item">
            <div class="breakdown-info">
              <span class="breakdown-label">Hue</span>
              <span class="breakdown-val">${data.breakdown.hue}%</span>
            </div>
            <div class="breakdown-bar-track">
              <div class="breakdown-bar-fill hue-fill" style="width: ${data.breakdown.hue}%;"></div>
            </div>
          </div>

          <div class="result-breakdown-item">
            <div class="breakdown-info">
              <span class="breakdown-label">Saturation</span>
              <span class="breakdown-val">${data.breakdown.saturation}%</span>
            </div>
            <div class="breakdown-bar-track">
              <div class="breakdown-bar-fill sat-fill" style="width: ${data.breakdown.saturation}%;"></div>
            </div>
          </div>
        </div>

        <button id="result-next-btn" class="result-next-cta" type="button">
          Next Color →
        </button>
      </div>
    `;

    this.container.appendChild(this.overlayEl);

    // Bind next question action
    const nextBtn = this.overlayEl.querySelector('#result-next-btn');
    nextBtn?.addEventListener('click', () => {
      this.close();
      if (typeof this.onNext === 'function') {
        this.onNext();
      }
    });
  }

  /**
   * Closes and removes the modal sheet.
   */
  close() {
    this.opened = false;
    if (this.overlayEl && this.overlayEl.parentNode) {
      this.overlayEl.parentNode.removeChild(this.overlayEl);
      this.overlayEl = null;
    }
  }
}
