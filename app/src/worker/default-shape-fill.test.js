import { describe, it, expect } from 'vitest';
import { parseChord } from '../core/notation/parse.js';
import { SHAPE_CACHE_SALT, chordKeyOf, fingerprintOf } from '../core/shape-cache.js';
import { surfaceInstruments, STANDARD_INSTRUMENT_ID } from './instruments.js';
import {
  CACHE_FILE,
  FILE_LIMIT_BYTES,
  TRANSPOSITIONS,
  fillDefaultShapes,
  instrumentForEntry,
  retirements,
} from './default-shape-fill.js';

const FENCE = '```';
const TUNING = 'E2 A2 D3 G3 B3 E4';
const song = (chart, ...voicings) =>
  ['# Song', '## A', FENCE, chart, FENCE, ...(voicings.length ? ['', '---', '', ...voicings] : [])].join('\n') +
  '\n';
const key = (symbol) => chordKeyOf(parseChord(symbol).chord);

// The standard guitar as the Worker surfaces it, with a cache model seeded in.
function standard(cacheModel = {}, shapes = {}) {
  return surfaceInstruments({ defaultShapes: cacheModel, shapes }).standard;
}

// The table a set of changes writes for the standard guitar.
const written = (changes) =>
  changes.find((c) => c.path.join('|') === [STANDARD_INSTRUMENT_ID, TUNING, SHAPE_CACHE_SALT].join('|'))?.value;

describe('filling the default-shape cache', () => {
  it('lives in the home book file §4.6 names, over every key a song can be read in', () => {
    expect(CACHE_FILE).toBe('shapes-default-cache.json');
    expect(TRANSPOSITIONS).toBe(12);
  });

  it("writes the in-use instrument's table: every chord of the song, in all twelve keys", async () => {
    const entry = standard();
    const changes = await fillDefaultShapes({ texts: [song('C | G')], entry, cacheModel: {} });
    const table = written(changes);
    expect(table.fingerprint).toBe(fingerprintOf(instrumentForEntry(entry)));
    // C and G, and each moved up a tone, among others.
    for (const symbol of ['C', 'G', 'D', 'A']) expect(table.shapes[key(symbol)]).toMatch(/^[x0-9-]+$/);
    expect(Object.keys(table.shapes).length).toBeGreaterThanOrEqual(TRANSPOSITIONS);
  });

  it("searches a chord the song voices too, so a variation that does not voice it is ready", async () => {
    const voiced = song('C | G', '## Voicings: E2 A2 D3 G3 B3 E4', FENCE, 'C: x32010', FENCE);
    const table = written(await fillDefaultShapes({ texts: [voiced], entry: standard(), cacheModel: {} }));
    expect(table.shapes[key('C')]).toBeDefined();
  });

  it('leaves out a chord I have my own shape for: the default is never reached', async () => {
    const entry = { ...standard(), shapes: [{ tuning: TUNING, chord: 'G', shorthand: '320033' }] };
    const table = written(await fillDefaultShapes({ texts: [song('C | G')], entry, cacheModel: {} }));
    expect(table.shapes[key('G')]).toBeUndefined();
    expect(table.shapes[key('C')]).toBeDefined();
  });

  it('writes nothing when every default is already in the table', async () => {
    const first = written(await fillDefaultShapes({ texts: [song('C | G')], entry: standard(), cacheModel: {} }));
    const cacheModel = {
      [STANDARD_INSTRUMENT_ID]: { [TUNING]: { [SHAPE_CACHE_SALT]: { at: '2026-11-01T00:00:00.000Z', value: first } } },
    };
    const again = await fillDefaultShapes({ texts: [song('G | C')], entry: standard(cacheModel), cacheModel });
    expect(again).toEqual([]);
  });

  it('adds to the table it found, rewriting it whole', async () => {
    const first = written(await fillDefaultShapes({ texts: [song('C')], entry: standard(), cacheModel: {} }));
    const cacheModel = {
      [STANDARD_INSTRUMENT_ID]: { [TUNING]: { [SHAPE_CACHE_SALT]: { at: '2026-11-01T00:00:00.000Z', value: first } } },
    };
    const next = written(await fillDefaultShapes({ texts: [song('Am')], entry: standard(cacheModel), cacheModel }));
    expect(next.shapes).toMatchObject(first.shapes);
    expect(next.shapes[key('Am')]).toBeDefined();
  });

  it('starts a new table when the one stored was searched under other rules', async () => {
    const cacheModel = {
      [STANDARD_INSTRUMENT_ID]: {
        [TUNING]: {
          [SHAPE_CACHE_SALT]: {
            at: '2026-11-01T00:00:00.000Z',
            value: { fingerprint: '0000000000000000', shapes: { stale: 'x32010' } },
          },
        },
      },
    };
    const table = written(await fillDefaultShapes({ texts: [song('C')], entry: standard(cacheModel), cacheModel }));
    expect(table.shapes.stale).toBeUndefined();
    expect(table.fingerprint).not.toBe('0000000000000000');
  });

  it('skips text that is not a song and has nothing to do without an instrument', async () => {
    expect(await fillDefaultShapes({ texts: [song('C')], entry: null, cacheModel: {} })).toEqual([]);
    expect(await fillDefaultShapes({ texts: [], entry: standard(), cacheModel: {} })).toEqual([]);
  });

  it('lets other work run between keys', async () => {
    let yields = 0;
    await fillDefaultShapes({
      texts: [song('C'), song('G')],
      entry: standard(),
      cacheModel: {},
      yieldNow: async () => {
        yields += 1;
      },
    });
    expect(yields).toBe(2 * TRANSPOSITIONS);
  });
});

describe('retiring tables', () => {
  const table = (shapes = {}) => ({ at: '2026-11-01T00:00:00.000Z', value: { fingerprint: 'f', shapes } });
  const keep = { id: 'a', tuning: TUNING };

  it('tombstones every table under a decommissioned salt, and nothing else short of the limit', () => {
    const model = {
      a: { [TUNING]: { old: table(), [SHAPE_CACHE_SALT]: table(), kept: table() } },
      b: { 'G2 D3 A3 E4': { old: table() } },
    };
    const out = retirements(model, [], keep, (salt) => salt === 'old');
    expect(out).toEqual([
      { path: ['a', TUNING, 'old'], value: null },
      { path: ['b', 'G2 D3 A3 E4', 'old'], value: null },
    ]);
  });

  it('leaves a tombstone a tombstone', () => {
    const model = { a: { [TUNING]: { old: { at: '2026-11-01T00:00:00.000Z', value: null } } } };
    expect(retirements(model, [], keep, (salt) => salt === 'old')).toEqual([]);
  });

  it('makes room over the size limit: other salts first, then other instruments, never the table being written', () => {
    const big = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`chord ${i}`, 'x32010']));
    const model = {
      a: { [TUNING]: { [SHAPE_CACHE_SALT]: table(big(10)), other: table(big(5000)) } },
      b: { [TUNING]: { [SHAPE_CACHE_SALT]: table(big(5000)) } },
    };
    const out = retirements(model, [], keep, () => false);
    expect(out[0]).toEqual({ path: ['a', TUNING, 'other'], value: null });
    expect(out.some((c) => c.path[0] === 'a' && c.path[2] === SHAPE_CACHE_SALT)).toBe(false);
    expect(FILE_LIMIT_BYTES).toBe(256 * 1024);
  });
});
