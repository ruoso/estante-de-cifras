// The Worker's data logic — transport-agnostic (DIRECTION §3.7 L394-396).
// "One owner for the data: a Web Worker. … The main thread never touches
// IndexedDB." This module is that owner's brain: it handles commands, opens
// and owns the Worker's IndexedDB database, and emits events through an
// injected port. Because the port is injected rather than `self`, the same
// logic runs behind the real worker global in production and in-process behind
// a loopback double in a test (jsdom has no `Worker`), fed a fake IndexedDB.
//
// Framework-free: no React. Logs nothing — in particular never song text,
// commit messages, or secrets (standing rule); this task stores none of those
// anyway, only the schema `meta`.

import { parse } from 'cifra-md';
import { event, EventKind, COMMAND, CommandKind } from './protocol.js';
import {
  MIGRATIONS,
  META_STORE,
  INDEX_DOCS_STORE,
  INDEX_LOCATIONS_STORE,
  latestVersion,
  runMigrations,
} from './migrations.js';
import { createFileSystem, createPersister } from './fs.js';
import { createBookLocks } from './locks.js';
import { createGitHttpClient } from './git-http.js';
import { createGitLayer } from './git.js';
import { createWorkingCopy } from './working-copy.js';
import { createSavePreview } from './save-preview.js';
import { createHistory } from './history.js';
import { createBookTree } from './book-tree.js';
import { createHomeBook, HOME_BOOK_ID } from './home-book.js';
import { createBooks } from './books.js';
import { createExampleBook } from './example-book.js';
import { createMySongs, MY_SONGS_ID } from './my-songs.js';
import { deriveSongFilename } from '../songs/song-filename.js';
import { createSearchIndex } from './search-index.js';
import { createRecents } from './recents.js';
import { surfacePreferences } from './preferences.js';
import { surfaceShelf } from './shelf.js';
import { surfaceInstruments, instrumentRemoval } from './instruments.js';
import { defaultPresetFor } from '../core/instrument.js';
import { authorFrom } from './author.js';

// The schema version the database opens at, DERIVED from the migration step
// list (single source of truth — migrations.js Decision 1): bumping the schema
// is appending a step there, nothing here. `storage.migrations` turned the
// single-version open into this versioned stepping.
export const SCHEMA_VERSION = latestVersion(MIGRATIONS);
export const DB_NAME = 'estante';
export const META_KEY = 'meta';

