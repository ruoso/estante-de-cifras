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
const { transpose, transposedKeyName } = await import('../core/transpose.js');
const { songDialect, DEFAULT_DIALECT } = await import('../core/notation/dialects.js');
const { parseChord } = await import('../core/notation/parse.js');
const { shorthandOf } = await import('../core/fretstring.js');
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

  // music.dim7_flat_root_spelling: the key grid (§7) reaches every key of a
  // chart with flat-rooted diminished sevenths (Cb°, Bbb°, Fb°, Abb° once
  // transposed; cifra.md §5.5), read as the reading view reads it. The table is
  // filled for this chart too, as the device's home-book cache would be, since
  // the reading path does not search; misses are not asserted.
  it('reads a flat-rooted diminished seventh at every offset as the reading view does', async () => {
    const text = '# Test Dim\n- key: C\n\n```\nC F° | Bb° Ab° | Db° G7 | C\n```\n';
    const model = parse(text);
    const writes = await fillDefaultShapes({ texts: [text], entry: ENTRY, cacheModel: {} });
    const table = writes[0].value;
    estante.load(ENTRY, table);
    const viewEntry = { ...ENTRY, defaultShapes: table };
    for (let offset = 0; offset < 12; offset += 1) {
      let got;
      expect(() => {
        got = estante.sheet(text, offset);
      }).not.toThrow();
      expect(got.rows).toEqual(chartRows(transpose(model, offset, { dialect: songDialect(model) })));
      const view = readSongSheet({ text, reading: { transposition: offset }, entry: viewEntry });
      expect(got.shapes.map(({ key, symbol, source }) => ({ key, symbol, source }))).toEqual(
        view.shapes.map(({ key, symbol, source }) => ({ key, symbol, source })),
      );
      expect(view.unvoiced).toEqual([]);
    }
  }, 60_000);

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

