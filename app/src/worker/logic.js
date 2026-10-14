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

import { parse, parseSetlist } from 'cifra-md';
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
import { createChangeCheckClient } from './change-check-client.js';
import { createBooksClient } from './books-client.js';
import { createOnline } from './online.js';
import { createAddByLink } from './add-by-link.js';
import { booksNotOnShelf } from '../books/mine-on-estante.js';
import { createCifraMergeDriver } from './cifra-merge-driver.js';
import { createSyncEngine, countCommitsAhead, resolveOriginHead } from './sync-engine.js';
import { keepAsLocalChanges, removeChanges } from './sign-out.js';
import { createSyncScheduler } from './sync-scheduler.js';
import { createConflicts } from './conflicts.js';
import { createUpload } from './upload.js';
import { createBooks } from './books.js';
import { createExampleBook } from './example-book.js';
import { createMySongs, MY_SONGS_ID } from './my-songs.js';
import { deriveSongFilename } from '../songs/song-filename.js';
import { createSearchIndex } from './search-index.js';
import { createRecents } from './recents.js';
import { surfacePreferences } from './preferences.js';
import { surfaceShelf } from './shelf.js';
import {
  surfaceInstruments,
  instrumentRemoval,
  standardMaterialization,
  STANDARD_INSTRUMENT_ID,
} from './instruments.js';
import { defaultPresetFor } from '../core/instrument.js';
import {
  transpositionOf,
  transpositionChange,
  variationsOf,
  variationChange,
  songRefOf,
} from './songs.js';
import { authorFrom } from './author.js';
import { CHOSEN_THEMES } from '../theme/resolve.js';
import { LOCALE_IDS } from '../i18n/index.js';

// The schema version the database opens at, DERIVED from the migration step
// list (single source of truth — migrations.js Decision 1): bumping the schema
// is appending a step there, nothing here. `storage.migrations` turned the
// single-version open into this versioned stepping.
export const SCHEMA_VERSION = latestVersion(MIGRATIONS);
export const DB_NAME = 'estante';
export const META_KEY = 'meta';

// The setlist file suffix (spec §10; canonicalise.js keys off it too) — used by
// LIST_SETLISTS to pick a book's setlists out of its working tree.
const SETLIST_SUFFIX = '.setlist.md';

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

