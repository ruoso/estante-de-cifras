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
import { createHistory } from './history.js';
import { createHomeBook, HOME_BOOK_ID } from './home-book.js';
import { createSearchIndex } from './search-index.js';
import { surfacePreferences } from './preferences.js';
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
    tx.oncomplete = () => resolve(meta);
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
  let history = null;
  let homeBook = null;
  let searchIndex = null;
  let indexHydration = null;

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

  // Build every book's index on bring-up (acceptance 1, 9): emit a per-book
  // `building` → `ready` status around reconciling its working tree with the
  // persisted records, so the search screen can say a book is "still loading"
  // (workflow 2 L159-162). Reconcile re-parses only what a blob oid shows
  // changed (Decision 3).
  async function buildIndexes() {
    await ensureIndexHydrated();
    const bookIds = await listBookIds(ensureFs(), HOME_BOOK_ID);
    for (const bookId of bookIds) {
      port.postMessage(
        event(EventKind.INDEX_STATUS, { bookId, state: 'building' }),
      );
      await persistIndexChanges(await ensureSearchIndex().reconcile(bookId));
      port.postMessage(
        event(EventKind.INDEX_STATUS, { bookId, state: 'ready' }),
      );
    }
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
