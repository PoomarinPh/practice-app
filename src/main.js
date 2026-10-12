/**
 * @fileoverview ChromaSense Application Entry Point & View Coordinator.
 * Coordinates views across Hub (Screen 1), Config (Screen 2), Game Drill (Screen 3),
 * Session Summary (Screen 4), and History & Statistics (Screen 5) using AppRouter.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

import './style.css';
import { ColorWheel } from './components/color-wheel.js';
import { SwatchViewer } from './components/swatch-viewer.js';
import { evaluateGuess, generateTargetColor } from './utils/scoring.js';
import { getAccuracyStats, recordGuess, recordSession } from './utils/storage.js';
import { AppRouter } from './utils/router.js';
import { ConfigView } from './views/config-view.js';
import { HistoryView } from './views/history-view.js';
import { ResultModal } from './views/result-modal.js';
import { SelectorView } from './views/selector-view.js';
import { SummaryView } from './views/summary-view.js';

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
 * Active game drill session controller.
 */
class ActiveGameController {
  /**
   * @param {HTMLElement} container - DOM mount container.
   * @param {Object} config - Game configuration { exerciseId, mode, questionCount }.
   * @param {Object|Function} callbacks - Callbacks { onExit, onFinish } or exit function.
   */
  constructor(container, config, callbacks) {
    this.container = container;
    this.config = config || {};

    if (typeof callbacks === 'function') {
      this.onExit = callbacks;
      this.onFinish = null;
    } else {
      this.onExit = callbacks?.onExit || null;
      this.onFinish = callbacks?.onFinish || null;
    }

    this.currentQuestion = 1;
    this.totalQuestions = this.config.questionCount || 5;
    this.targetColor = generateTargetColor();
    this.guessColor = { h: 180, s: 0.5, v: 0.8 };
    this.viewMode = 'split';
    this.isGrayscale = false;

    /**
     * @type {Array<Object>}
     */
    this.sessionQuestions = [];

    this.startTime = Date.now();
    this.timerInterval = null;

    this.colorWheel = null;
    this.swatchViewer = null;
    this.resultModal = null;

    this.render();
  }

  /**
   * Renders the active game interface.
   */
  render() {
    this.container.innerHTML = `
      <header class="app-header">
        <button id="game-exit-btn" class="game-exit-btn" type="button">
          ← Exit
        </button>
        <div class="brand-badge">
          <span class="brand-dot"></span>
          <span class="brand-title">ChromaSense</span>
        </div>
        <div id="elapsed-timer" class="timer-badge">
          ⏱ 00:00.0
        </div>
      </header>

      <main class="interactive-container">
        <!-- Performance & Round Banner -->
        <section class="stats-banner-card">
          <div class="stat-pill">
            <span class="stat-pill-label">Progress</span>
            <span id="stat-progress" class="stat-pill-val">Q ${this.currentQuestion} / ${this.totalQuestions}</span>
          </div>
          <div class="stat-pill">
            <span class="stat-pill-label">Mode Acc</span>
            <span id="stat-acc" class="stat-pill-val highlight-acc">--</span>
          </div>
          <div class="stat-pill">
            <span class="stat-pill-label">Avg Speed</span>
            <span id="stat-avg-time" class="stat-pill-val highlight-time">--</span>
          </div>
          <div class="stat-pill">
            <span class="stat-pill-label">Solved</span>
            <span id="stat-ratio" class="stat-pill-val">0 / 0</span>
          </div>
        </section>

        <!-- Swatch Viewer Card -->
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

        <!-- Color Wheel & Vertical Value Slider Card -->
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

        <!-- Primary Submit Guess CTA -->
        <div class="submit-btn-row">
          <button id="submit-guess-btn" class="submit-guess-btn" type="button">
            Submit Guess 🎯
          </button>
        </div>
      </main>

      <div id="modal-mount"></div>
    `;

    this.timerEl = this.container.querySelector('#elapsed-timer');

    // Mount SwatchViewer Component
    const swatchMount = this.container.querySelector('#swatch-mount');
    this.swatchViewer = new SwatchViewer(swatchMount, {
      target: this.targetColor,
      guess: this.guessColor,
      viewMode: this.viewMode,
      isGrayscale: this.isGrayscale,
    });

    // Mount ColorWheel Component
    const wheelMount = this.container.querySelector('#wheel-mount');
    this.colorWheel = new ColorWheel(wheelMount, {
      initialColor: this.guessColor,
      onChange: (color) => {
        this.guessColor = color;
        this.swatchViewer.update({ guess: this.guessColor });
      },
    });

    // Mount ResultModal Component
    const modalMount = this.container.querySelector('#modal-mount');
    this.resultModal = new ResultModal(modalMount, {
      onNext: () => {
        if (this.currentQuestion >= this.totalQuestions) {
          const sessionPayload = {
            exerciseId: this.config.exerciseId || 'color-matching',
            mode: this.config.mode || 'HSV',
            totalQuestions: this.totalQuestions,
            questions: [...this.sessionQuestions],
          };

          recordSession(sessionPayload);
          this.destroy();

          if (typeof this.onFinish === 'function') {
            this.onFinish(sessionPayload);
          }
        } else {
          this.loadNextQuestion();
        }
      },
    });

    this.bindEvents();
    this.refreshStatsBanner();
    this.startTimer();
  }

