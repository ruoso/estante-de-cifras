import { describe, it, expect } from 'vitest';
import {
  note,
  plainSpelling,
  parseNote,
  formatNote,
  pitchClass,
  isEnharmonic,
  degreeToInterval,
  transposeNote,
  parsePitch,
  formatPitch,
  pitchToMidi,
  transposePitch,
} from './pitch.js';

/** Convenience: spell a note from text, transpose, return text. */
const up = (from, degree, alter = 0) =>
  formatNote(transposeNote(parseNote(from), degreeToInterval(degree, alter)));

describe('note parsing and formatting', () => {
  it.each([
    ['C', 'C', 0],
    ['F#', 'F', 1],
    ['Bb', 'B', -1],
    ['Ebb', 'E', -2],
    ['G##', 'G', 2],
  ])('parses %s', (text, letter, accidental) => {
    expect(parseNote(text)).toEqual({ letter, accidental });
  });

  it('round-trips through formatNote', () => {
    for (const text of ['C', 'F#', 'Bb', 'Ebb', 'G##', 'A']) {
      expect(formatNote(parseNote(text))).toBe(text);
    }
  });

  it('is case-sensitive about the flat sign', () => {
    // `b` is a flat; `B` is a letter. Conflating them would make Bb ambiguous.
    expect(parseNote('Bb')).toEqual({ letter: 'B', accidental: -1 });
    expect(parseNote('B')).toEqual({ letter: 'B', accidental: 0 });
  });

  it('rejects nonsense', () => {
    for (const bad of ['H', 'C#b', '', 'Cbbb', '7']) {
      expect(() => parseNote(bad)).toThrow();
    }
  });
});

describe('pitch class', () => {
  it.each([
    ['C', 0],
    ['C#', 1],
    ['Db', 1],
    ['E', 4],
    ['Fb', 4],
    ['B', 11],
    ['Cb', 11],
    ['B#', 0],
  ])('%s has pitch class %i', (text, pc) => {
    expect(pitchClass(parseNote(text))).toBe(pc);
  });

  it('treats enharmonics as sounding alike but spelled differently', () => {
    const fSharp = parseNote('F#');
    const gFlat = parseNote('Gb');
    expect(isEnharmonic(fSharp, gFlat)).toBe(true);
    expect(formatNote(fSharp)).not.toBe(formatNote(gFlat));
  });
});

describe('degreeToInterval', () => {
  it.each([
    [1, 0, 0, 0],
    [3, 0, 2, 4],
    [5, 0, 4, 7],
    [7, 0, 6, 11],
    [7, -1, 6, 10], // dominant 7th
    [9, 0, 1, 14],
    [11, 1, 3, 18], // #11
    [13, 0, 5, 21],
  ])('degree %i alter %i', (degree, alter, letterSteps, semitones) => {
    expect(degreeToInterval(degree, alter)).toEqual({ letterSteps, semitones });
  });
});

describe('transposeNote spells correctly', () => {
  // These are the acceptance criteria from DESIGN.md section 10, phase 1.
  it('spells #11 on C as F#, not Gb', () => {
    expect(up('C', 11, 1)).toBe('F#');
  });

  it('spells b5 on C as Gb, not F#', () => {
    expect(up('C', 5, -1)).toBe('Gb');
  });

  it('transposes Bb up a major third to D, not C##', () => {
    expect(up('Bb', 3)).toBe('D');
  });

  it.each([
    ['C', 3, 0, 'E'],
    ['C', 5, 0, 'G'],
    ['Db', 3, 0, 'F'],
    ['Db', 5, 0, 'Ab'],
    ['F#', 3, 0, 'A#'],
    ['F#', 5, 0, 'C#'],
    ['Eb', 7, -1, 'Db'],
    ['B', 3, 0, 'D#'],
    ['B', 5, 0, 'F#'],
    ['G', 7, 0, 'F#'],
  ])('%s degree %i alter %i -> %s', (root, degree, alter, expected) => {
    expect(up(root, degree, alter)).toBe(expected);
  });

  it('keeps accidentals sane across the octave boundary', () => {
    // B up a minor second is C, not B# and certainly not an 11-sharp monster.
    expect(up('B', 2, -1)).toBe('C');
  });
});

