import { describe, it, expect } from 'vitest';
import { parse } from 'cifra-md';
import { fromCatalog } from './instrument.js';
import { resolveSongVoicings } from './voicings.js';
import { transpose, transposedKeyName } from './transpose.js';

// Pins the note's three promises: spelling by the key property or fewest
// accidentals; no chosen shapes while transposed; view only, never the song
// (workflow 2 §Transposing L112-138; cifra.md spec §1.4.3, §8.6). Fixtures are
// written for the purpose, never anyone's copyrighted words (no-song-text rule).

const FENCE = '```';
const guitar = fromCatalog('6guitar');

// A plain song: a chart of space-separated chords in one music part.
const song = (chart) => ['# Song', '## A', FENCE, chart, FENCE].join('\n') + '\n';
// A song carrying a `key` property (spec §1.4.2 list, immediately after the title).
const keyed = (key, chart) =>
  ['# Song', '', `- key: ${key}`, '', '## A', FENCE, chart, FENCE].join('\n') + '\n';
// A song with a voicings block (voicings.test.js's shape).
const voicedSong = (chart, ...voicings) =>
  ['# Song', '## A', FENCE, chart, FENCE, '', '---', '', ...voicings].join('\n') + '\n';
const shape = (chord, shorthand, tuning = 'E2 A2 D3 G3 B3 E4') => ({ tuning, chord, shorthand });

// A hand-built model, for the cases the real reader will not produce (an item the
// app's parser rejects). The compact factory from layout.test.js.
const handModel = (lines, properties = []) => ({
  title: null,
  properties,
  blocks: [],
  sung: false,
  sungAt: 0,
  diagnostics: [],
  sections: [{ name: 'A', heading: 'markdown', anchor: null, groups: [], body: [{ type: 'music', lines }] }],
});
const chartLineOf = (...syms) => ({
  kind: 'chart',
  closeBar: '|',
  measures: syms.map((s) => ({ bar: null, items: [{ type: 'chord', symbol: s, index: 1, key: s, chord: null }] })),
});

// Every chord item's symbol, in document order.
function chordSymbols(model) {
  const out = [];
  for (const section of model.sections ?? [])
    for (const part of section.body ?? [])
      if (part.type === 'music')
        for (const line of part.lines ?? [])
          if (line.kind === 'chart' || line.kind === 'sung')
            for (const measure of line.measures ?? [])
              for (const item of measure.items ?? []) if (item.type === 'chord') out.push(item.symbol);
  return out;
}

describe('transpose — spelling by the key property', () => {
  it('spells in the new key: key C up a semitone reads in flats (Db), not sharps (wf2 L131-133)', () => {
    // "up a semitone from C is D♭, with flats" — the key decides a single global
    // spelling for the whole chart.
    const t = transpose(parse(keyed('C', 'C F G')), 1);
    expect(chordSymbols(t)).toEqual(['Db', 'Gb', 'Ab']);
  });

  it('spells with naturals where the new key has them: key G up a tone reads in A', () => {
    const t = transpose(parse(keyed('G', 'G C D')), 2);
    expect(chordSymbols(t)).toEqual(['A', 'D', 'E']);
  });

  it('reads a ♭ key as the flat it is: key B♭ is not key B (songs.transpose_chrome AC5; wf2 L133-135)', () => {
    // One keyTonic for the chart and the key name. Up a semitone, B♭ goes to B
    // (B major, sharps) — a misread "B" would go to C and spell the chart in
    // flats (C♭ F♭ G♭). The ♭ glyph and the ASCII b read the same.
    const chart = 'Bb Eb F';
    const glyph = chordSymbols(transpose(parse(keyed('B♭', chart)), 1));
    expect(glyph).toEqual(['B', 'E', 'F#']);
    expect(chordSymbols(transpose(parse(keyed('Bb', chart)), 1))).toEqual(glyph);
    expect(chordSymbols(transpose(parse(keyed('B', chart)), 1))).toEqual(['Cb', 'Fb', 'Gb']);
    expect(transposedKeyName('B♭', 1)).toBe('B');
  });

  it('takes the neighbour letter where it spells fewer accidentals: key C# down a semitone reads in C', () => {
    const t = transpose(parse(keyed('C#', 'C# F# G#')), -1);
    expect(chordSymbols(t)).toEqual(['C', 'F', 'G']);
    expect(transposedKeyName('C#', -1)).toBe('C');
  });
});

