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

  it('renders with default settings (C3 to C5, 5 questions, harmonic)', () => {
    const view = new VoiceConfigView(container);
    const config = view.getConfig();

    expect(config.rangeFrom).toBe('C3');
    expect(config.rangeTo).toBe('C5');
    expect(config.questionCount).toBe(5);
    expect(config.playbackStyle).toBe('harmonic');
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

  it('uses harmonic playback by default without rendering style toggles', () => {
    new VoiceConfigView(container);
    expect(container.querySelector('[data-style]')).toBeNull();
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
        playbackStyle: 'harmonic',
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

  it('unselects all intervals when clicking Unselect All button and disables start button', () => {
    const onStart = vi.fn();
    const view = new VoiceConfigView(container, { onStart });

    const unselectAllBtn = container.querySelector('#btn-unselect-all-intervals');
    expect(unselectAllBtn).not.toBeNull();
    unselectAllBtn.click();

    expect(view.getConfig().enabledIntervals).toEqual([]);
    const activeCards = container.querySelectorAll('.interval-toggle-card.active');
    expect(activeCards.length).toBe(0);

    const startBtn = container.querySelector('#start-exercise-btn, #start-voice-drill-btn');
    expect(startBtn.disabled).toBe(true);

    startBtn.click();
    expect(onStart).not.toHaveBeenCalled();
  });

  it('selects all intervals when clicking Select All button', () => {
    const view = new VoiceConfigView(container);
    const unselectAllBtn = container.querySelector('#btn-unselect-all-intervals');
    expect(unselectAllBtn).not.toBeNull();
    unselectAllBtn.click();
    expect(view.getConfig().enabledIntervals.length).toBe(0);

    const selectAllBtn = container.querySelector('#btn-select-all-intervals');
    expect(selectAllBtn).not.toBeNull();
    selectAllBtn.click();

    expect(view.getConfig().enabledIntervals.length).toBe(12);
    const activeCards = container.querySelectorAll('.interval-toggle-card.active');
    expect(activeCards.length).toBe(12);

    const startBtn = container.querySelector('#start-exercise-btn, #start-voice-drill-btn');
    expect(startBtn.disabled).toBe(false);
  });

  it('allows selecting an interval after unselecting all and re-enables start button', () => {
    const view = new VoiceConfigView(container);
    const unselectAllBtn = container.querySelector('#btn-unselect-all-intervals');
    unselectAllBtn.click();
    expect(view.getConfig().enabledIntervals.length).toBe(0);

    const startBtn = container.querySelector('#start-exercise-btn, #start-voice-drill-btn');
    expect(startBtn.disabled).toBe(true);

    const m3Card = container.querySelector('[data-interval="m3"]');
    expect(m3Card).not.toBeNull();
    m3Card.click();

    expect(view.getConfig().enabledIntervals).toEqual(['m3']);
    expect(m3Card.classList.contains('active')).toBe(true);
    expect(startBtn.disabled).toBe(false);
  });

  it('allows toggling soundType between piano, cello, violin, and sine wave, saving to preferences and updating config', () => {
    const view = new VoiceConfigView(container);
    expect(view.getConfig().soundType).toBe('piano');

    // Test Cello
    const celloBtn = container.querySelector('[data-sound-type="cello"]');
    expect(celloBtn).not.toBeNull();
    celloBtn.click();
    expect(view.getConfig().soundType).toBe('cello');
    expect(celloBtn.classList.contains('active')).toBe(true);

    let saved = JSON.parse(localStorage.getItem('voice_training_preferences'));
    expect(saved.soundType).toBe('cello');

    // Test Violin
    const violinBtn = container.querySelector('[data-sound-type="violin"]');
    expect(violinBtn).not.toBeNull();
    violinBtn.click();
    expect(view.getConfig().soundType).toBe('violin');
    expect(violinBtn.classList.contains('active')).toBe(true);

    saved = JSON.parse(localStorage.getItem('voice_training_preferences'));
    expect(saved.soundType).toBe('violin');

    // Test Sine Wave
    const sineBtn = container.querySelector('[data-sound-type="sine"]');
    expect(sineBtn).not.toBeNull();
    sineBtn.click();
    expect(view.getConfig().soundType).toBe('sine');
    expect(sineBtn.classList.contains('active')).toBe(true);

    saved = JSON.parse(localStorage.getItem('voice_training_preferences'));
    expect(saved.soundType).toBe('sine');

    // Switch back to piano
    const pianoBtn = container.querySelector('[data-sound-type="piano"]');
    expect(pianoBtn).not.toBeNull();
    pianoBtn.click();
    expect(view.getConfig().soundType).toBe('piano');
    expect(pianoBtn.classList.contains('active')).toBe(true);
  });
});


