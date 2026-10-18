/**
 * @fileoverview Hybrid Acoustic Grand Piano Synthesizer (PianoSynth).
 * Plays real recorded concert grand piano MP3 samples across all 88 keys with
 * zero-latency in-memory caching and offline Service Worker support.
 * Seamlessly falls back to procedural multi-harmonic additive synthesis
 * if sample fetching is unavailable or running in headless environments.
 * Strictly adheres to Google JavaScript Style Guide and VOICE_DESIGN.md.
 */

import { noteToFreq, noteToSampleFilename } from './notes.js';

/**
 * Base directory containing acoustic grand piano MP3 samples.
 * Dynamically resolves Vite deployment base path (e.g. '/practice-app/sounds/piano/').
 * @type {string}
 */
const DEFAULT_SAMPLE_BASE_URL = (() => {
  const base =
    typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL
      ? import.meta.env.BASE_URL
      : '/';
  return `${base.replace(/\/$/, '')}/sounds/piano/`;
})();

/**
 * Harmonic configuration representing piano string acoustic spectrum for procedural fallback.
 * @type {readonly { multiplier: number, relativeGain: number, decayRate: number }[]}
 */
const PIANO_HARMONICS = Object.freeze([
  { multiplier: 1.0, relativeGain: 1.0, decayRate: 1.0 },
  { multiplier: 2.0, relativeGain: 0.45, decayRate: 1.25 },
  { multiplier: 3.0, relativeGain: 0.18, decayRate: 1.6 },
  { multiplier: 4.0, relativeGain: 0.06, decayRate: 2.2 },
]);

export class PianoSynth {
  /**
   * @param {Object} [options={}] - Synthesizer options.
   * @param {AudioContext} [options.audioContext] - Existing or mock audio context.
   * @param {number} [options.masterVolume=1.0] - Master volume multiplier.
   * @param {string} [options.sampleBaseUrl] - Custom base URL for MP3 samples.
   */
  constructor(options = {}) {
    this.ctx = options.audioContext || null;
    this.masterVolume = options.masterVolume !== undefined ? options.masterVolume : 1.0;
    this.masterGainNode = null;
    this.sampleBaseUrl = options.sampleBaseUrl || DEFAULT_SAMPLE_BASE_URL;

    /**
     * In-memory cache of decoded AudioBuffers keyed by sample filename.
     * @type {Map<string, AudioBuffer>}
     */
    this.sampleCache = new Map();

    /**
     * Map of active loading promises to prevent duplicate in-flight network requests.
     * @private
     * @type {Map<string, Promise<AudioBuffer | null>>}
     */
    this.loadingPromises = new Map();

    /**
     * Set of active oscillators and gain nodes for cleanup.
     * @private
     * @type {Set<{ stop?: Function, disconnect?: Function }>}
     */
    this.activeNodes = new Set();
  }

