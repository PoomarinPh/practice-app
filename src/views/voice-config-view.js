/**
 * @fileoverview VoiceConfigView (Screen 2: Voice Training Configuration).
 * Configures vocal note range (C3-C7), 12 interval toggles with 30-day accuracy badges,
 * question counts, and melodic vs harmonic playback style.
 * Strictly adheres to Google JavaScript Style Guide and VOICE_DESIGN.md.
 */

import {
  INTERVAL_SEMITONES,
  INTERVAL_NAMES,
  noteToMidi,
  midiToNote,
  noteToFreq,
} from '../utils/audio/notes.js';
import { getIntervalAccuracyStats } from '../utils/storage.js';

/**
 * Storage key for persisting voice training user preferences.
 */
export const VOICE_PREFERENCES_KEY = 'voice_training_preferences';

/**
 * Default voice configuration settings.
 */
export const DEFAULT_VOICE_CONFIG = Object.freeze({
  exerciseId: 'voice-training',
  mode: 'interval-breakdown',
  rangeFrom: 'C3',
  rangeTo: 'C5',
  questionCount: 5,
  playbackStyle: 'melodic',
  enabledIntervals: Object.keys(INTERVAL_SEMITONES),
});

/**
 * Preset vocal ranges.
 */
export const RANGE_PRESETS = Object.freeze([
  { id: 'tenor-bass', label: 'Tenor / Bass (C3 - E4)', from: 'C3', to: 'E4' },
  { id: 'alto-soprano', label: 'Alto / Soprano (A3 - C5)', from: 'A3', to: 'C5' },
  { id: 'full-range', label: 'Full Range (C3 - C7)', from: 'C3', to: 'C7' },
]);

/**
 * Available question count choices.
 */
export const QUESTION_COUNTS = Object.freeze([1, 5, 10, 15, 20]);

export class VoiceConfigView {
  /**
   * @param {HTMLElement} container - DOM parent container.
   * @param {Object} [options={}] - View configuration options.
   * @param {Function} [options.onBack] - Callback on back navigation.
   * @param {Function} [options.onStart] - Callback on starting voice drill: (config) => void.
   */
  constructor(container, options = {}) {
    this.container = container;
    this.onBack = options.onBack || null;
    this.onStart = options.onStart || null;

    this.loadPreferences();
    this.render();
  }

  /**
   * Loads saved preferences from localStorage or initializes defaults.
   */
  loadPreferences() {
    let saved = null;
    try {
      const raw = localStorage.getItem(VOICE_PREFERENCES_KEY);
      if (raw) {
        saved = JSON.parse(raw);
      }
    } catch {
      // Fallback on defaults
    }

    this.rangeFrom = saved?.rangeFrom || DEFAULT_VOICE_CONFIG.rangeFrom;
    this.rangeTo = saved?.rangeTo || DEFAULT_VOICE_CONFIG.rangeTo;
    this.questionCount = saved?.questionCount || DEFAULT_VOICE_CONFIG.questionCount;
    this.playbackStyle = saved?.playbackStyle || DEFAULT_VOICE_CONFIG.playbackStyle;
    this.enabledIntervals = Array.isArray(saved?.enabledIntervals) && saved.enabledIntervals.length > 0
      ? [...saved.enabledIntervals]
      : [...DEFAULT_VOICE_CONFIG.enabledIntervals];
  }

  /**
   * Persists current preferences into localStorage.
   */
  savePreferences() {
    try {
      localStorage.setItem(
        VOICE_PREFERENCES_KEY,
        JSON.stringify(this.getConfig())
      );
    } catch {
      // Ignore quota errors
    }
  }

  /**
   * Returns complete active configuration object.
   * @returns {Object}
   */
  getConfig() {
    return {
      exerciseId: 'voice-training',
      mode: 'interval-breakdown',
      rangeFrom: this.rangeFrom,
      rangeTo: this.rangeTo,
      questionCount: this.questionCount,
      playbackStyle: this.playbackStyle,
      enabledIntervals: [...this.enabledIntervals],
    };
  }

  /**
   * Programmatically updates enabled intervals.
   * @param {string[]} intervals
   */
  setEnabledIntervals(intervals) {
    if (intervals && intervals.length > 0) {
      this.enabledIntervals = [...intervals];
      this.savePreferences();
      this.updateIntervalUI();
    }
  }

