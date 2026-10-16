// sync-engine.js — the device-side sync engine (sync.engine). The self-driving
// loop that keeps the shelf in step with the service: on each pass it asks the
// service which books moved (one change-check request), fetches only those,
// merges incoming saves with the device's by the cifra-aware rules, makes the
// hidden two-parent merge commit and pushes it without asking, and — when the
// push loses a race — fetches, merges and pushes again, up to three times
// (workflow 8; DIRECTION §3.1, §3.3). It pushes saves made offline the moment a
// push can go through. The home book rides the same loop but through its own
// key-by-key JSON merge (home-book.js). Everything runs inside the Worker, under
// one Web Lock per book (DIRECTION §3.7; locks.js).
//
// This module is the CLEAN path and the loop that drives it. The branches each
// have their own leaf and `depends !engine`: merging under unsaved edits
// (sync.unsaved), the shelf states and *sync now* (sync.states), the conflict
// screens (sync.conflicts), losing access (sync.lost_access), a song open while
// it changes (sync.read_in_place). The engine emits the facts those render and
// halts cleanly where they take over.
//
// COMPOSITION (locks.md Decision 1): a songbook's fetch→merge→push, including
// its retries, runs inside ONE `withLock(bookId, …)` so a WRITE/SAVE and a sync
// never interleave on the same book. The home book's sync takes its own lock
// inside `home-book.js`, so the engine calls it OUTSIDE any lock (Web Locks are
// non-reentrant).
//
// OFFLINE-FIRST (DIRECTION §1 L29-31; working-copy.js:171-180): a failed change
// check, fetch or push never rolls back a commit and never surfaces an error to
// the user. The book keeps its unpushed work and the engine retries next pass.
//
// The per-book git operations are injectable (the defaults compose the git
// transport, isomorphic-git's local ops and the cifra merge driver) so the
// retry policy is unit-testable with fakes and the behavior level drives the
// real ones. No new dependency, no new IndexedDB store: sync status is held in
// memory and emitted (Constraints). Logs nothing — no song text, no book id, no
// head (standing rule). Framework-free, Worker-only ESM, no React.

import {
  merge as igMerge,
  resolveRef,
  isDescendent,
  statusMatrix,
  checkout,
  getConfig,
  log as gitLog,
  readBlob,
  walk,
  TREE,
} from 'isomorphic-git';
import { parse, diff } from 'cifra-md';
import { authorFrom } from './author.js';
import { reapplyWorkingText } from './cifra-merge-driver.js';
import { HOME_BOOK_ID } from './home-book.js';
import { isAccessRefused, takenDownReason, readerPushRefused } from './access-refused.js';

// A merge that does not merge cleanly (a cifra-aware conflict, or isomorphic-git
// refusing an unsupported merge). The engine halts the book and emits
// `needs_you`; sync.conflicts recomputes the Outcome when the user engages
// (Decision 3). It is never surfaced to `console`.
export class SyncConflictError extends Error {
  constructor(bookId) {
    super('sync: merge conflict');
    this.name = 'SyncConflictError';
    this.conflict = true;
    this.bookId = bookId;
  }
}

// A wall-clock reading as a §3 instant (UTC ISO-8601, literal `Z`), matching
// home-book.js's `instant`.
function instant(nowMs) {
  return new Date(nowMs).toISOString();
}

// Songs are `*.cifra.md` (working-copy.js:42; the reading view opens only these);
// the merge-landed fact names changed songs, not setlists/README/.gitattributes.
const SONG_SUFFIX = '.cifra.md';
// Setlists are `*.setlist.md` — the other file the cifra merge driver handles
// (cifra-merge-driver.js:32). An unsaved edit to either is re-applied under an
// incoming merge (sync.unsaved); other files are left to isomorphic-git.
const SETLIST_SUFFIX = '.setlist.md';
const isMergeable = (filepath) =>
  filepath.endsWith(SONG_SUFFIX) || filepath.endsWith(SETLIST_SUFFIX);

// The canonical empty-tree oid, the base a first-ever merge (no pre-merge local
// head) is diffed against so every song in the merged head reads as changed —
// the same constant history.js uses for a parentless commit.
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

// A push error that means someone else pushed first (a lost race): retry
// (workflow 8 L59-62). isomorphic-git signals it pre-flight as PushRejectedError
// or from the server's report-status as GitPushError. Anything else — a thrown
// `fetch` (offline), a surprise — is NOT a race: the engine stops and leaves the
// work waiting.
function isLostRace(err) {
  return err?.code === 'PushRejectedError' || err?.code === 'GitPushError';
}

// A merge that could not be auto-resolved. isomorphic-git throws
// MergeConflictError for an unresolved file and MergeNotSupportedError for a
// shape it cannot merge (e.g. criss-cross history); both halt the book here.
function isMergeConflict(err) {
  return (
    err instanceof SyncConflictError ||
    err?.conflict === true ||
    err?.code === 'MergeConflictError' ||
    err?.code === 'MergeNotSupportedError'
  );
}

