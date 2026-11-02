// @vitest-environment node
// unit — the device bundle's entry under Node (reader.bundle;
// docs/remarkable-reader.md §4, §4.1, §9 "Unit (JS): the bundle's entry under
// Node"). It drives `globalThis.estante`, the host API version 1, with the
// standard guitar and the example book's table made here by the Worker's own
// fill, and pins: agreement with the reading view at all twelve keys (§4 "no
// port"), plain data across the boundary, no search on the reading path
// (§4.1), the memo (§4), the setlist's target key (workflow 12 §The key) and
// the setlist itself (workflow 12; cifra.md §10.7).

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

// Spies on the seams the entry must (or must not) reach: the search, the parse,
// the session cache it makes, and what it hands readSongSheet.
const spies = vi.hoisted(() => ({ search: 0, parses: [], caches: [], sheetArgs: [] }));

vi.mock('../core/search.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    searchFingerings: (...args) => {
      spies.search += 1;
      return real.searchFingerings(...args);
    },
  };
});

vi.mock('cifra-md', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    parse: (...args) => {
      spies.parses.push(args[0]);
      return real.parse(...args);
    },
  };
});

vi.mock('../core/shape-cache.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    createShapeCache: (...args) => {
      const cache = real.createShapeCache(...args);
      spies.caches.push(cache);
      return cache;
    },
  };
});

vi.mock('../songs/song-sheet.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    readSongSheet: (args) => {
      spies.sheetArgs.push(args);
      return real.readSongSheet(args);
    },
  };
});

const { parse } = await import('cifra-md');
const { SHAPE_CACHE_SALT, shapeCacheKey } = await import('../core/shape-cache.js');
const { transpose } = await import('../core/transpose.js');
const { songDialect, DEFAULT_DIALECT } = await import('../core/notation/dialects.js');
const { parseChord } = await import('../core/notation/parse.js');
const { chartRows } = await import('../chart/layout.js');
const { diagramModel } = await import('../render/diagram.js');
const { readSongSheet, instrumentFor } = await import('../songs/song-sheet.js');
const { fillDefaultShapes } = await import('../worker/default-shape-fill.js');
const { surfaceInstruments } = await import('../worker/instruments.js');
await import('./entry.js');

const { estante } = globalThis;

const BOOK = new URL('../../example-book/', import.meta.url);
const SONGS = readdirSync(BOOK)
  .filter((n) => n.endsWith('.cifra.md'))
  .sort()
  .map((name) => ({ name, text: readFileSync(new URL(name, BOOK), 'utf8') }));
const song = (name) => SONGS.find((s) => s.name === name).text;
const SETLIST = readFileSync(new URL('a-short-set.setlist.md', BOOK), 'utf8');

// Songs written for these tests.
const IN_C = '# Test in C\n- key: C\n\n```\nC | F | G | C\n```\n';
// No key: a choro-like chart in Dm that opens on its dominant (workflow 19 §A song).
const CHORO = '# Test Choro\n\n```\nA7/C# | Dm | Gm | A7 | Dm\n```\n';
// A song in G that ends away from its key.
const IN_G_ENDS_D7 = '# Test in G\n- key: G\n\n```\nG | C | D7\n```\n';
// No chords at all.
const NO_CHORDS = '# Test Quiet\n\n## A\nPlay it softly.\n```\n\n```\n';

const ENTRY = surfaceInstruments({}).standard;
let TABLE;

beforeAll(async () => {
  const writes = await fillDefaultShapes({ texts: SONGS.map((s) => s.text), entry: ENTRY, cacheModel: {} });
  TABLE = writes[0].value;
}, 60_000);

beforeEach(() => {
  estante.load(ENTRY, TABLE);
});

