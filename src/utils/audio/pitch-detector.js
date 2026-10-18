/**
 * @fileoverview High-accuracy YIN pitch detection engine for vocal interval breakdown.
 * Implements difference function, cumulative mean normalized difference,
 * parabolic sub-bin peak interpolation, RMS silence gating, and tuner evaluation.
 * Strictly adheres to Google JavaScript Style Guide and VOICE_DESIGN.md.
 */

import { centsDifference } from './notes.js';

/**
 * Default YIN algorithm configuration options.
 */
export const DEFAULT_YIN_OPTIONS = Object.freeze({
  minRms: 0.015,
  threshold: 0.12,
  minFreq: 65,
  maxFreq: 2200,
});

/**
 * Computes the Root Mean Square (RMS) amplitude of an audio buffer.
 * @param {Float32Array} buffer - Time-domain PCM audio buffer.
 * @returns {number} RMS value between 0 and 1.
 */
export function calculateRms(buffer) {
  if (!buffer || buffer.length === 0) {
    return 0;
  }
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
}

/**
 * Computes Step 1 of YIN: the difference function d(tau).
 * d(tau) = sum_{j=0}^{W-1} (x[j] - x[j + tau])^2
 * @param {Float32Array} buffer - Input time-domain signal.
 * @param {number} windowSize - Integration window size W (typically half buffer length).
 * @returns {Float32Array} Difference function array of size windowSize.
 */