  /**
   * Binds interaction event listeners.
   */
  bindEvents() {
    // Exit button
    const exitBtn = this.container.querySelector('#game-exit-btn');
    exitBtn?.addEventListener('click', () => {
      this.destroy();
      if (typeof this.onExit === 'function') {
        this.onExit();
      }
    });

    // Submit button
    const submitBtn = this.container.querySelector('#submit-guess-btn');
    submitBtn?.addEventListener('click', () => {
      this.stopTimer();
      const elapsedSeconds = Math.round(((Date.now() - this.startTime) / 1000) * 10) / 10;

      const evaluation = evaluateGuess(this.targetColor, this.guessColor);
      const isLastQuestion = this.currentQuestion >= this.totalQuestions;

      const guessPayload = {
        exerciseId: this.config.exerciseId || 'color-matching',
        mode: this.config.mode || 'HSV',
        target: this.targetColor,
        guess: this.guessColor,
        score: evaluation.score,
        breakdown: evaluation.breakdown,
        isCorrect: evaluation.isCorrect,
      };

      if (evaluation.isCorrect) {
        guessPayload.timeSeconds = elapsedSeconds;
      }

      // Persist individual guess to storage engine
      recordGuess(guessPayload);

      // Record question to session history for Session Summary
      this.sessionQuestions.push({
        questionNumber: this.currentQuestion,
        target: this.targetColor,
        guess: this.guessColor,
        score: evaluation.score,
        isCorrect: evaluation.isCorrect,
        timeSeconds: evaluation.isCorrect ? elapsedSeconds : null,
        breakdown: evaluation.breakdown,
      });

      this.refreshStatsBanner();

      const modalPayload = {
        score: evaluation.score,
        isCorrect: evaluation.isCorrect,
        breakdown: evaluation.breakdown,
        target: this.targetColor,
        guess: this.guessColor,
        isLastQuestion,
      };

      if (evaluation.isCorrect) {
        modalPayload.timeSeconds = elapsedSeconds;
      }

      this.resultModal.show(modalPayload);
    });

    // View mode toggle
    const viewModeBtn = this.container.querySelector('#view-mode-toggle');
    const viewModeText = this.container.querySelector('#view-mode-text');
    viewModeBtn?.addEventListener('click', () => {
      this.viewMode = this.viewMode === 'split' ? 'side-by-side' : 'split';
      this.swatchViewer.setViewMode(this.viewMode);
      if (viewModeText) {
        viewModeText.textContent = this.viewMode === 'split' ? 'Side-by-Side' : 'Split View';
      }
      viewModeBtn.classList.toggle('active', this.viewMode === 'side-by-side');
    });

    // Grayscale toggle
    const grayscaleBtn = this.container.querySelector('#grayscale-toggle');
    grayscaleBtn?.addEventListener('click', () => {
      this.isGrayscale = !this.isGrayscale;
      this.swatchViewer.setGrayscale(this.isGrayscale);
      grayscaleBtn.classList.toggle('active', this.isGrayscale);
    });

    // Steppers
    this.container.querySelector('#h-minus')?.addEventListener('click', () => this.colorWheel.stepHue(-1));
    this.container.querySelector('#h-plus')?.addEventListener('click', () => this.colorWheel.stepHue(1));
    this.container.querySelector('#s-minus')?.addEventListener('click', () => this.colorWheel.stepSaturation(-0.01));
    this.container.querySelector('#s-plus')?.addEventListener('click', () => this.colorWheel.stepSaturation(0.01));
    this.container.querySelector('#v-minus')?.addEventListener('click', () => this.colorWheel.stepValue(-0.01));
    this.container.querySelector('#v-plus')?.addEventListener('click', () => this.colorWheel.stepValue(0.01));
  }

  /**
   * Refreshes stats pills banner.
   */
  refreshStatsBanner() {
    const stats = getAccuracyStats(null, this.config.mode || 'HSV');
    const accEl = this.container.querySelector('#stat-acc');
    const timeEl = this.container.querySelector('#stat-avg-time');
    const ratioEl = this.container.querySelector('#stat-ratio');
    const progressEl = this.container.querySelector('#stat-progress');

    if (accEl) {
      accEl.textContent = stats.totalGuesses > 0 ? `${stats.accuracyPercent}%` : '--';
    }
    if (timeEl) {
      timeEl.textContent = stats.averageCorrectTime > 0 ? `${stats.averageCorrectTime}s` : '--';
    }
    if (ratioEl) {
      ratioEl.textContent = `${stats.correct} / ${stats.totalGuesses}`;
    }
    if (progressEl) {
      progressEl.textContent = `Q ${this.currentQuestion} / ${this.totalQuestions}`;
    }
  }

