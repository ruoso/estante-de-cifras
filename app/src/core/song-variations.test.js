import { describe, it, expect } from 'vitest';
import { parse } from 'cifra-md';
import { fromCatalog, openMidis } from './instrument.js';
import { songVariations } from './song-variations.js';

// The §6.3 tuning identity the view computes and passes in (the same formula
// resolveSongVoicings matches blocks on): the space-joined open-string MIDI
// numbers. Pinning it here keeps the two callers reading one identity.
const guitarId = openMidis(fromCatalog('6guitar')).join(' ');
const ukeId = openMidis(fromCatalog('ukulele')).join(' ');

const FENCE = '```';
// A whole song: a chart in one music part, then (optionally) voicing blocks.
const song = (chart, ...voicings) =>
  ['# Song', '## A', FENCE, chart, FENCE, ...(voicings.length ? ['', '---', '', ...voicings] : [])].join('\n') +
  '\n';

// songVariations — the labels the picker chooses between (workflow 2 L73-74,
// cifra.md §7.6). Fixtures are purpose-written, never anyone's copyrighted words.
describe('songVariations — the variation labels for one tuning', () => {
  it('is empty when the song has no voicings at all', () => {
    expect(songVariations(parse(song('C Am')), guitarId)).toEqual([]);
  });

  it('is empty when the tuning has no block — never borrows across tunings (§7.6)', () => {
    // A ukulele block only: the guitar offers no variation of its own.
    const parsed = parse(song('A', '## Voicings: G4 C4 E4 A4', '- A: 2100'));
    expect(songVariations(parsed, guitarId)).toEqual([]);
    expect(songVariations(parsed, ukeId)).toEqual(['']);
  });

  it("names the default block ''", () => {
    const parsed = parse(song('C', '## Voicings: E2 A2 D3 G3 B3 E4', '- C: x32010'));
    expect(songVariations(parsed, guitarId)).toEqual(['']);
  });

  it("lists '' first, then the named variations in parse order (workflow 2 L73-74)", () => {
    const parsed = parse(
      song(
        'C',
        '## Voicings: E2 A2 D3 G3 B3 E4',
        '- C: x32010',
        '',
        '## Up the neck: E2 A2 D3 G3 B3 E4',
        '- C: 8-10-10-9-8-8',
        '',
        '## Barre: E2 A2 D3 G3 B3 E4',
        '- C: x-3-5-5-5-3',
      ),
    );
    expect(songVariations(parsed, guitarId)).toEqual(['', 'Up the neck', 'Barre']);
  });

  it("puts '' first even when a named block is written before it", () => {
    const parsed = parse(
      song(
        'C',
        '## Up the neck: E2 A2 D3 G3 B3 E4',
        '- C: 8-10-10-9-8-8',
        '',
        '## Voicings: E2 A2 D3 G3 B3 E4',
        '- C: x32010',
      ),
    );
    expect(songVariations(parsed, guitarId)).toEqual(['', 'Up the neck']);
  });

  it('lists only the named variations when the tuning has no default block', () => {
    const parsed = parse(
      song(
        'C',
        '## First: E2 A2 D3 G3 B3 E4',
        '- C: x32010',
        '',
        '## Second: E2 A2 D3 G3 B3 E4',
        '- C: 8-10-10-9-8-8',
      ),
    );
    expect(songVariations(parsed, guitarId)).toEqual(['First', 'Second']);
  });
});
