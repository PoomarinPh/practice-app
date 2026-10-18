/**
 * @fileoverview Web Audio Procedural Acoustic Piano Synthesizer (PianoSynth).
 * Generates rich acoustic piano tones via multi-harmonic additive synthesis,
 * hammer percussion transients, and natural exponential decay envelopes.
 * Completely offline with zero external audio assets.
 * Strictly adheres to Google JavaScript Style Guide and VOICE_DESIGN.md.
 */

import { noteToFreq } from './notes.js';

/**
 * Harmonic configuration representing piano string acoustic spectrum.
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
   * @param {number} [options.masterVolume=0.8] - Master volume multiplier.
   */
  constructor(options = {}) {
    this.ctx = options.audioContext || null;
    this.masterVolume = options.masterVolume !== undefined ? options.masterVolume : 0.8;
    this.masterGainNode = null;

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
    if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      await ctx.resume();
    }
  }

  /**
   * Synthesizes and plays a single acoustic piano tone.
   * @param {number|string} freqOrNote - Frequency in Hz or note string (e.g., 'C4', 'A#4').
   * @param {number} [duration=2.0] - Tone duration in seconds.
   * @param {number|null} [startTime=null] - Scheduled start audio time (defaults to currentTime).
   * @param {number} [volume=0.8] - Note velocity volume (0.0 to 1.0).
   * @returns {Promise<void>}
   */
  async playTone(freqOrNote, duration = 2.0, startTime = null, volume = 0.8) {
    await this.ensureAudioRunning();
    const ctx = this.getContext();
    if (!ctx) {
      return;
    }

    const freq = typeof freqOrNote === 'string' ? noteToFreq(freqOrNote) : freqOrNote;
    if (!freq || freq <= 0) {
      return;
    }

    const start = startTime !== null && startTime !== undefined ? startTime : ctx.currentTime;
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

    await this.ensureAudioRunning();
    const ctx = this.getContext();
    const now = ctx ? ctx.currentTime : 0;

    if (style === 'harmonic') {
      // Simultaneous playback
      await Promise.all([
        this.playTone(note1, noteDuration, now, volume),
        this.playTone(note2, noteDuration, now, volume),
      ]);
    } else {
      // Melodic sequential playback (Note 1, then Note 2)
      const note2Start = now + noteDuration + gapDuration;
      await Promise.all([
        this.playTone(note1, noteDuration, now, volume),
        this.playTone(note2, noteDuration, note2Start, volume),
      ]);
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