  /**
   * Advances to next target color challenge.
   */
  loadNextQuestion() {
    this.currentQuestion += 1;
    this.targetColor = generateTargetColor();
    this.guessColor = { h: 180, s: 0.5, v: 0.8 };
    this.colorWheel.setColor(this.guessColor);
    this.swatchViewer.update({
      target: this.targetColor,
      guess: this.guessColor,
    });
    this.refreshStatsBanner();
    this.startTimer();
  }

  /**
   * Starts live timer.
   */
  startTimer() {
    this.startTime = Date.now();
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.timerInterval = setInterval(() => {
      const elapsed = Date.now() - this.startTime;
      if (this.timerEl) {
        this.timerEl.textContent = `⏱ ${formatElapsed(elapsed)}`;
      }
    }, 100);
  }

  /**
   * Stops live timer.
   */
  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  /**
   * Tears down components and timers.
   */
  destroy() {
    this.stopTimer();
    if (this.colorWheel) {
      this.colorWheel.destroy();
      this.colorWheel = null;
    }
    this.container.innerHTML = '';
  }
}

/**
 * Initializes the ChromaSense application and view routing.
 * @param {HTMLElement} [mountTarget] - Optional mount DOM element.
 * @returns {{ router: AppRouter, destroy: Function }} App control instance.
 */
export function initApp(mountTarget) {
  const appContainer = mountTarget || document.querySelector('#app');
  if (!appContainer) {
    return { router: null, destroy: () => {} };
  }

  let activeController = null;

  /**
   * Tears down active view controller.
   */
  function cleanupActiveView() {
    if (activeController && typeof activeController.destroy === 'function') {
      activeController.destroy();
    }
    activeController = null;
    appContainer.innerHTML = '';
  }

  /**
   * Renders the designated route.
   * @param {string} route - Route identifier ('hub' | 'config' | 'game' | 'summary' | 'history').
   * @param {Object} params - Route parameters.
   */
  function renderRoute(route, params) {
    cleanupActiveView();

    switch (route) {
      case 'config':
        activeController = new ConfigView(appContainer, {
          exerciseId: params.exerciseId || 'color-matching',
          onBack: () => {
            if (!router.goBack()) {
              router.navigate('hub');
            }
          },
          onStart: (cfg) => {
            router.navigate('game', cfg);
          },
        });
        break;

      case 'game':
        activeController = new ActiveGameController(appContainer, params, {
          onExit: () => {
            if (!router.goBack()) {
              router.navigate('config', params);
            }
          },
          onFinish: (sessionData) => {
            router.navigate('summary', { sessionData });
          },
        });
        break;

      case 'summary':
        activeController = new SummaryView(appContainer, {
          sessionData: params.sessionData,
          onPlayAgain: () => {
            router.navigate('game', {
              exerciseId: params.sessionData?.exerciseId || 'color-matching',
              mode: params.sessionData?.mode || 'HSV',
              questionCount: params.sessionData?.totalQuestions || 5,
            });
          },
          onConfigure: () => {
            router.navigate('config', {
              exerciseId: params.sessionData?.exerciseId || 'color-matching',
            });
          },
          onViewHistory: () => {
            router.navigate('history');
          },
        });
        break;

      case 'history':
        activeController = new HistoryView(appContainer, {
          onBack: () => {
            if (!router.goBack()) {
              router.navigate('hub');
            }
          },
        });
        break;

      case 'hub':
      default:
        activeController = new SelectorView(appContainer, {
          onSelectExercise: (exerciseId) => {
            router.navigate('config', { exerciseId });
          },
          onOpenHistory: () => {
            router.navigate('history');
          },
        });
        break;
    }
  }

  const router = new AppRouter({
    initialRoute: 'hub',
    onRouteChange: (route, params) => {
      renderRoute(route, params);
    },
  });

  // Render initial route
  renderRoute(router.getCurrentRoute(), router.getCurrentParams());

  // Register Service Worker in production builds
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      const swUrl = `${import.meta.env.BASE_URL}sw.js`;
      navigator.serviceWorker
        .register(swUrl)
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available
                }
              });
            }
          });
        })
        .catch((err) => {
          console.error('ServiceWorker registration failed: ', err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }

  return {
    router,
    destroy: () => {
      cleanupActiveView();
    },
  };
}

// Auto-boot on window load in browser
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initApp());
  } else {
    initApp();
  }
}
