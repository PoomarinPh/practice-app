/**
 * @fileoverview Base class for all exercises in ChromaSense.
 * Defines the standard lifecycle and interface for modular extensibility.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

/**
 * Abstract Base Exercise class.
 * All specific color exercises (HSV Matching, Grayscale, etc.) extend this class.
 */
export class BaseExercise {
  /**
   * @type {string}
   */
  id = 'base-exercise';

  /**
   * @type {string}
   */
  name = 'Base Exercise';

  /**
   * @type {string}
   */
  description = 'Abstract base exercise';

  /**
   * @type {string}
   */
  version = '1.0.0';

  /**
   * Returns configuration options and mode schemas supported by this exercise.
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
   * Generates a new randomized question for this exercise.
   * @param {Object} [config={}] - Configuration options.
   * @returns {{ id: string, targetColor: Object, metadata: Object }}
   */
  generateQuestion(config = {}) {
    throw new Error('generateQuestion() must be implemented by subclass.');
  }

  /**
   * Evaluates a user guess against a question target color.
   * @param {Object} target - Target color object.
   * @param {Object} userGuess - User guess color object.
   * @returns {{ score: number, isCorrect: boolean, breakdown: Object, details?: Object }}
   */
  evaluate(target, userGuess) {
    throw new Error('evaluate() must be implemented by subclass.');
  }

  /**
   * Mounts exercise-specific UI controls into a container DOM element.
   * @param {HTMLElement} container - DOM container element.
   * @param {Object} state - Current exercise state and callbacks.
   */
  renderPlayControls(container, state) {
    // To be implemented by subclasses or UI views in Phase 2/3
  }
}
