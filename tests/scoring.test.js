/**
 * @fileoverview Unit test suite for multi-channel accuracy scoring and evaluation engine.
 * Validates channel breakdown, perceptual weighting, thresholding, and tier classifications.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CORRECTNESS_THRESHOLD,
  evaluateGuess,
  generateTargetColor,
  getAccuracyTier,
} from '../src/utils/scoring.js';

describe('Scoring & Accuracy Engine', () => {
  describe('evaluateGuess()', () => {
    it('awards 100% score and all perfect breakdowns for an exact match', () => {
      const target = { h: 210, s: 0.65, v: 0.82 };
      const guess = { h: 210, s: 0.65, v: 0.82 };

      const result = evaluateGuess(target, guess);

      expect(result.score).toBe(100);
      expect(result.isCorrect).toBe(true);
      expect(result.breakdown.value).toBe(100);
      expect(result.breakdown.hue).toBe(100);
      expect(result.breakdown.saturation).toBe(100);
    });

    it('correctly assesses a pure Value mismatch while hue and saturation match', () => {
      const target = { h: 180, s: 1.0, v: 1.0 };
      const guess = { h: 180, s: 1.0, v: 0.8 }; // Delta V = 0.2 => Acc_V = 80%

      const result = evaluateGuess(target, guess);

      expect(result.breakdown.value).toBe(80);
      expect(result.breakdown.hue).toBe(100);
      expect(result.breakdown.saturation).toBe(100);
      // Overall = 0.40 * 80 + 0.35 * 100 + 0.25 * 100 = 32 + 35 + 25 = 92%
      expect(result.score).toBe(92);
      expect(result.isCorrect).toBe(true);
    });

    it('down-weights hue difference for desaturated colors', () => {
      // Very desaturated color (s = 0.1, v = 0.5)
      const target = { h: 0, s: 0.1, v: 0.5 };
      // 90 degree hue error
      const guess = { h: 90, s: 0.1, v: 0.5 };

      const result = evaluateGuess(target, guess);

      // Hue error should not penalize as heavily as for a pure saturated color
      expect(result.breakdown.hue).toBeGreaterThan(70);
    });

    it('respects the default correctness threshold of 85%', () => {
      expect(DEFAULT_CORRECTNESS_THRESHOLD).toBe(85.0);

      // Near 85%
      const target = { h: 100, s: 0.8, v: 0.8 };
      const passingGuess = { h: 105, s: 0.78, v: 0.75 };
      const failingGuess = { h: 180, s: 0.2, v: 0.2 };

      expect(evaluateGuess(target, passingGuess).isCorrect).toBe(true);
      expect(evaluateGuess(target, failingGuess).isCorrect).toBe(false);
    });

    it('allows overriding the correctness threshold', () => {
      const target = { h: 100, s: 0.8, v: 0.8 };
      const guess = { h: 110, s: 0.7, v: 0.7 }; // yields score around 85-88%

      const defaultEvaluation = evaluateGuess(target, guess, 80.0);
      expect(defaultEvaluation.isCorrect).toBe(true);

      const strictEvaluation = evaluateGuess(target, guess, 95.0);
      expect(strictEvaluation.isCorrect).toBe(false);
    });
  });

  describe('getAccuracyTier()', () => {
    it('classifies scores into appropriate performance tiers', () => {
      expect(getAccuracyTier(98.5).title).toBe('Master Eye');
      expect(getAccuracyTier(92.0).title).toBe('Excellent Match');
      expect(getAccuracyTier(86.4).title).toBe('Solid Match');
      expect(getAccuracyTier(78.0).title).toBe('Needs Adjustment');
    });
  });

  describe('generateTargetColor()', () => {
    it('generates random target colors within training bounds', () => {
      for (let i = 0; i < 50; i++) {
        const target = generateTargetColor();
        expect(target.h).toBeGreaterThanOrEqual(0);
        expect(target.h).toBeLessThan(360);
        expect(target.s).toBeGreaterThanOrEqual(0.15);
        expect(target.s).toBeLessThanOrEqual(1.0);
        expect(target.v).toBeGreaterThanOrEqual(0.15);
        expect(target.v).toBeLessThanOrEqual(1.0);
        expect(typeof target.hex).toBe('string');
        expect(target.hex).toMatch(/^#[0-9a-f]{6}$/);
      }
    });
  });
});