export function differenceFunction(buffer, windowSize) {
  const diff = new Float32Array(windowSize);
  diff[0] = 0;

  for (let tau = 1; tau < windowSize; tau++) {
    let sum = 0;
    for (let j = 0; j < windowSize; j++) {
      const delta = buffer[j] - buffer[j + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  return diff;
}

/**
 * Computes Step 2 of YIN: the Cumulative Mean Normalized Difference d'(tau).
 * d'(0) = 1
 * d'(tau) = d(tau) / [ (1 / tau) * sum_{j=1}^{tau} d(j) ]
 * @param {Float32Array} diff - Raw difference function array.
 * @returns {Float32Array} Normalized difference array.
 */
export function cumulativeMeanNormalizedDifference(diff) {
  const length = diff.length;
  const cmnd = new Float32Array(length);
  cmnd[0] = 1;

  let runningSum = 0;
  for (let tau = 1; tau < length; tau++) {
    runningSum += diff[tau];
    if (runningSum === 0) {
      cmnd[tau] = 1;
    } else {
      cmnd[tau] = (diff[tau] * tau) / runningSum;
    }
  }

  return cmnd;
}

/**
 * Performs Step 4 of YIN: Parabolic interpolation on a discrete peak/trough.
 * Refines the integer lag tau to sub-sample precision using quadratic peak fitting.
 * @param {ArrayLike<number>} values - Array containing at least values at xIndex-1, xIndex, xIndex+1.
 * @param {number} xIndex - Integer index of local minimum.
 * @returns {{ offset: number, refinedIndex: number }} Parabolic offset and refined index.
 */
export function parabolicInterpolation(values, xIndex) {
  if (xIndex <= 0 || xIndex >= values.length - 1) {
    return { offset: 0, refinedIndex: xIndex };
  }

  const alpha = values[xIndex - 1];
  const beta = values[xIndex];
  const gamma = values[xIndex + 1];

  const denominator = 2 * (2 * beta - alpha - gamma);
  if (denominator === 0) {
    return { offset: 0, refinedIndex: xIndex };
  }

  const offset = (gamma - alpha) / denominator;
  return {
    offset,
    refinedIndex: xIndex + offset,
  };
}

/**
 * Analyzes a PCM audio buffer using the complete YIN pitch detection algorithm.
 * @param {Float32Array} buffer - Time domain audio buffer.
 * @param {number} sampleRate - AudioContext sample rate (e.g., 44100 or 48000).
 * @param {Partial<typeof DEFAULT_YIN_OPTIONS>} [options={}] - Custom options.
 * @returns {{
 *   pitch: number|null,
 *   isVoiced: boolean,
 *   clarity: number,
 *   rms: number,
 *   tau: number|null
 * }} Detection result.
 */
export function detectPitchYin(buffer, sampleRate, options = {}) {
  const opts = { ...DEFAULT_YIN_OPTIONS, ...options };
  const rms = calculateRms(buffer);

  if (rms < opts.minRms) {
    return {
      pitch: null,
      isVoiced: false,
      clarity: 0,
      rms,
      tau: null,
    };
  }

  const windowSize = Math.floor(buffer.length / 2);
  const diff = differenceFunction(buffer, windowSize);
  const cmnd = cumulativeMeanNormalizedDifference(diff);

  const minTau = Math.max(2, Math.floor(sampleRate / opts.maxFreq));
  const maxTau = Math.min(windowSize - 2, Math.ceil(sampleRate / opts.minFreq));

  let chosenTau = -1;

  // Step 3: Absolute thresholding - find first dip below threshold
  for (let tau = minTau; tau <= maxTau; tau++) {
    if (cmnd[tau] < opts.threshold) {
      // Find the local minimum in this trough
      while (tau + 1 <= maxTau && cmnd[tau + 1] < cmnd[tau]) {
        tau++;
      }
      chosenTau = tau;
      break;
    }
  }

  // Fallback: If no dip reached threshold, find global minimum in allowable range
  if (chosenTau === -1) {
    let globalMinVal = Infinity;
    let globalMinTau = -1;
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (cmnd[tau] < globalMinVal) {
        globalMinVal = cmnd[tau];
        globalMinTau = tau;
      }
    }

    // Only accept fallback if reasonable periodicity exists
    if (globalMinVal < 0.85 && globalMinTau !== -1) {
      chosenTau = globalMinTau;
    }
  }

  if (chosenTau === -1) {
    return {
      pitch: null,
      isVoiced: false,
      clarity: 0,
      rms,
      tau: null,
    };
  }

  // Step 4: Parabolic interpolation
  const interpolation = parabolicInterpolation(cmnd, chosenTau);
  const refinedTau = interpolation.refinedIndex;

  if (refinedTau <= 0) {
    return {
      pitch: null,
      isVoiced: false,
      clarity: 0,
      rms,
      tau: null,
    };
  }

  const pitch = sampleRate / refinedTau;
  const clarity = Math.max(0, Math.min(1, 1 - cmnd[chosenTau]));

  return {
    pitch,
    isVoiced: true,
    clarity,
    rms,
    tau: refinedTau,
  };
}

/**
 * Evaluates the accuracy of a sung pitch against a reference target frequency.
 * Thresholds defined in VOICE_DESIGN.md:
 * - Flawless: <= 12 cents
 * - In Tune: <= 50 cents (isCorrect: true)
 * - Out of Tune: > 50 cents (isCorrect: false)
 * @param {number} sungFreq - Detected vocal frequency in Hz.
 * @param {number} targetFreq - Target note frequency in Hz.
 * @returns {{
 *   cents: number,
 *   isCorrect: boolean,
 *   rating: 'flawless' | 'in-tune' | 'out-of-tune'
 * }} Pitch evaluation metrics.
 */
export function evaluatePitchAccuracy(sungFreq, targetFreq) {
  const diff = centsDifference(sungFreq, targetFreq);
  const absDiff = Math.abs(diff);

  let rating = 'out-of-tune';
  let isCorrect = false;

  if (absDiff <= 12) {
    rating = 'flawless';
    isCorrect = true;
  } else if (absDiff <= 50) {
    rating = 'in-tune';
    isCorrect = true;
  }

  return {
    cents: Math.round(diff * 10) / 10,
    isCorrect,
    rating,
  };
}

/**
 * Computes the median of an array of numbers, discarding transient vocal glitches.
 * @param {number[]} values - Array of numeric samples.
 * @returns {number} Median value.
 */
export function medianFilter(values) {
  if (!values || values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Manages microphone input streams and Web Audio AnalyserNode integration for real-time pitch detection.
 */
export class PitchDetector {
  /**
   * @param {Object} [options={}]
   * @param {AudioContext} [options.audioContext] - Existing Web Audio context.
   * @param {number} [options.fftSize=2048] - AnalyserNode FFT size.
   * @param {number} [options.minRms=0.015] - Silence gating threshold.
   */
  constructor({ audioContext = null, fftSize = 2048, minRms = 0.015 } = {}) {
    /** @type {AudioContext|null} */
    this.audioContext = audioContext;
    this.fftSize = fftSize;
    this.minRms = minRms;

    /** @type {MediaStream|null} */
    this.mediaStream = null;
    /** @type {MediaStreamAudioSourceNode|null} */
    this.sourceNode = null;
    /** @type {AnalyserNode|null} */
    this.analyserNode = null;
    /** @type {Float32Array|null} */
    this.timeBuffer = null;
    /** @type {boolean} */
    this.isListening = false;
  }

  /**
   * Initializes or returns the active AudioContext.
   * @returns {AudioContext}
   */
  getOrCreateContext() {
    if (!this.audioContext) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioCtx();
    }
    return this.audioContext;
  }

  /**
   * Connects an active MediaStream (e.g. from getUserMedia) to the audio pipeline.
   * @param {MediaStream} stream - Microphone media stream.
   */
  start(stream) {
    this.stop();

    const ctx = this.getOrCreateContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    this.mediaStream = stream;
    this.analyserNode = ctx.createAnalyser();
    this.analyserNode.fftSize = this.fftSize;
    this.timeBuffer = new Float32Array(this.analyserNode.fftSize);

    this.sourceNode = ctx.createMediaStreamSource(stream);
    this.sourceNode.connect(this.analyserNode);

    this.isListening = true;
  }

  /**
   * Requests microphone access via getUserMedia and starts pitch detection.
   * @returns {Promise<MediaStream>} Active audio stream.
   */
  async startMicrophone() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Microphone access is not supported by this browser environment');
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: true,
      },
    });

    this.start(stream);
    return stream;
  }

  /**
   * Stops listening, disconnects audio nodes, and terminates media tracks.
   */
  stop() {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      try {
        const tracks = this.mediaStream.getTracks();
        tracks.forEach((track) => track.stop());
      } catch {
        // Ignore track stop errors
      }
      this.mediaStream = null;
    }

    this.analyserNode = null;
    this.timeBuffer = null;
    this.isListening = false;
  }

  /**
   * Returns whether the pitch detector is actively listening.
   * @returns {boolean}
   */
  isActive() {
    return this.isListening;
  }

  /**
   * Reads the current time-domain buffer from the analyser and performs YIN pitch detection.
   * @returns {{
   *   pitch: number|null,
   *   isVoiced: boolean,
   *   clarity: number,
   *   rms: number,
   *   tau: number|null
   * }} Pitch detection result.
   */
  sampleCurrentPitch() {
    if (!this.isListening || !this.analyserNode || !this.timeBuffer) {
      return {
        pitch: null,
        isVoiced: false,
        clarity: 0,
        rms: 0,
        tau: null,
      };
    }

    this.analyserNode.getFloatTimeDomainData(this.timeBuffer);
    const sampleRate = this.audioContext ? this.audioContext.sampleRate : 44100;

    return detectPitchYin(this.timeBuffer, sampleRate, { minRms: this.minRms });
  }
}