describe('transpose — spelling by fewest accidentals when there is no key', () => {
  it('takes the spelling with fewer total accidentals across the chart (wf2 L131-133)', () => {
    // Up a tritone with no key: sharps total fewer accidentals than flats here
    // (F→B natural, against F→Cb), so the whole chart reads sharp.
    const t = transpose(parse(song('C F G')), 6);
    expect(chordSymbols(t)).toEqual(['F#', 'B', 'C#']);
  });

  it('breaks an exact tie towards flats (the "D♭" convention)', () => {
    // Up a semitone with no key: sharps and flats tie at one accidental each, so
    // the tie-break takes flats.
    const t = transpose(parse(song('C F G')), 1);
    expect(chordSymbols(t)).toEqual(['Db', 'Gb', 'Ab']);
  });
});

describe('transpose — view only, never the song (wf2 L112; spec §8.6)', () => {
  it('returns a new model and does not mutate its input', () => {
    const model = parse(song('C G Am F'));
    const frozen = structuredClone(model);
    const t = transpose(model, 3);
    expect(model).toEqual(frozen); // the input is deeply unchanged
    expect(t).not.toBe(model);
    expect(chordSymbols(t)).not.toEqual(chordSymbols(model));
  });

  it('returns the written chords at offset 0 (the written key)', () => {
    const model = parse(song('C G Am F'));
    expect(chordSymbols(transpose(model, 0))).toEqual(['C', 'G', 'Am', 'F']);
  });

  it('transposes root and bass and keeps quality and extensions', () => {
    // C7M/E up a tone → D7M/F#: the slash bass moves too, the quality is kept.
    const t = transpose(parse(song('C7M/E')), 2);
    expect(chordSymbols(t)).toEqual(['D7M/F#']);
  });
});

// music.fourth_with_seventh_spelling: every transposed symbol is formatted in the
// song's dialect (transpose.js L203; workflow 2's transposed view), so a fourth
// on a seventh keeps that dialect's spelling — never C47/D47 or C74/D74.
describe("transpose — a fourth on a seventh in the song's dialect", () => {
  // A song carrying both `key` and `notation` (spec §1.4.2 list).
  const keyedIn = (key, notation, chart) =>
    ['# Song', '', `- key: ${key}`, `- notation: ${notation}`, '', '## A', FENCE, chart, FENCE].join('\n') +
    '\n';

  it('spells a brazilian C7(4) C7(add4) up a tone as D7(4) D7(add4)', () => {
    const t = transpose(parse(keyed('C', 'C7(4) C7(add4)')), 2, { dialect: 'brazilian' });
    expect(chordSymbols(t)).toEqual(['D7(4)', 'D7(add4)']);
  });

  it('spells a realbook C7sus4 C7add4 up a tone as D7sus4 D7add4', () => {
    const t = transpose(parse(keyedIn('C', 'realbook', 'C7sus4 C7add4')), 2, { dialect: 'realbook' });
    expect(chordSymbols(t)).toEqual(['D7sus4', 'D7add4']);
  });
});

describe('transpose — an unparseable symbol is kept verbatim (spec reader rule; wf2 L78)', () => {
  it('leaves a symbol the parser rejects as written, transposing the rest', () => {
    const t = transpose(handModel([chartLineOf('C', 'H7', 'F')]), 2);
    // C→D and F→G are transposed; "H7" (no readable root) is kept as written.
    expect(chordSymbols(t)).toEqual(['D', 'H7', 'G']);
  });
});

