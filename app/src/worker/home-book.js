// home-book.js — the home book: the Worker's writer and merger for a user's
// personal-state repository (storage.home_book). DIRECTION §3.2 L136-151: the
// home book is "a repository like any other but committed automatically — explicit
// save is for what the user authors, not for preferences"; "a settings
// repository … its files are JSON that merge key by key, the later change
// winning." home-book-format.md §9 names this module the writer and merger.
//
// It is the sibling of working-copy.js, composing the same primitives the same
// way: the git transport (git.js, for `bookDir`, `fetch`, `push`), the per-book
// lock (locks.js) and the filesystem (fs.js). The LOCAL git read/write — `add`,
// `commit`, `resolveRef`, `readBlob`, and the two-parent merge commit — live
// here, called straight on isomorphic-git over the shared `fs`, while git.js
// stays the narrow network transport (working-copy.js Decision 2; home-book.md
// Decision 3).
//
// It differs from a songbook's working copy in the two ways the format fixes
// (§1): it commits AUTOMATICALLY (no save sheet, no confirmation), and its files
// merge KEY BY KEY by the Worker's own merge (home-book-merge.js), never by git
// (§1.1). The merge is computed here and committed; git's line-based merge is
// never consulted.
//
// COMPOSITION RULE (locks.md Decision 1): one lock per logical operation. A `set`
// (read → apply → write → add → commit) and a `sync` (fetch → merge → write →
// add → commit → push) each run inside ONE `withLock` on the home book's own id,
// never reacquired per git call, never nested (Web Locks are non-reentrant), so
// an auto-commit never interleaves with a concurrent sync.
//
// OFFLINE-FIRST (workflow 1 L72-78; home-book.md Decision 5): `set` commits
// locally and never pushes — a preference change never waits on the network. A
// `sync` push that fails for want of a network keeps the local commit and
// resolves `pushed: false`, to be retried by the sync engine (mirrors
// working-copy.js:141-152).
//
// No song text, preferences, labels, links or secrets in logs (standing rule):
// this module logs nothing, and commit messages name only the file touched,
// never a value. Errors surface to the caller (logic.js), never to `console`.
//
// Framework-free, Worker-only: plain ESM, no React; never imported by the main
// thread (DIRECTION §3.7).

import {
  add as gitAdd,
  commit as gitCommit,
  resolveRef,
  readBlob,
  isDescendent,
} from 'isomorphic-git';
import { serialize, parse } from './home-book-canonical.js';
import { mergeTrees } from './home-book-merge.js';
import { authorFrom } from './author.js';
import { MIGRATIONS, META_STORE, latestVersion, runMigrations } from './migrations.js';

// The §2.1 settings files, the only files the merger reconciles key by key. The
// README.md and .gitattributes are the home book's identity files (§2.2),
// scaffolded with exact bytes, never merged. There are no other files (§8).
const SETTINGS_FILES = [
  'preferences.json',
  'shelf.json',
  'instruments.json',
  'shapes.json',
  'songs.json',
  'recents.json',
];

// The EXACT bytes of README.md and .gitattributes (§2.2): UTF-8, LF, one
// trailing newline. The validator (hook.home_book) checks a push against these
// exact bytes; a writer MUST produce them (§9). `merge=binary` is only for a
// bystanding git client — the merger never relies on git to merge (§1.1).
const README_BYTES = `# Home book

This repository holds one person's Estante de Cifras settings. Its files are
JSON that merge key by key, the later change winning; it is written and merged
by the app, not edited by hand. The format is docs/home-book-format.md in the
estante-de-cifras repository.
`;
const GITATTRIBUTES_BYTES = `* text=auto eol=lf
*.json merge=binary
`;

// The reserved id of the one home book per installation (storage.preferences_surface
// Decision 2). It lives at `git.bookDir('home')` → `/books/home`, sharing the
// `/books/<id>` namespace with songbooks; service-assigned book ids are opaque
// server ids and never take this reserved literal. The home-book behavior test
// already uses `'home'` (home-book.behavior.test.js:31); this is that
// convention as the single production constant logic.js reads.
export const HOME_BOOK_ID = 'home';

