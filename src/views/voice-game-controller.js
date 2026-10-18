/**
 * @fileoverview VoiceGameController for Screen 3: Active Voice Drill.
 * Manages interval breakdown drills, Web Audio piano playback, microphone input,
 * YIN pitch detection, real-time cent deviation tuner gauge, and scoring.
 * Strictly adheres to Google JavaScript Style Guide and VOICE_DESIGN.md.
 */

import { PianoSynth } from '../utils/audio/piano-synth.js';
import { PitchDetector, evaluatePitchAccuracy, medianFilter } from '../utils/audio/pitch-detector.js';
import {
  INTERVAL_SEMITONES,
  INTERVAL_NAMES,
  noteToMidi,
  midiToNote,
  noteToFreq,
  freqToMidi,
} from '../utils/audio/notes.js';
import { recordGuess, recordSession } from '../utils/storage.js';

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

export class VoiceGameController {
  /**
   * @param {HTMLElement} container - DOM mount container.
   * @param {Object} [config={}] - Game configuration { exerciseId, mode, rangeFrom, rangeTo, enabledIntervals, questionCount, playbackStyle }.
   * @param {Object|Function} [callbacks={}] - Callbacks { onExit, onFinish } or exit function.
   * @param {Object} [dependencies={}] - Injected test dependencies { synth, detector }.
   */
  constructor(container, config = {}, callbacks = {}, dependencies = {}) {
    this.container = container;
    this.config = {
      exerciseId: 'voice-training',
      mode: 'interval-breakdown',
      rangeFrom: 'C3',
      rangeTo: 'C5',
      enabledIntervals: Object.keys(INTERVAL_SEMITONES),
      questionCount: 5,
      playbackStyle: 'harmonic',
      ...config,
    };

    if (typeof callbacks === 'function') {
      this.onExit = callbacks;
      this.onFinish = null;
    } else {
      this.onExit = callbacks?.onExit || null;
      this.onFinish = callbacks?.onFinish || null;
    }

    this.synth = dependencies.synth || new PianoSynth();
    this.detector = dependencies.detector || new PitchDetector();

    this.currentQuestion = 1;
    this.totalQuestions = this.config.questionCount || 5;
    this.questions = [];

    this.startTime = Date.now();
    this.timerInterval = null;
    this.recordingInterval = null;
    this.recordingTimeout = null;

    this.activeInterval = 'P5';
    this.bottomNote = 'C4';
    this.topNote = 'G4';
    this.prompt = 'top'; // 'bottom' | 'top'
    this.targetNote = 'G4';
    this.targetFreq = 392.0;

    this.isListening = false;
    this.hasAnswered = false;
    this.lastResult = null;

    this.generateQuestion();
    this.render();
    this.startTimer();

    // Automatically play interval on initial question mount
    this.playCurrentInterval();
  }

  /**
   * Starts elapsed round timer.
   */
  startTimer() {
    this.timerInterval = window.setInterval(() => {
      const timerEl = this.container.querySelector('#voice-elapsed-timer');
      if (timerEl) {
        timerEl.textContent = `⏱ ${formatElapsed(Date.now() - this.startTime)}`;
      }
    }, 100);
  }

  /**
   * Generates a randomized interval breakdown question within configured range.
   */
  generateQuestion() {
    const intervals = Array.isArray(this.config.enabledIntervals) && this.config.enabledIntervals.length > 0
      ? this.config.enabledIntervals
      : ['P5'];

    this.activeInterval = intervals[Math.floor(Math.random() * intervals.length)] || 'P5';
    const semitones = INTERVAL_SEMITONES[this.activeInterval] || 7;

    const minMidi = noteToMidi(this.config.rangeFrom || 'C3');
    const maxMidi = noteToMidi(this.config.rangeTo || 'C5');

    let bottomMidi;
    if (maxMidi - semitones < minMidi) {
      bottomMidi = minMidi;
    } else {
      bottomMidi = minMidi + Math.floor(Math.random() * (maxMidi - semitones - minMidi + 1));
    }

    const topMidi = bottomMidi + semitones;
    this.bottomNote = midiToNote(bottomMidi);
    this.topNote = midiToNote(topMidi);

    this.prompt = Math.random() < 0.5 ? 'bottom' : 'top';
    this.targetNote = this.prompt === 'bottom' ? this.bottomNote : this.topNote;
    this.targetFreq = noteToFreq(this.targetNote);

    this.hasAnswered = false;
    this.isListening = false;
    this.lastResult = null;

    if (this.synth && typeof this.synth.preloadNotes === 'function') {
      this.synth.preloadNotes([this.bottomNote, this.topNote]);
    }
  }

