// unit — the search index's field extraction, ranking, chord-use and
// content-addressing (storage.index). All song text here is written for this
// test (no-song-text rule). Pins:
//   - field extraction → DIRECTION §3 L114-115, `.tji` "the fields";
//   - ranking → `.tji` "ranking", workflow 2 L22-24;
//   - chord-use → workflow 2 L37;
//   - content-addressing → DIRECTION §3 L115 "parsed once per distinct text".

import { describe, it, expect, vi } from 'vitest';
import { hashBlob } from 'isomorphic-git';
import { parse, parseSetlist } from 'cifra-md';
import { createSearchIndex, extractFields } from './search-index.js';

const FENCE = '```';
const song = (lines) => lines.join('\n') + '\n';
const setlist = (lines) => lines.join('\n') + '\n';

// The git blob oid of a song's working bytes — the same hash reconcile computes
// (search-index.js hashBlob) and the same identity a HEAD tree entry carries, so
// a stub HEAD map can hold the real oid for a "saved" file.
const BOOK_DIR = '/books/b';
const oidOf = async (text) =>
  (await hashBlob({ object: new TextEncoder().encode(text) })).oid;

// A minimal in-memory working tree (flat, book-dir only) for reconcile's unit
// test: it needs readdir/stat/readFile over the song files it is given. No git
// repo is stood up — the committed state is supplied by the stub `readHeadOids`.
function makeStubFs(fileMap) {
  const enoent = () => Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  const nameOf = (abs) => abs.slice(BOOK_DIR.length + 1);
  return {
    promises: {
      async readdir(abs) {
        if (abs === BOOK_DIR) return Object.keys(fileMap);
        throw enoent();
      },
      async stat(abs) {
        if (nameOf(abs) in fileMap) return { isDirectory: () => false };
        throw enoent();
      },
      async readFile(abs) {
        const name = nameOf(abs);
        if (!(name in fileMap)) throw enoent();
        return new TextEncoder().encode(fileMap[name]);
      },
    },
  };
}
const stubGit = { bookDir: () => BOOK_DIR };

describe('extractFields', () => {
  it('pulls the five fields (title, properties, section names, words, chords) and nothing else', () => {
    const src = song([
      '# Coração Valente',
      '- artist: Banda Teste',
      '- key: G',
      '',
      '## Intro',
      'uma nota de rodape apenas', // notes prose — must NOT be indexed
      '',
      '## Verso',
      FENCE,
      'G           D',
      'Era uma vez um coração',
      'Em              C',
      'cantando a solidão',
      FENCE,
    ]);
    const fields = extractFields(parse(src), 'oid-1');

    expect(fields.title).toBe('Coração Valente');
    expect(fields.artist).toBe('Banda Teste');
    // properties = the values (artist and the rest), not the keys.
    expect(fields.properties).toContain('Banda Teste');
    expect(fields.properties).toContain('G');
    // section names, the implicit lead section ("") dropped.
    expect(fields.sections.split(' ')).toEqual(
      expect.arrayContaining(['Intro', 'Verso']),
    );
    // lyric words come from the per-chord `words` on sung lines.
    expect(fields.words).toContain('coração');
    expect(fields.words).toContain('solidão');
    // chords are the chord-item symbols.
    expect(fields.chords.split(' ')).toEqual(
      expect.arrayContaining(['G', 'D', 'Em', 'C']),
    );

    // "nothing else": the notes prose "rodape" is not indexed into any field.
    const haystack = [
      fields.title,
      fields.properties,
      fields.sections,
      fields.words,
      fields.chords,
    ].join(' ');
    expect(haystack).not.toContain('rodape');
    // The extracted record carries only the known keys — the five searchable
    // text fields, the oid/artist, and the ordered chord sequence `chordSeq`
    // the progression field is derived from (storage.progression_search).
    expect(Object.keys(fields).sort()).toEqual(
      ['artist', 'chordSeq', 'chords', 'oid', 'properties', 'sections', 'title', 'words'].sort(),
    );
    // The chord sequence is the ordered, consecutive-collapsed run (not the
    // order-less `chords` set): canonical tokens, one per change.
    expect(Array.isArray(fields.chordSeq)).toBe(true);
    expect(fields.chordSeq.length).toBeGreaterThan(0);
  });

  it('tolerates a title-less, property-less song', () => {
    const fields = extractFields(parse(song(['## A', FENCE, 'G', FENCE])), 'oid-2');
    expect(fields.title).toBe('');
    expect(fields.artist).toBe('');
    expect(fields.properties).toBe('');
    expect(fields.chords).toContain('G');
  });
});

