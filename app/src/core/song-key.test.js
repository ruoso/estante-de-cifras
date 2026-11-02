// unit — the key a song is named by when it states none (core/song-key.js;
// reader.key_without_property). Pins workflow 2 §Transposing as amended: a
// song with no key is named by the key its last chord gives — the root, and
// `m` when the chord is minor — and a song with no chords names no key.
// Charts written for the purpose.

import { describe, it, expect } from 'vitest';
import { parse } from 'cifra-md';
import { chordKeyName, songKeyName } from './song-key.js';
import { transpose } from './transpose.js';

const FENCE = '```';
const songOf = (lines, props = []) =>
  ['# Test Song', ...(props.length ? ['', ...props.map((p) => `- ${p}`)] : []), '', '## A', FENCE, ...lines, FENCE, ''].join('\n');
const nameOf = (text) => songKeyName(parse(text), 'brazilian');

describe('chordKeyName — the key a chord gives', () => {
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

describe('songKeyName — the key the last chord gives (workflow 2 §Transposing)', () => {
  it('names a chart that opens on its dominant by the tonic it ends on', () => {
    expect(nameOf(songOf(['A7/C# | Dm | Gm | A7 | Dm']))).toBe('Dm');
  });

  it('names a chart that ends on a major chord', () => {
    expect(nameOf(songOf(['C | F | G7 | C']))).toBe('C');
  });

  it('reads the last chord on a sung line', () => {
    const text = songOf(['Am | F', '', 'C       Em', 'Sing it once more']);
    expect(nameOf(text)).toBe('Em');
  });

  it('reads a last ending written after the closing mark (cifra.md §3.4)', () => {
    expect(nameOf(songOf(['|: Dm | A7 :|2. Dm |']))).toBe('Dm');
  });

  it('names no key for a chart with no chords', () => {
    const text = ['# Test Song', '', '## A', 'Play it softly.', FENCE, '', FENCE, ''].join('\n');
    expect(nameOf(text)).toBeNull();
    expect(songKeyName(null, 'brazilian')).toBeNull();
  });

  it('does not read the key property: a song in G ending on D7 gives D (callers prefer the stated key)', () => {
    expect(nameOf(songOf(['G | C | D7'], ['key: G']))).toBe('D');
  });

  it('names a transposed model in its transposed spelling', () => {
    const model = parse(songOf(['A7/C# | Dm | Gm | A7 | Dm']));
    expect(songKeyName(transpose(model, 1, { dialect: 'brazilian' }), 'brazilian')).toBe('Ebm');
  });
});
