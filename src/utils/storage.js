/**
 * @fileoverview Defensive local storage service, data schema, and analytics engine.
 * Handles schema migration, in-memory fallback for iOS private browsing/quota errors,
 * permanent monotonic lifetime statistics, FIFO 1000-item history bounding, and JSON backup.
 * Strictly adheres to Google JavaScript Style Guide and DESIGN.md.
 */

/**
 * Storage key for ChromaSense application state.
 * @type {string}
 */
export const STORAGE_KEY = 'chromasense_data_v1';

/**
 * Maximum number of individual question records retained in history (FIFO eviction).
 * @type {number}
 */
export const MAX_HISTORY_ITEMS = 1000;

/**
 * In-memory fallback in case localStorage is blocked or throws QuotaExceededError.
 * @type {Object|null}
 */
let inMemoryStore = null;

/**
 * Creates a fresh default data store object adhering to version 1 schema.
 * @returns {Object} Default store data structure.
 */
function createDefaultStore() {
  return {
    version: 1,
    stats: {
      totalSessions: 0,
      totalQuestions: 0,
      totalCorrect: 0,
      totalWrong: 0,
      averageAccuracy: 0,
      averageValueAccuracy: 0,
      totalCorrectTime: 0,
      averageCorrectTime: 0,
      modeStats: {
        HSV: {
          totalQuestions: 0,
          totalCorrect: 0,
          totalWrong: 0,
          averageAccuracy: 0,
          totalCorrectTime: 0,
          averageCorrectTime: 0,
        },
      },
    },
    settings: {
      defaultQuestionCount: 5,
      defaultViewMode: 'split',
      accuracyThreshold: 85.0,
      hapticFeedback: true,
    },
    history: [],
  };
}

/**
 * Safely retrieves the active data store from localStorage or the in-memory fallback.
 * @returns {Object} The parsed and validated store object.
 */
export function getDataStore() {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.version === 1) {
          return parsed;
        }
      }
    }
  } catch {
    // Falls through to inMemoryStore or creates a fresh default store
  }

  if (inMemoryStore) {
    return inMemoryStore;
  }

  const defaultStore = createDefaultStore();
  saveDataStore(defaultStore);
  return defaultStore;
}

/**
 * Safely persists the store to localStorage or updates in-memory fallback.
 * @param {Object} store - The store object to persist.
 * @returns {boolean} True if successfully saved.
 */
export function saveDataStore(store) {
  inMemoryStore = store;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      return true;
    }
  } catch {
    // Graceful fallback to inMemoryStore
  }
  return true;
}

/**
 * Records an individual guess submission into persistent storage.
 * Updates permanent monotonic lifetime counters, applies FIFO history bounding,
 * and tracks elapsed time only when isCorrect is true.
 * @param {Object} guessRecord - The guess details to record.
 * @returns {Object} The updated store.
 */
