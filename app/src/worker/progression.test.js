import { describe, it, expect } from 'vitest';
import { parse, parseChord } from 'cifra-md';
import {
  MIN_N,
  MAX_N,
  canonicalChordToken,
  chordSequence,
  ngrams,
  parseProgressionQuery,
  progressionMatch,
  queryProgressionTokens,
} from './progression.js';

// unit — the pure progression core (storage.progression_search). Fixtures are
// purpose-written songs, never anyone's copyrighted words (no-song-text rule).
// Pins: `.tji` "n-gram extraction and progression match"; workflow 2 L42, L37;
// spec §5.2 (/home/ruoso/devel/cifra.md/spec/5-chord-symbols.md:68-71), §5.2.1.

const FENCE = '```';
const song = (lines) => lines.join('\n') + '\n';
// The canonical token for a typed chord symbol (through the one chord grammar).
const tok = (text) => canonicalChordToken(parseChord(text).chord);

describe('canonicalChordToken — spec §5.2 chord identity (unit)', () => {
  it('collapses spellings of the SAME chord to one token (§5.2.1)', () => {
    // Am = Amin = A- are the same chord; all three fold into the quality the
    // reader already normalised, so one token.
    expect(tok('Amin')).toBe(tok('Am'));
    expect(tok('A-')).toBe(tok('Am'));
    // Cmaj7 = CM7 = C∆7 — major seventh, one token.
    expect(tok('CM7')).toBe(tok('Cmaj7'));
    expect(tok('C∆7')).toBe(tok('Cmaj7'));
  });

  it('keeps genuinely different chords distinct', () => {
    // A triad vs the same triad with a seventh: different extensions, §5.2.
    expect(tok('Am7')).not.toBe(tok('Am'));
    // Roots compare by spelling — Db and C# are different chords (§5.2 default,
    // no enharmonic folding).
    expect(tok('Db')).not.toBe(tok('C#'));
    // A slash bass is part of the identity: C/G ≠ C.
    expect(tok('C/G')).not.toBe(tok('C'));
  });
});

describe('chordSequence — ordered, collapsed, chords only (unit)', () => {
  it('returns chords in document order', () => {
    const model = parse(
      song(['# Ordem', '## A', FENCE, 'C   G   Am  F', FENCE]),
    );
    expect(chordSequence(model)).toEqual([tok('C'), tok('G'), tok('Am'), tok('F')]);
  });

  it('collapses consecutive duplicates (a chord held over bars counts once)', () => {
    // `C | C | G | G` is the same progression as `C G` (Decision 1).
    const model = parse(
      song(['# Sustenta', '## A', FENCE, 'C   C   G   G', FENCE]),
    );
    expect(chordSequence(model)).toEqual([tok('C'), tok('G')]);
  });

  it('excludes non-chord items (N.C., unknown, beats)', () => {
    const model = parse(
      song(['# Mix', '## A', FENCE, 'C   N.C.   %   Zzz   G', FENCE]),
    );
    // Only the two real chords survive; nochord/beat/unknown never enter.
    expect(chordSequence(model)).toEqual([tok('C'), tok('G')]);
  });

  it('spelling variants in the song fold to the same tokens as the query', () => {
    const model = parse(song(['# Var', '## A', FENCE, 'A-  F  C  G', FENCE]));
    expect(chordSequence(model)).toEqual([tok('Am'), tok('F'), tok('C'), tok('G')]);
  });
});

describe('ngrams — contiguous runs of length MIN_N..MAX_N (unit)', () => {
  it('produces exactly the contiguous runs, by length', () => {
    const seq = ['a', 'b', 'c'];
    // n=2: ab, bc ; n=3: abc. MIN_N is 2, so no 1-grams.
    expect(ngrams(seq)).toEqual(['a~b', 'b~c', 'a~b~c']);
  });

  it('includes the single whole-sequence n-gram for a short sequence', () => {
    expect(ngrams(['a', 'b'])).toEqual(['a~b']);
  });

  it('yields none for a sequence shorter than MIN_N', () => {
    expect(ngrams(['a'])).toEqual([]);
    expect(ngrams([])).toEqual([]);
  });

  it('caps the window at MAX_N', () => {
    const seq = Array.from({ length: MAX_N + 2 }, (_, i) => `c${i}`);
    const longest = seq.filter((_, i) => i < MAX_N).join('~');
    // The longest n-gram is MAX_N members; nothing longer appears.
    expect(ngrams(seq)).toContain(longest);
    expect(ngrams(seq).some((g) => g.split('~').length > MAX_N)).toBe(false);
    expect(ngrams(seq).some((g) => g.split('~').length === MIN_N)).toBe(true);
  });
});

describe('parseProgressionQuery — two or more parsed chords (unit)', () => {
  it('accepts a run of chords and returns its canonical sequence', () => {
    const r = parseProgressionQuery('Am F C G');
    expect(r.isProgression).toBe(true);
    expect(r.seq).toEqual([tok('Am'), tok('F'), tok('C'), tok('G')]);
  });

  it('is spelling-tolerant: A- F C G parses to the Am F C G sequence', () => {
    expect(parseProgressionQuery('A- F C G').seq).toEqual(
      parseProgressionQuery('Am F C G').seq,
    );
  });

  it('is NOT a progression for a single chord', () => {
    expect(parseProgressionQuery('Am').isProgression).toBe(false);
  });

  it('is NOT a progression when a token is not a chord', () => {
    expect(parseProgressionQuery('Am xyzzy G').isProgression).toBe(false);
  });

  it('is NOT a progression when repeats collapse to one chord', () => {
    expect(parseProgressionQuery('Am Am').isProgression).toBe(false);
  });

  it('collapses consecutive duplicate chords in the query', () => {
    expect(parseProgressionQuery('Am Am F').seq).toEqual([tok('Am'), tok('F')]);
  });
});

describe('progressionMatch — contiguous run, order matters (unit)', () => {
  const seq = ['Am', 'F', 'C', 'G'].map(tok);

  it('matches a contiguous run in order', () => {
    expect(progressionMatch(['F', 'C'].map(tok), seq)).toBe(true);
    expect(progressionMatch(seq, seq)).toBe(true);
  });

  it('does not match the same chords out of order', () => {
    expect(progressionMatch(['G', 'C', 'F', 'Am'].map(tok), seq)).toBe(false);
  });

  it('does not match a non-contiguous subsequence', () => {
    expect(progressionMatch(['Am', 'C'].map(tok), seq)).toBe(false);
  });

  it('matches across collapsed repeats (Am Am F F C C G G ≡ Am F C G)', () => {
    const held = chordSequence(
      parse(song(['# H', '## A', FENCE, 'Am Am F F C C G G', FENCE])),
    );
    expect(progressionMatch(['F', 'C', 'G'].map(tok), held)).toBe(true);
  });
});

describe('queryProgressionTokens — window + fallback (unit)', () => {
  it('is a single whole-run token for L ≤ MAX_N (no confirmation)', () => {
    const seq = ['a', 'b', 'c'];
    expect(queryProgressionTokens(seq)).toEqual({ tokens: ['a~b~c'], confirm: false });
  });

  it('is the AND of MAX_N-grams with confirmation for L > MAX_N', () => {
    const seq = Array.from({ length: MAX_N + 1 }, (_, i) => `c${i}`);
    const r = queryProgressionTokens(seq);
    expect(r.confirm).toBe(true);
    expect(r.tokens).toHaveLength(2); // two sliding MAX_N-grams over MAX_N+1
    expect(r.tokens[0].split('~')).toHaveLength(MAX_N);
  });
});
