import { describe, it, expect } from 'vitest';
import { parseNote } from '../pitch.js';
import { chord, describeChordTones, sameChord } from '../chord.js';
import { parseChord } from './parse.js';
import { formatChord } from './format.js';
import { DEFAULT_DIALECT, DIALECT_IDS } from './dialects.js';

const n = parseNote;
/** Parse and return the tones, for readable assertions. */
const tones = (text, dialect) => {
  const r = parseChord(text, dialect);
  if (!r.chord) throw new Error(`failed to parse ${text}: ${r.errors[0]?.message}`);
  return describeChordTones(r.chord);
};

describe('the same chord across dialects', () => {
  // Acceptance criterion: C7M, Cmaj7 and C∆7 are one chord.
  it('parses a major 7th written four ways to the same chord', () => {
    const forms = ['C7M', 'Cmaj7', 'C∆7', 'CM7'];
    const parsed = forms.map((f) => parseChord(f).chord);
    for (const c of parsed) expect(c).not.toBeNull();
    for (const c of parsed) expect(sameChord(c, parsed[0])).toBe(true);
    expect(describeChordTones(parsed[0])).toBe('C E G B');
  });

  it('parses minor written four ways to the same chord', () => {
    const forms = ['Cm7', 'Cmin7', 'C−7', 'C-7'];
    const parsed = forms.map((f) => parseChord(f).chord);
    for (const c of parsed) expect(sameChord(c, parsed[0])).toBe(true);
    expect(describeChordTones(parsed[0])).toBe('C Eb G Bb');
  });

  it('parses half-diminished written three ways to the same chord', () => {
    const forms = ['Cm7b5', 'Cø7', 'Cm7(5-)'];
    const parsed = forms.map((f) => parseChord(f).chord);
    for (const c of parsed) expect(sameChord(c, parsed[0])).toBe(true);
    expect(describeChordTones(parsed[0])).toBe('C Eb Gb Bb');
  });

  it('parses diminished sevenths written three ways', () => {
    for (const form of ['Cdim7', 'C°7', 'C°']) {
      expect(tones(form)).toBe('C Eb Gb Bbb');
    }
  });
});

describe('case is never normalised', () => {
  // Acceptance criterion: CM7 and Cm7 must not collide.
  it('reads CM7 as major and Cm7 as minor', () => {
    expect(tones('CM7')).toBe('C E G B');
    expect(tones('Cm7')).toBe('C Eb G Bb');
  });

  it('reads Bb as a flat root, not B with a flat five', () => {
    expect(parseChord('Bb').chord.root).toEqual({ letter: 'B', accidental: -1 });
    expect(parseChord('B').chord.root).toEqual({ letter: 'B', accidental: 0 });
  });
});

describe('the slash is overloaded', () => {
  // Acceptance criterion: C/E is a bass note, C6/9 is a compound quality.
  it('reads C/E as a slash bass', () => {
    const c = parseChord('C/E').chord;
    expect(c.bass).toEqual({ letter: 'E', accidental: 0 });
    expect(describeChordTones(c)).toBe('C E G');
  });

  it('reads C6/9 as a compound quality with no bass', () => {
    const c = parseChord('C6/9').chord;
    expect(c.bass).toBeNull();
    expect(describeChordTones(c)).toBe('C E G A D');
  });

  it('handles a compound quality that also has a bass', () => {
    const c = parseChord('C6/9/E').chord;
    expect(c.bass).toEqual({ letter: 'E', accidental: 0 });
    expect(describeChordTones(c)).toBe('C E G A D');
  });
});

describe('the C7+ ambiguity', () => {
  // Acceptance criterion: dialect-dependent, and reported either way.
  it('reads C7+ as a major 7th in Brazilian', () => {
    expect(tones('C7+', 'brazilian')).toBe('C E G B');
  });

  it('reads C7+ as a dominant 7th with a raised 5th in American', () => {
    expect(tones('C7+', 'american')).toBe('C E G# Bb');
  });

  it('reports the ambiguity rather than choosing silently', () => {
    for (const dialect of DIALECT_IDS) {
      const r = parseChord('C7+', dialect);
      expect(r.ambiguities).toHaveLength(1);
      expect(r.ambiguities[0].kind).toBe('sevenPlus');
      expect(r.ambiguities[0].alternatives).toHaveLength(1);
    }
  });

  it('does not treat 5+ or 9+ as ambiguous, since those are plain sharps', () => {
    expect(tones('C7(5+)')).toBe('C E G# Bb');
    expect(parseChord('C7(5+)').ambiguities).toHaveLength(0);
    expect(tones('C7(9+)')).toBe('C E G Bb D#');
  });
});

