/**
 * @fileoverview Unit test suite for PianoSynth (Web Audio Procedural Piano Synthesizer).
 * Tests audio context initialization, tone playback, harmonic scheduling,
 * and melodic vs harmonic interval sequencing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PianoSynth } from '../src/utils/audio/piano-synth.js';

describe('PianoSynth Procedural Piano Synthesizer', () => {
  let synth;
  let mockContext;
  let mockGainNode;
  let mockOscillator;

  beforeEach(() => {
    mockGainNode = {
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    mockOscillator = {
      type: 'sine',
      frequency: {
        value: 440,
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    mockContext = {
      state: 'running',
      currentTime: 1.0,
      destination: {},
      createGain: vi.fn(() => ({ ...mockGainNode })),
      createOscillator: vi.fn(() => ({ ...mockOscillator })),
      createBufferSource: vi.fn(() => ({
        buffer: null,
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
      })),
      createBuffer: vi.fn(() => ({
        getChannelData: vi.fn(() => new Float32Array(500)),
      })),
      createBiquadFilter: vi.fn(() => ({
        type: 'bandpass',
        frequency: { value: 1000 },
        Q: { value: 1 },
        connect: vi.fn(),
      })),
      decodeAudioData: vi.fn().mockImplementation(() => Promise.resolve({
        duration: 2.0,
        numberOfChannels: 2,
        sampleRate: 44100,
      })),
      resume: vi.fn().mockResolvedValue(),
      close: vi.fn().mockResolvedValue(),
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
    });

    synth = new PianoSynth({ audioContext: mockContext });
  });

  afterEach(() => {
    synth.close();
    vi.restoreAllMocks();
  });

  it('initializes with provided audio context and master gain', () => {
    expect(synth.getContext()).toBe(mockContext);
    expect(mockContext.createGain).toHaveBeenCalled();
  });

  it('resumes audio context if suspended on playback', async () => {
    mockContext.state = 'suspended';
    await synth.playTone('A4', 0.02);
    expect(mockContext.resume).toHaveBeenCalled();
  });

  it('resumes audio context if interrupted on playback', async () => {
    mockContext.state = 'interrupted';
    await synth.playTone('A4', 0.02);
    expect(mockContext.resume).toHaveBeenCalled();
  });

  it('clamps scheduled start time to currentTime if scheduled in the past', async () => {
    mockContext.currentTime = 10.5;
    await synth.loadSample('C4');
    await synth.playTone('C4', 0.5, 5.0);

    const source = mockContext.createBufferSource.mock.results[0].value;
    expect(source.start).toHaveBeenCalledWith(10.5);
  });

  it('schedules multi-harmonic oscillators for an acoustic piano tone', async () => {
    await synth.playTone(440, 0.02);

    // Multi-harmonic additive synthesis creates multiple oscillators (fundamental + harmonics)
    expect(mockContext.createOscillator).toHaveBeenCalled();
    expect(mockContext.createOscillator.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('plays melodic sequential interval (note1 then note2)', async () => {
    const playToneSpy = vi.spyOn(synth, 'playTone').mockResolvedValue();

    await synth.playInterval('C4', 'G4', { style: 'melodic', noteDuration: 0.5, gapDuration: 0.1 });

    expect(playToneSpy).toHaveBeenCalledTimes(2);
    expect(playToneSpy).toHaveBeenNthCalledWith(1, 'C4', 0.5, expect.any(Number), expect.any(Number));
    expect(playToneSpy).toHaveBeenNthCalledWith(2, 'G4', 0.5, expect.any(Number), expect.any(Number));
  });

  it('plays harmonic simultaneous interval (both notes together)', async () => {
    const playToneSpy = vi.spyOn(synth, 'playTone').mockResolvedValue();

    await synth.playInterval('C4', 'G4', { style: 'harmonic', noteDuration: 1.0 });

    expect(playToneSpy).toHaveBeenCalledTimes(2);
    expect(playToneSpy).toHaveBeenCalledWith('C4', 1.0, expect.any(Number), expect.any(Number));
    expect(playToneSpy).toHaveBeenCalledWith('G4', 1.0, expect.any(Number), expect.any(Number));
  });

  it('stops all active voices immediately when stopAll() is called', () => {
    synth.playTone('C4', 2.0);
    expect(() => synth.stopAll()).not.toThrow();
  });

  describe('Acoustic MP3 Sample Loading & Playback', () => {
    it('loads and caches MP3 audio buffer for a given note', async () => {
      const buffer1 = await synth.loadSample('C4');
      expect(buffer1).toBeDefined();
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('C4.mp3'));

      // Subsequent call should return cached buffer without fetching again
      const buffer2 = await synth.loadSample('C4');
      expect(buffer2).toBe(buffer1);
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    it('preloads multiple notes in parallel', async () => {
      await synth.preloadNotes(['C4', 'E4', 'G4']);
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });

    it('plays acoustic sample using AudioBufferSourceNode when sample is loaded', async () => {
      await synth.loadSample('A4');
      await synth.playTone('A4', 0.5);

      expect(mockContext.createBufferSource).toHaveBeenCalled();
    });

    it('gracefully falls back to procedural synthesis when fetch fails', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await synth.playTone('Db5', 0.05);

      // Procedural fallback should kick in and create oscillators
      expect(mockContext.createOscillator).toHaveBeenCalled();
    });
  });

  describe('Pure Sine Wave Mode (soundType: sine)', () => {
    it('initializes with default soundType as piano and allows changing to sine', () => {
      expect(synth.getSoundType()).toBe('piano');
      synth.setSoundType('sine');
      expect(synth.getSoundType()).toBe('sine');
    });

    it('plays pure single sine oscillator at exact note frequency when soundType is sine', async () => {
      synth.setSoundType('sine');
      await synth.playTone('A4', 0.5);

      // In sine mode, it creates exactly 1 oscillator of type 'sine' set to 440 Hz
      expect(mockContext.createOscillator).toHaveBeenCalledTimes(1);
      const osc = mockContext.createOscillator.mock.results[0].value;
      expect(osc.type).toBe('sine');
      expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(440, expect.any(Number));
    });

    it('plays simultaneous sine oscillators in playChord when soundType is sine', async () => {
      synth.setSoundType('sine');
      await synth.playChord(['C4', 'G4'], 2.0);

      // 2 notes => 2 oscillators of type sine
      expect(mockContext.createOscillator).toHaveBeenCalledTimes(2);
      const osc1 = mockContext.createOscillator.mock.results[0].value;
      const osc2 = mockContext.createOscillator.mock.results[1].value;
      expect(osc1.type).toBe('sine');
      expect(osc2.type).toBe('sine');
    });
  });

  describe('Cello & Violin Acoustic Instruments', () => {
    it('supports setting soundType to cello and violin', () => {
      synth.setSoundType('cello');
      expect(synth.getSoundType()).toBe('cello');

      synth.setSoundType('violin');
      expect(synth.getSoundType()).toBe('violin');

      synth.setSoundType('invalid');
      expect(synth.getSoundType()).toBe('piano');
    });

    it('fetches from /sounds/cello/ when soundType is cello', async () => {
      synth.setSoundType('cello');
      await synth.loadSample('C3');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/sounds\/cello\/C3\.mp3$/)
      );
      expect(mockContext.decodeAudioData).toHaveBeenCalled();
    });

    it('fetches from /sounds/violin/ when soundType is violin', async () => {
      synth.setSoundType('violin');
      await synth.loadSample('A4');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/sounds\/violin\/A4\.mp3$/)
      );
      expect(mockContext.decodeAudioData).toHaveBeenCalled();
    });

    it('isolates sample cache between different instruments', async () => {
      synth.setSoundType('piano');
      await synth.loadSample('C4');

      synth.setSoundType('cello');
      await synth.loadSample('C4');

      synth.setSoundType('violin');
      await synth.loadSample('C4');

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/sounds\/piano\/C4\.mp3$/)
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/sounds\/cello\/C4\.mp3$/)
      );
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/sounds\/violin\/C4\.mp3$/)
      );
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    });
  });
});