describe('pitch (note + octave)', () => {
  it.each([
    ['C4', 60],
    ['A4', 69],
    ['E2', 40],
    ['E4', 64],
    ['G3', 55],
    ['B0', 23],
  ])('%s is MIDI %i', (text, midi) => {
    expect(pitchToMidi(parsePitch(text))).toBe(midi);
  });

  it('handles accidentals that cross an octave boundary', () => {
    // Cb4 sounds as B3, and B#3 sounds as C4. Folding the accidental into a
    // pitch class before applying the octave would get both of these wrong.
    expect(pitchToMidi(parsePitch('Cb4'))).toBe(59);
    expect(pitchToMidi(parsePitch('B#3'))).toBe(60);
  });

  it.each(['E2', 'A2', 'D3', 'G3', 'B3', 'E4', 'F#3', 'Bb1'])(
    'round-trips %s',
    (text) => {
      expect(formatPitch(parsePitch(text))).toBe(text);
    }
  );

  it('transposes pitches into the right octave', () => {
    expect(formatPitch(transposePitch(parsePitch('B3'), degreeToInterval(2, -1)))).toBe('C4');
    expect(formatPitch(transposePitch(parsePitch('E2'), degreeToInterval(5)))).toBe('B2');
    expect(formatPitch(transposePitch(parsePitch('G3'), degreeToInterval(3)))).toBe('B3');
  });

  it('rejects nonsense', () => {
    for (const bad of ['E', '4', 'H2', 'E#b2']) {
      expect(() => parsePitch(bad)).toThrow();
    }
  });
});

// music.dim7_flat_root_spelling — cifra.md §5.5 as clarified: a spelled tone may
// carry a triple accidental; a root or bass read from text is still at most a
// double (§5.1.1); a symbol brings a note back within a double (§5.7).
describe('a triple accidental (§5.5, §5.1.1)', () => {
  it('a spelled note holds a triple (and a quadruple) accidental', () => {
    expect(note('E', -3)).toEqual({ letter: 'E', accidental: -3 });
    expect(note('F', 3)).toEqual({ letter: 'F', accidental: 3 });
    expect(formatNote(note('E', -3))).toBe('Ebbb');
    expect(formatNote(note('F', 3))).toBe('F###');
    // A §5.1.1 double root can need four: the seventh of Fbb° is Ebbbb. Past
    // that no chord on any legal root reaches, so it is refused.
    expect(formatNote(note('E', -4))).toBe('Ebbbb');
    expect(formatNote(note('F', 4))).toBe('F####');
    expect(() => note('E', -5)).toThrow(/Bad accidental/);
    expect(() => note('F', 5)).toThrow(/Bad accidental/);
  });

  it('a root or bass is still at most a double (§5.1.1)', () => {
    for (const text of ['Ebbb', 'F###']) {
      expect(() => parseNote(text)).toThrow(expect.objectContaining({ code: 'badNote' }));
    }
  });

  it('transposeNote spells a diminished seventh from a flat root (§5.5)', () => {
    const dim7 = degreeToInterval(7, -2);
    expect(formatNote(transposeNote(parseNote('Fb'), dim7))).toBe('Ebbb');
    expect(formatNote(transposeNote(parseNote('Cb'), dim7))).toBe('Bbbb');
    expect(formatNote(transposeNote(parseNote('Bbb'), dim7))).toBe('Abbb');
    expect(formatNote(transposeNote(parseNote('Fbb'), dim7))).toBe('Ebbbb');
  });

  it.each([
    ['Ebb', 'Ebb'],
    ['Ebbb', 'Db'],
    ['Bbbb', 'Ab'],
    ['F###', 'G#'],
    ['B###', 'C##'],
    ['Fbbbb', 'Db'],
    ['E####', 'G#'],
  ])('plainSpelling keeps a double and moves a triple to the neighbouring letter: %s → %s', (from, to) => {
    const m = /^([A-G])(b*|#*)$/.exec(from);
    const n = note(m[1], m[2].startsWith('b') ? -m[2].length : m[2].length);
    const plain = plainSpelling(n);
    expect(formatNote(plain)).toBe(to);
    expect(pitchClass(plain)).toBe(pitchClass(n));
  });
});
