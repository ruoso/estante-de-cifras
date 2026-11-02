// entry.js — the device bundle's entry: the host API, version 1, that the
// reMarkable reader's Go host calls in goja (docs/remarkable-reader.md §4).
//
// The reader never ports the music core: this file composes the web app's own
// modules — readSongSheet, chartRows, diagramModel, setlistRows, playableItems,
// playKeyOffset, createShapeCache — and adds no music of its own. What it adds
// is what a long-lived runtime on a slow device needs:
//
// - **No search on the reading path (§4.1).** The session's cache is read
//   through a read-only view: a chord the table does not hold reads as "no
//   shape" rather than being searched, nothing is offered back, and the chord
//   comes back *pending* — its place kept, drawn empty — and queued for the
//   host to search later (`misses`).
// - **Memory, never re-derived (§4).** Each song's parsed model is kept by its
//   text and each default rebuilt from the table by dialect and symbol, until
//   the next `load`. A pending default is never kept, so a later fill is seen.
// - **Plain data across the boundary.** Every call takes and returns JSON-shaped
//   values; the instrument instance and the parsed model stay in here, and
//   shapes leave as diagram models, never SVG.
//
// No logging: nothing here may print song text.

import './polyfills.js';
import { parse, parseSetlist } from 'cifra-md';
import { HOST_API } from './host-api.js';
import { SHAPE_CACHE_SALT, DECOMMISSIONED_SALTS, createShapeCache, shapeCacheKey } from '../core/shape-cache.js';
import { parseChord } from '../core/notation/parse.js';
import { shorthandOf } from '../core/fretstring.js';
import { transpose, transposedKeyName } from '../core/transpose.js';
import { songKeyName } from '../core/song-key.js';
import { readSongSheet, instrumentFor, songProperty, tuningIdOf } from '../songs/song-sheet.js';
import { chartRows } from '../chart/layout.js';
import { diagramModel } from '../render/diagram.js';
import { resolveDiagramDisplay } from '../theme/resolve.js';
import { setlistRows } from '../books/setlist-display.js';
import { playableItems, playKeyOffset } from '../books/setlist-play.js';
import { chooseInstrument } from './instrument.js';

// The session, as the last `load` made it.
let session = emptySession(null, null);

function emptySession(entry, table) {
  const instrument = instrumentFor(entry);
  // The session's cache, seeded from the table. A table of another fingerprint
  // is read as absent, as createShapeCache does for every host.
  const cache = instrument ? createShapeCache({ instrument, table }) : null;
  return {
    entry: instrument ? entry : null,
    instrument,
    tuningId: instrument ? tuningIdOf(entry) : '',
    cache,
    // The read-only view the reading path sees: a miss reads as "no shape", so
    // defaultVoicing never searches, and an offer is dropped. Each hit is one
    // shape rebuilt from the table — defaultVoicing asks only on a memo miss —
    // counted for `held`.
    view: cache
      ? {
          lookup(key) {
            const hit = cache.lookup(key);
            if (hit === undefined) return null;
            session.rebuilt += 1;
            return hit;
          },
          offer() {},
        }
      : null,
    parsed: new Map(), // text → parse model, or null when it would not parse
    defaults: new Map(), // `${dialect}\u0000${symbol}` → rebuilt fingering
    misses: new Map(), // §4.6 chord key → { chord, symbol, dialect }
    rebuilt: 0, // the view's lookup hits since this load
  };
}

function parsedOf(text) {
  if (session.parsed.has(text)) return session.parsed.get(text);
  let model = null;
  try {
    model = text == null ? null : parse(text);
  } catch {
    model = null;
  }
  session.parsed.set(text, model);
  return model;
}

function normalOffset(offset) {
  const n = Math.trunc(Number(offset) || 0);
  return ((n % 12) + 12) % 12;
}

/**
 * The instrument in use and its default-shape table, from the home book's
 * files `{ instruments, preferences, shapes, defaultShapes }` (parsed JSON,
 * absent as `{}`), for the host to hand to `load` (reader.sync; §4, §4.1):
 * `{ entry, table, salt }`, the table this bundle's salt's, else another
 * non-decommissioned salt's whose fingerprint fits, else null.
 */
function instrument(files) {
  return chooseInstrument(files ?? {}, { salt: SHAPE_CACHE_SALT, decommissioned: DECOMMISSIONED_SALTS });
}

/**
 * Begin a session on an instrument: its entry as the Worker surfaces it, and
 * its §4.6 table `{ fingerprint, shapes }` (or null). Clears the memos and the
 * miss queue.
 */
function load(entry, table) {
  session = emptySession(entry ?? null, table ?? null);
  return {
    fingerprint: session.cache ? session.cache.fingerprint : null,
    tuningId: session.tuningId,
    held: session.cache ? session.cache.size : 0,
  };
}

/**
 * A song's sheet, read at `offset` (or at the setlist's `targetKey`), as plain
 * data. `opts` is `{ variation?, variations?, preferences?, targetKey?,
 * savedOffset? }`: `variations` is the song's `songs.json` map by tuning id —
 * the session's own tuning picks from it, and it wins over `variation`, which
 * applies to the session's tuning — and `savedOffset` is the account's saved
 * transposition, named as `key.saved` by the same rule as `key.named`.
 */
