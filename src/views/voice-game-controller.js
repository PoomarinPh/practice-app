/**
 * @fileoverview VoiceGameController for Screen 3: Active Voice Drill.
 * Manages interval breakdown drills, Web Audio piano playback, dual-note microphone input
 * (Bottom Note & Top Note), YIN pitch detection, cent deviation tuner gauge, and scoring.
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
   * @param {Object} [config={}] - Game configuration { exerciseId, mode, rangeFrom, rangeTo, enabledIntervals, questionCount }.
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
    this.bottomFreq = 261.63;
    this.topFreq = 392.0;

    this.bottomResult = null;
    this.topResult = null;
    this.activeRecordingTarget = null;
    this.isListening = false;

    this.generateQuestion();
    this.render();
    this.startTimer();

    // Automatically play interval chord on initial question mount
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
   * Generates a randomized interval breakdown question within configured vocal range.
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
    this.bottomFreq = noteToFreq(this.bottomNote);
    this.topFreq = noteToFreq(this.topNote);

    this.bottomResult = null;
    this.topResult = null;
    this.activeRecordingTarget = null;
    this.isListening = false;

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
   * Plays isolated reference pitch for specified target note ('bottom' or 'top').
   * @param {'bottom'|'top'} target - Which note to play.
   */
  playTargetPitch(target) {
    const note = target === 'bottom' ? this.bottomNote : this.topNote;
    this.synth.playTone(note, 1.8);
  }

  /**
   * Initiates vocal capture via microphone for a target note ('bottom' or 'top').
   * @param {'bottom'|'top'} target - Target note to record.
   */
  async startRecording(target = 'bottom') {
    if (this.isListening) {
      return;
    }

    this.isListening = true;
    this.activeRecordingTarget = target;

    const singBtn = this.container.querySelector(`#voice-sing-${target}-btn`);
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
        await this.processPitchSamples(samples, target);
      }, totalDurationMs);
    } catch {
      this.isListening = false;
      this.stopRecordingTimer();
      if (singBtn) {
        singBtn.textContent = 'Microphone access denied';
        singBtn.classList.remove('pulse-recording');
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
   * Processes collected vocal pitch frequencies, evaluates accuracy against target note,
   * updates question state, and re-renders UI.
   * @param {number[]} samples - Voiced pitch frequency samples.
   * @param {'bottom'|'top'} [target] - Target note key ('bottom' or 'top').
   */
  async processPitchSamples(samples, target) {
    const activeTarget = target || this.activeRecordingTarget || (this.bottomResult ? 'top' : 'bottom');
    this.isListening = false;
    this.stopRecordingTimer();

    const validSamples = (samples || []).filter((f) => typeof f === 'number' && f > 0);
    if (validSamples.length === 0) {
      const singBtn = this.container.querySelector(`#voice-sing-${activeTarget}-btn`);
      if (singBtn) {
        singBtn.textContent = 'No voice detected. Tap to try again 🎤';
        singBtn.classList.remove('pulse-recording');
      }
      return;
    }

    const detectedPitch = medianFilter(validSamples);
    const targetFreq = activeTarget === 'bottom' ? this.bottomFreq : this.topFreq;
    const targetNote = activeTarget === 'bottom' ? this.bottomNote : this.topNote;

    const evaluation = evaluatePitchAccuracy(detectedPitch, targetFreq);
    const detectedMidi = freqToMidi(detectedPitch);
    const detectedNote = midiToNote(detectedMidi);
    const score = Math.max(0, Math.min(100, Math.round(100 - Math.abs(evaluation.cents))));

    const result = {
      targetNote,
      targetFreq,
      detectedPitch,
      detectedNote,
      evaluation,
      score,
    };

    if (activeTarget === 'bottom') {
      this.bottomResult = result;
    } else {
      this.topResult = result;
    }

    // Playback target reference note so singer can audibly compare
    this.synth.playTone(targetNote, 1.8);

    // If both notes are answered, evaluate overall question correctness
    if (this.bottomResult !== null && this.topResult !== null) {
      // Strict rule: both notes must be in tune; if either note is wrong, question is wrong
      const isCorrect = this.bottomResult.evaluation.isCorrect && this.topResult.evaluation.isCorrect;
      const avgScore = Math.round((this.bottomResult.score + this.topResult.score) / 2);
      const avgCents = Math.round(
        ((Math.abs(this.bottomResult.evaluation.cents) + Math.abs(this.topResult.evaluation.cents)) / 2) * 10
      ) / 10;
      const rating = (this.bottomResult.evaluation.rating === 'flawless' && this.topResult.evaluation.rating === 'flawless')
        ? 'flawless'
        : (isCorrect ? 'in-tune' : 'out-of-tune');

      const questionRecord = {
        questionNumber: this.currentQuestion,
        interval: this.activeInterval,
        bottomNote: this.bottomNote,
        topNote: this.topNote,
        targetNote: `${this.bottomNote} & ${this.topNote}`,
        bottom: this.bottomResult,
        top: this.topResult,
        detectedNote: `${this.bottomResult.detectedNote} / ${this.topResult.detectedNote}`,
        cents: avgCents,
        rating,
        score: avgScore,
        isCorrect,
      };

      const existingIndex = this.questions.findIndex((q) => q.questionNumber === this.currentQuestion);
      if (existingIndex >= 0) {
        this.questions[existingIndex] = questionRecord;
      } else {
        this.questions.push(questionRecord);
      }

      // Record to permanent analytics store
      recordGuess(
        {
          exerciseId: 'voice-training',
          mode: 'interval-breakdown',
          interval: this.activeInterval,
          target: {
            bottomNote: this.bottomNote,
            topNote: this.topNote,
            interval: this.activeInterval,
          },
          guess: {
            bottom: this.bottomResult,
            top: this.topResult,
          },
          score: avgScore,
          isCorrect,
        },
        'interval-breakdown'
      );
    }

    this.render();
  }

  /**
   * Advances to next question or finishes the round.
   */
  nextQuestion() {
    if (this.currentQuestion < this.totalQuestions) {
      if (this.synth && typeof this.synth.stopAll === 'function') {
        this.synth.stopAll();
      }
      this.currentQuestion++;
      this.generateQuestion();
      this.render();
      this.playCurrentInterval();
    } else {
      this.finishSession();
    }
  }

  /**
   * Finishes active voice drill session and triggers onFinish callback.
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
   * Helper rendering tuner gauge HTML for a note evaluation.
   * @param {Object} evaluation - Pitch evaluation { cents, rating, isCorrect }.
   * @returns {string} HTML markup.
   */
  renderTunerGauge(evaluation) {
    const isCorrect = evaluation.isCorrect;
    const rating = evaluation.rating;
    const cents = evaluation.cents;
    const ratingLabel = rating === 'flawless'
      ? '🌟 Flawless Pitch!'
      : rating === 'in-tune'
        ? '🎯 In Tune!'
        : '❌ Off-Pitch';
    const ratingBg = rating === 'flawless'
      ? 'rgba(16, 185, 129, 0.25)'
      : rating === 'in-tune'
        ? 'rgba(56, 189, 248, 0.25)'
        : 'rgba(239, 68, 68, 0.25)';
    const ratingColor = rating === 'flawless'
      ? '#34d399'
      : rating === 'in-tune'
        ? '#38bdf8'
        : '#f87171';
    const needleLeft = Math.max(2, Math.min(98, 50 + (cents / 50) * 50));

    return `
      <div style="text-align: center; margin-bottom: 0.75rem;">
        <span class="badge" style="font-size: 0.95rem; font-weight: 700; padding: 0.3rem 0.8rem; border-radius: 9999px; background: ${ratingBg}; color: ${ratingColor}; border: 1px solid currentColor;">
          ${ratingLabel}
        </span>
      </div>
      <div style="margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: #94a3b8; margin-bottom: 0.25rem;">
          <span>-50c (Flat)</span>
          <span style="font-weight: 700; color: #e2e8f0;">0c Centered</span>
          <span>+50c (Sharp)</span>
        </div>
        <div style="height: 10px; background: rgba(0, 0, 0, 0.5); border-radius: 9999px; position: relative; border: 1px solid rgba(255, 255, 255, 0.15);">
          <div style="position: absolute; left: 38%; width: 24%; height: 100%; background: rgba(16, 185, 129, 0.2); border-radius: 9999px;"></div>
          <div style="position: absolute; left: 50%; top: -2px; bottom: -2px; width: 2px; background: #94a3b8; transform: translateX(-50%);"></div>
          <div style="position: absolute; top: 50%; left: ${needleLeft}%; transform: translate(-50%, -50%); width: 14px; height: 14px; border-radius: 50%; background: ${isCorrect ? '#38bdf8' : '#f87171'}; border: 2px solid #fff; box-shadow: 0 0 8px ${isCorrect ? '#38bdf8' : '#f87171'}; transition: left 0.3s ease;"></div>
        </div>
        <div style="text-align: center; margin-top: 0.4rem; font-weight: 700; font-size: 0.95rem; color: #f8fafc;">
          ${cents >= 0 ? '+' : ''}${cents} cents
          <span style="font-size: 0.8rem; font-weight: 500; color: #94a3b8;">
            ${cents > 0 ? '♯ (Sharp)' : cents < 0 ? '♭ (Flat)' : '(Centered)'}
          </span>
        </div>
      </div>
    `;
  }

  /**
   * Renders the complete voice drill screen with dual Bottom and Top note cards.
   */
  render() {
    const intervalName = INTERVAL_NAMES[this.activeInterval] || this.activeInterval;
    const answeredCount = (this.bottomResult ? 1 : 0) + (this.topResult ? 1 : 0);
    const bothAnswered = this.bottomResult !== null && this.topResult !== null;
    const questionPassed = bothAnswered && this.bottomResult.evaluation.isCorrect && this.topResult.evaluation.isCorrect;

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
            <span class="stat-pill-label">Completion</span>
            <span class="stat-pill-val" style="color: ${bothAnswered ? '#34d399' : '#38bdf8'};">${answeredCount} / 2 Notes</span>
          </div>
        </section>

        <!-- Question Prompt Card -->
        <section class="swatch-viewer-card voice-prompt-card" style="text-align: center; padding: 1.5rem 1rem; margin-bottom: 1rem;">
          <div class="swatch-tag-badge match-badge" style="margin-bottom: 0.5rem; display: inline-block;">
            Interval: ${intervalName} (${this.activeInterval})
          </div>
          <h2 style="font-size: 1.4rem; font-weight: 800; margin: 0.25rem 0 0.5rem; color: #fff;">
            Sing Both Notes (Bottom & Top)
          </h2>
          <p style="font-size: 0.9rem; color: #94a3b8; margin: 0 0 1rem;">
            Listen to the chord, then isolate and sing both the Bottom note and Top note. Both must be in tune to pass!
          </p>
          <div style="display: flex; gap: 0.5rem; justify-content: center;">
            <button id="voice-replay-btn" class="swatch-tool-btn" type="button" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 1.2rem;">
              <span>🔁</span> <span>Replay Chord</span>
            </button>
          </div>
        </section>

        <!-- Dual Note Interaction Cards -->
        <section class="voice-dual-targets" style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.25rem;">
          <!-- 1. Bottom Note Card -->
          <article class="controls-card voice-note-card" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <div>
                <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #38bdf8; letter-spacing: 0.05em; display: block;">
                  Target 1
                </span>
                <span style="font-size: 1.25rem; font-weight: 800; color: #f8fafc;">
                  Bottom Note: <span style="color: #38bdf8;">${this.bottomNote}</span>
                </span>
              </div>
              <button
                id="voice-ref-bottom-btn"
                type="button"
                class="btn btn-secondary btn-sm"
                style="font-size: 0.75rem; padding: 0.35rem 0.75rem; border-radius: 0.4rem; display: flex; align-items: center; gap: 0.35rem;"
              >
                <span>🎵</span> Hear Reference
              </button>
            </div>

            ${this.bottomResult === null ? `
              <div style="text-align: center; padding: 0.75rem 0;">
                <button
                  id="voice-sing-bottom-btn"
                  class="submit-guess-btn voice-target-btn"
                  type="button"
                  style="width: 100%; max-width: 300px; margin: 0 auto; padding: 0.85rem 1.25rem; font-size: 1rem; font-weight: 800; border-radius: 9999px; box-shadow: 0 8px 20px -4px rgba(56, 189, 248, 0.35);"
                >
                  Sing Bottom Note 🎤
                </button>
              </div>
            ` : `
              <div id="tuner-feedback-bottom" class="animate-fade-in">
                ${this.renderTunerGauge(this.bottomResult.evaluation)}
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; text-align: center; background: rgba(0, 0, 0, 0.3); padding: 0.65rem; border-radius: 0.5rem; margin-bottom: 0.75rem;">
                  <div>
                    <span style="font-size: 0.7rem; color: #94a3b8; display: block;">Target</span>
                    <span style="font-size: 1.15rem; font-weight: 800; color: #38bdf8;">${this.bottomNote}</span>
                  </div>
                  <div>
                    <span style="font-size: 0.7rem; color: #94a3b8; display: block;">Your Sung Pitch</span>
                    <span style="font-size: 1.15rem; font-weight: 800; color: ${this.bottomResult.evaluation.isCorrect ? '#34d399' : '#f87171'};">
                      ${this.bottomResult.detectedNote}
                    </span>
                  </div>
                </div>
                <div style="text-align: center;">
                  <button
                    id="voice-resing-bottom-btn"
                    type="button"
                    class="btn btn-secondary btn-sm"
                    style="font-size: 0.8rem; padding: 0.4rem 0.9rem; border-radius: 9999px;"
                  >
                    🔄 Re-sing Bottom Note
                  </button>
                </div>
              </div>
            `}
          </article>

          <!-- 2. Top Note Card -->
          <article class="controls-card voice-note-card" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <div>
                <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #a78bfa; letter-spacing: 0.05em; display: block;">
                  Target 2
                </span>
                <span style="font-size: 1.25rem; font-weight: 800; color: #f8fafc;">
                  Top Note: <span style="color: #a78bfa;">${this.topNote}</span>
                </span>
              </div>
              <button
                id="voice-ref-top-btn"
                type="button"
                class="btn btn-secondary btn-sm"
                style="font-size: 0.75rem; padding: 0.35rem 0.75rem; border-radius: 0.4rem; display: flex; align-items: center; gap: 0.35rem;"
              >
                <span>🎵</span> Hear Reference
              </button>
            </div>

            ${this.topResult === null ? `
              <div style="text-align: center; padding: 0.75rem 0;">
                <button
                  id="voice-sing-top-btn"
                  class="submit-guess-btn voice-target-btn"
                  type="button"
                  style="width: 100%; max-width: 300px; margin: 0 auto; padding: 0.85rem 1.25rem; font-size: 1rem; font-weight: 800; border-radius: 9999px; box-shadow: 0 8px 20px -4px rgba(167, 139, 250, 0.35); background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%);"
                >
                  Sing Top Note 🎤
                </button>
              </div>
            ` : `
              <div id="tuner-feedback-top" class="animate-fade-in">
                ${this.renderTunerGauge(this.topResult.evaluation)}
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; text-align: center; background: rgba(0, 0, 0, 0.3); padding: 0.65rem; border-radius: 0.5rem; margin-bottom: 0.75rem;">
                  <div>
                    <span style="font-size: 0.7rem; color: #94a3b8; display: block;">Target</span>
                    <span style="font-size: 1.15rem; font-weight: 800; color: #a78bfa;">${this.topNote}</span>
                  </div>
                  <div>
                    <span style="font-size: 0.7rem; color: #94a3b8; display: block;">Your Sung Pitch</span>
                    <span style="font-size: 1.15rem; font-weight: 800; color: ${this.topResult.evaluation.isCorrect ? '#34d399' : '#f87171'};">
                      ${this.topResult.detectedNote}
                    </span>
                  </div>
                </div>
                <div style="text-align: center;">
                  <button
                    id="voice-resing-top-btn"
                    type="button"
                    class="btn btn-secondary btn-sm"
                    style="font-size: 0.8rem; padding: 0.4rem 0.9rem; border-radius: 9999px;"
                  >
                    🔄 Re-sing Top Note
                  </button>
                </div>
              </div>
            `}
          </article>
        </section>

        <!-- Gated Navigation / Completion Area -->
        <section class="voice-progression-card" style="margin-top: 0.5rem;">
          ${bothAnswered ? `
            <!-- Question Outcome Banner -->
            <div style="
              text-align: center;
              padding: 0.9rem;
              border-radius: 0.75rem;
              margin-bottom: 1rem;
              background: ${questionPassed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
              border: 1px solid ${questionPassed ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'};
            ">
              <span style="font-size: 1.1rem; font-weight: 800; color: ${questionPassed ? '#34d399' : '#f87171'}; display: block;">
                ${questionPassed ? '🌟 Question Passed! (Both notes in tune)' : '❌ Question Missed! (Both notes must be in tune)'}
              </span>
              <span style="font-size: 0.8rem; color: #cbd5e1; margin-top: 0.25rem; display: block;">
                ${questionPassed ? 'Great pitch accuracy on both harmonic parts.' : 'One or both notes were out of tune (±50c tolerance).'}
              </span>
            </div>

            <!-- Next Question or Finish Button -->
            ${this.currentQuestion < this.totalQuestions ? `
              <button
                id="voice-next-btn"
                type="button"
                class="btn btn-primary"
                style="width: 100%; padding: 0.95rem; font-weight: 800; font-size: 1.05rem; border-radius: 0.75rem;"
              >
                Next Question →
              </button>
            ` : `
              <button
                id="voice-finish-btn"
                type="button"
                class="btn btn-primary"
                style="width: 100%; padding: 0.95rem; font-weight: 800; font-size: 1.05rem; border-radius: 0.75rem; background: linear-gradient(135deg, #10b981 0%, #059669 100%);"
              >
                View Summary 🏆
              </button>
            `}
          ` : `
            <div style="text-align: center; padding: 0.85rem; color: #94a3b8; font-size: 0.9rem; background: rgba(15, 23, 42, 0.5); border-radius: 0.6rem; border: 1px dashed rgba(255, 255, 255, 0.15);">
              ${answeredCount === 1
                ? '⏳ 1 of 2 notes answered. Sing the remaining note to continue!'
                : '👉 Sing both the Bottom Note and Top Note to proceed.'}
            </div>
          `}
        </section>
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

    // Replay Chord
    const replayBtn = this.container.querySelector('#voice-replay-btn');
    if (replayBtn) {
      replayBtn.addEventListener('click', () => {
        this.playCurrentInterval();
      });
    }

    // Reference Pitch Buttons
    const refBottomBtn = this.container.querySelector('#voice-ref-bottom-btn');
    if (refBottomBtn) {
      refBottomBtn.addEventListener('click', () => {
        this.playTargetPitch('bottom');
      });
    }

    const refTopBtn = this.container.querySelector('#voice-ref-top-btn');
    if (refTopBtn) {
      refTopBtn.addEventListener('click', () => {
        this.playTargetPitch('top');
      });
    }

    // Bottom Note Recording
    const singBottomBtn = this.container.querySelector('#voice-sing-bottom-btn');
    if (singBottomBtn) {
      singBottomBtn.addEventListener('click', () => {
        this.startRecording('bottom');
      });
    }

    const resingBottomBtn = this.container.querySelector('#voice-resing-bottom-btn');
    if (resingBottomBtn) {
      resingBottomBtn.addEventListener('click', () => {
        this.startRecording('bottom');
      });
    }

    // Top Note Recording
    const singTopBtn = this.container.querySelector('#voice-sing-top-btn');
    if (singTopBtn) {
      singTopBtn.addEventListener('click', () => {
        this.startRecording('top');
      });
    }

    const resingTopBtn = this.container.querySelector('#voice-resing-top-btn');
    if (resingTopBtn) {
      resingTopBtn.addEventListener('click', () => {
        this.startRecording('top');
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

