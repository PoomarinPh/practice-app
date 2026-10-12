/**
 * @fileoverview Accuracy scoring and evaluation engine for color observation.
 * Computes individual channel matches (Value, Hue, Saturation) with perceptual weights,
 * provides tunable correctness evaluation, tier grading, and target generation.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

import { hsvToHex, hsvToRgb } from './color.js';

/**
 * Default threshold percentage for considering a guess 'Correct'.
 * @type {number}
 */
export const DEFAULT_CORRECTNESS_THRESHOLD = 85.0;

/**
 * @typedef {Object} ScoreBreakdown
 * @property {number} value - Value accuracy percentage [0, 100].
 * @property {number} hue - Hue accuracy percentage [0, 100].
 * @property {number} saturation - Saturation accuracy percentage [0, 100].
 */

/**
 * @typedef {Object} EvaluationResult
 * @property {number} score - Overall weighted accuracy percentage [0, 100].
 * @property {boolean} isCorrect - Whether the score meets the threshold.
 * @property {ScoreBreakdown} breakdown - Individual channel accuracies.
 * @property {Object} deltas - Raw channel differences.
 */

/**
 * Evaluates a user guess against a target color.
 * Weighting: 40% Value, 35% Hue, 25% Saturation.
 * @param {{ h: number, s: number, v: number }} target - The target HSV color.
 * @param {{ h: number, s: number, v: number }} guess - The user's guessed HSV color.
 * @param {number} [threshold=DEFAULT_CORRECTNESS_THRESHOLD] - Threshold to qualify as correct.
 * @returns {EvaluationResult} Comprehensive evaluation result.
 */
export function evaluateGuess(target, guess, threshold = DEFAULT_CORRECTNESS_THRESHOLD) {
  // 1. Value Accuracy (40% weight)
  const deltaV = Math.abs(target.v - guess.v);
  const accV = Math.max(0, (1.0 - deltaV) * 100);

  // 2. Saturation Accuracy (25% weight)
  const deltaS = Math.abs(target.s - guess.s);
  const accS = Math.max(0, (1.0 - deltaS) * 100);

  // 3. Hue Accuracy (35% weight)
  const diffH = Math.abs(target.h - guess.h);
  const angularDiff = Math.min(diffH, 360 - diffH);

  // Perceptual down-weighting: when saturation or value is low, hue differences are imperceptible
  const perceptualFactor = Math.sqrt(Math.max(0, target.s) * Math.max(0, target.v));
  const effectiveDeltaH = angularDiff * perceptualFactor;
  const accH = Math.max(0, (1.0 - effectiveDeltaH / 180) * 100);

  // 4. Overall Weighted Score
  const rawScore = 0.40 * accV + 0.35 * accH + 0.25 * accS;
  const score = Math.round(rawScore * 10) / 10;
  const isCorrect = score >= threshold;

  return {
    score,
    isCorrect,
    breakdown: {
      value: Math.round(accV * 10) / 10,
      hue: Math.round(accH * 10) / 10,
      saturation: Math.round(accS * 10) / 10,
    },
    deltas: {
      deltaV: Math.round(deltaV * 1000) / 1000,
      deltaS: Math.round(deltaS * 1000) / 1000,
      deltaH: Math.round(angularDiff * 10) / 10,
    },
  };
}

/**
 * @typedef {Object} AccuracyTier
 * @property {string} id - Identifier of tier.
 * @property {string} title - Human-readable tier label.
 * @property {string} emoji - Decorative emoji.
 * @property {string} badgeClass - CSS class name for styling.
 */

/**
 * Returns the descriptive performance tier for an accuracy percentage.
 * @param {number} score - Overall accuracy score [0, 100].
 * @returns {AccuracyTier} The tier metadata.
 */
export function getAccuracyTier(score) {
  if (score >= 96.0) {
    return {
      id: 'master',
      title: 'Master Eye',
      emoji: '🌟',
      badgeClass: 'tier-master',
    };
  }
  if (score >= 90.0) {
    return {
      id: 'excellent',
      title: 'Excellent Match',
      emoji: '🎯',
      badgeClass: 'tier-excellent',
    };
  }
  if (score >= 85.0) {
    return {
      id: 'solid',
      title: 'Solid Match',
      emoji: '👍',
      badgeClass: 'tier-solid',
    };
  }
  return {
    id: 'adjust',
    title: 'Needs Adjustment',
    emoji: '❌',
    badgeClass: 'tier-adjust',
  };
}

/**
 * Generates a randomized target color within training bounds.
 * Bounds: S in [0.15, 1.0], V in [0.15, 1.0] to prevent degenerate near-black/gray targets.
 * @returns {{ h: number, s: number, v: number, rgb: {r: number, g: number, b: number}, hex: string }}
 */
export function generateTargetColor() {
  const h = Math.floor(Math.random() * 360);
  const s = Math.round((0.15 + Math.random() * 0.85) * 100) / 100;
  const v = Math.round((0.15 + Math.random() * 0.85) * 100) / 100;

  const hsv = { h, s, v };
  const rgb = hsvToRgb(hsv);
  const hex = hsvToHex(hsv);

  return {
    h,
    s,
    v,
    rgb,
    hex,
  };
}