  /**
   * Sets note range bounds.
   * @param {string} from - Starting note.
   * @param {string} to - Ending note.
   */
  setRange(from, to) {
    const fromMidi = noteToMidi(from);
    const toMidi = noteToMidi(to);
    if (fromMidi <= toMidi) {
      this.rangeFrom = from;
      this.rangeTo = to;
      this.savePreferences();
      this.updateRangeUI();
    }
  }

  /**
   * Renders the complete voice configuration screen.
   */
  render() {
    this.container.innerHTML = `
      <div class="voice-config-view config-view-container container animate-fade-in" style="max-width: 640px; margin: 0 auto; padding: 1.5rem 1rem 3rem;">
        <!-- Header -->
        <header class="view-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
          <button id="voice-config-back-btn" class="btn btn-secondary btn-icon btn-back" aria-label="Back to Exercise Hub" style="display: flex; align-items: center; gap: 0.5rem;">
            <span>←</span> Back
          </button>
          <div style="text-align: right;">
            <span class="badge" style="background: rgba(139, 92, 246, 0.2); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.4); padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600;">
              🎙️ Voice Ear Training
            </span>
          </div>
        </header>

        <div style="margin-bottom: 1.5rem; text-align: center;">
          <h1 class="config-title" style="font-size: 1.75rem; font-weight: 800; margin: 0 0 0.5rem; color: #fff;">
            Voice Training: Interval Breakdown
          </h1>
          <p style="color: #94a3b8; font-size: 0.95rem; margin: 0;">
            Hear two piano notes, isolate the harmonic relationship, and sing either the bottom or top note into your microphone.
          </p>
        </div>

        <!-- Section 1: Vocal Range Configuration -->
        <section class="card" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.25rem;">
          <h2 style="font-size: 1.05rem; font-weight: 700; margin: 0 0 0.75rem; color: #e2e8f0; display: flex; align-items: center; gap: 0.5rem;">
            <span>🎵</span> Vocal Range (C3 - C7)
          </h2>
          <div id="range-display-banner" style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 0.75rem; padding: 0.75rem; text-align: center; margin-bottom: 1rem;">
            <div style="font-size: 1.25rem; font-weight: 700; color: #38bdf8;">
              <span id="label-range-from">${this.rangeFrom}</span> (${Math.round(noteToFreq(this.rangeFrom))} Hz)
              <span style="color: #64748b; margin: 0 0.5rem;">→</span>
              <span id="label-range-to">${this.rangeTo}</span> (${Math.round(noteToFreq(this.rangeTo))} Hz)
            </div>
            <div style="font-size: 0.8rem; color: #94a3b8; margin-top: 0.25rem;">
              Notes will be selected randomly inside this span
            </div>
          </div>

          <!-- Quick Presets -->
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem;">
            ${RANGE_PRESETS.map(
              (p) => `
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                data-preset="${p.id}"
                style="flex: 1; min-width: 130px; font-size: 0.8rem; padding: 0.4rem 0.6rem; border-radius: 0.5rem;"
              >
                ${p.label}
              </button>
            `
            ).join('')}
          </div>

          <!-- Dual Slider Sliders -->
          <div style="display: flex; gap: 1rem; align-items: center;">
            <div style="flex: 1;">
              <label for="slider-range-from" style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.25rem;">From Note</label>
              <input
                id="slider-range-from"
                type="range"
                min="48"
                max="96"
                value="${noteToMidi(this.rangeFrom)}"
                style="width: 100%; accent-color: #38bdf8;"
              />
            </div>
            <div style="flex: 1;">
              <label for="slider-range-to" style="display: block; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.25rem;">To Note</label>
              <input
                id="slider-range-to"
                type="range"
                min="48"
                max="96"
                value="${noteToMidi(this.rangeTo)}"
                style="width: 100%; accent-color: #38bdf8;"
              />
            </div>
          </div>
        </section>

        <!-- Section 2: 12 Chromatic Intervals & 30-Day Stats -->
        <section class="card" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; padding: 1.25rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h2 style="font-size: 1.05rem; font-weight: 700; margin: 0; color: #e2e8f0; display: flex; align-items: center; gap: 0.5rem;">
              <span>🎹</span> Active Intervals (12)
            </h2>
            <div style="display: flex; gap: 0.5rem;">
              <button id="btn-select-all-intervals" type="button" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">All</button>
            </div>
          </div>

          <div id="intervals-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.6rem;">
            <!-- Populated via updateIntervalUI -->
          </div>
        </section>

        <!-- Section 3: Questions & Playback Style -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
          <!-- Questions -->
          <section class="card" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; padding: 1.25rem;">
            <h2 style="font-size: 0.95rem; font-weight: 700; margin: 0 0 0.75rem; color: #e2e8f0;">
              Questions
            </h2>
            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              ${QUESTION_COUNTS.map(
                (cnt) => `
                <button
                  type="button"
                  class="chip-button ${this.questionCount === cnt ? 'active' : ''}"
                  data-count="${cnt}"
                  style="flex: 1; min-width: 40px; padding: 0.5rem 0.2rem; font-weight: 700; border-radius: 0.5rem; text-align: center;"
                >
                  ${cnt}
                </button>
              `
              ).join('')}
            </div>
          </section>

          <!-- Style -->
          <section class="card" style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; padding: 1.25rem;">
            <h2 style="font-size: 0.95rem; font-weight: 700; margin: 0 0 0.75rem; color: #e2e8f0;">
              Playback Style
            </h2>
            <div style="display: flex; gap: 0.4rem;">
              <button
                type="button"
                class="chip-button ${this.playbackStyle === 'melodic' ? 'active' : ''}"
                data-style="melodic"
                style="flex: 1; padding: 0.5rem 0.2rem; font-size: 0.8rem; font-weight: 700; border-radius: 0.5rem;"
              >
                Melodic
              </button>
              <button
                type="button"
                class="chip-button ${this.playbackStyle === 'harmonic' ? 'active' : ''}"
                data-style="harmonic"
                style="flex: 1; padding: 0.5rem 0.2rem; font-size: 0.8rem; font-weight: 700; border-radius: 0.5rem;"
              >
                Harmonic
              </button>
            </div>
          </section>
        </div>

        <!-- Primary CTA -->
        <button
          id="start-exercise-btn"
          type="button"
          class="btn btn-primary start-voice-drill-btn"
          style="width: 100%; padding: 1rem; font-size: 1.15rem; font-weight: 800; border-radius: 0.75rem; box-shadow: 0 10px 25px -5px rgba(56, 189, 248, 0.4); display: flex; align-items: center; justify-content: center; gap: 0.5rem;"
        >
          <span>Start Voice Drill</span> 🎙️
        </button>
      </div>
    `;

    this.updateIntervalUI();
    this.bindEvents();
  }

