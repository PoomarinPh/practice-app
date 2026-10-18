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
    vi.useRealTimers();
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('initializes round with question 1 of N and provides answer buttons for both Bottom and Top notes', () => {
    const controller = new VoiceGameController(
      container,
      {
        exerciseId: 'voice-training',
        mode: 'interval-breakdown',
        rangeFrom: 'C3',
        rangeTo: 'C5',
        enabledIntervals: ['P5'],
        questionCount: 3,
      },
      {},
      { synth: mockSynth, detector: mockDetector }
    );

    expect(controller.currentQuestion).toBe(1);
    expect(controller.totalQuestions).toBe(3);
    expect(controller.activeInterval).toBe('P5');
    expect(controller.bottomNote).toBeDefined();
    expect(controller.topNote).toBeDefined();
    expect(controller.bottomResult).toBeNull();
    expect(controller.topResult).toBeNull();

    // Verify UI reflects question progress
    const progressEl = container.querySelector('#voice-stat-progress');
    expect(progressEl.textContent).toContain('Q 1 / 3');

    // Verify prompt card heading
    const promptHeading = container.querySelector('.voice-prompt-card h2');
    expect(promptHeading.textContent).toContain('Both Notes');

    // Verify presence of two answer buttons
    const bottomBtn = container.querySelector('#voice-sing-bottom-btn');
    const topBtn = container.querySelector('#voice-sing-top-btn');
    expect(bottomBtn).not.toBeNull();
    expect(topBtn).not.toBeNull();

    // Verify Next Question button is NOT present before answering
    const nextBtn = container.querySelector('#voice-next-btn');
    expect(nextBtn).toBeNull();
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

  it('allows answering Bottom Note first, showing feedback while Top remains pending', async () => {
    const controller = new VoiceGameController(
      container,
      {
        enabledIntervals: ['P5'],
        questionCount: 2,
      },
      {},
      { synth: mockSynth, detector: mockDetector }
    );

    // Sing bottom note (+8 cents sharp)
    const bottomFreq = controller.bottomFreq;
    await controller.processPitchSamples([
      bottomFreq * Math.pow(2, 8 / 1200),
    ], 'bottom');

    expect(controller.bottomResult).not.toBeNull();
    expect(controller.topResult).toBeNull();

    // Bottom note tuner feedback appears
    const bottomFeedback = container.querySelector('#tuner-feedback-bottom');
    expect(bottomFeedback).not.toBeNull();
    expect(bottomFeedback.textContent).toContain('Flawless');

    // Top note is still pending and shows answer CTA
    const topBtn = container.querySelector('#voice-sing-top-btn');
    expect(topBtn).not.toBeNull();

    // Next button is STILL blocked because top note is not yet answered
    expect(container.querySelector('#voice-next-btn')).toBeNull();
  });

  it('requires both notes to be answered before allowing progression to next question', async () => {
    const controller = new VoiceGameController(
      container,
      {
        enabledIntervals: ['P5'],
        questionCount: 2,
      },
      {},
      { synth: mockSynth, detector: mockDetector }
    );

    // Only sing bottom note
    await controller.processPitchSamples([controller.bottomFreq], 'bottom');
    expect(container.querySelector('#voice-next-btn')).toBeNull();

    // Now sing top note
    await controller.processPitchSamples([controller.topFreq], 'top');
    expect(container.querySelector('#voice-next-btn')).not.toBeNull();
  });

  it('evaluates question as isCorrect: true only if BOTH Bottom and Top notes are in tune', async () => {
    const controller = new VoiceGameController(
      container,
      {
        enabledIntervals: ['P5'],
        questionCount: 1,
      },
      {},
      { synth: mockSynth, detector: mockDetector }
    );

    // Both notes sung in-tune (within 50 cents)
    await controller.processPitchSamples([controller.bottomFreq], 'bottom');
    await controller.processPitchSamples([controller.topFreq], 'top');

    expect(controller.questions.length).toBe(1);
    expect(controller.questions[0].isCorrect).toBe(true);

    const store = getDataStore();
    expect(store.history.length).toBe(1);
    expect(store.history[0].isCorrect).toBe(true);
  });

  it('evaluates question as isCorrect: false if EITHER Bottom or Top note is out of tune', async () => {
    const controller = new VoiceGameController(
      container,
      {
        enabledIntervals: ['P5'],
        questionCount: 1,
      },
      {},
      { synth: mockSynth, detector: mockDetector }
    );

    // Bottom note is in tune (+5 cents)
    await controller.processPitchSamples([controller.bottomFreq * Math.pow(2, 5 / 1200)], 'bottom');
    // Top note is out of tune (+75 cents sharp)
    await controller.processPitchSamples([controller.topFreq * Math.pow(2, 75 / 1200)], 'top');

    expect(controller.questions.length).toBe(1);
    expect(controller.questions[0].isCorrect).toBe(false);

    const store = getDataStore();
    expect(store.history.length).toBe(1);
    expect(store.history[0].isCorrect).toBe(false);
  });

  it('advances through questions and triggers onFinish when round completes with dual-note answers', async () => {
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

    // Answer Q1: both notes
    await controller.processPitchSamples([controller.bottomFreq], 'bottom');
    await controller.processPitchSamples([controller.topFreq], 'top');
    const nextBtn = container.querySelector('#voice-next-btn');
    expect(nextBtn).not.toBeNull();
    nextBtn.click();

    // Now on Q2
    expect(controller.currentQuestion).toBe(2);
    expect(container.querySelector('#voice-stat-progress').textContent).toContain('Q 2 / 2');
    expect(controller.bottomResult).toBeNull();
    expect(controller.topResult).toBeNull();

    // Answer Q2: both notes
    await controller.processPitchSamples([controller.bottomFreq], 'bottom');
    await controller.processPitchSamples([controller.topFreq], 'top');
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

  it('allows re-singing a note at any time and updates pitch evaluation and outcome', async () => {
    const controller = new VoiceGameController(
      container,
      {
        enabledIntervals: ['P5'],
        questionCount: 1,
      },
      {},
      { synth: mockSynth, detector: mockDetector }
    );

    // Initial attempt: Bottom in tune (+5c), Top out of tune (+75c)
    await controller.processPitchSamples([controller.bottomFreq * Math.pow(2, 5 / 1200)], 'bottom');
    await controller.processPitchSamples([controller.topFreq * Math.pow(2, 75 / 1200)], 'top');

    // Both answered, but missed
    expect(container.textContent).toContain('Question Missed');
    expect(controller.questions[0].isCorrect).toBe(false);

    const storeInitial = getDataStore();
    expect(storeInitial.history.length).toBe(1);
    expect(storeInitial.history[0].isCorrect).toBe(false);

    // Re-sing buttons must be rendered on both cards
    const resingBottomBtn = container.querySelector('#voice-resing-bottom-btn');
    const resingTopBtn = container.querySelector('#voice-resing-top-btn');
    expect(resingBottomBtn).not.toBeNull();
    expect(resingTopBtn).not.toBeNull();

    // Re-sing Top Note in tune (0 cents error)
    await controller.processPitchSamples([controller.topFreq], 'top');

    // Outcome banner updates to Passed!
    expect(container.textContent).toContain('Question Passed');
    expect(controller.questions[0].isCorrect).toBe(true);

    // History is updated in place, remaining exactly 1 item and marking isCorrect true
    const storeAfter = getDataStore();
    expect(storeAfter.history.length).toBe(1);
    expect(storeAfter.history[0].isCorrect).toBe(true);
  });

  it('shows live listening and voice detected states on re-sing button when re-singing', async () => {
    const controller = new VoiceGameController(
      container,
      {
        enabledIntervals: ['P5'],
        questionCount: 1,
      },
      {},
      { synth: mockSynth, detector: mockDetector }
    );

    // First answer bottom note
    await controller.processPitchSamples([controller.bottomFreq], 'bottom');
    const resingBtn = container.querySelector('#voice-resing-bottom-btn');
    expect(resingBtn).not.toBeNull();

    // Trigger startRecording on bottom note again (re-sing)
    const recordingPromise = controller.startRecording('bottom');

    expect(resingBtn.textContent).toContain('Listening... 🔴 Sing now!');
    expect(resingBtn.classList.contains('pulse-recording')).toBe(true);

    // Wait 60ms for one detector sample interval (40ms tick) with voiced pitch
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(resingBtn.textContent).toContain('Listening... 🟢 Voice detected!');

    controller.stopRecordingTimer();
    await recordingPromise;
  });

  it('re-singing immediately restarts clean listen if triggered during an active recording', async () => {
    const controller = new VoiceGameController(
      container,
      {
        enabledIntervals: ['P5'],
        questionCount: 1,
      },
      {},
      { synth: mockSynth, detector: mockDetector }
    );

    await controller.startRecording('bottom');
    expect(controller.isListening).toBe(true);

    // User triggers re-sing while still listening (e.g. noise occurred)
    await controller.startRecording('bottom');
    expect(mockDetector.stop).toHaveBeenCalled();
    expect(controller.isListening).toBe(true);
    controller.stopRecordingTimer();
  });

  it('handles silent or noisy samples during re-sing with informative button feedback', async () => {
    const controller = new VoiceGameController(
      container,
      {
        enabledIntervals: ['P5'],
        questionCount: 1,
      },
      {},
      { synth: mockSynth, detector: mockDetector }
    );

    // First answer bottom note
    await controller.processPitchSamples([controller.bottomFreq], 'bottom');
    const resingBtn = container.querySelector('#voice-resing-bottom-btn');
    expect(resingBtn).not.toBeNull();

    // Re-sing with 0 valid samples (noise / silence)
    await controller.processPitchSamples([], 'bottom');

    expect(resingBtn.textContent).toContain('Too quiet / Noise');
  });
});