// The origin-tracking head of a book's `main`, or null when it was never
// fetched/pushed (an empty or purely-local book). Standalone so account.sign_out's
// survey can reuse it to tell whether a book's content is on Estante without
// building a whole sync engine (Decision 2). `dir` is `git.bookDir(bookId)`.
export async function resolveOriginHead({ fs, dir }) {
  try {
    return await resolveRef({ fs, dir, ref: 'refs/remotes/origin/main' });
  } catch {
    return null; // never fetched/pushed yet
  }
}

// How many local commits are not yet on the origin — the "N saves waiting" count
// (workflow 8 L31). A best-effort first-parent-ish walk bounded to a sane depth.
// Standalone and injected as the sync engine's default below, and reused by
// account.sign_out's survey (the saves-not-pushed count). `dir` is
// `git.bookDir(bookId)`.
export async function countCommitsAhead({ fs, dir }) {
  const origin = await resolveOriginHead({ fs, dir });
  let entries;
  try {
    entries = await gitLog({ fs, dir, ref: 'main', depth: 64 });
  } catch {
    return 0;
  }
  let n = 0;
  for (const entry of entries) {
    if (entry.oid === origin) break;
    n += 1;
  }
  return n;
}

// Capture every unsaved mergeable file's working text `W` and its pre-merge
// HEAD blob `H0` (the version the edit was made from), BEFORE a committed merge
// checks out over the working tree (sync.unsaved; DIRECTION §3.1). Only
// songs/setlists — the files the cifra merge driver handles — are captured;
// other dirty files are left to isomorphic-git's own checkout. `W`/`H0` are
// null for a file absent on that side (a never-committed working file, or a
// working deletion). Standalone over `{ fs, dir, headOid }` so both the sync
// engine and an upload merge (sync.upload) reuse the one three-way, never a
// second copy. No song text is logged (standing rule).
export async function captureDirtyWork({ fs, dir, headOid }) {
  const rows = await statusMatrix({ fs, dir });
  const captured = [];
  for (const [filepath, head, workdir, stage] of rows) {
    const clean = (head === 1 && workdir === 1 && stage === 1) || (head === 0 && workdir === 0);
    if (clean || !isMergeable(filepath)) continue;
    let working = null;
    try {
      working = await fs.promises.readFile(`${dir}/${filepath}`, 'utf8');
    } catch {
      working = null; // the edit deleted the file from the working tree
    }
    let base = null;
    if (headOid) {
      try {
        const { blob } = await readBlob({ fs, dir, oid: headOid, filepath });
        base = new TextDecoder().decode(blob);
      } catch {
        base = null; // a never-committed file has no pre-merge HEAD blob
      }
    }
    captured.push({ path: filepath, working, base });
  }
  return captured;
}

// Re-apply the captured edits onto the merged committed content now checked out
// to the working tree (sync.unsaved, acceptance 2-4). Per file, `theirs` is the
// merged content `M` the checkout left; a file the merge did not touch
// (`M === H0`) is restored byte-for-byte from `W` — the edit is preserved
// verbatim, never re-canonicalised. A file the merge did touch is rebased by
// `cifraMerge(H0, W, M)`: a clean merge writes the result, a conflict writes the
// marked text (unsaved, never canonical — never pushed). All writes are
// uncommitted: HEAD stays the pushed merge commit, so the index derives the song
// still *unsaved*. Standalone over `{ fs, dir, captured }`, the twin of
// `captureDirtyWork` both the engine and sync.upload reuse.
export async function reapplyDirtyWork({ fs, dir, captured }) {
  for (const { path: filepath, working, base } of captured) {
    let theirs = null;
    try {
      theirs = await fs.promises.readFile(`${dir}/${filepath}`, 'utf8');
    } catch {
      theirs = null; // the incoming merge deleted the file
    }
    if (theirs === base) {
      // No incoming change to this file: the checkout clobbered the edit with
      // the (unchanged) committed content; restore the working text verbatim.
      if (working === null) {
        try {
          await fs.promises.unlink(`${dir}/${filepath}`);
        } catch {
          /* already gone */
        }
      } else {
        await fs.promises.writeFile(`${dir}/${filepath}`, working);
      }
      continue;
    }
    const setlist = filepath.endsWith(SETLIST_SUFFIX);
    const { text, deleted } = reapplyWorkingText({ base, ours: working, theirs, setlist });
    if (deleted || text === null) {
      try {
        await fs.promises.unlink(`${dir}/${filepath}`);
      } catch {
        /* already gone */
      }
    } else {
      await fs.promises.writeFile(`${dir}/${filepath}`, text);
    }
  }
}

