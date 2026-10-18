// unit (songs.arrange_polish) — the read-out of a shape entered by hand: role
// words from `chordTones`' degree/alter, string names, the *Notes it holds*
// summary and the foreign notice. Pins workflow 16 §Entering a shape by hand and
// board W05#3 L141 (the summary), L151 (the notice), L274-281 (the rows).

import { describe, it, expect, beforeEach } from 'vitest';
import { setLocale } from '../i18n/index.js';
import { parseTuning } from '../core/instrument.js';
import { parseChord } from '../core/notation/parse.js';
import { chordTones } from '../core/chord.js';
import { roleWord, stringNames, stringMentions, shapeReadout } from './shape-readout.js';

beforeEach(() => setLocale('en'));

const GUITAR = parseTuning('E2 A2 D3 G3 B3 E4');
const chordOf = (symbol) => parseChord(symbol).chord;
// The role word of a chord's tone at a degree, read through chordTones.
const roleIn = (symbol, degree) => {
  const tone = chordTones(chordOf(symbol)).find((x) => x.degree === degree);
  return roleWord(tone.degree, tone.alter);
};

describe('roleWord — a chord tone named by its part in the chord', () => {
  it('names every degree/alter pair the read-out uses', () => {
    expect(roleWord(1, 0)).toBe('root');
    expect(roleWord(2, 0)).toBe('second');
    expect(roleWord(3, -1)).toBe('minor third');
    expect(roleWord(3, 0)).toBe('major third');
    expect(roleWord(4, 0)).toBe('fourth');
    expect(roleWord(5, -1)).toBe('flat fifth');
    expect(roleWord(5, 0)).toBe('fifth');
    expect(roleWord(5, 1)).toBe('sharp fifth');
    expect(roleWord(6, 0)).toBe('sixth');
    expect(roleWord(7, -2)).toBe('diminished seventh');
    expect(roleWord(7, -1)).toBe('minor seventh');
    expect(roleWord(7, 0)).toBe('major seventh');
    expect(roleWord(9, -1)).toBe('flat ninth');
    expect(roleWord(9, 0)).toBe('ninth');
    expect(roleWord(9, 1)).toBe('sharp ninth');
    expect(roleWord(11, 0)).toBe('eleventh');
    expect(roleWord(11, 1)).toBe('sharp eleventh');
    expect(roleWord(13, -1)).toBe('flat thirteenth');
    expect(roleWord(13, 0)).toBe('thirteenth');
  });

  it('reads the roles off real chords', () => {
    expect(roleIn('Cm', 3)).toBe('minor third');
    expect(roleIn('C7', 7)).toBe('minor seventh');
    expect(roleIn('C7M', 7)).toBe('major seventh');
    expect(roleIn('C°', 7)).toBe('diminished seventh');
    expect(roleIn('C7(b9)', 9)).toBe('flat ninth');
    expect(roleIn('Cm7(b5)', 5)).toBe('flat fifth');
  });

  it('falls back to the ordinal word with flat / sharp for any other pair', () => {
    expect(roleWord(4, 1)).toBe('sharp fourth');
    expect(roleWord(2, -1)).toBe('flat second');
    expect(roleWord(10, 0)).toBe('tenth');
  });
});

describe('stringNames — a string named by its pitch, low/high when two share a letter', () => {
  it('standard guitar: the two Es are low and high, the rest bare', () => {
    expect(stringNames(GUITAR)).toEqual(['E2 · low E', 'A2', 'D3', 'G3', 'B3', 'E4 · high E']);
    expect(stringMentions(GUITAR)).toEqual([
      'the low E string',
      'the A string',
      'the D string',
      'the G string',
      'the B string',
      'the high E string',
    ]);
  });

  it('cavaquinho D G B D: low D and high D', () => {
    expect(stringNames(parseTuning('D4 G4 B4 D5'))).toEqual(['D4 · low D', 'G4', 'B4', 'D5 · high D']);
  });

  it('three strings of one letter fall back to the bare pitch', () => {
    expect(stringNames(parseTuning('D2 A2 D3 G3 A3 D4'))).toEqual(['D2', 'A2 · low A', 'D3', 'G3', 'A3 · high A', 'D4']);
  });
});

describe('shapeReadout — Cm x35544 (W05#3)', () => {
  const readout = () => shapeReadout(chordOf('Cm'), 'Cm', GUITAR, ['x', 3, 5, 5, 4, 4]);

  it('one row per string, low to high, with fret, note and the role or not in Cm', () => {
    const rows = readout().rows.map((r) => [r.string, r.fret, r.note, r.badge]);
    expect(rows).toEqual([
      ['E2 · low E', 'muted', '—', null],
      ['A2', 'fret 3', 'C', 'root'],
      ['D3', 'fret 5', 'G', 'fifth'],
      ['G3', 'fret 5', 'C', 'root'],
      ['B3', 'fret 4', 'E♭', 'minor third'],
      ['E4 · high E', 'fret 4', 'A♭', 'not in Cm'],
    ]);
    expect(readout().rows[5].foreign).toBe(true);
  });

  it('summarises the chord tones in chord order, then the foreign notes', () => {
    expect(readout().summary).toBe('C · E♭ · G · A♭');
  });

  it('names the foreign note on the high E string in the notice', () => {
    expect(readout().foreign).toEqual(['A♭ on the high E string']);
    expect(readout().notice).toBe(
      'The A♭ on the high E string is not in Cm, which is C, E♭ and G. You can still choose this shape.',
    );
  });

  it('an open string reads open, and no foreign note means no notice', () => {
    const { rows, notice } = shapeReadout(chordOf('C'), 'C', GUITAR, ['x', 3, 2, 0, 1, 0]);
    expect(rows[3].fret).toBe('open');
    expect(rows[3].badge).toBe('fifth');
    expect(notice).toBeNull();
  });

  it('several foreign notes are joined into one notice', () => {
    const { notice } = shapeReadout(chordOf('C'), 'C', GUITAR, ['x', 3, 2, 0, 1, 1]);
    // B3 at 1 is C (root); E4 at 1 is F — only one foreign. Add A2 open (A).
    const many = shapeReadout(chordOf('C'), 'C', GUITAR, ['x', 0, 2, 0, 1, 1]);
    expect(notice).toMatch(/^The F on the high E string is not in C/);
    expect(many.notice).toMatch(/^The A on the A string and F on the high E string are not in C, which is C, E and G\./);
  });
});