describe('agreement with the reading view, all twelve keys (§4 "no port")', () => {
  it('reads every example song at every offset as the reading view does', () => {
    // The reading view's own read, with the same table under the same entry.
    const viewEntry = { ...ENTRY, defaultShapes: TABLE };
    for (const { text } of SONGS) {
      const model = parse(text);
      for (let offset = 0; offset < 12; offset += 1) {
        const got = estante.sheet(text, offset);
        expect(got.offset).toBe(offset);
        expect(got.rows).toEqual(chartRows(transpose(model, offset, { dialect: songDialect(model) })));
        const view = readSongSheet({ text, reading: { transposition: offset }, entry: viewEntry });
        expect(got.shapes.map(({ key, symbol, source }) => ({ key, symbol, source }))).toEqual(
          view.shapes.map(({ key, symbol, source }) => ({ key, symbol, source })),
        );
        got.shapes.forEach((shape, i) => {
          expect(shape.diagram).toEqual(diagramModel(view.shapes[i].fingering, { handed: 'right' }));
        });
        expect(got.unvoiced).toEqual(view.unvoiced);
      }
    }
    // §9: the engine re-checks this in goja.
    expect(estante.misses()).toEqual([]);
  });

  it('draws left-handed when the preferences say so', () => {
    const preferences = { diagramHanded: { value: 'left', at: '2026-01-01T00:00:00.000Z' } };
    const got = estante.sheet(song('walking-to-the-market.cifra.md'), 0, { preferences });
    expect(got.shapes.length).toBeGreaterThan(0);
    for (const shape of got.shapes) expect(shape.diagram.handed).toBe('left');
  });

  it('carries the title, the key and the voicing block notes', () => {
    const got = estante.sheet(song('walking-to-the-market.cifra.md'), 14);
    expect(got.title).toBe('Walking to the Market');
    expect(got.offset).toBe(2);
    expect(got.transposed).toBe(true);
    expect(got.key.written).toBe('G');
    expect(got.key.status).toMatchObject({ offset: 2, keyName: 'A' });
    expect(got.keyNote).toBeNull();
    expect(Array.isArray(got.notes)).toBe(true);
  });

  // workflow 19 §A song as amended: key.named is the key as read now.
  it('names a song with no key by its last chord', () => {
    const at0 = estante.sheet(CHORO, 0);
    expect(at0.key.written).toBeNull();
    expect(at0.key.named).toBe('Dm');
    expect(at0.key.status).toBeNull();
    const up = estante.sheet(CHORO, 1);
    expect(up.key.named).toBe('Ebm');
    expect(up.key.status).toMatchObject({ offset: 1, keyName: 'Ebm', writtenKey: 'Dm' });
  });

  it('names a song by its stated key, transposed, whatever chord it ends on', () => {
    const got = estante.sheet(IN_G_ENDS_D7, 2);
    expect(got.key.written).toBe('G');
    expect(got.key.named).toBe('A');
  });

  it('names no key for a song with no chords and no key', () => {
    expect(estante.sheet(NO_CHORDS, 0).key.named).toBeNull();
    expect(estante.sheet(NO_CHORDS, 3).key.named).toBeNull();
  });

  it('answers an unreadable text without throwing', () => {
    expect(estante.sheet(new Uint8Array([0xff, 0xfe]), 0)).toEqual({ error: 'unreadable' });
    expect(estante.sheet(null, 0)).toEqual({ error: 'unreadable' });
  });
});

describe('plain data across the host boundary', () => {
  it('a sheet survives JSON unchanged', () => {
    for (const { text } of SONGS) {
      for (const offset of [0, 5]) {
        const got = estante.sheet(text, offset);
        expect(JSON.parse(JSON.stringify(got))).toStrictEqual(got);
      }
    }
  });

  it('a setlist survives JSON unchanged', () => {
    const got = estante.setlist(SETLIST, 'a-short-set.setlist.md', SONGS.map((s) => s.name));
    expect(JSON.parse(JSON.stringify(got))).toStrictEqual(got);
  });

  it('load and misses answer plain data', () => {
    const loaded = estante.load(ENTRY, null);
    expect(JSON.parse(JSON.stringify(loaded))).toStrictEqual(loaded);
    estante.sheet(song('walking-to-the-market.cifra.md'), 2);
    const queued = estante.misses();
    expect(JSON.parse(JSON.stringify(queued))).toStrictEqual(queued);
  });
});

