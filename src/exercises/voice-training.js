/**
 * @fileoverview Voice Training Exercise (Interval Breakdown).
 * Guides singers and musicians to isolate and sing individual notes within two-note piano intervals.
 * Strictly adheres to Google JavaScript Style Guide and VOICE_DESIGN.md.
 */

import { BaseExercise } from './base-exercise.js';

/**
 * Voice Training: Interval Breakdown Exercise.
 */
export class VoiceTrainingExercise extends BaseExercise {
  /**
   * @type {string}
   */
  id = 'voice-training';

  /**
   * @type {string}
   */
  name = 'Voice Training: Interval Breakdown';

  /**
   * @type {string}
   */
  description = 'Isolate and sing individual notes within two-note piano intervals across your vocal range.';

  /**
   * @type {string}
   */
  icon = '🎙️';

  /**
   * @type {string}
   */
  badge = 'Ready to Play';

  /**
   * @type {boolean}
   */
  isLocked = false;

  /**
   * @type {string}
   */
  category = 'vocal';

  /**
   * @type {string}
   */
  version = '1.0.0';

  /**
   * Returns configuration options and interval schemas supported by Voice Training.
   * @override
   * @returns {{
   *   questionCounts: number[],
   *   defaultCount: number,
   *   modes: string[],
   *   defaultMode: string,
   *   intervals: string[],
   *   range: { from: string, to: string, min: string, max: string }
   * }}
   */
  getConfigSchema() {
    return {
      questionCounts: [1, 5, 10, 15, 20],
      defaultCount: 5,
      modes: ['interval-breakdown'],
      defaultMode: 'interval-breakdown',
      intervals: ['m2', 'M2', 'm3', 'M3', 'P4', 'TT', 'P5', 'm6', 'M6', 'm7', 'M7', 'P8'],
      range: {
        from: 'C3',
        to: 'C5',
        min: 'C3',
        max: 'C7',
      },
    };
  }

  /**
   * Generates a new randomized interval question within the configured vocal bounds.
   * @override
   * @param {Object} [config={}] - Question generation configuration.
   * @returns {{
   *   id: string,
   *   noteA: { note: string, midi: number, freq: number },
   *   noteB: { note: string, midi: number, freq: number },
   *   interval: string,
   *   prompt: 'bottom'|'top',
   *   targetNote: { note: string, midi: number, freq: number },
   *   metadata: Object
   * }}
   */
  generateQuestion(config = {}) {
    const id = `vq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const prompt = Math.random() > 0.5 ? 'top' : 'bottom';

    // Reference stub: C4 (MIDI 60, 261.63 Hz) and G4 (MIDI 67, 392.00 Hz) - Perfect 5th
    const noteA = { note: 'C4', midi: 60, freq: 261.63 };
    const noteB = { note: 'G4', midi: 67, freq: 392.00 };
    const targetNote = prompt === 'top' ? noteB : noteA;

    return {
      id,
      noteA,
      noteB,
      interval: 'P5',
      prompt,
      targetNote,
      metadata: {
        mode: config.mode || 'interval-breakdown',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Evaluates a sung vocal pitch against the target note frequency.
   * @override
   * @param {{ freq: number, note: string }} target - Target note data.
   * @param {{ freq: number }} userGuess - Detected vocal pitch data.
   * @returns {{ score: number, isCorrect: boolean, centDeviation: number, details: Object }}
   */
  evaluate(target, userGuess) {
    if (!userGuess || !userGuess.freq || userGuess.freq <= 0) {
      return {
        score: 0,
        isCorrect: false,
        centDeviation: 999,
        details: { status: 'no_vocal_signal' },
      };
    }

    const centDeviation = Math.round(1200 * Math.log2(userGuess.freq / target.freq));
    const absCents = Math.abs(centDeviation);
    const isCorrect = absCents <= 50;
    const score = Math.max(0, Math.round((1 - absCents / 100) * 100));

    return {
      score,
      isCorrect,
      centDeviation,
      details: {
        targetFreq: target.freq,
        sungFreq: userGuess.freq,
        absCents,
      },
    };
  }
}