  /**
   * Refreshes interval toggle buttons with 30-day accuracy badges.
   */
  updateIntervalUI() {
    const grid = this.container.querySelector('#intervals-grid');
    if (!grid) {
      return;
    }

    grid.innerHTML = Object.entries(INTERVAL_SEMITONES)
      .map(([code, semitones]) => {
        const isEnabled = this.enabledIntervals.includes(code);
        const name = INTERVAL_NAMES[code] || code;
        const stats = getIntervalAccuracyStats(code, 30);
        const badgeText = stats.accuracyPercent !== null
          ? `${stats.accuracyPercent}% Acc (${stats.totalCorrect}/${stats.totalAttempts})`
          : 'No data';

        return `
          <button
            type="button"
            class="interval-toggle-card chip-button ${isEnabled ? 'active' : ''}"
            data-interval="${code}"
            style="display: flex; flex-direction: column; align-items: flex-start; padding: 0.6rem 0.75rem; border-radius: 0.6rem; text-align: left; cursor: pointer;"
          >
            <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
              <span style="font-weight: 800; font-size: 0.95rem;">${code}</span>
              <span style="font-size: 0.7rem; opacity: 0.8;">${semitones}st</span>
            </div>
            <div style="font-size: 0.75rem; opacity: 0.9; margin: 0.15rem 0 0.35rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
              ${name}
            </div>
            <span class="interval-badge" style="font-size: 0.65rem; background: rgba(0, 0, 0, 0.25); padding: 0.15rem 0.4rem; border-radius: 4px; color: ${stats.accuracyPercent !== null ? '#38bdf8' : '#94a3b8'};">
              ${badgeText}
            </span>
          </button>
        `;
      })
      .join('');
  }

