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
import { getConfig, setConfig, resolveRef, readBlob } from 'isomorphic-git';
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
import { listSetlists } from './setlist-list.js';
import { createHomeBook, HOME_BOOK_ID } from './home-book.js';
import { createChangeCheckClient } from './change-check-client.js';
import { createBooksClient } from './books-client.js';
import { createAccountClient } from './account-client.js';
import { deviceHintOf, deviceKindOf } from './device-kind.js';
import { fillQueue } from './shelf-fill.js';
import { mySongsOffer } from './my-songs-choice.js';
import { createOnline } from './online.js';
import { createFork } from './fork.js';
import { createAddByLink } from './add-by-link.js';
import { booksNotOnShelf, ownerRefreshChanges } from '../books/mine-on-estante.js';
import { createCifraMergeDriver } from './cifra-merge-driver.js';
import { createSyncEngine, countCommitsAhead, resolveOriginHead } from './sync-engine.js';
import { keepAsLocalChanges, removeChanges } from './sign-out.js';
import { createSyncScheduler } from './sync-scheduler.js';
import { createConflicts } from './conflicts.js';
import { createUpload } from './upload.js';
import { createBringIn } from './bring-in.js';
import { createBooks } from './books.js';
import { createExampleBook } from './example-book.js';
import { createMySongs, MY_SONGS_ID } from './my-songs.js';
import { deriveSongFilename, firstSaveName } from '../songs/song-filename.js';
import { defaultSaveMessage } from '../songs/save-note.js';
import { createSearchIndex } from './search-index.js';
import { createRecents } from './recents.js';
import { surfacePreferences } from './preferences.js';
import { surfaceShelf, nextShelfPosition, planShelfBackfill } from './shelf.js';
import { readmeTitle } from './readme-title.js';
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
import { authorFrom, createAuthorResolver, noReplyAddress } from './author.js';
import { reauthorBook } from './reauthor.js';
import {
  CHOSEN_THEMES,
  DENSITIES,
  DEFAULT_DENSITY,
  HANDS,
  DEFAULT_HAND,
  ORIENTATIONS,
  DEFAULT_ORIENTATION,
} from '../theme/resolve.js';
import { LOCALE_IDS } from '../i18n/index.js';

// The schema version the database opens at, DERIVED from the migration step
// list (single source of truth — migrations.js Decision 1): bumping the schema
// is appending a step there, nothing here. `storage.migrations` turned the
// single-version open into this versioned stepping.
export const SCHEMA_VERSION = latestVersion(MIGRATIONS);
export const DB_NAME = 'estante';
export const META_KEY = 'meta';

