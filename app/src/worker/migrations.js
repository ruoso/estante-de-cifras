// migrations.js — the Worker's versioned IndexedDB migration framework
// (storage.migrations). The Worker is the single owner of on-device data
// (DIRECTION §3.7 L394-396); this module is how that owner evolves the shape of
// what it keeps in the one `estante` IndexedDB database across app updates.
//
// One database, one monotonic integer version, one ordered list of steps. Each
// step takes the database from version N-1 to version N inside the single
// `versionchange` transaction; the latest version is DERIVED from the list
// (`latestVersion`), so bumping the schema is appending one step and nothing
// else — the version can never drift from the steps (Decision 1). Steps are
// forward-only (the app carries only the current build — DIRECTION §3.6
// L289-293) and each is guarded so re-running it over an already-upgraded
// database is safe (Decision 2). A step that throws aborts the `versionchange`
// transaction: the on-disk version does not advance and no store is half-built
// (Decision 3).
//
// Framework-free: no React, logs nothing, stores only the schema it is asked to
// create. The `meta` object store the Worker already keeps is created by step
// 1, so the framework is exercised from the very first open.

// The `meta` object store — created by step 1, read by logic.js's
// `loadOrCreateMeta`. It lives here because migrations own object-store
// creation; logic.js imports it.
export const META_STORE = 'meta';

// The search index's two object stores (storage.index, Decision 3), created by
// step 2 and persisted into by logic.js (the one owner of the `estante`
// database). `index_docs` is the content-addressed parse cache — one record per
// distinct git blob oid; `index_locations` maps a song's location
// (`<bookId>\0<path>`) to the oid of its current working-tree bytes. Both use an
// in-line key path so a record carries its own key.
export const INDEX_DOCS_STORE = 'index_docs';
export const INDEX_LOCATIONS_STORE = 'index_locations';

// The ordered migration steps. Contiguous integer versions from 1; each
// `upgrade(db, tx, oldVersion)` runs inside the `versionchange` transaction.
// Append a step to bump the schema — never edit a shipped one, never maintain a
// version constant alongside (Decision 1). Each later storage task
// (storage.fs, storage.git, storage.working_copy, storage.index,
// storage.home_book) lands its own step here as part of its own work.
export const MIGRATIONS = [
  {
    version: 1,
    label: 'create the meta store',
    // The first-time meta-store creation the Worker did inline before
    // storage.migrations (previously logic.js:29-34), now step 1 so today's
    // behavior is preserved and the framework runs from the very first open.
    // Guarded by `contains` so re-running over an existing store is a no-op.
    upgrade(db) {
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    },
  },
  {
    version: 2,
    label: 'create the search-index stores',
    // The search index's content-addressed parse cache and location map
    // (storage.index, Decision 3). `index_docs` is keyed by the git blob oid,
    // `index_locations` by `<bookId>\0<path>`; both carry their key in-line.
    // Guarded by `contains` so re-running over an existing store is a no-op.
    upgrade(db) {
      if (!db.objectStoreNames.contains(INDEX_DOCS_STORE)) {
        db.createObjectStore(INDEX_DOCS_STORE, { keyPath: 'oid' });
      }
      if (!db.objectStoreNames.contains(INDEX_LOCATIONS_STORE)) {
        db.createObjectStore(INDEX_LOCATIONS_STORE, { keyPath: 'key' });
      }
    },
  },
  {
    version: 3,
    label: 'clear the search-index cache for the progression field',
    // storage.progression_search (Decision 3): the progression n-gram field is
    // a new property on the content-addressed `index_docs` record. Records
    // cached before it existed lack it and — being keyed by blob oid — would
    // never be re-parsed, leaving every already-indexed song unfindable by
    // progression. Clearing the two DERIVED stores (never user content) makes
    // the next OPEN `reconcile` reparse each file once and backfill the field;
    // thereafter restart serves from the cache with no reparse. Runs inside the
    // one `versionchange` transaction via `tx`; guarded by `contains` so a
    // fresh database (the stores created by step 2 moments earlier, still
    // empty) is a harmless no-op.
    upgrade(db, tx) {
      for (const store of [INDEX_DOCS_STORE, INDEX_LOCATIONS_STORE]) {
        if (db.objectStoreNames.contains(store)) {
          tx.objectStore(store).clear();
        }
      }
    },
  },
];

// The latest schema version, derived from the step list (single source of
// truth). Asserts the versions are contiguous integers from 1 so a gap or a
// duplicate is a loud programming error, not a silently skipped migration.
export function latestVersion(steps) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('migrations: the step list must be a non-empty array');
  }
  steps.forEach((step, i) => {
    if (step.version !== i + 1) {
      throw new Error(
        `migrations: steps must be contiguous from 1; expected version ${
          i + 1
        } at index ${i}, got ${step.version}`,
      );
    }
  });
  return steps[steps.length - 1].version;
}

// Run every step in `(oldVersion, newVersion]` in ascending order, inside the
// `versionchange` transaction `tx`. Called from `onupgradeneeded` with the
// event's oldVersion/newVersion. Steps are sorted by version so the order holds
// regardless of how the list was assembled. A throwing step propagates to the
// caller, which aborts the transaction — the database stays at the prior
// version and no store is half-built (Decision 3).
export function runMigrations(db, tx, oldVersion, newVersion, steps) {
  const ordered = [...steps].sort((a, b) => a.version - b.version);
  for (const step of ordered) {
    if (step.version > oldVersion && step.version <= newVersion) {
      step.upgrade(db, tx, oldVersion);
    }
  }
}