  /**
   * Updates range labels and slider values.
   */
  updateRangeUI() {
    const labelFrom = this.container.querySelector('#label-range-from');
    const labelTo = this.container.querySelector('#label-range-to');
    const sliderFrom = this.container.querySelector('#slider-range-from');
    const sliderTo = this.container.querySelector('#slider-range-to');

    if (labelFrom) {
      labelFrom.textContent = this.rangeFrom;
    }
    if (labelTo) {
      labelTo.textContent = this.rangeTo;
    }
    if (sliderFrom) {
      sliderFrom.value = noteToMidi(this.rangeFrom);
    }
    if (sliderTo) {
      sliderTo.value = noteToMidi(this.rangeTo);
    }
  }

  /**
   * Binds user interaction events.
   */
  bindEvents() {
    // Back button
    const backBtn = this.container.querySelector('#voice-config-back-btn');
    if (backBtn && this.onBack) {
      backBtn.addEventListener('click', () => this.onBack());
    }

    // Presets
    const presetButtons = this.container.querySelectorAll('[data-preset]');
    presetButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const presetId = btn.getAttribute('data-preset');
        const match = RANGE_PRESETS.find((p) => p.id === presetId);
        if (match) {
          this.setRange(match.from, match.to);
        }
      });
    });

    // Sliders
    const sliderFrom = this.container.querySelector('#slider-range-from');
    const sliderTo = this.container.querySelector('#slider-range-to');

    if (sliderFrom && sliderTo) {
      sliderFrom.addEventListener('input', () => {
        let fromMidi = parseInt(sliderFrom.value, 10);
        let toMidi = parseInt(sliderTo.value, 10);
        if (fromMidi > toMidi) {
          sliderTo.value = fromMidi;
          toMidi = fromMidi;
        }
        this.rangeFrom = midiToNote(fromMidi);
        this.rangeTo = midiToNote(toMidi);
        this.savePreferences();
        this.updateRangeUI();
      });

      sliderTo.addEventListener('input', () => {
        let fromMidi = parseInt(sliderFrom.value, 10);
        let toMidi = parseInt(sliderTo.value, 10);
        if (toMidi < fromMidi) {
          sliderFrom.value = toMidi;
          fromMidi = toMidi;
        }
        this.rangeFrom = midiToNote(fromMidi);
        this.rangeTo = midiToNote(toMidi);
        this.savePreferences();
        this.updateRangeUI();
      });
    }

    // Select All Intervals
    const selectAllBtn = this.container.querySelector('#btn-select-all-intervals');
    if (selectAllBtn) {
      selectAllBtn.addEventListener('click', () => {
        this.setEnabledIntervals(Object.keys(INTERVAL_SEMITONES));
      });
    }

    // Intervals Delegation
    const intervalsGrid = this.container.querySelector('#intervals-grid');
    if (intervalsGrid) {
      intervalsGrid.addEventListener('click', (e) => {
        const card = e.target.closest('[data-interval]');
        if (!card) {
          return;
        }

        const code = card.getAttribute('data-interval');
        if (this.enabledIntervals.includes(code)) {
          // Prevent disabling if it's the last remaining interval
          if (this.enabledIntervals.length > 1) {
            this.enabledIntervals = this.enabledIntervals.filter((item) => item !== code);
            card.classList.remove('active');
          }
        } else {
          this.enabledIntervals.push(code);
          card.classList.add('active');
        }

        this.savePreferences();
        this.updateIntervalUI();
      });
    }

    // Question count chips
    const countChips = this.container.querySelectorAll('[data-count]');
    countChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const count = parseInt(chip.getAttribute('data-count'), 10);
        this.questionCount = count;
        countChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.savePreferences();
      });
    });

    // Playback style chips
    const styleChips = this.container.querySelectorAll('[data-style]');
    styleChips.forEach((chip) => {
      chip.addEventListener('click', () => {
        const style = chip.getAttribute('data-style');
        this.playbackStyle = style;
        styleChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        this.savePreferences();
      });
    });

    // Start Drill CTA
    const startBtn = this.container.querySelector('#start-exercise-btn, #start-voice-drill-btn');
    if (startBtn && this.onStart) {
      startBtn.addEventListener('click', () => {
        this.onStart(this.getConfig());
      });
    }
  }

  /**
   * Cleanup resources when view unmounts.
   */
  destroy() {
    this.container.innerHTML = '';
  }
}
