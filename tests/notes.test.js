/**
 * @fileoverview Unit test suite for note-to-frequency, MIDI conversion,
 * intervals, and cent deviation math utilities.
 */

import { describe, expect, it } from 'vitest';
import {
  centsDifference,
  freqToMidi,
  getIntervalName,
  getIntervalSemitones,
  midiToFreq,
  midiToNote,
  noteToFreq,
  noteToMidi,
} from '../src/utils/audio/notes.js';

describe('Audio Notes & Musical Theory Utilities', () => {
  describe('noteToMidi() and midiToNote()', () => {
    it('converts standard reference notes accurately', () => {
      expect(noteToMidi('C4')).toBe(60);
      expect(noteToMidi('A4')).toBe(69);
      expect(noteToMidi('C3')).toBe(48);
      expect(noteToMidi('C7')).toBe(96);
      expect(noteToMidi('F#4')).toBe(66);
      expect(noteToMidi('Gb4')).toBe(66); // Enharmonic flat handling
    });

    it('converts MIDI numbers back to canonical note names', () => {
      expect(midiToNote(60)).toBe('C4');
      expect(midiToNote(69)).toBe('A4');
      expect(midiToNote(48)).toBe('C3');
      expect(midiToNote(96)).toBe('C7');
      expect(midiToNote(66)).toBe('F#4');
    });

    it('throws or handles invalid notes gracefully', () => {
      expect(() => noteToMidi('INVALID')).toThrow();
    });
  });

  describe('midiToFreq() and noteToFreq()', () => {
    it('calculates equal temperament frequencies accurately', () => {
      // A4 = 440 Hz
      expect(midiToFreq(69)).toBeCloseTo(440.0, 1);
      expect(noteToFreq('A4')).toBeCloseTo(440.0, 1);

      // Middle C (C4) = 261.63 Hz
      expect(noteToFreq('C4')).toBeCloseTo(261.63, 1);

      // C3 = 130.81 Hz
      expect(noteToFreq('C3')).toBeCloseTo(130.81, 1);

      // C7 = 2093.00 Hz
      expect(noteToFreq('C7')).toBeCloseTo(2093.0, 0);

      // A3 = 220 Hz
      expect(noteToFreq('A3')).toBeCloseTo(220.0, 1);
    });
  });

  describe('freqToMidi()', () => {
    it('converts exact frequency to MIDI number', () => {
      expect(freqToMidi(440)).toBeCloseTo(69.0, 2);
      expect(freqToMidi(261.63)).toBeCloseTo(60.0, 1);
    });
  });

  describe('centsDifference()', () => {
    it('returns 0 cents for identical frequencies', () => {
      expect(centsDifference(440, 440)).toBe(0);
    });

    it('calculates exact +100 cents for a semitone step up', () => {
      const a4 = 440;
      const aSharp4 = a4 * Math.pow(2, 1 / 12);
      expect(centsDifference(aSharp4, a4)).toBeCloseTo(100, 1);
    });

    it('calculates exact -100 cents for a semitone step down', () => {
      const a4 = 440;
      const aFlat4 = a4 * Math.pow(2, -1 / 12);
      expect(centsDifference(aFlat4, a4)).toBeCloseTo(-100, 1);
    });

    it('calculates +1200 cents for a full octave up', () => {
      expect(centsDifference(880, 440)).toBeCloseTo(1200, 1);
    });
  });

  describe('Intervals mapping', () => {
    it('maps all 12 intervals to correct semitone distances', () => {
      expect(getIntervalSemitones('m2')).toBe(1);
      expect(getIntervalSemitones('M2')).toBe(2);
      expect(getIntervalSemitones('m3')).toBe(3);
      expect(getIntervalSemitones('M3')).toBe(4);
      expect(getIntervalSemitones('P4')).toBe(5);
      expect(getIntervalSemitones('TT')).toBe(6);
      expect(getIntervalSemitones('P5')).toBe(7);
      expect(getIntervalSemitones('m6')).toBe(8);
      expect(getIntervalSemitones('M6')).toBe(9);
      expect(getIntervalSemitones('m7')).toBe(10);
      expect(getIntervalSemitones('M7')).toBe(11);
      expect(getIntervalSemitones('P8')).toBe(12);
    });

    it('provides human-readable interval names', () => {
      expect(getIntervalName('P5')).toBe('Perfect 5th');
      expect(getIntervalName('m3')).toBe('Minor 3rd');
      expect(getIntervalName('P8')).toBe('Perfect Octave');
      expect(getIntervalName('TT')).toBe('Tritone');
    });
  });
});
