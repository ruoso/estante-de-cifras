import { describe, it, expect } from 'vitest';
import { flipSymbol } from './flip.js';

// The explorer's flip label (music.explorer_flip_copy): workflow 16 §Viewing by
// notation, *How the flip spells the other reading* — American with ♯/♭, except a
// flip back to the user's own dialect's reading.
describe('flipSymbol', () => {
  it('spells C7+ and its sharp-fifth siblings as C7♯5 for a brazilian user', () => {
    expect(flipSymbol('C7+', 'brazilian')).toBe('C7♯5');
    expect(flipSymbol('Cm7+', 'brazilian')).toBe('Cm7♯5');
    expect(flipSymbol('C7+/E', 'brazilian')).toBe('C7♯5/E');
    expect(flipSymbol('C7+(9)', 'brazilian')).toBe('C9♯5');
  });

  it('spells the flip back to the brazilian reading in brazilian (C7M)', () => {
    expect(flipSymbol('C7+', 'brazilian', { sevenPlus: 'dominantSharpFive' })).toBe('C7M');
  });

  // music.fourth_with_seventh_spelling (workflow 16 L113-115): the flip back to
  // the user's own reading is in the user's dialect — the brazilian suspension.
  it('spells the flip back to the brazilian suspension in brazilian', () => {
    expect(flipSymbol('C7(4)', 'brazilian', { sevenFour: 'addedFourth' })).toBe('C7(4)');
  });

  it('names the other three ambiguities as workflow 16 does (brazilian)', () => {
    expect(flipSymbol('C9', 'brazilian')).toBe('C9');
    expect(flipSymbol('C°', 'brazilian')).toBe('Cdim');
    expect(flipSymbol('C7(4)', 'brazilian')).toBe('C7add4');
  });

  it('offers an american user the american spellings', () => {
    expect(flipSymbol('C7+', 'american')).toBe('Cmaj7');
    expect(flipSymbol('C9', 'american')).toBe('Cadd9');
    expect(flipSymbol('C7(4)', 'american')).toBe('C7sus4');
  });

  it('spells a realbook flip in american, since the alternative is not its own default', () => {
    expect(flipSymbol('C7+', 'realbook')).toBe('Cmaj7');
  });

  it('returns null for a symbol with nothing to flip', () => {
    expect(flipSymbol('C7(5+)', 'brazilian')).toBeNull();
    expect(flipSymbol('C+', 'brazilian')).toBeNull();
    expect(flipSymbol('', 'brazilian')).toBeNull();
  });

  it('never writes an ASCII # in a label', () => {
    const cases = [
      ['C7+', 'brazilian'],
      ['Cm7+', 'brazilian'],
      ['C7+/E', 'brazilian'],
      ['C7+(9)', 'brazilian'],
      ['F#7+', 'brazilian'],
      ['F#7+', 'brazilian', { sevenPlus: 'dominantSharpFive' }],
      ['C#7+', 'american'],
      ['C#7(4)', 'american'],
      ['C9', 'american'],
      ['C°', 'brazilian'],
      ['C7(4)', 'brazilian'],
    ];
    for (const [text, dialect, overrides] of cases) {
      const label = flipSymbol(text, dialect, overrides);
      expect(label).not.toBeNull();
      expect(label).not.toContain('#');
    }
  });
});
