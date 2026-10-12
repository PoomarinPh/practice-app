/**
 * @fileoverview Central registry and catalog for ChromaSense exercises.
 * Facilitates dropping in new exercise types without changing core app plumbing.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

import { ColorMatchingExercise } from './color-matching.js';

/**
 * Active catalog of registered exercises.
 * @type {import('./base-exercise.js').BaseExercise[]}
 */
export const exerciseRegistry = [
  new ColorMatchingExercise(),
];

/**
 * Retrieves a registered exercise instance by its identifier.
 * @param {string} id - The unique exercise identifier.
 * @returns {import('./base-exercise.js').BaseExercise|undefined} The matching exercise.
 */
export function getExerciseById(id) {
  return exerciseRegistry.find((exercise) => exercise.id === id);
}