// Open (and, first time or on upgrade, migrate) the Worker's database at the
// latest schema version derived from `steps`. `idb` is the IndexedDB factory —
// `globalThis.indexedDB` in a real Worker, an injected fake in a test. Every
// step between the version found on disk and `version` runs in order inside the
// one `versionchange` transaction.
function openDatabase(idb, name, version, steps) {
  return new Promise((resolve, reject) => {
    const request = idb.open(name, version);
    request.onupgradeneeded = (ev) => {
      const db = request.result;
      // The `versionchange` transaction — the only place structural changes are
      // valid, and the atomicity that keeps a half-applied upgrade from
      // corrupting a user's only copy of their books.
      const tx = request.transaction;
      try {
        runMigrations(db, tx, ev.oldVersion, ev.newVersion, steps);
      } catch (err) {
        // A step threw: abort so the on-disk version does not advance and no
        // store is half-built, then surface the original cause. The abort also
        // fires `onerror`, but the promise is already settled (Decision 3).
        try {
          tx.abort();
        } catch {
          // Already aborting — nothing more to do.
        }
        reject(err);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('database open blocked'));
  });
}

// Read the persisted `meta` record, creating it on first open and keeping its
// `schemaVersion` in step with the version on disk after an upgrade (Decision
// 5): a fresh Worker instance reads `meta` to know what shape it is looking at,
// so the record must never lie about the database. The on-disk version is
// `db.version` — the version migrations just stepped the database to. The
// record is what a fresh Worker instance over the same database recovers;
// resolved on transaction completion so the write is durable before we report
// it. `createdAt` is preserved across upgrades.
function loadOrCreateMeta(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readwrite');
    const store = tx.objectStore(META_STORE);
    const request = store.get(META_KEY);
    let meta;
    request.onsuccess = () => {
      meta = request.result;
      if (!meta) {
        meta = {
          schemaVersion: db.version,
          protocolVersion: 1,
          createdAt: Date.now(),
        };
        store.put(meta, META_KEY);
      } else if (meta.schemaVersion !== db.version) {
        // An upgrade advanced the database since this record was written; keep
        // it honest without disturbing the rest of the record.
        meta = { ...meta, schemaVersion: db.version };
        store.put(meta, META_KEY);
      }
    };
    tx.oncomplete = () => {
      // The §2.3 device id is home-book's internal namespace key, kept as a bare
      // field on this same singleton record (home-book.js `ensureDeviceId`,
      // Decision 7) — it is never view state. Surface only the schema/protocol
      // fields this owner manages, so the recovered `meta` slice is identical on
      // every launch regardless of when the device id was written to the record
      // (it is written after READY, out of this transaction's band).
      const view = { ...meta };
      delete view.deviceId;
      resolve(view);
    };
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Whether both search-index stores exist on this connection. They are created
// by migration step 2, so they are always present in production; a database
// opened against a schema that lacks them (e.g. the migration framework driven
// with an injected step list) simply has no persistent index. The derived index
// is a secondary layer and must never fault the open connection, so its reads
// return empty and its writes no-op when the stores are absent.
function hasIndexStores(db) {
  return (
    db.objectStoreNames.contains(INDEX_DOCS_STORE) &&
    db.objectStoreNames.contains(INDEX_LOCATIONS_STORE)
  );
}

// Read every persisted search-index record (storage.index). All IndexedDB
// access for the index lives here in the one database owner; the index module
// itself never touches IndexedDB (Decision 3). Resolved on transaction
// completion so the full set is in hand before the in-memory index is rebuilt.
function readIndexStores(db) {
  if (!hasIndexStores(db)) return Promise.resolve({ docs: [], locations: [] });
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      [INDEX_DOCS_STORE, INDEX_LOCATIONS_STORE],
      'readonly',
    );
    const docs = [];
    const locations = [];
    tx.objectStore(INDEX_DOCS_STORE).openCursor().onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (cursor) {
        docs.push(cursor.value);
        cursor.continue();
      }
    };
    tx.objectStore(INDEX_LOCATIONS_STORE).openCursor().onsuccess = (ev) => {
      const cursor = ev.target.result;
      if (cursor) {
        locations.push(cursor.value);
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve({ docs, locations });
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// Persist one change-set the index returned: `putDocs` into `index_docs`,
// `putLocations` into `index_locations`, `deleteLocations` removed by key — all
// in one `readwrite` transaction so a mutation and its records land atomically.
// An empty change-set is a no-op.
function applyIndexChanges(db, changes) {
  const { putDocs = [], putLocations = [], deleteLocations = [] } = changes;
  if (!putDocs.length && !putLocations.length && !deleteLocations.length) {
    return Promise.resolve();
  }
  if (!hasIndexStores(db)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
      [INDEX_DOCS_STORE, INDEX_LOCATIONS_STORE],
      'readwrite',
    );
    const docs = tx.objectStore(INDEX_DOCS_STORE);
    const locations = tx.objectStore(INDEX_LOCATIONS_STORE);
    for (const doc of putDocs) docs.put(doc);
    for (const location of putLocations) locations.put(location);
    for (const key of deleteLocations) locations.delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// The book ids present on the filesystem (one directory per book under
// `/books`, git.js's `bookDir`). The home book is excluded — it holds
// preferences, not songs, so it contributes nothing to song search. An absent
// `/books` (no book cloned yet) yields no ids.
async function listBookIds(fs, homeBookId) {
  let entries;
  try {
    entries = await fs.promises.readdir('/books');
  } catch (err) {
    if (err?.code === 'ENOENT') return [];
    throw err;
  }
  return entries.filter((id) => id !== homeBookId);
}

// The next shelf position for a new book: one past the greatest `position`
// register across the shared books and this device's local books — the shelf is
// shown ascending by `position` (home-book-format §4.2, books.shelf acceptance
// 6). A book with no position, or an empty shelf, does not raise the max, so a
// first book lands at 0 and each later one increments.
function nextShelfPosition(model, deviceId) {
  let max = -1;
  const scan = (map) => {
    if (!map || typeof map !== 'object') return;
    for (const id of Object.keys(map)) {
      const position = map[id]?.position?.value;
      if (typeof position === 'number' && position > max) max = position;
    }
  };
  scan(model?.books);
  scan(model?.local?.[deviceId]);
  return max + 1;
}

// Fold one index change-set into an accumulator (SAVE/DISCARD touch many paths).
function mergeIndexChanges(into, from) {
  into.putDocs.push(...from.putDocs);
  into.putLocations.push(...from.putLocations);
  into.deleteLocations.push(...from.deleteLocations);
}

// Create the Worker logic bound to a `port` (anything with `postMessage`)
// through which it emits events. `options.indexedDB` injects the IndexedDB
// factory (defaults to the global one, present in a real Worker);
// `options.name` lets a test isolate its database; `options.migrations` injects
// the step list (defaults to the production `MIGRATIONS`), reusing the existing
// `options` seam so behavior tests can exercise genuine multi-step stepping
// today, when only one real step exists; `options.navigator` injects the object
// `navigator.storage.persist()` is asked through AND the one the per-book Web
// Locks are taken on (defaults to the global one); `options.fetch` injects the
// `fetch` the git HTTP client rides (defaults to the global one), the seam
// storage.git's behavior test uses. The version opened at is derived from
// whichever list is in effect. Returns `{ handle }`: the adapter (real or
// loopback) feeds each incoming command to `handle`.
export function createWorkerLogic(port, options = {}) {
  const idb = options.indexedDB ?? globalThis.indexedDB;
  const name = options.name ?? DB_NAME;
  const migrations = options.migrations ?? MIGRATIONS;
  const version = latestVersion(migrations);
  // The `cifra-md` reader the search index parses songs through; injectable so a
  // test can spy on it to assert content-addressing (a text is parsed once per
  // distinct blob — storage.index Decision 2, acceptance 6).
  const parseSong = options.parse ?? parse;
  // The object `navigator.storage.persist()` is asked through and the per-book
  // Web Locks are taken on (both the global one in a real Worker).
  const navigator = options.navigator ?? globalThis.navigator;
  // One persistence requester per Worker session, asked at most once (Decision
  // 4). Built up front so the memoisation spans the whole session, not one open.
  const requestPersistence = createPersister(navigator);
  let dbPromise = null;
  let fs = null;
  let git = null;
  let locks = null;
  let workingCopy = null;
  let savePreview = null;
  let history = null;
  let bookTree = null;
  let homeBook = null;
  let books = null;
  let exampleBook = null;
  let mySongs = null;
  let searchIndex = null;
  let indexHydration = null;
  let recents = null;

  function ensureOpen() {
    if (!dbPromise) dbPromise = openDatabase(idb, name, version, migrations);
    return dbPromise;
  }

  // Materialise the one filesystem that serves the Worker, once (memoised like
  // the database open). lightning-fs keeps its own IndexedDB database (named
  // from the FS name, separate from `estante` — Decision 3), so the FS name is
  // derived from the Worker's database name and a test's `options.name`
  // isolates both. Books will become directories within it; the layout is
  // storage.git's to settle.
  function ensureFs() {
    if (!fs) fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
    return fs;
  }

  // The git transport over the shared fs and the git HTTP client, composed once
  // (storage.preferences_surface Decision 3): a single owner of the transport
  // for every book flow, so the working copy and the home book share one layer.
  // This is the wiring git.md Decision 4 deferred to "the first consumer".
  function ensureGit() {
    if (!git) {
      const http = createGitHttpClient({ fetch: options.fetch });
      git = createGitLayer({ fs: ensureFs(), http });
    }
    return git;
  }

  // The per-book Web Lock registry, composed once (Decision 3): a single owner
  // of the global Web Lock names, so the working copy and the home book never
  // race two registries on one book's lock (locks.md Decision 4's "first
  // consumer").
  function ensureLocks() {
    if (!locks) locks = createBookLocks({ navigator });
    return locks;
  }

  // Compose the working-copy flow once (memoised like the filesystem) over the
  // shared fs, git layer and lock registry.
  function ensureWorkingCopy() {
    if (!workingCopy) {
      workingCopy = createWorkingCopy({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
      });
    }
    return workingCopy;
  }

  // Compose the save-preview reader once (memoised like the working copy) over
  // the SAME fs, git layer and lock registry, mirroring ensureWorkingCopy. It
  // reads HEAD and the working copy and runs the semantic diff; the view only
  // sends PREVIEW_SAVE (songs.save_sheet Decision 2). The cifra-md reader is the
  // injectable `parseSong`, the same the index parses through.
  function ensureSavePreview() {
    if (!savePreview) {
      savePreview = createSavePreview({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
        parse: parseSong,
      });
    }
    return savePreview;
  }

  // Compose the history reader once (memoised like the working copy) over the
  // SAME fs, git layer and lock registry (history.md Decision 1): the Worker owns
  // the data; the view reads history only through commands and the slices their
  // events fold into (DIRECTION §3.7 L407-414).
  function ensureHistory() {
    if (!history) {
      history = createHistory({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
      });
    }
    return history;
  }

  // Compose the file view's working-tree reader once (books.file_view) over the
  // SAME fs, git layer and lock registry. Walks the book as git sees it; the
  // view reads the `tree` slice and never touches the working tree directly.
  function ensureBookTree() {
    if (!bookTree) {
      bookTree = createBookTree({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
      });
    }
    return bookTree;
  }

  // Compose the home book once over the SAME fs, git layer and lock registry as
  // the working copy (Decision 3), mirroring ensureWorkingCopy. The Worker owns
  // the home book; the view never reads it (DIRECTION §3.7 L407-409).
  function ensureHomeBook() {
    if (!homeBook) {
      homeBook = createHomeBook({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
      });
    }
    return homeBook;
  }

  // Compose the local-book creator once over the SAME fs, git layer and lock
  // registry as the working copy and the home book (books.shelf), mirroring
  // ensureHomeBook. The Worker owns the data; the view only sends CREATE_BOOK.
  function ensureBooks() {
    if (!books) {
      books = createBooks({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
      });
    }
    return books;
  }

  // Compose the example-book seeder once over the SAME fs, git layer and lock
  // registry as the local-book creator (account.first_run), mirroring
  // ensureBooks. The Worker owns the data; the view only sends OPEN_EXAMPLE_BOOK.
  function ensureExampleBook() {
    if (!exampleBook) {
      exampleBook = createExampleBook({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
      });
    }
    return exampleBook;
  }

  // Compose the reserved *My songs* provisioner once over the SAME fs, git layer
  // and lock registry (songs.new_song), mirroring ensureExampleBook. The Worker
  // owns the data; the view only sends NEW_SONG.
  function ensureMySongs() {
    if (!mySongs) {
      mySongs = createMySongs({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
      });
    }
    return mySongs;
  }

  // Compose the search index once over the SAME fs and git layer (Decision 1),
  // mirroring the other ensure* composers. The index owns only the in-memory
  // MiniSearch instance and the extracted records; this module persists them.
  function ensureSearchIndex() {
    if (!searchIndex) {
      searchIndex = createSearchIndex({
        fs: ensureFs(),
        git: ensureGit(),
        parse: parseSong,
      });
    }
    return searchIndex;
  }

  // The device-local recents store, composed once (songs.search). It owns only
  // the list move; this module hands it the open `meta` database and relays the
  // result. No git, no network — recents never touch the home book (Decision 2).
  function ensureRecents() {
    if (!recents) recents = createRecents();
    return recents;
  }

  // Rebuild the in-memory index from its persisted records, once per session
  // (memoised like the database open). Every index operation awaits this first,
  // so a WRITE or SEARCH that arrives before OPEN still sees a hydrated index,
  // and a relaunch re-reads nothing whose blob oid is unchanged (Decision 3).
  function ensureIndexHydrated() {
    if (!indexHydration) {
      indexHydration = (async () => {
        const db = await ensureOpen();
        const { docs, locations } = await readIndexStores(db);
        ensureSearchIndex().hydrate(docs, locations);
      })();
    }
    return indexHydration;
  }

  // Persist one index change-set, reusing the memoised open.
  async function persistIndexChanges(changes) {
    await applyIndexChanges(await ensureOpen(), changes);
  }

  // (Re-)index one working-tree path, or drop it if the file is gone — the
  // branch SAVE (a removed file) and DISCARD (a never-saved file) both need
  // (acceptance 5). The index hashes the CURRENT bytes, so unsaved edits are
  // findable (DIRECTION §3 L116-117).
  async function reindexOrRemove({ bookId, path, unsaved }) {
    const full = `${ensureGit().bookDir(bookId)}/${path}`;
    try {
      await ensureFs().promises.stat(full);
    } catch (err) {
      if (err?.code === 'ENOENT') {
        return ensureSearchIndex().removePath({ bookId, path });
      }
      throw err;
    }
    return ensureSearchIndex().reindexPath({ bookId, path, unsaved });
  }

  // The file names directly in a book's folder (`folder` within the book, or the
  // book root when absent) — the set a new song's placeholder/slug must not
  // collide with (songs.new_song, workflow 3 §Its file name). A folder that does
  // not exist yet (a new sub-folder) reads as empty; `.git` and the other
  // entries are harmless (a name never collides with `untitled[-N].cifra.md` or
  // a title slug unless it is exactly that file).
  async function folderNames(bookId, folder) {
    const dir = ensureGit().bookDir(bookId);
    const trimmed = folder ? folder.replace(/\/+$/, '') : '';
    const full = trimmed ? `${dir}/${trimmed}` : dir;
    try {
      return await ensureFs().promises.readdir(full);
    } catch (err) {
      if (err?.code === 'ENOENT') return [];
      throw err;
    }
  }

  // Build every book's index on bring-up (acceptance 1, 9): emit a per-book
  // `building` → `ready` status around reconciling its working tree with the
  // persisted records, so the search screen can say a book is "still loading"
  // (workflow 2 L159-162). Reconcile re-parses only what a blob oid shows
  // changed (Decision 3).
  async function buildIndexes() {
    await ensureIndexHydrated();
    const bookIds = await listBookIds(ensureFs(), HOME_BOOK_ID);
    for (const bookId of bookIds) {
      await indexOneBook(bookId);
    }
  }

  // Build (or reconcile) one book's index, emitting the per-book `building` →
  // `ready` status around it (workflow 2 L159-162). Reused by the bring-up
  // sweep and by the example-book open, which indexes just the book it seeded so
  // its songs are found by search at once (account.first_run acceptance 2).
  async function indexOneBook(bookId) {
    await ensureIndexHydrated();
    port.postMessage(
      event(EventKind.INDEX_STATUS, { bookId, state: 'building' }),
    );
    await persistIndexChanges(await ensureSearchIndex().reconcile(bookId));
    port.postMessage(event(EventKind.INDEX_STATUS, { bookId, state: 'ready' }));
  }

  // Read the home book's preferences.json, project it to the flat map of
  // `{value, at}` registers, and post the PREFERENCES event — the contract
  // shell.tokens defined (protocol.js L39-42; reducer replaces the slice,
  // reducer.js:120-125). A read before any home book exists returns `{}`
  // (ENOENT, home-book.js:125-132), so the payload is `{}` and ThemeRoot stays
  // automatic — never an error, never a crash. Logs nothing (no preference
  // values; standing rule).
  async function surfaceHomeBookPreferences() {
    const model = await ensureHomeBook().read({
      bookId: HOME_BOOK_ID,
      file: 'preferences.json',
    });
    port.postMessage(event(EventKind.PREFERENCES, surfacePreferences(model)));
  }

  // Read the home book's shelf.json, project it (narrowing `local` to this
  // device's namespace, §7), and post the SHELF event — the labels and links the
  // search screen and the future book-management screen read (home-book-format
  // §4.2; reducer replaces the slice). A read before any home book exists returns
  // `{}` (ENOENT, home-book.js), so the payload is `{ books: {}, local: {} }` and
  // every book stays labelled by its id — never an error, never a crash. The
  // device id comes from the same `idb`/`name`/`version` the closure holds —
  // the version so `ensureDeviceId` attaches at the schema already on disk and
  // never triggers an upgrade this session (opened at that version) would block.
  // Logs nothing (a label is a user's words, a link is account data; standing rule).
  async function surfaceHomeBookShelf() {
    const model = await ensureHomeBook().read({
      bookId: HOME_BOOK_ID,
      file: 'shelf.json',
    });
    const deviceId = await ensureHomeBook().ensureDeviceId({ idb, name, version });
    port.postMessage(event(EventKind.SHELF, surfaceShelf(model, deviceId)));
  }

  // Read the home book's instruments.json, preferences.json (for the in-use
  // register) and shapes.json, project them to the roster payload, and post the
  // INSTRUMENTS event — the contract music.instruments defined (reducer replaces
  // the slice). A read before any home book exists returns `{}` for each
  // (ENOENT, home-book.js), so the payload is the standard guitar with an empty
  // roster and a null in-use — never an error, never a crash. The reads are
  // local, offline-first and lock-free (home-book `read` takes no lock). Logs
  // nothing (no instrument label, tuning or shape; standing rule).
  async function surfaceHomeBookInstruments() {
    const home = ensureHomeBook();
    const [instruments, preferences, shapes] = await Promise.all([
      home.read({ bookId: HOME_BOOK_ID, file: 'instruments.json' }),
      home.read({ bookId: HOME_BOOK_ID, file: 'preferences.json' }),
      home.read({ bookId: HOME_BOOK_ID, file: 'shapes.json' }),
    ]);
    port.postMessage(
      event(EventKind.INSTRUMENTS, surfaceInstruments({ instruments, preferences, shapes })),
    );
  }

  // Read the device-local recents and post RECENTS, so the search screen shows
  // "the way back into what you were playing" on bring-up without asking for it
  // (songs.search, workflow 2 L13-14). Device-local, offline, no commit; an
  // empty list on first run. Logs nothing (a recent is a location, not song
  // text; standing rule).
  async function surfaceRecents() {
    const db = await ensureOpen();
    const list = await ensureRecents().read(db);
    port.postMessage(event(EventKind.RECENTS, { recents: list }));
  }

  async function handleOpen() {
    const db = await ensureOpen();
    const meta = await loadOrCreateMeta(db);
    // Bring the rest of the storage stack up: the filesystem the storage tasks
    // above will read and write, and the durable-storage request that protects
    // the working copy written as the user types (DIRECTION §3 L103-105,
    // L114-115). `persist()` is best-effort — `persisted` is true / false /
    // null — and never blocks the ready report.
    ensureFs();
    const persisted = await requestPersistence();
    port.postMessage(event(EventKind.READY, { meta, persisted }));
    // Surface the home book's preferences on bring-up, right after READY, so the
    // themed shell reflects the chosen theme (and, later, language, notation) as
    // soon as the Worker is up — "the theme is right before anything else"
    // (workflow 13 L30-37; Decision 4). The read is local and offline-first, and
    // emits `{}` when no home book exists yet.
    await surfaceHomeBookPreferences();
    // Surface the home book's shelf right after preferences, so the search
    // screen can label each book by the name the user gave it (and the future
    // book-management screen read the same slice) as soon as the Worker is up.
    // The read is local and offline-first, and emits `{ books: {}, local: {} }`
    // when no home book exists yet.
    await surfaceHomeBookShelf();
    // Surface the instrument roster right after the shelf, so the header chip
    // shows the in-use instrument (or the standard-guitar default) as soon as
    // the Worker is up (workflow 15 §The roster; music.instruments). Local and
    // offline-first; the standard guitar when no home book exists yet.
    await surfaceHomeBookInstruments();
    // Surface the device-local recents right after preferences, before the
    // (slower) per-book index build, so the pre-typing "Recent" section fills
    // first — it is a plain `meta`-store read, independent of the index.
    await surfaceRecents();
    // Build the song search index for every book on the device, emitting a
    // per-book status as it goes (storage.index, acceptance 1/9). After READY so
    // the shell is up first; the search screen shows "still loading" per book
    // until its `ready` arrives.
    await buildIndexes();
  }

  return {
    async handle(message) {
      if (!message || message.dir !== COMMAND) return;
      try {
        switch (message.kind) {
          case CommandKind.OPEN:
            await handleOpen();
            break;
          case CommandKind.WRITE: {
            // Durability only: persist the editor's current text. No event — the
            // write is silent; its only observable effect is the working copy.
            const { bookId, path, text } = message.payload;
            await ensureWorkingCopy().write({ bookId, path, text });
            // Re-index just this path from its new working-tree bytes, so a
            // title typed but not saved is findable immediately (storage.index
            // acceptance 5, DIRECTION §3 L116-117). Marked unsaved.
            await ensureIndexHydrated();
            await persistIndexChanges(
              await ensureSearchIndex().reindexPath({
                bookId,
                path,
                unsaved: true,
              }),
            );
            break;
          }
          case CommandKind.SAVE: {
            // Canonicalise, commit one file or several, then push — the author
            // formed from the command's identity (id -> no-reply address).
            const { bookId, paths, message: note, author } = message.payload;
            const outcome = await ensureWorkingCopy().save({
              bookId,
              paths,
              message: note,
              author: authorFrom(author),
            });
            if (outcome.refused) {
              port.postMessage(
                event(EventKind.SAVE_REFUSED, {
                  bookId,
                  path: outcome.refused.path,
                  reason: outcome.refused.reason,
                  marker: outcome.refused.marker ?? null,
                  line: outcome.refused.line ?? null,
                }),
              );
            } else {
              port.postMessage(
                event(EventKind.SAVED, {
                  bookId,
                  commit: outcome.commit,
                  pushed: outcome.pushed,
                }),
              );
              // Re-index the saved paths — now canonical and committed, so no
              // longer unsaved (storage.index acceptance 5). A path saved as a
              // deletion is dropped from the index.
              await ensureIndexHydrated();
              const changes = {
                putDocs: [],
                putLocations: [],
                deleteLocations: [],
              };
              for (const path of paths) {
                mergeIndexChanges(
                  changes,
                  await reindexOrRemove({ bookId, path, unsaved: false }),
                );
              }
              await persistIndexChanges(changes);
            }
            break;
          }
          case CommandKind.PREVIEW_SAVE: {
            // "What changed, in musical terms" for the save sheet, the discard
            // confirm and *save all* (songs.save_sheet Decision 2): read HEAD and
            // the working copy for each path and run the semantic diff. A read —
            // no commit, no push. The preview itself is not logged (song text).
            const { bookId, paths } = message.payload;
            const { previews } = await ensureSavePreview().preview({ bookId, paths });
            port.postMessage(event(EventKind.SAVE_PREVIEW, { bookId, previews }));
            break;
          }
          case CommandKind.SET_IDENTITY_NAME: {
            // Persist the author's display name to the home book, asked once
            // (songs.save_sheet Decision 4; workflow 4 §Who made the change):
            // provision a local home book if none exists, write the `authorName`
            // register into preferences.json, and re-surface PREFERENCES so the
            // slice carries it and the save sheet stops asking. Offline,
            // auto-committed, never pushed (a preference). The name is a user's
            // own words — never logged (standing rule).
            const { name: displayName, author } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'preferences.json',
              changes: [{ path: ['authorName'], value: displayName }],
              author,
            });
            await surfaceHomeBookPreferences();
            // Force the inode table out now (fs.js Decision 6), at the handler
            // tail after the home book's lock has released: the only write was
            // home.set's register change, which does not flush on its own, so an
            // immediate reload reads the stored name — and never asks twice.
            await ensureFs().flush();
            break;
          }
          case CommandKind.DISCARD: {
            const { bookId, paths } = message.payload;
            await ensureWorkingCopy().discard({ bookId, paths });
            port.postMessage(event(EventKind.DISCARDED, { bookId, paths }));
            // Re-index the reverted paths (back to their last-saved bytes) and
            // drop any never-saved file discard removed (storage.index
            // acceptance 5).
            await ensureIndexHydrated();
            const changes = {
              putDocs: [],
              putLocations: [],
              deleteLocations: [],
            };
            for (const path of paths) {
              mergeIndexChanges(
                changes,
                await reindexOrRemove({ bookId, path, unsaved: false }),
              );
            }
            await persistIndexChanges(changes);
            break;
          }
          case CommandKind.SONG_LOG: {
            // A song's versions, newest first, rename-followed, merges hidden
            // unless resolved (workflow 6). Local and offline; under the book lock.
            const { bookId, path } = message.payload;
            const { entries } = await ensureHistory().songLog({ bookId, path });
            port.postMessage(
              event(EventKind.SONG_LOG, { bookId, path, entries }),
            );
            break;
          }
          case CommandKind.READ_VERSION: {
            // A version read as it was (workflow 6 L39-51): the song's exact bytes
            // at a commit, at the path it had there. `path` is the entry's
            // historical path so a pre-rename version reads correctly.
            const { bookId, path, commit } = message.payload;
            const { text } = await ensureHistory().readVersion({
              bookId,
              path,
              commit,
            });
            port.postMessage(
              event(EventKind.VERSION, { bookId, path, commit, text }),
            );
            break;
          }
          case CommandKind.RESTORE_VERSION: {
            // Restore a version into the working copy, uncommitted (workflow 6
            // L53-62): write the historical blob (`fromPath` at `commit`) to the
            // song's CURRENT `path`. RESTORED carries `{ bookId, path }` so the UI
            // can open the save sheet; the save is what commits (history.md
            // Decision 4).
            const { bookId, path, commit, fromPath } = message.payload;
            await ensureHistory().restoreVersion({
              bookId,
              path,
              commit,
              fromPath,
            });
            port.postMessage(event(EventKind.RESTORED, { bookId, path }));
            break;
          }
          case CommandKind.BOOK_LOG: {
            // The book's whole log for the file view (workflow 14 L161-173): every
            // commit, newest first, merges marked, each with the files it touched.
            const { bookId } = message.payload;
            const { commits } = await ensureHistory().bookLog({ bookId });
            port.postMessage(event(EventKind.BOOK_LOG, { bookId, commits }));
            break;
          }
          case CommandKind.BOOK_TREE: {
            // The book's whole working tree for the file view (workflow 14
            // L134-138): every allowed file with its working-copy status as a
            // word. A local, offline read.
            const { bookId } = message.payload;
            const { entries } = await ensureBookTree().tree({ bookId });
            port.postMessage(event(EventKind.TREE, { bookId, entries }));
            break;
          }
          case CommandKind.MOVE_FILE: {
            // Rename/move a file keeping its kind, rewriting the book's setlist
            // links, all uncommitted (workflow 14 L144-146). Keep the index in
            // step: a moved song leaves its old path and takes the new one, both
            // unsaved until the shared save (storage.index acceptance 5).
            const { bookId, fromPath, toPath } = message.payload;
            await ensureWorkingCopy().move({ bookId, fromPath, toPath });
            await ensureIndexHydrated();
            const changes = { putDocs: [], putLocations: [], deleteLocations: [] };
            mergeIndexChanges(
              changes,
              await reindexOrRemove({ bookId, path: fromPath, unsaved: true }),
            );
            mergeIndexChanges(
              changes,
              await reindexOrRemove({ bookId, path: toPath, unsaved: true }),
            );
            await persistIndexChanges(changes);
            port.postMessage(event(EventKind.FILE_MOVED, { bookId, fromPath, toPath }));
            break;
          }
          case CommandKind.DELETE_FILE: {
            // Remove a file from the working copy (workflow 14 L147): a committed
            // file reads as deleted until a save commits the removal, a
            // never-saved one is unlinked outright. Drop it from the index (now
            // gone), like a discard (storage.index acceptance 5).
            const { bookId, path } = message.payload;
            await ensureWorkingCopy().remove({ bookId, path });
            await ensureIndexHydrated();
            await persistIndexChanges(
              await reindexOrRemove({ bookId, path, unsaved: true }),
            );
            port.postMessage(event(EventKind.FILE_DELETED, { bookId, path }));
            break;
          }
          case CommandKind.COMMIT_DIFF: {
            // One commit's per-file before/after texts for the history pane's
            // line diff (workflow 14 L161-167): a local, offline read.
            const { bookId, commit } = message.payload;
            const { files } = await ensureHistory().commitDiff({ bookId, commit });
            port.postMessage(event(EventKind.COMMIT_DIFF, { bookId, commit, files }));
            break;
          }
          case CommandKind.SEARCH: {
            // Query the in-memory index in the Worker and post the ranked
            // results back; the index itself never crosses the port (Decision
            // 8). `scope` optionally narrows to books or a folder prefix.
            const { query, scope } = message.payload;
            await ensureIndexHydrated();
            const results = ensureSearchIndex().search({ query, scope });
            port.postMessage(
              event(EventKind.SEARCH_RESULTS, { query, results }),
            );
            break;
          }
          case CommandKind.BROWSE: {
            // The pre-typing browse: every indexed location grouped by book, a
            // thin read over `index_locations` (no re-parse — Decision 3). The
            // in-memory index never crosses the port, only the grouped rows.
            // `scope` narrows it the same way SEARCH's does.
            const { scope } = message.payload;
            await ensureIndexHydrated();
            const { books } = ensureSearchIndex().browse({ scope });
            port.postMessage(event(EventKind.BROWSE_RESULTS, { books }));
            break;
          }
          case CommandKind.RECORD_RECENT: {
            // Record a just-opened song into the device-local recents and emit
            // the new list. No commit, no push — the home book is untouched
            // (workflow 2 L17-20, Decision 2). `songs.reading` calls this on
            // open; the search screen displays the slice.
            const { bookId, path } = message.payload;
            const db = await ensureOpen();
            const list = await ensureRecents().record(db, { bookId, path });
            port.postMessage(event(EventKind.RECENTS, { recents: list }));
            break;
          }
          case CommandKind.SYNC_HOME: {
            // Sync the home book (fetch → merge key by key → commit → push, under
            // one lock, offline-first — home-book.js:243) and re-surface its
            // preferences, so a register the sync changed reaches the slice
            // ("re-emitted when sync changes a register"). The sync forms the
            // merge-commit identity from the command's author ({ id, name });
            // a failed push keeps the local commit (home-book.js:317-324) and the
            // re-surface runs regardless, reflecting whatever the local tree holds.
            await ensureHomeBook().sync({
              bookId: HOME_BOOK_ID,
              author: message.payload.author,
            });
            await surfaceHomeBookPreferences();
            // Re-surface the shelf too, so a label, link or order a sync merged
            // reaches the `shelf` slice (storage.shelf_surface; "re-emitted when
            // sync changes a register"). One command re-surfaces every
            // home-book-derived slice (Decision 1).
            await surfaceHomeBookShelf();
            // Re-surface the instruments too, so a definition, rule, in-use or
            // shape a sync merged reaches the `instruments` slice
            // (music.instruments; "re-emitted when sync changes a register").
            await surfaceHomeBookInstruments();
            break;
          }
          case CommandKind.CREATE_BOOK: {
            // Make an empty local songbook with no account (workflow 7 L25):
            // provision a local home book if none exists, init + scaffold the
            // book's own repository, write its `shelf.local` entry through the
            // home book (position = max + 1), re-surface SHELF so the slice
            // reflects the new book at once, and announce it so the view can
            // move focus to it. All local — no fetch, no push (offline-first).
            // The lock on the new book and the lock on the home book are taken
            // in sequence, never nested (locks.md Decision 1).
            const { title, author } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            const { bookId } = await ensureBooks().createLocal({ title, author });
            const deviceId = await home.ensureDeviceId({ idb, name, version });
            const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
            const position = nextShelfPosition(shelf, deviceId);
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'shelf.json',
              changes: [
                { path: ['local', deviceId, bookId, 'title'], value: title },
                { path: ['local', deviceId, bookId, 'position'], value: position },
              ],
              author,
            });
            await surfaceHomeBookShelf();
            // Force the inode table out now (fs.js Decision 6), at the handler
            // tail after both repos' locks have released in sequence (Decision
            // 4): one global flush persists BOTH the new book's repo and the
            // home-book shelf write, so an immediate reload finds the book and
            // lists it on the shelf — not orphaned off it (DIRECTION §3
            // L105-110; workflow 7 §The book-management screen; Decision 2, 3).
            await ensureFs().flush();
            port.postMessage(event(EventKind.BOOK_CREATED, { bookId }));
            break;
          }
          case CommandKind.OPEN_EXAMPLE_BOOK: {
            // Open the bundled example book (workflow 1 §Cold): provision a local
            // home book if none exists, seed the bundled book as a local
            // repository under a reserved id (idempotently), write its
            // shelf.local entry through the home book, re-surface SHELF, index
            // the book so its songs are found at once, and announce it. All
            // local — no fetch, no push (offline-first). The reserved book's lock
            // and the home book's lock are taken in sequence, never nested
            // (locks.md Decision 1). `title` is the localised shelf label the
            // view sends (the view knows the language; Decision 5).
            const { title, author } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            const example = ensureExampleBook();
            await example.seed({ author });
            const exampleId = example.bookId;
            const deviceId = await home.ensureDeviceId({ idb, name, version });
            const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
            // A re-open (the book is still on the shelf) keeps its position; a
            // fresh open lands it at the end. Rewriting the same register keys
            // adds no duplicate entry (idempotence, Decision 3).
            const existing = shelf?.local?.[deviceId]?.[exampleId];
            const position =
              typeof existing?.position?.value === 'number'
                ? existing.position.value
                : nextShelfPosition(shelf, deviceId);
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'shelf.json',
              changes: [
                { path: ['local', deviceId, exampleId, 'title'], value: title },
                { path: ['local', deviceId, exampleId, 'position'], value: position },
              ],
              author,
            });
            await surfaceHomeBookShelf();
            await indexOneBook(exampleId);
            // Force the inode table out now (fs.js Decision 6), at the handler
            // tail (Decision 4): seed's own flush (example-book.js) ran BEFORE
            // the home.set shelf write above, so one global flush here persists
            // that shelf entry too — an immediate reload lists the example book
            // on the shelf, not seeded-but-orphaned off it (workflow 1 §Cold;
            // DIRECTION §3 L108-110; Decision 2).
            await ensureFs().flush();
            port.postMessage(event(EventKind.BOOK_CREATED, { bookId: exampleId }));
            break;
          }
          case CommandKind.RENAME_BOOK: {
            // Rename a book on the shelf — a label kept in the home book that
            // changes nothing in the repository (workflow 7 L16-18, Decision 3).
            // A local book (in this device's `local` namespace) rewrites its
            // `title` register; any other book its `label` register. Offline,
            // auto-committed, never pushed. `name` is aliased so it does not
            // shadow the Worker's database name the closure holds.
            const { bookId, name: newName, author } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            const deviceId = await home.ensureDeviceId({ idb, name, version });
            const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
            const isLocal = Boolean(shelf?.local?.[deviceId]?.[bookId]);
            const path = isLocal
              ? ['local', deviceId, bookId, 'title']
              : ['books', bookId, 'label'];
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'shelf.json',
              changes: [{ path, value: newName }],
              author,
            });
            await surfaceHomeBookShelf();
            // Force the inode table out now (fs.js Decision 6), at the handler
            // tail (Decision 4): the only write was home.set's shelf register
            // change, which does not flush on its own, so an immediate reload
            // reads the new name — not the old one (workflow 7 L16-18;
            // DIRECTION §3 L108-110; Decision 2).
            await ensureFs().flush();
            break;
          }
          case CommandKind.OPEN_SOURCE: {
            // Read a song's live working-copy text into the editor (songs.editor,
            // Decision 4). A thin read over the working copy — the read-back
            // storage.working_copy did not build. A missing file throws ENOENT,
            // which the surrounding try/catch turns into an ERROR event (not a
            // throw across the port). No lock: this is a plain read, no write.
            const { bookId, path } = message.payload;
            const full = `${ensureGit().bookDir(bookId)}/${path}`;
            const text = await ensureFs().promises.readFile(full, 'utf8');
            port.postMessage(event(EventKind.SOURCE, { bookId, path, text }));
            break;
          }
          case CommandKind.NEW_SONG: {
            // Start a new song (songs.new_song, workflow 3; Decision 2). Ensure
            // the target book exists, allocate a free placeholder path against
            // its working copy, and reply so the host can mount the editor on a
            // concrete book/path. All local — no account, no network.
            const { targetBookId, folder, mySongsTitle, author } = message.payload;
            const bookId = targetBookId ?? MY_SONGS_ID;
            if (bookId === MY_SONGS_ID) {
              // *My songs* "created when first written to" (workflow 3 §Which
              // book L28), idempotently under its reserved id — mirroring
              // OPEN_EXAMPLE_BOOK: provision a local home book if none exists,
              // mint the repository, write its shelf.local entry, re-surface
              // SHELF. A second new song into it re-runs all of this as a no-op.
              const home = ensureHomeBook();
              await home.ensureLocal({ author });
              await ensureMySongs().ensure({ title: mySongsTitle, author });
              const deviceId = await home.ensureDeviceId({ idb, name, version });
              const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
              // Keep an existing position; a fresh entry lands at the end.
              // Rewriting the same register keys adds no duplicate (idempotence).
              const existing = shelf?.local?.[deviceId]?.[MY_SONGS_ID];
              const position =
                typeof existing?.position?.value === 'number'
                  ? existing.position.value
                  : nextShelfPosition(shelf, deviceId);
              await home.set({
                bookId: HOME_BOOK_ID,
                file: 'shelf.json',
                changes: [
                  { path: ['local', deviceId, MY_SONGS_ID, 'title'], value: mySongsTitle },
                  { path: ['local', deviceId, MY_SONGS_ID, 'position'], value: position },
                ],
                author,
              });
              await surfaceHomeBookShelf();
            }
            // Allocate a free `untitled[-N].cifra.md` against the target folder
            // (the Worker owns the dir listing — Decision 2). The file itself is
            // not written here; the editor's first WRITE creates it.
            const names = await folderNames(bookId, folder);
            const base = deriveSongFilename('', names);
            const prefix = folder ? `${folder.replace(/\/+$/, '')}/` : '';
            const path = `${prefix}${base}`;
            // Force the inode table out now (fs.js Decision 6), at the handler
            // tail after the locks have released (Decision 4): one flush persists
            // the *My songs* repo and the shelf write, so an immediate reload
            // finds the book on the shelf — not seeded-but-orphaned.
            await ensureFs().flush();
            port.postMessage(event(EventKind.NEW_SONG_READY, { bookId, path }));
            break;
          }
          case CommandKind.NAME_AND_SAVE: {
            // The first save of a new song (songs.new_song, workflow 3 §The first
            // save; Decision 4): name the placeholder from the title, then the
            // existing canonical commit-and-push. The title parse and the
            // collision-suffixed name are derived here (the Worker owns the dir
            // listing); the rename + canonical commit run under one lock in the
            // working copy.
            const { bookId, fromPath, author, message: note, title: promptedTitle } =
              message.payload;
            const dir = ensureGit().bookDir(bookId);
            const bytes = await ensureFs().promises.readFile(`${dir}/${fromPath}`);
            // The name the file carries, else the one the save sheet prompted for
            // when the song has no title line yet (songs.save_sheet acceptance 7),
            // which feeds both the slug filename and the default commit message.
            const title =
              (parseSong(bytes)?.title ?? '').trim() || (promptedTitle ?? '').trim();
            // Collision set: the folder's names minus the placeholder itself, so
            // a title whose slug equals the placeholder does not gain a suffix
            // against it.
            const slash = fromPath.lastIndexOf('/');
            const folder = slash > 0 ? fromPath.slice(0, slash) : '';
            const fromName = slash >= 0 ? fromPath.slice(slash + 1) : fromPath;
            const prefix = folder ? `${folder}/` : '';
            const names = (await folderNames(bookId, folder)).filter((n) => n !== fromName);
            const toPath = `${prefix}${deriveSongFilename(title, names)}`;
            const outcome = await ensureWorkingCopy().nameAndSave({
              bookId,
              fromPath,
              toPath,
              // The save sheet's note, else the W03 default *Add {title}*
              // (songs.save_sheet Decision 5). Git history, not a log — never
              // written to `console` (standing rule).
              message: note || `Add ${title || 'untitled'}`,
              author: authorFrom(author),
            });
            if (outcome.refused) {
              port.postMessage(
                event(EventKind.SAVE_REFUSED, {
                  bookId,
                  path: outcome.refused.path,
                  reason: outcome.refused.reason,
                  marker: outcome.refused.marker ?? null,
                  line: outcome.refused.line ?? null,
                }),
              );
            } else {
              port.postMessage(
                event(EventKind.SAVED, {
                  bookId,
                  path: outcome.path,
                  commit: outcome.commit,
                  pushed: outcome.pushed,
                }),
              );
              // Re-index: the final path is now canonical and committed (no
              // longer unsaved); the placeholder is gone, so drop it from the
              // index (storage.index acceptance 5).
              await ensureIndexHydrated();
              const changes = { putDocs: [], putLocations: [], deleteLocations: [] };
              mergeIndexChanges(
                changes,
                await reindexOrRemove({ bookId, path: toPath, unsaved: false }),
              );
              mergeIndexChanges(
                changes,
                await reindexOrRemove({ bookId, path: fromPath, unsaved: false }),
              );
              await persistIndexChanges(changes);
            }
            break;
          }
          case CommandKind.SAVE_INSTRUMENT: {
            // Add or edit an instrument (music.instruments, workflow 15 §Adding).
            // Edit (id present): rewrite only the `definition` register, leaving
            // `rules` untouched so a rename and a rule edit merge independently
            // (home-book §4.3, §5.2). Add (no id): mint an id, write both the
            // `definition` and the `rules` register (from the chosen preset, or
            // the catalogue default), and — when this is the first instrument and
            // the in-use is still the implicit standard guitar — set it in use
            // (workflow 15 L97-99). Offline, auto-committed, never pushed.
            const { id, definition, preset, author } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            if (id) {
              await home.set({
                bookId: HOME_BOOK_ID,
                file: 'instruments.json',
                changes: [{ path: [id, 'definition'], value: definition }],
                author,
              });
            } else {
              const newId = globalThis.crypto.randomUUID();
              const presetId = preset || defaultPresetFor(definition?.catalogId);
              await home.set({
                bookId: HOME_BOOK_ID,
                file: 'instruments.json',
                changes: [
                  { path: [newId, 'definition'], value: definition },
                  { path: [newId, 'rules'], value: { preset: presetId } },
                ],
                author,
              });
              const prefs = await home.read({ bookId: HOME_BOOK_ID, file: 'preferences.json' });
              const current = prefs?.instrumentInUse?.value ?? null;
              if (!current) {
                await home.set({
                  bookId: HOME_BOOK_ID,
                  file: 'preferences.json',
                  changes: [{ path: ['instrumentInUse'], value: newId }],
                  author,
                });
              }
            }
            await surfaceHomeBookInstruments();
            // Force the inode table out now (fs.js Decision 6), at the handler
            // tail after the home book's lock has released, so an immediate
            // reload reads the stored instrument.
            await ensureFs().flush();
            break;
          }
          case CommandKind.SET_INSTRUMENT_RULES: {
            // Write an instrument's `rules` register (music.instruments,
            // workflow 15 §The voicing rules): a named preset `{ preset }` is
            // rebuilt on load, a Custom `{ preset: 'custom', config }` is kept
            // exactly (home-book §4.3; the surfacing re-derives the effective
            // config). Offline, auto-committed, never pushed.
            const { id, rules, author } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'instruments.json',
              changes: [{ path: [id, 'rules'], value: rules }],
              author,
            });
            await surfaceHomeBookInstruments();
            await ensureFs().flush();
            break;
          }
          case CommandKind.USE_INSTRUMENT: {
            // Switch the one instrument in use (workflow 15 §The roster): write
            // the singleton `instrumentInUse` preference, under last-write-wins
            // (Decision — a singleton register admits one winner). Everything on
            // screen re-derives off the re-surfaced slice. Offline, auto-committed.
            const { id, author } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'preferences.json',
              changes: [{ path: ['instrumentInUse'], value: id }],
              author,
            });
            await surfaceHomeBookInstruments();
            await ensureFs().flush();
            break;
          }
          case CommandKind.REMOVE_INSTRUMENT: {
            // Remove an instrument and what goes with it (workflow 15 §Removing;
            // home-book §5.3): tombstone its two registers, every `shapes.json[id]`
            // leaf, and each `songs.json[*].variation[<tuning>]` no remaining
            // instrument still uses, and fall back to the standard guitar when the
            // in-use or last one goes. Each file is written under its own lock,
            // never nested (home-book composition rule). The change-set is the
            // Worker's own (the format's key paths never cross to the main thread).
            const { id, author } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            const [instruments, shapes, songs, preferences] = await Promise.all([
              home.read({ bookId: HOME_BOOK_ID, file: 'instruments.json' }),
              home.read({ bookId: HOME_BOOK_ID, file: 'shapes.json' }),
              home.read({ bookId: HOME_BOOK_ID, file: 'songs.json' }),
              home.read({ bookId: HOME_BOOK_ID, file: 'preferences.json' }),
            ]);
            const changes = instrumentRemoval({ id, instruments, shapes, songs, preferences });
            if (changes.instruments.length) {
              await home.set({
                bookId: HOME_BOOK_ID,
                file: 'instruments.json',
                changes: changes.instruments,
                author,
              });
            }
            if (changes.shapes.length) {
              await home.set({
                bookId: HOME_BOOK_ID,
                file: 'shapes.json',
                changes: changes.shapes,
                author,
              });
            }
            if (changes.songs.length) {
              await home.set({
                bookId: HOME_BOOK_ID,
                file: 'songs.json',
                changes: changes.songs,
                author,
              });
            }
            if (changes.preferences.length) {
              await home.set({
                bookId: HOME_BOOK_ID,
                file: 'preferences.json',
                changes: changes.preferences,
                author,
              });
            }
            await surfaceHomeBookInstruments();
            await ensureFs().flush();
            break;
          }
          case CommandKind.SAVE_SHAPE: {
            // Star one my-shape (music.explorer, workflow 16 L108-133): write the
            // opaque fret shorthand to the leaf register at
            // `shapes.json[id][tuning][chord]` (home-book §4.4). The chord key is
            // the chord as the music core matches it — by chord, not spelling, so
            // a shape starred for `Cmaj7` serves a song written `C7M`. Starring is
            // a preference, so it is offline, auto-committed and never pushed
            // (DIRECTION §3.2); never written into a song.
            const { id, tuning, chord, shorthand, author } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'shapes.json',
              changes: [{ path: [id, tuning, chord], value: shorthand }],
              author,
            });
            await surfaceHomeBookInstruments();
            await ensureFs().flush();
            break;
          }
          case CommandKind.REMOVE_SHAPE: {
            // Remove one my-shape (workflow 15 §Reviewing my shapes): tombstone
            // the leaf register at `shapes.json[id][tuning][chord]` (home-book
            // §4.4, §5.3). Offline, auto-committed, never pushed.
            const { id, tuning, chord, author } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'shapes.json',
              changes: [{ path: [id, tuning, chord], value: null }],
              author,
            });
            await surfaceHomeBookInstruments();
            await ensureFs().flush();
            break;
          }
          default:
            port.postMessage(
              event(EventKind.ERROR, {
                message: `unknown command: ${message.kind}`,
                code: 'unknown_command',
              }),
            );
        }
      } catch (err) {
        // Report the failure as an event; never throw across the port. The
        // message is the error's own text (no song text, no secrets).
        port.postMessage(
          event(EventKind.ERROR, {
            message: String(err?.message ?? err),
            code: 'command_failed',
          }),
        );
      }
    },
  };
}