// reader.missed_shapes: the host's background search (§4.1; §4 host API
// `fill`), over the example book with one chord's entry removed from the table.
describe('fill (§4.1)', () => {
  const WALKING = () => song('walking-to-the-market.cifra.md');
  const missingKey = () => shapeCacheKey(parseChord('A', DEFAULT_DIALECT).chord, instrumentFor(ENTRY));
  const tableWithout = (chord) => {
    const shapes = { ...TABLE.shapes };
    delete shapes[chord];
    return { ...TABLE, shapes };
  };

  it('a queued miss is searched once and kept', () => {
    const key = missingKey();
    estante.load(ENTRY, tableWithout(key.chord));
    const cache = spies.caches.at(-1);
    const offer = vi.spyOn(cache, 'offer');
    const before = spies.search;

    const pending = estante.sheet(WALKING(), 2);
    expect(pending.shapes.filter((s) => s.pending).map((s) => s.symbol)).toEqual(['A']);
    expect(estante.misses()).toEqual([{ chord: key.chord, symbol: 'A', dialect: DEFAULT_DIALECT }]);

    expect(estante.fill(key.chord)).toEqual({ chord: key.chord, searched: true, found: true });
    expect(estante.misses()).toEqual([]);
    expect(estante.held().misses).toBe(0);

    const filled = estante.sheet(WALKING(), 2);
    expect(filled.shapes.some((s) => s.pending)).toBe(false);
    // The shape the full table gives, frets and diagram alike.
    estante.load(ENTRY, TABLE);
    const full = estante.sheet(WALKING(), 2);
    const a = (got) => got.shapes.find((s) => s.symbol === 'A');
    expect(a(filled).frets).toBe(a(full).frets);
    expect(a(filled).diagram).toEqual(a(full).diagram);
    expect(a(filled).frets).toBe(TABLE.shapes[key.chord]);
    expect(filled.shapes).toEqual(full.shapes);

    // A completed search is never repeated: the chord is no longer queued.
    const searches = spies.search;
    expect(estante.fill(key.chord)).toEqual({ chord: key.chord, searched: false });
    expect(spies.search).toBe(searches);
    expect(spies.search - before).toBe(1);
    expect(offer).toHaveBeenCalledTimes(1);
    expect(offer.mock.calls[0][1]).toBe(TABLE.shapes[key.chord]);
  });

  it('fill never writes the table it was loaded with', () => {
    const key = missingKey();
    const table = tableWithout(key.chord);
    const copy = structuredClone(table);
    estante.load(ENTRY, table);
    estante.sheet(WALKING(), 2);
    expect(estante.fill(key.chord).searched).toBe(true);
    expect(table).toEqual(copy);
    expect(table.shapes[key.chord]).toBeUndefined();
  });

  it('a chord with no shape becomes unvoiced', () => {
    // A stand-in instrument with two strings: no seventh chord fits on it.
    const twoStrings = { ...ENTRY, id: 'test-two-strings', tuning: 'A2 D3', stringCount: 2 };
    estante.load(twoStrings, null);
    const text = '# Test Two Strings\n\n```\nG7 | C\n```\n';
    const first = estante.sheet(text, 0);
    expect(first.shapes.find((s) => s.symbol === 'G7')).toMatchObject({ pending: true });
    const g7 = estante.misses().find((m) => m.symbol === 'G7');
    expect(g7).toBeTruthy();

    expect(estante.fill(g7.chord)).toEqual({ chord: g7.chord, searched: true, found: false });
    const next = estante.sheet(text, 0);
    expect(next.shapes.some((s) => s.symbol === 'G7')).toBe(false);
    expect(next.unvoiced).toContain('G7');
    expect(estante.misses().some((m) => m.chord === g7.chord)).toBe(false);
  });

  it('fill of a chord not queued does nothing', () => {
    const searches = spies.search;
    expect(estante.misses()).toEqual([]);
    expect(estante.fill('A maj')).toEqual({ chord: 'A maj', searched: false });
    expect(estante.fill(missingKey().chord)).toEqual({ chord: missingKey().chord, searched: false });
    expect(spies.search).toBe(searches);
  });

  it('answers plain data', () => {
    const key = missingKey();
    estante.load(ENTRY, tableWithout(key.chord));
    estante.sheet(WALKING(), 2);
    const got = estante.fill(key.chord);
    expect(JSON.parse(JSON.stringify(got))).toStrictEqual(got);
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

// reader.engine: the session's counts, so the Go host (and `bench`) can pin
// §4 "In memory, never re-derived" from outside the runtime.
describe('held (§4: what the session keeps)', () => {
  const defaulted = (got) => new Set(got.shapes.filter((s) => s.source === 'default').map((s) => s.symbol)).size;

  it('counts nothing right after load', () => {
    expect(estante.held()).toEqual({ songs: 0, shapes: 0, rebuilt: 0, misses: 0 });
  });

  it('a sheet keeps its song and rebuilds each defaulted chord once', () => {
    const got = estante.sheet(song('walking-to-the-market.cifra.md'), 3);
    expect(defaulted(got)).toBeGreaterThan(0);
    const held = estante.held();
    expect(held.songs).toBe(1);
    expect(held.rebuilt).toBe(defaulted(got));
    expect(held.shapes).toBe(defaulted(got));
    expect(held.misses).toBe(0);
  });

  it('a second read at the same key rebuilds nothing and re-parses nothing', () => {
    const text = song('walking-to-the-market.cifra.md');
    const first = estante.sheet(text, 3);
    const after = estante.held();
    const second = estante.sheet(text, 3);
    expect(second).toEqual(first);
    expect(estante.held()).toEqual(after);
  });

  it('counts the queued misses with no table', () => {
    estante.load(ENTRY, null);
    estante.sheet(song('walking-to-the-market.cifra.md'), 2);
    expect(estante.misses().length).toBeGreaterThan(0);
    expect(estante.held().misses).toBe(estante.misses().length);
    expect(estante.held().rebuilt).toBe(0);
  });

  it('load resets every count', () => {
    estante.sheet(song('walking-to-the-market.cifra.md'), 3);
    estante.sheet(song('the-ferry-line.cifra.md'), 5);
    expect(estante.held().songs).toBe(2);
    estante.load(ENTRY, TABLE);
    expect(estante.held()).toEqual({ songs: 0, shapes: 0, rebuilt: 0, misses: 0 });
  });

  it('answers plain data', () => {
    const got = estante.held();
    expect(JSON.parse(JSON.stringify(got))).toStrictEqual(got);
  });
});

// reader.sync: the Go host hands the home book's four files to the bundle,
// which chooses the entry and the table (design §4 host API `instrument`,
// §4.1); the answer crosses as plain JSON.
describe('instrument (reader.sync)', () => {
  const at = '2026-10-06T12:00:00.000Z';
  const files = () => ({
    instruments: {},
    preferences: {},
    shapes: {},
    defaultShapes: { [ENTRY.id]: { [ENTRY.tuning]: { [SHAPE_CACHE_SALT]: { at, value: TABLE } } } },
  });

  it("answers the standard guitar and the example book's table under the bundle's salt", () => {
    const got = estante.instrument(files());
    expect(got.salt).toBe(SHAPE_CACHE_SALT);
    expect(got.table).toEqual(TABLE);
    expect(got.entry.id).toBe(ENTRY.id);
    expect(got.entry.tuning).toBe(ENTRY.tuning);
    expect(estante.load(got.entry, got.table).held).toBe(Object.keys(TABLE.shapes).length);
  });

  it('answers plain JSON only', () => {
    const got = estante.instrument(files());
    expect(JSON.parse(JSON.stringify(got))).toStrictEqual(got);
    const empty = estante.instrument({ instruments: {}, preferences: {}, shapes: {}, defaultShapes: {} });
    expect(empty.table).toBeNull();
    expect(JSON.parse(JSON.stringify(empty))).toStrictEqual(empty);
  });
});

// reader.backend_views: what the reader's sheet and setlist screens need from
// the bundle so the Go host keeps no music (design §4 host API, §6 `105`,
// `106`; refinement Constraint 1).
describe('sheet for the reader (reader.backend_views; §6 105)', () => {
  it("picks the instrument's tuning from the songs.json variations, over `variation`", () => {
    // A song written for this test with two blocks for the standard tuning,
    // the default and one called High.
    const text = [
      '# Test Two Ways',
      '- key: C',
      '',
      '```',
      'C | G | C',
      '```',
      '',
      '---',
      '',
      '## Voicings: E2 A2 D3 G3 B3 E4',
      '- C: x32010',
      '- G: 320003',
      '',
      '## High: E2 A2 D3 G3 B3 E4',
      '- C: x35553',
      '- G: 355433',
      '',
    ].join('\n');
    const tuning = estante.sheet(text, 0).tuningId;
    const high = estante.sheet(text, 0, { variations: { [tuning]: 'High', '1 2 3': '' }, variation: '' });
    expect(high.shapes.map((s) => s.frets)).toEqual(['x35553', '355433']);
    const open = estante.sheet(text, 0, { variations: { '1 2 3': 'High' }, variation: 'High' });
    expect(open.shapes.map((s) => s.frets)).toEqual(['x32010', '320003']);
    expect(estante.sheet(text, 0, { variation: 'High' }).shapes.map((s) => s.frets)).toEqual(['x35553', '355433']);
  });

  it("returns the session's tuning id", () => {
    const got = estante.sheet(song('walking-to-the-market.cifra.md'), 0);
    expect(got.tuningId).toBe(estante.load(ENTRY, TABLE).tuningId);
    expect(got.tuningId).toBe('40 45 50 55 59 64');
  });

  it("returns each resolved shape's frets as shorthandOf its fingering", () => {
    const viewEntry = { ...ENTRY, defaultShapes: TABLE };
    for (const { text } of SONGS) {
      for (const offset of [0, 3]) {
        const got = estante.sheet(text, offset);
        const view = readSongSheet({ text, reading: { transposition: offset }, entry: viewEntry });
        expect(got.shapes.length).toBeGreaterThan(0);
        got.shapes.forEach((shape, i) => {
          expect(shape.frets).toBe(shorthandOf(view.shapes[i].fingering.frets));
        });
      }
    }
  });

  it('names key.saved at savedOffset, by the rule of key.named', () => {
    const walking = song('walking-to-the-market.cifra.md');
    expect(estante.sheet(walking, 0).key.saved).toBeNull();
    const got = estante.sheet(walking, 0, { savedOffset: 3 });
    expect(got.key.saved).toBe(estante.sheet(walking, 3).key.named);
    expect(got.key.saved).toBe('Bb');
    expect(got.key.named).toBe('G');
    // A song with no key is named by its last chord at the saved offset.
    const ferry = song('the-ferry-line.cifra.md');
    for (const at of [0, 3, 5]) {
      expect(estante.sheet(ferry, at, { savedOffset: 3 }).key.saved).toBe(estante.sheet(ferry, 3).key.named);
    }
    expect(estante.sheet(ferry, 0, { savedOffset: 0 }).key.saved).toBe(estante.sheet(ferry, 0).key.named);
  });
});

// reader.song_screen: the key grid's names come in the sheet, spelled by the
// bundle (workflow 19 §A song as amended; design §6 `105 sheet` key.choices).
describe('the key grid (reader.song_screen; §6 105 key.choices)', () => {
  const names = (sheet) => sheet.key.choices.map((c) => c.name);
  const offsets = (sheet) => sheet.key.choices.map((c) => c.offset);

  it('names the twelve keys of the grid from the written key', () => {
    const inC = estante.sheet(IN_C, 0);
    expect(names(inC)).toEqual(['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']);
    expect(offsets(inC)).toEqual([0, 1, 2, 3, 4, 5, 6, -5, -4, -3, -2, -1]);
    // As transposedKeyName spells them (transpose.js).
    for (const { name, offset } of inC.key.choices) expect(name).toBe(transposedKeyName('C', offset));
    // A minor song keeps its m.
    const minor = estante.sheet('# Test in Am\n- key: Am\n\n```\nAm | Dm | E7 | Am\n```\n', 0);
    expect(minor.key.choices).toHaveLength(12);
    for (const { name } of minor.key.choices) expect(name).toMatch(/m$/);
    expect(minor.key.choices.find((c) => c.offset === 0).name).toBe('Am');
    expect(names(minor)[0]).toBe('Cm');
    // A song written with ♭ glyphs keeps the glyphs.
    const glyphs = estante.sheet('# Test in B flat\n- key: B♭\n\n```\nB♭ | E♭ | F7 | B♭\n```\n', 0);
    expect(glyphs.key.choices.find((c) => c.offset === 0).name).toBe('B♭');
    expect(names(glyphs).some((n) => n.includes('♭'))).toBe(true);
    expect(names(glyphs).some((n) => n.includes('b'))).toBe(false);
  });

  it('names the grid of a song with no key from its last chord', () => {
    const got = estante.sheet(CHORO, 0);
    expect(got.key.written).toBeNull();
    expect(got.key.choices.find((c) => c.offset === 0).name).toBe('Dm');
    for (const { name, offset } of got.key.choices) expect(name).toBe(transposedKeyName('Dm', offset));
    expect([...offsets(got)].sort((a, b) => a - b)).toEqual([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6]);
  });

  it('gives no choices to a song with no chords', () => {
    expect(estante.sheet(NO_CHORDS, 0).key.choices).toEqual([]);
    expect(estante.sheet('# Test Keyed Quiet\n- key: G\n\nPlay it softly.\n```\n\n```\n', 0).key.choices).toEqual([]);
  });

  it('gives the same choices at every offset', () => {
    for (const text of [IN_C, CHORO, IN_G_ENDS_D7, song('walking-to-the-market.cifra.md')]) {
      const at0 = estante.sheet(text, 0).key.choices;
      expect(at0).toHaveLength(12);
      for (let offset = 1; offset < 12; offset += 1) {
        expect(estante.sheet(text, offset).key.choices).toEqual(at0);
      }
    }
  });
});

describe('setlist rows for the reader (reader.backend_views; §6 106)', () => {
  it('returns every item in order, a missing link and an unlinked item marked', () => {
    const text = [
      '# Test With a Gap',
      '',
      '1. [Morning on the Porch](morning-on-the-porch.cifra.md)',
      '2. [Lost Song](lost-song.cifra.md)',
      '   - key: D',
      '   - note: count it in slowly',
      '3. Something we have not written yet',
      '4. [Walking to the Market](walking-to-the-market.cifra.md)',
      '   - key: A',
      '',
    ].join('\n');
    const got = estante.setlist(text, 'with-a-gap.setlist.md', SONGS.map((s) => s.name));
    expect(got.rows).toEqual([
      { at: 0, number: 1, title: 'Morning on the Porch', path: 'morning-on-the-porch.cifra.md', key: null, note: null, missing: false },
      { at: 1, number: 2, title: 'Lost Song', path: 'lost-song.cifra.md', key: 'D', note: 'count it in slowly', missing: true },
      { at: 2, number: 3, title: 'Something we have not written yet', path: null, key: null, note: null, missing: true },
      { at: 3, number: 4, title: 'Walking to the Market', path: 'walking-to-the-market.cifra.md', key: 'A', note: null, missing: false },
    ]);
    // Items and missing are as before.
    expect(got.items.map((i) => i.path)).toEqual(['morning-on-the-porch.cifra.md', 'walking-to-the-market.cifra.md']);
    expect(got.missing).toBe(2);
    expect(JSON.parse(JSON.stringify(got))).toStrictEqual(got);
  });
});
