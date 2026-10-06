// The message protocol between the main thread and the data Worker
// (DIRECTION §3.7 L394-401). Every message is a plain, structured-cloneable
// envelope so it survives `postMessage` across the real Worker boundary:
// commands travel main -> Worker, events travel Worker -> main. The `kind`
// field is an open string, so later storage and sync tasks (a clone's
// progress, a merge landing, a sync finishing — §3.7 L399-401) add message
// types without reshaping the channel.
//
// Framework-free: this module imports no React. It is the only thing the store
// and the Worker logic share (the constructors), which keeps the boundary thin.

// Rides on every envelope. No runtime negotiation is built — the service
// worker (`skipWaiting: false`) guarantees the Worker and the main thread are
// the same build within one load, so skew cannot occur mid-session — but the
// schema is still guarded by a version the day a migration needs it.
export const PROTOCOL_VERSION = 1;

// Direction tags. The store only ever reduces events; the Worker logic only
// ever handles commands. Each side ignores a message in the wrong direction.
export const COMMAND = 'command';
export const EVENT = 'event';

// Commands: main -> Worker. Open to extension. `OPEN` brings the Worker's
// database up (storage.fs). `WRITE`/`SAVE`/`DISCARD` are the working-copy flow
// (storage.working_copy): WRITE persists the editor's current text, SAVE
// canonicalises + commits + pushes, DISCARD puts files back as last saved.
// Later tasks add clone / fetch / merge / index without touching the envelope.
export const CommandKind = Object.freeze({
  OPEN: 'open',
  WRITE: 'write',
  SAVE: 'save',
  DISCARD: 'discard',
  // Sync the home book and re-surface its preferences (storage.preferences_surface):
  // fetch → merge key by key → commit → push, then re-emit PREFERENCES so a
  // register a sync changed reaches the slice. The sync engine drives this on
  // its schedule; it is the testable trigger for the re-emit.
  SYNC_HOME: 'sync_home',
  // The history reads (storage.history), each a local, offline read under the
  // book lock: SONG_LOG a song's versions (rename-followed, merges hidden unless
  // resolved), READ_VERSION a version's exact bytes, RESTORE_VERSION a version
  // into the working copy (uncommitted), BOOK_LOG the book's whole log for the
  // file view.
  SONG_LOG: 'song_log',
  READ_VERSION: 'read_version',
  RESTORE_VERSION: 'restore_version',
  BOOK_LOG: 'book_log',
  // Song search across every loaded book (storage.index, workflow 2). Payload
  // `{ query, scope? }`; the Worker queries its in-memory index and replies with
  // a SEARCH_RESULTS event. `scope` optionally narrows to book ids
  // (`{ books: [...] }`) or a folder prefix within a book (`{ bookId, prefix }`).
  SEARCH: 'search',
  // The pre-typing browse the search screen lands on (songs.search, workflow 2
  // L13-16). BROWSE reads every indexed location grouped by book over the
  // existing `index_locations` data (no re-parse — Decision 3) and replies with
  // a BROWSE_RESULTS event; `scope` narrows it the same way SEARCH's does.
  BROWSE: 'browse',
  // Record a song as recently opened (songs.search, workflow 2 L17-20).
  // Payload `{ bookId, path }`; the Worker writes a capped, most-recent-first
  // list into the device-local `meta` store (NOT the synced home book — no
  // commit) and replies with a RECENTS event. `songs.reading` calls this on
  // open; the search screen displays it.
  RECORD_RECENT: 'record_recent',
});

// Events: Worker -> main. `READY` carries the Worker's persisted `meta`;
// `ERROR` carries a message and a code. The working-copy outcomes
// (storage.working_copy): `SAVED` (commit + whether the push landed),
// `DISCARDED`, and `SAVE_REFUSED` (a marked or unreadable file named, with the
// first marker line). `PREFERENCES` carries the home book's preferences.json as
// a flat map of `{value, at}` registers (shell.tokens defines the consumer; the
// producer that reads the home book is storage.preferences_surface). Later
// tasks add progress / completion kinds the same way.
export const EventKind = Object.freeze({
  READY: 'ready',
  ERROR: 'error',
  SAVED: 'saved',
  DISCARDED: 'discarded',
  SAVE_REFUSED: 'save_refused',
  PREFERENCES: 'preferences',
  // The history outcomes (storage.history): SONG_LOG carries a song's filtered
  // version list, VERSION a version's exact bytes, BOOK_LOG the book's whole log,
  // and RESTORED `{ bookId, path }` so the UI can open the save sheet on the song
  // just restored into the working copy.
  SONG_LOG: 'song_log',
  VERSION: 'version',
  RESTORED: 'restored',
  BOOK_LOG: 'book_log',
  // The search index (storage.index). SEARCH_RESULTS carries a query's ranked
  // results — `{ query, results: [{ bookId, path, title, artist, score,
  // unsaved, voicedFor?, conflict? }] }`; `unsaved` is wired from the index's
  // location records now, `voicedFor`/`conflict` are the seam their owning
  // tasks (music / sync) fill (songs.search Decision 7). INDEX_STATUS carries a
  // per-book build state — `{ bookId, state }` where state is 'building' |
  // 'ready' — so the search screen can say a book is still loading (workflow 2
  // L159-162). Two kinds, not one, so results and status update their slices at
  // their own cadence (Decision 4).
  SEARCH_RESULTS: 'search_results',
  INDEX_STATUS: 'index_status',
  // The pre-typing browse (songs.search). BROWSE_RESULTS carries every indexed
  // location grouped by book — `{ books: [{ bookId, count, songs: [{ path,
  // title, artist, unsaved }] }] }` — for the "books as sections" listing
  // (workflow 2 L15-16). RECENTS carries the device-local recents list,
  // most-recent-first — `{ recents: [{ bookId, path, at }] }` — for the
  // "Recent" section (workflow 2 L13-20); it is never read from the home book.
  BROWSE_RESULTS: 'browse_results',
  RECENTS: 'recents',
});

// Build a command envelope (main -> Worker). `payload` is any
// structured-cloneable value; `kind` is open so callers in later tasks pass
// kinds this module does not yet name.
export function command(kind, payload = {}) {
  return { v: PROTOCOL_VERSION, dir: COMMAND, kind, payload };
}

// Build an event envelope (Worker -> main), same shape, opposite direction.
export function event(kind, payload = {}) {
  return { v: PROTOCOL_VERSION, dir: EVENT, kind, payload };
}
