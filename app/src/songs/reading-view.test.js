import { describe, it, expect } from 'vitest';
import { parse } from 'cifra-md';
import { transposeStatus, chartChordList, chordKeyName, voicedNames, shapeNames } from './reading-view.js';
import { parseChord } from '../core/notation/parse.js';
import { instrumentInstance } from '../core/instrument.js';
import { fingeringFromFrets } from '../core/search.js';

const FENCE = '```';
const song = (chart) => ['# Song', '## A', FENCE, chart, FENCE].join('\n') + '\n';
const keyed = (key, chart) =>
  ['# Song', '', `- key: ${key}`, '', '## A', FENCE, chart, FENCE].join('\n') + '\n';

// transposeStatus — the transposed row's descriptor (workflow 2 L137-140,
// mockups W02#4 L181-186): both keys named, or neither (songs.transpose_chrome
// Decision 4; spec §1.4.3, cf. 10-setlists L343-345).
describe('transposeStatus — the transposed row names both keys, or neither', () => {
  it('is null at the written key (offset 0)', () => {
    expect(transposeStatus('G', 0)).toBeNull();
    expect(transposeStatus(null, 0)).toBeNull();
  });

  it('names the destination key and the written key for a keyed song', () => {
    expect(transposeStatus('G', 2)).toEqual({ offset: 2, keyName: 'A', writtenKey: 'G' });
    expect(transposeStatus('G', -2)).toEqual({ offset: -2, keyName: 'F', writtenKey: 'G' });
  });

  it('gives the written key as written, trimmed', () => {
    expect(transposeStatus(' Em ', 2)).toEqual({ offset: 2, keyName: 'F#m', writtenKey: 'Em' });
  });

  it('names neither key when the property is not a key (§1.4.3) or is absent', () => {
    expect(transposeStatus('G major', 2)).toEqual({ offset: 2, keyName: null, writtenKey: null });
    expect(transposeStatus('Sol', 2)).toEqual({ offset: 2, keyName: null, writtenKey: null });
    expect(transposeStatus(null, 3)).toEqual({ offset: 3, keyName: null, writtenKey: null });
    expect(transposeStatus(undefined, -1)).toEqual({ offset: -1, keyName: null, writtenKey: null });
  });

  it('names a keyless song by the key its first chord gives, as written and as now read', () => {
    expect(transposeStatus(null, 1, { from: 'C', to: 'Db' })).toEqual({ offset: 1, keyName: 'Db', writtenKey: 'C' });
    expect(transposeStatus('Sol', 1, { from: 'C', to: 'Db' })).toEqual({ offset: 1, keyName: 'Db', writtenKey: 'C' });
    // The song's own key wins over its first chord.
    expect(transposeStatus('G', 2, { from: 'C', to: 'D' })).toEqual({ offset: 2, keyName: 'A', writtenKey: 'G' });
  });
});

describe('chordKeyName — the key a chord gives a song that names none', () => {
  it('is the root, and m for a minor chord', () => {
    expect(chordKeyName('Am7', 'brazilian')).toBe('Am');
    expect(chordKeyName('Eb/G', 'brazilian')).toBe('Eb');
    expect(chordKeyName('F#7M', 'brazilian')).toBe('F#');
  });

  it('is null for nothing, or for what is not a chord', () => {
    expect(chordKeyName(null, 'brazilian')).toBeNull();
    expect(chordKeyName('Walk', 'brazilian')).toBeNull();
  });
});

// chartChordList — the distinct chord occurrences in chart order, with their
// symbols recovered (the pairing resolveSongVoicings drops).
describe('chartChordList — the chords the shapes section draws, in order', () => {
  it('lists each distinct voicing key once, in chart order, keeping its symbol', () => {
    const list = chartChordList(parse(song('G  D | Em  C')));
    expect(list.map((c) => c.symbol)).toEqual(['G', 'D', 'Em', 'C']);
    // Every entry carries the §2.4 key the resolver keys its result on.
    expect(list.every((c) => typeof c.key === 'string' && c.key.length > 0)).toBe(true);
  });

  it('folds a repeated chord to its first occurrence', () => {
    const list = chartChordList(parse(song('C  G | C  G')));
    expect(list.map((c) => c.symbol)).toEqual(['C', 'G']);
  });

  it('reads chords from the key property song shape too', () => {
    const list = chartChordList(parse(keyed('D', 'D  A  Bm  G')));
    expect(list.map((c) => c.symbol)).toEqual(['D', 'A', 'Bm', 'G']);
  });

  it('is empty for a song with no chords', () => {
    expect(chartChordList(parse('# Song\n'))).toEqual([]);
  });
});

// Naming chords as voiced (the `chordNames` preference; Explore Chords §6.2).
describe('voicedNames / shapeNames', () => {
  const guitar = instrumentInstance({ catalogId: '6guitar', strings: 'E2 A2 D3 G3 B3 E4', fretCount: 22 });
  const C = parseChord('C').chord;
  const shape = (frets) => ({ key: 'C', symbol: 'C', fingering: fingeringFromFrets(frets, C, guitar) });

  it('renames a chord whose shape puts another tone lowest, and leaves one played as written', () => {
    expect(voicedNames([shape([0, 3, 2, 0, 1, 0])], 'american').get('C').symbol).toBe('C/E');
    expect(voicedNames([shape(['x', 3, 2, 0, 1, 0])], 'american').has('C')).toBe(false);
  });

  it('labels a diagram with the written name and what it sounds, or the sounded name alone once renamed', () => {
    const inverted = shape([0, 3, 2, 0, 1, 0]);
    expect(shapeNames(inverted, { notation: 'american' })).toEqual({ name: 'C', sounded: 'C/E' });
    const renamed = voicedNames([inverted], 'american');
    expect(shapeNames(inverted, { notation: 'american', renamed })).toEqual({ name: 'C/E', sounded: null });
    expect(shapeNames(shape(['x', 3, 2, 0, 1, 0]), { notation: 'american' })).toEqual({ name: 'C', sounded: null });
  });
});