describe('the C9 ambiguity', () => {
  it('reads C9 as an added 9th in Brazilian', () => {
    expect(tones('C9', 'brazilian')).toBe('C E G D');
  });

  it('reads C9 as a dominant 9th in American and Real Book', () => {
    expect(tones('C9', 'american')).toBe('C E G Bb D');
    expect(tones('C9', 'realbook')).toBe('C E G Bb D');
  });

  it('reports both readings', () => {
    const r = parseChord('C9', 'brazilian');
    expect(r.ambiguities[0]).toMatchObject({ kind: 'bareNine', chosen: 'add' });
    expect(r.ambiguities[0].alternatives).toEqual(['dominant']);
  });

  it('is unambiguous once a 7th is stated', () => {
    expect(parseChord('C7(9)').ambiguities).toHaveLength(0);
    expect(parseChord('Cmaj9').ambiguities).toHaveLength(0);
    expect(parseChord('Cadd9').ambiguities).toHaveLength(0);
    expect(tones('Cmaj9')).toBe('C E G B D');
    expect(tones('Cadd9')).toBe('C E G D');
  });
});

describe('the ° ambiguity', () => {
  // The shape every guitarist knows for "B°" is x2313x, which has the A♭ in
  // it: the symbol means the diminished 7th in practice, whatever the theory
  // book says. So a bare ° reads as the 7th, and says so.
  it('reads a bare ° as a diminished 7th in every dialect', () => {
    for (const dialect of DIALECT_IDS) {
      expect(tones('B°', dialect)).toBe('B D F Ab');
    }
  });

  it('reports it, offering the bare triad', () => {
    const r = parseChord('B°');
    expect(r.ambiguities).toHaveLength(1);
    expect(r.ambiguities[0]).toMatchObject({ kind: 'degreeSign', chosen: 'diminishedSeventh' });
    expect(r.ambiguities[0].alternatives).toEqual(['diminishedTriad']);
  });

  it('flips to the triad when asked', () => {
    const r = parseChord('B°', 'brazilian', { readings: { degreeSign: 'diminishedTriad' } });
    expect(describeChordTones(r.chord)).toBe('B D F');
  });

  it('is unambiguous once the 7th is written, or the word dim is used', () => {
    expect(parseChord('B°7').ambiguities).toHaveLength(0);
    expect(parseChord('Bdim').ambiguities).toHaveLength(0);
    expect(parseChord('Bdim7').ambiguities).toHaveLength(0);
    expect(tones('Bdim')).toBe('B D F');
  });
});

describe('the C7(4) ambiguity', () => {
  // The fourth §5.6 ambiguity (spec §5.6 L248, L261-265; workflow 16 L99-102):
  // a bare 4 over a major triad that already states a seventh. Brazilian reads
  // it as a suspended fourth (C7sus4 — the third gives way to the fourth);
  // American and Real Book add the fourth above the third (C7add4).
  it('reads C7(4) as a suspended fourth in Brazilian', () => {
    expect(tones('C7(4)', 'brazilian')).toBe('C F G Bb');
  });

  it('reads C7(4) as an added fourth in American and Real Book', () => {
    expect(tones('C7(4)', 'american')).toBe('C E F G Bb');
    expect(tones('C7(4)', 'realbook')).toBe('C E F G Bb');
  });

  it('reports the ambiguity rather than choosing silently', () => {
    const r = parseChord('C7(4)', 'brazilian');
    expect(r.ambiguities).toHaveLength(1);
    expect(r.ambiguities[0]).toMatchObject({ kind: 'sevenFour', chosen: 'suspendedFourth' });
    expect(r.ambiguities[0].alternatives).toEqual(['addedFourth']);
  });

  it('is an added fourth with nothing to flip on a minor triad', () => {
    // A suspension replaces a major third; Cm7(4) has none to replace, so it is
    // an added fourth in every dialect and is not reported (spec §5.6 L261-265).
    for (const dialect of DIALECT_IDS) {
      const r = parseChord('Cm7(4)', dialect);
      expect(r.ambiguities).toHaveLength(0);
      expect(describeChordTones(r.chord)).toBe('C Eb F G Bb');
    }
  });

  it('is unambiguous when sus4 or add4 is spelled out', () => {
    expect(parseChord('C7sus4').ambiguities).toHaveLength(0);
    expect(parseChord('C7add4').ambiguities).toHaveLength(0);
    expect(tones('C7sus4')).toBe('C F G Bb');
    expect(tones('C7add4')).toBe('C E F G Bb');
  });
});

