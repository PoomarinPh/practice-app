/**
 * @fileoverview Unit test suite for PitchDetector & YIN pitch detection algorithm.
 * Strictly adheres to Google JavaScript Style Guide and VOICE_DESIGN.md.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  calculateRms,
  differenceFunction,
  cumulativeMeanNormalizedDifference,
  parabolicInterpolation,
  detectPitchYin,
  evaluatePitchAccuracy,
  medianFilter,
  extractStablePitch,
  DEFAULT_YIN_OPTIONS,
  PitchDetector,
} from '../src/utils/audio/pitch-detector.js';

/**
 * Generates a synthetic sine wave buffer for testing.
 * @param {number} frequency - Target frequency in Hz.
 * @param {number} sampleRate - Audio sample rate (e.g., 44100).
 * @param {number} length - Number of samples.
 * @param {number} [amplitude=0.8] - Signal amplitude.
 * @returns {Float32Array} Synthetic audio buffer.
 */
function generateSineWave(frequency, sampleRate, length, amplitude = 0.8) {
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    buffer[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return buffer;
}

/**
 * Generates a synthetic multi-harmonic signal (fundamental + strong 2nd/3rd harmonics).
 * Tests resistance to octave jumping.
 * @param {number} fundamental - Fundamental frequency in Hz.
 * @param {number} sampleRate - Audio sample rate.
 * @param {number} length - Number of samples.
 * @returns {Float32Array} Synthetic multi-harmonic buffer.
 */
function generateHarmonicTone(fundamental, sampleRate, length) {
  const buffer = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    // Fundamental + 2nd harmonic (even stronger) + 3rd harmonic
    buffer[i] =
      0.4 * Math.sin(2 * Math.PI * fundamental * t) +
      0.5 * Math.sin(2 * Math.PI * fundamental * 2 * t) +
      0.2 * Math.sin(2 * Math.PI * fundamental * 3 * t);
  }
  return buffer;
}

describe('YIN Pitch Detection Mathematical Primitives', () => {
  const sampleRate = 44100;
  const bufferLength = 2048;

  it('calculates RMS volume and identifies silence', () => {
    const silentBuffer = new Float32Array(1024);
    expect(calculateRms(silentBuffer)).toBe(0);

    const quietNoise = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      quietNoise[i] = 0.005 * (Math.random() * 2 - 1);
    }
    expect(calculateRms(quietNoise)).toBeLessThan(0.015);

    const activeSignal = generateSineWave(440, sampleRate, 1024, 0.5);
    // RMS of sine wave with peak amplitude A is A / sqrt(2) ≈ 0.353
    expect(calculateRms(activeSignal)).toBeCloseTo(0.353, 2);
  });

  it('computes difference function d(tau) with d(0) = 0 and minimum at period', () => {
    const freq = 441; // Period = 44100 / 441 = 100 samples
    const signal = generateSineWave(freq, sampleRate, bufferLength);
    const windowSize = 512;
    const diff = differenceFunction(signal, windowSize);

    expect(diff[0]).toBe(0);
    // At tau = 100 (exact period), diff should be minimal
    expect(diff[100]).toBeLessThan(diff[50]);
    expect(diff[100]).toBeCloseTo(0, 1);
  });

  it('computes cumulative mean normalized difference d\'(tau)', () => {
    const freq = 441; // Period = 100 samples
    const signal = generateSineWave(freq, sampleRate, bufferLength);
    const windowSize = 512;
    const diff = differenceFunction(signal, windowSize);
    const cmnd = cumulativeMeanNormalizedDifference(diff);

    expect(cmnd[0]).toBe(1);
    // The normalized dip at the fundamental period should be very close to 0
    expect(cmnd[100]).toBeLessThan(0.1);
  });

  it('interpolates sub-sample peak accurately via parabolic interpolation', () => {
    // True minimum at tau = 100.25
    // Quadratic: y = a*(x - 100.25)^2 + c
    const x0 = 99;
    const x1 = 100;
    const x2 = 101;
    const f = (x) => 0.5 * Math.pow(x - 100.25, 2) + 0.05;

    const refined = parabolicInterpolation([f(x0), f(x1), f(x2)], 1);
    expect(refined.offset).toBeCloseTo(0.25, 2);
  });
});