describe('createSearchIndex — ranking', () => {
  const index = createSearchIndex({ parse });

  it('ranks a title hit above a body-only hit, and a multi-field hit above a single-field hit', async () => {
    await index.indexDocument({
      bookId: 'b',
      path: 'title-hit.cifra.md',
      bytes: song(['# Melodia Azul', '## A', FENCE, 'C', FENCE]),
    });
    await index.indexDocument({
      bookId: 'b',
      path: 'words-hit.cifra.md',
      bytes: song([
        '# Outra Canção',
        '## A',
        FENCE,
        'C',
        'uma melodia no ar',
        FENCE,
      ]),
    });

    const results = index.search({ query: 'melodia' });
    expect(results.length).toBe(2);
    // The song whose title is "Melodia Azul" outranks the one that only sings
    // the word (title boost over words boost).
    expect(results[0].path).toBe('title-hit.cifra.md');
    expect(results[0].title).toBe('Melodia Azul');
    expect(results[0].score).toBeGreaterThan(results[1].score);
  });
});

describe('createSearchIndex — chord-use', () => {
  it('returns a song that uses a queried chord symbol', async () => {
    const index = createSearchIndex({ parse });
    await index.indexDocument({
      bookId: 'b',
      path: 'uses-bm7.cifra.md',
      bytes: song(['# Progressão', '## A', FENCE, 'Bm7   E', 'A', FENCE]),
    });
    await index.indexDocument({
      bookId: 'b',
      path: 'no-bm7.cifra.md',
      bytes: song(['# Simples', '## A', FENCE, 'C   G', FENCE]),
    });

    const results = index.search({ query: 'Bm7' });
    expect(results.map((r) => r.path)).toContain('uses-bm7.cifra.md');
    expect(results.map((r) => r.path)).not.toContain('no-bm7.cifra.md');
  });
});

describe('createSearchIndex — content-addressing', () => {
  it('parses once per distinct blob: two identical texts cause a single parse', async () => {
    const spy = vi.fn(parse);
    const index = createSearchIndex({ parse: spy });
    const bytes = song(['# Mesma Letra', '## A', FENCE, 'G   C', 'oi', FENCE]);

    await index.indexDocument({ bookId: 'b', path: 'copy-1.cifra.md', bytes });
    await index.indexDocument({ bookId: 'b', path: 'copy-2.cifra.md', bytes });

    // Same bytes → same git blob oid → one parse, shared record (DIRECTION §3 L115).
    expect(spy).toHaveBeenCalledTimes(1);
    // Both locations are still two distinct results (not grouped, workflow 2 L52).
    const results = index.search({ query: 'mesma' });
    expect(results.map((r) => r.path).sort()).toEqual([
      'copy-1.cifra.md',
      'copy-2.cifra.md',
    ]);
  });
});