describe('extensions and alterations', () => {
  it.each([
    ['C', 'C E G'],
    ['Cm', 'C Eb G'],
    ['C7', 'C E G Bb'],
    ['C6', 'C E G A'],
    ['Cm6', 'C Eb G A'],
    ['C5', 'C G'],
    ['Csus4', 'C F G'],
    ['Csus2', 'C D G'],
    ['C4', 'C F G'],
    ['Caug', 'C E G#'],
    ['C+', 'C E G#'],
    ['Cdim', 'C Eb Gb'],
    ['C°', 'C Eb Gb Bbb'],
    ['Cmaj7#11', 'C E G B F#'],
    ['C7b9', 'C E G Bb Db'],
    ['C13', 'C E G Bb D A'],
    ['C11', 'C E G Bb D F'],
    ['Cm7b5', 'C Eb Gb Bb'],
    ['C7#5', 'C E G# Bb'],
    ['C7#9', 'C E G Bb D#'],
    ['Cm(maj7)', 'C Eb G B'],
    ['C7M9', 'C E G B D'],
  ])('%s is %s', (text, expected) => {
    expect(tones(text)).toBe(expected);
  });

  it('accepts parenthesised Brazilian alterations', () => {
    expect(tones('C7(9-)')).toBe('C E G Bb Db');
    expect(tones('Cm7(9)')).toBe('C Eb G Bb D');
  });
});

describe('errors are returned, never thrown', () => {
  it.each(['', '   ', 'H7', 'xyz', 'C##bb7', '7', 'Cmaj/'])(
    'rejects %s without throwing',
    (bad) => {
      let result;
      expect(() => {
        result = parseChord(bad);
      }).not.toThrow();
      expect(result.chord).toBeNull();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0].message).toBeTruthy();
    }
  );
});

// --- the round-trip matrix ------------------------------------------------

/**
 * A corpus of canonical chords. Every one must survive being formatted in a
 * dialect and parsed back in that dialect. This is the contract that keeps
 * formatters from emitting spellings the parser cannot read.
 */
const CORPUS = [
  chord(n('C')),
  chord(n('Db')),
  chord(n('F#')),
  chord(n('Bb'), 'minor'),
  chord(n('A'), 'minor'),
  chord(n('B'), 'dim'),
  chord(n('C'), 'aug'),
  chord(n('C'), 'sus2'),
  chord(n('C'), 'sus4'),
  chord(n('C'), 'power'),
  chord(n('C'), 'major', [{ degree: 7 }]),
  chord(n('C'), 'major', [{ degree: 7, alter: -1 }]),
  chord(n('C'), 'minor', [{ degree: 7, alter: -1 }]),
  chord(n('C'), 'minor', [{ degree: 7 }]),
  chord(n('C'), 'dim', [{ degree: 7, alter: -2 }]),
  chord(n('C'), 'dim', [{ degree: 7, alter: -1 }]),
  chord(n('C'), 'aug', [{ degree: 7, alter: -1 }]),
  chord(n('C'), 'major', [{ degree: 6 }]),
  chord(n('C'), 'minor', [{ degree: 6 }]),
  chord(n('C'), 'major', [{ degree: 6 }, { degree: 9 }]),
  chord(n('C'), 'major', [{ degree: 9 }]),
  chord(n('Eb'), 'major', [{ degree: 7 }, { degree: 9 }]),
  chord(n('C'), 'major', [{ degree: 7, alter: -1 }, { degree: 9 }]),
  chord(n('C'), 'major', [{ degree: 7, alter: -1 }, { degree: 9 }, { degree: 13 }]),
  chord(n('C'), 'major', [{ degree: 7 }, { degree: 11, alter: 1 }]),
  chord(n('C'), 'major', [{ degree: 7, alter: -1 }, { degree: 9, alter: -1 }]),
  chord(n('C'), 'major', [{ degree: 7, alter: -1 }, { degree: 9, alter: 1 }]),
  chord(n('G'), 'major', [{ degree: 7, alter: -1 }], n('B')),
  chord(n('C'), 'major', [], n('E')),
  chord(n('A'), 'minor', [{ degree: 7, alter: -1 }], n('G')),
  // A fourth on a seventh (music.fourth_with_seventh_spelling): the added-fourth
  // rows broke the brazilian round trip (C7(4) is the suspension, spec §5.6).
  chord(n('C'), 'sus4', [{ degree: 7, alter: -1 }]),
  chord(n('C'), 'sus4', [{ degree: 7 }]),
  chord(n('C'), 'sus4', [{ degree: 7, alter: -1 }, { degree: 9 }]),
  chord(n('C'), 'sus4', [{ degree: 7, alter: -1 }, { degree: 9, alter: -1 }]),
  chord(n('C'), 'major', [{ degree: 7, alter: -1 }, { degree: 4 }]),
  chord(n('C'), 'major', [{ degree: 7 }, { degree: 4 }]),
  chord(n('C'), 'major', [{ degree: 7, alter: -1 }, { degree: 9 }, { degree: 4 }]),
  chord(n('C'), 'minor', [{ degree: 7, alter: -1 }, { degree: 4 }]),
  chord(n('C'), 'major', [{ degree: 4 }]),
  chord(n('C'), 'major', [{ degree: 7, alter: -1 }, { degree: 9 }, { degree: 11, alter: 1 }]),
];