// The singleton `meta` record's key and store — the same one logic.js's
// `loadOrCreateMeta` reads (logic.js:33, migrations.js step 1). The §2.3 device
// id is a field on that record (home-book.md Decision 7): no new store, no
// migration.
const META_KEY = 'meta';

/**
 * A wall-clock reading as a §3 instant: UTC ISO-8601 to the millisecond with a
 * literal `Z`. `Date.prototype.toISOString` always emits exactly three
 * fractional digits and `Z`, matching the §3 pattern.
 *
 * @param {number} now milliseconds since the epoch
 * @returns {string}
 */
function instant(now) {
  return new Date(now).toISOString();
}

/**
 * Build the home-book operations over the composed primitives — the same deps
 * and shape as `createWorkingCopy` (working-copy.js:53). `fs` is the shared
 * filesystem, `git` the transport layer (for `bookDir`, `fetch`, `push`) and
 * `locks` the per-book lock registry.
 *
 * @param {{
 *   fs: import('./fs.js').FileSystem,
 *   git: ReturnType<typeof import('./git.js').createGitLayer>,
 *   locks: ReturnType<typeof import('./locks.js').createBookLocks>,
 * }} deps
 * @returns {{
 *   read: (opts: { bookId: string, file: string }) => Promise<Object>,
 *   set: (opts: { bookId: string, file: string, changes: Array<{ path: string[], value: * }>, author: { id: string, name: string }, now?: number }) => Promise<string>,
 *   sync: (opts: { bookId: string, author: { id: string, name: string } }) => Promise<{ commit: string | null, pushed: boolean }>,
 *   ensureDeviceId: (opts: { idb: IDBFactory, name: string, version?: number }) => Promise<string>,
 * }}
 */