describe('detectPitchYin Algorithm Execution', () => {
  const sampleRate = 44100;
  const bufferLength = 2048;

  it('returns null pitch for silence or low RMS below threshold', () => {
    const silentBuffer = new Float32Array(bufferLength);
    const result = detectPitchYin(silentBuffer, sampleRate, { minRms: 0.015 });

    expect(result.pitch).toBeNull();
    expect(result.isVoiced).toBe(false);
    expect(result.clarity).toBe(0);
  });

  it('accurately detects pure A4 (440 Hz) within 1 Hz', () => {
    const signal = generateSineWave(440, sampleRate, bufferLength);
    const result = detectPitchYin(signal, sampleRate);

    expect(result.isVoiced).toBe(true);
    expect(result.pitch).toBeGreaterThan(439);
    expect(result.pitch).toBeLessThan(441);
    expect(result.clarity).toBeGreaterThan(0.9);
  });

  it('accurately detects middle C (C4 ~ 261.63 Hz)', () => {
    const signal = generateSineWave(261.63, sampleRate, bufferLength);
    const result = detectPitchYin(signal, sampleRate);

    expect(result.isVoiced).toBe(true);
    expect(result.pitch).toBeCloseTo(261.63, 0);
    expect(result.clarity).toBeGreaterThan(0.9);
  });

  it('accurately detects high note C6 (~ 1046.5 Hz)', () => {
    const signal = generateSineWave(1046.5, sampleRate, bufferLength);
    const result = detectPitchYin(signal, sampleRate);

    expect(result.isVoiced).toBe(true);
    expect(result.pitch).toBeCloseTo(1046.5, 0);
  });

  it('detects fundamental frequency of complex harmonic tone without octave jump', () => {
    // 220 Hz (A3) fundamental with stronger 440 Hz 2nd harmonic
    const harmonicSignal = generateHarmonicTone(220, sampleRate, bufferLength);
    const result = detectPitchYin(harmonicSignal, sampleRate);

    expect(result.isVoiced).toBe(true);
    // YIN must latch onto fundamental 220 Hz, not the louder 440 Hz 2nd harmonic
    expect(result.pitch).toBeGreaterThan(218);
    expect(result.pitch).toBeLessThan(222);
  });
});

describe('evaluatePitchAccuracy', () => {
  it('correctly categorizes flawless pitch (within 12 cents)', () => {
    // A4 = 440 Hz. 6 cents sharp = 440 * 2^(6/1200) ≈ 441.53 Hz
    const fSung = 441.53;
    const fTarget = 440.0;
    const evaluation = evaluatePitchAccuracy(fSung, fTarget);

    expect(evaluation.isCorrect).toBe(true);
    expect(evaluation.rating).toBe('flawless');
    expect(evaluation.cents).toBeCloseTo(6, 0);
  });

  it('correctly categorizes in-tune pitch (within 50 cents)', () => {
    // 35 cents flat = 440 * 2^(-35/1200) ≈ 431.18 Hz
    const fSung = 431.18;
    const fTarget = 440.0;
    const evaluation = evaluatePitchAccuracy(fSung, fTarget);

    expect(evaluation.isCorrect).toBe(true);
    expect(evaluation.rating).toBe('in-tune');
    expect(evaluation.cents).toBeCloseTo(-35, 0);
  });

  it('correctly categorizes out-of-tune pitch (beyond 50 cents)', () => {
    // 70 cents sharp
    const fSung = 440 * Math.pow(2, 70 / 1200);
    const fTarget = 440.0;
    const evaluation = evaluatePitchAccuracy(fSung, fTarget);

    expect(evaluation.isCorrect).toBe(false);
    expect(evaluation.rating).toBe('out-of-tune');
    expect(evaluation.cents).toBeCloseTo(70, 0);
  });
});

describe('medianFilter helper', () => {
  it('rejects outliers and returns true median', () => {
    const pitches = [440, 442, 880, 439, 441]; // 880 is an octave glitch outlier
    const median = medianFilter(pitches);
    expect(median).toBe(441);
  });

  it('handles empty or single item arrays', () => {
    expect(medianFilter([])).toBe(0);
    expect(medianFilter([440])).toBe(440);
  });
});

