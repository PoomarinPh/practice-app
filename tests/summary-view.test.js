/**
 * @fileoverview Unit test suite for SummaryView (Screen 4: Session Summary).
 * Validates rendering of final session KPIs, best match highlight, scrollable round review,
 * and navigation actions.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SummaryView } from '../src/views/summary-view.js';

describe('SummaryView Component', () => {
  let container;

  const mockSessionData = {
    exerciseId: 'color-matching',
    mode: 'HSV',
    totalQuestions: 3,
    questions: [
      {
        questionNumber: 1,
        target: { h: 100, s: 0.5, v: 0.8, hex: '#66cc33' },
        guess: { h: 102, s: 0.48, v: 0.82, hex: '#6ecc38' },
        score: 95.0,
        isCorrect: true,
        timeSeconds: 3.5,
        breakdown: { value: 96, hue: 94, saturation: 95 },
      },
      {
        questionNumber: 2,
        target: { h: 200, s: 0.7, v: 0.6, hex: '#2e7fa8' },
        guess: { h: 240, s: 0.3, v: 0.9, hex: '#a3a8e6' },
        score: 65.0,
        isCorrect: false,
        timeSeconds: null,
        breakdown: { value: 60, hue: 70, saturation: 65 },
      },
      {
        questionNumber: 3,
        target: { h: 320, s: 0.6, v: 0.9, hex: '#e65cba' },
        guess: { h: 320, s: 0.6, v: 0.9, hex: '#e65cba' },
        score: 100.0,
        isCorrect: true,
        timeSeconds: 2.5,
        breakdown: { value: 100, hue: 100, saturation: 100 },
      },
    ],
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders session KPIs: accuracy, ratio, best match, and average correct speed', () => {
    const view = new SummaryView(container, {
      sessionData: mockSessionData,
      onPlayAgain: vi.fn(),
      onConfigure: vi.fn(),
      onViewHistory: vi.fn(),
    });

    expect(container.querySelector('.summary-title')).not.toBeNull();
    // 2 correct out of 3 questions
    expect(container.textContent).toContain('2 / 3');

    // Average score: (95 + 65 + 100) / 3 = 86.7%
    expect(container.textContent).toContain('86.7%');

    // Best match: 100%
    expect(container.textContent).toContain('100%');

    // Average correct time: (3.5 + 2.5) / 2 = 3s
    expect(container.textContent).toContain('3s');
  });

  it('renders review cards for all answered questions in the session', () => {
    const view = new SummaryView(container, {
      sessionData: mockSessionData,
      onPlayAgain: vi.fn(),
      onConfigure: vi.fn(),
      onViewHistory: vi.fn(),
    });

    const recapCards = container.querySelectorAll('.recap-card');
    expect(recapCards.length).toBe(3);

    // Question 1
    expect(recapCards[0].textContent).toContain('Question 1');
    expect(recapCards[0].textContent).toContain('95%');
    expect(recapCards[0].textContent).toContain('3.5s');

    // Question 2 (wrong answer: no time)
    expect(recapCards[1].textContent).toContain('Question 2');
    expect(recapCards[1].textContent).toContain('65%');
    expect(recapCards[1].querySelector('.recap-time-badge')).toBeNull();
  });

  it('triggers onPlayAgain callback when clicking Play Again button', () => {
    const onPlayAgain = vi.fn();
    const view = new SummaryView(container, {
      sessionData: mockSessionData,
      onPlayAgain,
      onConfigure: vi.fn(),
      onViewHistory: vi.fn(),
    });

    const playBtn = container.querySelector('#summary-play-again-btn');
    expect(playBtn).not.toBeNull();
    playBtn.click();

    expect(onPlayAgain).toHaveBeenCalled();
  });

  it('triggers onConfigure callback when clicking Configure button', () => {
    const onConfigure = vi.fn();
    const view = new SummaryView(container, {
      sessionData: mockSessionData,
      onPlayAgain: vi.fn(),
      onConfigure,
      onViewHistory: vi.fn(),
    });

    const cfgBtn = container.querySelector('#summary-configure-btn');
    expect(cfgBtn).not.toBeNull();
    cfgBtn.click();

    expect(onConfigure).toHaveBeenCalled();
  });

  it('triggers onViewHistory callback when clicking View History button', () => {
    const onViewHistory = vi.fn();
    const view = new SummaryView(container, {
      sessionData: mockSessionData,
      onPlayAgain: vi.fn(),
      onConfigure: vi.fn(),
      onViewHistory,
    });

    const histBtn = container.querySelector('#summary-history-btn');
    expect(histBtn).not.toBeNull();
    histBtn.click();

    expect(onViewHistory).toHaveBeenCalled();
  });

  it('renders voice training session review cards with interval names and cent deviations', () => {
    const voiceSessionData = {
      exerciseId: 'voice-training',
      mode: 'interval-breakdown',
      totalQuestions: 2,
      questions: [
        {
          questionNumber: 1,
          interval: 'P5',
          prompt: 'top',
          targetNote: 'G4',
          targetFreq: 392.0,
          detectedPitch: 394.0,
          detectedNote: 'G4',
          cents: 8.8,
          rating: 'flawless',
          score: 91,
          isCorrect: true,
        },
        {
          questionNumber: 2,
          interval: 'm3',
          prompt: 'bottom',
          targetNote: 'C4',
          targetFreq: 261.63,
          detectedPitch: 250.0,
          detectedNote: 'B3',
          cents: -79.0,
          rating: 'out-of-tune',
          score: 21,
          isCorrect: false,
        },
      ],
    };

    new SummaryView(container, {
      sessionData: voiceSessionData,
      onPlayAgain: vi.fn(),
      onConfigure: vi.fn(),
      onViewHistory: vi.fn(),
    });

    const recapCards = container.querySelectorAll('.recap-card');
    expect(recapCards.length).toBe(2);

    expect(recapCards[0].textContent).toContain('P5 (TOP)');
    expect(recapCards[0].textContent).toContain('Flawless Pitch');
    expect(recapCards[0].textContent).toContain('+8.8c');
    expect(recapCards[0].textContent).toContain('G4');

    expect(recapCards[1].textContent).toContain('m3 (BOTTOM)');
    expect(recapCards[1].textContent).toContain('Off-Pitch');
    expect(recapCards[1].textContent).toContain('-79c');
  });
});

