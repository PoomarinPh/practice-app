/**
 * @fileoverview Integration test suite for Phase 4 Gameplay Flow:
 * finite round execution, last question detection, transition to Session Summary,
 * and restart loop.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../src/main.js';

describe('Gameplay Flow & Round Summary Integration', () => {
  let appEl;

  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
    appEl = document.querySelector('#app');
  });

  it('progresses through a 2-question session and reveals SummaryView', () => {
    const { router } = initApp(appEl);

    // 1. Navigate to Game with 2 questions
    router.navigate('game', { exerciseId: 'color-matching', mode: 'HSV', questionCount: 2 });
    expect(appEl.querySelector('.interactive-container')).not.toBeNull();
    expect(appEl.querySelector('#stat-progress').textContent).toContain('Q 1 / 2');

    // 2. Submit Question 1
    const submitBtn = appEl.querySelector('#submit-guess-btn');
    submitBtn.click();

    // Check modal opened with "Next Color →"
    const nextBtn = document.querySelector('#result-next-btn');
    expect(nextBtn).not.toBeNull();
    expect(nextBtn.textContent).toContain('Next Color');

    // 3. Click Next to advance to Question 2
    nextBtn.click();
    expect(appEl.querySelector('#stat-progress').textContent).toContain('Q 2 / 2');

    // 4. Submit Question 2 (Last Question)
    submitBtn.click();

    const summaryCtaBtn = document.querySelector('#result-next-btn');
    expect(summaryCtaBtn).not.toBeNull();
    expect(summaryCtaBtn.textContent).toContain('View Summary');

    // 5. Click View Summary -> Transitions to Session Summary
    summaryCtaBtn.click();

    expect(appEl.querySelector('.summary-view-container')).not.toBeNull();
    expect(appEl.querySelectorAll('.recap-card').length).toBe(2);

    // 6. Click Play Again -> Restarts game at Question 1 of 2
    const playAgainBtn = appEl.querySelector('#summary-play-again-btn');
    playAgainBtn.click();

    expect(appEl.querySelector('.interactive-container')).not.toBeNull();
    expect(appEl.querySelector('#stat-progress').textContent).toContain('Q 1 / 2');
  });

  it('mounts Reference color at the top and Guess color at the bottom of the screen', () => {
    const { router } = initApp(appEl);
    router.navigate('game', { exerciseId: 'color-matching', mode: 'HSV', questionCount: 3 });

    const targetMount = appEl.querySelector('#target-swatch-mount');
    const guessMount = appEl.querySelector('#guess-swatch-mount');
    const controlsCard = appEl.querySelector('.controls-card');

    expect(targetMount).not.toBeNull();
    expect(guessMount).not.toBeNull();
    expect(controlsCard).not.toBeNull();

    // Verify DOM order: targetMount is before controlsCard, and controlsCard is before guessMount
    expect(Boolean(targetMount.compareDocumentPosition(controlsCard) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);
    expect(Boolean(controlsCard.compareDocumentPosition(guessMount) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    // Target mount contains reference card
    expect(targetMount.querySelector('.swatch-target')).not.toBeNull();
    expect(targetMount.querySelector('.swatch-label').textContent).toBe('Reference');

    // Guess mount contains your match card
    expect(guessMount.querySelector('.swatch-guess')).not.toBeNull();
    expect(guessMount.querySelector('.swatch-label').textContent).toBe('Your Match');
  });
});

