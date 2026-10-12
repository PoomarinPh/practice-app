/**
 * @fileoverview Unit test suite for modular exercise registry and color matching exercise.
 * Validates BaseExercise lifecycle, question generation, and catalog retrieval.
 */

import { describe, expect, it } from 'vitest';
import { ColorMatchingExercise } from '../src/exercises/color-matching.js';
import { exerciseRegistry, getExerciseById } from '../src/exercises/exercise-registry.js';

describe('Modular Exercise Architecture', () => {
  describe('ColorMatchingExercise', () => {
    const exercise = new ColorMatchingExercise();

    it('exposes standard metadata and config schema', () => {
      expect(exercise.id).toBe('color-matching');
      expect(exercise.name).toBe('Color Matching (HSV)');
      const schema = exercise.getConfigSchema();
      expect(schema.questionCounts).toContain(5);
      expect(schema.modes).toContain('HSV');
      expect(schema.defaultMode).toBe('HSV');
    });

    it('generates questions with valid target color data within bounds', () => {
      const q = exercise.generateQuestion({ mode: 'HSV' });
      expect(q.id).toMatch(/^q_/);
      expect(q.targetColor.h).toBeGreaterThanOrEqual(0);
      expect(q.targetColor.h).toBeLessThan(360);
      expect(q.targetColor.s).toBeGreaterThanOrEqual(0.15);
      expect(q.targetColor.v).toBeGreaterThanOrEqual(0.15);
      expect(q.targetColor.hex).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('evaluates user guesses through standard lifecycle', () => {
      const target = { h: 180, s: 0.8, v: 0.9 };
      const guess = { h: 180, s: 0.8, v: 0.9 };
      const evaluation = exercise.evaluate(target, guess);
      expect(evaluation.score).toBe(100);
      expect(evaluation.isCorrect).toBe(true);
      expect(evaluation.breakdown).toBeDefined();
    });
  });

  describe('exerciseRegistry', () => {
    it('contains ColorMatchingExercise as the initial active exercise', () => {
      expect(exerciseRegistry.length).toBeGreaterThanOrEqual(1);
      const active = getExerciseById('color-matching');
      expect(active).toBeDefined();
      expect(active?.id).toBe('color-matching');
    });

    it('returns undefined for non-existent exercise id gracefully', () => {
      expect(getExerciseById('non-existent')).toBeUndefined();
    });
  });
});
