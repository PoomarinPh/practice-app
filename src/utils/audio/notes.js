/**
 * @fileoverview Musical note definitions, frequency conversions, and interval calculations.
 * Strictly adheres to Google JavaScript Style Guide and VOICE_DESIGN.md.
 */

/**
 * Standard chromatic scale note names starting from C.
 * @type {readonly string[]}
 */
export const NOTE_NAMES = Object.freeze([
  'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B',
]);

/**
 * Common enharmonic flat-to-sharp mappings.
 * @type {Readonly<Record<string, string>>}
 */
const ENHARMONIC_FLATS = Object.freeze({
  Db: 'C#',
  Eb: 'D#',
  Fb: 'E',
  Gb: 'F#',
  Ab: 'G#',
  Bb: 'A#',
  Cb: 'B',
});

/**
 * Semitone distance mappings for the 12 primary chromatic intervals.
 * @type {Readonly<Record<string, number>>}
 */
export const INTERVAL_SEMITONES = Object.freeze({
  m2: 1,
  M2: 2,
  m3: 3,
  M3: 4,
  P4: 5,
  TT: 6,
  P5: 7,
  m6: 8,
  M6: 9,
  m7: 10,
  M7: 11,
  P8: 12,
});

/**
 * Human-readable display names for intervals.
 * @type {Readonly<Record<string, string>>}
 */
export const INTERVAL_NAMES = Object.freeze({
  m2: 'Minor 2nd',
  M2: 'Major 2nd',
  m3: 'Minor 3rd',
  M3: 'Major 3rd',
  P4: 'Perfect 4th',
  TT: 'Tritone',
  P5: 'Perfect 5th',
  m6: 'Minor 6th',
  M6: 'Major 6th',
  m7: 'Minor 7th',
  M7: 'Major 7th',
  P8: 'Perfect Octave',
});

/**
 * Converts a scientific note string (e.g., 'C4', 'A#3', 'Eb5') into its MIDI note number.
 * @param {string} noteStr - Scientific pitch notation string.
 * @returns {number} MIDI note number (e.g., 60 for C4, 69 for A4).
 * @throws {Error} If note format is invalid.
 */
export function noteToMidi(noteStr) {
  if (typeof noteStr !== 'string') {
    throw new Error(`Invalid note: expected string, received ${typeof noteStr}`);
  }

  const trimmed = noteStr.trim();
  const match = trimmed.match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) {
    throw new Error(`Invalid scientific pitch notation format: "${noteStr}"`);
  }

  let [, pitchName, octaveStr] = match;
  pitchName = pitchName.charAt(0).toUpperCase() + pitchName.slice(1);
  const octave = parseInt(octaveStr, 10);

  // Normalize enharmonic flats to sharp equivalent
  const normalizedPitch = ENHARMONIC_FLATS[pitchName] || pitchName;
  const noteIndex = NOTE_NAMES.indexOf(normalizedPitch);
  if (noteIndex === -1) {
    throw new Error(`Unknown pitch name: "${pitchName}"`);
  }

  // MIDI 12 = C0, MIDI 60 = C4
  return (octave + 1) * 12 + noteIndex;
}

/**
 * Converts a MIDI note number into canonical scientific pitch notation (e.g., 60 -> 'C4').
 * @param {number} midi - MIDI note number.
 * @returns {string} Canonical note name.
 */
export function midiToNote(midi) {
  const rounded = Math.round(midi);
  const noteIndex = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

/**
 * Converts a MIDI note number to its exact equal-temperament frequency in Hertz (A4 = 440 Hz).
 * @param {number} midi - MIDI note number.
 * @returns {number} Frequency in Hz.
 */
export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Converts a scientific note name (e.g. 'A4') directly to its frequency in Hertz.
 * @param {string} noteStr - Scientific pitch notation string.
 * @returns {number} Frequency in Hz.
 */
export function noteToFreq(noteStr) {
  return midiToFreq(noteToMidi(noteStr));
}

/**
 * Converts a frequency in Hertz to its fractional MIDI note value (A4 = 440 Hz -> 69.0).
 * @param {number} freq - Frequency in Hz.
 * @returns {number} Fractional MIDI note number.
 */
export function freqToMidi(freq) {
  if (freq <= 0) {
    return 0;
  }
  return 69 + 12 * Math.log2(freq / 440);
}

/**
 * Computes the deviation in cents between two frequencies: 1200 * log2(f1 / f2).
 * Positive means f1 is sharp (higher) relative to f2; negative means flat (lower).
 * @param {number} f1 - Tested or detected frequency.
 * @param {number} f2 - Target reference frequency.
 * @returns {number} Cent difference.
 */
export function centsDifference(f1, f2) {
  if (f1 <= 0 || f2 <= 0) {
    return 0;
  }
  return 1200 * Math.log2(f1 / f2);
}

/**
 * Returns the semitone distance for a given interval short code (e.g., 'P5' -> 7).
 * @param {string} code - Interval code (m2, M2, ..., P8).
 * @returns {number} Semitones.
 */
export function getIntervalSemitones(code) {
  return INTERVAL_SEMITONES[code] || 0;
}

/**
 * Returns the human-readable display name for an interval short code (e.g., 'P5' -> 'Perfect 5th').
 * @param {string} code - Interval code.
 * @returns {string} Human-readable name.
 */
export function getIntervalName(code) {
  return INTERVAL_NAMES[code] || code;
}
