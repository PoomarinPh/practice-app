/**
 * @fileoverview SelectorView (Screen 1: Exercise Hub).
 * Displays active and extensible exercises, branding, and direct entry to History & Stats.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

import { getDataStore } from '../utils/storage.js';
import { exerciseRegistry } from '../exercises/exercise-registry.js';

/**
 * @typedef {Object} SelectorViewOptions
 * @property {Function} [onSelectExercise] - Callback when an active exercise is chosen.
 * @property {Function} [onOpenHistory] - Callback to open History & Stats Hub.
 */

export class SelectorView {
  /**
   * @param {HTMLElement} container - DOM container.
   * @param {SelectorViewOptions} [options={}] - Options.
   */
  constructor(container, options = {}) {
    this.container = container;
    this.onSelectExercise = options.onSelectExercise || null;
    this.onOpenHistory = options.onOpenHistory || null;

    this.render();
  }

  /**
   * Renders the Exercise Hub view.
   */
  render() {
    this.container.innerHTML = '';
    const store = getDataStore();
    const totalCorrect = store?.stats?.totalCorrect || 0;

    const root = document.createElement('div');
    root.className = 'hub-view-container';

    // Build active cards from modular exerciseRegistry
    const activeCardsHtml = exerciseRegistry.map((exercise) => `
      <article class="exercise-card active" data-exercise-id="${exercise.id}" tabindex="0">
        <div class="exercise-card-badge badge-active">${exercise.badge || 'Ready to Play'}</div>
        <div class="exercise-card-icon">${exercise.icon || '🎯'}</div>
        <h2 class="exercise-card-title">${exercise.name}</h2>
        <p class="exercise-card-desc">${exercise.description}</p>
        <div class="exercise-card-footer">
          <span class="play-action-text">Configure & Play →</span>
        </div>
      </article>
    `).join('');

    root.innerHTML = `
      <header class="hub-header">
        <div class="brand-badge">
          <span class="brand-dot"></span>
          <span class="brand-title">ChromaSense</span>
        </div>
        <button id="hub-history-btn" class="hub-history-cta" type="button">
          <span>📊 History</span>
          <span class="history-correct-badge">${totalCorrect} Solved</span>
        </button>
      </header>

      <div class="hub-hero">
        <h1 class="exercise-hub-title">Sensory Perception Drills</h1>
        <p class="exercise-hub-subtitle">
          Train your creative instincts through visual color observation and vocal pitch interval exercises.
        </p>
      </div>

      <div class="exercise-grid">
        ${activeCardsHtml}

        <!-- Slot 3: Value & Luminance Isolation -->
        <article class="exercise-card locked" tabindex="-1">
          <div class="exercise-card-badge badge-locked">🔒 Coming Soon</div>
          <div class="exercise-card-icon">🌓</div>
          <h2 class="exercise-card-title">Value & Luminance Isolation</h2>
          <p class="exercise-card-desc">
            Pure grayscale & tonal observation drill to decouple brightness perception from chromatic hue.
          </p>
          <div class="exercise-card-footer">
            <span class="locked-action-text">Locked</span>
          </div>
        </article>

        <!-- Slot 4: Complementary & Harmonic Mixing -->
        <article class="exercise-card locked" tabindex="-1">
          <div class="exercise-card-badge badge-locked">🔒 Coming Soon</div>
          <div class="exercise-card-icon">🎨</div>
          <h2 class="exercise-card-title">Complementary & Harmonics</h2>
          <p class="exercise-card-desc">
            Calculate and target the exact complementary, split-complementary, and triadic harmony pairs.
          </p>
          <div class="exercise-card-footer">
            <span class="locked-action-text">Locked</span>
          </div>
        </article>
      </div>
    `;

    this.container.appendChild(root);
    this.bindEvents(root);
  }

  /**
   * Binds interaction events.
   * @private
   * @param {HTMLElement} root - View root element.
   */
  bindEvents(root) {
    const historyBtn = root.querySelector('#hub-history-btn');
    historyBtn?.addEventListener('click', () => {
      if (typeof this.onOpenHistory === 'function') {
        this.onOpenHistory();
      }
    });

    const activeCards = root.querySelectorAll('.exercise-card.active');
    activeCards.forEach((activeCard) => {
      activeCard.addEventListener('click', () => {
        const exerciseId = activeCard.getAttribute('data-exercise-id');
        if (typeof this.onSelectExercise === 'function') {
          this.onSelectExercise(exerciseId);
        }
      });
      activeCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const exerciseId = activeCard.getAttribute('data-exercise-id');
          if (typeof this.onSelectExercise === 'function') {
            this.onSelectExercise(exerciseId);
          }
        }
      });
    });
  }

  /**
   * Cleans up the view.
   */
  destroy() {
    this.container.innerHTML = '';
  }
}
