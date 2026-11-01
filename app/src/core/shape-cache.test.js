import { describe, it, expect } from 'vitest';
import { parse } from 'cifra-md';
import { parseChord } from './notation/parse.js';
import { fromCatalog, instrumentInstance, configFor } from './instrument.js';
import { defaultVoicing, resolveSongVoicings } from './voicings.js';
import {
  SHAPE_CACHE_SALT,
  DECOMMISSIONED_SALTS,
  chordKeyOf,
  createShapeCache,
  fingerprintOf,
  isDecommissionedSalt,
  isShapeTable,
  shapeCacheKey,
} from './shape-cache.js';

const guitar = fromCatalog('6guitar');
const chordOf = (symbol) => parseChord(symbol).chord;

// A cache that records every call, for pinning what the core asks and offers.
function recording(entries = {}) {
  const lookups = [];
  const offers = [];
  return {
    lookups,
    offers,
    lookup(key) {
      lookups.push(key);
      return Object.hasOwn(entries, key.chord) ? entries[key.chord] : undefined;
    },
    offer(key, shorthand) {
      offers.push({ key, shorthand });
    },
  };
}

describe('the salt', () => {
  it('is a non-empty string that is not itself retired', () => {
    expect(typeof SHAPE_CACHE_SALT).toBe('string');
    expect(SHAPE_CACHE_SALT).not.toBe('');
    expect(isDecommissionedSalt(SHAPE_CACHE_SALT)).toBe(false);
    expect(Object.isFrozen(DECOMMISSIONED_SALTS)).toBe(true);
  });
});

describe('the chord key', () => {
  it('is the chord as sameChord identifies it, not as it is spelled', () => {
    expect(chordKeyOf(chordOf('Cmaj7'))).toBe(chordKeyOf(chordOf('C7M')));
    expect(chordKeyOf(chordOf('C'))).not.toBe(chordKeyOf(chordOf('Cm')));
    expect(chordKeyOf(chordOf('C/E'))).not.toBe(chordKeyOf(chordOf('C')));
  });

  it('keeps enharmonic spellings apart, as sameChord does', () => {
    expect(chordKeyOf(chordOf('C#'))).not.toBe(chordKeyOf(chordOf('Db')));
  });
});

describe('the fingerprint', () => {
  it('is the same for the same instrument, however it was built', () => {
    expect(fingerprintOf(fromCatalog('6guitar'))).toBe(fingerprintOf(fromCatalog('6guitar')));
    expect(fingerprintOf(guitar)).toMatch(/^[0-9a-f]{16}$/);
  });

  it('changes with the tuning, the fret count and the rules', () => {
    const base = fingerprintOf(guitar);
    const dropD = instrumentInstance({ catalogId: '6guitar', strings: 'D2 A2 D3 G3 B3 E4' });
    const short = instrumentInstance({ catalogId: '6guitar', strings: 'E2 A2 D3 G3 B3 E4', fretCount: 12 });
    const jazz = instrumentInstance({
      catalogId: '6guitar',
      strings: 'E2 A2 D3 G3 B3 E4',
      heuristics: configFor(guitar, 'jazz'),
    });
    expect(fingerprintOf(dropD)).not.toBe(base);
    expect(fingerprintOf(short)).not.toBe(base);
    expect(fingerprintOf(jazz)).not.toBe(base);
  });
});

