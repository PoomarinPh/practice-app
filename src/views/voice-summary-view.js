/**
 * @fileoverview VoiceSummaryView (Screen 4: Voice Session Summary).
 * Displays session accuracy %, notes matched, average cents deviation,
 * per-interval performance breakdown table, question recap cards with audio preview,
 * and restart/configuration navigation loops.
 * Strictly adheres to Google JavaScript Style Guide and VOICE_DESIGN.md.
 */

import { PianoSynth } from '../utils/audio/piano-synth.js';
import { INTERVAL_NAMES } from '../utils/audio/notes.js';

export class VoiceSummaryView {
  /**
   * @param {HTMLElement} container - DOM mount container.
   * @param {Object} [options={}] - View options.
   * @param {Object} [options.sessionData] - Completed session data.
   * @param {Function} [options.onPlayAgain] - Callback when "Play Again" is clicked.
   * @param {Function} [options.onConfigure] - Callback when "Change Settings" is clicked.
   * @param {Function} [options.onHome] - Callback when "Back to Hub" is clicked.
   * @param {PianoSynth} [options.synth] - Injected or default piano synth.
   */
  constructor(container, options = {}) {
    this.container = container;
    this.sessionData = options.sessionData || {
      exerciseId: 'voice-training',
      mode: 'interval-breakdown',
      totalQuestions: 0,
      correctCount: 0,
      accuracyPercent: 0,
      questions: [],
    };

    this.onPlayAgain = options.onPlayAgain || null;
    this.onConfigure = options.onConfigure || null;
    this.onHome = options.onHome || null;
    this.synth = options.synth || new PianoSynth();

    this.render();
  }

  /**
   * Computes per-interval accuracy metrics grouped across the session questions.
   * @returns {Array<{ code: string, name: string, total: number, correct: number, accuracyPercent: number }>}
   */
  getIntervalBreakdown() {
    const questions = this.sessionData.questions || [];
    const map = new Map();

    for (const q of questions) {
      const code = q.interval || 'P5';
      if (!map.has(code)) {
        map.set(code, { total: 0, correct: 0 });
      }
      const entry = map.get(code);
      entry.total += 1;
      if (q.isCorrect) {
        entry.correct += 1;
      }
    }

    const result = [];
    for (const [code, stats] of map.entries()) {
      const accuracyPercent = stats.total > 0
        ? Math.round((stats.correct / stats.total) * 1000) / 10
        : 0;
      result.push({
        code,
        name: INTERVAL_NAMES[code] || code,
        total: stats.total,
        correct: stats.correct,
        accuracyPercent,
      });
    }

    return result;
  }

  /**
   * Computes average absolute cent deviation across all answered questions.
   * @returns {number} Average deviation in cents.
   */
  getAverageDeviation() {
    const questions = this.sessionData.questions || [];
    if (questions.length === 0) {
      return 0;
    }
    const sum = questions.reduce((acc, q) => acc + Math.abs(q.cents !== undefined ? q.cents : 0), 0);
    return Math.round((sum / questions.length) * 10) / 10;
  }

  /**
   * Renders the complete voice session summary screen.
   */
  render() {
    const questions = this.sessionData.questions || [];
    const totalQuestions = this.sessionData.totalQuestions || questions.length;
    const correctCount = this.sessionData.correctCount ?? questions.filter((q) => q.isCorrect).length;
    const accuracyPercent = this.sessionData.accuracyPercent ?? (totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 1000) / 10 : 0);
    const avgDeviation = this.getAverageDeviation();
    const intervalStats = this.getIntervalBreakdown();