export function createHomeBook({ fs, git, locks } = {}) {
  if (!fs) throw new Error('createHomeBook requires an fs');
  if (!git) throw new Error('createHomeBook requires a git layer');
  if (!locks) throw new Error('createHomeBook requires a lock registry');

  const at = (dir, file) => `${dir}/${file}`;

  // Read a settings file from the working copy to its model, an absent file as
  // `{}` (§2.1). Used by `read` and by `set` before it applies changes.
  async function readModel(full) {
    try {
      return parse(await fs.promises.readFile(full, 'utf8'));
    } catch (err) {
      if (err?.code === 'ENOENT') return {};
      throw err;
    }
  }

  // Read a settings file from a specific commit's tree as a model, an absent
  // file as `undefined` (so the merge can tell "absent on this side" from an
  // empty map). isomorphic-git throws NotFoundError when the path is not in the
  // tree.
  async function readModelAt(dir, oid, file) {
    try {
      const { blob } = await readBlob({ fs, dir, oid, filepath: file });
      return parse(blob);
    } catch (err) {
      if (err?.code === 'NotFoundError') return undefined;
      throw err;
    }
  }

  // Apply one change: set the register at `path` to `{ value, at }`, creating
  // (or replacing a non-map at) each parent map (§3, §4). A `value` of `null`
  // writes a tombstone (§5.3); unset and set-to-nothing are the same operation.
  function applyChange(root, path, value, when) {
    let node = root;
    for (let i = 0; i < path.length - 1; i += 1) {
      const key = path[i];
      const next = node[key];
      if (!next || typeof next !== 'object' || Array.isArray(next)) {
        node[key] = {};
      }
      node = node[key];
    }
    node[path[path.length - 1]] = { value, at: when };
  }

  // Write README.md and .gitattributes with their exact §2.2 bytes if they are
  // absent or differ, staging whatever it wrote. Returns whether anything was
  // written, so `sync` knows a fresh home book needs a commit even when there is
  // no merge to make. Does NOT commit — the caller folds the scaffold into the
  // commit it is already making (a merge, or a dedicated scaffold commit).
  async function ensureScaffold(dir) {
    let wrote = false;
    for (const [file, bytes] of [
      ['README.md', README_BYTES],
      ['.gitattributes', GITATTRIBUTES_BYTES],
    ]) {
      let current = null;
      try {
        current = await fs.promises.readFile(at(dir, file), 'utf8');
      } catch (err) {
        if (err?.code !== 'ENOENT') throw err;
      }
      if (current !== bytes) {
        await fs.promises.writeFile(at(dir, file), bytes);
        await gitAdd({ fs, dir, filepath: file });
        wrote = true;
      }
    }
    return wrote;
  }

  /**
   * Read a settings file's model from the working copy; an absent file is `{}`.
   */
  function read({ bookId, file }) {
    return readModel(at(git.bookDir(bookId), file));
  }

  /**
   * Apply register changes to one settings file and commit it automatically
   * (§3, §4; DIRECTION §3.2). Under one lock: read the file, set each change's
   * register to `{ value, at: instant(now) }` at its key path (creating parent
   * maps), write the file back in canonical form (§6), stage and commit THAT ONE
   * FILE (§2.1, home-book.md Decision 8). No push — offline-first; `sync` pushes
   * (home-book.md Decision 5). Returns the commit oid.
   */
  function set({ bookId, file, changes, author, now = Date.now() }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      const full = at(dir, file);
      const model = await readModel(full);
      const when = instant(now);
      for (const change of changes) {
        applyChange(model, change.path, change.value, when);
      }
      await fs.promises.writeFile(full, serialize(model));
      await gitAdd({ fs, dir, filepath: file });
      const identity = authorFrom(author, now);
      return gitCommit({
        fs,
        dir,
        // Content-free: names only the file touched, never a value (§3.3).
        message: `Update ${file}`,
        author: identity,
        committer: identity,
      });
    });
  }

  /**
   * Fetch the origin and, if it advanced beyond the local branch, merge each
   * settings file key by key (§5), write the merged tree in canonical form (§6),
   * commit the merge automatically with both parents (§1.1, §9), then push
   * (workflow 8 L41-47). A fresh home book is scaffolded with the §2.2 exact
   * bytes of README.md and .gitattributes.
   *
   * Offline-first (home-book.md Decision 5): a fetch or push that fails for want
   * of a network does not throw and does not roll back — the merge/scaffold
   * commit is kept and the result carries `pushed: false`, to be retried by the
   * sync engine (mirrors working-copy.js:141-152).
   *
   * @returns {Promise<{ commit: string | null, pushed: boolean }>} `commit` is
   *   the merge or scaffold commit this sync made, or `null` if it made none.
   */
  function sync({ bookId, author }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      const identity = authorFrom(author);

      // Scaffold the identity files for a fresh home book (§2.2). Staged now so
      // they ride in whatever commit this sync makes.
      const scaffolded = await ensureScaffold(dir);

      // Fetch the origin. A network failure is not fatal (offline-first): skip
      // the merge and fall through to the best-effort push, which will also fail
      // and report `pushed: false`.
      let fetched = true;
      try {
        await git.fetch({ dir });
      } catch {
        fetched = false;
      }

      let commitOid = null;
      if (fetched) {
        const localHead = await resolveRef({ fs, dir, ref: 'main' });
        let fetchedOid = null;
        try {
          fetchedOid = await resolveRef({ fs, dir, ref: 'refs/remotes/origin/main' });
        } catch {
          fetchedOid = null; // no origin tracking ref yet
        }

        // Merge only when the origin holds commits the local branch does not —
        // i.e. local is not already a descendant of the fetched tip. (Equal tips
        // need no merge either.)
        const needsMerge =
          fetchedOid &&
          fetchedOid !== localHead &&
          !(await isDescendent({ fs, dir, oid: localHead, ancestor: fetchedOid, depth: -1 }));

        if (needsMerge) {
          for (const file of SETTINGS_FILES) {
            const local = await readModelAt(dir, localHead, file);
            const remote = await readModelAt(dir, fetchedOid, file);
            if (local === undefined && remote === undefined) continue;
            const merged = mergeTrees(local ?? {}, remote ?? {});
            await fs.promises.writeFile(at(dir, file), serialize(merged));
            await gitAdd({ fs, dir, filepath: file });
          }
          commitOid = await gitCommit({
            fs,
            dir,
            // Content-free; the merge is the Worker's own (§1.1), committed
            // automatically (workflow 8 L41-47).
            message: 'Merge home book',
            author: identity,
            committer: identity,
            parent: [localHead, fetchedOid],
          });
        }
      }

      // A fresh home book that needed no merge still needs its scaffold
      // committed so README.md / .gitattributes become part of its history.
      if (scaffolded && commitOid === null) {
        commitOid = await gitCommit({
          fs,
          dir,
          message: 'Scaffold home book',
          author: identity,
          committer: identity,
        });
      }

      // Best-effort push: a failure (no network, or a ref the server would not
      // fast-forward) keeps the local commit; the sync engine retries (Decision
      // 5). The outcome carries whether it landed.
      let pushed = false;
      try {
        await git.push({ dir });
        pushed = true;
      } catch {
        pushed = false;
      }
      return { commit: commitOid, pushed };
    });
  }

  /**
   * The §2.3 device id: one UUID per installation, generated the first time the
   * app runs and kept in the `meta` object store outside the home book, never
   * changing. It is a BARE value, never a register (§2.3, §7) — it is only ever a
   * namespace key, so it must never enter a shared register.
   *
   * Persisted as a field on the existing singleton `meta` record (home-book.md
   * Decision 7) — no new store, no migration. Opens the `estante` database at the
   * schema the migration list defines (creating the `meta` store on a fresh
   * database), reads the id, and generates-and-persists one once if absent.
   *
   * `version` is the schema version the caller's session opened the database at
   * — passed by `logic.js` so this attaches at the version already on disk and
   * never triggers an upgrade a lower-version session (e.g. a test driving an
   * injected step list, or a running build mid-update) would block (`onblocked`).
   * It defaults to the production latest, the version a standalone caller's fresh
   * database is migrated to.
   *
   * @param {{ idb: IDBFactory, name: string, version?: number }} opts
   * @returns {Promise<string>}
   */
  async function ensureDeviceId({ idb, name, version }) {
    const db = await openMetaDb(idb, name, version);
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(META_STORE, 'readwrite');
        const store = tx.objectStore(META_STORE);
        const request = store.get(META_KEY);
        let deviceId;
        request.onsuccess = () => {
          const meta =
            request.result ?? {
              schemaVersion: db.version,
              protocolVersion: 1,
              createdAt: Date.now(),
            };
          if (meta.deviceId) {
            deviceId = meta.deviceId;
          } else {
            deviceId = globalThis.crypto.randomUUID();
            meta.deviceId = deviceId;
            store.put(meta, META_KEY);
          }
        };
        tx.oncomplete = () => resolve(deviceId);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  return { read, set, sync, ensureDeviceId };
}

// Open (and, on a fresh database, migrate up to) the `estante` database at the
// version the migration list defines, so the `meta` store `ensureDeviceId` reads
// exists. A separate connection from the one logic.js holds is fine — IndexedDB
// allows several, and an open at the current version runs no upgrade. `version`
// is the version the caller's session is already running at (logic.js passes the
// one it opened the database at); opening at that same version runs no upgrade,
// so this never blocks on a connection a lower-version session holds. It defaults
// to the production latest for a standalone caller that creates the database
// itself (then the migration list runs it up to that version). This mirrors
// logic.js's `openDatabase` without coupling to it.
function openMetaDb(idb, name, version = latestVersion(MIGRATIONS)) {
  return new Promise((resolve, reject) => {
    const request = idb.open(name, version);
    request.onupgradeneeded = (ev) => {
      const db = request.result;
      const tx = request.transaction;
      try {
        runMigrations(db, tx, ev.oldVersion, ev.newVersion, MIGRATIONS);
      } catch (err) {
        try {
          tx.abort();
        } catch {
          // Already aborting.
        }
        reject(err);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('home-book: meta database open blocked'));
  });
}