// removeBook drops every location for one book at book scope, straight from the
// in-memory map (books.online_reindex acceptance 1, Decision 1). Pins the
// location-keying model of storage.index (Decision 3) and the
// drop-locations-not-docs constraint (books.online_reindex Decision 2). All song
// text is written for this test.
describe('createSearchIndex — removeBook', () => {
  const SEP = '\0';

  it('discards every location for the book and returns them all, leaving other books and the doc cache intact', async () => {
    const spy = vi.fn(parse);
    const index = createSearchIndex({ parse: spy });

    // A shared song text, indexed in BOTH books (same bytes → one blob oid →
    // one parse, one shared doc record — content-addressing).
    const shared = song(['# Partilhada', '## A', FENCE, 'C   G', 'oi', FENCE]);
    await index.indexDocument({ bookId: 'local-x', path: 'one.cifra.md', bytes: shared });
    await index.indexDocument({ bookId: 'local-x', path: 'folder/two.cifra.md', bytes: shared });
    // A second book keeps its own location (also backed by the shared doc).
    await index.indexDocument({ bookId: 'book-keep', path: 'three.cifra.md', bytes: shared });
    expect(spy).toHaveBeenCalledTimes(1); // one distinct text → one parse

    // Both of local-x's songs are findable before the drop.
    expect(index.search({ query: 'partilhada' }).map((r) => r.bookId).sort()).toEqual(
      ['book-keep', 'local-x', 'local-x'],
    );

    const changes = index.removeBook('local-x');

    // Every local-x location is returned in deleteLocations, keyed <bookId>\0<path>;
    // no docs or location puts are emitted (a pure drop).
    expect(changes.putDocs).toEqual([]);
    expect(changes.putLocations).toEqual([]);
    expect(new Set(changes.deleteLocations)).toEqual(
      new Set([`local-x${SEP}one.cifra.md`, `local-x${SEP}folder/two.cifra.md`]),
    );

    // local-x is gone from the index; book-keep's location survives untouched.
    const after = index.search({ query: 'partilhada' });
    expect(after.map((r) => r.bookId)).toEqual(['book-keep']);
    expect(after.map((r) => r.path)).toEqual(['three.cifra.md']);

    // The content-addressed doc cache is intact: re-indexing the same bytes
    // (a new location) reuses the cached doc — no re-parse (Decision 2).
    spy.mockClear();
    const reAdd = await index.indexDocument({
      bookId: 'local-x',
      path: 'one.cifra.md',
      bytes: shared,
    });
    expect(spy).not.toHaveBeenCalled();
    expect(reAdd.putDocs).toEqual([]); // doc already cached, only a location put
    expect(reAdd.putLocations).toHaveLength(1);
  });

  it('is a no-op for a book with no locations', () => {
    const index = createSearchIndex({ parse });
    const changes = index.removeBook('never-indexed');
    expect(changes).toEqual({ putDocs: [], putLocations: [], deleteLocations: [] });
  });
});

describe('createSearchIndex — accent-insensitive and scope', () => {
  const index = createSearchIndex({ parse });

  it('matches across accents and case, and honours a book/prefix scope', async () => {
    await index.indexDocument({
      bookId: 'b1',
      path: 'folder/one.cifra.md',
      bytes: song(['# Coração', '## A', FENCE, 'G', 'coração', FENCE]),
    });
    await index.indexDocument({
      bookId: 'b2',
      path: 'two.cifra.md',
      bytes: song(['# Outro', '## A', FENCE, 'C', 'coracao mais', FENCE]),
    });

    // `coracao` (no accents) finds *Coração* (workflow 2 L24).
    expect(index.search({ query: 'coracao' }).length).toBe(2);
    expect(index.search({ query: 'CORAÇÃO' }).length).toBe(2);

    // Scope to a single book.
    const inB1 = index.search({ query: 'coracao', scope: { books: ['b1'] } });
    expect(inB1.map((r) => r.bookId)).toEqual(['b1']);

    // Scope to a folder prefix within a book.
    const inFolder = index.search({
      query: 'coracao',
      scope: { bookId: 'b1', prefix: 'folder/' },
    });
    expect(inFolder.map((r) => r.path)).toEqual(['folder/one.cifra.md']);
  });
});

