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
  // The shelf write path (books.shelf, workflow 7). CREATE_BOOK `{ title,
  // author }` makes an empty local songbook with no account — `git.init` +
  // §2.1 scaffold + one commit — writes its `shelf.local` entry through the
  // home book (provisioning a local home book if none exists), re-surfaces
  // SHELF and emits BOOK_CREATED. RENAME_BOOK `{ bookId, name, author }` writes
  // the book's shelf label (shared) or title (local) register and re-surfaces
  // SHELF — a label kept in the home book that changes nothing in the
  // repository (workflow 7 L16-18). Both commit locally, never push.
  CREATE_BOOK: 'create_book',
  RENAME_BOOK: 'rename_book',
  // Open the bundled example book (account.first_run, workflow 1 §Cold).
  // Payload `{ title, author }`: the localised shelf label (the view knows the
  // language) and the device-local commit identity. The Worker provisions a
  // local home book if none exists, seeds the bundled book as a local git
  // repository under a reserved id (idempotently — a second open reuses the one
  // repository), writes its `shelf.local` entry, re-surfaces SHELF, indexes the
  // book, and emits BOOK_CREATED. All local — no account, no network, no push.
  OPEN_EXAMPLE_BOOK: 'open_example_book',
  // Read a song's working-copy text into the view (songs.editor, Decision 4).
  // Payload `{ bookId, path }`: the Worker reads the live working-copy bytes
  // (NOT a committed version — READ_VERSION reads HEAD and would miss unsaved
  // edits) and replies with a SOURCE event. This is the read-back
  // storage.working_copy left out (it built WRITE/SAVE/DISCARD and no way to
  // read the current text back). Local, offline, no commit.
  OPEN_SOURCE: 'open_source',
  // Start a new song (songs.new_song, workflow 3). NEW_SONG `{ targetBookId?,
  // folder?, mySongsTitle?, author }` ensures the target book exists — for *My
  // songs* (when no `targetBookId`), idempotently under the reserved
  // `local-my-songs` id, provisioning a local home book and a `shelf.local`
  // entry if absent and re-surfacing SHELF; for a chosen book, a no-op — then
  // allocates a free `untitled[-N].cifra.md` placeholder path against the
  // book's working copy (in `folder` when given, else at the root) and replies
  // with a NEW_SONG_READY event. All local — no account, no network, no push.
  // `mySongsTitle` is the localised *My songs* shelf label and README identity
  // (the view knows the language), used only when provisioning *My songs*.
  NEW_SONG: 'new_song',
  // The first save of a new song (songs.new_song, workflow 3 §The first save).
  // NAME_AND_SAVE `{ bookId, fromPath, author, message?, title? }`: the Worker
  // parses the working-copy file for its title, derives the title's ASCII slug
  // filename (`deriveSongFilename`, with a collision suffix against the folder),
  // renames the placeholder to it, then canonicalises, commits and pushes (a
  // local book commits only; an online book pushes, or queues offline), and
  // replies with the existing SAVED event carrying the final `path`. The app
  // never renames it afterwards (DIRECTION §4 L446-448). `message` is the save
  // sheet's note — the commit message (songs.save_sheet Decision 5); absent, it
  // falls back to the W03 *Add {title}*. `title` is the name the save sheet
  // prompts for when the song has no title line yet (songs.save_sheet acceptance
  // 7); it feeds `deriveSongFilename` and the default message when the parsed
  // title is empty.
  NAME_AND_SAVE: 'name_and_save',
  // Compute the per-file save preview (songs.save_sheet, Decision 2). PREVIEW_SAVE
  // `{ bookId, paths }`: for each path the Worker reads the last-saved version
  // (HEAD) and the working copy, parses both and runs the semantic `diff`,
  // replying with a SAVE_PREVIEW event carrying `{ path, title, changes, summary,
  // isNew }` per path — one reply serving a single save and *save all* alike. A
  // read only: no canonicalise, no commit, no push. The Worker owns HEAD and the
  // working copy (DIRECTION §3.7); the view renders what it returns.
  PREVIEW_SAVE: 'preview_save',
  // Persist the author's display name to the home book (songs.save_sheet,
  // Decision 4; workflow 4 §Who made the change). SET_IDENTITY_NAME `{ name,
  // author }`: the Worker provisions a local home book if none exists and writes
  // the `authorName` register into preferences.json (home-book-format §4.1),
  // then re-surfaces PREFERENCES so the slice carries it and the first save is
  // the only one that asks. Offline, auto-committed, never pushed (a preference).
  SET_IDENTITY_NAME: 'set_identity_name',
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
  // The home book's shelf.json surfaced (storage.shelf_surface): `{ books, local }`
  // — two nested maps of `{value, at}` registers. `books` is the shared books
  // keyed by book id (each a map of `label`/`link`/`position` registers); `local`
  // is this device's local-only books (each a map of `title`/`position`),
  // narrowed to the device's namespace (home-book-format §4.2, §7). The producer
  // that reads the home book is storage.shelf_surface; the search screen and the
  // future book-management screen read it for labels.
  SHELF: 'shelf',
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
  // A new local book was created (books.shelf, CREATE_BOOK): `{ bookId }`, the
  // minted id of the book just added. It rides alongside the SHELF re-surface
  // that adds the book to the slice; the book-management screen uses it to move
  // focus to the new book (workflow 7 L25, Decision 2). It carries no title —
  // the title reaches the view through the shelf slice (standing no-logging /
  // no-labels rule).
  BOOK_CREATED: 'book_created',
  // A song's working-copy text, in reply to OPEN_SOURCE (songs.editor,
  // Decision 4): `{ bookId, path, text }`. The editor loads it into its
  // CodeMirror buffer; the `source` slice keeps it per book and path.
  SOURCE: 'source',
  // The per-file save preview, in reply to PREVIEW_SAVE (songs.save_sheet,
  // Decision 2): `{ bookId, previews: [{ path, title, changes, summary, isNew }] }`.
  // `changes` is the diff's ordered record list and `summary` its neutral-English
  // one-liner (cifra_js.diff); `title` is the working copy's title and `isNew`
  // whether the path has no committed version yet. The `savePreview` slice keeps
  // it per book for the save sheet and the discard confirm to render.
  SAVE_PREVIEW: 'save_preview',
  // A new song's target book and placeholder path are ready, in reply to
  // NEW_SONG (songs.new_song, Decision 2): `{ bookId, path }`. A transient
  // command reply, NOT a read model — the host folds it into ephemeral view
  // state ("which song is open" is the view's, Decision 5) and mounts the
  // editor on the returned book/path, so the editor's debounced WRITE has a
  // concrete destination from the first keystroke (SongEditor.jsx:113). It
  // adds no reducer slice; the host observes it through the store's event
  // subscription.
  NEW_SONG_READY: 'new_song_ready',
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