describe('round-trip matrix', () => {
  for (const dialect of DIALECT_IDS) {
    describe(dialect, () => {
      it.each(CORPUS.map((c) => [formatChord(c, dialect), c]))(
        'round-trips %s',
        (text, original) => {
          const result = parseChord(text, dialect);
          expect(result.errors).toEqual([]);
          expect(result.chord).not.toBeNull();
          // Compare by sound as well as structure: a formatter that loses a
          // tone would otherwise slip through a structural comparison.
          expect(describeChordTones(result.chord)).toBe(describeChordTones(original));
          expect(sameChord(result.chord, original)).toBe(true);
        }
      );
    });
  }

  it('formats each dialect distinctly where they genuinely differ', () => {
    const maj7 = chord(n('C'), 'major', [{ degree: 7 }]);
    expect(formatChord(maj7, 'brazilian')).toBe('C7M');
    expect(formatChord(maj7, 'american')).toBe('Cmaj7');
    expect(formatChord(maj7, 'realbook')).toBe('C∆7');

    const halfDim = chord(n('C'), 'dim', [{ degree: 7, alter: -1 }]);
    expect(formatChord(halfDim, 'brazilian')).toBe('Cm7(5-)');
    expect(formatChord(halfDim, 'american')).toBe('Cm7b5');
    expect(formatChord(halfDim, 'realbook')).toBe('Cø7');

    // ° carries the 7th, so a bare triad has to be spelled out.
    const dim7 = chord(n('B'), 'dim', [{ degree: 7, alter: -2 }]);
    expect(formatChord(dim7, 'brazilian')).toBe('B°');
    expect(formatChord(dim7, 'realbook')).toBe('B°');
    expect(formatChord(dim7, 'american')).toBe('Bdim7');
    const triad = chord(n('B'), 'dim');
    for (const dialect of DIALECT_IDS) expect(formatChord(triad, dialect)).toBe('Bdim');
  });

  // Display-only Unicode accidentals (music.explorer_flip_copy; workflow 16
  // §Viewing by notation): ♯/♭ on request, ASCII unchanged by default.
  it('writes ♯ and ♭ with { accidentals: unicode }, and ASCII without it', () => {
    const unicode = { accidentals: 'unicode' };
    const sharpFive = chord(n('C'), 'aug', [{ degree: 7, alter: -1 }]);
    const flatNine = chord(n('C'), 'major', [{ degree: 7, alter: -1 }, { degree: 9, alter: -1 }]);
    const sharpMinor = chord(n('C#'), 'minor');
    expect(formatChord(sharpFive, 'american', unicode)).toBe('C7♯5');
    expect(formatChord(flatNine, 'american', unicode)).toBe('C7♭9');
    expect(formatChord(sharpMinor, 'american', unicode)).toBe('C♯m');
    expect(formatChord(sharpFive, 'american')).toBe('C7#5');
    expect(formatChord(flatNine, 'american')).toBe('C7b9');
    expect(formatChord(sharpMinor, 'american')).toBe('C#m');
  });

  // American fourth on a seventh (music.explorer_flip_copy): C7sus4 and C7add4,
  // never Csus47 or C74; a sus4 triad stays Csus4.
  it('spells a fourth over a seventh as C7sus4 and C7add4 in American, round-tripping', () => {
    for (const text of ['C7sus4', 'C7add4', 'Csus4']) {
      const parsed = parseChord(text, 'american').chord;
      expect(formatChord(parsed, 'american')).toBe(text);
      expect(sameChord(parseChord(formatChord(parsed, 'american'), 'american').chord, parsed)).toBe(true);
    }
    expect(formatChord(chord(n('C'), 'sus4', [{ degree: 7, alter: -1 }]), 'american')).toBe('C7sus4');
    expect(
      formatChord(chord(n('C'), 'major', [{ degree: 4 }, { degree: 7, alter: -1 }]), 'american'),
    ).toBe('C7add4');
  });

  it('carries a slash bass through every dialect', () => {
    const c = chord(n('C'), 'major', [], n('E'));
    for (const dialect of DIALECT_IDS) {
      expect(formatChord(c, dialect)).toBe('C/E');
    }
  });
});

