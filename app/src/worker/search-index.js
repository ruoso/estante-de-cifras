// search-index.js — the derived, blob-hash-keyed song search index
// (storage.index). DIRECTION §3 L114-117: "A derived index of every song —
// title, properties, sections, words, chords — keyed by blob hash, so a song is
// parsed once per distinct text … It covers the working copy too, so unsaved
// work is findable." DIRECTION §4 L430-431: "Song search is the primary
// interface. One search across every loaded book." This module is the engine:
// it extracts the five fields from a parsed `cifra-md` model, folds them for
// accent-insensitive matching, and ranks matches with MiniSearch.
//
// It is named `search-index`, NOT `index`, so it never collides with the
// Worker's real thread entry `index.js` (Decision 1). It mirrors the
// factory-with-injected-collaborators shape of `createGitLayer` /
// `createWorkingCopy`: `createSearchIndex({ fs, git, parse })`.
//
// BOUNDARY (Decision 3, refinement "Worker-only"): this module owns only the
// in-memory MiniSearch instance and the extracted-field records; it NEVER
// touches IndexedDB. Persistence of its records (the `index_docs` /
// `index_locations` stores) is `logic.js`'s job — the one owner of the `estante`
// database. Mutating methods RETURN the record changes for `logic.js` to persist
// and are rehydrated through `hydrate()` on launch, so the index survives a
// restart without re-parsing (Decision 3). Content-addressing: a text is parsed
// at most once per distinct git blob oid (DIRECTION §3 L115).
//
// Framework-free, Worker-only: plain ESM, no React. Logs nothing — never song
// text, titles, chords or paths (standing rule, logic.js:9-11).

import MiniSearch from 'minisearch';
import { hashBlob } from 'isomorphic-git';
import { fold } from './fold.js';

// The five searchable fields (DIRECTION §3 L114-115, §4 L431). `title` carries
// the heaviest boost so a title hit outranks a body-only hit; a query matching
// more fields scores higher because MiniSearch sums each field's contribution
// (acceptance 3, `.tji` "ranking").
const SEARCH_FIELDS = ['title', 'properties', 'sections', 'words', 'chords'];
const FIELD_BOOST = { title: 10, properties: 4, chords: 4, sections: 3, words: 1 };

// A MiniSearch document id is a LOCATION — a book + path — not a title: two
// songs with the same title are two results ("Results are not grouped by song",
// workflow 2 L52-54). The NUL separator cannot occur in a book id or a path.
const SEP = '\0';
const locationKey = (bookId, path) => `${bookId}${SEP}${path}`;

// Only song files are indexed (acceptance 1). Setlists and other artifacts are
// out of scope (Deferred work).
const SONG_SUFFIX = '.cifra.md';

/**
 * Pull the five indexed fields from a parsed `cifra-md` model, plus the artist
 * for the result row. Nothing else — note/verbatim prose, voicings blocks and
 * diagnostics are deliberately not indexed (acceptance 2, unit "field
 * extraction … and nothing else"). `title`, section names and the property
 * *values* (artist and the rest) are content; lyric text comes from `lyric`
 * lines and the per-chord `words` laid out on `sung` lines; chord symbols come
 * from the chord items of music lines.
 *
 * @param {object} model a `cifra-md` parse model
 * @param {string} oid the git blob oid of the song's bytes (the record key)
 * @returns {{ oid: string, title: string, artist: string, properties: string,
 *   sections: string, words: string, chords: string }}
 */
export function extractFields(model, oid) {
  const properties = Array.isArray(model?.properties) ? model.properties : [];
  const artist = properties.find((p) => p?.key === 'artist')?.value ?? '';
  const sections = Array.isArray(model?.sections) ? model.sections : [];

  const words = [];
  const chords = new Set();
  for (const section of sections) {
    for (const part of section?.body ?? []) {
      if (part?.type !== 'music') continue;
      for (const line of part.lines ?? []) {
        if (line?.kind === 'lyric') {
          if (line.text) words.push(line.text);
        } else if (line?.kind === 'sung' || line?.kind === 'chart') {
          // The per-chord `words` fragments of a sung line are contiguous
          // substrings of its lyric text, so a chord that falls mid-word splits
          // that word across two fragments. Concatenate them WITHOUT a
          // separator to rebuild the line's text whole (otherwise "solidão"
          // under a mid-word chord would index as "solid ão"); word boundaries
          // live inside the fragments. Lines are joined with a space below.
          let lineWords = '';
          for (const measure of line.measures ?? []) {
            for (const item of measure?.items ?? []) {
              // `words` is the syllable fragment laid out under a chord on a
              // sung line; absent on a chart line.
              if (item?.words) lineWords += item.words;
              if (item?.type === 'chord' && item.symbol) chords.add(item.symbol);
            }
          }
          if (lineWords) words.push(lineWords);
        }
      }
    }
  }

  return {
    oid,
    title: model?.title ?? '',
    artist,
    properties: properties.map((p) => p?.value ?? '').join(' '),
    sections: sections.map((s) => s?.name ?? '').filter(Boolean).join(' '),
    words: words.join(' '),
    chords: [...chords].join(' '),
  };
}

