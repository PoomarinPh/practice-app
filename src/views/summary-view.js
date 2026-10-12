/**
 * @fileoverview SummaryView (Screen 4: Session Summary).
 * Displays session score KPIs, best match highlight, scrollable round review,
 * and navigation actions (Play Again, Configure, History).
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

/**
 * @typedef {Object} SessionQuestionRecord
 * @property {number} questionNumber - 1-based question index.
 * @property {Object} target - Target color object { h, s, v, hex }.
 * @property {Object} guess - User guess color object { h, s, v, hex }.
 * @property {number} score - Overall match accuracy percentage (0-100).
 * @property {boolean} isCorrect - Whether the score met or exceeded threshold.
 * @property {number|null} [timeSeconds] - Elapsed seconds (recorded only if correct).
 * @property {Object} breakdown - Per-channel accuracy { value, hue, saturation }.
 */

/**
 * @typedef {Object} SessionData
 * @property {string} exerciseId - Exercise identifier.
 * @property {string} mode - Color mode (e.g. 'HSV').
 * @property {number} totalQuestions - Total scheduled questions in round.
 * @property {SessionQuestionRecord[]} questions - List of answered question records.
 */

/**
 * @typedef {Object} SummaryViewOptions
 * @property {SessionData} [sessionData] - Completed session metrics.
 * @property {Function} [onPlayAgain] - Callback to restart round with identical config.
 * @property {Function} [onConfigure] - Callback to return to config setup screen.
 * @property {Function} [onViewHistory] - Callback to navigate to History & Stats screen.
 */

export class SummaryView {
  /**
   * @param {HTMLElement} container - DOM mount container.
   * @param {SummaryViewOptions} [options={}] - View options.
   */
  constructor(container, options = {}) {
    this.container = container;
    this.sessionData = options.sessionData || {
      exerciseId: 'color-matching',
      mode: 'HSV',
      totalQuestions: 0,
      questions: [],
    };
    this.onPlayAgain = options.onPlayAgain || null;
    this.onConfigure = options.onConfigure || null;
    this.onViewHistory = options.onViewHistory || null;

    this.render();
  }