describe('the default voicing with a cache', () => {
  it('searches on a miss and offers the result as its frets', () => {
    const cache = recording();
    const found = defaultVoicing(chordOf('G'), guitar, { cache });
    expect(found).toEqual(defaultVoicing(chordOf('G'), guitar));
    expect(cache.offers).toEqual([{ key: shapeCacheKey(chordOf('G'), guitar), shorthand: found.shorthand }]);
  });

  it('rebuilds a hit from its frets, without searching, exactly as the search would give it', () => {
    const searched = defaultVoicing(chordOf('C'), guitar);
    const cache = recording({ [chordKeyOf(chordOf('C'))]: searched.shorthand });
    expect(defaultVoicing(chordOf('C'), guitar, { cache })).toEqual(searched);
    expect(cache.offers).toEqual([]);
  });

  it('takes the stored shape, which is how a hit skips the search', () => {
    // A shape the search would never pick first: the cache, not the search,
    // decided it.
    const cache = recording({ [chordKeyOf(chordOf('C'))]: 'x35553' });
    expect(defaultVoicing(chordOf('C'), guitar, { cache }).shorthand).toBe('x35553');
  });

  it('remembers a chord with no shape as null, and answers it without searching', () => {
    const uke = fromCatalog('ukulele');
    // A chord a four-string ukulele cannot voice whole.
    const unvoiceable = ['C13', 'C7(b13)', 'Cm9', 'Cmaj9', 'C9', 'C7b9', 'C7#9'].map(chordOf).find((c) => !defaultVoicing(c, uke));
    expect(unvoiceable).toBeTruthy();
    const miss = recording();
    expect(defaultVoicing(unvoiceable, uke, { cache: miss })).toBeNull();
    expect(miss.offers.map((o) => o.shorthand)).toEqual([null]);
    const hit = recording({ [chordKeyOf(unvoiceable)]: null });
    expect(defaultVoicing(unvoiceable, uke, { cache: hit })).toBeNull();
    expect(hit.offers).toEqual([]);
  });

  it('searches again when the stored frets cannot be made into the chord', () => {
    const cache = recording({ [chordKeyOf(chordOf('C'))]: 'not frets' });
    expect(defaultVoicing(chordOf('C'), guitar, { cache })).toEqual(defaultVoicing(chordOf('C'), guitar));
    expect(cache.offers).toHaveLength(1);
  });

  it('is consulted by the resolver for the defaults only', () => {
    const FENCE = '```';
    const model = parse(['# Song', '## A', FENCE, 'C | G | Am | F', FENCE, ''].join('\n'));
    const mine = [{ tuning: 'E2 A2 D3 G3 B3 E4', chord: 'G', shorthand: '320033' }];
    const cache = recording();
    const resolved = resolveSongVoicings(model, guitar, { shapes: mine, cache });
    expect(resolved.get('G').source).toBe('yours');
    // My shape for G was never looked up; the other three were.
    expect(cache.lookups.map((k) => k.chord).sort()).toEqual(['A minor', 'C major', 'F major'].sort());
  });
});

describe('the in-memory cache', () => {
  it('is seeded from a table searched under the same fingerprint', () => {
    const cache = createShapeCache({
      instrument: guitar,
      table: { fingerprint: fingerprintOf(guitar), shapes: { [chordKeyOf(chordOf('C'))]: 'x32010' } },
    });
    expect(cache.lookup(shapeCacheKey(chordOf('C'), guitar))).toBe('x32010');
    expect(cache.changed).toBe(false);
  });

  it('reads a table searched under another fingerprint, or a malformed one, as absent', () => {
    const shapes = { [chordKeyOf(chordOf('C'))]: 'x32010' };
    const other = createShapeCache({ instrument: guitar, table: { fingerprint: '0000000000000000', shapes } });
    expect(other.size).toBe(0);
    const malformed = createShapeCache({ instrument: guitar, table: { fingerprint: fingerprintOf(guitar), shapes: { x: 7 } } });
    expect(malformed.size).toBe(0);
    expect(isShapeTable({ fingerprint: 'f', shapes: { a: 'x32010', b: null } })).toBe(true);
    expect(isShapeTable(null)).toBe(false);
  });

  it('keeps what it is offered, says it changed, and tells the host once per new entry', () => {
    const told = [];
    const cache = createShapeCache({ instrument: guitar, onOffer: (key, shorthand) => told.push(shorthand) });
    defaultVoicing(chordOf('G'), guitar, { cache });
    defaultVoicing(chordOf('G'), guitar, { cache });
    expect(cache.changed).toBe(true);
    expect(told).toHaveLength(1);
    expect(cache.toTable()).toEqual({
      fingerprint: fingerprintOf(guitar),
      shapes: { [chordKeyOf(chordOf('G'))]: told[0] },
    });
  });

  it('ignores a key from another instrument', () => {
    const cache = createShapeCache({ instrument: guitar });
    const uke = fromCatalog('ukulele');
    cache.offer(shapeCacheKey(chordOf('C'), uke), '0003');
    expect(cache.size).toBe(0);
    expect(cache.lookup(shapeCacheKey(chordOf('C'), uke))).toBeUndefined();
  });
});