  /**
   * Lazily initializes and returns the Web Audio Context.
   * @returns {AudioContext}
   */
  getContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
      if (typeof navigator !== 'undefined' && navigator.audioSession) {
        try {
          navigator.audioSession.type = 'playback';
        } catch {
          // Safe ignore
        }
      }
    }

    if (this.ctx && !this.masterGainNode) {
      this.masterGainNode = this.ctx.createGain();
      this.masterGainNode.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime || 0);
      this.masterGainNode.connect(this.ctx.destination);
    }

    return this.ctx;
  }

  /**
   * Resumes the AudioContext if suspended (required by iOS Safari and modern browsers).
   * @returns {Promise<void>}
   */
  async ensureAudioRunning() {
    const ctx = this.getContext();
    if (ctx && ctx.state !== 'running' && typeof ctx.resume === 'function') {
      await ctx.resume();
    }
  }

  /**
   * Fetches and decodes an acoustic piano MP3 sample into an AudioBuffer.
   * Returns cached buffer if already loaded, or deduplicates in-flight fetches.
   * @param {string|number} noteOrFilename - Scientific pitch name (e.g. 'C4', 'Eb5') or MIDI number.
   * @returns {Promise<AudioBuffer | null>} Decoded AudioBuffer or null on failure.
   */
  async loadSample(noteOrFilename) {
    let filename;
    try {
      if (typeof noteOrFilename === 'string' && noteOrFilename.endsWith('.mp3')) {
        filename = noteOrFilename;
      } else {
        filename = noteToSampleFilename(noteOrFilename);
      }
    } catch {
      return null;
    }

    if (this.sampleCache.has(filename)) {
      return this.sampleCache.get(filename);
    }

    if (this.loadingPromises.has(filename)) {
      return this.loadingPromises.get(filename);
    }

    const loadPromise = (async () => {
      try {
        const url = `${this.sampleBaseUrl}${filename}`;
        const response = await fetch(url);
        if (!response.ok) {
          return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        const ctx = this.getContext();
        if (!ctx || typeof ctx.decodeAudioData !== 'function') {
          return null;
        }

        const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
        this.sampleCache.set(filename, audioBuffer);
        return audioBuffer;
      } catch {
        return null;
      } finally {
        this.loadingPromises.delete(filename);
      }
    })();

    this.loadingPromises.set(filename, loadPromise);
    return loadPromise;
  }

  /**
   * Preloads and decodes multiple note samples in parallel for zero-latency drill playback.
   * @param {Array<string|number>} notes - List of notes or MIDI numbers to preload.
   * @returns {Promise<void>}
   */
  async preloadNotes(notes) {
    if (!Array.isArray(notes) || notes.length === 0) {
      return;
    }
    await Promise.allSettled(notes.map((note) => this.loadSample(note)));
  }

  /**
   * Plays a single acoustic grand piano tone. Prioritizes recorded MP3 sample playback,
   * falling back to rich procedural synthesis if the sample is unavailable.
   * @param {number|string} freqOrNote - Frequency in Hz or note string (e.g., 'C4', 'A#4').
   * @param {number} [duration=2.0] - Tone duration in seconds.
   * @param {number|null} [startTime=null] - Scheduled start audio time (defaults to currentTime).
   * @param {number} [volume=1.0] - Note velocity volume (0.0 to 1.0).
   * @returns {Promise<void>}
   */
  async playTone(freqOrNote, duration = 2.0, startTime = null, volume = 1.0) {
    await this.ensureAudioRunning();
    const ctx = this.getContext();
    if (!ctx) {
      return;
    }

    const start = startTime !== null && startTime !== undefined ? startTime : ctx.currentTime;

    // Check if we can play a real recorded acoustic grand piano sample
    let sampleBuffer = null;
    let noteName = null;

    if (typeof freqOrNote === 'string') {
      noteName = freqOrNote;
    }

    if (noteName) {
      try {
        const filename = noteToSampleFilename(noteName);
        if (this.sampleCache.has(filename)) {
          sampleBuffer = this.sampleCache.get(filename);
        } else {
          sampleBuffer = await this.loadSample(noteName);
        }
      } catch {
        sampleBuffer = null;
      }
    }

    if (sampleBuffer) {
      return this.playSample(sampleBuffer, duration, start, volume);
    }

    // Fallback to rich procedural additive synthesis
    const freq = typeof freqOrNote === 'string' ? noteToFreq(freqOrNote) : freqOrNote;
    if (!freq || freq <= 0) {
      return;
    }

    return this.playProceduralTone(freq, duration, start, volume);
  }

  /**
   * Plays a decoded acoustic piano AudioBuffer with smooth gain ramping and natural decay.
   * @private
   * @param {AudioBuffer} audioBuffer - Decoded audio sample buffer.
   * @param {number} duration - Playback duration in seconds.
   * @param {number} start - Scheduled start audio time.
   * @param {number} volume - Volume multiplier (0.0 to 1.0).
   * @returns {Promise<void>}
   */
  playSample(audioBuffer, duration, startTime, volume) {
    const ctx = this.getContext();
    if (!ctx) {
      return Promise.resolve();
    }

    const now = ctx.currentTime || 0;
    const start = startTime !== null && startTime !== undefined ? Math.max(now, startTime) : now;

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;

    const voiceGain = ctx.createGain();
    voiceGain.connect(this.masterGainNode || ctx.destination);

    const effectiveVolume = Math.max(0.0001, volume);
    voiceGain.gain.setValueAtTime(effectiveVolume, start);

    // Apply smooth exponential release ramp near end of duration
    const releaseTime = Math.min(0.08, duration * 0.2);
    const releaseStart = Math.max(start, start + duration - releaseTime);
    voiceGain.gain.setValueAtTime(effectiveVolume, releaseStart);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(voiceGain);
    source.start(start);
    source.stop(start + duration);

    this.activeNodes.add(source);
    this.activeNodes.add(voiceGain);

    setTimeout(() => {
      this.activeNodes.delete(source);
      this.activeNodes.delete(voiceGain);
      try {
        if (typeof source.disconnect === 'function') {
          source.disconnect();
        }
        if (typeof voiceGain.disconnect === 'function') {
          voiceGain.disconnect();
        }
      } catch {
        // Safe disconnect ignore
      }
    }, duration * 1000 + 50);

    return new Promise((resolve) => {
      setTimeout(resolve, duration * 1000);
    });
  }

  /**
   * Procedural acoustic piano synthesis fallback using additive oscillators and hammer noise.
   * @private
   * @param {number} freq - Fundamental frequency in Hz.
   * @param {number} duration - Duration in seconds.
   * @param {number} start - Scheduled audio time.
   * @param {number} volume - Velocity volume (0.0 to 1.0).
   * @returns {Promise<void>}
   */
  playProceduralTone(freq, duration, startTime, volume) {
    const ctx = this.getContext();
    if (!ctx) {
      return Promise.resolve();
    }

    const now = ctx.currentTime || 0;
    const start = startTime !== null && startTime !== undefined ? Math.max(now, startTime) : now;

    const toneGain = ctx.createGain();
    toneGain.connect(this.masterGainNode || ctx.destination);

    // Multi-stage envelope: rapid percussive attack (5ms), followed by exponential natural decay
    const attackTime = 0.006;
    toneGain.gain.setValueAtTime(0.0001, start);
    toneGain.gain.linearRampToValueAtTime(volume, start + attackTime);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    const voiceNodes = [];

    // Synthesize fundamental and acoustic harmonic overtones
    for (const harmonic of PIANO_HARMONICS) {
      const harmonicFreq = freq * harmonic.multiplier;
      // Filter out frequencies beyond human hearing threshold (20 kHz)
      if (harmonicFreq > 20000) {
        continue;
      }

      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = harmonic.multiplier === 1.0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(harmonicFreq, start);

      const harmonicBaseVol = harmonic.relativeGain;
      const harmonicDuration = Math.max(0.1, duration / harmonic.decayRate);

      oscGain.gain.setValueAtTime(harmonicBaseVol, start);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, start + harmonicDuration);

      osc.connect(oscGain);
      oscGain.connect(toneGain);

      osc.start(start);
      osc.stop(start + duration);

      voiceNodes.push(osc, oscGain);
      this.activeNodes.add(osc);
      this.activeNodes.add(oscGain);
    }

    // Synthesize acoustic felt hammer contact noise burst (15ms transient)
    try {
      const bufferSize = Math.floor(ctx.sampleRate ? ctx.sampleRate * 0.015 : 660);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate || 44100);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      const noiseSource = ctx.createBufferSource();
      noiseSource.buffer = noiseBuffer;

      const noiseFilter = ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.value = Math.min(12000, Math.max(400, freq * 1.5));
      noiseFilter.Q.value = 1.2;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.12 * volume, start);
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.015);

      noiseSource.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(toneGain);

      noiseSource.start(start);
      noiseSource.stop(start + 0.016);

      voiceNodes.push(noiseSource, noiseFilter, noiseGain);
      this.activeNodes.add(noiseSource);
    } catch {
      // Audio buffer creation can be safely skipped in strict headless test mocks
    }

    // Schedule cleanup when note finishes
    setTimeout(() => {
      for (const node of voiceNodes) {
        this.activeNodes.delete(node);
        try {
          if (typeof node.disconnect === 'function') {
            node.disconnect();
          }
        } catch {
          // Safe disconnect ignore
        }
      }
    }, duration * 1000 + 50);

    return new Promise((resolve) => {
      setTimeout(resolve, duration * 1000);
    });
  }

  /**
   * Plays a sequence of notes one after another (melodic sequence).
   * @param {Array<number|string>} notes - Array of note frequencies or note strings.
   * @param {number} [noteDuration=0.9] - Duration per note in seconds.
   * @param {number} [gapDuration=0.15] - Silence between notes in seconds.
   * @param {number} [volume=0.8] - Volume level.
   * @returns {Promise<void>}
   */
  async playSequential(notes, noteDuration = 0.9, gapDuration = 0.15, volume = 0.8) {
    if (Array.isArray(notes)) {
      await Promise.all(notes.map((note) => this.loadSample(note)));
    }

    await this.ensureAudioRunning();
    const ctx = this.getContext();
    const now = ctx ? ctx.currentTime : 0;
    const promises = [];
    let currentStart = now + 0.01;

    for (const note of notes) {
      promises.push(this.playTone(note, noteDuration, currentStart, volume));
      currentStart += noteDuration + gapDuration;
    }

    await Promise.all(promises);
  }

  /**
   * Plays a group of notes simultaneously as a chord (harmonic).
   * Preloads all samples first to guarantee synchronized audio start time without latency drift.
   * @param {Array<number|string>} notes - Array of note frequencies or note strings.
   * @param {number} [duration=2.0] - Duration in seconds.
   * @param {number} [volume=1.0] - Volume level.
   * @returns {Promise<void>}
   */
  async playChord(notes, duration = 2.0, volume = 1.0) {
    if (Array.isArray(notes)) {
      await Promise.all(notes.map((note) => this.loadSample(note)));
    }

    await this.ensureAudioRunning();
    const ctx = this.getContext();
    const now = ctx ? ctx.currentTime : 0;
    const start = now + 0.01;
    const promises = (notes || []).map((note) => this.playTone(note, duration, start, volume));
    await Promise.all(promises);
  }

  /**
   * Plays a two-note interval either sequentially (melodic) or simultaneously (harmonic).
   * @param {number|string} note1 - First note frequency or note name.
   * @param {number|string} note2 - Second note frequency or note name.
   * @param {Object} [options={}] - Playback options.
   * @param {'melodic'|'harmonic'} [options.style='melodic'] - Playback style.
   * @param {number} [options.noteDuration=0.9] - Duration per note in seconds.
   * @param {number} [options.gapDuration=0.15] - Silence between notes in melodic mode.
   * @param {number} [options.volume=0.8] - Volume level.
   * @returns {Promise<void>}
   */
  async playInterval(note1, note2, options = {}) {
    const style = options.style || 'melodic';
    const noteDuration = options.noteDuration !== undefined ? options.noteDuration : 0.9;
    const gapDuration = options.gapDuration !== undefined ? options.gapDuration : 0.15;
    const volume = options.volume !== undefined ? options.volume : 0.8;

    if (style === 'harmonic') {
      await this.playChord([note1, note2], noteDuration, volume);
    } else {
      await this.playSequential([note1, note2], noteDuration, gapDuration, volume);
    }
  }

  /**
   * Immediately stops and disconnects all actively playing voices.
   */
  stopAll() {
    for (const node of this.activeNodes) {
      try {
        if (typeof node.stop === 'function') {
          node.stop();
        }
        if (typeof node.disconnect === 'function') {
          node.disconnect();
        }
      } catch {
        // Safe disconnect ignore
      }
    }
    this.activeNodes.clear();
  }

  /**
   * Closes the underlying audio context and cleans up resources.
   * @returns {Promise<void>}
   */
  async close() {
    this.stopAll();
    if (this.ctx && typeof this.ctx.close === 'function') {
      await this.ctx.close();
      this.ctx = null;
      this.masterGainNode = null;
    }
  }
}