describe('extractStablePitch Vocal Stability Engine', () => {
  it('has increased sensitivity with DEFAULT_YIN_OPTIONS.minRms set to 0.002', () => {
    expect(DEFAULT_YIN_OPTIONS.minRms).toBe(0.002);
  });

  it('correctly extracts pitch from stable vocal sustain', () => {
    const samples = [
      { pitch: 440, clarity: 0.9, rms: 0.05 },
      { pitch: 441, clarity: 0.92, rms: 0.06 },
      { pitch: 440, clarity: 0.88, rms: 0.05 },
    ];
    expect(extractStablePitch(samples)).toBe(440);
  });

  it('filters out attack scoops and release drops to prevent wild pitch variations', () => {
    const samples = [
      // 1. Onset attack scoop (sliding up from 390 Hz ~200 cents flat)
      { pitch: 390, clarity: 0.45, rms: 0.02 },
      { pitch: 410, clarity: 0.52, rms: 0.03 },
      // 2. Stable sustained note core (A4 ~440 Hz with high clarity)
      { pitch: 439, clarity: 0.88, rms: 0.07 },
      { pitch: 440, clarity: 0.94, rms: 0.08 },
      { pitch: 441, clarity: 0.92, rms: 0.08 },
      { pitch: 440, clarity: 0.91, rms: 0.08 },
      { pitch: 440, clarity: 0.89, rms: 0.07 },
      // 3. Release drop / vocal fry (dropping to 380 Hz on trailing breath)
      { pitch: 415, clarity: 0.48, rms: 0.02 },
      { pitch: 380, clarity: 0.40, rms: 0.01 },
    ];

    const pitch = extractStablePitch(samples);
    // Must lock onto the stable 440 Hz core, ignoring the 390 Hz scoop and 380 Hz drop
    expect(pitch).toBeCloseTo(440, 0);
  });

  it('discards low-clarity noise frames when high-clarity voice frames exist', () => {
    const samples = [
      { pitch: 120, clarity: 0.36, rms: 0.01 }, // low-clarity background room hum
      { pitch: 261.6, clarity: 0.85, rms: 0.06 },
      { pitch: 262.0, clarity: 0.90, rms: 0.07 },
      { pitch: 261.8, clarity: 0.88, rms: 0.07 },
      { pitch: 850, clarity: 0.38, rms: 0.01 }, // low-clarity transient noise
    ];

    expect(extractStablePitch(samples)).toBeCloseTo(261.8, 0);
  });

  it('gracefully handles raw number arrays and empty arrays', () => {
    expect(extractStablePitch([])).toBe(0);
    expect(extractStablePitch([440, 442, 440])).toBe(440);
  });
});

describe('PitchDetector Class & Audio Integration', () => {
  let detector;
  let mockContext;
  let mockAnalyser;
  let mockStream;
  let mockTrack;

  beforeEach(() => {
    mockTrack = {
      stop: vi.fn(),
    };

    mockStream = {
      getTracks: vi.fn(() => [mockTrack]),
    };

    mockAnalyser = {
      fftSize: 2048,
      getFloatTimeDomainData: vi.fn((buffer) => {
        // Fill with synthetic 440 Hz wave
        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / 44100);
        }
      }),
    };

    mockContext = {
      state: 'running',
      sampleRate: 44100,
      resume: vi.fn(async () => {}),
      createAnalyser: vi.fn(() => mockAnalyser),
      createMediaStreamSource: vi.fn(() => ({
        connect: vi.fn(),
        disconnect: vi.fn(),
      })),
    };

    detector = new PitchDetector({ audioContext: mockContext });
  });

  afterEach(() => {
    detector.stop();
  });

  it('starts listening with a media stream and configures analyser node', () => {
    detector.start(mockStream);
    expect(mockContext.createAnalyser).toHaveBeenCalled();
    expect(mockContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
    expect(detector.isActive()).toBe(true);
  });

  it('samples current pitch from active analyser node', () => {
    detector.start(mockStream);
    const result = detector.sampleCurrentPitch();

    expect(result.isVoiced).toBe(true);
    expect(result.pitch).toBeCloseTo(440, 0);
  });

  it('stops listening and releases audio tracks', () => {
    detector.start(mockStream);
    detector.stop();

    expect(mockTrack.stop).toHaveBeenCalled();
    expect(detector.isActive()).toBe(false);
  });
});