/**
 * Build the search index over the injected collaborators.
 *
 * @param {{
 *   fs?: import('./fs.js').FileSystem,
 *   git?: ReturnType<typeof import('./git.js').createGitLayer>,
 *   parse: (bytes: Uint8Array|string) => object,
 * }} deps `fs`/`git` are used only to read and locate working-tree bytes
 *   (`reconcile`, `reindexPath`); `parse` turns those bytes into a model.
 */
export function createSearchIndex({ fs, git, parse } = {}) {
  if (typeof parse !== 'function') {
    throw new Error('createSearchIndex requires a parse function');
  }

  // The content-addressed parse cache: blob oid -> extracted fields. A text is
  // parsed at most once per distinct oid (DIRECTION §3 L115).
  let docsByOid = new Map();
  // The MiniSearch doc id (location key) -> { key, bookId, path, oid, unsaved }.
  let locationByKey = new Map();
  let mini = makeMini();

  function makeMini() {
    return new MiniSearch({
      idField: 'id',
      fields: SEARCH_FIELDS,
      storeFields: ['bookId', 'path', 'title', 'artist'],
      // The accent fold is applied to indexed terms AND query terms alike
      // through `processTerm`, so `coracao` matches *Coração* (Decision 7,
      // DIRECTION §4 L431-432). A term that folds to empty is dropped.
      processTerm: (term) => fold(term) || null,
    });
  }

  // The MiniSearch document for a location joined to its parsed fields.
  function toMiniDoc(location, doc) {
    return {
      id: location.key,
      bookId: location.bookId,
      path: location.path,
      title: doc.title,
      artist: doc.artist,
      properties: doc.properties,
      sections: doc.sections,
      words: doc.words,
      chords: doc.chords,
    };
  }

  // Parse `bytes` into extracted fields, or — on the only throw `parse` makes,
  // `NotUtf8Error` — an empty record, so a non-UTF-8 file caches its oid (never
  // re-parsed) and simply stays unfindable rather than crashing the build.
  function extractFromBytes(bytes, oid) {
    try {
      return extractFields(parse(bytes), oid);
    } catch {
      return { oid, title: '', artist: '', properties: '', sections: '', words: '', chords: '' };
    }
  }

  /**
   * Rebuild the in-memory MiniSearch instance from persisted records — no file
   * is re-parsed (Decision 3). Called once on launch with every stored doc and
   * location.
   *
   * @param {Array<object>} docs stored `index_docs` records (keyed by oid)
   * @param {Array<object>} locations stored `index_locations` records
   */
  function hydrate(docs = [], locations = []) {
    docsByOid = new Map(docs.map((d) => [d.oid, d]));
    locationByKey = new Map(locations.map((l) => [l.key, l]));
    mini = makeMini();
    const miniDocs = [];
    for (const location of locationByKey.values()) {
      const doc = docsByOid.get(location.oid);
      if (doc) miniDocs.push(toMiniDoc(location, doc));
    }
    mini.addAll(miniDocs);
  }

  // Index (or re-index) one location from its raw bytes. `parse` runs only when
  // the oid is new to the cache (content-addressing). Returns the record changes
  // for logic.js to persist.
  async function indexDocument({ bookId, path, bytes, unsaved = false }) {
    const key = locationKey(bookId, path);
    const { oid } = await hashBlob({ object: bytes });
    const changes = { putDocs: [], putLocations: [], deleteLocations: [] };

    let doc = docsByOid.get(oid);
    if (!doc) {
      doc = extractFromBytes(bytes, oid);
      docsByOid.set(oid, doc);
      changes.putDocs.push(doc);
    }

    const location = { key, bookId, path, oid, unsaved };
    locationByKey.set(key, location);
    changes.putLocations.push(location);

    // Replace this location's MiniSearch document (ids are unique): `replace`
    // when it already exists, `add` otherwise.
    const miniDoc = toMiniDoc(location, doc);
    if (mini.has(key)) mini.replace(miniDoc);
    else mini.add(miniDoc);
    return changes;
  }

  // Read one working-tree file and (re-)index it. Covers unsaved work: it hashes
  // the CURRENT bytes, not a committed blob (DIRECTION §3 L116-117).
  async function reindexPath({ bookId, path, unsaved = false }) {
    const full = `${git.bookDir(bookId)}/${path}`;
    const bytes = await fs.promises.readFile(full);
    return indexDocument({ bookId, path, bytes, unsaved });
  }

  // Remove a location from the index (a never-saved file that was discarded —
  // acceptance 5). The parse cache is left intact (it is content-addressed and
  // may still back another location).
  function removePath({ bookId, path }) {
    const key = locationKey(bookId, path);
    if (mini.has(key)) mini.discard(key);
    locationByKey.delete(key);
    return { putDocs: [], putLocations: [], deleteLocations: [key] };
  }

  // Walk a book's working tree for song files, relative to its book dir.
  async function songPaths(bookId) {
    const dir = git.bookDir(bookId);
    const out = [];
    async function walk(rel) {
      const abs = rel ? `${dir}/${rel}` : dir;
      let entries;
      try {
        entries = await fs.promises.readdir(abs);
      } catch (err) {
        if (err?.code === 'ENOENT') return;
        throw err;
      }
      for (const name of entries) {
        if (name === '.git') continue;
        const childRel = rel ? `${rel}/${name}` : name;
        const stat = await fs.promises.stat(`${dir}/${childRel}`);
        if (stat.isDirectory()) await walk(childRel);
        else if (name.endsWith(SONG_SUFFIX)) out.push(childRel);
      }
    }
    await walk('');
    return out;
  }

  // Merge one change-set into an accumulator.
  function mergeChanges(into, from) {
    into.putDocs.push(...from.putDocs);
    into.putLocations.push(...from.putLocations);
    into.deleteLocations.push(...from.deleteLocations);
  }

  /**
   * Bring a book's locations into line with its working tree (acceptance 1, 6,
   * 7). For each song file, hash the current bytes to a blob oid: an unchanged
   * oid whose doc is already in the cache is skipped entirely (no parse — the
   * reopen re-reads nothing that has not changed); a new or changed file is
   * (re-)indexed. Locations whose file has vanished are dropped. Returns the
   * record changes for logic.js to persist.
   *
   * @param {string} bookId
   */
  async function reconcile(bookId) {
    const changes = { putDocs: [], putLocations: [], deleteLocations: [] };
    const paths = await songPaths(bookId);
    const present = new Set(paths.map((p) => locationKey(bookId, p)));

    for (const path of paths) {
      const key = locationKey(bookId, path);
      const full = `${git.bookDir(bookId)}/${path}`;
      const bytes = await fs.promises.readFile(full);
      const { oid } = await hashBlob({ object: bytes });
      const prev = locationByKey.get(key);
      if (prev && prev.oid === oid && docsByOid.has(oid)) continue;
      mergeChanges(changes, await indexDocument({ bookId, path, bytes }));
    }

    // Drop locations for files this book no longer has on disk.
    for (const location of [...locationByKey.values()]) {
      if (location.bookId === bookId && !present.has(location.key)) {
        mergeChanges(changes, removePath({ bookId, path: location.path }));
      }
    }
    return changes;
  }

  function matchesScope(result, scope) {
    if (!scope) return true;
    if (Array.isArray(scope.books) && !scope.books.includes(result.bookId)) {
      return false;
    }
    if (scope.bookId && result.bookId !== scope.bookId) return false;
    if (scope.prefix && !result.path.startsWith(scope.prefix)) return false;
    return true;
  }

  /**
   * Query the index, ranked, filtered to the optional scope (acceptance 3, 8).
   * `prefix` matching lets results narrow on every keystroke (workflow 2 L22).
   * Runs entirely in memory, in the Worker; the MiniSearch instance never leaves
   * it (Decision 8).
   *
   * @param {{ query?: string, scope?: object }} [opts]
   * @returns {Array<{ bookId: string, path: string, title: string, artist: string, score: number }>}
   */
  function search({ query, scope } = {}) {
    const q = (query ?? '').trim();
    if (!q) return [];
    const hits = mini.search(q, {
      prefix: true,
      boost: FIELD_BOOST,
      filter: (result) => matchesScope(result, scope),
    });
    return hits.map((r) => ({
      bookId: r.bookId,
      path: r.path,
      title: r.title,
      artist: r.artist,
      score: r.score,
    }));
  }

  return {
    hydrate,
    indexDocument,
    reindexPath,
    removePath,
    reconcile,
    search,
  };
}