describe('no search on the reading path (§4.1)', () => {
  it('with no table, every default comes back pending, queued once, and nothing is offered', () => {
    estante.load(ENTRY, null);
    const cache = spies.caches.at(-1);
    const before = spies.search;
    const viewEntry = { ...ENTRY, defaultShapes: TABLE };

    // Every example song voices its own chords at the written key, so read them
    // transposed, where every shape falls to the default (workflow 2).
    const allPending = new Set();
    for (const { text } of SONGS) {
      const got = estante.sheet(text, 2);
      const view = readSongSheet({ text, reading: { transposition: 2 }, entry: viewEntry });
      const defaults = view.shapes.filter((s) => s.source === 'default').map((s) => s.key);
      expect(defaults.length).toBeGreaterThan(0);
      expect(got.shapes.filter((s) => s.pending).map((s) => s.key)).toEqual(defaults);
      for (const s of got.shapes.filter((x) => x.pending)) {
        expect(s).toEqual({ key: s.key, symbol: s.symbol, pending: true });
        allPending.add(s.symbol);
      }
      // The song's own shapes still draw.
      expect(got.shapes.filter((s) => !s.pending).map((s) => s.source)).toEqual(
        view.shapes.filter((s) => s.source !== 'default').map((s) => s.source),
      );
      expect(got.unvoiced).toEqual([]);
    }
    // Read the walking song again, and at another key where D and A recur.
    estante.sheet(song('walking-to-the-market.cifra.md'), 2);
    const moved = estante.sheet(song('walking-to-the-market.cifra.md'), 7);
    for (const s of moved.shapes) allPending.add(s.symbol);

    const queued = estante.misses();
    const chords = queued.map((m) => m.chord);
    expect(new Set(chords).size).toBe(chords.length);
    expect(queued.length).toBe(allPending.size);
    expect(new Set(queued.map((m) => m.symbol))).toEqual(allPending);
    for (const m of queued) expect(m.dialect).toBe(DEFAULT_DIALECT);

    expect(spies.search - before).toBe(0);
    expect(cache.changed).toBe(false);
    expect(cache.toTable().shapes).toEqual({});
  });

  it('with a table holding all but one chord, exactly that one is pending', () => {
    const instrument = instrumentFor(ENTRY);
    const missing = shapeCacheKey(parseChord('A', DEFAULT_DIALECT).chord, instrument).chord;
    const shapes = { ...TABLE.shapes };
    delete shapes[missing];
    const loaded = estante.load(ENTRY, { ...TABLE, shapes });
    expect(loaded.held).toBe(Object.keys(TABLE.shapes).length - 1);
    const cache = spies.caches.at(-1);
    const before = spies.search;

    // Walking to the Market at +2: A, F#m, D, E, E7, all defaults.
    const got = estante.sheet(song('walking-to-the-market.cifra.md'), 2);
    expect(got.shapes.filter((s) => s.pending).map((s) => s.symbol)).toEqual(['A']);
    expect(got.shapes.filter((s) => !s.pending).length).toBe(got.shapes.length - 1);
    expect(got.unvoiced).toEqual([]);
    expect(estante.misses()).toEqual([{ chord: missing, symbol: 'A', dialect: DEFAULT_DIALECT }]);
    expect(spies.search - before).toBe(0);
    expect(cache.changed).toBe(false);
  });

  it('a later fill of the session cache is seen on the next read', () => {
    const instrument = instrumentFor(ENTRY);
    const key = shapeCacheKey(parseChord('A', DEFAULT_DIALECT).chord, instrument);
    const shapes = { ...TABLE.shapes };
    delete shapes[key.chord];
    estante.load(ENTRY, { ...TABLE, shapes });
    const cache = spies.caches.at(-1);
    const text = song('walking-to-the-market.cifra.md');
    expect(estante.sheet(text, 2).shapes.some((s) => s.pending)).toBe(true);
    // What reader.missed_shapes will do through its own host call.
    cache.offer(key, TABLE.shapes[key.chord]);
    expect(estante.sheet(text, 2).shapes.some((s) => s.pending)).toBe(false);
  });

  it('load clears the miss queue', () => {
    estante.load(ENTRY, null);
    estante.sheet(song('walking-to-the-market.cifra.md'), 2);
    expect(estante.misses().length).toBeGreaterThan(0);
    estante.load(ENTRY, null);
    expect(estante.misses()).toEqual([]);
  });
});

