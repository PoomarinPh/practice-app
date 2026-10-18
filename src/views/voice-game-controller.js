/**
 * @fileoverview Initial VoiceGameController for Screen 3: Voice Drill.
 * Serves as the decoupled view controller for voice-training exercises.
 * Strictly adheres to Google JavaScript Style Guide and VOICE_DESIGN.md.
 */

export class VoiceGameController {
  /**
   * @param {HTMLElement} container - DOM mount container.
   * @param {Object} config - Game configuration { exerciseId, mode, questionCount }.
   * @param {Object|Function} callbacks - Callbacks { onExit, onFinish } or exit function.
   */
  constructor(container, config = {}, callbacks = {}) {
    this.container = container;
    this.config = config;

    if (typeof callbacks === 'function') {
      this.onExit = callbacks;
      this.onFinish = null;
    } else {
      this.onExit = callbacks?.onExit || null;
      this.onFinish = callbacks?.onFinish || null;
    }

    this.currentQuestion = 1;
    this.totalQuestions = this.config.questionCount || 5;

    this.render();
  }

  /**
   * Renders the initial voice drill interface.
   */
  render() {
    this.container.innerHTML = `
      <header class="app-header">
        <button id="voice-exit-btn" class="game-exit-btn" type="button">
          ← Exit
        </button>
        <div class="brand-badge">
          <span class="brand-dot" style="background: #38bdf8;"></span>
          <span class="brand-title">ChromaSense Voice</span>
        </div>
        <div id="voice-elapsed-timer" class="timer-badge">
          ⏱ 00:00.0
        </div>
      </header>

      <main class="interactive-container voice-container">
        <section class="stats-banner-card">
          <div class="stat-pill">
            <span class="stat-pill-label">Progress</span>
            <span id="voice-stat-progress" class="stat-pill-val">Q ${this.currentQuestion} / ${this.totalQuestions}</span>
          </div>
          <div class="stat-pill">
            <span class="stat-pill-label">Exercise</span>
            <span class="stat-pill-val highlight-acc">Intervals</span>
          </div>
          <div class="stat-pill">
            <span class="stat-pill-label">Mode</span>
            <span class="stat-pill-val">Breakdown</span>
          </div>
        </section>

        <section class="swatch-viewer-card voice-prompt-card" style="text-align: center; padding: 1.5rem 1rem;">
          <div class="swatch-tag-badge match-badge" style="margin-bottom: 0.5rem; display: inline-block;">
            Interval: Perfect 5th (P5)
          </div>
          <h2 style="font-size: 1.3rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--color-text-primary);">
            Sing the TOP Note
          </h2>
          <p style="font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 1rem;">
            Listen to the interval and match the target pitch.
          </p>
          <button id="voice-replay-btn" class="swatch-tool-btn" type="button" style="margin: 0 auto;">
            <span>🔁</span> <span>Replay Notes</span>
          </button>
        </section>

        <section class="controls-card voice-mic-card" style="text-align: center; padding: 2rem 1rem;">
          <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🎙️</div>
          <p style="font-size: 0.9rem; color: var(--color-text-secondary); margin-bottom: 1rem;">
            Audio Engine & YIN Pitch Detection activate in Phase 2 & 3.
          </p>
          <button id="voice-sing-cta" class="submit-guess-btn" type="button" style="max-width: 280px; margin: 0 auto;">
            Hold / Tap to Sing 🎤
          </button>
        </section>
      </main>
    `;

    this.bindEvents();
  }

  /**
   * Binds interaction listeners.
   */
  bindEvents() {
    const exitBtn = this.container.querySelector('#voice-exit-btn');
    exitBtn?.addEventListener('click', () => {
      this.destroy();
      if (typeof this.onExit === 'function') {
        this.onExit();
      }
    });
  }

  /**
   * Cleans up listeners and timers.
   */
  destroy() {
    this.container.innerHTML = '';
  }
}
