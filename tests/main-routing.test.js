/**
 * @fileoverview Integration test suite for main application view routing.
 * Tests seamless transitions across Screen 1 (Hub), Screen 2 (Config), Screen 3 (Game),
 * and Screen 5 (History).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initApp } from '../src/main.js';

describe('App View Routing Integration', () => {
  let appEl;

  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
    });
    document.body.innerHTML = '<div id="app"></div>';
    appEl = document.querySelector('#app');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('boots initially into the Exercise Hub (Screen 1)', () => {
    initApp(appEl);

    expect(appEl.querySelector('.hub-view-container')).not.toBeNull();
    expect(appEl.querySelector('.exercise-hub-title')).not.toBeNull();
  });

  it('navigates from Hub to Config when tapping active exercise card', () => {
    initApp(appEl);

    const activeCard = appEl.querySelector('.exercise-card.active');
    expect(activeCard).not.toBeNull();
    activeCard.click();

    expect(appEl.querySelector('.config-view-container')).not.toBeNull();
    expect(appEl.querySelector('.config-title')).not.toBeNull();
  });

  it('navigates from Hub to History when tapping History button', () => {
    initApp(appEl);

    const historyBtn = appEl.querySelector('#hub-history-btn');
    expect(historyBtn).not.toBeNull();
    historyBtn.click();

    expect(appEl.querySelector('.history-view-container')).not.toBeNull();
    expect(appEl.querySelector('.history-title')).not.toBeNull();
  });

  it('returns to Hub from History when tapping Back button', () => {
    initApp(appEl);

    appEl.querySelector('#hub-history-btn').click();
    expect(appEl.querySelector('.history-view-container')).not.toBeNull();

    const backBtn = appEl.querySelector('#history-back-btn');
    backBtn.click();

    expect(appEl.querySelector('.hub-view-container')).not.toBeNull();
  });

  it('navigates from Config to Game when tapping Start Exercise', () => {
    initApp(appEl);

    // Hub -> Config
    appEl.querySelector('.exercise-card.active').click();
    expect(appEl.querySelector('.config-view-container')).not.toBeNull();

    // Config -> Game
    const startBtn = appEl.querySelector('#start-exercise-btn');
    startBtn.click();

    expect(appEl.querySelector('.interactive-container')).not.toBeNull();
    expect(appEl.querySelector('#submit-guess-btn')).not.toBeNull();
  });

  it('exits Game back to Config when tapping Exit button', () => {
    initApp(appEl);

    // Hub -> Config -> Game
    appEl.querySelector('.exercise-card.active').click();
    appEl.querySelector('#start-exercise-btn').click();

    const exitBtn = appEl.querySelector('#game-exit-btn');
    expect(exitBtn).not.toBeNull();
    exitBtn.click();

    expect(appEl.querySelector('.config-view-container')).not.toBeNull();
  });

  it('navigates from Hub to Voice Config when tapping Voice Training card', () => {
    initApp(appEl);

    const voiceCard = appEl.querySelector('[data-exercise-id="voice-training"]');
    expect(voiceCard).not.toBeNull();
    voiceCard.click();

    expect(appEl.querySelector('.config-view-container')).not.toBeNull();
    expect(appEl.querySelector('.config-title').textContent).toContain('Voice Training');
  });

  it('navigates from Voice Config to Voice Game Drill and exits back to Voice Config', () => {
    initApp(appEl);

    // Hub -> Voice Config
    appEl.querySelector('[data-exercise-id="voice-training"]').click();
    expect(appEl.querySelector('.config-view-container')).not.toBeNull();

    // Voice Config -> Voice Game
    const startBtn = appEl.querySelector('#start-exercise-btn');
    startBtn.click();

    expect(appEl.querySelector('.voice-container')).not.toBeNull();
    expect(appEl.querySelector('.voice-prompt-card')).not.toBeNull();
    expect(appEl.querySelector('#voice-exit-btn')).not.toBeNull();

    // Exit Voice Game -> returns to Voice Config
    appEl.querySelector('#voice-exit-btn').click();
    expect(appEl.querySelector('.config-view-container')).not.toBeNull();
    expect(appEl.querySelector('.config-title').textContent).toContain('Voice Training');
  });

  it('navigates to Voice Summary and loops back to Hub on Back to Hub tap', () => {
    const { router } = initApp(appEl);

    // Directly navigate router to summary with voice-training payload
    router.navigate('summary', {
      sessionData: {
        exerciseId: 'voice-training',
        mode: 'interval-breakdown',
        totalQuestions: 1,
        correctCount: 1,
        accuracyPercent: 100,
        questions: [
          {
            questionNumber: 1,
            interval: 'P5',
            prompt: 'top',
            targetNote: 'G4',
            targetFreq: 392.0,
            detectedPitch: 392.0,
            detectedNote: 'G4',
            cents: 0,
            rating: 'flawless',
            score: 100,
            isCorrect: true,
          },
        ],
      },
    });

    expect(appEl.querySelector('.voice-summary-view')).not.toBeNull();
    expect(appEl.textContent).toContain('Vocal Session Summary');

    const homeBtn = appEl.querySelector('#voice-summary-home-btn');
    expect(homeBtn).not.toBeNull();
    homeBtn.click();

    expect(appEl.querySelector('.hub-view-container')).not.toBeNull();
  });
});