describe('memo (§4: the parsed model stays in memory)', () => {
  it('two reads of one text and offset are equal, and the second does not re-parse', () => {
    const text = song('the-ferry-line.cifra.md');
    spies.sheetArgs.length = 0;
    const first = estante.sheet(text, 3);
    const parsesAfterFirst = spies.parses.filter((t) => t === text).length;
    const second = estante.sheet(text, 3);
    expect(second).toEqual(first);
    expect(spies.parses.filter((t) => t === text).length).toBe(parsesAfterFirst);
    // The same held parse is handed to readSongSheet both times.
    expect(spies.sheetArgs).toHaveLength(2);
    expect(spies.sheetArgs[0].parsed).toBeTruthy();
    expect(spies.sheetArgs[1].parsed).toBe(spies.sheetArgs[0].parsed);
  });

  it('load drops the held parse', () => {
    const text = song('the-ferry-line.cifra.md');
    estante.sheet(text, 0);
    const before = spies.parses.filter((t) => t === text).length;
    estante.load(ENTRY, TABLE);
    estante.sheet(text, 0);
    expect(spies.parses.filter((t) => t === text).length).toBe(before + 1);
  });
});

describe('target key (workflow 12 §The key)', () => {
  it('reads a song written in C at +2 for a D target', () => {
    const got = estante.sheet(IN_C, 0, { targetKey: 'D' });
    expect(got.offset).toBe(2);
    expect(got.keyNote).toBeNull();
    expect(got.key.status).toMatchObject({ offset: 2, keyName: 'D' });
  });

  it('reads a song with no key at its written key, with the target as a note', () => {
    const got = estante.sheet(song('morning-on-the-porch.cifra.md'), 0, { targetKey: 'D' });
    expect(got.offset).toBe(0);
    expect(got.keyNote).toBe('D');
  });

  it('keeps a target key on a keyless song a note, never moved by the name its last chord gives (§10.7.1)', () => {
    const got = estante.sheet(CHORO, 0, { targetKey: 'Em' });
    expect(got.offset).toBe(0);
    expect(got.keyNote).toBe('Em');
    expect(got.key.named).toBe('Dm');
    expect(got.key.status).toBeNull();
  });

  it('carries a minor target on a major song as a note', () => {
    const got = estante.sheet(IN_C, 0, { targetKey: 'Am' });
    expect(got.offset).toBe(0);
    expect(got.keyNote).toBe('Am');
  });
});

describe('setlist (workflow 12; cifra.md §10.7)', () => {
  it('returns the playable items in order with their key and note', () => {
    const got = estante.setlist(SETLIST, 'a-short-set.setlist.md', SONGS.map((s) => s.name));
    expect(got.title).toBe('A Short Set');
    expect(got.missing).toBe(0);
    expect(got.items).toEqual([
      {
        at: 0,
        number: 1,
        title: 'Morning on the Porch',
        path: 'morning-on-the-porch.cifra.md',
        key: null,
        note: 'start gently, let the intro ring',
      },
      { at: 1, number: 2, title: 'The Ferry Line', path: 'the-ferry-line.cifra.md', key: null, note: null },
      { at: 2, number: 3, title: 'Walking to the Market', path: 'walking-to-the-market.cifra.md', key: 'A', note: null },
    ]);
  });

  it('leaves out an item whose song is absent and counts it missing', () => {
    const present = SONGS.map((s) => s.name).filter((n) => n !== 'the-ferry-line.cifra.md');
    const got = estante.setlist(SETLIST, 'a-short-set.setlist.md', present);
    expect(got.items.map((i) => i.path)).toEqual(['morning-on-the-porch.cifra.md', 'walking-to-the-market.cifra.md']);
    expect(got.missing).toBe(1);
  });

  it('resolves item paths from the setlist folder to the book root', () => {
    const got = estante.setlist(SETLIST, 'gigs/a-short-set.setlist.md', [
      'gigs/morning-on-the-porch.cifra.md',
      'gigs/walking-to-the-market.cifra.md',
    ]);
    expect(got.items.map((i) => i.path)).toEqual([
      'gigs/morning-on-the-porch.cifra.md',
      'gigs/walking-to-the-market.cifra.md',
    ]);
    expect(got.missing).toBe(1);
  });
});

describe('load', () => {
  it('holds the whole table', () => {
    const got = estante.load(ENTRY, TABLE);
    expect(got.held).toBe(Object.keys(TABLE.shapes).length);
    expect(got.fingerprint).toBe(TABLE.fingerprint);
    expect(got.tuningId).toBe('40 45 50 55 59 64');
  });

  it('reads a table of another fingerprint as absent', () => {
    expect(estante.load(ENTRY, { ...TABLE, fingerprint: 'another' }).held).toBe(0);
  });

  it('exposes the host API version and the salt', () => {
    expect(estante.hostApi).toBe(1);
    expect(estante.salt).toBe(SHAPE_CACHE_SALT);
  });
});