describe('transpose — no chosen shapes while transposed (wf2 L119-125; voicings.js:151)', () => {
  it('resolves a transposed model with ignoreSongVoicings, never the song, even on a coincidence', () => {
    // The song voices both G and C. Up a fourth, its G becomes a C — the chord it
    // already voices. That coincidence must NOT take the song's shape.
    const parsed = parse(voicedSong('G C', '## Voicings: E2 A2 D3 G3 B3 E4', '- G: 320003', '- C: x32010'));
    const t = transpose(parsed, 5); // up a perfect fourth: G→C, C→F
    expect(chordSymbols(t)).toEqual(['C', 'F']);

    // Without the seam the transposed-G occurrence (key 'G', now sounding a C)
    // wrongly takes the song's G shape — the very bug the seam prevents.
    expect(resolveSongVoicings(t, guitar).get('G').source).toBe('song');

    // With it, every occurrence is yours/default — a coincidence is not a choice.
    const resolved = resolveSongVoicings(t, guitar, { ignoreSongVoicings: true });
    for (const { source } of resolved.values()) expect(source).not.toBe('song');
    expect(resolved.get('G').source).toBe('default'); // the G→C coincidence
    expect(resolved.get('C').source).toBe('default');
  });

  it('takes my shape over the default while transposed, still never the song', () => {
    const parsed = parse(voicedSong('G', '## Voicings: E2 A2 D3 G3 B3 E4', '- G: 320003'));
    const t = transpose(parsed, 5); // G→C
    const resolved = resolveSongVoicings(t, guitar, {
      ignoreSongVoicings: true,
      shapes: [shape('C', 'x32010')],
    });
    expect(resolved.get('G').source).toBe('yours');
  });
});

describe('transposedKeyName — the destination key name (wf2 L136-138)', () => {
  it('names the key in the chosen spelling: G +2 → A', () => {
    expect(transposedKeyName('G', 2)).toBe('A');
  });

  it('spells the key with flats where the new key has them: C +1 → Db', () => {
    expect(transposedKeyName('C', 1)).toBe('Db');
  });

  it('keeps the minor marker: Em +2 → F#m', () => {
    expect(transposedKeyName('Em', 2)).toBe('F#m');
  });

  it('is null when the song has no key property', () => {
    expect(transposedKeyName(null, 2)).toBeNull();
    expect(transposedKeyName('', 2)).toBeNull();
    expect(transposedKeyName(undefined, 2)).toBeNull();
  });

  // songs.transpose_chrome AC5: the key is read as spec §1.4.3 defines it (a
  // §5.1.1 root, ♭/♯ included, then `m` or nothing), and the name is spelled in
  // the written key's glyphs.
  it('reads a ♭ key: B♭ +2 → C', () => {
    expect(transposedKeyName('B♭', 2)).toBe('C');
  });

  it('reads E♭: +2 → F, +1 → E', () => {
    expect(transposedKeyName('E♭', 2)).toBe('F');
    expect(transposedKeyName('E♭', 1)).toBe('E');
  });

  it('spells the name in the written key\'s glyphs: A♭ +1 → A, G +1 → Ab', () => {
    expect(transposedKeyName('A♭', 1)).toBe('A');
    expect(transposedKeyName('G', 1)).toBe('Ab');
    expect(transposedKeyName('E♭', 4)).toBe('G');
    expect(transposedKeyName('E♭', 6)).toBe('A');
    expect(transposedKeyName('B♭', -2)).toBe('A♭');
    expect(transposedKeyName('F♯', 2)).toBe('G♯');
  });

  it('reads a ♯ minor key and keeps the m: F♯m +1 → Gm, C♯m −1 → Cm', () => {
    expect(transposedKeyName('F♯m', 1)).toBe('Gm');
    expect(transposedKeyName('C♯m', -1)).toBe('Cm');
  });

  it('is null for a value that is not a key (§5.1.1 root, §1.4.3): g, G major, Sol', () => {
    expect(transposedKeyName('g', 2)).toBeNull();
    expect(transposedKeyName('G major', 2)).toBeNull();
    expect(transposedKeyName('Sol', 2)).toBeNull();
  });
});
