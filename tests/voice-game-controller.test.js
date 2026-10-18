/**
 * @fileoverview Unit test suite for VoiceGameController (Screen 3: Active Voice Drill).
 * Tests interval generation, prompt isolation (top vs bottom), audio playback replay,
 * microphone pitch capture, cent tuner gauge rendering, scoring, and session finish.
 * Strictly adheres to Google JavaScript Style Guide and VOICE_DESIGN.md.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceGameController } from '../src/views/voice-game-controller.js';
import { clearAllData, getDataStore } from '../src/utils/storage.js';

describe('VoiceGameController Active Drill', () => {
  let container;
  let mockSynth;
  let mockDetector;

  beforeEach(() => {
    localStorage.clear();
    clearAllData();
    container = document.createElement('div');
    document.body.appendChild(container);

    mockSynth = {
      playTone: vi.fn(),
      playSequential: vi.fn(),
      playChord: vi.fn(),
    };

    mockDetector = {
      isActive: vi.fn(() => false),
      start: vi.fn(),
      startMicrophone: vi.fn(async () => {}),
      stop: vi.fn(),
      sampleCurrentPitch: vi.fn(() => ({
        pitch: 440,
        isVoiced: true,
        clarity: 0.95,
      })),
    };
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('initializes round with question 1 of N and generates prompt within vocal range', () => {
    const controller = new VoiceGameController(
      container,
      {
        exerciseId: 'voice-training',
        mode: 'interval-breakdown',
        rangeFrom: 'C3',
        rangeTo: 'C5',
        enabledIntervals: ['P5'],
        questionCount: 3,
        playbackStyle: 'melodic',
      },
      {},
      { synth: mockSynth, detector: mockDetector }
    );

    expect(controller.currentQuestion).toBe(1);
    expect(controller.totalQuestions).toBe(3);
    expect(controller.activeInterval).toBe('P5');
    expect(['bottom', 'top']).toContain(controller.prompt);
    expect(controller.targetNote).toBeDefined();

    // Verify UI reflects question progress
    const progressEl = container.querySelector('#voice-stat-progress');
    expect(progressEl.textContent).toContain('Q 1 / 3');

    // Verify prompt heading
    const promptHeading = container.querySelector('.voice-prompt-card h2');
    expect(promptHeading.textContent).toMatch(/Sing the (TOP|BOTTOM) Note/);
  });

  it('triggers harmonic interval playback when Replay button is clicked', () => {
    const controller = new VoiceGameController(
      container,
      {
        enabledIntervals: ['P5'],
      },
      {},
      { synth: mockSynth, detector: mockDetector }
    );

    mockSynth.playChord.mockClear();
    const replayBtn = container.querySelector('#voice-replay-btn');
    expect(replayBtn).not.toBeNull();
    replayBtn.click();

    expect(mockSynth.playChord).toHaveBeenCalledWith(
      [controller.bottomNote, controller.topNote],
      expect.any(Number)
    );
  });

  it('processes sung vocal input and renders cent tuner feedback', async () => {
    const controller = new VoiceGameController(
      container,
      {
        enabledIntervals: ['P5'],
        questionCount: 2,
      },
      {},
      { synth: mockSynth, detector: mockDetector }
    );

    // Simulate singing close to target note
    const targetFreq = controller.targetFreq;
    mockDetector.sampleCurrentPitch = vi.fn(() => ({
      pitch: targetFreq * Math.pow(2, 8 / 1200), // 8 cents sharp -> 'flawless'
      isVoiced: true,
      clarity: 0.98,
    }));

    // Perform voice capture directly or simulate recording
    await controller.processPitchSamples([
      targetFreq * Math.pow(2, 8 / 1200),
      targetFreq * Math.pow(2, 7 / 1200),
      targetFreq * Math.pow(2, 9 / 1200),
    ]);

    // Expect tuner card to appear
    const tunerCard = container.querySelector('#voice-tuner-card');
    expect(tunerCard).not.toBeNull();

    // Check rating badge
    const ratingBadge = container.querySelector('.voice-rating-badge');
    expect(ratingBadge.textContent).toContain('Flawless');

    // Check cent deviation display
    const centsDisplay = container.querySelector('#tuner-cents-value');
    expect(centsDisplay.textContent).toMatch(/\+8/);

    // Check that target note audio was played as reference
    expect(mockSynth.playTone).toHaveBeenCalledWith(controller.targetNote, expect.any(Number));
  });

  it('records guess into permanent storage with exerciseId voice-training', async () => {
    const controller = new VoiceGameController(
      container,
      {
        enabledIntervals: ['P5'],
        questionCount: 1,
      },
      {},
      { synth: mockSynth, detector: mockDetector }
    );

    await controller.processPitchSamples([controller.targetFreq]);

    const store = getDataStore();
    expect(store.history.length).toBe(1);
    expect(store.history[0].exerciseId).toBe('voice-training');
    expect(store.history[0].mode).toBe('interval-breakdown');
    expect(store.history[0].isCorrect).toBe(true);
  });

  it('advances through questions and triggers onFinish when round completes', async () => {
    const onFinish = vi.fn();
    const controller = new VoiceGameController(
      container,
      {
        enabledIntervals: ['P5'],
        questionCount: 2,
      },
      { onFinish },
      { synth: mockSynth, detector: mockDetector }
    );

    // Answer Q1
    await controller.processPitchSamples([controller.targetFreq]);
    const nextBtn = container.querySelector('#voice-next-btn');
    expect(nextBtn).not.toBeNull();
    nextBtn.click();

    // Now on Q2
    expect(controller.currentQuestion).toBe(2);
    expect(container.querySelector('#voice-stat-progress').textContent).toContain('Q 2 / 2');

    // Answer Q2
    await controller.processPitchSamples([controller.targetFreq]);
    const finishBtn = container.querySelector('#voice-finish-btn');
    expect(finishBtn).not.toBeNull();
    finishBtn.click();

    expect(onFinish).toHaveBeenCalledWith(
      expect.objectContaining({
        exerciseId: 'voice-training',
        mode: 'interval-breakdown',
        totalQuestions: 2,
        correctCount: 2,
        accuracyPercent: 100,
      })
    );
  });

  it('triggers onExit when exit button is clicked', () => {
    const onExit = vi.fn();
    new VoiceGameController(
      container,
      {},
      { onExit },
      { synth: mockSynth, detector: mockDetector }
    );

    const exitBtn = container.querySelector('#voice-exit-btn');
    expect(exitBtn).not.toBeNull();
    exitBtn.click();

    expect(onExit).toHaveBeenCalled();
  });
});