  /**
   * Plays the two-note interval simultaneously as a harmonic chord.
   */
  playCurrentInterval() {
    this.synth.playChord([this.bottomNote, this.topNote], 2.2);
  }

  /**
   * Plays the isolated target reference pitch.
   */
  playTargetPitch() {
    this.synth.playTone(this.targetNote, 1.8);
  }

  /**
   * Initiates vocal capture via microphone.
   */
  async startRecording() {
    if (this.isListening || this.hasAnswered) {
      return;
    }

    this.isListening = true;
    const singBtn = this.container.querySelector('#voice-sing-cta');
    if (singBtn) {
      singBtn.textContent = 'Listening... 🔴 Sing now!';
      singBtn.classList.add('pulse-recording');
    }

    try {
      await this.detector.startMicrophone();
      const samples = [];
      const sampleIntervalMs = 40;
      const totalDurationMs = 1600;

      this.recordingInterval = window.setInterval(() => {
        const result = this.detector.sampleCurrentPitch();
        if (result.isVoiced && result.pitch && result.clarity > 0.6) {
          samples.push(result.pitch);
        }
      }, sampleIntervalMs);

      this.recordingTimeout = window.setTimeout(async () => {
        this.stopRecordingTimer();
        await this.processPitchSamples(samples);
      }, totalDurationMs);
    } catch {
      this.isListening = false;
      this.stopRecordingTimer();
      if (singBtn) {
        singBtn.textContent = 'Microphone access denied';
      }
    }
  }

