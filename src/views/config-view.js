/**
 * @fileoverview ConfigView (Screen 2: Configuration Landing).
 * Displays round configuration, question count chips, mode stats with average speed,
 * and a live interactive preview canvas.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

import { ColorWheel } from '../components/color-wheel.js';
import { getAccuracyStats } from '../utils/storage.js';

/**
 * @typedef {Object} ConfigViewOptions
 * @property {string} [exerciseId='color-matching'] - Exercise ID.
 * @property {Function} [onBack] - Callback when back button is tapped.
 * @property {Function} [onStart] - Callback when start button is tapped: (config) => void.
 */

export class ConfigView {
  /**
   * @param {HTMLElement} container - DOM container.
   * @param {ConfigViewOptions} [options={}] - Options.
   */
  constructor(container, options = {}) {
    this.container = container;
    this.exerciseId = options.exerciseId || 'color-matching';
    this.onBack = options.onBack || null;
    this.onStart = options.onStart || null;

    this.selectedCount = 5;
    this.selectedMode = 'HSV';
    this.previewWheel = null;

    this.render();
  }

  /**
   * Returns current selected question count.
   * @returns {number}
   */
  getSelectedCount() {
    return this.selectedCount;
  }

  /**
   * Renders the configuration view into the container.
   */
  render() {
    this.container.innerHTML = '';

    const allTimeStats = getAccuracyStats(null, this.selectedMode);
    const past7DaysStats = getAccuracyStats(7, this.selectedMode);

    const root = document.createElement('div');
    root.className = 'config-view-container';

    root.innerHTML = `
      <header class="config-header">
        <button id="config-back-btn" class="config-back-btn" type="button">
          ← Back to Hub
        </button>
        <div class="config-header-badge">Round Setup</div>
      </header>

      <div class="config-hero">
        <h1 class="config-title">Color Matching (HSV)</h1>
        <p class="config-subtitle">Recreate target swatches using the polar color wheel and vertical luminance bar.</p>
      </div>

      <!-- Mode Performance & Average Speed Card -->
      <section class="mode-performance-card">
        <div class="perf-card-header">
          <span class="perf-mode-badge">Active Mode: HSV</span>
          <span class="perf-status-badge">Tracked</span>
        </div>

        <div class="perf-metrics-grid">
          <div class="perf-metric-box">
            <span class="perf-box-label">All-Time Accuracy</span>
            <span class="perf-box-val highlight-acc">
              ${allTimeStats.totalGuesses > 0 ? `${allTimeStats.accuracyPercent}%` : '--'}
            </span>
            <span class="perf-box-sub">
              ${allTimeStats.correct} / ${allTimeStats.totalGuesses} Solved
            </span>
          </div>

          <div class="perf-metric-box">
            <span class="perf-box-label">Past 7 Days</span>
            <span class="perf-box-val">
              ${past7DaysStats.totalGuesses > 0 ? `${past7DaysStats.accuracyPercent}%` : '--'}
            </span>
            <span class="perf-box-sub">
              ${past7DaysStats.totalGuesses > 0 ? `${past7DaysStats.correct} / ${past7DaysStats.totalGuesses}` : 'No recent sessions'}
            </span>
          </div>

          <div class="perf-metric-box">
            <span class="perf-box-label">Avg Correct Speed</span>
            <span class="perf-box-val highlight-time">
              ${allTimeStats.averageCorrectTime > 0 ? `${allTimeStats.averageCorrectTime}s` : '--'}
            </span>
            <span class="perf-box-sub">Based on correct answers</span>
          </div>
        </div>
      </section>

      <!-- Question Count Selector -->
      <section class="config-section">
        <label class="config-section-label">Questions per Round</label>
        <div class="question-chips-row">
          ${[1, 5, 10, 15, 20]
            .map(
              (count) => `
            <button class="question-chip ${count === this.selectedCount ? 'active' : ''}" data-count="${count}" type="button">
              ${count}
            </button>
          `
            )
            .join('')}
        </div>
      </section>

      <!-- Color Mode Selector -->
      <section class="config-section">
        <label class="config-section-label">Control Mode</label>
        <div class="mode-pills-row">
          <button class="mode-pill active" type="button">HSV (Wheel + Value)</button>
          <button class="mode-pill locked" type="button" disabled>RGB Sliders (Locked)</button>
        </div>
      </section>

      <!-- Live Touch Sensitivity Preview -->
      <section class="config-section">
        <label class="config-section-label">Interactive Sensitivity Preview</label>
        <div class="config-preview-card">
          <div id="config-wheel-mount"></div>
        </div>
      </section>

      <!-- Primary Action CTA -->
      <button id="start-exercise-btn" class="start-exercise-cta" type="button">
        Start Exercise (${this.selectedCount} Questions) 🚀
      </button>
    `;

    this.container.appendChild(root);

    // Mount preview wheel
    const previewMount = root.querySelector('#config-wheel-mount');
    if (previewMount) {
      this.previewWheel = new ColorWheel(previewMount, {
        initialColor: { h: 210, s: 0.7, v: 0.8 },
      });
    }

    this.bindEvents(root);
  }

  /**
   * Binds interaction listeners.
   * @private
   * @param {HTMLElement} root - View root element.
   */
  bindEvents(root) {
    const backBtn = root.querySelector('#config-back-btn');
    backBtn?.addEventListener('click', () => {
      if (typeof this.onBack === 'function') {
        this.onBack();
      }
    });

    const chips = root.querySelectorAll('.question-chip');
    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        const count = parseInt(chip.getAttribute('data-count') || '5', 10);
        this.selectedCount = count;

        const startBtn = root.querySelector('#start-exercise-btn');
        if (startBtn) {
          startBtn.textContent = `Start Exercise (${this.selectedCount} Questions) 🚀`;
        }
      });
    });

    const startBtn = root.querySelector('#start-exercise-btn');
    startBtn?.addEventListener('click', () => {
      if (typeof this.onStart === 'function') {
        this.onStart({
          exerciseId: this.exerciseId,
          mode: this.selectedMode,
          questionCount: this.selectedCount,
        });
      }
    });
  }

  /**
   * Destroys view and subcomponents.
   */
  destroy() {
    if (this.previewWheel) {
      this.previewWheel.destroy();
      this.previewWheel = null;
    }
    this.container.innerHTML = '';
  }
}