  /**
   * Renders the session summary screen into container.
   */
  render() {
    this.container.innerHTML = '';
    const questions = this.sessionData.questions || [];
    const totalAnswered = questions.length;
    const correctCount = questions.filter((q) => q.isCorrect).length;

    const totalScore = questions.reduce((sum, q) => sum + (q.score || 0), 0);
    const averageScore = totalAnswered > 0 ? Math.round((totalScore / totalAnswered) * 10) / 10 : 0;

    const bestMatch = questions.reduce((best, q) => {
      if (!best || (q.score || 0) > (best.score || 0)) {
        return q;
      }
      return best;
    }, null);

    const correctWithTime = questions.filter((q) => q.isCorrect && typeof q.timeSeconds === 'number');
    const avgCorrectTime = correctWithTime.length > 0
      ? Math.round((correctWithTime.reduce((sum, q) => sum + q.timeSeconds, 0) / correctWithTime.length) * 10) / 10
      : 0;

    const root = document.createElement('div');
    root.className = 'summary-view-container';

    root.innerHTML = `
      <header class="summary-header">
        <div class="brand-badge">
          <span class="brand-dot"></span>
          <span class="brand-title">ChromaSense</span>
        </div>
        <div class="summary-header-badge">Session Complete 🎉</div>
      </header>

      <div class="summary-hero">
        <h1 class="summary-title">Round Summary</h1>
        <p class="summary-subtitle">Review your color matching performance and per-question channel accuracy.</p>
      </div>

      <!-- Session KPI Summary Grid -->
      <section class="summary-stats-grid">
        <div class="summary-kpi-card">
          <span class="summary-kpi-label">Average Score</span>
          <span class="summary-kpi-val highlight-acc">${averageScore}%</span>
        </div>
        <div class="summary-kpi-card">
          <span class="summary-kpi-label">Correct Matches</span>
          <span class="summary-kpi-val">${correctCount} / ${totalAnswered}</span>
        </div>
        <div class="summary-kpi-card">
          <span class="summary-kpi-label">Best Match</span>
          <span class="summary-kpi-val highlight-acc">${bestMatch ? bestMatch.score + '%' : '--'}</span>
        </div>
        <div class="summary-kpi-card">
          <span class="summary-kpi-label">Avg Correct Speed</span>
          <span class="summary-kpi-val highlight-time">${avgCorrectTime > 0 ? avgCorrectTime + 's' : '--'}</span>
        </div>
      </section>

      <!-- Scrollable Question Review List -->
      <section class="round-recap-section">
        <div class="round-recap-header">
          <h2 class="round-recap-title">Questions Review (${totalAnswered})</h2>
          <span class="round-recap-sub">Detailed target vs guess channel comparison</span>
        </div>

        <div class="recap-list">
          ${questions
            .map((q) => {
              const targetHex = q.target?.hex || '#000000';
              const guessHex = q.guess?.hex || '#000000';
              const timeString = q.isCorrect && typeof q.timeSeconds === 'number' ? `⏱ ${q.timeSeconds}s` : '';
              const statusClass = q.isCorrect ? 'status-correct' : 'status-wrong';
              const statusText = q.isCorrect ? 'Correct (≥85%)' : 'Needs Adjustment';
              const valAcc = q.breakdown?.value ?? 0;
              const hueAcc = q.breakdown?.hue ?? 0;
              const satAcc = q.breakdown?.saturation ?? 0;

              return `
              <article class="recap-card">
                <div class="recap-card-header">
                  <div class="recap-q-badge">Question ${q.questionNumber}</div>
                  <div class="recap-header-right">
                    <span class="recap-status-pill ${statusClass}">${statusText}</span>
                    <span class="recap-score-badge">${q.score}%</span>
                    ${timeString ? `<span class="recap-time-badge">${timeString}</span>` : ''}
                  </div>
                </div>

                <div class="recap-swatches-row">
                  <div class="recap-swatch-box">
                    <div class="recap-swatch-preview" style="background-color: ${targetHex};"></div>
                    <span class="recap-swatch-label">Target: ${targetHex}</span>
                  </div>
                  <div class="recap-vs">VS</div>
                  <div class="recap-swatch-box">
                    <div class="recap-swatch-preview" style="background-color: ${guessHex};"></div>
                    <span class="recap-swatch-label">Guess: ${guessHex}</span>
                  </div>
                </div>

                <div class="recap-breakdown-list">
                  <div class="recap-bar-item">
                    <div class="recap-bar-info">
                      <span>Value (Luminance)</span>
                      <span>${valAcc}%</span>
                    </div>
                    <div class="breakdown-bar-track">
                      <div class="breakdown-bar-fill val-fill" style="width: ${valAcc}%;"></div>
                    </div>
                  </div>

                  <div class="recap-bar-item">
                    <div class="recap-bar-info">
                      <span>Hue</span>
                      <span>${hueAcc}%</span>
                    </div>
                    <div class="breakdown-bar-track">
                      <div class="breakdown-bar-fill hue-fill" style="width: ${hueAcc}%;"></div>
                    </div>
                  </div>

                  <div class="recap-bar-item">
                    <div class="recap-bar-info">
                      <span>Saturation</span>
                      <span>${satAcc}%</span>
                    </div>
                    <div class="breakdown-bar-track">
                      <div class="breakdown-bar-fill sat-fill" style="width: ${satAcc}%;"></div>
                    </div>
                  </div>
                </div>
              </article>
            `;
            })
            .join('')}
        </div>
      </section>

      <!-- Action Buttons -->
      <section class="summary-actions-card">
        <button id="summary-play-again-btn" class="summary-action-btn primary" type="button">
          Play Again 🔄
        </button>
        <button id="summary-configure-btn" class="summary-action-btn secondary" type="button">
          Configure Another Round ⚙️
        </button>
        <button id="summary-history-btn" class="summary-action-btn tertiary" type="button">
          View History & Stats 📊
        </button>
      </section>
    `;

    this.container.appendChild(root);
    this.bindEvents(root);
  }

  /**
   * Binds interaction event listeners.
   * @private
   * @param {HTMLElement} root - View root element.
   */
  bindEvents(root) {
    const playBtn = root.querySelector('#summary-play-again-btn');
    playBtn?.addEventListener('click', () => {
      if (typeof this.onPlayAgain === 'function') {
        this.onPlayAgain();
      }
    });

    const cfgBtn = root.querySelector('#summary-configure-btn');
    cfgBtn?.addEventListener('click', () => {
      if (typeof this.onConfigure === 'function') {
        this.onConfigure();
      }
    });

    const histBtn = root.querySelector('#summary-history-btn');
    histBtn?.addEventListener('click', () => {
      if (typeof this.onViewHistory === 'function') {
        this.onViewHistory();
      }
    });
  }

  /**
   * Cleans up view.
   */
  destroy() {
    this.container.innerHTML = '';
  }
}