export function recordGuess(guessRecord) {
  const store = getDataStore();
  const mode = guessRecord.mode || 'HSV';
  const score = typeof guessRecord.score === 'number' ? guessRecord.score : 0;
  const isCorrect = Boolean(guessRecord.isCorrect);

  const item = {
    id: guessRecord.id || `hist_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: guessRecord.timestamp || new Date().toISOString(),
    exerciseId: guessRecord.exerciseId || 'color-matching',
    mode,
    target: guessRecord.target || null,
    guess: guessRecord.guess || null,
    score,
    breakdown: guessRecord.breakdown || { value: 0, hue: 0, saturation: 0 },
    isCorrect,
  };

  // 1. Update Global Lifetime Counters
  const s = store.stats;
  const prevTotal = s.totalQuestions;
  s.totalQuestions += 1;
  if (isCorrect) {
    s.totalCorrect += 1;
    // Track elapsed time only on correct answers
    if (typeof guessRecord.timeSeconds === 'number') {
      item.timeSeconds = guessRecord.timeSeconds;
      s.totalCorrectTime = (s.totalCorrectTime || 0) + guessRecord.timeSeconds;
      s.averageCorrectTime = Math.round((s.totalCorrectTime / s.totalCorrect) * 10) / 10;
    }
  } else {
    s.totalWrong += 1;
  }
  const newAvg = (s.averageAccuracy * prevTotal + score) / s.totalQuestions;
  s.averageAccuracy = Math.round(newAvg * 10) / 10;

  if (guessRecord.breakdown?.value !== undefined) {
    const prevValAvg = s.averageValueAccuracy || 0;
    const newValAvg = (prevValAvg * prevTotal + guessRecord.breakdown.value) / s.totalQuestions;
    s.averageValueAccuracy = Math.round(newValAvg * 10) / 10;
  }

  // 2. Update Mode-Specific Lifetime Counters (Mode Isolation)
  if (!s.modeStats) {
    s.modeStats = {};
  }
  if (!s.modeStats[mode]) {
    s.modeStats[mode] = {
      totalQuestions: 0,
      totalCorrect: 0,
      totalWrong: 0,
      averageAccuracy: 0,
      totalCorrectTime: 0,
      averageCorrectTime: 0,
    };
  }

  const ms = s.modeStats[mode];
  const prevModeTotal = ms.totalQuestions;
  ms.totalQuestions += 1;
  if (isCorrect) {
    ms.totalCorrect += 1;
    if (typeof guessRecord.timeSeconds === 'number') {
      ms.totalCorrectTime = (ms.totalCorrectTime || 0) + guessRecord.timeSeconds;
      ms.averageCorrectTime = Math.round((ms.totalCorrectTime / ms.totalCorrect) * 10) / 10;
    }
  } else {
    ms.totalWrong += 1;
  }
  const newModeAvg = (ms.averageAccuracy * prevModeTotal + score) / ms.totalQuestions;
  ms.averageAccuracy = Math.round(newModeAvg * 10) / 10;

  // 3. FIFO Bounded History Array (Max 1000 items)
  store.history.push(item);
  if (store.history.length > MAX_HISTORY_ITEMS) {
    store.history = store.history.slice(-MAX_HISTORY_ITEMS);
  }

  saveDataStore(store);
  return store;
}

/**
 * Computes accuracy metrics across a specific rolling time window and mode.
 * Reads directly from permanent counters for all-time queries to protect against FIFO pruning.
 * @param {number|null} [windowDays=null] - Days to look back, or null for all-time.
 * @param {string|null} [mode=null] - Mode to filter by (e.g., 'HSV'), or null for all.
 * @returns {{ totalGuesses: number, correct: number, wrong: number, accuracyPercent: number, averageScore: number, averageCorrectTime: number }}
 */
export function getAccuracyStats(windowDays = null, mode = null) {
  const store = getDataStore();

  // All-time query for a specific mode: read from permanent lifetime counters
  if (!windowDays && mode && store.stats.modeStats?.[mode]) {
    const ms = store.stats.modeStats[mode];
    const accPct = ms.totalQuestions > 0 ? (ms.totalCorrect / ms.totalQuestions) * 100 : 0;
    return {
      totalGuesses: ms.totalQuestions,
      correct: ms.totalCorrect,
      wrong: ms.totalWrong,
      accuracyPercent: Math.round(accPct * 10) / 10,
      averageScore: ms.averageAccuracy,
      averageCorrectTime: ms.averageCorrectTime || 0,
    };
  }

  // Rolling time-window query: computed from bounded history array
  const history = store.history || [];
  const now = Date.now();
  const cutoff = windowDays ? now - windowDays * 24 * 60 * 60 * 1000 : 0;

  const filtered = history.filter((entry) => {
    const matchesTime = !windowDays || new Date(entry.timestamp).getTime() >= cutoff;
    const matchesMode = !mode || entry.mode === mode;
    return matchesTime && matchesMode;
  });

  if (filtered.length === 0) {
    return {
      totalGuesses: 0,
      correct: 0,
      wrong: 0,
      accuracyPercent: 0,
      averageScore: 0,
      averageCorrectTime: 0,
    };
  }

  const correct = filtered.filter((entry) => entry.isCorrect).length;
  const wrong = filtered.length - correct;
  const accuracyPercent = Math.round((correct / filtered.length) * 1000) / 10;
  const totalScore = filtered.reduce((sum, entry) => sum + entry.score, 0);
  const averageScore = Math.round((totalScore / filtered.length) * 10) / 10;

  const correctWithTime = filtered.filter((entry) => entry.isCorrect && typeof entry.timeSeconds === 'number');
  const avgTime = correctWithTime.length > 0
    ? Math.round((correctWithTime.reduce((sum, entry) => sum + entry.timeSeconds, 0) / correctWithTime.length) * 10) / 10
    : 0;

  return {
    totalGuesses: filtered.length,
    correct,
    wrong,
    accuracyPercent,
    averageScore,
    averageCorrectTime: avgTime,
  };
}

/**
 * Generates an aggregated breakdown of active modes for configuration and summary cards.
 * @param {string[]} [modes=['HSV']] - List of mode keys to query.
 * @returns {Record<string, { allTime: Object, past7Days: Object }>}
 */
export function getModeStatsSummary(modes = ['HSV']) {
  const summary = {};
  for (const m of modes) {
    summary[m] = {
      allTime: getAccuracyStats(null, m),
      past7Days: getAccuracyStats(7, m),
    };
  }
  return summary;
}

/**
 * Serializes the full application data store into a JSON string for user backup.
 * @returns {string} Formatted JSON string backup.
 */
export function exportDataJson() {
  const store = getDataStore();
  return JSON.stringify(store, null, 2);
}

/**
 * Validates and restores a previously exported JSON backup.
 * @param {string} jsonString - The raw JSON string to import.
 * @returns {boolean} True if successfully validated and restored.
 */
export function importDataJson(jsonString) {
  try {
    const parsed = JSON.parse(jsonString);
    if (parsed && typeof parsed === 'object' && parsed.version === 1 && parsed.stats) {
      saveDataStore(parsed);
      return true;
    }
  } catch {
    // Invalid JSON
  }
  return false;
}

/**
 * Resets the entire data store back to initial blank defaults.
 */
export function clearAllData() {
  inMemoryStore = null;
  const freshStore = createDefaultStore();
  saveDataStore(freshStore);
}

/**
 * Records completion of an entire exercise session, incrementing totalSessions.
 * @param {Object} [sessionSummary={}] - Session summary payload.
 * @returns {Object} The updated store.
 */
export function recordSession(sessionSummary = {}) {
  const store = getDataStore();
  store.stats.totalSessions = (store.stats.totalSessions || 0) + 1;
  saveDataStore(store);
  return store;
}

/**
 * Computes rolling 30-day accuracy for a specific musical interval in voice training.
 * @param {string} intervalCode - Short interval code (e.g. 'P5', 'm3').
 * @param {number} [windowDays=30] - Rolling window in days.
 * @returns {{ totalAttempts: number, totalCorrect: number, accuracyPercent: number|null }}
 */
export function getIntervalAccuracyStats(intervalCode, windowDays = 30) {
  const store = getDataStore();
  const cutoff = Date.now() - windowDays * 86400000;

  const relevant = (store.history || []).filter((entry) => {
    if (entry.exerciseId !== 'voice-training') {
      return false;
    }
    const itemInterval = entry.interval || entry.target?.interval;
    if (itemInterval !== intervalCode) {
      return false;
    }
    const time = new Date(entry.timestamp).getTime();
    return !isNaN(time) && time >= cutoff;
  });

  const totalAttempts = relevant.length;
  if (totalAttempts === 0) {
    return { totalAttempts: 0, totalCorrect: 0, accuracyPercent: null };
  }

  const totalCorrect = relevant.filter((entry) => entry.isCorrect).length;
  const accuracyPercent = Math.round((totalCorrect / totalAttempts) * 1000) / 10;
  return { totalAttempts, totalCorrect, accuracyPercent };
}