  /**
   * Clears active recording timers and stops detector stream.
   */
  stopRecordingTimer() {
    if (this.recordingInterval) {
      clearInterval(this.recordingInterval);
      this.recordingInterval = null;
    }
    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }
    this.detector.stop();
  }

  /**
   * Processes collected vocal pitch frequencies, evaluates accuracy, and updates UI.
   * @param {number[]} samples - Voiced pitch frequency samples.
   */
  async processPitchSamples(samples) {
    this.isListening = false;
    this.stopRecordingTimer();

    const validSamples = (samples || []).filter((f) => typeof f === 'number' && f > 0);
    if (validSamples.length === 0) {
      const singBtn = this.container.querySelector('#voice-sing-cta');
      if (singBtn) {
        singBtn.textContent = 'No voice detected. Tap to try again 🎤';
        singBtn.classList.remove('pulse-recording');
      }
      return;
    }

    const detectedPitch = medianFilter(validSamples);
    const evaluation = evaluatePitchAccuracy(detectedPitch, this.targetFreq);
    const detectedMidi = freqToMidi(detectedPitch);
    const detectedNote = midiToNote(detectedMidi);
    const score = Math.max(0, Math.min(100, Math.round(100 - Math.abs(evaluation.cents))));

    this.hasAnswered = true;
    this.lastResult = {
      detectedPitch,
      detectedNote,
      evaluation,
      score,
    };

    // Record into permanent storage
    recordGuess(
      {
        exerciseId: 'voice-training',
        mode: 'interval-breakdown',
        interval: this.activeInterval,
        target: {
          note: this.targetNote,
          freq: this.targetFreq,
          interval: this.activeInterval,
          prompt: this.prompt,
        },
        guess: {
          note: detectedNote,
          freq: detectedPitch,
          cents: evaluation.cents,
        },
        score,
        isCorrect: evaluation.isCorrect,
      },
      'interval-breakdown'
    );

    // Save locally for session summary
    this.questions.push({
      questionNumber: this.currentQuestion,
      interval: this.activeInterval,
      prompt: this.prompt,
      targetNote: this.targetNote,
      targetFreq: this.targetFreq,
      detectedPitch,
      detectedNote,
      cents: evaluation.cents,
      rating: evaluation.rating,
      score,
      isCorrect: evaluation.isCorrect,
    });

    // Playback target reference note so user can compare
    this.playTargetPitch();

    // Re-render to display cent tuner dial card
    this.render();
  }

  /**
   * Advances to the next question or finishes the session.
   */
  nextQuestion() {
    if (this.currentQuestion < this.totalQuestions) {
      this.currentQuestion++;
      this.generateQuestion();
      this.render();
      this.playCurrentInterval();
    } else {
      this.finishSession();
    }
  }

  /**
   * Finishes the active voice drill session and dispatches onFinish callback.
   */
  finishSession() {
    this.destroy();

    const correctCount = this.questions.filter((q) => q.isCorrect).length;
    const accuracyPercent = this.totalQuestions > 0
      ? Math.round((correctCount / this.totalQuestions) * 1000) / 10
      : 0;

    const sessionData = {
      exerciseId: 'voice-training',
      mode: 'interval-breakdown',
      totalQuestions: this.totalQuestions,
      correctCount,
      accuracyPercent,
      questions: [...this.questions],
      elapsedMs: Date.now() - this.startTime,
    };

    recordSession(sessionData);

    if (this.onFinish) {
      this.onFinish(sessionData);
    }
  }

  /**
   * Renders the complete voice drill screen.
   */
  render() {
    const intervalName = INTERVAL_NAMES[this.activeInterval] || this.activeInterval;
    const promptText = this.prompt === 'bottom' ? 'Sing the BOTTOM Note' : 'Sing the TOP Note';

    this.container.innerHTML = `
      <header class="app-header">
        <button id="voice-exit-btn" class="game-exit-btn" type="button" aria-label="Exit Game">
          ← Exit
        </button>
        <div class="brand-badge">
          <span class="brand-dot" style="background: #38bdf8;"></span>
          <span class="brand-title">ChromaSense Voice</span>
        </div>
        <div id="voice-elapsed-timer" class="timer-badge">
          ⏱ ${formatElapsed(Date.now() - this.startTime)}
        </div>
      </header>

      <main class="interactive-container voice-container animate-fade-in" style="max-width: 640px; margin: 0 auto; padding: 1rem;">
        <!-- Top Stats Banner -->
        <section class="stats-banner-card" style="margin-bottom: 1rem;">
          <div class="stat-pill">
            <span class="stat-pill-label">Progress</span>
            <span id="voice-stat-progress" class="stat-pill-val">Q ${this.currentQuestion} / ${this.totalQuestions}</span>
          </div>
          <div class="stat-pill">
            <span class="stat-pill-label">Interval</span>
            <span class="stat-pill-val highlight-acc">${this.activeInterval}</span>
          </div>
          <div class="stat-pill">
            <span class="stat-pill-label">Target Prompt</span>
            <span class="stat-pill-val" style="text-transform: capitalize;">${this.prompt} Note</span>
          </div>
        </section>

        <!-- Question Prompt Card -->
        <section class="swatch-viewer-card voice-prompt-card" style="text-align: center; padding: 1.5rem 1rem; margin-bottom: 1rem;">
          <div class="swatch-tag-badge match-badge" style="margin-bottom: 0.5rem; display: inline-block;">
            Interval: ${intervalName} (${this.activeInterval})
          </div>
          <h2 style="font-size: 1.4rem; font-weight: 800; margin: 0.25rem 0 0.5rem; color: #fff;">
            ${promptText}
          </h2>
          <p style="font-size: 0.9rem; color: #94a3b8; margin: 0 0 1rem;">
            Listen to both notes, isolate the harmonic pitch, and sing the ${this.prompt} note.
          </p>
          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            <button id="voice-replay-btn" class="swatch-tool-btn" type="button" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.2rem;">
              <span>🔁</span> <span>Replay Notes</span>
            </button>
            ${this.hasAnswered ? `
              <button id="voice-hear-target-btn" class="swatch-tool-btn" type="button" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.2rem; border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;">
                <span>🎵</span> <span>Hear Target (${this.targetNote})</span>
              </button>
            ` : ''}
          </div>
        </section>

        <!-- Center Interaction Area: Mic or Tuner Feedback -->
        ${!this.hasAnswered ? `
          <section class="controls-card voice-mic-card" style="text-align: center; padding: 2.25rem 1rem; margin-bottom: 1rem;">
            <div style="font-size: 3rem; margin-bottom: 0.75rem; animation: float 3s ease-in-out infinite;">🎙️</div>
            <p style="font-size: 0.95rem; color: #cbd5e1; margin-bottom: 1.5rem;">
              Tap below to capture a 1.5-second vocal note into your microphone.
            </p>
            <button
              id="voice-sing-cta"
              class="submit-guess-btn"
              type="button"
              style="max-width: 320px; margin: 0 auto; padding: 1rem 1.5rem; font-size: 1.1rem; font-weight: 800; border-radius: 9999px; box-shadow: 0 10px 25px -5px rgba(56, 189, 248, 0.4);"
            >
              Tap to Sing 🎤
            </button>
          </section>
        ` : `
          <!-- Tuner Feedback Card -->
          <section id="voice-tuner-card" class="controls-card animate-fade-in" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; padding: 1.5rem; margin-bottom: 1rem;">
            <!-- Rating Badge -->
            <div style="text-align: center; margin-bottom: 1rem;">
              <span class="voice-rating-badge badge" style="
                font-size: 1.1rem;
                font-weight: 800;
                padding: 0.4rem 1rem;
                border-radius: 9999px;
                display: inline-block;
                background: ${this.lastResult.evaluation.rating === 'flawless'
                  ? 'rgba(16, 185, 129, 0.25)'
                  : this.lastResult.evaluation.rating === 'in-tune'
                    ? 'rgba(56, 189, 248, 0.25)'
                    : 'rgba(239, 68, 68, 0.25)'};
                color: ${this.lastResult.evaluation.rating === 'flawless'
                  ? '#34d399'
                  : this.lastResult.evaluation.rating === 'in-tune'
                    ? '#38bdf8'
                    : '#f87171'};
                border: 1px solid currentColor;
              ">
                ${this.lastResult.evaluation.rating === 'flawless'
                  ? '🌟 Flawless Pitch!'
                  : this.lastResult.evaluation.rating === 'in-tune'
                    ? '🎯 In Tune!'
                    : '❌ Off-Pitch'}
              </span>
            </div>

            <!-- Visual Cent Deviation Tuner Gauge -->
            <div style="margin-bottom: 1.25rem;">
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.35rem;">
                <span>-50c (Flat)</span>
                <span style="font-weight: 700; color: #e2e8f0;">0c Centered</span>
                <span>+50c (Sharp)</span>
              </div>
              <div style="height: 12px; background: rgba(0, 0, 0, 0.5); border-radius: 9999px; position: relative; overflow: visible; border: 1px solid rgba(255, 255, 255, 0.15);">
                <!-- Center In-Tune Target Band -->
                <div style="position: absolute; left: 38%; width: 24%; height: 100%; background: rgba(16, 185, 129, 0.2); border-radius: 9999px;"></div>
                <!-- Center zero line -->
                <div style="position: absolute; left: 50%; top: -3px; bottom: -3px; width: 2px; background: #94a3b8; transform: translateX(-50%);"></div>
                <!-- Needle Dot -->
                <div style="
                  position: absolute;
                  top: 50%;
                  left: ${Math.max(2, Math.min(98, 50 + (this.lastResult.evaluation.cents / 50) * 50))}%;
                  transform: translate(-50%, -50%);
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: ${this.lastResult.evaluation.isCorrect ? '#38bdf8' : '#f87171'};
                  box-shadow: 0 0 10px ${this.lastResult.evaluation.isCorrect ? '#38bdf8' : '#f87171'};
                  border: 2px solid #fff;
                  transition: left 0.4s ease;
                "></div>
              </div>
              <div id="tuner-cents-value" style="text-align: center; margin-top: 0.5rem; font-weight: 700; font-size: 1.1rem; color: #f8fafc;">
                ${this.lastResult.evaluation.cents >= 0 ? '+' : ''}${this.lastResult.evaluation.cents} cents
                <span style="font-size: 0.85rem; font-weight: 500; color: #94a3b8;">
                  ${this.lastResult.evaluation.cents > 0 ? '♯ (Sharp)' : this.lastResult.evaluation.cents < 0 ? '♭ (Flat)' : '(Centered)'}
                </span>
              </div>
            </div>

            <!-- Target vs Sung Comparison Row -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; text-align: center; background: rgba(0, 0, 0, 0.3); padding: 0.85rem; border-radius: 0.6rem; margin-bottom: 1.25rem;">
              <div>
                <span style="font-size: 0.75rem; color: #94a3b8; display: block; margin-bottom: 0.2rem;">Target Note</span>
                <span style="font-size: 1.4rem; font-weight: 800; color: #38bdf8;">${this.targetNote}</span>
              </div>
              <div>
                <span style="font-size: 0.75rem; color: #94a3b8; display: block; margin-bottom: 0.2rem;">Your Sung Pitch</span>
                <span style="font-size: 1.4rem; font-weight: 800; color: ${this.lastResult.evaluation.isCorrect ? '#34d399' : '#f87171'};">${this.lastResult.detectedNote}</span>
              </div>
            </div>

            <!-- Navigation Button -->
            ${this.currentQuestion < this.totalQuestions ? `
              <button
                id="voice-next-btn"
                type="button"
                class="btn btn-primary"
                style="width: 100%; padding: 0.85rem; font-weight: 800; font-size: 1.05rem; border-radius: 0.6rem;"
              >
                Next Note →
              </button>
            ` : `
              <button
                id="voice-finish-btn"
                type="button"
                class="btn btn-primary"
                style="width: 100%; padding: 0.85rem; font-weight: 800; font-size: 1.05rem; border-radius: 0.6rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%);"
              >
                View Summary 🏆
              </button>
            `}
          </section>
        `}
      </main>
    `;

    this.bindEvents();
  }

  /**
   * Binds UI events.
   */
  bindEvents() {
    // Exit
    const exitBtn = this.container.querySelector('#voice-exit-btn');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        this.destroy();
        if (this.onExit) {
          this.onExit();
        }
      });
    }

    // Replay
    const replayBtn = this.container.querySelector('#voice-replay-btn');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        this.playCurrentInterval();
      });
    }

    // Hear Target
    const hearTargetBtn = this.container.querySelector('#voice-hear-target-btn');
    if (hearTargetBtn) {
      hearTargetBtn.addEventListener('click', () => {
        this.playTargetPitch();
      });
    }

    // Sing Mic Trigger
    const singBtn = this.container.querySelector('#voice-sing-cta');
    if (singBtn) {
      singBtn.addEventListener('click', () => {
        this.startRecording();
      });
    }

    // Next Question
    const nextBtn = this.container.querySelector('#voice-next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        this.nextQuestion();
      });
    }

    // Finish Round
    const finishBtn = this.container.querySelector('#voice-finish-btn');
    if (finishBtn) {
      finishBtn.addEventListener('click', () => {
        this.finishSession();
      });
    }
  }

  /**
   * Cleans up timers, audio contexts, and DOM elements.
   */
  destroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
    this.stopRecordingTimer();
    this.container.innerHTML = '';
  }
}
