/**
 * @fileoverview Unit test suite for storage service, data persistence, and analytics queries.
 * Validates schema initialization, monotonic lifetime counters, FIFO bounded history,
 * rolling time-window queries, mode isolation, in-memory fallback, and export/import.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearAllData,
  exportDataJson,
  getAccuracyStats,
  getDataStore,
  getModeStatsSummary,
  importDataJson,
  MAX_HISTORY_ITEMS,
  recordGuess,
  STORAGE_KEY,
} from '../src/utils/storage.js';

describe('Storage Service & Analytics Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    clearAllData();
  });

  describe('Initialization and Schema Defaults', () => {
    it('initializes default schema structure when storage is empty', () => {
      const store = getDataStore();
      expect(store.version).toBe(1);
      expect(store.stats.totalQuestions).toBe(0);
      expect(store.stats.totalCorrect).toBe(0);
      expect(store.stats.totalWrong).toBe(0);
      expect(store.history).toEqual([]);
      expect(store.settings.accuracyThreshold).toBe(85.0);
    });

    it('recovers gracefully from corrupted JSON in localStorage', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid-json{{{');
      const store = getDataStore();
      expect(store.version).toBe(1);
      expect(store.stats.totalQuestions).toBe(0);
    });
  });

  describe('recordGuess() and Monotonic Counters', () => {
    it('increments totalCorrect, totalQuestions, and updates averages', () => {
      const correctGuess = {
        exerciseId: 'color-matching',
        mode: 'HSV',
        target: { h: 200, s: 0.5, v: 0.8, hex: '#000000' },
        guess: { h: 200, s: 0.5, v: 0.8, hex: '#000000' },
        score: 100,
        breakdown: { value: 100, hue: 100, saturation: 100 },
        isCorrect: true,
      };

      recordGuess(correctGuess);

      const store = getDataStore();
      expect(store.stats.totalQuestions).toBe(1);
      expect(store.stats.totalCorrect).toBe(1);
      expect(store.stats.totalWrong).toBe(0);
      expect(store.stats.averageAccuracy).toBe(100);
      expect(store.stats.modeStats.HSV.totalCorrect).toBe(1);
    });

    it('records wrong guesses and updates accuracy percentages', () => {
      recordGuess({
        exerciseId: 'color-matching',
        mode: 'HSV',
        score: 60,
        isCorrect: false,
        breakdown: { value: 60, hue: 60, saturation: 60 },
      });

      const store = getDataStore();
      expect(store.stats.totalQuestions).toBe(1);
      expect(store.stats.totalCorrect).toBe(0);
      expect(store.stats.totalWrong).toBe(1);
      expect(store.stats.averageAccuracy).toBe(60);
    });

    it('records timeSeconds only for correct answers and computes averageCorrectTime', () => {
      // First attempt: correct in 10 seconds
      recordGuess({
        mode: 'HSV',
        score: 95,
        isCorrect: true,
        timeSeconds: 10.0,
        breakdown: { value: 95, hue: 95, saturation: 95 },
      });

      // Second attempt: wrong in 25 seconds (should NOT be added to correct time)
      recordGuess({
        mode: 'HSV',
        score: 60,
        isCorrect: false,
        timeSeconds: 25.0,
        breakdown: { value: 60, hue: 60, saturation: 60 },
      });

      // Third attempt: correct in 6 seconds
      recordGuess({
        mode: 'HSV',
        score: 90,
        isCorrect: true,
        timeSeconds: 6.0,
        breakdown: { value: 90, hue: 90, saturation: 90 },
      });

      const store = getDataStore();
      // Only the 2 correct guesses (10s + 6s) are averaged => 16 / 2 = 8.0s
      expect(store.stats.averageCorrectTime).toBe(8.0);
      expect(store.stats.modeStats.HSV.averageCorrectTime).toBe(8.0);

      // Verify wrong item does not record timeSeconds in history
      const wrongItem = store.history.find((i) => !i.isCorrect);
      expect(wrongItem.timeSeconds).toBeUndefined();

      // Check stats summary
      const stats = getAccuracyStats(null, 'HSV');
      expect(stats.averageCorrectTime).toBe(8.0);
    });
  });

  describe('Mode Isolation', () => {
    it('isolates mode metrics so HSV stats do not bleed into other modes', () => {
      recordGuess({ mode: 'HSV', score: 90, isCorrect: true, breakdown: { value: 90, hue: 90, saturation: 90 } });
      recordGuess({ mode: 'RGB', score: 70, isCorrect: false, breakdown: { value: 70, hue: 70, saturation: 70 } });

      const store = getDataStore();
      expect(store.stats.modeStats.HSV.totalQuestions).toBe(1);
      expect(store.stats.modeStats.HSV.totalCorrect).toBe(1);
      expect(store.stats.modeStats.RGB.totalQuestions).toBe(1);
      expect(store.stats.modeStats.RGB.totalWrong).toBe(1);
    });
  });

  describe('FIFO History Bounding & Quota Protection', () => {
    it('caps history to MAX_HISTORY_ITEMS while preserving lifetime counters', () => {
      // Record MAX_HISTORY_ITEMS + 5 attempts
      const totalToRecord = MAX_HISTORY_ITEMS + 5;
      for (let i = 0; i < totalToRecord; i++) {
        recordGuess({
          id: `test_${i}`,
          mode: 'HSV',
          score: 90,
          isCorrect: true,
          breakdown: { value: 90, hue: 90, saturation: 90 },
        });
      }

      const store = getDataStore();
      expect(store.history.length).toBe(MAX_HISTORY_ITEMS);
      // Permanent lifetime counter is not pruned
      expect(store.stats.totalQuestions).toBe(totalToRecord);
      expect(store.stats.modeStats.HSV.totalQuestions).toBe(totalToRecord);
      // FIFO eviction: earliest IDs pruned, latest remains
      expect(store.history[store.history.length - 1].id).toBe(`test_${totalToRecord - 1}`);
    });
  });

  describe('getAccuracyStats() and Rolling 7-Day Window', () => {
    it('calculates 7-day rolling window correctly and excludes old records', () => {
      const now = Date.now();
      const oneDayAgo = new Date(now - 1 * 24 * 60 * 60 * 1000).toISOString();
      const threeDaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
      const tenDaysAgo = new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString();

      recordGuess({ mode: 'HSV', score: 95, isCorrect: true, timestamp: oneDayAgo, breakdown: { value: 95, hue: 95, saturation: 95 } });
      recordGuess({ mode: 'HSV', score: 85, isCorrect: true, timestamp: threeDaysAgo, breakdown: { value: 85, hue: 85, saturation: 85 } });
      recordGuess({ mode: 'HSV', score: 50, isCorrect: false, timestamp: tenDaysAgo, breakdown: { value: 50, hue: 50, saturation: 50 } });

      const past7Days = getAccuracyStats(7, 'HSV');
      expect(past7Days.totalGuesses).toBe(2);
      expect(past7Days.correct).toBe(2);
      expect(past7Days.wrong).toBe(0);
      expect(past7Days.accuracyPercent).toBe(100);

      const allTime = getAccuracyStats(null, 'HSV');
      expect(allTime.totalGuesses).toBe(3);
      expect(allTime.correct).toBe(2);
      expect(allTime.wrong).toBe(1);
    });

    it('generates mode summary for UI landing cards', () => {
      recordGuess({ mode: 'HSV', score: 90, isCorrect: true, breakdown: { value: 90, hue: 90, saturation: 90 } });
      const summary = getModeStatsSummary(['HSV']);
      expect(summary.HSV).toBeDefined();
      expect(summary.HSV.allTime.totalGuesses).toBe(1);
      expect(summary.HSV.past7Days.totalGuesses).toBe(1);
    });
  });

  describe('Export and Import JSON backup', () => {
    it('exports data to a valid JSON string and imports successfully', () => {
      recordGuess({ mode: 'HSV', score: 92, isCorrect: true, breakdown: { value: 92, hue: 92, saturation: 92 } });

      const exportedJson = exportDataJson();
      expect(typeof exportedJson).toBe('string');

      clearAllData();
      expect(getDataStore().stats.totalQuestions).toBe(0);

      const success = importDataJson(exportedJson);
      expect(success).toBe(true);
      expect(getDataStore().stats.totalQuestions).toBe(1);
      expect(getDataStore().stats.totalCorrect).toBe(1);
    });

    it('rejects invalid JSON or incompatible schema versions', () => {
      expect(importDataJson('invalid-json')).toBe(false);
      expect(importDataJson(JSON.stringify({ version: 99 }))).toBe(false);
    });
  });
});