    this.container.innerHTML = `
      <div class="voice-summary-view container animate-fade-in" style="max-width: 640px; margin: 0 auto; padding: 1.5rem 1rem 3rem;">
        <!-- Header -->
        <header class="summary-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
          <div class="brand-badge">
            <span class="brand-dot" style="background: #38bdf8;"></span>
            <span class="brand-title">ChromaSense Voice</span>
          </div>
          <div class="summary-header-badge" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 0.3rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 700;">
            Session Complete 🎉
          </div>
        </header>

        <div style="text-align: center; margin-bottom: 1.5rem;">
          <h1 style="font-size: 1.85rem; font-weight: 800; color: #fff; margin: 0 0 0.5rem;">
            Vocal Session Summary
          </h1>
          <p style="color: #94a3b8; font-size: 0.95rem; margin: 0;">
            Review your ear-training accuracy and pitch match deviation per interval.
          </p>
        </div>

        <!-- Session KPI Grid -->
        <section class="summary-stats-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1.5rem;">
          <div class="summary-kpi-card" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 0.75rem; padding: 1rem; text-align: center;">
            <span class="summary-kpi-label" style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.35rem;">Accuracy</span>
            <span class="summary-kpi-val" style="font-size: 1.4rem; font-weight: 800; color: ${accuracyPercent >= 80 ? '#34d399' : '#38bdf8'};">
              ${accuracyPercent}%
            </span>
          </div>
          <div class="summary-kpi-card" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 0.75rem; padding: 1rem; text-align: center;">
            <span class="summary-kpi-label" style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.35rem;">Matched Notes</span>
            <span class="summary-kpi-val" style="font-size: 1.4rem; font-weight: 800; color: #f8fafc;">
              ${correctCount} / ${totalQuestions}
            </span>
          </div>
          <div id="summary-kpi-deviation" class="summary-kpi-card" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 0.75rem; padding: 1rem; text-align: center;">
            <span class="summary-kpi-label" style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.35rem;">Avg Deviation</span>
            <span class="summary-kpi-val" style="font-size: 1.4rem; font-weight: 800; color: #f8fafc;">
              ${avgDeviation}c
            </span>
          </div>
        </section>

        <!-- Per-Interval Performance Breakdown Table -->
        <section class="card" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.05rem; font-weight: 700; color: #e2e8f0; margin: 0 0 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>📊</span> Interval Breakdown
          </h2>

          <div id="interval-breakdown-table" style="display: flex; flex-direction: column; gap: 0.6rem;">
            ${intervalStats.map((item) => `
              <div
                data-interval-row="${item.code}"
                style="display: flex; justify-content: space-between; align-items: center; background: rgba(15, 23, 42, 0.6); padding: 0.65rem 0.85rem; border-radius: 0.6rem; border: 1px solid rgba(255, 255, 255, 0.05);"
              >
                <div>
                  <span style="font-weight: 800; color: #f8fafc; font-size: 0.95rem;">${item.code}</span>
                  <span style="font-size: 0.8rem; color: #94a3b8; margin-left: 0.5rem;">${item.name}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <span style="font-size: 0.8rem; color: #94a3b8;">${item.correct} / ${item.total}</span>
                  <span class="badge" style="
                    font-size: 0.8rem;
                    font-weight: 700;
                    padding: 0.2rem 0.5rem;
                    border-radius: 4px;
                    background: ${item.accuracyPercent >= 80 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
                    color: ${item.accuracyPercent >= 80 ? '#34d399' : '#f87171'};
                  ">
                    ${item.accuracyPercent}%
                  </span>
                </div>
              </div>
            `).join('')}
          </div>
        </section>

        <!-- Questions Review List -->
        <section class="card" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.5rem;">
          <h2 style="font-size: 1.05rem; font-weight: 700; color: #e2e8f0; margin: 0 0 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
            <span>🎯</span> Questions Review (${questions.length})
          </h2>

          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${questions.map((q) => {
              const statusClass = q.isCorrect ? 'status-correct' : 'status-wrong';
              const ratingText = q.rating === 'flawless'
                ? '🌟 Flawless'
                : q.rating === 'in-tune'
                  ? '🎯 In Tune'
                  : '❌ Off-Pitch';
              const centsText = `${q.cents !== undefined && q.cents >= 0 ? '+' : ''}${q.cents ?? 0}c`;
              const hasDualNotes = Boolean(q.bottom && q.top);
              const headerContext = hasDualNotes
                ? `${q.bottom.targetNote} & ${q.top.targetNote}`
                : (q.prompt || 'Target').toUpperCase();

              return `
                <article class="voice-recap-card recap-card" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 0.75rem; padding: 1rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                    <div style="font-weight: 700; font-size: 0.95rem; color: #e2e8f0;">
                      Q${q.questionNumber}: ${q.interval} (${headerContext})
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                      <span class="recap-status-pill ${statusClass}" style="
                        font-size: 0.75rem;
                        font-weight: 700;
                        padding: 0.2rem 0.5rem;
                        border-radius: 4px;
                        background: ${q.isCorrect ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
                        color: ${q.isCorrect ? '#34d399' : '#f87171'};
                      ">
                        ${ratingText}
                      </span>
                      <span style="font-size: 0.8rem; font-weight: 700; color: #38bdf8;">
                        ${centsText}
                      </span>
                    </div>
                  </div>

                  ${hasDualNotes ? `
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                      <!-- Bottom Note Row -->
                      <div class="note-recap-row" style="display: flex; justify-content: space-between; align-items: center; background: rgba(0, 0, 0, 0.25); padding: 0.55rem 0.85rem; border-radius: 0.5rem;">
                        <div>
                          <span style="font-size: 0.7rem; color: #38bdf8; font-weight: 700; display: block;">Bottom Note</span>
                          <span style="font-size: 1.15rem; font-weight: 800; color: #f8fafc;">${q.bottom.targetNote}</span>
                        </div>
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm"
                          data-replay-note="${q.bottom.targetNote}"
                          style="font-size: 0.75rem; padding: 0.3rem 0.65rem; border-radius: 0.4rem; display: flex; align-items: center; gap: 0.3rem;"
                        >
                          <span>🎵</span> Play Note
                        </button>
                        <div style="text-align: right;">
                          <span style="font-size: 0.7rem; color: #94a3b8; display: block;">Sung: ${q.bottom.detectedNote} (${q.bottom.evaluation.cents >= 0 ? '+' : ''}${q.bottom.evaluation.cents}c)</span>
                          <span style="font-size: 0.85rem; font-weight: 700; color: ${q.bottom.evaluation.isCorrect ? '#34d399' : '#f87171'};">
                            ${q.bottom.evaluation.rating === 'flawless' ? '🌟 Flawless' : q.bottom.evaluation.isCorrect ? '🎯 In Tune' : '❌ Off-Pitch'}
                          </span>
                        </div>
                      </div>

                      <!-- Top Note Row -->
                      <div class="note-recap-row" style="display: flex; justify-content: space-between; align-items: center; background: rgba(0, 0, 0, 0.25); padding: 0.55rem 0.85rem; border-radius: 0.5rem;">
                        <div>
                          <span style="font-size: 0.7rem; color: #a78bfa; font-weight: 700; display: block;">Top Note</span>
                          <span style="font-size: 1.15rem; font-weight: 800; color: #f8fafc;">${q.top.targetNote}</span>
                        </div>
                        <button
                          type="button"
                          class="btn btn-secondary btn-sm"
                          data-replay-note="${q.top.targetNote}"
                          style="font-size: 0.75rem; padding: 0.3rem 0.65rem; border-radius: 0.4rem; display: flex; align-items: center; gap: 0.3rem;"
                        >
                          <span>🎵</span> Play Note
                        </button>
                        <div style="text-align: right;">
                          <span style="font-size: 0.7rem; color: #94a3b8; display: block;">Sung: ${q.top.detectedNote} (${q.top.evaluation.cents >= 0 ? '+' : ''}${q.top.evaluation.cents}c)</span>
                          <span style="font-size: 0.85rem; font-weight: 700; color: ${q.top.evaluation.isCorrect ? '#34d399' : '#f87171'};">
                            ${q.top.evaluation.rating === 'flawless' ? '🌟 Flawless' : q.top.evaluation.isCorrect ? '🎯 In Tune' : '❌ Off-Pitch'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ` : `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0, 0, 0, 0.25); padding: 0.6rem 0.85rem; border-radius: 0.5rem;">
                      <div>
                        <span style="font-size: 0.7rem; color: #94a3b8; display: block; margin-bottom: 0.15rem;">Target Pitch</span>
                        <span style="font-size: 1.25rem; font-weight: 800; color: #38bdf8;">${q.targetNote}</span>
                      </div>

                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-replay-note="${q.targetNote}"
                        style="font-size: 0.75rem; padding: 0.35rem 0.7rem; border-radius: 0.4rem; display: flex; align-items: center; gap: 0.3rem;"
                      >
                        <span>🎵</span> Play Note
                      </button>

                      <div style="text-align: right;">
                        <span style="font-size: 0.7rem; color: #94a3b8; display: block; margin-bottom: 0.15rem;">Your Pitch</span>
                        <span style="font-size: 1.25rem; font-weight: 800; color: ${q.isCorrect ? '#34d399' : '#f87171'};">${q.detectedNote || '--'}</span>
                      </div>
                    </div>
                  `}
                </article>
              `;
            }).join('')}
          </div>
        </section>

        <!-- Navigation Loops -->
        <section style="display: flex; flex-direction: column; gap: 0.6rem;">
          <button
            id="voice-summary-play-again-btn"
            type="button"
            class="btn btn-primary"
            style="width: 100%; padding: 0.9rem; font-size: 1.05rem; font-weight: 800; border-radius: 0.75rem; box-shadow: 0 10px 25px -5px rgba(56, 189, 248, 0.4);"
          >
            Play Again 🎙️
          </button>
          <button
            id="voice-summary-configure-btn"
            type="button"
            class="btn btn-secondary"
            style="width: 100%; padding: 0.85rem; font-size: 0.95rem; font-weight: 700; border-radius: 0.75rem;"
          >
            Change Settings ⚙️
          </button>
          <button
            id="voice-summary-home-btn"
            type="button"
            class="btn btn-secondary"
            style="width: 100%; padding: 0.75rem; font-size: 0.9rem; font-weight: 600; border-radius: 0.75rem; background: transparent; border-color: transparent; color: #94a3b8;"
          >
            Back to Hub 🏠
          </button>
        </section>
      </div>
    `;

    this.bindEvents();
  }

  /**
   * Binds interaction listeners.
   */
  bindEvents() {
    // Play Again
    const playAgainBtn = this.container.querySelector('#voice-summary-play-again-btn');
    if (playAgainBtn && this.onPlayAgain) {
      playAgainBtn.addEventListener('click', () => this.onPlayAgain());
    }

    // Configure
    const cfgBtn = this.container.querySelector('#voice-summary-configure-btn');
    if (cfgBtn && this.onConfigure) {
      cfgBtn.addEventListener('click', () => this.onConfigure());
    }

    // Home
    const homeBtn = this.container.querySelector('#voice-summary-home-btn');
    if (homeBtn && this.onHome) {
      homeBtn.addEventListener('click', () => this.onHome());
    }

    // Replay Note Delegation
    const replayButtons = this.container.querySelectorAll('[data-replay-note]');
    replayButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const note = btn.getAttribute('data-replay-note');
        if (note && this.synth) {
          this.synth.playTone(note, 1.8);
        }
      });
    });
  }

  /**
   * Cleanup resources when unmounted.
   */
  destroy() {
    this.container.innerHTML = '';
  }
}
