import { describe, it, expect } from 'vitest';
import { parse } from 'cifra-md';
import { transposeStatus, chartChordList } from './reading-view.js';

const FENCE = '```';
const song = (chart) => ['# Song', '## A', FENCE, chart, FENCE].join('\n') + '\n';
const keyed = (key, chart) =>
  ['# Song', '', `- key: ${key}`, '', '## A', FENCE, chart, FENCE].join('\n') + '\n';

// transposeStatus — the "Transposed to A (+2)" chip descriptor (workflow 2
// L135-138, mockups W02 L181-186). Fixtures are purpose-written songs.
describe('transposeStatus — the transpose chip, or none at the written key', () => {
  it('is null at the written key (offset 0)', () => {
    expect(transposeStatus('G', 0)).toBeNull();
  });

  it('names the destination key for a keyed song', () => {
    expect(transposeStatus('G', 2)).toEqual({ offset: 2, keyName: 'A' });
    expect(transposeStatus('G', -2)).toEqual({ offset: -2, keyName: 'F' });
  });

  it('carries a null key name for a keyless song — the offset shows alone (acceptance 3)', () => {
    expect(transposeStatus(null, 3)).toEqual({ offset: 3, keyName: null });
    expect(transposeStatus(undefined, -1)).toEqual({ offset: -1, keyName: null });
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
