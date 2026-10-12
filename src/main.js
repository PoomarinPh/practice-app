/**
 * @fileoverview ChromaSense Application Entry Point.
 * Coordinates ColorWheel, SwatchViewer, live elapsed timer, and post-submission ResultModal reveal.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

import './style.css';
import { ColorWheel } from './components/color-wheel.js';
import { SwatchViewer } from './components/swatch-viewer.js';
import { evaluateGuess, generateTargetColor } from './utils/scoring.js';
import { getAccuracyStats, recordGuess } from './utils/storage.js';
import { ResultModal } from './views/result-modal.js';

/**
 * Formats elapsed milliseconds into MM:SS.S display.
 * @param {number} ms - Milliseconds elapsed.
 * @returns {string} Formatted time string.
 */
function formatElapsed(ms) {
  const totalSeconds = ms / 1000;
  const mins = Math.floor(totalSeconds / 60);
  const secs = (totalSeconds % 60).toFixed(1);
  return `${mins.toString().padStart(2, '0')}:${secs.padStart(4, '0')}`;
}

/**
 * Initializes the ChromaSense interactive interface.
 */
function initApp() {
  const appContainer = document.querySelector('#app');
  if (!appContainer) {
    return;
  }

  // App Layout Skeleton
  appContainer.innerHTML = `
    <header class="app-header">
      <div class="brand-badge">
        <span class="brand-dot"></span>
        <span class="brand-title">ChromaSense</span>
      </div>
      <div id="elapsed-timer" class="timer-badge">
        ⏱ 00:00.0
      </div>
    </header>

    <main class="interactive-container">
      <!-- Performance & Average Speed Banner -->
      <section class="stats-banner-card">
        <div class="stat-pill">
          <span class="stat-pill-label">Mode</span>
          <span class="stat-pill-val">HSV</span>
        </div>
        <div class="stat-pill">
          <span class="stat-pill-label">Accuracy</span>
          <span id="stat-acc" class="stat-pill-val highlight-acc">--</span>
        </div>
        <div class="stat-pill">
          <span class="stat-pill-label">Avg Correct Time</span>
          <span id="stat-avg-time" class="stat-pill-val highlight-time">--</span>
        </div>
        <div class="stat-pill">
          <span class="stat-pill-label">Correct / Total</span>
          <span id="stat-ratio" class="stat-pill-val">0 / 0</span>
        </div>
      </section>

      <!-- 1. Swatch Viewer Card -->
      <section class="swatch-viewer-card">
        <div class="swatch-controls-bar">
          <button id="view-mode-toggle" class="swatch-tool-btn" type="button">
            <span>⇄</span> <span id="view-mode-text">Side-by-Side</span>
          </button>
          <button id="grayscale-toggle" class="swatch-tool-btn" type="button">
            <span>👁</span> <span id="grayscale-text">Tonal Check</span>
          </button>
        </div>
        <div id="swatch-mount"></div>
      </section>

      <!-- 2. Color Wheel & Vertical Value Slider Card -->
      <section class="controls-card">
        <div id="wheel-mount"></div>

        <!-- Micro-Adjustment Stepper Buttons -->
        <div class="stepper-row">
          <div class="stepper-group">
            <span class="stepper-label">H</span>
            <button id="h-minus" class="stepper-btn" type="button">-</button>
            <button id="h-plus" class="stepper-btn" type="button">+</button>
          </div>
          <div class="stepper-group">
            <span class="stepper-label">S</span>
            <button id="s-minus" class="stepper-btn" type="button">-</button>
            <button id="s-plus" class="stepper-btn" type="button">+</button>
          </div>
          <div class="stepper-group">
            <span class="stepper-label">V</span>
            <button id="v-minus" class="stepper-btn" type="button">-</button>
            <button id="v-plus" class="stepper-btn" type="button">+</button>
          </div>
        </div>
      </section>

      <!-- 3. Primary Submit Guess Button -->
      <div class="submit-btn-row">
        <button id="submit-guess-btn" class="submit-guess-btn" type="button">
          Submit Guess 🎯
        </button>
      </div>
    </main>

    <div id="modal-mount"></div>
  `;

  // Application State
  let targetColor = generateTargetColor();
  let guessColor = { h: 180, s: 0.5, v: 0.8 };
  let viewMode = 'split';
  let isGrayscale = false;

  // Timer State
  let startTime = Date.now();
  let timerInterval = null;

  const timerEl = document.querySelector('#elapsed-timer');

  /**
   * Starts or restarts the live elapsed timer.
   */
  function startTimer() {
    startTime = Date.now();
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    timerInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (timerEl) {
        timerEl.textContent = `⏱ ${formatElapsed(elapsed)}`;
      }
    }, 100);
  }

  /**
   * Stops the active timer.
   */
  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // Mount SwatchViewer Component
  const swatchMount = document.querySelector('#swatch-mount');
  const swatchViewer = new SwatchViewer(swatchMount, {
    target: targetColor,
    guess: guessColor,
    viewMode,
    isGrayscale,
  });

  // Mount ColorWheel Component
  const wheelMount = document.querySelector('#wheel-mount');
  const colorWheel = new ColorWheel(wheelMount, {
    initialColor: guessColor,
    onChange: (color) => {
      guessColor = color;
      swatchViewer.update({ guess: guessColor });
    },
  });

  // Mount ResultModal Component
  const modalMount = document.querySelector('#modal-mount');
  const resultModal = new ResultModal(modalMount, {
    onNext: () => {
      loadNextChallenge();
    },
  });

  /**
   * Refreshes the summary performance banner with current storage metrics.
   */
  function refreshStatsBanner() {
    const stats = getAccuracyStats(null, 'HSV');
    const accEl = document.querySelector('#stat-acc');
    const timeEl = document.querySelector('#stat-avg-time');
    const ratioEl = document.querySelector('#stat-ratio');

    if (accEl) {
      accEl.textContent = stats.totalGuesses > 0 ? `${stats.accuracyPercent}%` : '--';
    }
    if (timeEl) {
      timeEl.textContent = stats.averageCorrectTime > 0 ? `${stats.averageCorrectTime}s` : '--';
    }
    if (ratioEl) {
      ratioEl.textContent = `${stats.correct} / ${stats.totalGuesses}`;
    }
  }

  /**
   * Resets and loads a new target challenge.
   */
  function loadNextChallenge() {
    targetColor = generateTargetColor();
    guessColor = { h: 180, s: 0.5, v: 0.8 };
    colorWheel.setColor(guessColor);
    swatchViewer.update({
      target: targetColor,
      guess: guessColor,
    });
    startTimer();
  }

  // Handle Submit Guess
  const submitBtn = document.querySelector('#submit-guess-btn');
  submitBtn?.addEventListener('click', () => {
    stopTimer();
    const elapsedSeconds = Math.round(((Date.now() - startTime) / 1000) * 10) / 10;

    // 1. Evaluate user guess against target color
    const evaluation = evaluateGuess(targetColor, guessColor);

    // 2. Persist to defensive local storage (record time only when isCorrect)
    const guessPayload = {
      exerciseId: 'color-matching',
      mode: 'HSV',
      target: targetColor,
      guess: guessColor,
      score: evaluation.score,
      breakdown: evaluation.breakdown,
      isCorrect: evaluation.isCorrect,
    };

    if (evaluation.isCorrect) {
      guessPayload.timeSeconds = elapsedSeconds;
    }

    recordGuess(guessPayload);

    // 3. Update stats banner
    refreshStatsBanner();

    // 4. Reveal Result Modal Sheet (pass timeSeconds only when isCorrect)
    const modalPayload = {
      score: evaluation.score,
      isCorrect: evaluation.isCorrect,
      breakdown: evaluation.breakdown,
      target: targetColor,
      guess: guessColor,
    };

    if (evaluation.isCorrect) {
      modalPayload.timeSeconds = elapsedSeconds;
    }

    resultModal.show(modalPayload);
  });

  // Toggle View Mode (Split vs Side-by-Side)
  const viewModeBtn = document.querySelector('#view-mode-toggle');
  const viewModeText = document.querySelector('#view-mode-text');
  viewModeBtn?.addEventListener('click', () => {
    viewMode = viewMode === 'split' ? 'side-by-side' : 'split';
    swatchViewer.setViewMode(viewMode);
    if (viewModeText) {
      viewModeText.textContent = viewMode === 'split' ? 'Side-by-Side' : 'Split View';
    }
    viewModeBtn.classList.toggle('active', viewMode === 'side-by-side');
  });

  // Toggle Grayscale Tonal Check
  const grayscaleBtn = document.querySelector('#grayscale-toggle');
  grayscaleBtn?.addEventListener('click', () => {
    isGrayscale = !isGrayscale;
    swatchViewer.setGrayscale(isGrayscale);
    grayscaleBtn.classList.toggle('active', isGrayscale);
  });

  // Stepper Fine-tuning Buttons
  document.querySelector('#h-minus')?.addEventListener('click', () => colorWheel.stepHue(-1));
  document.querySelector('#h-plus')?.addEventListener('click', () => colorWheel.stepHue(1));
  document.querySelector('#s-minus')?.addEventListener('click', () => colorWheel.stepSaturation(-0.01));
  document.querySelector('#s-plus')?.addEventListener('click', () => colorWheel.stepSaturation(0.01));
  document.querySelector('#v-minus')?.addEventListener('click', () => colorWheel.stepValue(-0.01));
  document.querySelector('#v-plus')?.addEventListener('click', () => colorWheel.stepValue(0.01));

  // Initialize Timer and Stats
  refreshStatsBanner();
  startTimer();

  // Register Service Worker in production builds
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.error('ServiceWorker registration failed: ', err);
      });
    });
  }
}

document.addEventListener('DOMContentLoaded', initApp);
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initApp();
}