// Word a failed invitation accept for the view (books.add_by_link), never naming
// the book — a dead link reveals nothing (workflow 1 §Invited L53-58). A 409
// `book_full` → 'full' ("This book is full"); any other 409 (invitation
// withdrawn/expired/exhausted) or a 404 (unknown token or non-member, conflated
// so a private book is never confirmed, openapi.yaml L782-790) → 'dead' ("This
// link doesn't open a book"); anything else (offline, a 5xx) → 'error'.
function refusedReason(err) {
  if (err?.status === 409) return err?.code === 'book_full' ? 'full' : 'dead';
  if (err?.status === 404) return 'dead';
  return 'error';
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
// `fetch` the git HTTP client AND the change-check client ride (defaults to the
// global one), the seam storage.git's and sync.engine's behavior tests use;
// `options.setInterval`/`options.clearInterval` inject the sync scheduler's
// five-minute timer, and `options.setTimeout`/`options.clearTimeout` its
// waiting-saves retry (defaults to the globals), so a test drives both with a
// fake clock. The version opened at is derived from
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
  let changeCheck = null;
  let booksClient = null;
  let online = null;
  let addByLink = null;
  let syncEngine = null;
  let syncScheduler = null;
  let conflicts = null;
  let upload = null;

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
        // Setlists ride the same index, parsed by suffix (books.setlist_search
        // Decision 3): a `*.setlist.md` path is indexed title-only via
        // `parseSetlist`. Wired beside `parse`, both from `cifra-md`.
        parseSetlist,
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

  // The change-check HTTP client, composed once over the injected `fetch`
  // (sync.engine) — the sibling of the git HTTP client, the Worker's second
  // non-git network consumer. `options.fetch` is the same seam storage.git's
  // behavior test drives.
  function ensureChangeCheck() {
    if (!changeCheck) changeCheck = createChangeCheckClient({ fetch: options.fetch });
    return changeCheck;
  }

  // The `/api/books` HTTP client, composed once over the injected `fetch`
  // (books.online) — the app's first consumer of the service's book endpoints,
  // a sibling of the change-check and git HTTP clients. The same `options.fetch`
  // seam the other two ride, so a behavior test drives create/delete.
  function ensureBooksClient() {
    if (!booksClient) booksClient = createBooksClient({ fetch: options.fetch });
    return booksClient;
  }

  // Compose the put-online / download / remove / delete mechanics once over the
  // SAME fs, git layer and lock registry as the working copy and the home book
  // (books.online), plus the `/api/books` client. The Worker owns git and
  // IndexedDB; the view only sends PUT_ONLINE / DOWNLOAD_BOOK / REMOVE_BOOK /
  // DELETE_BOOK and reacts to the reply (DIRECTION §3.7).
  function ensureOnline() {
    if (!online) {
      online = createOnline({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
        booksClient: ensureBooksClient(),
      });
    }
    return online;
  }

  // Compose the clone-a-hosted-book mechanic once over the SAME git layer and
  // lock registry (books.add_by_link), the sibling of ensureOnline. The Worker
  // owns git; the view only sends ADD_BY_LINK / ADD_MINE and reacts to the reply
  // (DIRECTION §3.7). The accept/list HTTP calls stay on the books client.
  function ensureAddByLink() {
    if (!addByLink) {
      addByLink = createAddByLink({ git: ensureGit(), locks: ensureLocks() });
    }
    return addByLink;
  }

  // Compose the sync engine once over the SAME fs, git layer and lock registry
  // as the working copy and the home book (sync.engine), plus the change-check
  // client, the cifra merge driver and the home book. It emits per-book SYNC
  // facts through the port and re-surfaces the home-book-derived slices after a
  // home sync (the SYNC_HOME path). The commit identity is the device's
  // (`resolveSyncAuthor`).
  function ensureSyncEngine() {
    if (!syncEngine) {
      syncEngine = createSyncEngine({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
        changeCheck: ensureChangeCheck(),
        mergeDriver: createCifraMergeDriver(),
        homeBook: ensureHomeBook(),
        resolveAuthor: resolveSyncAuthor,
        surfaceHome: surfaceHomeBook,
        // A book the user has engaged (sync.conflicts) has an in-progress merge
        // in the working copy: the engine skips it — it stays *needs you* and
        // takes nothing new from sync until it is settled or abandoned (workflow
        // 9 L38-45; Decision 4), rather than re-fetching and re-aborting it.
        hasInProgressMerge: (bookId) => ensureConflicts().hasInProgressMerge(bookId),
        emit: (payload) => port.postMessage(event(EventKind.SYNC, payload)),
        // A clean merge landed: tell the open reading view which songs moved and
        // who moved them (sync.read_in_place; DIRECTION §3.7 L423-424 "a merge
        // landing is a message"). A transient per-file fact the view reacts to.
        emitMerged: (payload) => port.postMessage(event(EventKind.MERGED, payload)),
        // A merge moved a book's head: re-index it, so what sync brought in is
        // found by search now (workflow 8: a change on another device is there).
        onHeadMoved: (bookId) => indexOneBook(bookId),
      });
    }
    return syncEngine;
  }

  // Compose the conflict session once over the SAME fs, git layer and lock
  // registry as the engine (sync.conflicts). It recomputes and materialises an
  // in-progress merge on engage, applies the resolutions, commits the two-parent
  // merge and pushes, and abandons — all under the book lock. It emits CONFLICTS
  // (the recomputed per-book model) and reuses SAVE_REFUSED for a marker-line
  // refusal; `requestSync` lets the engine re-emit the SYNC fact once the book is
  // settled or abandoned.
  function ensureConflicts() {
    if (!conflicts) {
      conflicts = createConflicts({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
        resolveAuthor: resolveSyncAuthor,
        emit: (payload) => port.postMessage(event(EventKind.CONFLICTS, payload)),
        emitRefused: (payload) => port.postMessage(event(EventKind.SAVE_REFUSED, payload)),
        requestSync: () => ensureSyncScheduler().trigger(),
        // An upload merge that collided retained a `refs/upload/<id>` ref in the
        // book; prefer it over origin/main so the SAME session settles an upload
        // collision as a racing sync (sync.upload Decision 3). upload.js owns the
        // ref convention; conflicts.js just asks for the incoming ref.
        incomingRef: (bookId, dir) => ensureUpload().incomingRefFor(bookId, dir),
      });
    }
    return conflicts;
  }

  // Compose the upload engine once over the SAME fs, git layer and lock registry
  // as the working copy (sync.upload), plus the cifra merge driver it merges
  // through. The Worker owns git and IndexedDB; the view (books.upload_ui) only
  // sends PREVIEW_UPLOAD / IMPORT_UPLOAD / CANCEL_UPLOAD and renders the reply.
  // The authored commits take the uploading user's identity (resolveSyncAuthor,
  // the home-book author name — Decision 7).
  function ensureUpload() {
    if (!upload) {
      upload = createUpload({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
        mergeDriver: createCifraMergeDriver(),
        resolveAuthor: resolveSyncAuthor,
      });
    }
    return upload;
  }

  // Compose the scheduler once (sync.engine): it coalesces the five triggers
  // into non-overlapping passes and runs the five-minute heartbeat. The timer
  // functions are injectable (`options.setInterval`/`options.clearInterval`,
  // defaulting to the globals) so a test drives the heartbeat with a fake clock.
  function ensureSyncScheduler() {
    if (!syncScheduler) {
      syncScheduler = createSyncScheduler({
        run: () => ensureSyncEngine().pass(),
        setInterval: options.setInterval,
        clearInterval: options.clearInterval,
        setTimeout: options.setTimeout,
        clearTimeout: options.clearTimeout,
      });
    }
    return syncScheduler;
  }

  // The device commit identity the sync engine authors merge commits and home
  // syncs with (sync.engine): the §2.3 device id as the address id, and the
  // display name the home book keeps (authorName register, home-book-format
  // §4.1), falling back to a neutral word before the user gives one. Read
  // locally, offline-first; it never surfaces the name to a log (standing rule).
  async function resolveSyncAuthor() {
    const home = ensureHomeBook();
    const deviceId = await home.ensureDeviceId({ idb, name, version });
    const prefs = await home.read({ bookId: HOME_BOOK_ID, file: 'preferences.json' });
    const displayName = prefs?.authorName?.value ?? 'Me';
    return { id: deviceId, name: displayName };
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

  // Clone a hosted book onto this device and record it on the shelf
  // (books.add_by_link, workflow 1 §Invited, workflow 7): the shared tail of
  // ADD_BY_LINK (after a 200 accept) and ADD_MINE (already a member). The clone
  // lands FIRST (add-by-link.js); only then is the shelf register written — the
  // book's title as the `label`, the clone URL as the `link`, its place in the
  // order (kept if the book already had a row, else appended), and the GRANTED
  // `role` (reader/editor — the joiner never chooses, Decision) — so a failed or
  // cancelled clone leaves no half-book (Decision 4). The book is indexed before
  // BOOK_CLONED emits, so the live session's search finds it at once (the
  // online_reindex obligation, books.online). One global flush at the tail
  // persists the relocated repo and the shelf write together, so an immediate
  // reload lists the cloned book. Writes `role: owner` never happens here — only
  // put-online owns a book; this path writes reader/editor.
  async function cloneOntoShelf({ serviceId, gitUrl, title, role, author }) {
    // Clone only if the book is not already on the device — re-opening the same
    // link (accept is idempotent and would 200 again) must not clone twice into a
    // non-empty directory. A present `.git` is the "already cloned" signal; the
    // shelf register below is rewritten either way (idempotent).
    let alreadyCloned = true;
    try {
      await ensureFs().promises.stat(`${ensureGit().bookDir(serviceId)}/.git`);
    } catch {
      alreadyCloned = false;
    }
    if (!alreadyCloned) {
      await ensureAddByLink().cloneHosted({ id: serviceId, gitUrl });
    }
    const home = ensureHomeBook();
    await home.ensureLocal({ author });
    const deviceId = await home.ensureDeviceId({ idb, name, version });
    const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
    const existing = shelf?.books?.[serviceId];
    const position =
      typeof existing?.position?.value === 'number'
        ? existing.position.value
        : nextShelfPosition(shelf, deviceId);
    await home.set({
      bookId: HOME_BOOK_ID,
      file: 'shelf.json',
      changes: [
        { path: ['books', serviceId, 'label'], value: title },
        { path: ['books', serviceId, 'link'], value: gitUrl },
        { path: ['books', serviceId, 'position'], value: position },
        { path: ['books', serviceId, 'role'], value: role },
      ],
      author,
    });
    await surfaceHomeBookShelf();
    await indexOneBook(serviceId);
    await ensureFs().flush();
    port.postMessage(event(EventKind.BOOK_CLONED, { bookId: serviceId }));
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

  // Re-surface every home-book-derived slice after a home-book sync (the
  // SYNC_HOME path): preferences, the shelf and the instrument roster, in the
  // same order OPEN surfaces them. The sync engine calls this after routing the
  // home book to home-book.js `sync`, so a register the merge changed reaches
  // its slice (storage.preferences_surface / shelf_surface / music.instruments;
  // "re-emitted when sync changes a register").
  async function surfaceHomeBook() {
    await surfaceHomeBookPreferences();
    await surfaceHomeBookShelf();
    await surfaceHomeBookInstruments();
  }

  // SONG event — a song's reading state projected from the home book's
  // songs.json (songs.reading, Decision 2): the signed transposition offset and
  // the per-tuning variations-in-use map, keyed by the §2.3 ref. A read before
  // any home book exists returns `{}` (ENOENT, home-book.js), so an unopened or
  // never-transposed song surfaces `{ transposition: 0, variations: {} }` — the
  // written key with no variation chosen, never an error. Local, offline,
  // lock-free. Carries a song ref and the small state only — no song text
  // (standing rule). Re-used on OPEN_SONG and after each reading-state write.
  async function surfaceHomeBookSong(bookId, path) {
    const songs = await ensureHomeBook().read({ bookId: HOME_BOOK_ID, file: 'songs.json' });
    const ref = songRefOf(bookId, path);
    port.postMessage(
      event(EventKind.SONG, {
        bookId,
        path,
        transposition: transpositionOf(songs, ref),
        variations: variationsOf(songs, ref),
      }),
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
    // Start the sync engine's five-minute heartbeat and run a first pass now
    // (workflow 8 §When it runs — on app open). Fire-and-forget: nothing the
    // user does waits on sync (DIRECTION §1), so the pass runs after OPEN
    // returns and the scheduler coalesces it with any trigger that follows.
    ensureSyncScheduler().start();
    ensureSyncScheduler().trigger();
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
            // A book with an in-progress merge is paused (sync.conflicts): a save
            // made mid-merge would be folded into it, so refuse it outright with
            // *settle the conflicts first* — distinct from the marker-line refusal
            // (workflow 9 L42-43; Decision 4).
            if (ensureConflicts().hasInProgressMerge(bookId)) {
              port.postMessage(
                event(EventKind.SAVE_REFUSED, { bookId, path: paths?.[0] ?? null, reason: 'merge_in_progress' }),
              );
              break;
            }
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
              // After a save, run a sync pass so the push the save left
              // best-effort (working-copy.js Decision 8) goes up as soon as a
              // push can — the after-save trigger (workflow 8 L18). Coalesced
              // and fire-and-forget: the save's reply already went out.
              ensureSyncScheduler().trigger();
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
          case CommandKind.SET_THEME: {
            // Persist the chosen theme to the home book (account.account_screen,
            // design.theme_picker; workflow 13 §Preferences; home-book-format
            // §4.1). Validate against CHOSEN_THEMES at the boundary (Decision 2):
            // an unknown value is rejected (no write). `automatic` clears the
            // register to a tombstone (value null — home-book §5.3, Decision 3) so
            // a new device follows its own light/dark mode, never a literal
            // "automatic"; a named theme writes its value. Then re-surface
            // PREFERENCES so ThemeRoot re-applies, and flush so an immediate reload
            // reads it. Offline, auto-committed, never pushed. No value logged.
            const { theme, author } = message.payload;
            if (!CHOSEN_THEMES.includes(theme)) {
              throw new Error('invalid theme');
            }
            const value = theme === 'automatic' ? null : theme;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'preferences.json',
              changes: [{ path: ['theme'], value }],
              author,
            });
            await surfaceHomeBookPreferences();
            await ensureFs().flush();
            break;
          }
          case CommandKind.SET_LANGUAGE: {
            // Persist the chosen language to the home book (account.account_screen,
            // design.theme_picker; workflow 13 §Preferences; home-book-format
            // §4.1). Validate against LOCALE_IDS at the boundary (Decision 2): an
            // unknown value is rejected (no write). Write the `language` register,
            // re-surface PREFERENCES so LocaleRoot re-applies, and flush. Offline,
            // auto-committed, never pushed. No value logged.
            const { language, author } = message.payload;
            if (!LOCALE_IDS.includes(language)) {
              throw new Error('invalid language');
            }
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'preferences.json',
              changes: [{ path: ['language'], value: language }],
              author,
            });
            await surfaceHomeBookPreferences();
            await ensureFs().flush();
            break;
          }
          case CommandKind.MARK_INSTRUMENT_PROMPT_SEEN: {
            // Record that the first-open instrument prompt was answered, asked
            // once (songs.first_song, workflow 1 §The instrument): provision a
            // local home book if none exists, write the `instrumentPromptSeen`
            // register into preferences.json, and re-surface PREFERENCES so the
            // slice carries it and the reading view stops asking. Offline,
            // auto-committed, never pushed (a preference, like SET_IDENTITY_NAME
            // and USE_INSTRUMENT). The payload carries only the commit identity
            // and the boolean — no song text, no path (standing rule).
            const { author } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'preferences.json',
              changes: [{ path: ['instrumentPromptSeen'], value: true }],
              author,
            });
            await surfaceHomeBookPreferences();
            // Flush the inode table at the handler tail (fs.js Decision 6): the
            // only write was home.set's register change, so an immediate reload
            // reads the stored flag — and the prompt never returns.
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
          case CommandKind.RESTORE_PART: {
            // Restore ONE block of a version into the working copy, uncommitted
            // (songs.restore_part, workflow 6 §Restoring): splice `block` of the
            // historical model into the current working model, write it canonical.
            // RESTORED carries `restored` so the UI opens the save sheet only when
            // a block landed; `false` means the restore brought nothing back
            // (behaviour 4). The save is what commits (history.md Decision 4).
            const { bookId, path, commit, fromPath, block } = message.payload;
            const { restored } = await ensureHistory().restorePart({
              bookId,
              path,
              commit,
              fromPath,
              block,
            });
            port.postMessage(event(EventKind.RESTORED, { bookId, path, restored }));
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
          case CommandKind.LIST_SETLISTS: {
            // Every loaded book's setlists for the Setlists destination
            // (books.setlists, workflow 12 §The file L34): walk each book's
            // working tree, read its `*.setlist.md` files and reply with each
            // one's book, path, title and song count. A local, offline read;
            // the home-state book holds no setlists, so it is excluded exactly
            // as the index sweep excludes it.
            const bookIds = await listBookIds(ensureFs(), HOME_BOOK_ID);
            const setlists = [];
            for (const bookId of bookIds) {
              const { entries } = await ensureBookTree().tree({ bookId });
              const dir = ensureGit().bookDir(bookId);
              for (const entry of entries) {
                if (!entry.path.endsWith(SETLIST_SUFFIX) || entry.status === 'deleted') {
                  continue;
                }
                let text;
                try {
                  text = await ensureFs().promises.readFile(`${dir}/${entry.path}`, 'utf8');
                } catch (err) {
                  if (err?.code === 'ENOENT') continue;
                  throw err;
                }
                const model = parseSetlist(text);
                const count = model.body.filter(
                  (el) => el.type === 'song' || el.type === 'unlinked',
                ).length;
                setlists.push({ bookId, path: entry.path, title: model.title, count });
              }
            }
            port.postMessage(event(EventKind.SETLISTS, { setlists }));
            break;
          }
          case CommandKind.ADD_TO_SETLIST: {
            // Add a song to a setlist as one locked, uncommitted change
            // (books.setlists, workflow 12 §Building one, §Songs from another
            // book): the working copy does the copy-if-cross-book,
            // create-if-new and append under a single lock (Decision 3). Keep
            // the index in step for a copied song, the way MOVE_FILE does for a
            // moved one, so it is findable before the shared save; the setlist
            // file itself is not a song-index entry.
            const { targetBookId, setlistPath, newTitle, song } = message.payload;
            const result = await ensureWorkingCopy().addToSetlist({
              targetBookId,
              setlistPath,
              newTitle,
              song,
            });
            if (result.copied) {
              await ensureIndexHydrated();
              await persistIndexChanges(
                await reindexOrRemove({ bookId: targetBookId, path: result.path, unsaved: true }),
              );
            }
            port.postMessage(
              event(EventKind.SETLIST_UPDATED, {
                bookId: targetBookId,
                setlistPath: result.setlistPath,
                path: result.path,
                copied: result.copied,
              }),
            );
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
          case CommandKind.SYNC: {
            // Run a sync pass (workflow 8 §When it runs). The payload carries a
            // `reason` for observability only; the action is identical. The
            // Worker's scheduler coalesces this with the open / after-save /
            // five-minute triggers into non-overlapping passes, so a flood of
            // SYNC commands (a foreground flap, *sync now* mashed) collapses.
            // Fire-and-forget: nothing the user does waits on sync (DIRECTION
            // §1), so no event or reply rides this command — the engine emits
            // per-book SYNC facts as the pass moves.
            ensureSyncScheduler().trigger();
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
          case CommandKind.OPEN_CONFLICTS: {
            // Engage a book the engine left *needs you* (sync.conflicts): recompute
            // the byte-deterministic merge and materialise it in the working copy,
            // then emit the per-book CONFLICTS model (workflow 9 §Meeting one).
            await ensureConflicts().open(message.payload.bookId);
            break;
          }
          case CommandKind.RESOLVE_CONFLICT: {
            // Settle one file by one side / by the edited text / by keeping or
            // deleting a song (workflow 9 §Settling one). Re-emits CONFLICTS; when
            // the last file is settled it commits the two-parent merge and pushes.
            await ensureConflicts().resolve(message.payload);
            break;
          }
          case CommandKind.COMMIT_MERGE: {
            // Commit the two-parent merge and push once every file is settled (the
            // book-level *everything settled* path; workflow 9 §When every).
            await ensureConflicts().commitMerge(message.payload);
            break;
          }
          case CommandKind.ABANDON_MERGE: {
            // Put the book back as it was before the sync, the incoming changes
            // waiting for the next one (workflow 9 §Leaving one).
            await ensureConflicts().abandon(message.payload.bookId);
            break;
          }
          case CommandKind.PREVIEW_UPLOAD: {
            // Read a zip as a remote and preview what importing / merging it would
            // do, song by song, WITHOUT writing to the target (sync.upload,
            // workflow 7 §The preview). A non-zip buffer, a CRC failure or a
            // zip-slip entry name throws and is surfaced by the outer catch as an
            // ERROR event — never a crash. The preview carries titles and musical
            // summaries, never whole song text (standing rule).
            const { target, bytes } = message.payload;
            const model = await ensureUpload().preview({ target, bytes });
            port.postMessage(event(EventKind.UPLOAD_PREVIEW, model));
            break;
          }
          case CommandKind.IMPORT_UPLOAD: {
            // Land a previewed upload on confirm (workflow 7 §Ends one of two
            // ways). The upload engine reads the scratch repo named by `uploadId`
            // and lands it; this handler maps the result to the existing events
            // and (for a new book) writes the shelf register as CREATE_BOOK does.
            const { uploadId, choice, target, perFile, author } = message.payload;
            const result = await ensureUpload().import_({ uploadId, choice, target, perFile });
            if (result.kind === 'new_book') {
              // A fresh local book: write its `shelf.local` entry (title from the
              // imported README), re-surface SHELF, index it and announce it —
              // the CREATE_BOOK / OPEN_EXAMPLE_BOOK tail.
              const home = ensureHomeBook();
              await home.ensureLocal({ author });
              const deviceId = await home.ensureDeviceId({ idb, name, version });
              const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
              const position = nextShelfPosition(shelf, deviceId);
              await home.set({
                bookId: HOME_BOOK_ID,
                file: 'shelf.json',
                changes: [
                  { path: ['local', deviceId, result.bookId, 'title'], value: result.title },
                  { path: ['local', deviceId, result.bookId, 'position'], value: position },
                ],
                author,
              });
              await surfaceHomeBookShelf();
              await indexOneBook(result.bookId);
              await ensureFs().flush();
              port.postMessage(event(EventKind.BOOK_CREATED, { bookId: result.bookId }));
              break;
            }
            // A merge / replace into an existing book: re-index its working tree
            // (the landed songs), emit a SYNC fact so the shelf reflects the new
            // state, and — when it collided — leave it `needs_you` for the conflict
            // session (sync.upload Decision 3). A clean landing was pushed inline
            // best-effort; a trigger retries an offline push at the next pass.
            await ensureIndexHydrated();
            await indexOneBook(result.bookId);
            const at = new Date().toISOString();
            if (result.kind === 'needs_you') {
              port.postMessage(event(EventKind.SYNC, { bookId: result.bookId, phase: 'needs_you', at }));
            } else {
              const phase = result.pushed ? 'in_step' : 'saves_waiting';
              const extra = result.pushed
                ? {}
                : { savesWaiting: await countCommitsAhead({ fs: ensureFs(), dir: ensureGit().bookDir(result.bookId) }) };
              port.postMessage(event(EventKind.SYNC, { bookId: result.bookId, phase, at, ...extra }));
              ensureSyncScheduler().trigger();
            }
            break;
          }
          case CommandKind.CANCEL_UPLOAD: {
            // Discard a previewed upload: remove the scratch repo (workflow 7
            // §The preview, "nothing is written until it is confirmed"). All local.
            await ensureUpload().cancel({ uploadId: message.payload.uploadId });
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
          case CommandKind.PUT_ONLINE: {
            // Put a device-only book online (workflow 7 L46-52): create it on
            // Estante (private), adopt the service id as the on-device id
            // (Decision 3), set the remote, push the first commit, and migrate
            // the shelf register from `shelf.local` to `shelf.books`. The
            // service create is first; a dropped network after it does not lose
            // the book (the sync engine retries the push — Decision 4). `bookId`
            // is the current on-device id (the local id).
            const { bookId: localId, author } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            const deviceId = await home.ensureDeviceId({ idb, name, version });
            const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
            const localEntry = shelf?.local?.[deviceId]?.[localId];
            // The former title becomes the hosted book's label; its place in the
            // order is kept (a new position if it had none).
            const title = localEntry?.title?.value ?? localId;
            const position =
              typeof localEntry?.position?.value === 'number'
                ? localEntry.position.value
                : nextShelfPosition(shelf, deviceId);
            let result;
            try {
              result = await ensureOnline().putOnline({ localId, title });
            } catch (err) {
              // The service create was refused: nothing was written on the
              // device (Decision 4). Word the reason for the view — a quota
              // (413), a missing session (401), offline (no status) or other.
              const reason =
                err?.status === 413
                  ? 'quota'
                  : err?.status === 401
                    ? 'signed_out'
                    : err?.status
                      ? 'error'
                      : 'offline';
              port.postMessage(event(EventKind.BOOK_ONLINE_REFUSED, { bookId: localId, reason }));
              break;
            }
            const serviceId = result.bookId;
            // Migrate the shelf register (Decision 3): tombstone the local entry
            // (so its row drops, §5.3) and write the hosted entry — label = the
            // former title, link = the clone URL (home-book-format §4.2),
            // position kept, role owner.
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'shelf.json',
              changes: [
                { path: ['local', deviceId, localId, 'title'], value: null },
                { path: ['local', deviceId, localId, 'position'], value: null },
                { path: ['books', serviceId, 'label'], value: title },
                { path: ['books', serviceId, 'link'], value: result.gitUrl },
                { path: ['books', serviceId, 'position'], value: position },
                { path: ['books', serviceId, 'role'], value: 'owner' },
              ],
              author,
            });
            await surfaceHomeBookShelf();
            // Keep the search index in step with the re-keyed directory
            // (books.online_reindex acceptance 2): drop the stale `localId`
            // locations (their files were relocated and removed) and index the
            // relocated `serviceId` tree. Because docs are oid-keyed and the
            // relocated files carry the same oids, `indexOneBook` re-parses
            // nothing (Decision 2, 3). The stale per-book build-status entry for
            // `localId` is nulled through the existing INDEX_STATUS event
            // (Decision 4). All of this precedes the BOOK_ONLINE emit so the
            // view's next read already finds the book by its service id.
            await ensureIndexHydrated();
            await persistIndexChanges(ensureSearchIndex().removeBook(localId));
            port.postMessage(event(EventKind.INDEX_STATUS, { bookId: localId, state: null }));
            await indexOneBook(serviceId);
            // Flush at the handler tail after both locks released (Decision 4):
            // one global flush persists the relocated repo and the shelf
            // migration, so an immediate reload finds the hosted book.
            await ensureFs().flush();
            port.postMessage(
              event(EventKind.BOOK_ONLINE, { previousBookId: localId, bookId: serviceId }),
            );
            // A first-push that could not complete inline retries next pass
            // (offline-save retry, Decision 4). Coalesced and fire-and-forget.
            ensureSyncScheduler().trigger();
            break;
          }
          case CommandKind.DOWNLOAD_BOOK: {
            // Zip the repository as it is on the device (workflow 7 L55-63) and
            // hand the Blob to the main thread, which saves it as a file. All
            // local — no account, no network. The Blob carries no song text to a
            // log (standing rule); it is the user's own repository.
            const { bookId } = message.payload;
            // The home book is provisioned lazily — it only reaches the device on
            // the first preference write (ensureLocal). Taking your data out must
            // still yield its zip even before any preference was set (workflow 17
            // §Taking your data out, account.leaving), so provision a fresh local
            // home book first when it is absent. Offline, no account: ensureLocal
            // is a no-op once a committed home book exists.
            if (bookId === HOME_BOOK_ID) {
              await ensureHomeBook().ensureLocal({ author: await resolveSyncAuthor() });
            }
            const { bytes } = await ensureOnline().download({ bookId });
            port.postMessage(event(EventKind.BOOK_DOWNLOAD, { bookId, bytes }));
            break;
          }
          case CommandKind.REMOVE_BOOK: {
            // Remove this device's clone only (workflow 7 L128-135): delete the
            // local repository and tombstone the shelf register so the row drops
            // (§5.3). The service book (if any) is untouched — all local. A local
            // book's `title`/`position` registers are tombstoned; a hosted book's
            // `label`/`link`/`position`/`role`.
            const { bookId, author } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            const deviceId = await home.ensureDeviceId({ idb, name, version });
            const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
            const isLocal = Boolean(shelf?.local?.[deviceId]?.[bookId]);
            await ensureOnline().remove({ bookId });
            const changes = isLocal
              ? [
                  { path: ['local', deviceId, bookId, 'title'], value: null },
                  { path: ['local', deviceId, bookId, 'position'], value: null },
                ]
              : [
                  { path: ['books', bookId, 'label'], value: null },
                  { path: ['books', bookId, 'link'], value: null },
                  { path: ['books', bookId, 'position'], value: null },
                  { path: ['books', bookId, 'role'], value: null },
                ];
            await home.set({ bookId: HOME_BOOK_ID, file: 'shelf.json', changes, author });
            await surfaceHomeBookShelf();
            // The clone is gone; drop the book's index entries so a SEARCH in
            // this session no longer surfaces a book the device no longer holds
            // (books.online_reindex acceptance 3), and null its stale
            // build-status entry (Decision 4) — both before the BOOK_REMOVED
            // emit, so the view's next read is already consistent.
            await ensureIndexHydrated();
            await persistIndexChanges(ensureSearchIndex().removeBook(bookId));
            port.postMessage(event(EventKind.INDEX_STATUS, { bookId, state: null }));
            await ensureFs().flush();
            port.postMessage(event(EventKind.BOOK_REMOVED, { bookId }));
            break;
          }
          case CommandKind.DELETE_BOOK: {
            // Delete the book from Estante for everyone (owner only, workflow 7
            // L136-137): DELETE /api/books/{id} first — a non-owner is refused by
            // the service (403/404) and this throws before any local change (the
            // ERROR event the catch posts) — then remove the local clone and
            // tombstone the shelf register (a hosted book: label/link/position/
            // role). The typed-name guard is the app's (service.books decision).
            const { bookId, author } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            await ensureOnline().deleteBook({ bookId });
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'shelf.json',
              changes: [
                { path: ['books', bookId, 'label'], value: null },
                { path: ['books', bookId, 'link'], value: null },
                { path: ['books', bookId, 'position'], value: null },
                { path: ['books', bookId, 'role'], value: null },
              ],
              author,
            });
            await surfaceHomeBookShelf();
            // The clone is gone; drop the book's index entries (same as remove —
            // books.online_reindex acceptance 4) and null its build-status entry
            // (Decision 4), before the BOOK_REMOVED emit.
            await ensureIndexHydrated();
            await persistIndexChanges(ensureSearchIndex().removeBook(bookId));
            port.postMessage(event(EventKind.INDEX_STATUS, { bookId, state: null }));
            await ensureFs().flush();
            port.postMessage(event(EventKind.BOOK_REMOVED, { bookId }));
            break;
          }
          case CommandKind.SURVEY_SIGN_OUT: {
            // Count this device's local-only work for the sign-out dialog's two
            // notices (account.sign_out; workflow 13 §Signing out; mockup
            // W13-new-device.dc.html:187-192). A read, no teardown: unsaved-song
            // counts come from the live index, saves-not-pushed from
            // countCommitsAhead, "on Estante" from the origin-tracking head
            // (Decision 2). A local book's content is never on Estante, so it
            // carries no saves-waiting count — the download guard covers it whole.
            const home = ensureHomeBook();
            const deviceId = await home.ensureDeviceId({ idb, name, version });
            const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
            await ensureIndexHydrated();
            const surveyFs = ensureFs();
            const surveyGit = ensureGit();
            const surveyIndex = ensureSearchIndex();
            const unsavedSongsIn = (id) => {
              const [first] = surveyIndex.browse({ scope: { bookId: id } }).books;
              return (first?.songs ?? []).filter((s) => s.unsaved).length;
            };
            const books = [];
            const shared = shelf?.books ?? {};
            for (const id of Object.keys(shared)) {
              const title = shared[id]?.label?.value;
              if (title == null) continue; // tombstoned register — not on the shelf
              const dir = surveyGit.bookDir(id);
              books.push({
                id,
                title,
                kind: 'shared',
                role: shared[id]?.role?.value ?? null,
                savesWaiting: await countCommitsAhead({ fs: surveyFs, dir }),
                unsavedSongs: unsavedSongsIn(id),
                onEstante: (await resolveOriginHead({ fs: surveyFs, dir })) != null,
              });
            }
            const localShelf = shelf?.local?.[deviceId] ?? {};
            for (const id of Object.keys(localShelf)) {
              const title = localShelf[id]?.title?.value;
              if (title == null) continue;
              books.push({
                id,
                title,
                kind: 'local',
                role: null,
                savesWaiting: 0,
                unsavedSongs: unsavedSongsIn(id),
                onEstante: false,
              });
            }
            port.postMessage(event(EventKind.SIGN_OUT_SURVEY, { books }));
            break;
          }
          case CommandKind.SIGN_OUT: {
            // Leave the account on this device (workflow 13 §Signing out).
            // `remove` drops every clone — the account's shared books and this
            // device's local books — and tombstones their shelf registers
            // (Decision 1); `keep` turns each shared book into a local book (the
            // inverse of PUT_ONLINE's shelf migration, Decision 3) and strips its
            // git remote, leaving the already-local books. Either way the home
            // book stays (its preferences keep working signed out, Constraint 9)
            // and its remote is stripped idempotently. All local, no network —
            // POST /api/auth/signout is the main thread's, after this (Decision 4).
            const { mode, author } = message.payload;
            const keep = mode === 'keep';
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            const deviceId = await home.ensureDeviceId({ idb, name, version });
            const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
            const online = ensureOnline();
            const shared = shelf?.books ?? {};
            const sharedIds = Object.keys(shared).filter((id) => shared[id]?.label?.value != null);
            const localShelf = shelf?.local?.[deviceId] ?? {};
            const localIds = Object.keys(localShelf).filter(
              (id) => localShelf[id]?.title?.value != null,
            );
            await ensureIndexHydrated();
            const index = ensureSearchIndex();
            const changes = [];
            const removedIds = [];
            if (keep) {
              // Each shared book becomes a local book: strip its remote, migrate
              // its register. The clone, working copy and history stay in place, so
              // the index entries stay valid (the id does not change).
              for (const id of sharedIds) {
                await online.detach({ bookId: id });
                changes.push(
                  ...keepAsLocalChanges({
                    bookId: id,
                    deviceId,
                    label: shared[id]?.label?.value ?? null,
                    position: shared[id]?.position?.value ?? null,
                  }),
                );
              }
              // Already-local books are left untouched.
            } else {
              for (const id of [...sharedIds, ...localIds]) {
                const kind = sharedIds.includes(id) ? 'shared' : 'local';
                await online.remove({ bookId: id });
                changes.push(...removeChanges({ bookId: id, deviceId, kind }));
                await persistIndexChanges(index.removeBook(id));
                removedIds.push(id);
              }
            }
            if (changes.length) {
              await home.set({ bookId: HOME_BOOK_ID, file: 'shelf.json', changes, author });
            }
            // The home book stays; strip its remote idempotently so no signed-out
            // device keeps tracking and a later new_device attach has a clean slate
            // (Constraint 9 — a no-op today, since nothing attaches it yet).
            await online.detach({ bookId: HOME_BOOK_ID });
            await ensureFs().flush();
            // SIGNED_OUT first, THEN the shelf re-surface: in remove mode the
            // emptied shelf unmounts the account screen's offline sign-out region
            // (its `hasAccountBooks` gate flips false — AccountScreen.jsx), and with
            // it the dialog that listens for SIGNED_OUT. Posted after the shelf
            // slice, that event would reach a torn-down listener and the surface
            // would never return to not-signed-in (account.sign_out, Decision 4;
            // the offline Remove e2e). Posted first — while the shelf is still full
            // and the dialog still mounted — it is delivered to a live listener;
            // the shelf re-surface and index clears follow and no longer race it.
            port.postMessage(event(EventKind.SIGNED_OUT, { mode: keep ? 'keep' : 'remove' }));
            await surfaceHomeBookShelf();
            for (const id of removedIds) {
              port.postMessage(event(EventKind.INDEX_STATUS, { bookId: id, state: null }));
            }
            break;
          }
          case CommandKind.LEAVE_ESTANTE: {
            // Delete the account on this device (account.leaving, workflow 17
            // §cascade device-teardown). Dispatched by the main thread ONLY after
            // DELETE /api/account returned 204 (Decision 3) — the account is
            // already gone server-side, so this is a local sweep, the inverse
            // ordering of SIGN_OUT. It runs the same remove-branch teardown
            // SIGN_OUT's `mode:'remove'` does — drop every clone (the account's
            // shared books and this device's local books) and its index entries —
            // extended to the HOME book itself, which sign-out keeps but leaving
            // removes (workflow 17 §Deleting: "removed from this device"), so the
            // device returns to its first-run, not-signed-in state. There is no
            // shelf tombstone to write (the home book, which holds the shelf, is
            // being deleted) and no POST /api/auth/signout to follow (the session
            // is already revoked). The home book is re-provisioned empty on the
            // next write (home-book.js), which is exactly first-run.
            const home = ensureHomeBook();
            const deviceId = await home.ensureDeviceId({ idb, name, version });
            const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
            const online = ensureOnline();
            const shared = shelf?.books ?? {};
            const sharedIds = Object.keys(shared).filter((id) => shared[id]?.label?.value != null);
            const localShelf = shelf?.local?.[deviceId] ?? {};
            const localIds = Object.keys(localShelf).filter(
              (id) => localShelf[id]?.title?.value != null,
            );
            await ensureIndexHydrated();
            const index = ensureSearchIndex();
            const removedIds = [];
            for (const id of [...sharedIds, ...localIds]) {
              await online.remove({ bookId: id });
              await persistIndexChanges(index.removeBook(id));
              removedIds.push(id);
            }
            // The home book last: deleting its whole clone supersedes the
            // remote-strip sign-out does (Decision 7), and leaves nothing to
            // tombstone.
            await online.remove({ bookId: HOME_BOOK_ID });
            await ensureFs().flush();
            // LEFT_ESTANTE first, THEN the re-surface — the same mounted-listener
            // ordering SIGN_OUT relies on: the emptied shelf unmounts the account
            // screen's Leaving region (and the dialog listening for this reply), so
            // the event must reach a live listener before the slices empty
            // (account.sign_out Decision 4). surfaceHomeBook re-reads the now-absent
            // home book and emits empty/default preferences, shelf and instruments.
            port.postMessage(event(EventKind.LEFT_ESTANTE, {}));
            await surfaceHomeBook();
            for (const id of removedIds) {
              port.postMessage(event(EventKind.INDEX_STATUS, { bookId: id, state: null }));
            }
            break;
          }
          case CommandKind.ADD_BY_LINK: {
            // Join a shared book from its invitation (books.add_by_link, workflow
            // 1 §Invited). Always attempt the accept first (Decision 2): a 401 has
            // no side effect, so trying-first is the account-first gate — it emits
            // NEED_ACCOUNT (no clone, no shelf write), and the main thread shows
            // the generic invited screen + SignIn and re-sends this command on
            // sign-in (accept is idempotent on repeat — no double join). A 200
            // Book clones and records it with the GRANTED role; a 409/404 emits a
            // worded BOOK_REFUSED and leaves the shelf untouched (a dead/full link
            // reveals nothing about the book, workflow 1 §Invited L53-58).
            const { token, author } = message.payload;
            let book;
            try {
              book = await ensureBooksClient().accept(token);
            } catch (err) {
              if (err?.status === 401) {
                port.postMessage(event(EventKind.NEED_ACCOUNT, { token }));
              } else {
                port.postMessage(event(EventKind.BOOK_REFUSED, { reason: refusedReason(err) }));
              }
              break;
            }
            await cloneOntoShelf({
              serviceId: book.id,
              gitUrl: book.gitUrl,
              title: book.title,
              role: book.role,
              author,
            });
            // A freshly cloned book syncs on the engine's next pass (offline-save
            // retry shape); coalesced and fire-and-forget.
            ensureSyncScheduler().trigger();
            break;
          }
          case CommandKind.ADD_MINE: {
            // Add a book the account is ALREADY a member of onto this device
            // ("mine on Estante", workflow 7 §Add-a-book; Decision 5). No accept —
            // membership is a given — so the same clone-and-record tail runs
            // directly over the id/url/role the LIST_MINE reply already carried.
            const { bookId, gitUrl, label, role, author } = message.payload;
            await cloneOntoShelf({
              serviceId: bookId,
              gitUrl,
              title: label,
              role,
              author,
            });
            ensureSyncScheduler().trigger();
            break;
          }
          case CommandKind.LIST_MINE: {
            // List the account's books not yet on this device's shelf (workflow 7
            // §Add-a-book "Mine on Estante"; Decision 5): GET /api/books minus the
            // local shelf, a client-side diff over the device's own knowledge (the
            // service has no per-device state). A 401 (no session) replies
            // signed_out so the sheet shows "Sign in to see them"; any other
            // failure replies error. Reads nothing that lands on the device.
            let listed;
            try {
              listed = await ensureBooksClient().list();
            } catch (err) {
              const status = err?.status === 401 ? 'signed_out' : 'error';
              port.postMessage(event(EventKind.MINE, { status, books: [] }));
              break;
            }
            const deviceId = await ensureHomeBook().ensureDeviceId({ idb, name, version });
            const shelf = await ensureHomeBook().read({
              bookId: HOME_BOOK_ID,
              file: 'shelf.json',
            });
            port.postMessage(
              event(EventKind.MINE, {
                status: 'ready',
                books: booksNotOnShelf(listed, shelf, deviceId),
              }),
            );
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
          case CommandKind.OPEN_SONG: {
            // Surface a song's reading state (songs.reading, Decision 2): the
            // stored transposition offset and the per-tuning variations in use,
            // projected from the home book's songs.json. A plain read, no lock,
            // no commit; the paired OPEN_SOURCE carries the text the view parses.
            const { bookId, path } = message.payload;
            await surfaceHomeBookSong(bookId, path);
            break;
          }
          case CommandKind.SET_TRANSPOSITION: {
            // Remember how far a song is transposed (songs.reading, workflow 2
            // L135-138; music.transpose's deferred command). Personal state in
            // the home book, not the song (DIRECTION §3.2): write the signed
            // `transposition` register through `home-book.set` — one lock,
            // canonical, auto-committed, never pushed — then re-surface SONG. A
            // local home book is provisioned if none exists. No song text.
            const { bookId, path, semitones } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author: message.payload.author });
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'songs.json',
              changes: [transpositionChange(songRefOf(bookId, path), semitones)],
              author: message.payload.author,
            });
            await surfaceHomeBookSong(bookId, path);
            await ensureFs().flush();
            break;
          }
          case CommandKind.SET_VARIATION: {
            // Remember which variation is in use for a song on one tuning
            // (songs.reading, workflow 2 L73-74; home-book-format §4.5). Personal
            // state in the home book, keyed per tuning: write the `variation`
            // register through `home-book.set` (auto-committed, never pushed),
            // then re-surface SONG. A local home book is provisioned if absent.
            const { bookId, path, tuning, variation } = message.payload;
            const home = ensureHomeBook();
            await home.ensureLocal({ author: message.payload.author });
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'songs.json',
              changes: [variationChange(songRefOf(bookId, path), tuning, variation)],
              author: message.payload.author,
            });
            await surfaceHomeBookSong(bookId, path);
            await ensureFs().flush();
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
            // Materialize the standard guitar on its first star (home-book §2.1
            // lazy write; workflow 15 L74; music.explorer_standard_shapes): when
            // the in-use instrument is the synthesized fallback (the reserved id,
            // nothing stored yet), write its definition + rules and set it in use
            // before the shape leaf below — so the generic shape-write path
            // round-trips for the fallback exactly as for any named instrument.
            // Mirrors the SAVE_INSTRUMENT add branch; idempotent (a later star
            // finds a live entry and adds only its leaf). Each register file under
            // its own lock, auto-committed, never pushed.
            if (id === STANDARD_INSTRUMENT_ID) {
              const [instruments, preferences] = await Promise.all([
                home.read({ bookId: HOME_BOOK_ID, file: 'instruments.json' }),
                home.read({ bookId: HOME_BOOK_ID, file: 'preferences.json' }),
              ]);
              const materialize = standardMaterialization({ instruments, preferences });
              if (materialize.instruments.length) {
                await home.set({
                  bookId: HOME_BOOK_ID,
                  file: 'instruments.json',
                  changes: materialize.instruments,
                  author,
                });
              }
              if (materialize.preferences.length) {
                await home.set({
                  bookId: HOME_BOOK_ID,
                  file: 'preferences.json',
                  changes: materialize.preferences,
                  author,
                });
              }
            }
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