// Setlists ride the same index, indexed title-only and tagged kind:'setlist'
// (books.setlist_search). Pins workflow 12 §The file L33-34 ("Setlists are found
// by the same search as songs, marked as setlists"), the suffix/kind dispatch
// (Decision 1-3), and browse-stays-songs-only (Decision 4). All text is written
// for this test (no-song-text rule).
describe('createSearchIndex — setlists by kind', () => {
  it('indexes a *.setlist.md path title-only as kind:setlist, a *.cifra.md path as kind:song', async () => {
    const index = createSearchIndex({ parse, parseSetlist });

    const setlistChanges = await index.indexDocument({
      bookId: 'b',
      path: 'shows/noite.setlist.md',
      bytes: setlist(['# Noite no Bar', '', '1. [Uma](uma.cifra.md)']),
    });
    // The setlist doc carries kind:setlist and its title — and none of the
    // song-only fields (Decision 2, "Index the title only").
    expect(setlistChanges.putDocs).toHaveLength(1);
    const doc = setlistChanges.putDocs[0];
    expect(doc.kind).toBe('setlist');
    expect(doc.title).toBe('Noite no Bar');
    expect(doc.artist).toBeUndefined();
    expect(doc.sections).toBeUndefined();
    expect(doc.words).toBeUndefined();
    expect(doc.chords).toBeUndefined();
    expect(doc.chordSeq).toBeUndefined();

    const songChanges = await index.indexDocument({
      bookId: 'b',
      path: 'uma.cifra.md',
      bytes: song(['# Uma Canção', '## A', FENCE, 'C   G', FENCE]),
    });
    expect(songChanges.putDocs[0].kind).toBe('song');
    expect(songChanges.putDocs[0].chords).toContain('C');
  });

  it('a typed search returns both kinds with the kind tag on each row, and finds a setlist by its title', async () => {
    const index = createSearchIndex({ parse, parseSetlist });
    await index.indexDocument({
      bookId: 'b',
      path: 'festa.setlist.md',
      bytes: setlist(['# Festa na Praça', '', '1. [X](x.cifra.md)']),
    });
    await index.indexDocument({
      bookId: 'b',
      path: 'festa-cancao.cifra.md',
      bytes: song(['# Festa da Canção', '## A', FENCE, 'G', FENCE]),
    });

    const byPath = new Map(index.search({ query: 'festa' }).map((r) => [r.path, r]));
    expect(byPath.get('festa.setlist.md').kind).toBe('setlist');
    expect(byPath.get('festa.setlist.md').title).toBe('Festa na Praça');
    expect(byPath.get('festa-cancao.cifra.md').kind).toBe('song');
  });

  it('browse returns songs only — a setlist never appears in the pre-typing grouping (Decision 4)', async () => {
    const index = createSearchIndex({ parse, parseSetlist });
    await index.indexDocument({
      bookId: 'b',
      path: 'so.setlist.md',
      bytes: setlist(['# So Setlist', '', '1. [X](x.cifra.md)']),
    });
    await index.indexDocument({
      bookId: 'b',
      path: 'cancao.cifra.md',
      bytes: song(['# Cançãozinha', '## A', FENCE, 'C', FENCE]),
    });

    const paths = index.browse().books.flatMap((bk) => bk.songs.map((s) => s.path));
    expect(paths).toContain('cancao.cifra.md');
    expect(paths).not.toContain('so.setlist.md');
    // The setlist is still found by the typed search (Decision 4: found by
    // search, not by browse).
    expect(index.search({ query: 'So Setlist' }).some((r) => r.path === 'so.setlist.md')).toBe(true);
  });

  it('reconcile walks the working tree for both kinds, tagging each by suffix', async () => {
    const fileMap = {
      'minha.setlist.md': setlist(['# Minha Lista', '', '1. [Canção](cancao.cifra.md)']),
      'cancao.cifra.md': song(['# Canção Solta', '## A', FENCE, 'C   G', FENCE]),
    };
    const index = createSearchIndex({
      parse,
      parseSetlist,
      fs: makeStubFs(fileMap),
      git: stubGit,
      readHeadOids: async () => new Map(),
    });
    await index.reconcile('b');

    expect(index.search({ query: 'minha' }).find((r) => r.path === 'minha.setlist.md')?.kind).toBe(
      'setlist',
    );
    // browse (songs only) has the song, not the setlist.
    const browsed = index.browse().books.flatMap((bk) => bk.songs.map((s) => s.path));
    expect(browsed).toEqual(['cancao.cifra.md']);
  });
});

