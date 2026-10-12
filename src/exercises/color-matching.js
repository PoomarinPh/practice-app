/**
 * @fileoverview Color Matching Exercise (Exercise 1).
 * Focuses on observing random target colors and matching them using HSV wheel and value bar.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

import { BaseExercise } from './base-exercise.js';
import { evaluateGuess, generateTargetColor } from '../utils/scoring.js';

/**
 * Exercise 1: HSV Color Matching.
 */
export class ColorMatchingExercise extends BaseExercise {
  /**
   * @type {string}
   */
  id = 'color-matching';

  /**
   * @type {string}
   */
  name = 'Color Matching (HSV)';

  /**
   * @type {string}
   */
  description = 'Observe randomized target colors and adjust Hue, Saturation, and Value to recreate them.';

  /**
   * @type {string}
   */
  version = '1.0.0';

  /**
   * Returns configuration options supported by the HSV Color Matching drill.
   * @override
   * @returns {{ questionCounts: number[], defaultCount: number, modes: string[], defaultMode: string }}
   */
  getConfigSchema() {
    return {
      questionCounts: [1, 5, 10, 15, 20],
      defaultCount: 5,
      modes: ['HSV'],
      defaultMode: 'HSV',
    };
  }

  /**
   * Generates a randomized target question within chromatic training bounds.
   * @override
   * @param {Object} [config={}] - Question generation options.
   * @returns {{ id: string, targetColor: Object, metadata: Object }}
   */
  generateQuestion(config = {}) {
    const target = generateTargetColor();
    const id = `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    return {
      id,
      targetColor: target,
      metadata: {
        mode: config.mode || 'HSV',
        generatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Evaluates a user guess against the target color using the multi-channel scoring engine.
   * @override
   * @param {Object} target - The target color { h, s, v }.
   * @param {Object} userGuess - The user guess { h, s, v }.
   * @returns {import('../utils/scoring.js').EvaluationResult}
   */
  evaluate(target, userGuess) {
    return evaluateGuess(target, userGuess);
  }
}