// music.fourth_with_seventh_spelling: a fourth on a seventh is spelled in each
// dialect's own notation, never C47/Csus47 or C74. Pins the round-trip contract
// (format.js L5-7) and spec §5.6 L261-265 (`C7(4)` is the Brazilian suspension,
// so the Brazilian added fourth on a major triad is `add4`).
describe('a fourth on a seventh in each dialect', () => {
  const sus4 = (...exts) => chord(n('C'), 'sus4', exts);
  const major = (...exts) => chord(n('C'), 'major', exts);
  const b7 = { degree: 7, alter: -1 };
  const maj7 = { degree: 7 };
  const nine = { degree: 9 };
  const flatNine = { degree: 9, alter: -1 };
  const thirteen = { degree: 13 };
  const four = { degree: 4 };

  // [name, chord, dialect, spelling]
  const TABLE = [
    ['C7sus4', sus4(b7), 'brazilian', 'C7(4)'],
    ['C9sus4', sus4(b7, nine), 'brazilian', 'C7(4,9)'],
    ['Cmaj7sus4', sus4(maj7), 'brazilian', 'C7M(4)'],
    ['Cmaj9sus4', sus4(maj7, nine), 'brazilian', 'C7M(4,9)'],
    ['C13sus4', sus4(b7, nine, thirteen), 'brazilian', 'C13(4)'],
    ['C7sus4b9', sus4(b7, flatNine), 'brazilian', 'C7(4,9-)'],
    ['C7add4', major(b7, four), 'brazilian', 'C7(add4)'],
    ['Cmaj7add4', major(maj7, four), 'brazilian', 'C7M(add4)'],
    ['C9add4', major(b7, nine, four), 'brazilian', 'C7(add4,9)'],
    ['Cm7add4', chord(n('C'), 'minor', [b7, four]), 'brazilian', 'Cm7(4)'],
    ['Cadd4', major(four), 'brazilian', 'C(add4)'],
    ['Csus4', sus4(), 'brazilian', 'C4'],
    ['C9#11', major(b7, nine, { degree: 11, alter: 1 }), 'brazilian', 'C7(9,11+)'],
    ['C7sus4', sus4(b7), 'realbook', 'C7sus4'],
    ['C9sus4', sus4(b7, nine), 'realbook', 'C9sus4'],
    ['Cmaj7sus4', sus4(maj7), 'realbook', 'C∆7sus4'],
    ['Cmaj9sus4', sus4(maj7, nine), 'realbook', 'C∆9sus4'],
    ['C13sus4', sus4(b7, nine, thirteen), 'realbook', 'C13sus4'],
    ['C7sus4b9', sus4(b7, flatNine), 'realbook', 'C7sus4b9'],
    ['C7add4', major(b7, four), 'realbook', 'C7add4'],
    ['Cmaj7add4', major(maj7, four), 'realbook', 'C∆7add4'],
    ['C9add4', major(b7, nine, four), 'realbook', 'C9add4'],
    ['Cm7add4', chord(n('C'), 'minor', [b7, four]), 'realbook', 'C−7add4'],
    ['Cadd4', major(four), 'realbook', 'Cadd4'],
    ['Csus4', sus4(), 'realbook', 'Csus4'],
  ];

  it.each(TABLE)('writes %s in %s as %s and reads it back', (_name, c, dialect, spelling) => {
    expect(formatChord(c, dialect)).toBe(spelling);
    const back = parseChord(spelling, dialect);
    expect(back.errors).toEqual([]);
    expect(sameChord(back.chord, c)).toBe(true);
    expect(describeChordTones(back.chord)).toBe(describeChordTones(c));
  });

  // The display option goes through the new branches: the Real Book writes ♭9,
  // the Brazilian keeps its `9-` suffix.
  it.each([
    [sus4(b7, flatNine), 'realbook', 'C7sus4♭9'],
    [sus4(b7, flatNine), 'brazilian', 'C7(4,9-)'],
  ])('writes the ♭9 row with { accidentals: unicode } (%#: %s)', (c, dialect, spelling) => {
    expect(formatChord(c, dialect, { accidentals: 'unicode' })).toBe(spelling);
  });

  // Home-book format §4.4: a shape key is matched by chord, not by spelling;
  // ChordExplorer.jsx keys a star by formatChord(chord, DEFAULT_DIALECT) and
  // fingering-groups.js reads it back with parseChord in the default dialect.
  it('the default-dialect shape key reads back as the chord starred', () => {
    for (const c of [major(b7, four), sus4(b7)]) {
      const key = formatChord(c, DEFAULT_DIALECT);
      const back = parseChord(key).chord;
      expect(sameChord(back, c)).toBe(true);
      expect(describeChordTones(back)).toBe(describeChordTones(c));
    }
    expect(describeChordTones(parseChord(formatChord(major(b7, four), DEFAULT_DIALECT)).chord)).toBe('C E F G Bb');
    expect(describeChordTones(parseChord(formatChord(sus4(b7), DEFAULT_DIALECT)).chord)).toBe('C F G Bb');
  });
});