/**
 * Build the sync engine. Required collaborators: `fs`/`git`/`locks` (the shared
 * Worker primitives), `changeCheck` (change-check-client), `mergeDriver` (the
 * cifra merge driver), `homeBook` (its own sync), `resolveAuthor` (the device
 * commit identity) and `emit` (posts a per-book SYNC fact). `emitMerged` posts
 * the per-file MERGED fact a clean songbook merge announces to an open reading
 * view (sync.read_in_place); absent, the engine computes and emits nothing.
 * `surfaceHome` re-surfaces the home-book-derived slices after a home sync (the
 * SYNC_HOME path). The per-book git ops (`fetchBook`/`pushBook`/`mergeBook`/`localAhead`/
 * `treeDirty`/`listBooks`/`syncHome`) default to real implementations and are
 * injectable for tests. `now` is injected for a pinned timestamp; `maxRetries`
 * is the lost-race retry budget (three — workflow 8 L59-62).
 *
 * @returns {{ pass: () => Promise<void> }}
 */
export function createSyncEngine(deps = {}) {
  const {
    fs,
    git,
    locks,
    changeCheck,
    mergeDriver,
    homeBook,
    resolveAuthor,
    emit,
    emitMerged = null,
    // Called with a book's id whenever a merge moved its head (songs added,
    // changed or deleted under it), so the caller can re-index it: a song that
    // arrives by sync is found by search at once, not on the next app open.
    onHeadMoved = null,
    surfaceHome = null,
    // A predicate: does this book have an in-progress merge the user is settling
    // (sync.conflicts)? When it does, the engine skips the book — it stays *needs
    // you* and takes nothing new until it is settled or abandoned (workflow 9
    // L38-45; Decision 4). Defaults to "never", so the clean engine is unchanged.
    hasInProgressMerge = () => false,
    // Following an original (sync.fork_follow, workflow 11 §Following the
    // original). `readOriginals` resolves the shelf's `original` registers as
    // `{ [forkId]: { bookId, title, link, followedAt, goneAt? } }`;
    // `recordOriginal({ bookId, original })` writes one back (the durable
    // `goneAt`); `emitOriginal` posts the ORIGINAL fact. Absent, the engine
    // follows nothing.
    readOriginals = null,
    recordOriginal = null,
    emitOriginal = null,
    // A push refused as a reader's (`403 forbidden` — books.fork Constraint 6):
    // called once with the book's id when the engine first classifies it
    // `cannot_save`, so the caller rewrites the shelf's `role` hint to `reader`
    // (Decision 8) and the next Save opens the fork sheet. Called outside the
    // book's lock. Absent, nothing is written.
    onCannotSave = null,
  } = deps;
  const now = deps.now ?? Date.now;
  const homeBookId = deps.homeBookId ?? HOME_BOOK_ID;
  const maxRetries = deps.maxRetries ?? 3;

  const bookDir = (bookId) => git.bookDir(bookId);

  async function headOf(bookId) {
    try {
      return await resolveRef({ fs, dir: bookDir(bookId), ref: 'main' });
    } catch {
      return null; // no commit yet (an empty book)
    }
  }

  function originHeadOf(bookId) {
    return resolveOriginHead({ fs, dir: bookDir(bookId) });
  }

  // Local `main` has commits the origin does not (the offline-save retry needs
  // this, with no network — a local ref comparison, Decision 4). True when there
  // is nothing tracked yet but there are local commits, so a first push is
  // attempted; false when the trees are equal or the local branch is behind.
  async function defaultLocalAhead(bookId) {
    const dir = bookDir(bookId);
    const local = await headOf(bookId);
    if (!local) return false;
    const origin = await originHeadOf(bookId);
    if (!origin) return true;
    if (origin === local) return false;
    return isDescendent({ fs, dir, oid: local, ancestor: origin, depth: -1 });
  }

  // How many local commits are not yet on the origin — the "N saves waiting"
  // count the shelf shows (workflow 8 L31). A best-effort first-parent-ish walk
  // bounded to a sane depth; the exact derivation is sync.states'.
  function defaultCountAhead(bookId) {
    return countCommitsAhead({ fs, dir: bookDir(bookId) });
  }

  // The working tree carries changes HEAD does not (an in-progress edit). The
  // dirty-tree guard defers the incoming merge over it (acceptance 8; Decision
  // "Dirty-tree guard"). statusMatrix rows are [filepath, HEAD, WORKDIR, STAGE];
  // a clean file is [1,1,1] (committed, present, unmodified) or absent [0,0,0].
  async function defaultTreeDirty(bookId) {
    const dir = bookDir(bookId);
    const rows = await statusMatrix({ fs, dir });
    return rows.some(
      ([, head, workdir, stage]) =>
        !(head === 1 && workdir === 1 && stage === 1) && !(head === 0 && workdir === 0),
    );
  }

  // Fetch the origin into the book's remote-tracking ref. The url is not passed:
  // the clone wrote `remote.origin.url` into the config and fetch reads it.
  const fetchBook = deps.fetchBook ?? ((bookId) => git.fetch({ dir: bookDir(bookId) }));
  // Send local `main` to the origin, fast-forward only (git.js never forces).
  const pushBook = deps.pushBook ?? ((bookId) => git.push({ dir: bookDir(bookId) }));
  const localAhead = deps.localAhead ?? defaultLocalAhead;
  const treeDirty = deps.treeDirty ?? defaultTreeDirty;

  // Merge the fetched origin into local `main` by the cifra-aware rules, make
  // the hidden two-parent merge commit (or fast-forward), and bring the working
  // copy to the merged head (workflow 8 L42-45; DIRECTION §3.1). Delegates per
  // file to cifra.md `merge` through the merge driver; `abortOnConflict` leaves
  // HEAD at ours on a conflict, which surfaces as SyncConflictError.
  async function defaultMergeBook(bookId, author) {
    const dir = bookDir(bookId);
    const local = await headOf(bookId);
    const origin = await originHeadOf(bookId);
    // Nothing fetched, or we already contain the origin: no merge to make.
    if (!origin || origin === local) return { merged: false };
    if (local && (await isDescendent({ fs, dir, oid: local, ancestor: origin, depth: -1 }))) {
      return { merged: false };
    }
    const identity = authorFrom(author, now());
    let result;
    try {
      result = await igMerge({
        fs,
        dir,
        ours: 'main',
        theirs: 'refs/remotes/origin/main',
        author: identity,
        committer: identity,
        abortOnConflict: true,
        mergeDriver,
        // Content-free: history does not list the merge (workflow 6), and the
        // message never names a song (standing rule).
        message: 'Merge',
        fastForward: true,
      });
    } catch (err) {
      if (isMergeConflict(err)) throw new SyncConflictError(bookId);
      throw err;
    }
    // isomorphic-git updates `main` and the index but not the working tree on the
    // clean path; bring the working copy to the new head so the editor and the
    // index read the merged bytes. Safe: the engine merges only a clean tree (the
    // dirty-tree guard defers otherwise), so force overwrites nothing unsaved.
    await checkout({ fs, dir, ref: 'main', force: true });
    // `before`/`after` let the caller announce the landed merge per changed song
    // (sync.read_in_place, acceptance 1): the pre-merge local head and the new
    // merged head (the merge commit, or theirs on a fast-forward).
    return {
      merged: !!result.mergeCommit,
      fastForward: !!result.fastForward,
      before: local,
      after: result.oid,
    };
  }

  const mergeBook = deps.mergeBook ?? defaultMergeBook;

  // The `*.cifra.md` songs whose bytes differ between two commits' trees — a
  // tree walk comparing blob oids, mirroring history.js's `changedFiles`
  // (recurse into directories, report blobs). A song absent in `after` (a
  // deletion) has no incoming version to show in place, so it is skipped.
  async function changedSongPaths(dir, before, after) {
    const base = before ?? EMPTY_TREE;
    const rows = await walk({
      fs,
      dir,
      trees: [TREE({ ref: after }), TREE({ ref: base })],
      map: async (filepath, [current, previous]) => {
        if (filepath === '.') return undefined;
        const [currentType, previousType] = await Promise.all([
          current && current.type(),
          previous && previous.type(),
        ]);
        if (currentType === 'tree' || previousType === 'tree') return undefined; // recurse
        if (!filepath.endsWith(SONG_SUFFIX)) return undefined;
        if (!current) return undefined; // deleted incoming: nothing to re-surface
        const [newOid, oldOid] = await Promise.all([
          current.oid(),
          previous ? previous.oid() : null,
        ]);
        return newOid === oldOid ? undefined : filepath;
      },
    });
    return rows.filter(Boolean);
  }

  // Who made the change the reader is about to see, for one changed song: the
  // newest NON-merge commit touching the path reachable from the merged head but
  // NOT from the pre-merge local head (Decision 5) — the incoming save. The merge
  // commit itself is skipped: it touches the path (the cifra-merged blob differs
  // from either side) but the engine authored it under the device identity, so
  // its author is "Me", not the person who made the change (Decision 5 rejects
  // it). Returns the incoming commit's author display name and oid, or null.
  async function incomingCommitFor(dir, filepath, before, after) {
    let entries;
    try {
      entries = await gitLog({ fs, dir, ref: after, filepath });
    } catch {
      return null;
    }
    for (const entry of entries) {
      if ((entry.commit.parent?.length ?? 0) >= 2) continue; // the merge commit
      const oid = entry.oid;
      const reachableFromBefore =
        !!before &&
        (oid === before ||
          (await isDescendent({ fs, dir, oid: before, ancestor: oid, depth: -1 })));
      if (reachableFromBefore) continue;
      return { commit: oid, author: entry.commit.author.name };
    }
    return null;
  }

  // The musical summary of what came in for one changed song (sync.in_place_notices,
  // W08#3 L103-105): `diff(parse(blob at before), parse(blob at after)).summary`,
  // the call save-preview.js and bring-in.js make. A song new in `after` diffs
  // against an empty parse; a blob read or parse fault yields '' — the event still
  // goes out (offline-first). Never logged.
  async function incomingSummaryFor(dir, filepath, before, after) {
    const modelAt = async (oid) => {
      if (!oid) return parse('');
      try {
        const { blob } = await readBlob({ fs, dir, oid, filepath });
        return parse(new TextDecoder().decode(blob));
      } catch (err) {
        if (err?.code === 'NotFoundError') return parse('');
        throw err;
      }
    };
    try {
      const [from, to] = [await modelAt(before), await modelAt(after)];
      return diff(from, to).summary ?? '';
    } catch {
      return '';
    }
  }

  // Announce a clean, landed merge to the open reading view, per changed song
  // (sync.read_in_place, acceptance 1; DIRECTION §3.7 L423-424). Songbooks only
  // (the caller is `syncSongbook`); never when the merge changed nothing. A tree
  // read fault never breaks the pass (offline-first) — it simply emits nothing.
  async function announceMerge(bookId, before, after) {
    if (!after || before === after) return;
    if (onHeadMoved) {
      try {
        await onHeadMoved(bookId);
      } catch {
        // Re-indexing is best effort; a fault never breaks the pass.
      }
    }
    if (!emitMerged) return;
    const dir = bookDir(bookId);
    let paths;
    try {
      paths = await changedSongPaths(dir, before, after);
    } catch {
      return;
    }
    const changed = [];
    for (const path of paths) {
      const incoming = await incomingCommitFor(dir, path, before, after);
      if (!incoming) continue;
      const summary = await incomingSummaryFor(dir, path, before, after);
      changed.push({ path, author: incoming.author, commit: incoming.commit, summary });
    }
    if (changed.length) emitMerged({ bookId, changed });
  }

  const countAhead = deps.countAhead ?? defaultCountAhead;
  const syncHome =
    deps.syncHome ?? ((author) => homeBook.sync({ bookId: homeBookId, author }));

  // Every hosted book on the device with its local head (null when empty). A
  // local-only book (no `remote.origin.url`) is never synced — offline-first, no
  // book without an account (Constraints). The home book is flagged so the pass
  // routes it to its own merge.
  async function defaultListBooks() {
    let ids;
    try {
      ids = await fs.promises.readdir('/books');
    } catch (err) {
      if (err?.code === 'ENOENT') return [];
      throw err;
    }
    const out = [];
    for (const bookId of ids) {
      let url = null;
      try {
        url = await getConfig({ fs, dir: bookDir(bookId), path: 'remote.origin.url' });
      } catch {
        url = null;
      }
      if (!url) continue;
      const home = bookId === homeBookId;
      const entry = { bookId, head: await headOf(bookId), hosted: true, home };
      // The home book's directory is the reserved `home`, but the service knows
      // it by its own id, kept beside the remote as `remote.origin.estanteid`
      // when the device attached it (account.new_device Decision 2). The change
      // check names it by that id (service/home_book.md, "send that id in the
      // change check"); the pass maps the answer back.
      if (home) {
        try {
          const serviceId = await getConfig({ fs, dir: bookDir(bookId), path: 'remote.origin.estanteid' });
          if (typeof serviceId === 'string' && serviceId) entry.checkId = serviceId;
        } catch {
          /* not attached by account.new_device: named by its directory */
        }
      }
      out.push(entry);
    }
    return out;
  }

  const listBooks = deps.listBooks ?? defaultListBooks;

  // The instant each book was last reported `in_step`, held in memory only — no
  // status table (engine.md L378-381; Constraints). `offline` and `saves_waiting`
  // carry it as `lastInStep` so the shelf can say "offline since …" (sync.states,
  // workflow 8 L32); it is null until the book reaches `in_step` this session, so
  // a cold open while offline reads plain *offline* and the next reachable pass
  // restores the time (sync.states Decision "lastInStep completed in the Worker").
  const lastInStep = new Map();

  // Set when the current pass leaves a book `saves_waiting` (work that could not
  // go up). With an unreachable change-check it makes the pass ask the scheduler
  // for a retry soon, so waiting saves go up once the network is back even when
  // no `online` event ever reaches the page (a cold open made offline).
  let passLeftWaiting = false;

  // The books whose push the service refused as a reader's this session (books.fork
  // Constraint 6): their pushes are not retried — a reader's push can never
  // succeed — while their fetches go on (a reader can still read). In memory
  // only, like `gone`: a reload re-derives it from the next push (sync.lost_access's
  // no-durable-state decision). Unpushed commits are kept.
  const cannotSave = new Set();

  function emitFact(bookId, phase, extra = {}) {
    const at = instant(now());
    if (phase === 'in_step') lastInStep.set(bookId, at);
    if (phase === 'saves_waiting') passLeftWaiting = true;
    const fact = { bookId, phase, at, ...extra };
    if (
      (phase === 'offline' || phase === 'saves_waiting') &&
      fact.lastInStep === undefined
    ) {
      fact.lastInStep = lastInStep.get(bookId) ?? null;
    }
    emit(fact);
  }

  // Push local-ahead work, retrying a lost race fetch→merge→push up to
  // `maxRetries` times, then leaving the book `syncing` for the next pass
  // (acceptance 4; workflow 8 L59-62; DIRECTION §3.3:203). Runs inside the book
  // lock the caller holds. A conflict surfacing on a retry halts the book.
  async function pushWithRetry(bookId, author, deferred) {
    // `deferred` is false on the way in now (sync.unsaved merges under an edit
    // rather than deferring). It only becomes true below, when a lost-race retry
    // finds the tree dirty and declines to re-merge over the re-applied edit this
    // pass: the book then reads `syncing` and a later pass re-merges it.
    const settle = () =>
      deferred
        ? emitFact(bookId, 'syncing', { savesWaiting: 0 })
        : emitFact(bookId, 'in_step');

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (attempt > 0) {
        // A lost race: bring in the winner and merge again before pushing.
        try {
          await fetchBook(bookId);
        } catch (err) {
          // A `403 taken_down` means the service removed the book for a copyright
          // notice mid-retry (books.notice_surface): halt it `taken_down` carrying
          // the reason. Checked BEFORE isAccessRefused — a taken-down book is still
          // a member, a distinct halt from lost access (workflow 10 §A copyright
          // notice; Decision 2). The unpushed work is kept, as on the `gone` path.
          const reason = takenDownReason(err);
          if (reason !== null) {
            emitFact(bookId, 'taken_down', { reason });
            return;
          }
          // A definite 404 means the device lost access mid-retry: halt the book
          // the same way the change-check `gone` does, keeping the unpushed work
          // (sync.lost_access; workflow 8 L65-69).
          if (isAccessRefused(err)) {
            emitFact(bookId, 'gone');
            return;
          }
          emitFact(bookId, 'saves_waiting', { savesWaiting: await countAhead(bookId) });
          return;
        }
        if (!(await treeDirty(bookId))) {
          let result;
          try {
            result = await mergeBook(bookId, author);
          } catch (err) {
            if (isMergeConflict(err)) {
              emitFact(bookId, 'needs_you');
              return;
            }
            throw err;
          }
          // The re-merge after a lost race can also bring in a changed song.
          await announceMerge(bookId, result?.before, result?.after);
        } else {
          deferred = true; // still dirty on a retry: the merge stays deferred
        }
      }
      if (!(await localAhead(bookId))) {
        // Nothing (more) to push — a fast-forward merge left us level, or there
        // was no local-ahead work.
        settle();
        return;
      }
      if (cannotSave.has(bookId)) {
        // Already refused as a reader's this session: not pushed again. The
        // saves stay waiting for the fork (workflow 10 L83-85).
        emitFact(bookId, 'cannot_save', { savesWaiting: await countAhead(bookId) });
        return;
      }
      try {
        await pushBook(bookId);
        settle();
        return;
      } catch (err) {
        if (isLostRace(err)) continue;
        // A `403 taken_down` means the service removed the book for a copyright
        // notice (books.notice_surface): halt it `taken_down` with the reason,
        // keeping the unpushed commit. Checked BEFORE isAccessRefused (a 404) and
        // BEFORE the reader-push fall-through — a reader's plain 403 carries no
        // taken-down body, so `takenDownReason` is null and it still lands on
        // `saves_waiting` (workflow 10 §A copyright notice; Decision 2).
        const reason = takenDownReason(err);
        if (reason !== null) {
          emitFact(bookId, 'taken_down', { reason });
          return;
        }
        // A definite 404 means the service refused the push because the device is
        // no longer a member (git.go:208,217): lost access. Mark the book `gone`
        // and stop — the unpushed commit is kept, nothing is rolled back
        // (sync.lost_access; workflow 8 L65-69; Constraints 2-3). A 403 (a reader,
        // still a member) is NOT lost access — it falls through to `saves_waiting`.
        if (isAccessRefused(err)) {
          emitFact(bookId, 'gone');
          return;
        }
        // A `403 forbidden` is the service refusing a READER's push
        // (git.go:276): an editor lowered to reader. Permanent, unlike offline:
        // the book reads `cannot_save` carrying its waiting saves, is not pushed
        // again this session, and keeps its commits for the fork (books.fork
        // Constraint 6; workflow 10 L83-85). Checked after taken_down and 404.
        if (readerPushRefused(err)) {
          cannotSave.add(bookId);
          emitFact(bookId, 'cannot_save', { savesWaiting: await countAhead(bookId) });
          return 'refused_reader';
        }
        // Offline, or the service unreachable: the local commits wait (workflow
        // 8 L31). The commit is kept; next pass retries.
        emitFact(bookId, 'saves_waiting', { savesWaiting: await countAhead(bookId) });
        return;
      }
    }
    // The race outlasted the retries: leave it syncing for the next pass.
    emitFact(bookId, 'syncing', { savesWaiting: await countAhead(bookId) });
  }

  async function syncSongbook(book, news, reachable) {
    const { bookId } = book;
    if (hasInProgressMerge(bookId)) {
      // The user has engaged this book's merge (sync.conflicts): it is paused and
      // takes nothing new until settled or abandoned. Keep it reading *needs you*
      // and do no fetch/merge/push this pass (Decision 4).
      emitFact(bookId, 'needs_you');
      return;
    }
    const change = news?.get(bookId);
    if (change?.status === 'gone') {
      // The change-check answers `gone` with no reason for BOTH a book the device
      // was removed from AND a book the service took down for a copyright notice:
      // `accessibleBooks` excludes a taken-down book alongside non-members
      // (service/internal/server/shelf.go:189-199), and the reason is book-scoped,
      // carried only on the git refusal (service.admin). This branch short-circuits
      // before any git request, so a taken-down book with no local changes would
      // never meet the 403 and its reason would never surface. So probe git once to
      // disambiguate (books.notice_surface Decision 1): a `403 taken_down` yields a
      // reason → halt `taken_down` with it; a 404 (or any other outcome) is plain
      // lost access → `gone`. Either way the working copy and any unpushed work are
      // kept, exactly as the `gone` path does (Constraint 7).
      try {
        await fetchBook(bookId);
      } catch (err) {
        const reason = takenDownReason(err);
        if (reason !== null) {
          emitFact(bookId, 'taken_down', { reason });
          return;
        }
      }
      // Losing access: the book stops syncing (workflow 8 L65-69); the fork /
      // download offer is sync.lost_access.
      emitFact(bookId, 'gone');
      return;
    }
    const changed = change?.status === 'changed';
    const ahead = await localAhead(bookId);
    if (!changed && !ahead) {
      // Nothing moved and nothing waiting. If we reached the service it is in
      // step; if we did not, it is simply offline this pass.
      emitFact(bookId, reachable ? 'in_step' : 'offline');
      return;
    }
    if (!changed && cannotSave.has(bookId)) {
      // Refused as a reader's earlier this session and nothing incoming: say so
      // again without a push (books.fork Constraint 6).
      emitFact(bookId, 'cannot_save', { savesWaiting: await countAhead(bookId) });
      return;
    }

    emitFact(bookId, 'syncing');
    const author = await resolveAuthor();

    const outcome = await locks.withLock(bookId, async () => {
      // The incoming merge is no longer deferred over an unsaved edit — it is
      // merged under it (sync.unsaved supersedes the dirty-tree guard). A book
      // only reads `syncing` now when a lost race on a dirty retry cannot finish
      // this pass (pushWithRetry sets its own `deferred`).
      const deferred = false;
      if (changed) {
        let fetched = false;
        try {
          await fetchBook(bookId);
          fetched = true;
        } catch (err) {
          // A `403 taken_down` on the fetch is the service removing the book for a
          // copyright notice mid-pass (books.notice_surface): halt it `taken_down`
          // with the reason, work untouched. Checked BEFORE isAccessRefused — a
          // distinct halt from lost access (workflow 10 §A copyright notice).
          const reason = takenDownReason(err);
          if (reason !== null) {
            emitFact(bookId, 'taken_down', { reason });
            return;
          }
          // A definite 404 on the fetch is lost access (git.go:208,217): halt the
          // book `gone` like the change-check does, keeping its work untouched
          // (sync.lost_access; workflow 8 L65-69). Any other fetch error is
          // offline — fall through to the best-effort push, retried next pass.
          if (isAccessRefused(err)) {
            emitFact(bookId, 'gone');
            return;
          }
          fetched = false; // offline; fall through to the best-effort push
        }
        if (fetched) {
          // Merge the incoming version in — and, when the working tree carries
          // unsaved edits, merge them UNDER it (sync.unsaved; DIRECTION §3.1).
          // Capture the edits first: the committed merge's force checkout brings
          // the working tree to the merged committed content, clobbering them.
          // Only a dirty tree needs the capture (the injectable guard the engine
          // shipped); a clean book takes the plain committed-merge path.
          const dirty = await treeDirty(bookId);
          const captured = dirty
            ? await captureDirtyWork({ fs, dir: bookDir(bookId), headOid: await headOf(bookId) })
            : [];
          let result;
          try {
            result = await mergeBook(bookId, author);
          } catch (err) {
            if (isMergeConflict(err)) {
              emitFact(bookId, 'needs_you');
              return;
            }
            throw err;
          }
          // The committed merge moved HEAD: re-apply the captured working edits
          // onto the merged content (base = pre-merge HEAD blob, ours = working
          // text, theirs = merged content), uncommitted and unpushed. Only when
          // the merge actually landed — otherwise the working tree is untouched
          // and the edits already stand (acceptance 2-4).
          if (captured.length && result?.after && result.after !== result.before) {
            await reapplyDirtyWork({ fs, dir: bookDir(bookId), captured });
          }
          // A merge landed (commit or fast-forward): name the songs that moved
          // for an open reading/editor view — the same fact for a re-merged
          // song whose working text was folded under (sync.read_in_place and the
          // deferred editor view; acceptance 5).
          await announceMerge(bookId, result?.before, result?.after);
        }
      }
      return pushWithRetry(bookId, author, deferred);
    });
    // First refused as a reader's: rewrite the shelf's `role` hint (Decision 8),
    // outside the book's lock — the home book takes its own.
    if (outcome === 'refused_reader' && onCannotSave) {
      try {
        await onCannotSave(bookId);
      } catch {
        /* a hint; the next refusal writes it again */
      }
    }
  }

  async function syncHomeBook(book, news, reachable) {
    const { bookId } = book;
    const change = news?.get(bookId);
    if (change?.status === 'gone') {
      emitFact(bookId, 'gone');
      return;
    }
    const changed = change?.status === 'changed';
    const ahead = await localAhead(bookId);
    // Gate the home sync: run it only when it moved or has local-ahead work, so
    // a pass makes no redundant home fetch when nothing is pending (Decision 4).
    if (!changed && !ahead) {
      emitFact(bookId, reachable ? 'in_step' : 'offline');
      return;
    }
    emitFact(bookId, 'syncing');
    const author = await resolveAuthor();
    // home-book.js `sync` runs fetch → key-by-key JSON merge → commit → push
    // under its own lock, offline-tolerant; the home book never reaches a
    // conflict (workflow 8 L72-76; DIRECTION §3.2).
    const { pushed } = await syncHome(author);
    // Re-surface the home-book-derived slices after its own merge (the SYNC_HOME
    // path re-emits PREFERENCES / SHELF / INSTRUMENTS).
    if (surfaceHome) await surfaceHome();
    if (pushed || !(await localAhead(bookId))) {
      emitFact(bookId, 'in_step');
    } else {
      emitFact(bookId, 'saves_waiting', { savesWaiting: await countAhead(bookId) });
    }
  }

  // Learn what each followed fork's original did, from the pass's one change
  // check (DIRECTION §3.3: no per-fork request, no fetch of the original —
  // bringing in is never automatic, workflow 11 lines 42-44). For every shelf
  // book whose `original` register is present and not gone, emit ORIGINAL with
  // the count (0 when the change check said nothing, so a count clears after a
  // bring-in). `originalGone` is final (sync.fork_follow Decision): `goneAt` is
  // written to the register — durable, synced to the account's other devices —
  // and from then on the fork's original is no longer consulted. None of it
  // touches the fork's own SYNC phase (Constraint 2).
  async function followOriginals(news) {
    if (!readOriginals || !emitOriginal) return;
    const originals = (await readOriginals()) ?? {};
    for (const [bookId, original] of Object.entries(originals)) {
      if (!original || original.goneAt) continue;
      const change = news.get(bookId);
      if (change?.originalGone === true) {
        if (recordOriginal) {
          await recordOriginal({ bookId, original: { ...original, goneAt: instant(now()) } });
        }
        emitOriginal({ bookId, newSaves: 0, gone: true });
        continue;
      }
      const n = change?.originalNewSaves;
      emitOriginal({ bookId, newSaves: Number.isInteger(n) && n > 0 ? n : 0, gone: false });
    }
  }

  /**
   * Run one sync pass: one change-check for every hosted book, then per book —
   * the home book to its own merge, a songbook to the cifra-aware fetch→merge→
   * push. A book's failure never stops the pass or surfaces to the user.
   *
   * Resolves `{ retry }`: true when the service could not be reached and a book
   * was left with saves waiting — the scheduler then retries on a short backoff
   * rather than waiting for an `online` event or the five-minute heartbeat.
   */
  async function pass() {
    let books;
    try {
      books = await listBooks();
    } catch {
      return { retry: false }; // cannot even enumerate (a storage fault)
    }
    if (!books.length) return { retry: false };
    passLeftWaiting = false;

    // One change-check for the whole shelf (workflow 8 L21-24). Offline-first: a
    // failure is "no news" — the engine still pushes local-ahead books, which
    // needs no network answer (Decision 4).
    let news = null;
    try {
      news = await changeCheck.check(
        books.map(({ bookId, head, checkId }) => ({ bookId: checkId ?? bookId, head })),
      );
    } catch {
      news = null;
    }
    // A book named in the check by another id (the home book, by its service
    // id) reads its answer back under its own id.
    if (news) {
      for (const { bookId, checkId } of books) {
        if (!checkId || checkId === bookId) continue;
        const change = news.get(checkId);
        news.delete(checkId);
        if (change) news.set(bookId, { ...change, bookId });
      }
    }
    const reachable = news !== null;

    // The forks' originals, counted from the same answer. Unreachable: nothing
    // is emitted, the last facts stand. Before the books so a `goneAt` written
    // here rides this pass's home-book sync. A failure here is swallowed like a
    // book's (offline-first; never logged).
    if (reachable) {
      try {
        await followOriginals(news);
      } catch {
        /* the next pass counts again */
      }
    }

    for (const book of books) {
      try {
        if (book.home) await syncHomeBook(book, news, reachable);
        else await syncSongbook(book, news, reachable);
      } catch {
        // Offline-first: one book's failure is swallowed; its work is kept and
        // the next pass retries. Never logged, never surfaced.
      }
    }
    return { retry: !reachable && passLeftWaiting };
  }

  return { pass };
}