// reconcile derives `unsaved` from the committed HEAD oids
// (storage.index_dirty_reconcile). Pins the `.tji` note "reconcile with a dirty
// working tree sets unsaved: true" and DIRECTION §3.1 L129-131 (unsaved =
// working-copy-vs-committed). All song text is written for this test.
describe('createSearchIndex — reconcile derives unsaved from HEAD', () => {
  const unsavedByPath = (index) => {
    const map = new Map();
    for (const book of index.browse().books) {
      for (const s of book.songs) map.set(s.path, s.unsaved);
    }
    return map;
  };

  it('sets unsaved by comparing each working blob against its HEAD oid', async () => {
    const saved = song(['# Guardada', '## A', FENCE, 'C   G', FENCE]);
    const dirty = song(['# Alterada', '## A', FENCE, 'Am  F', FENCE]);
    const fresh = song(['# Novíssima', '## A', FENCE, 'Em', FENCE]);
    const fileMap = {
      'saved.cifra.md': saved,
      'dirty.cifra.md': dirty,
      'novo.cifra.md': fresh,
    };

    // HEAD holds: saved's real oid (unchanged), a non-matching oid for dirty
    // (its working bytes differ from what is committed), and NOTHING for novo
    // (never committed).
    const headOids = new Map([
      ['saved.cifra.md', await oidOf(saved)],
      ['dirty.cifra.md', 'this-is-not-the-working-oid'],
    ]);

    const index = createSearchIndex({
      parse,
      fs: makeStubFs(fileMap),
      git: stubGit,
      readHeadOids: async () => headOids,
    });
    const changes = await index.reconcile('b');

    const unsaved = unsavedByPath(index);
    // working oid === HEAD oid → saved.
    expect(unsaved.get('saved.cifra.md')).toBe(false);
    // working oid !== HEAD oid → dirty.
    expect(unsaved.get('dirty.cifra.md')).toBe(true);
    // absent from HEAD → never committed → unsaved.
    expect(unsaved.get('novo.cifra.md')).toBe(true);

    // The derived flag rides the persisted location records logic.js stores.
    const putByPath = new Map(changes.putLocations.map((l) => [l.path, l.unsaved]));
    expect(putByPath.get('saved.cifra.md')).toBe(false);
    expect(putByPath.get('dirty.cifra.md')).toBe(true);
    expect(putByPath.get('novo.cifra.md')).toBe(true);
  });

  it('recomputes unsaved on the content-unchanged fast path without re-parsing', async () => {
    const text = song(['# Rascunho', '## A', FENCE, 'G   D', 'oi', FENCE]);
    const fileMap = { 'rascunho.cifra.md': text };
    const spy = vi.fn(parse);

    // First reconcile with an EMPTY HEAD (nothing committed): the file is a new
    // draft → unsaved: true, and it is parsed once.
    let headOids = new Map();
    const index = createSearchIndex({
      parse: spy,
      fs: makeStubFs(fileMap),
      git: stubGit,
      readHeadOids: async () => headOids,
    });
    await index.reconcile('b');
    expect(unsavedByPath(index).get('rascunho.cifra.md')).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);

    // The same bytes are now committed: HEAD oid matches the working oid. The
    // second reconcile hits the content-unchanged fast path — no re-parse — but
    // still re-derives unsaved, flipping the stale true to false.
    spy.mockClear();
    headOids = new Map([['rascunho.cifra.md', await oidOf(text)]]);
    const changes = await index.reconcile('b');

    expect(spy).not.toHaveBeenCalled();
    expect(unsavedByPath(index).get('rascunho.cifra.md')).toBe(false);
    // The flag changed, so a location put is emitted (and only for the change).
    expect(changes.putLocations).toHaveLength(1);
    expect(changes.putLocations[0].path).toBe('rascunho.cifra.md');
    expect(changes.putLocations[0].unsaved).toBe(false);
    expect(changes.putDocs).toHaveLength(0);
  });

  it('emits no location put when a content-unchanged file keeps its unsaved flag', async () => {
    const text = song(['# Estável', '## A', FENCE, 'C', FENCE]);
    const fileMap = { 'estavel.cifra.md': text };
    // Committed and matching from the start → unsaved: false on both reconciles.
    const headOids = new Map([['estavel.cifra.md', await oidOf(text)]]);

    const index = createSearchIndex({
      parse,
      fs: makeStubFs(fileMap),
      git: stubGit,
      readHeadOids: async () => headOids,
    });
    await index.reconcile('b');
    const changes = await index.reconcile('b');

    // Nothing changed — oid unchanged and unsaved unchanged — so the fast path
    // emits no put at all (referential stability, index.md convention).
    expect(changes.putLocations).toHaveLength(0);
    expect(changes.putDocs).toHaveLength(0);
    expect(unsavedByPath(index).get('estavel.cifra.md')).toBe(false);
  });
});