function sheet(text, offset = 0, opts = {}) {
  const { variation = '', variations = null, preferences = null, targetKey = null, savedOffset = null } = opts ?? {};
  const parsed = parsedOf(text);
  if (!parsed) return { error: 'unreadable' };

  // The setlist's key is a target key (workflow 12 §The key): read at the offset
  // it asks for, or — for a song with no key, or of the other mode — at the
  // offset given, with the target carried as a note.
  let at = normalOffset(offset);
  let keyNote = null;
  if (targetKey) {
    const move = playKeyOffset(songProperty(parsed, 'key'), targetKey);
    if (move === null) keyNote = String(targetKey);
    else at = move;
  }

  const read = readSongSheet({
    text,
    parsed,
    reading: {
      transposition: at,
      variations: readingVariations(variations, variation),
    },
    entry: session.entry,
    preferences,
    cache: session.view ?? undefined,
    defaults: session.defaults,
  });

  // A chord left unresolved is pending when the table does not hold it — it is
  // queued for the host's search and its memo entry dropped, so a later fill is
  // seen — and unvoiceable when the table says it has no shape.
  const pending = new Set();
  const unvoiced = [];
  for (const key of read.unvoiced) {
    const symbol = read.symbolByKey.get(key) ?? key;
    const chord = session.cache ? parseChord(symbol, read.notation).chord : null;
    const cacheKey = chord ? shapeCacheKey(chord, read.instrument) : null;
    if (cacheKey && session.cache.lookup(cacheKey) === undefined) {
      pending.add(key);
      session.defaults.delete(`${read.notation}\u0000${symbol}`);
      if (!session.misses.has(cacheKey.chord)) {
        session.misses.set(cacheKey.chord, { chord: cacheKey.chord, symbol, dialect: read.notation });
      }
    } else {
      unvoiced.push(key);
    }
  }

  // The song's key as it is read now (workflow 19 §A song): the written key
  // transposed when the song states one, else the key its last chord gives in
  // the model as read. Null only for a song with no key and no chords. It is a
  // name only — a setlist key on a keyless song stays `keyNote` (§10.7.1).
  const named = transposedKeyName(read.writtenKey, read.offset) ?? songKeyName(read.model, read.notation);
  // The account's saved key (workflow 19 §A song, *Your key*): the song named as
  // it would be read at the saved transposition, by the same rule.
  const saved = Number.isInteger(savedOffset) ? savedKeyName(read, savedOffset, named) : null;

  const { handed } = resolveDiagramDisplay(preferences);
  const resolved = new Map(read.shapes.map((s) => [s.key, s]));
  const shapes = [];
  for (const { key, symbol } of read.chordList) {
    const shape = resolved.get(key);
    if (shape) {
      shapes.push({
        key,
        symbol: shape.symbol,
        source: shape.source,
        frets: shorthandOf(shape.fingering.frets),
        diagram: diagramModel(shape.fingering, { handed }),
      });
    } else if (pending.has(key)) {
      shapes.push({ key, symbol, pending: true });
    }
  }

  return {
    title: parsed.title ?? null,
    artist: read.artist ?? null,
    key: {
      written: read.writtenKey ?? null,
      named: named ?? null,
      saved: saved ?? null,
      status: read.status ?? null,
    },
    offset: read.offset,
    transposed: read.transposed,
    rows: chartRows(read.model),
    shapes,
    unvoiced,
    notes: read.blockNotes,
    keyNote,
    tuningId: session.tuningId,
  };
}

// The `songs.json` variations by tuning id, as readSongSheet takes them: the
// whole map when given (readSongSheet picks the session's tuning from it), else
// the one `variation` applied to the session's tuning.
function readingVariations(variations, variation) {
  if (variations && typeof variations === 'object') return { ...variations };
  return variation && session.tuningId ? { [session.tuningId]: variation } : {};
}

// The song's key named at `savedOffset`: the written key transposed, else the
// key the last chord gives in the model read at that offset (the same rule as
// `named`; the read model is reused when the offsets agree).
function savedKeyName(read, savedOffset, named) {
  const at = normalOffset(savedOffset);
  if (read.writtenKey) return transposedKeyName(read.writtenKey, at);
  if (at === read.offset) return named;
  if (!read.baseModel) return null;
  return songKeyName(transpose(read.baseModel, at, { dialect: read.notation }), read.notation);
}

/**
 * A setlist's playable items, in order, each with the book-root path it
 * resolved to; `missing` counts the items that cannot be played; and `rows`,
 * every item in order (songs and unlinked items, as `setlistRows` gives them)
 * for the setlist screen, each marked `missing` or not — an unlinked item's
 * `path` is null.
 */
function setlist(text, setlistPath, bookPaths) {
  const model = parseSetlist(String(text ?? ''));
  const rows = setlistRows(model, String(setlistPath ?? ''), bookPaths ?? []);
  const items = playableItems(rows).map((row) => ({
    at: row.at,
    number: row.number,
    title: row.title,
    path: row.resolvedPath,
    key: row.key ?? null,
    note: row.note ?? null,
  }));
  const all = rows.map((row) => ({
    at: row.at,
    number: row.number,
    title: row.title,
    path: row.resolvedPath ?? null,
    key: row.key ?? null,
    note: row.note ?? null,
    missing: row.missing,
  }));
  return {
    title: model.title ?? null,
    items,
    missing: rows.length - items.length,
    rows: all,
  };
}

/** The queued misses, `[{ chord, symbol, dialect }]`; cleared only by `load`. */
function misses() {
  return [...session.misses.values()].map((m) => ({ ...m }));
}

/**
 * What the session keeps (§4 "In memory, never re-derived"), as counts for the
 * host's checks and `bench`: songs parsed, shapes held rebuilt, rebuilds since
 * the last `load`, and misses queued.
 */
function held() {
  return {
    songs: session.parsed.size,
    shapes: session.defaults.size,
    rebuilt: session.rebuilt,
    misses: session.misses.size,
  };
}

export const estante = Object.freeze({
  hostApi: HOST_API,
  salt: SHAPE_CACHE_SALT,
  instrument,
  load,
  sheet,
  setlist,
  misses,
  held,
});

globalThis.estante = estante;
