/**
 * @fileoverview HistoryView (Screen 5: History & Statistics Hub).
 * Displays lifetime stats cards, gallery of saved correct matches with speed records,
 * and JSON backup export/import/clear utilities.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

import { clearAllData, exportDataJson, getDataStore, importDataJson } from '../utils/storage.js';

/**
 * @typedef {Object} HistoryViewOptions
 * @property {Function} [onBack] - Callback when back navigation is requested.
 */

export class HistoryView {
  /**
   * @param {HTMLElement} container - DOM container.
   * @param {HistoryViewOptions} [options={}] - Options.
   */
  constructor(container, options = {}) {
    this.container = container;
    this.onBack = options.onBack || null;

    this.render();
  }

  /**
   * Renders the History & Statistics Hub into the container.
   */
  render() {
    this.container.innerHTML = '';
    const store = getDataStore();
    const stats = store.stats || {};
    const correctItems = (store.history || []).filter((item) => item.isCorrect);

    const root = document.createElement('div');
    root.className = 'history-view-container';

    root.innerHTML = `
      <header class="history-header">
        <button id="history-back-btn" class="history-back-btn" type="button">
          ← Back
        </button>
        <div class="history-header-badge">Performance Record</div>
      </header>

      <div class="history-hero">
        <h1 class="history-title">History & Statistics</h1>
        <p class="history-subtitle">Review your lifetime color accuracy, correct matches, and speed metrics.</p>
      </div>

      <!-- Lifetime Summary Cards Grid -->
      <section class="history-stats-grid">
        <div class="hist-stat-card">
          <span class="hist-stat-label">Total Questions</span>
          <span class="hist-stat-val">${stats.totalQuestions || 0}</span>
        </div>
        <div class="hist-stat-card">
          <span class="hist-stat-label">Correct Matches</span>
          <span class="hist-stat-val highlight-acc">${stats.totalCorrect || 0}</span>
        </div>
        <div class="hist-stat-card">
          <span class="hist-stat-label">Lifetime Accuracy</span>
          <span class="hist-stat-val highlight-acc">
            ${stats.totalQuestions > 0 ? Math.round(((stats.totalCorrect || 0) / stats.totalQuestions) * 1000) / 10 + '%' : '--'}
          </span>
        </div>
        <div class="hist-stat-card">
          <span class="hist-stat-label">Avg Correct Speed</span>
          <span class="hist-stat-val highlight-time">
            ${stats.averageCorrectTime > 0 ? `${stats.averageCorrectTime}s` : '--'}
          </span>
        </div>
      </section>

      <!-- Correct Guesses Gallery -->
      <section class="gallery-section">
        <div class="gallery-section-header">
          <h2 class="gallery-section-title">Saved Correct Colors (${correctItems.length})</h2>
          <span class="gallery-section-sub">Colors matched at ≥85% accuracy</span>
        </div>

        <div class="gallery-grid">
          ${
            correctItems.length === 0
              ? `
            <div class="gallery-empty-state">
              <span class="empty-icon">🎨</span>
              <p class="empty-text">No correct matches saved yet.</p>
              <p class="empty-sub">Complete exercises with ≥85% accuracy to build your personal color gallery!</p>
            </div>
          `
              : correctItems
                  .slice()
                  .reverse()
                  .map((item) => {
                    const targetHex = item.target?.hex || '#000000';
                    const guessHex = item.guess?.hex || '#000000';
                    const timeString = item.timeSeconds ? `⏱ ${item.timeSeconds}s` : '';
                    return `
              <article class="gallery-card">
                <div class="gallery-card-swatches">
                  <div class="gallery-swatch" style="background-color: ${targetHex};" title="Target: ${targetHex}"></div>
                  <div class="gallery-swatch" style="background-color: ${guessHex};" title="Guess: ${guessHex}"></div>
                </div>
                <div class="gallery-card-info">
                  <div class="gallery-score-row">
                    <span class="gallery-score-val">${item.score}%</span>
                    ${timeString ? `<span class="gallery-time-badge">${timeString}</span>` : ''}
                  </div>
                  <div class="gallery-hex-row">
                    <span>${targetHex}</span>
                    <span class="hex-arrow">→</span>
                    <span>${guessHex}</span>
                  </div>
                </div>
              </article>
            `;
                  })
                  .join('')
          }
        </div>
      </section>

      <!-- Data Management Section -->
      <section class="data-mgmt-card">
        <h3 class="data-mgmt-title">Data Backup & Tools</h3>
        <div class="data-mgmt-buttons">
          <button id="export-backup-btn" class="data-mgmt-btn" type="button">
            📥 Export Backup (JSON)
          </button>
          <button id="import-backup-btn" class="data-mgmt-btn" type="button">
            📤 Import Backup
          </button>
          <button id="clear-history-btn" class="data-mgmt-btn danger" type="button">
            🗑 Clear History
          </button>
        </div>
      </section>
    `;

    this.container.appendChild(root);
    this.bindEvents(root);
  }

  /**
   * Binds interaction listeners.
   * @private
   * @param {HTMLElement} root - View root element.
   */
  bindEvents(root) {
    const backBtn = root.querySelector('#history-back-btn');
    backBtn?.addEventListener('click', () => {
      if (typeof this.onBack === 'function') {
        this.onBack();
      }
    });

    // Export Backup
    const exportBtn = root.querySelector('#export-backup-btn');
    exportBtn?.addEventListener('click', () => {
      const json = exportDataJson();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chromasense-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Import Backup
    const importBtn = root.querySelector('#import-backup-btn');
    importBtn?.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const content = event.target?.result;
            if (typeof content === 'string') {
              const success = importDataJson(content);
              if (success) {
                alert('Backup imported successfully!');
                this.render();
              } else {
                alert('Invalid backup file. Restoration failed.');
              }
            }
          };
          reader.readAsText(file);
        }
      };
      input.click();
    });

    // Clear History
    const clearBtn = root.querySelector('#clear-history-btn');
    clearBtn?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all history and statistics? This cannot be undone.')) {
        clearAllData();
        this.render();
      }
    });
  }

  /**
   * Destroys view.
   */
  destroy() {
    this.container.innerHTML = '';
  }
}
