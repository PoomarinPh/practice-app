/**
 * @fileoverview Unit test suite for VoiceConfigView (Screen 2: Voice Configuration).
 * Tests note range sliders, localStorage persistence, preset buttons,
 * interval toggles, question count selection, and callback dispatch.
 * Strictly adheres to Google JavaScript Style Guide and VOICE_DESIGN.md.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceConfigView } from '../src/views/voice-config-view.js';
import { recordGuess, clearAllData } from '../src/utils/storage.js';

describe('VoiceConfigView Component', () => {
  let container;

  beforeEach(() => {
    localStorage.clear();
    clearAllData();
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  it('renders with default settings (C3 to C5, 5 questions, melodic)', () => {
    const view = new VoiceConfigView(container);
    const config = view.getConfig();

    expect(config.rangeFrom).toBe('C3');
    expect(config.rangeTo).toBe('C5');
    expect(config.questionCount).toBe(5);
    expect(config.playbackStyle).toBe('melodic');
    expect(config.enabledIntervals.length).toBe(12);
  });

  it('restores stored preferences from localStorage', () => {
    localStorage.setItem(
      'voice_training_preferences',
      JSON.stringify({
        rangeFrom: 'A3',
        rangeTo: 'C5',
        questionCount: 10,
        playbackStyle: 'harmonic',
        enabledIntervals: ['m3', 'M3', 'P5'],
      })
    );

    const view = new VoiceConfigView(container);
    const config = view.getConfig();

    expect(config.rangeFrom).toBe('A3');
    expect(config.rangeTo).toBe('C5');
    expect(config.questionCount).toBe(10);
    expect(config.playbackStyle).toBe('harmonic');
    expect(config.enabledIntervals).toEqual(['m3', 'M3', 'P5']);
  });

  it('applies vocal range presets when clicked', () => {
    const view = new VoiceConfigView(container);
    const tenorPresetBtn = container.querySelector('[data-preset="tenor-bass"]');
    expect(tenorPresetBtn).not.toBeNull();

    tenorPresetBtn.click();
    let config = view.getConfig();
    expect(config.rangeFrom).toBe('C3');
    expect(config.rangeTo).toBe('E4');

    const sopranoPresetBtn = container.querySelector('[data-preset="alto-soprano"]');
    sopranoPresetBtn.click();
    config = view.getConfig();
    expect(config.rangeFrom).toBe('A3');
    expect(config.rangeTo).toBe('C5');
  });

  it('toggles intervals and prevents deselecting all intervals', () => {
    const view = new VoiceConfigView(container);
    let m2Toggle = container.querySelector('[data-interval="m2"]');
    expect(m2Toggle).not.toBeNull();
    expect(m2Toggle.classList.contains('active')).toBe(true);

    // Toggle off m2
    m2Toggle.click();
    m2Toggle = container.querySelector('[data-interval="m2"]');
    expect(m2Toggle.classList.contains('active')).toBe(false);
    expect(view.getConfig().enabledIntervals.includes('m2')).toBe(false);

    // Programmatically set enabled to only ['P5']
    view.setEnabledIntervals(['P5']);
    let p5Toggle = container.querySelector('[data-interval="P5"]');
    p5Toggle.click(); // Attempt to uncheck the only remaining interval

    p5Toggle = container.querySelector('[data-interval="P5"]');
    expect(view.getConfig().enabledIntervals).toContain('P5');
    expect(p5Toggle.classList.contains('active')).toBe(true);
  });

  it('selects question count via chips', () => {
    const view = new VoiceConfigView(container);
    const chip15 = container.querySelector('[data-count="15"]');
    expect(chip15).not.toBeNull();

    chip15.click();
    expect(view.getConfig().questionCount).toBe(15);
    expect(chip15.classList.contains('active')).toBe(true);
  });

  it('toggles playback style between melodic and harmonic', () => {
    const view = new VoiceConfigView(container);
    const harmonicBtn = container.querySelector('[data-style="harmonic"]');
    expect(harmonicBtn).not.toBeNull();

    harmonicBtn.click();
    expect(view.getConfig().playbackStyle).toBe('harmonic');
  });

  it('dispatches onStart callback with full configuration payload when start button is clicked', () => {
    const onStart = vi.fn();
    new VoiceConfigView(container, { onStart });

    const startBtn = container.querySelector('#start-exercise-btn, #start-voice-drill-btn');
    expect(startBtn).not.toBeNull();
    startBtn.click();

    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        exerciseId: 'voice-training',
        mode: 'interval-breakdown',
        rangeFrom: 'C3',
        rangeTo: 'C5',
        questionCount: 5,
        playbackStyle: 'melodic',
        enabledIntervals: expect.arrayContaining(['P5']),
      })
    );
  });

  it('displays rolling 30-day interval accuracy badges', () => {
    // Record past guesses for P5 (2 correct out of 2 = 100%)
    recordGuess(
      {
        exerciseId: 'voice-training',
        mode: 'interval-breakdown',
        target: { interval: 'P5', note: 'G4' },
        score: 100,
        isCorrect: true,
      },
      'interval-breakdown'
    );
    recordGuess(
      {
        exerciseId: 'voice-training',
        mode: 'interval-breakdown',
        target: { interval: 'P5', note: 'D4' },
        score: 95,
        isCorrect: true,
      },
      'interval-breakdown'
    );

    new VoiceConfigView(container);
    const p5Badge = container.querySelector('[data-interval="P5"] .interval-badge');
    expect(p5Badge).not.toBeNull();
    expect(p5Badge.textContent).toContain('100%');
  });

  it('triggers onBack callback when back button is clicked', () => {
    const onBack = vi.fn();
    new VoiceConfigView(container, { onBack });

    const backBtn = container.querySelector('#voice-config-back-btn');
    expect(backBtn).not.toBeNull();
    backBtn.click();

    expect(onBack).toHaveBeenCalled();
  });
});
