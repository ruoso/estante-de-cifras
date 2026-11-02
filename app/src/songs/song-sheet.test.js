// unit — which shapes caption explains the screen's marks (songs.print_no_defaults):
// that one is left off paper; the transposed caption is not. And the sheet's
// defaults read from the default-shape cache the instrument entry carries
// (home-book §4.6).

import { describe, it, expect } from 'vitest';
import { captionExplainsMarks, readSongSheet } from './song-sheet.js';
import { surfaceInstruments } from '../worker/instruments.js';
import { instrumentForEntry } from '../worker/default-shape-fill.js';
import { chordKeyOf, fingerprintOf } from '../core/shape-cache.js';
import { parseChord } from '../core/notation/parse.js';

const sheet = (sources, transposed = false) => ({ transposed, shapes: sources.map((source) => ({ source })) });

describe('captionExplainsMarks', () => {
  it('is the marks caption when a shape is not the song’s own, at the written key', () => {
    expect(captionExplainsMarks(sheet(['song', 'default']))).toBe(true);
    expect(captionExplainsMarks(sheet(['yours']))).toBe(true);
  });
  it('is not when every shape is the song’s, or the song is read transposed', () => {
    expect(captionExplainsMarks(sheet(['song', 'song']))).toBe(false);
    expect(captionExplainsMarks(sheet(['default'], true))).toBe(false);
    expect(captionExplainsMarks(sheet([]))).toBe(false);
  });
});

const FENCE = '```';
const text = ['# Song', '## A', FENCE, 'C | G', FENCE, ''].join('\n');
const key = (symbol) => chordKeyOf(parseChord(symbol).chord);

// The standard guitar as the Worker surfaces it, carrying a stored table.
function entryWith(shapes) {
  const bare = surfaceInstruments({}).standard;
  const fingerprint = fingerprintOf(instrumentForEntry(bare));
  return { ...bare, defaultShapes: { fingerprint, shapes } };
}

describe('the sheet and the default-shape cache (home-book §4.6)', () => {
  it("draws a chord's default from the table the instrument entry carries", () => {
    // A C the search would not pick first: the stored table decided it.
    const sheet = readSongSheet({ text, entry: entryWith({ [key('C')]: 'x35553' }) });
    const c = sheet.shapes.find((s) => s.symbol === 'C');
    expect(c.source).toBe('default');
    expect(c.fingering.shorthand).toBe('x35553');
  });

  it('searches what the table lacks, as without one', () => {
    const plain = readSongSheet({ text, entry: surfaceInstruments({}).standard });
    const cached = readSongSheet({ text, entry: entryWith({ [key('C')]: 'x35553' }) });
    const g = (sheet) => sheet.shapes.find((s) => s.symbol === 'G').fingering.shorthand;
    expect(g(cached)).toBe(g(plain));
  });

  it('ignores a table searched under other rules', () => {
    const entry = { ...surfaceInstruments({}).standard, defaultShapes: { fingerprint: '0000000000000000', shapes: { [key('C')]: 'x35553' } } };
    const sheet = readSongSheet({ text, entry });
    expect(sheet.shapes.find((s) => s.symbol === 'C').fingering.shorthand).not.toBe('x35553');
  });
});

// reader.bundle_chosen_unbuildable_pending — the sheet names the keys the
// song's own block chooses (cifra.md §7.6), only at the written key, where the
// resolver reads that block (docs/remarkable-reader.md §4.1).
describe('the keys the song chose', () => {
  it("chosen names the song's own keys, only as written", () => {
    const voiced = [
      '# Test Chosen',
      '',
      '## A',
      FENCE,
      'C | G | Am',
      FENCE,
      '',
      '---',
      '',
      '## Voicings: E2 A2 D3 G3 B3 E4',
      '- C: x32010',
      '- G: 320003',
      '',
    ].join('\n');
    const entry = surfaceInstruments({}).standard;
    const written = readSongSheet({ text: voiced, entry });
    expect(written.chosen).toBeInstanceOf(Set);
    expect(written.chosen).toEqual(new Set(['C', 'G']));
    const moved = readSongSheet({ text: voiced, entry, reading: { transposition: 2 } });
    expect(moved.chosen.size).toBe(0);
  });
});

// unit — the sheet's key for a song that states none (reader.key_without_property;
// workflow 2 §Transposing as amended): named by the key its last chord gives,
// as written and as now read; a stated key wins; no chords, no key.
describe('the sheet names a keyless song by its last chord (workflow 2 §Transposing)', () => {
  const choro = ['# Test Choro', '', '## A', FENCE, 'A7/C# | Dm | Gm | A7 | Dm', FENCE, ''].join('\n');

  it('names the Dm chart Dm, and Ebm at +1', () => {
    expect(readSongSheet({ text: choro }).startKey).toBe('Dm');
    const up = readSongSheet({ text: choro, reading: { transposition: 1 } });
    expect(up.startKey).toBe('Dm');
    expect(up.status).toEqual({ offset: 1, keyName: 'Ebm', writtenKey: 'Dm' });
  });

  it('prefers a stated key over the last chord', () => {
    const inG = ['# Test In G', '- key: G', '', '## A', FENCE, 'G | C | D7', FENCE, ''].join('\n');
    const read = readSongSheet({ text: inG, reading: { transposition: 2 } });
    expect(read.startKey).toBeNull();
    expect(read.status).toMatchObject({ keyName: 'A', writtenKey: 'G' });
  });

  it('names no key for a song with no chords', () => {
    const none = ['# Test Quiet', '', '## A', 'Play it softly.', FENCE, '', FENCE, ''].join('\n');
    const read = readSongSheet({ text: none, reading: { transposition: 1 } });
    expect(read.startKey).toBeNull();
    expect(read.status.keyName).toBeNull();
  });
});

// music.dim7_flat_root_spelling — the reading view's sheet (which the reader's
// bundle also reads, remarkable-reader §4) at every key of workflow 2
// §Transposing: a chart with flat-rooted diminished sevenths is spelled as the
// one chosen spelling gives it and every chord gets a shape (cifra.md §5.5).
describe('a flat-rooted diminished seventh at every key (music.dim7_flat_root_spelling)', () => {
  const dim7Text = ['# Song', '', '- key: C', '', '## A', FENCE, 'C F° Bb° Ab° Db° G7 C', FENCE, ''].join('\n');
  const ROWS = [
    'C F° Bb° Ab° Db° G7',
    'Db Gb° Cb° Bbb° Ebb° Ab7',
    'D G° C° Bb° Eb° A7',
    'Eb Ab° Db° Cb° Fb° Bb7',
    'E A° D° C° F° B7',
    'F Bb° Eb° Db° Gb° C7',
    'Gb Cb° Fb° Ebb° Abb° Db7',
    'G C° F° Eb° Ab° D7',
    'Ab Db° Gb° Fb° Bbb° Eb7',
    'A D° G° F° Bb° E7',
    'Bb Eb° Ab° Gb° Cb° F7',
    'B E° A° G° C° F#7',
  ];

  it.each(ROWS.map((row, offset) => [offset, row]))('+%i lists %s, every chord voiced', (offset, row) => {
    const sheet = readSongSheet({
      text: dim7Text,
      reading: { transposition: offset },
      entry: surfaceInstruments({}).standard,
    });
    expect(sheet.chordList.map((c) => c.symbol).join(' ')).toBe(row);
    expect(sheet.unvoiced).toEqual([]);
    expect(sheet.shapes.map((s) => s.symbol).join(' ')).toBe(row);
    for (const shape of sheet.shapes) expect(shape.fingering).toBeTruthy();
  });
});