// The display-preference registers (shell.display_preferences;
// home-book-format §4.1), one per command: the payload field carrying the
// choice, its value set, the default (written as a tombstone) and the error
// an invalid value is rejected with.
const DISPLAY_REGISTERS = {
  [CommandKind.SET_DENSITY]: {
    register: 'density',
    field: 'density',
    values: DENSITIES,
    fallback: DEFAULT_DENSITY,
    error: 'invalid density',
  },
  [CommandKind.SET_DIAGRAM_HANDED]: {
    register: 'diagramHanded',
    field: 'handed',
    values: HANDS,
    fallback: DEFAULT_HAND,
    error: 'invalid hand',
  },
  [CommandKind.SET_DIAGRAM_ORIENTATION]: {
    register: 'diagramOrientation',
    field: 'orientation',
    values: ORIENTATIONS,
    fallback: DEFAULT_ORIENTATION,
    error: 'invalid orientation',
  },
};

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
      // The two-*My songs* flags (account.new_device) are device-local Worker
      // state on the same record, never view state either.
      delete view.mySongsKeptBoth;
      delete view.mySongsMergePending;
      // The authoring identities (account.commit_author Constraint 1) are Worker
      // state too: the main thread never sees an account or local author id.
      delete view.accountId;
      delete view.localAuthorId;
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
  let fork = null;
  let addByLink = null;
  let syncEngine = null;
  let syncScheduler = null;
  let conflicts = null;
  let upload = null;
  let bringIn = null;
  let accountClient = null;
  let authors = null;
  // What the device's kind is worked out from (account.new_device Decision 5):
  // the main thread's `navigator` hint, carried by OPEN, else this Worker's own.
  let deviceHint = deviceHintOf(navigator);
  // The one attach in flight (ATTACH_HOME and the start-time attach share it),
  // the one shelf fill running and whether another was asked for meanwhile,
  // and the last *My songs* offer emitted (so an unchanged one is not re-sent).
  let attaching = null;
  let filling = null;
  let fillAgain = false;
  let lastOffer = null;

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
        // History's *you* (account.commit_author Decision 7): the addresses only
        // the Worker knows are this device's user's.
        selfAddresses: () => ensureAuthors().ownAddresses(),
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

  // The `/api/account/home-book` client (account.new_device Decision 1), over the
  // same injected `fetch` the other API clients ride.
  function ensureAccountClient() {
    if (!accountClient) accountClient = createAccountClient({ fetch: options.fetch });
    return accountClient;
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

  // Compose the make-it-my-own mechanic once (books.fork) over the SAME fs, git
  // layer, lock registry and `/api/books` client, relocating through online.js's
  // `relocate` (the put-online move). The view only sends FORK_BOOK and renders
  // BOOK_FORKED / FORK_FAILED; the shelf and index writes stay here.
  function ensureFork() {
    if (!fork) {
      fork = createFork({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
        booksClient: ensureBooksClient(),
        relocate: (opts) => ensureOnline().relocate(opts),
      });
    }
    return fork;
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
  // (`resolveAuthor`).
  function ensureSyncEngine() {
    if (!syncEngine) {
      syncEngine = createSyncEngine({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
        changeCheck: ensureChangeCheck(),
        mergeDriver: createCifraMergeDriver(),
        homeBook: ensureHomeBook(),
        resolveAuthor: resolveAuthor,
        // After a home sync: re-surface its slices, then let the shelf fill pick
        // up any book the merge brought (account.new_device acceptance 4) and
        // re-ask the *My songs* question (acceptance 6).
        surfaceHome: async () => {
          await surfaceHomeBook();
          afterHomeSync();
        },
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
        // A fork follows its original (sync.fork_follow, workflow 11): the
        // engine counts each followed fork's original from the pass's one change
        // check and records `goneAt` when the original goes away.
        readOriginals,
        recordOriginal,
        emitOriginal: (payload) => port.postMessage(event(EventKind.ORIGINAL, payload)),
        // A push refused as a reader's (books.fork Constraint 6): rewrite the
        // shelf's `role` hint to what the service said (Decision 8), so the next
        // Save — on every device of the account — opens the fork sheet.
        onCannotSave: markReader,
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
        resolveAuthor: resolveAuthor,
        emit: (payload) => port.postMessage(event(EventKind.CONFLICTS, payload)),
        emitRefused: (payload) => port.postMessage(event(EventKind.SAVE_REFUSED, payload)),
        requestSync: () => ensureSyncScheduler().trigger(),
        // An upload merge that collided retained a `refs/upload/<id>` ref in the
        // book; prefer it over origin/main so the SAME session settles an upload
        // collision as a racing sync (sync.upload Decision 3). upload.js owns the
        // ref convention; conflicts.js just asks for the incoming ref.
        // A bring-in that collided retains `refs/remotes/original/main`
        // (sync.fork_follow AC9) — the same session settles it.
        incomingRef: async (bookId, dir) =>
          (await ensureBringIn().incomingRefFor(bookId, dir)) ??
          ensureUpload().incomingRefFor(bookId, dir),
      });
    }
    return conflicts;
  }

  // Compose the upload engine once over the SAME fs, git layer and lock registry
  // as the working copy (sync.upload), plus the cifra merge driver it merges
  // through. The Worker owns git and IndexedDB; the view (books.upload_ui) only
  // sends PREVIEW_UPLOAD / IMPORT_UPLOAD / CANCEL_UPLOAD and renders the reply.
  // The authored commits take the uploading user's identity (resolveAuthor,
  // the home-book author name — Decision 7).
  function ensureUpload() {
    if (!upload) {
      upload = createUpload({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
        mergeDriver: createCifraMergeDriver(),
        resolveAuthor: resolveAuthor,
      });
    }
    return upload;
  }

  // Compose the bring-in once over the SAME fs, git layer, lock registry and
  // merge driver as the upload, whose merge path it shares (sync.fork_follow,
  // workflow 11 §Following the original). The Worker fetches and merges; the
  // view (books.bring_in) only sends PREVIEW_BRING_IN / BRING_IN /
  // CANCEL_BRING_IN and renders the reply.
  function ensureBringIn() {
    if (!bringIn) {
      bringIn = createBringIn({
        fs: ensureFs(),
        git: ensureGit(),
        locks: ensureLocks(),
        mergeDriver: createCifraMergeDriver(),
        resolveAuthor: resolveAuthor,
        readOriginal: async (bookId) => (await readOriginals())[bookId] ?? null,
        recordOriginal,
        emitOriginal: (payload) => port.postMessage(event(EventKind.ORIGINAL, payload)),
      });
    }
    return bringIn;
  }

  // The shelf's `original` registers (home-book-format §4.2): `{ [forkId]:
  // { bookId, title, link, followedAt, goneAt? } }` for every shared book that
  // follows an original. Local and lock-free, like every home-book read.
  async function readOriginals() {
    const shelf = await ensureHomeBook().read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
    const out = {};
    for (const [bookId, entry] of Object.entries(shelf?.books ?? {})) {
      const value = entry?.original?.value;
      if (value && typeof value === 'object' && typeof value.bookId === 'string') out[bookId] = value;
    }
    return out;
  }

  // Write a fork's `original` register whole — one register, so no reader ever
  // sees a half-updated original (sync.fork_follow Decision) — and re-surface
  // SHELF. books.fork calls it when it makes a fork; a bring-in moves
  // `followedAt`; the original going away sets `goneAt`.
  async function recordOriginal({ bookId, original }) {
    const home = ensureHomeBook();
    const author = await resolveAuthor();
    await home.ensureLocal({ author });
    await home.set({
      bookId: HOME_BOOK_ID,
      file: 'shelf.json',
      changes: [{ path: ['books', bookId, 'original'], value: original }],
      author,
    });
    await surfaceHomeBookShelf();
    await ensureFs().flush();
  }

  // Rewrite a hosted book's `role` hint to `reader` and re-surface SHELF (books.fork
  // Decision 8). The register is "a hint for the shelf, never an authority"
  // (home-book-format §4.2): the service just refused this account's push as a
  // reader's. A book no longer on the shelf (or already a reader) is left alone.
  async function markReader(bookId) {
    const home = ensureHomeBook();
    const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
    const entry = shelf?.books?.[bookId];
    if (!entry || entry?.role?.value === 'reader') return;
    const author = await resolveAuthor();
    await home.set({
      bookId: HOME_BOOK_ID,
      file: 'shelf.json',
      changes: [{ path: ['books', bookId, 'role'], value: 'reader' }],
      author,
    });
    await surfaceHomeBookShelf();
    await ensureFs().flush();
  }

  // The tombstone of a hosted book's `owner` register (books.owner_name), when
  // the shelf entry holds one — so a book taken off the shelf leaves no live
  // register behind (§5.3) and can come back through *Mine on Estante*.
  function ownerTombstone(shelf, bookId) {
    return shelf?.books?.[bookId]?.owner ? [{ path: ['books', bookId, 'owner'], value: null }] : [];
  }

  // Compose the scheduler once (sync.engine): it coalesces the five triggers
  // into non-overlapping passes and runs the five-minute heartbeat. The timer
  // functions are injectable (`options.setInterval`/`options.clearInterval`,
  // defaulting to the globals) so a test drives the heartbeat with a fake clock.
  function ensureSyncScheduler() {
    if (!syncScheduler) {
      syncScheduler = createSyncScheduler({
        // Each pass also resumes a shelf fill a lost network left waiting
        // (account.new_device Constraints: it resumes when the network returns),
        // in the background — a pass never waits on a clone.
        run: async () => {
          const result = await ensureSyncEngine().pass();
          kickFill();
          return result;
        },
        setInterval: options.setInterval,
        clearInterval: options.clearInterval,
        setTimeout: options.setTimeout,
        clearTimeout: options.clearTimeout,
      });
    }
    return syncScheduler;
  }

  // The one commit identity (account.commit_author Constraint 2): every save,
  // merge, settle, home-book write and sync, upload, bring-in and fork is
  // authored as `{ id: meta.accountId ?? meta.localAuthorId, name }` — the
  // account once signed in, this device's own local author id before (never the
  // §2.3 device id, storage/home_book Decision 6) — with the display name the
  // home book keeps (authorName register, home-book-format §4.1), falling back to
  // a neutral word. `override.name` is the save sheet's typed name. Read
  // locally, offline-first; it never surfaces the name to a log (standing rule).
  function ensureAuthors() {
    if (!authors) {
      authors = createAuthorResolver({
        readMeta: readMetaRecord,
        writeMeta: writeMetaFields,
        readName: async () => {
          const prefs = await ensureHomeBook().read({ bookId: HOME_BOOK_ID, file: 'preferences.json' });
          return prefs?.authorName?.value ?? null;
        },
      });
    }
    return authors;
  }

  function resolveAuthor(override) {
    return ensureAuthors().resolveAuthor(override);
  }

  // Re-author every book's saves not yet pushed as the account (account.
  // commit_author Constraints 4-7): local books, *My songs*, the home book,
  // kept-as-local and hosted books alike — the commits not reachable from
  // `origin/main` that carry this device's local addresses, and their
  // descendants. Local, never waits on the network; idempotent. Only `main`
  // moves (the trees are identical), so the working copy and index stay.
  async function reauthorAll() {
    const meta = await readMetaRecord();
    if (!meta.accountId) return;
    const local = new Set(await ensureAuthors().localAddresses());
    if (!local.size) return;
    const to = noReplyAddress(meta.accountId);
    const bookIds = [...(await listBookIds(ensureFs(), HOME_BOOK_ID)), HOME_BOOK_ID];
    let moved = false;
    for (const bookId of bookIds) {
      const n = await reauthorBook({
        fs: ensureFs(),
        dir: ensureGit().bookDir(bookId),
        bookId,
        locks: ensureLocks(),
        isLocal: (email) => local.has(email),
        to,
      });
      if (n) moved = true;
    }
    if (moved) await ensureFs().flush();
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

  // Tell every listing to re-read after a command's re-index landed: BROWSE
  // takes no lock and may have been answered before it (the search screen
  // mounts on DISCARDED/SAVED and browses at once), and the reducer gives
  // `index` a new reference on each INDEX_STATUS, which re-sends it
  // (songs.unsaved_after_discard Constraint 2; WRITE's precedent). Posted
  // AFTER the reply, never instead of moving it (Constraint 1).
  function postIndexReady(bookId) {
    port.postMessage(
      event(EventKind.INDEX_STATUS, { bookId, state: 'ready', songs: songCountOf(bookId) }),
    );
  }

  // Drop from the device-local recents the paths a command removed from the
  // book (those `reindexOrRemove` answered with a removal), and post RECENTS
  // when the list changed — a recent pointing at a file that no longer exists
  // is a way back to nothing (songs.unsaved_after_discard Constraint 3,
  // workflow 2 L13-15). Not hooked into `persistIndexChanges`: `removeBook`
  // runs there for books merely loading or re-keying (Decision 3).
  async function forgetRemovedRecents(bookId, removedPaths) {
    if (removedPaths.length === 0) return;
    const db = await ensureOpen();
    const { recents: list, changed } = await ensureRecents().forget(
      db,
      removedPaths.map((path) => ({ bookId, path })),
    );
    if (changed) port.postMessage(event(EventKind.RECENTS, { recents: list }));
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
      // A directory with no commit (a half-done clone) is not a book yet: no
      // status, and nothing the hydrated index held for it, so it never reads
      // as ready and empty. The shelf fill indexes it once its clone lands
      // (books.setlists_resilient Constraint 6).
      if (!(await hasCommits(bookId))) {
        await persistIndexChanges(ensureSearchIndex().removeBook(bookId));
        continue;
      }
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
    // A `ready` status carries the book's song count, so the shelf row and the
    // book's bar say *N songs* (books.row_opens_songs; workflow 7 L21-23).
    port.postMessage(
      event(EventKind.INDEX_STATUS, { bookId, state: 'ready', songs: songCountOf(bookId) }),
    );
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

  // A book's title from the level-1 heading of its working copy's README
  // (DIRECTION §2.1), or null — no README, or no heading. Never logged: a
  // heading is the user's words.
  async function readmeTitleOf(bookId) {
    try {
      return readmeTitle(await ensureFs().promises.readFile(`${ensureGit().bookDir(bookId)}/README.md`));
    } catch {
      return null;
    }
  }

  // The shelf heal at OPEN (songs.no_raw_ids Constraints 6-8): a `local-…` book
  // on the device with a commit but no entry in THIS device's shelf namespace —
  // a device id minted afresh while the books stayed, or a reload between a new
  // book's repository and its shelf write — is put back on the shelf under its
  // README's heading, and an entry with a place but no title gets the heading.
  // The plan is `planShelfBackfill` (pure); everything goes in one home-book
  // write and one flush, and a healthy shelf writes nothing. A removed book
  // (tombstoned) is never resurrected, a hosted clone never adopted as local.
  // Local only; logs nothing.
  async function healShelf() {
    const ids = (await listBookIds(ensureFs(), HOME_BOOK_ID)).filter((id) => id.startsWith('local-'));
    if (!ids.length) return;
    const books = [];
    for (const id of ids) {
      if (!(await hasCommits(id))) continue;
      books.push({ id, readmeTitle: await readmeTitleOf(id) });
    }
    if (!books.length) return;
    const home = ensureHomeBook();
    const deviceId = await home.ensureDeviceId({ idb, name, version });
    const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
    const changes = planShelfBackfill(shelf, deviceId, books);
    if (!changes.length) return;
    const author = await resolveAuthor();
    await home.ensureLocal({ author });
    await home.set({ bookId: HOME_BOOK_ID, file: 'shelf.json', changes, author });
    await ensureFs().flush();
  }

  // Read the home book's shelf.json, project it (narrowing `local` to this
  // device's namespace, §7), and post the SHELF event — the labels and links the
  // search screen and the future book-management screen read (home-book-format
  // §4.2; reducer replaces the slice). A read before any home book exists returns
  // `{}` (ENOENT, home-book.js), so the payload is `{ books: {}, local: {} }` and
  // every book reads *Untitled book* — never an error, never a crash. The
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
  // put-online owns a book; this path writes reader/editor. When the Book or the
  // row carries the owner's name, it is written as the `owner` register
  // (books.owner_name, home-book-format §4.2) — what the chip and the Leave
  // confirmation read, offline.
  async function cloneOntoShelf({ serviceId, gitUrl, title, role, ownerName, author }) {
    // Clone only if the book is not already on the device — re-opening the same
    // link (accept is idempotent and would 200 again) must not clone twice into a
    // non-empty directory. A `main` commit is the "already cloned" signal, the
    // one the shelf fill trusts; a directory an interrupted clone left is
    // cleared and cloned again, as the fill heals it (books.setlists_resilient
    // Constraint 8). The shelf register below is rewritten either way
    // (idempotent).
    if (!(await hasCommits(serviceId))) {
      await clearPartialClone(serviceId);
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
        ...(typeof ownerName === 'string' && ownerName !== ''
          ? [{ path: ['books', serviceId, 'owner'], value: ownerName }]
          : []),
      ],
      author,
    });
    await surfaceHomeBookShelf();
    await indexOneBook(serviceId);
    await ensureFs().flush();
    port.postMessage(event(EventKind.BOOK_CLONED, { bookId: serviceId }));
  }

  // Remove one book from this device (workflow 7 L128-135): delete the local
  // repository and tombstone the shelf register so the row drops (§5.3). A local
  // book's `title`/`position` registers are tombstoned; a hosted book's
  // `label`/`link`/`position`/`role`. The one teardown REMOVE_BOOK and
  // LEAVE_BOOK share (books.leave Constraint 3); the reply event is the
  // caller's. Touches no network.
  async function removeFromShelf({ bookId, author }) {
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
          ...ownerTombstone(shelf, bookId),
        ];
    await home.set({ bookId: HOME_BOOK_ID, file: 'shelf.json', changes, author });
    await surfaceHomeBookShelf();
    // The clone is gone; drop the book's index entries so a SEARCH in this
    // session no longer surfaces a book the device no longer holds
    // (books.online_reindex acceptance 3), and null its stale build-status
    // entry (Decision 4) — both before the caller's reply, so the view's next
    // read is already consistent.
    await ensureIndexHydrated();
    await persistIndexChanges(ensureSearchIndex().removeBook(bookId));
    port.postMessage(event(EventKind.INDEX_STATUS, { bookId, state: null }));
    await ensureFs().flush();
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

  // Materialize the synthesized standard guitar under its reserved id before a
  // write that touches only one of its registers (home-book §2.1 lazy write;
  // music.explorer_standard_shapes, music.instruments_roster_default): a star's
  // shape leaf, a rules edit or a definition edit on the built-in. Writes its
  // definition + rules and, only when the in-use register is absent, sets it in
  // use — so editing the built-in's rules while another instrument is in use
  // does not switch. Idempotent (a live entry yields empty change-sets). Each
  // file under its own lock, never nested; auto-committed, never pushed.
  async function materializeStandard(home, author) {
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

  // ---- a new device (account.new_device, workflow 13) -----------------------

  // The singleton `meta` record, read whole (an absent one is `{}`), and a
  // write of some of its fields — the device-local flags of the two-*My songs*
  // choice live there, outside the home book (acceptance 8), like the §2.3
  // device id.
  async function readMetaRecord() {
    const db = await ensureOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly');
      const request = tx.objectStore(META_STORE).get(META_KEY);
      request.onsuccess = () => resolve(request.result ?? {});
      request.onerror = () => reject(request.error);
    });
  }

  async function writeMetaFields(fields) {
    const db = await ensureOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readwrite');
      const store = tx.objectStore(META_STORE);
      const request = store.get(META_KEY);
      request.onsuccess = () => {
        const meta = request.result ?? {
          schemaVersion: db.version,
          protocolVersion: 1,
          createdAt: Date.now(),
        };
        store.put({ ...meta, ...fields }, META_KEY);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  // The home book's remote, as the attach left it (Decision 2): its URL and the
  // service id kept beside it as `remote.origin.estanteid`. Null fields when the
  // home book is not attached (or not there at all). A local config read.
  async function homeRemote() {
    const dir = ensureGit().bookDir(HOME_BOOK_ID);
    const read = async (path) => {
      try {
        const value = await getConfig({ fs: ensureFs(), dir, path });
        return typeof value === 'string' && value ? value : null;
      } catch {
        return null;
      }
    };
    return { url: await read('remote.origin.url'), serviceId: await read('remote.origin.estanteid') };
  }

  // Whether a book has a repository with commits on this device — what the fill
  // treats as "already here". A directory a failed clone left without `main` is
  // not.
  async function hasCommits(bookId) {
    try {
      await resolveRef({ fs: ensureFs(), dir: ensureGit().bookDir(bookId), ref: 'main' });
      return true;
    } catch {
      return false;
    }
  }

  // How many songs the index holds for a book (unsaved ones included).
  function songCountOf(bookId) {
    const [first] = ensureSearchIndex().browse({ scope: { bookId } }).books;
    if (!first) return 0;
    return typeof first.count === 'number' ? first.count : (first.songs ?? []).length;
  }

  // Write this device's kind into the home book (Decision 5):
  // `shelf.devices[deviceId].kind`, a token, never a user agent or a name. A
  // device writes it at attach and refreshes it on a later start when it has
  // changed; `refreshOnly` writes only over a kind already recorded. The device
  // id stays a namespace key (§2.3). Returns whether it wrote.
  async function recordDeviceKind({ refreshOnly = false } = {}) {
    const home = ensureHomeBook();
    const deviceId = await home.ensureDeviceId({ idb, name, version });
    const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
    const current = shelf?.devices?.[deviceId]?.kind?.value ?? null;
    if (refreshOnly && current === null) return false;
    const kind = deviceKindOf(deviceHint);
    if (current === kind) return false;
    await home.set({
      bookId: HOME_BOOK_ID,
      file: 'shelf.json',
      changes: [{ path: ['devices', deviceId, 'kind'], value: kind }],
      author: await resolveAuthor(),
    });
    return true;
  }

  // Attach the home book to the account's (acceptance 1; Decision 1): ask the
  // service where it is, set it as `origin` with the service id beside it, write
  // this device's kind, and sync — the account's settings come down, or this
  // device's merge into them key by key and are pushed, or are pushed as the
  // first (home-book.js `sync`). Then the home-book slices are surfaced, so the
  // instrument, notation, language and theme are right before the shelf fills
  // (workflow 13 §What comes down). An attached home book is never attached
  // again. A 401 — not signed in — or an unreachable service attaches nothing.
  // Resolves `{ attached, restored, fresh }`: `restored` when the account's
  // home book already had saves (Decision 9), `fresh` when this call attached.
  async function doAttach() {
    // The saves not yet pushed become the account's before any push this attach
    // (or a later put online) makes (account.commit_author Decision 5).
    await reauthorAll();
    if ((await homeRemote()).url) return { attached: true, restored: false, fresh: false };
    let book;
    try {
      book = await ensureAccountClient().homeBook();
    } catch {
      return { attached: false, restored: false, fresh: false };
    }
    const home = ensureHomeBook();
    const author = await resolveAuthor();
    await home.ensureLocal({ author });
    const dir = ensureGit().bookDir(HOME_BOOK_ID);
    await ensureLocks().withLock(HOME_BOOK_ID, async () => {
      await ensureGit().setRemote({ dir, url: book.gitUrl });
      // Inside the `[remote "origin"]` section, so the sign-out strip
      // (online.detach) removes it with the remote (Decision 2).
      await setConfig({ fs: ensureFs(), dir, path: 'remote.origin.estanteid', value: book.id });
    });
    await recordDeviceKind();
    const { remoteHead } = await home.sync({ bookId: HOME_BOOK_ID, author });
    await surfaceHomeBook();
    await ensureFs().flush();
    return { attached: true, restored: remoteHead != null, fresh: true };
  }

  // The one attach at a time: a call made while another is in flight waits for
  // it, and runs its own only when that one attached nothing (the start-time
  // attempt may have met a 401 just before the sign-in that asks again).
  async function attachHome() {
    if (attaching) {
      const prior = await attaching.catch(() => null);
      if (prior?.attached) return { attached: true, restored: prior.restored, fresh: false };
    }
    const mine = doAttach();
    attaching = mine;
    try {
      return await mine;
    } finally {
      if (attaching === mine) attaching = null;
    }
  }

  function emitFill(bookId, state, progress, songs) {
    port.postMessage(
      event(EventKind.SHELF_FILL, {
        bookId,
        state,
        progress,
        ...(typeof songs === 'number' ? { songs } : {}),
      }),
    );
  }

  // Drop what a failed or interrupted clone left: a directory with no `main`.
  async function clearPartialClone(bookId) {
    if (await hasCommits(bookId)) return;
    try {
      await ensureFs().promises.stat(ensureGit().bookDir(bookId));
    } catch {
      return; // nothing there
    }
    await ensureOnline().remove({ bookId });
  }

  // One run of the shelf fill (acceptance 4; workflow 13 §What comes down):
  // every live hosted book on the shelf with no repository here is listed at
  // once as *waiting*, then cloned one at a time in shelf order (Decision 6) —
  // *cloning* with its progress, then *ready* with its song count once indexed,
  // so its songs are searchable as it lands. The shelf registers are left as
  // they are: the clone writes nothing to the home book (Decision 6). A clone
  // that fails — no network — goes back to *waiting*, never failed or lost, and
  // is tried again by the next fill (a sync pass, a home sync, the next start).
  // Only an attached home book's shelf is filled.
  async function fillOnce() {
    if (!(await homeRemote()).url) return;
    const shelf = await ensureHomeBook().read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
    const present = new Set();
    for (const bookId of Object.keys(shelf?.books ?? {})) {
      if (await hasCommits(bookId)) present.add(bookId);
    }
    const queue = fillQueue(shelf, present);
    if (!queue.length) return;
    for (const { bookId } of queue) emitFill(bookId, 'waiting', 0);
    let landed = false;
    for (const { bookId, link } of queue) {
      emitFill(bookId, 'cloning', 0);
      try {
        await clearPartialClone(bookId);
        let percent = 0;
        await ensureAddByLink().cloneHosted({
          id: bookId,
          gitUrl: link,
          onProgress: (p) => {
            if (!p?.total) return;
            const next = Math.min(99, Math.floor((100 * p.loaded) / p.total));
            if (next > percent) {
              percent = next;
              emitFill(bookId, 'cloning', percent);
            }
          },
        });
        await indexOneBook(bookId);
        await ensureFs().flush();
        emitFill(bookId, 'ready', 100, songCountOf(bookId));
        landed = true;
      } catch {
        try {
          await clearPartialClone(bookId);
        } catch {
          /* the next fill clears it */
        }
        emitFill(bookId, 'waiting', 0);
      }
    }
    // The account's *My songs* may just have landed: Merge needs it here.
    if (landed) await evaluateMySongsOffer();
  }

  // Start a fill in the background, or ask the running one to go round again
  // (a home sync brought new books while it was cloning). Never awaited by a
  // command: nothing the user does waits on a clone (Constraints).
  function kickFill() {
    if (filling) {
      fillAgain = true;
      return filling;
    }
    filling = (async () => {
      try {
        do {
          fillAgain = false;
          await fillOnce();
        } while (fillAgain);
      } catch {
        /* offline-first: the next trigger fills again */
      } finally {
        filling = null;
      }
    })();
    return filling;
  }

  // Ask (again) whether this device is offered its two-*My songs* choice
  // (acceptance 6): the account's *My songs* online, this device's own with
  // songs, *keep both* not chosen, and no merge of the two left half done.
  // Emitted only when the answer changed. Only for an attached home book.
  async function evaluateMySongsOffer() {
    if (!(await homeRemote()).url) return;
    const home = ensureHomeBook();
    const deviceId = await home.ensureDeviceId({ idb, name, version });
    const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
    await ensureIndexHydrated();
    const meta = await readMetaRecord();
    const offer = meta.mySongsMergePending
      ? null
      : mySongsOffer({
          shelf,
          deviceId,
          localSongs: songCountOf(MY_SONGS_ID),
          keptBoth: meta.mySongsKeptBoth === true,
        });
    const payload = offer
      ? {
          offered: true,
          accountBookId: offer.accountBookId,
          ready: await hasCommits(offer.accountBookId),
          kind: deviceKindOf(deviceHint),
        }
      : { offered: false };
    const key = JSON.stringify(payload);
    if (key === lastOffer) return;
    lastOffer = key;
    port.postMessage(event(EventKind.MY_SONGS_CHOICE, payload));
  }

  // What follows a home sync (the engine's, or SYNC_HOME): the fill picks up any
  // book it brought, and the *My songs* question is asked again. Background.
  function afterHomeSync() {
    kickFill();
    evaluateMySongsOffer().catch(() => {});
  }

  // At start (Decision 3): an unattached home book is attached if the device is
  // signed in — a 401 ends quietly, which is how a signed-out device does
  // nothing — and an attached one refreshes this device's kind if it changed,
  // resumes its fill and re-asks the *My songs* question. Background, after the
  // shell is up.
  async function startHome() {
    if (!(await homeRemote()).url) {
      const result = await attachHome();
      if (!result.attached) return;
      if (result.fresh) {
        port.postMessage(event(EventKind.HOME_ATTACHED, { attached: true, restored: result.restored }));
      }
    } else if (await recordDeviceKind({ refreshOnly: true })) {
      await surfaceHomeBookShelf();
      await ensureFs().flush();
    }
    kickFill();
    await evaluateMySongsOffer();
  }

  // A *My songs* merge that collided was settled (acceptance 7): once the
  // account's *My songs* is no longer mid-merge, this device's leaves the shelf
  // — its songs are in the account's now. An abandoned merge keeps it.
  async function settleMySongsMerge(bookId, { abandoned = false } = {}) {
    const meta = await readMetaRecord();
    if (meta.mySongsMergePending !== bookId) return;
    if (!abandoned && ensureConflicts().hasInProgressMerge(bookId)) return;
    await writeMetaFields({ mySongsMergePending: null });
    if (!abandoned) {
      await removeFromShelf({ bookId: MY_SONGS_ID, author: await resolveAuthor() });
      // The songs it brought are found in the account's *My songs* now.
      await indexOneBook(bookId);
    }
    await evaluateMySongsOffer();
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
    // when no home book exists yet. First, the shelf heal puts back a local
    // book this device's namespace lost (songs.no_raw_ids), so the surfaced
    // shelf already lists it under its README heading.
    await healShelf();
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
    // The home book follows the account (account.new_device Decision 3): attach
    // it if this device is signed in, else fill an attached one's shelf.
    // Fire-and-forget, like the first pass.
    startHome().catch(() => {});
  }

  return {
    async handle(message) {
      if (!message || message.dir !== COMMAND) return;
      try {
        switch (message.kind) {
          case CommandKind.OPEN:
            // The main thread's navigator hint, for the device's kind (Decision 5).
            if (message.payload?.device && typeof message.payload.device === 'object') {
              deviceHint = message.payload.device;
            }
            await handleOpen();
            break;
          case CommandKind.ATTACH_HOME: {
            // Signing in made this device the account's (account.new_device
            // acceptance 1; workflow 13 §What comes down): attach the home book,
            // its settings first, then fill the shelf in the background. The
            // sign-in reply's account id is stored first (account.commit_author
            // Decision 1; Constraint 6), so every commit from here on — the
            // re-author's racing saves included — is the account's; without one
            // (the start-time path) the stored id stands.
            const accountId = message.payload?.accountId;
            if (typeof accountId === 'string' && accountId) {
              await writeMetaFields({ accountId });
              // Even when an attach is already in flight and this one only waits
              // on it: the saves not yet pushed become this account's now.
              await reauthorAll();
            }
            const result = await attachHome();
            port.postMessage(
              event(EventKind.HOME_ATTACHED, { attached: result.attached, restored: result.restored }),
            );
            if (result.attached) {
              kickFill();
              await evaluateMySongsOffer();
            }
            break;
          }
          case CommandKind.KEEP_BOTH_MY_SONGS: {
            // *Keep both* (account.new_device acceptance 8; workflow 13 §A device
            // used before signing in): this device's *My songs* stays on the shelf
            // as *My songs (this device)* — `title` comes from the view, in the
            // device's language — and the offer stops for good on this device
            // (a device-local flag in `meta`, outside the home book).
            const { title } = message.payload;
            const author = await resolveAuthor();
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            const deviceId = await home.ensureDeviceId({ idb, name, version });
            const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
            if (shelf?.local?.[deviceId]?.[MY_SONGS_ID]?.title?.value != null && title) {
              await home.set({
                bookId: HOME_BOOK_ID,
                file: 'shelf.json',
                changes: [{ path: ['local', deviceId, MY_SONGS_ID, 'title'], value: title }],
                author,
              });
            }
            await writeMetaFields({ mySongsKeptBoth: true });
            await surfaceHomeBookShelf();
            await ensureFs().flush();
            await evaluateMySongsOffer();
            break;
          }
          case CommandKind.PREVIEW_MY_SONGS: {
            // *Merge* (account.new_device acceptance 7; Decision 7): this device's
            // *My songs* zipped as Download zips it — working tree included, so
            // unsaved edits are carried — and previewed as an upload merge into
            // the account's *My songs*: workflow 7's preview, unrelated histories
            // and all. Writes nothing to the target; IMPORT_UPLOAD lands it.
            const { target } = message.payload;
            const { bytes } = await ensureOnline().download({ bookId: MY_SONGS_ID });
            const model = await ensureUpload().preview({ target: { kind: 'existing', bookId: target }, bytes });
            port.postMessage(event(EventKind.UPLOAD_PREVIEW, { ...model, mySongs: true }));
            break;
          }
          case CommandKind.WRITE: {
            // Durability only: persist the editor's current text. No event — the
            // write is silent; its only observable effect is the working copy.
            const { bookId, path, text } = message.payload;
            await ensureWorkingCopy().write({ bookId, path, text });
            // Re-index just this path from its new working-tree bytes, so a
            // title typed but not saved is findable immediately (storage.index
            // acceptance 5, DIRECTION §3 L116-117). Marked unsaved.
            await ensureIndexHydrated();
            const changes = await ensureSearchIndex().reindexPath({ bookId, path, unsaved: true });
            await persistIndexChanges(changes);
            // The song's listing moved (it is newly unsaved, or its title
            // changed): tell the views, so a browse listing (recents, a book's
            // songs, Save all) re-reads it. Browse takes no lock and can be
            // answered before this re-index lands, so asking again after it is
            // what keeps the listing true.
            if (changes.visibleChange) {
              port.postMessage(
                event(EventKind.INDEX_STATUS, { bookId, state: 'ready', songs: songCountOf(bookId) }),
              );
            }
            break;
          }
          case CommandKind.SAVE: {
            // Canonicalise and commit one file or several — the author
            // from the one resolver (account.commit_author Constraint 2), the
            // save sheet's typed `name` over the stored one.
            const { bookId, paths, message: note, name: typedName } = message.payload;
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
            // A blank note (empty or whitespace-only — a non-song file, a save
            // with nothing musical, a note the user cleared) commits with the
            // default *Update <paths>* (songs.save_empty_message, workflow 4
            // §Saving): git refuses an empty message. Git history, not a log.
            const saveMessage = note?.trim() ? note : defaultSaveMessage(paths);
            let outcome;
            try {
              outcome = await ensureWorkingCopy().save({
                bookId,
                paths,
                message: saveMessage,
                // Resolved inside the book lock (Constraint 6).
                author: async () => authorFrom(await resolveAuthor({ name: typedName })),
              });
            } catch {
              // A save that throws answers the sheet's SAVE_REFUSED, not the
              // generic ERROR it never hears (songs.save_empty_message Decision
              // 3). No error text in the payload or a log (Decision 4); the
              // working copy keeps the user's changes.
              port.postMessage(
                event(EventKind.SAVE_REFUSED, {
                  bookId,
                  path: paths?.[0] ?? null,
                  reason: 'failed',
                  marker: null,
                  line: null,
                }),
              );
              break;
            }
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
                  // The saved paths, so an open editor clears its *unsaved
                  // changes* mark (sync.in_place_notices; W08#3 L96).
                  paths: paths ?? [],
                  commit: outcome.commit,
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
              const removed = [];
              for (const path of paths) {
                const one = await reindexOrRemove({ bookId, path, unsaved: false });
                if (one.deleteLocations.length > 0) removed.push(path);
                mergeIndexChanges(changes, one);
              }
              await persistIndexChanges(changes);
              postIndexReady(bookId);
              await forgetRemovedRecents(bookId, removed);
              // After a save, run a sync pass: it is what pushes the save — at
              // once with a network, at the next sync without (songs.save_feedback
              // Constraint 1; workflow 4 §Save pushes, workflow 8 L18). Coalesced
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
            // A never-saved song's entry also carries the name its first save
            // will take and the folder's collision set (songs.first_save_fields
            // Constraint 2), from the same `firstSaveName` NAME_AND_SAVE calls,
            // so the dialog shows exactly the name the save gives the file.
            const { bookId, paths } = message.payload;
            const { previews } = await ensureSavePreview().preview({ bookId, paths });
            for (const entry of previews) {
              if (!entry.isNew) continue;
              const slash = entry.path.lastIndexOf('/');
              const folder = slash > 0 ? entry.path.slice(0, slash) : '';
              const { fileName, taken } = firstSaveName({
                fromPath: entry.path,
                title: entry.title,
                folderNames: await folderNames(bookId, folder),
              });
              entry.fileName = fileName;
              entry.taken = taken;
            }
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
            // own words — never logged (standing rule). Also the Account
            // screen's *Your name* change (account.author_name): the name is
            // trimmed, and a blank one writes nothing (Constraint 2, as
            // SET_THEME refuses an invalid value) — the view refuses it first.
            const displayName = String(message.payload?.name ?? '').trim();
            if (!displayName) break;
            const author = await resolveAuthor({ name: displayName });
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
            const { theme } = message.payload;
            const author = await resolveAuthor();
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
            const { language } = message.payload;
            const author = await resolveAuthor();
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
          case CommandKind.SET_DENSITY:
          case CommandKind.SET_DIAGRAM_HANDED:
          case CommandKind.SET_DIAGRAM_ORIENTATION: {
            // Persist a display preference to the home book
            // (shell.display_preferences; home-book-format §4.1), on the
            // SET_THEME template: validate against the register's value set at
            // the boundary (an invalid value is rejected, no write), clear the
            // register to a tombstone when the default is chosen (never the
            // literal default), write it, re-surface PREFERENCES so ThemeRoot
            // re-applies, and flush. One register per command, so a change on
            // one device never re-stamps another's. Offline, auto-committed,
            // never pushed. No value logged.
            const { register, field, values, fallback, error } =
              DISPLAY_REGISTERS[message.kind];
            const chosen = message.payload[field];
            const author = await resolveAuthor();
            if (!values.includes(chosen)) {
              throw new Error(error);
            }
            const value = chosen === fallback ? null : chosen;
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'preferences.json',
              changes: [{ path: [register], value }],
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
            const author = await resolveAuthor();
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
            const removed = [];
            for (const path of paths) {
              const one = await reindexOrRemove({ bookId, path, unsaved: false });
              // A never-saved file discard deleted; a saved song's discard only
              // reverts it and keeps its recent (Constraint 3).
              if (one.deleteLocations.length > 0) removed.push(path);
              mergeIndexChanges(changes, one);
            }
            await persistIndexChanges(changes);
            postIndexReady(bookId);
            await forgetRemovedRecents(bookId, removed);
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
            const fromChanges = await reindexOrRemove({ bookId, path: fromPath, unsaved: true });
            mergeIndexChanges(changes, fromChanges);
            mergeIndexChanges(
              changes,
              await reindexOrRemove({ bookId, path: toPath, unsaved: true }),
            );
            await persistIndexChanges(changes);
            port.postMessage(event(EventKind.FILE_MOVED, { bookId, fromPath, toPath }));
            postIndexReady(bookId);
            // The old path's recent is dropped, not re-pointed (Decision 4).
            await forgetRemovedRecents(
              bookId,
              fromChanges.deleteLocations.length > 0 ? [fromPath] : [],
            );
            break;
          }
          case CommandKind.FILE_LINKS: {
            // The setlist items linking to a song, listed in the rename dialog
            // before the move rewrites them (workflow 14 L151-153;
            // books.file_view_history_polish Decision 2): a local, offline read
            // that writes nothing.
            const { bookId, path } = message.payload;
            const links = await ensureWorkingCopy().links({ bookId, path });
            port.postMessage(event(EventKind.FILE_LINKS, { bookId, path, links }));
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
            const changes = await reindexOrRemove({ bookId, path, unsaved: true });
            await persistIndexChanges(changes);
            port.postMessage(event(EventKind.FILE_DELETED, { bookId, path }));
            postIndexReady(bookId);
            await forgetRemovedRecents(
              bookId,
              changes.deleteLocations.length > 0 ? [path] : [],
            );
            break;
          }
          case CommandKind.CREATE_FILE: {
            // A setlist or the README from the file view's *New* menu
            // (books.file_view_create_menu, workflow 14 §What can be done to a
            // file): written into the working copy under the book lock, named
            // there against the real folder, uncommitted. Index it as unsaved,
            // as WRITE does, so a new setlist is listed at once; then confirm
            // and re-surface the tree so it reads *new*.
            const { bookId, kind, folder, title } = message.payload;
            const result = await ensureWorkingCopy().createFile({ bookId, kind, folder, title });
            if (result.refused) {
              port.postMessage(event(EventKind.CREATE_REFUSED, { bookId, kind, reason: result.refused }));
              break;
            }
            await ensureIndexHydrated();
            const changes = await ensureSearchIndex().reindexPath({ bookId, path: result.path, unsaved: true });
            await persistIndexChanges(changes);
            port.postMessage(event(EventKind.FILE_CREATED, { bookId, path: result.path }));
            const { entries } = await ensureBookTree().tree({ bookId });
            port.postMessage(event(EventKind.TREE, { bookId, entries }));
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
            // (books.setlists, workflow 12 §The file L34): each book's
            // `*.setlist.md` files with their book, path, title and song count.
            // A local, offline read of the files present, taking no book lock,
            // so a clone or sync never holds the list up; a book with no commit
            // or one that cannot be read is skipped, and the rest are listed
            // (books.setlists_resilient Constraints 1-3). The home-state book
            // holds no setlists, so it is excluded exactly as the index sweep
            // excludes it.
            const setlists = await listSetlists({
              fs: ensureFs(),
              bookDir: (bookId) => ensureGit().bookDir(bookId),
              bookIds: await listBookIds(ensureFs(), HOME_BOOK_ID),
              hasCommits,
            });
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
            // merge-commit identity from the one resolver (account.commit_author);
            // a failed push keeps the local commit (home-book.js:317-324) and the
            // re-surface runs regardless, reflecting whatever the local tree holds.
            await ensureHomeBook().sync({
              bookId: HOME_BOOK_ID,
              author: await resolveAuthor(),
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
            // The fill picks up what the sync brought (account.new_device).
            afterHomeSync();
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
            // The last file settled a *My songs* merge: this device's leaves
            // the shelf (account.new_device acceptance 7).
            await settleMySongsMerge(message.payload.bookId);
            break;
          }
          case CommandKind.COMMIT_MERGE: {
            // Commit the two-parent merge and push once every file is settled (the
            // book-level *everything settled* path; workflow 9 §When every).
            await ensureConflicts().commitMerge(message.payload);
            await settleMySongsMerge(message.payload.bookId);
            break;
          }
          case CommandKind.ABANDON_MERGE: {
            // Put the book back as it was before the sync, the incoming changes
            // waiting for the next one (workflow 9 §Leaving one).
            await ensureConflicts().abandon(message.payload.bookId);
            // An abandoned *My songs* merge keeps this device's *My songs*.
            await settleMySongsMerge(message.payload.bookId, { abandoned: true });
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
            const { uploadId, choice, target, perFile, fromMySongs, untitledTitle } = message.payload;
            const author = await resolveAuthor();
            const result = await ensureUpload().import_({ uploadId, choice, target, perFile, untitledTitle });
            if (fromMySongs && choice === 'merge') {
              // *Merge and save* of this device's *My songs* into the account's
              // (account.new_device acceptance 7): a clean merge retires this
              // device's — tombstone, directory, index — its songs now in the
              // account's. A collision goes to the conflict session first; the
              // retirement waits for it to be settled (an abandon keeps it).
              if (result.kind === 'merged') {
                await removeFromShelf({ bookId: MY_SONGS_ID, author });
              } else if (result.kind === 'needs_you') {
                await writeMetaFields({ mySongsMergePending: result.bookId });
              }
            }
            if (result.kind === 'new_book') {
              // A fresh local book: write its `shelf.local` entry (title from the
              // imported README, written only when it has one — the view then
              // says *Untitled book*, songs.no_raw_ids Constraint 9), re-surface
              // SHELF, index it and announce it — the CREATE_BOOK /
              // OPEN_EXAMPLE_BOOK tail.
              const home = ensureHomeBook();
              await home.ensureLocal({ author });
              const deviceId = await home.ensureDeviceId({ idb, name, version });
              const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
              const position = nextShelfPosition(shelf, deviceId);
              await home.set({
                bookId: HOME_BOOK_ID,
                file: 'shelf.json',
                changes: [
                  ...(result.title
                    ? [{ path: ['local', deviceId, result.bookId, 'title'], value: result.title }]
                    : []),
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
            // The *My songs* question is asked again only after the import's
            // own reply is out: the choice hands a collision to the conflict
            // panel on that reply, before the offer is withdrawn.
            if (fromMySongs && choice === 'merge') await evaluateMySongsOffer();
            break;
          }
          case CommandKind.CANCEL_UPLOAD: {
            // Discard a previewed upload: remove the scratch repo (workflow 7
            // §The preview, "nothing is written until it is confirmed"). All local.
            await ensureUpload().cancel({ uploadId: message.payload.uploadId });
            break;
          }
          case CommandKind.PREVIEW_BRING_IN: {
            // Fetch a fork's original and preview bringing it in, song by song,
            // writing nothing to the fork (sync.fork_follow AC8, workflow 11
            // line 47). The reply says `gone` when the original refused (following
            // ends) or `unreachable` when there is no network — never an ERROR.
            const reply = await ensureBringIn().preview({ bookId: message.payload.bookId });
            port.postMessage(event(EventKind.BRING_IN_PREVIEW, reply));
            break;
          }
          case CommandKind.BRING_IN: {
            // Merge the previewed original into the fork, commit with the user's
            // note and push (AC9, workflow 11 line 48). A conflict leaves the fork
            // `needs_you` for workflow 9; a clean landing re-indexes it and emits
            // its SYNC fact, as an upload merge does.
            const { bookId, followId, note } = message.payload;
            const result = await ensureBringIn().bringIn({ bookId, followId, note });
            port.postMessage(event(EventKind.BRING_IN_DONE, result));
            if (result.kind === 'stale') break;
            const at = new Date().toISOString();
            if (result.kind === 'needs_you') {
              port.postMessage(event(EventKind.SYNC, { bookId, phase: 'needs_you', at }));
              break;
            }
            await ensureIndexHydrated();
            await indexOneBook(bookId);
            const phase = result.pushed ? 'in_step' : 'saves_waiting';
            const extra = result.pushed
              ? {}
              : { savesWaiting: await countCommitsAhead({ fs: ensureFs(), dir: ensureGit().bookDir(bookId) }) };
            port.postMessage(event(EventKind.SYNC, { bookId, phase, at, ...extra }));
            if (!result.pushed) ensureSyncScheduler().trigger();
            break;
          }
          case CommandKind.CANCEL_BRING_IN: {
            // *Not now*: drop the fetched original; the preview is spent.
            const { bookId, followId } = message.payload;
            await ensureBringIn().cancel({ bookId, followId });
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
            const { title } = message.payload;
            const author = await resolveAuthor();
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
            const { title } = message.payload;
            const author = await resolveAuthor();
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
            const { bookId, name: newName } = message.payload;
            const author = await resolveAuthor();
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
            const { bookId: localId } = message.payload;
            const author = await resolveAuthor();
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
                // Putting *My songs* online makes it the account's *My songs*
                // (account.new_device Decision 7; home-book-format §4.2): the
                // home book records which hosted book that is, so a device used
                // before signing in is offered to merge into it.
                ...(localId === MY_SONGS_ID ? [{ path: ['mySongs'], value: serviceId }] : []),
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
          case CommandKind.FORK_BOOK: {
            // Make a hosted book the user's own (books.fork, workflow 11): the
            // service copies it, or — when it will not (a 404: no longer a
            // member) — the device puts its own copy online (Decision 2). Every
            // service call precedes the device writes, so a refusal changes
            // nothing (Constraint 8). The fork then replaces the original on the
            // shelf in ONE home-book write (workflow 11 L27-30; Constraint 3), its
            // search entries move with the id, and the engine pushes what the
            // device holds on its next pass.
            const { bookId } = message.payload;
            const author = await resolveAuthor();
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            const deviceId = await home.ensureDeviceId({ idb, name, version });
            const shelf = await home.read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
            const entry = shelf?.books?.[bookId];
            if (!entry || bookId === HOME_BOOK_ID) {
              // A local book is the user's own already (Constraint 11).
              port.postMessage(
                event(EventKind.FORK_FAILED, { bookId, code: 'not_hosted', message: 'fork: not hosted' }),
              );
              break;
            }
            // The shelf label, else the book's README heading, else no label
            // at all — never the id (songs.no_raw_ids Constraint 5); the view
            // then says *Untitled book*. The service copy still needs a name:
            // the main thread's localized `untitledTitle`.
            const shelfLabel = entry?.label?.value;
            const label =
              (typeof shelfLabel === 'string' && shelfLabel.trim() ? shelfLabel : null) ??
              (await readmeTitleOf(bookId));
            const forkTitle = label ?? message.payload?.untitledTitle ?? '';
            const originalLink = entry?.link?.value ?? null;
            const position =
              typeof entry?.position?.value === 'number'
                ? entry.position.value
                : nextShelfPosition(shelf, deviceId);
            let result;
            try {
              result = await ensureFork().fork({ bookId, title: forkTitle, author: await resolveAuthor() });
            } catch (err) {
              // Refused or unreachable before any device write: word it for the
              // view — over the limit (413), no session (401), offline (no
              // status) or other. `{ code, message }` only, no song text.
              const code =
                err?.status === 413
                  ? 'quota'
                  : err?.status === 401
                    ? 'signed_out'
                    : err?.status
                      ? 'error'
                      : 'offline';
              port.postMessage(
                event(EventKind.FORK_FAILED, {
                  bookId,
                  code,
                  message: err?.status ? `fork: ${err.status}` : 'fork: unreachable',
                }),
              );
              break;
            }
            const forkId = result.bookId;
            const followedAt = new Date().toISOString();
            // The fork's original: the book it was made from, one step only (a
            // fork of a fork records its immediate parent). Made after losing
            // access, following has already ended (workflow 11 L41-46).
            const original = {
              bookId,
              title: label ?? '',
              link: originalLink,
              followedAt,
              ...(result.via === 'own' ? { goneAt: followedAt } : {}),
            };
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'shelf.json',
              changes: [
                // The original's registers cleared, as remove does — its own
                // `original` too, when it was itself a fork, so no row lingers.
                { path: ['books', bookId, 'label'], value: null },
                { path: ['books', bookId, 'link'], value: null },
                { path: ['books', bookId, 'position'], value: null },
                { path: ['books', bookId, 'role'], value: null },
                ...(entry.original ? [{ path: ['books', bookId, 'original'], value: null }] : []),
                ...ownerTombstone(shelf, bookId),
                // The fork in its place: the same label and position, owned.
                ...(label ? [{ path: ['books', forkId, 'label'], value: label }] : []),
                { path: ['books', forkId, 'link'], value: result.gitUrl },
                { path: ['books', forkId, 'position'], value: position },
                { path: ['books', forkId, 'role'], value: 'owner' },
                // Written whole, one register (sync.fork_follow Decision) — the
                // same write recordOriginal makes, folded into this one.
                { path: ['books', forkId, 'original'], value: original },
              ],
              author,
            });
            await surfaceHomeBookShelf();
            // The search entries move with the id (the online_reindex
            // obligation): drop the original's, index the relocated tree. Docs
            // are oid-keyed, so nothing is re-parsed; `unsaved` is re-derived
            // from the working tree against HEAD, so unsaved edits stay marked.
            await ensureIndexHydrated();
            await persistIndexChanges(ensureSearchIndex().removeBook(bookId));
            port.postMessage(event(EventKind.INDEX_STATUS, { bookId, state: null }));
            await indexOneBook(forkId);
            await ensureFs().flush();
            port.postMessage(
              event(EventKind.BOOK_FORKED, { previousBookId: bookId, bookId: forkId, via: result.via }),
            );
            // The engine fetches the fork, merges and pushes the local commits
            // (Decision 3), or retries the create path's first push.
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
              await ensureHomeBook().ensureLocal({ author: await resolveAuthor() });
            }
            const { bytes } = await ensureOnline().download({ bookId });
            port.postMessage(event(EventKind.BOOK_DOWNLOAD, { bookId, bytes }));
            break;
          }
          case CommandKind.REMOVE_BOOK: {
            // Remove this device's clone only (workflow 7 L128-135). The service
            // book (if any) is untouched — all local.
            const { bookId } = message.payload;
            const author = await resolveAuthor();
            await removeFromShelf({ bookId, author });
            port.postMessage(event(EventKind.BOOK_REMOVED, { bookId }));
            break;
          }
          case CommandKind.LEAVE_BOOK: {
            // End this person's membership of a shared book (books.leave;
            // workflow 10 §Leaving a book). The service first — DELETE
            // /api/books/{id}/membership — and only on its 204, or a 404 (the
            // membership already gone, Decision 3), the same teardown as
            // REMOVE_BOOK, if the book is on this shelf at all (a *Mine on
            // Estante* row's book is not: nothing local to touch). A network
            // failure, a 401 or a 409 touches nothing local and replies
            // LEAVE_FAILED (workflow 10 L119-120, L128-130). Logs nothing.
            const { bookId } = message.payload;
            try {
              await ensureBooksClient().leave(bookId);
            } catch (err) {
              if (err?.status !== 404) {
                const reason = typeof err?.status === 'number' ? 'refused' : 'network';
                port.postMessage(event(EventKind.LEAVE_FAILED, { bookId, reason }));
                break;
              }
            }
            const shelf = await ensureHomeBook().read({ bookId: HOME_BOOK_ID, file: 'shelf.json' });
            if (shelf?.books?.[bookId]?.label?.value != null) {
              await removeFromShelf({ bookId, author: await resolveAuthor() });
            }
            port.postMessage(event(EventKind.BOOK_LEFT, { bookId }));
            break;
          }
          case CommandKind.DELETE_BOOK: {
            // Delete the book from Estante for everyone (owner only, workflow 7
            // L136-137): DELETE /api/books/{id} first — a non-owner is refused by
            // the service (403/404) and this throws before any local change (the
            // ERROR event the catch posts) — then remove the local clone and
            // tombstone the shelf register (a hosted book: label/link/position/
            // role). The typed-name guard is the app's (service.books decision).
            const { bookId } = message.payload;
            const author = await resolveAuthor();
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
            const unsavedIn = (id) => {
              const [first] = surveyIndex.browse({ scope: { bookId: id } }).books;
              return (first?.songs ?? []).filter((s) => s.unsaved);
            };
            const unsavedSongsIn = (id) => unsavedIn(id).length;
            // The titles the Leave confirmation lists beside its count
            // (books.leave; Leave-book board L74). Never logged.
            const unsavedTitlesIn = (id) => unsavedIn(id).map((s) => s.title || s.path);
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
                unsavedTitles: unsavedTitlesIn(id),
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
                unsavedTitles: unsavedTitlesIn(id),
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
            const { mode } = message.payload;
            // Authorship reverts going forward only (account.commit_author
            // Constraint 9; sign_out.md:360-363): the account id is cleared
            // FIRST, so this teardown's own shelf write and every later commit
            // are local. Nothing already written is rewritten back (sign_out
            // Constraint 4).
            await writeMetaFields({ accountId: null });
            const author = await resolveAuthor();
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
                  ...ownerTombstone(shelf, id),
                );
              }
              // Already-local books are left untouched.
            } else {
              for (const id of [...sharedIds, ...localIds]) {
                const kind = sharedIds.includes(id) ? 'shared' : 'local';
                await online.remove({ bookId: id });
                changes.push(...removeChanges({ bookId: id, deviceId, kind }));
                if (kind === 'shared') changes.push(...ownerTombstone(shelf, id));
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
            const { token } = message.payload;
            const author = await resolveAuthor();
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
              ownerName: book.ownerName,
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
            const { bookId, gitUrl, label, role, ownerName } = message.payload;
            const author = await resolveAuthor();
            await cloneOntoShelf({
              serviceId: bookId,
              gitUrl,
              title: label,
              role,
              ownerName,
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
            // The listing is also where an on-shelf member's book learns its
            // owner's name, or a changed one (books.owner_name Decision 3): bring
            // each `owner` register in line, writing only when something differs.
            const ownerChanges = ownerRefreshChanges(listed, shelf);
            if (ownerChanges.length) {
              await ensureHomeBook().set({
                bookId: HOME_BOOK_ID,
                file: 'shelf.json',
                changes: ownerChanges,
                author: await resolveAuthor(),
              });
              await surfaceHomeBookShelf();
              await ensureFs().flush();
            }
            break;
          }
          case CommandKind.OPEN_SOURCE: {
            // Read a song's live working-copy text into the editor (songs.editor,
            // Decision 4). A thin read over the working copy — the read-back
            // storage.working_copy did not build. A missing file throws ENOENT,
            // which the surrounding try/catch turns into an ERROR event (not a
            // throw across the port). No lock: this is a plain read, no write.
            // `unsaved` (sync.in_place_notices; W08#3 L96) compares the working
            // text with HEAD's blob in the same read: a path absent from HEAD (or a
            // book with no commit yet) is unsaved.
            const { bookId, path } = message.payload;
            const dir = ensureGit().bookDir(bookId);
            const fs = ensureFs();
            const text = await fs.promises.readFile(`${dir}/${path}`, 'utf8');
            let unsaved = true;
            try {
              const head = await resolveRef({ fs, dir, ref: 'HEAD' });
              const { blob } = await readBlob({ fs, dir, oid: head, filepath: path });
              unsaved = new TextDecoder().decode(blob) !== text;
            } catch {
              unsaved = true;
            }
            port.postMessage(event(EventKind.SOURCE, { bookId, path, text, unsaved }));
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
            const author = await resolveAuthor();
            await home.ensureLocal({ author });
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'songs.json',
              changes: [transpositionChange(songRefOf(bookId, path), semitones)],
              author,
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
            const author = await resolveAuthor();
            await home.ensureLocal({ author });
            await home.set({
              bookId: HOME_BOOK_ID,
              file: 'songs.json',
              changes: [variationChange(songRefOf(bookId, path), tuning, variation)],
              author,
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
            const { targetBookId, folder, mySongsTitle } = message.payload;
            const author = await resolveAuthor();
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
            const { bookId, fromPath, name: typedName, message: note, title: promptedTitle } =
              message.payload;
            let outcome;
            let toPath;
            try {
              const dir = ensureGit().bookDir(bookId);
              const bytes = await ensureFs().promises.readFile(`${dir}/${fromPath}`);
              // The name the file carries, else the one the save sheet prompted for
              // when the song has no title line yet (songs.save_sheet acceptance 7),
              // which feeds both the slug filename and the default commit message.
              const title =
                (parseSong(bytes)?.title ?? '').trim() || (promptedTitle ?? '').trim();
              // The name the preview showed (songs.first_save_fields Constraint
              // 1): the folder's names minus the placeholder itself, so a title
              // whose slug equals the placeholder does not gain a suffix against it.
              const slash = fromPath.lastIndexOf('/');
              const folder = slash > 0 ? fromPath.slice(0, slash) : '';
              ({ path: toPath } = firstSaveName({
                fromPath,
                title,
                folderNames: await folderNames(bookId, folder),
              }));
              outcome = await ensureWorkingCopy().nameAndSave({
                bookId,
                fromPath,
                toPath,
                // The save sheet's note, else the W03 default *Add {title}*
                // (songs.save_sheet Decision 5); a whitespace-only note is blank too
                // (songs.save_empty_message). Git history, not a log — never
                // written to `console` (standing rule).
                message: note?.trim() ? note : `Add ${title || 'untitled'}`,
                author: async () => authorFrom(await resolveAuthor({ name: typedName })),
              });
            } catch {
              // As SAVE: a throw is answered with SAVE_REFUSED failed, never the
              // generic ERROR, and carries no error text (songs.save_empty_message
              // Decisions 3-4).
              port.postMessage(
                event(EventKind.SAVE_REFUSED, {
                  bookId,
                  path: fromPath ?? null,
                  reason: 'failed',
                  marker: null,
                  line: null,
                }),
              );
              break;
            }
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
              // The after-save sync pass pushes the first save, as SAVE's does
              // (songs.save_feedback Constraint 1; workflow 8 L18).
              ensureSyncScheduler().trigger();
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
            const { id, definition, preset } = message.payload;
            const author = await resolveAuthor();
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            if (id) {
              // Editing the built-in standard guitar stores it first (its rules
              // register too), so the definition below never leaves a
              // rules-less 'standard' entry (music.instruments_roster_default).
              if (id === STANDARD_INSTRUMENT_ID) await materializeStandard(home, author);
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
            const { id, rules } = message.payload;
            const author = await resolveAuthor();
            const home = ensureHomeBook();
            await home.ensureLocal({ author });
            // A rules change on the built-in standard guitar stores it first, so
            // the stored 'standard' entry carries a definition beside its rules
            // (music.instruments_roster_default; workflow 15 §The roster).
            if (id === STANDARD_INSTRUMENT_ID) await materializeStandard(home, author);
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
            const { id } = message.payload;
            const author = await resolveAuthor();
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
            const { id } = message.payload;
            const author = await resolveAuthor();
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
            const { id, tuning, chord, shorthand } = message.payload;
            const author = await resolveAuthor();
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
            if (id === STANDARD_INSTRUMENT_ID) await materializeStandard(home, author);
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
            const { id, tuning, chord } = message.payload;
            const author = await resolveAuthor();
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
