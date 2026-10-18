/**
 * @fileoverview Unit test suite for VoiceSummaryView (Screen 4: Voice Session Summary).
 * Validates rendering of final vocal accuracy KPIs, per-interval breakdown table,
 * question recap entries with cents deviation, audio target replays, and navigation loops.
 * Strictly adheres to Google JavaScript Style Guide and VOICE_DESIGN.md.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceSummaryView } from '../src/views/voice-summary-view.js';

describe('VoiceSummaryView Component', () => {
  let container;
  let mockSynth;

  const mockSessionData = {
    exerciseId: 'voice-training',
    mode: 'interval-breakdown',
    totalQuestions: 3,
    correctCount: 2,
    accuracyPercent: 66.7,
    elapsedMs: 24500,
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
      {
        questionNumber: 3,
        interval: 'P5',
        prompt: 'bottom',
        targetNote: 'D4',
        targetFreq: 293.66,
        detectedPitch: 297.0,
        detectedNote: 'D4',
        cents: 19.5,
        rating: 'in-tune',
        score: 80,
        isCorrect: true,
      },
    ],
  };

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    mockSynth = {
      playTone: vi.fn(),
    };
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('renders session KPIs: accuracy %, correct count, and average cent deviation', () => {
    new VoiceSummaryView(container, {
      sessionData: mockSessionData,
      synth: mockSynth,
    });

    expect(container.textContent).toContain('66.7%');
    expect(container.textContent).toContain('2 / 3');

    // Average absolute cent deviation: (|8.8| + |-79| + |19.5|) / 3 = 107.3 / 3 ≈ 35.8c
    const deviationCard = container.querySelector('#summary-kpi-deviation');
    expect(deviationCard).not.toBeNull();
    expect(deviationCard.textContent).toMatch(/35\.8c|36c/);
  });

  it('renders per-interval breakdown table with grouped counts and accuracy', () => {
    new VoiceSummaryView(container, {
      sessionData: mockSessionData,
      synth: mockSynth,
    });

    const breakdownTable = container.querySelector('#interval-breakdown-table');
    expect(breakdownTable).not.toBeNull();

    // P5 was tested twice: 2/2 correct = 100%
    const p5Row = container.querySelector('[data-interval-row="P5"]');
    expect(p5Row).not.toBeNull();
    expect(p5Row.textContent).toContain('Perfect 5th');
    expect(p5Row.textContent).toContain('100%');
    expect(p5Row.textContent).toContain('2 / 2');

    // m3 was tested once: 0/1 correct = 0%
    const m3Row = container.querySelector('[data-interval-row="m3"]');
    expect(m3Row).not.toBeNull();
    expect(m3Row.textContent).toContain('Minor 3rd');
    expect(m3Row.textContent).toContain('0%');
    expect(m3Row.textContent).toContain('0 / 1');
  });

  it('renders questions recap entries with target, sung pitch, and cent ratings', () => {
    new VoiceSummaryView(container, {
      sessionData: mockSessionData,
      synth: mockSynth,
    });

    const recapCards = container.querySelectorAll('.voice-recap-card');
    expect(recapCards.length).toBe(3);

    expect(recapCards[0].textContent).toContain('P5 (TOP)');
    expect(recapCards[0].textContent).toContain('G4');
    expect(recapCards[0].textContent).toContain('+8.8c');
    expect(recapCards[0].textContent).toContain('Flawless');

    expect(recapCards[1].textContent).toContain('m3 (BOTTOM)');
    expect(recapCards[1].textContent).toContain('C4');
    expect(recapCards[1].textContent).toContain('-79c');
    expect(recapCards[1].textContent).toContain('Off-Pitch');
  });

  it('triggers audio tone playback when clicking replay target button on a recap card', () => {
    new VoiceSummaryView(container, {
      sessionData: mockSessionData,
      synth: mockSynth,
    });

    const playBtn = container.querySelector('[data-replay-note="G4"]');
    expect(playBtn).not.toBeNull();
    playBtn.click();

    expect(mockSynth.playTone).toHaveBeenCalledWith('G4', expect.any(Number));
  });

  it('triggers onPlayAgain callback when clicking Play Again button', () => {
    const onPlayAgain = vi.fn();
    new VoiceSummaryView(container, {
      sessionData: mockSessionData,
      onPlayAgain,
      synth: mockSynth,
    });

    const playAgainBtn = container.querySelector('#voice-summary-play-again-btn');
    expect(playAgainBtn).not.toBeNull();
    playAgainBtn.click();

    expect(onPlayAgain).toHaveBeenCalled();
  });

  it('triggers onConfigure callback when clicking Change Settings button', () => {
    const onConfigure = vi.fn();
    new VoiceSummaryView(container, {
      sessionData: mockSessionData,
      onConfigure,
      synth: mockSynth,
    });

    const cfgBtn = container.querySelector('#voice-summary-configure-btn');
    expect(cfgBtn).not.toBeNull();
    cfgBtn.click();

    expect(onConfigure).toHaveBeenCalled();
  });

  it('triggers onHome callback when clicking Back to Hub button', () => {
    const onHome = vi.fn();
    new VoiceSummaryView(container, {
      sessionData: mockSessionData,
      onHome,
      synth: mockSynth,
    });

    const homeBtn = container.querySelector('#voice-summary-home-btn');
    expect(homeBtn).not.toBeNull();
    homeBtn.click();

    expect(onHome).toHaveBeenCalled();
  });
});