describe('cross-dialect reading', () => {
  it('reads a chord written in one dialect while set to another', () => {
    // The payoff of a dialect-free canonical model: a shared link written in
    // Brazilian reads correctly for someone set to American notation.
    const written = formatChord(chord(n('C'), 'major', [{ degree: 7 }]), 'brazilian');
    const readBack = parseChord(written, 'american').chord;
    expect(describeChordTones(readBack)).toBe('C E G B');
    expect(formatChord(readBack, 'american')).toBe('Cmaj7');
  });
});

describe('reading overrides', () => {
  it('lets a caller flip one reading without changing dialect', () => {
    // This is what the disambiguation chip does: the user sees which reading
    // was taken and switches it, without their notation preference moving.
    expect(tones('C9', 'brazilian')).toBe('C E G D');
    const flipped = parseChord('C9', 'brazilian', { readings: { bareNine: 'dominant' } });
    expect(describeChordTones(flipped.chord)).toBe('C E G Bb D');
    // Still reported, so the chip stays visible and can be flipped back.
    expect(flipped.ambiguities[0].chosen).toBe('dominant');
    expect(flipped.ambiguities[0].alternatives).toEqual(['add']);
  });

  it('flips C7+ the same way', () => {
    expect(tones('C7+', 'brazilian')).toBe('C E G B');
    const flipped = parseChord('C7+', 'brazilian', {
      readings: { sevenPlus: 'dominantSharpFive' },
    });
    expect(describeChordTones(flipped.chord)).toBe('C E G# Bb');
  });

  it('flips C7(4) from the suspended to the added fourth', () => {
    expect(tones('C7(4)', 'brazilian')).toBe('C F G Bb');
    const flipped = parseChord('C7(4)', 'brazilian', {
      readings: { sevenFour: 'addedFourth' },
    });
    expect(describeChordTones(flipped.chord)).toBe('C E F G Bb');
    expect(flipped.ambiguities[0].chosen).toBe('addedFourth');
    expect(flipped.ambiguities[0].alternatives).toEqual(['suspendedFourth']);
  });
});
