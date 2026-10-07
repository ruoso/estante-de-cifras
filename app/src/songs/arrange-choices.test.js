// Unit — the arrange surface's pure choice-building helpers (songs.arrange).
// No DOM, no React: parse a purpose-written song, resolve it on a real
// instrument, and pin the §8.5 inputs the ops consume. Fixtures are songs
// written for the purpose, never anyone's copyrighted words.

import { describe, it, expect } from 'vitest';
import { parse } from 'cifra-md';
import { instrumentInstance } from '../core/instrument.js';
import { resolveSongVoicings } from '../core/voicings.js';
import { occurrenceAt, unchosenPlan, toShape } from './arrange-choices.js';

const GUITAR_TUNING = 'E2 A2 D3 G3 B3 E4';
const FENCE = '```';

const guitar = instrumentInstance({ catalogId: '6guitar', strings: GUITAR_TUNING, fretCount: 22 });

// A chord-only chart; G is chosen in the song's guitar block, so it resolves
// `song`. C is given a starred shape (`yours`); Am has neither (`default`).
const song = () =>
  parse(
    [
      '# Tarde Clara',
      '',
      '## Primeira Parte',
      FENCE,
      'G | C | Am | G',
      FENCE,
      '',
      '---',
      '',
      `## Voicings: ${GUITAR_TUNING}`,
      '- G: 320003',
      '',
    ].join('\n'),
  );

const myShapes = [{ tuning: GUITAR_TUNING, chord: 'C', shorthand: 'x32010' }];

const resolve = (model, shapes = []) =>
  resolveSongVoicings(model, guitar, { variation: '', shapes });

// Walk the model for the nth chord of a symbol, as cifra-md's own walk does.
function addressOf(model, symbol, nth = 0) {
  let seen = 0;
  const secs = model.sections ?? [];
  for (let s = 0; s < secs.length; s++) {
    const body = secs[s].body ?? [];
    for (let p = 0; p < body.length; p++) {
      if (body[p].type !== 'music') continue;
      const lines = body[p].lines ?? [];
      for (let l = 0; l < lines.length; l++) {
        const measures = lines[l].measures ?? [];
        for (let m = 0; m < measures.length; m++) {
          const items = measures[m].items ?? [];
          for (let i = 0; i < items.length; i++) {
            if (items[i].type === 'chord' && items[i].symbol === symbol) {
              if (seen === nth) return { section: s, part: p, line: l, measure: m, item: i };
              seen += 1;
            }
          }
        }
      }
    }
  }
  return null;
}

describe('occurrenceAt', () => {
  it('maps a tapped chart address to the §8.5 occurrence and voicing key of that chord', () => {
    const model = song();
    const address = addressOf(model, 'C');
    const info = occurrenceAt(model, address);
    expect(info).not.toBeNull();
    expect(info.occurrence).toEqual(address);
    expect(info.symbol).toBe('C');
    expect(info.index).toBe(1);
    expect(info.key).toBe('C');
  });

  it('is null for an address that does not point at a chord', () => {
    const model = song();
    expect(occurrenceAt(model, { section: 0, part: 0, line: 0, measure: 0, item: 99 })).toBeNull();
    expect(occurrenceAt(model, null)).toBeNull();
  });
});

describe('unchosenPlan', () => {
  it('plans every occurrence of every yours/default chord at its shown shape, omitting song and unvoiceable', () => {
    const model = song();
    const resolved = resolve(model, myShapes);
    // Sanity: G is the song's choice, C is yours, Am is a default.
    expect(resolved.get('G').source).toBe('song');
    expect(resolved.get('C').source).toBe('yours');
    expect(resolved.get('Am').source).toBe('default');

    const plan = unchosenPlan(model, resolved);
    // C once and Am once; both Gs (song-sourced) are left out.
    expect(plan).toHaveLength(2);
    const symbols = plan.map((p) => occurrenceAt(model, p.occurrence).symbol).sort();
    expect(symbols).toEqual(['Am', 'C']);
    // Each plan entry carries the shape the resolver shows, in model array form.
    const c = plan.find((p) => occurrenceAt(model, p.occurrence).symbol === 'C');
    expect(c.shape.frets).toEqual(resolved.get('C').fingering.frets);
  });

  it('encodes the thumb (finger 0) as the cifra.md marker "T"', () => {
    // toShape is the thumb re-encoder unchosenPlan runs over each fingering.
    const shape = toShape({ frets: ['x', 3, 2, 0, 1, 0], fingers: [null, 0, 2, null, 1, null] });
    expect(shape.frets).toEqual(['x', 3, 2, 0, 1, 0]);
    expect(shape.fingers).toEqual([null, 'T', 2, null, 1, null]);
  });
});

describe('toShape', () => {
  it('drops the fingers array when the fingering carries none (I4: only what was chosen)', () => {
    const shape = toShape({ frets: ['x', 3, 2, 0, 1, 0] });
    expect(shape).toEqual({ frets: ['x', 3, 2, 0, 1, 0] });
    expect('fingers' in shape).toBe(false);
  });
});
