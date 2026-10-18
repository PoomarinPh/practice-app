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
    it('contains ColorMatchingExercise and VoiceTrainingExercise in the active registry', () => {
      expect(exerciseRegistry.length).toBeGreaterThanOrEqual(2);
      const colorEx = getExerciseById('color-matching');
      expect(colorEx).toBeDefined();
      expect(colorEx?.id).toBe('color-matching');

      const voiceEx = getExerciseById('voice-training');
      expect(voiceEx).toBeDefined();
      expect(voiceEx?.id).toBe('voice-training');
      expect(voiceEx?.name).toContain('Voice Training');
    });

    it('returns undefined for non-existent exercise id gracefully', () => {
      expect(getExerciseById('non-existent')).toBeUndefined();
    });
  });

  describe('VoiceTrainingExercise', () => {
    it('exposes vocal metadata and interval schema', () => {
      const voiceEx = getExerciseById('voice-training');
      expect(voiceEx).toBeDefined();
      const schema = voiceEx.getConfigSchema();
      expect(schema.modes).toContain('interval-breakdown');
      expect(schema.intervals).toContain('P5');
      expect(schema.intervals).toContain('m2');
      expect(schema.intervals.length).toBe(12);
      expect(schema.range.min).toBe('C3');
      expect(schema.range.max).toBe('C7');
    });
  });
});

