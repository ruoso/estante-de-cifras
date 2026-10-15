// bring-in.js — the merge path an upload and a bring-in share, and the Worker
// engine behind workflow 11 §Following the original (sync.fork_follow).
//
// THE SHARED MERGE PATH (sync.fork_follow AC10; sync.upload Decision 4). "Bring
// them in" shows "the same preview an upload does" (workflow 11 line 47), so the
// song-by-song preview (`previewMerge`) and the cifra-aware merge into a book
// (`mergeInto`) live here, once, and both the upload (upload.js) and the bring-in
// below call them — parameterised by the *theirs* ref name (an upload's
// `refs/upload/<id>`, a bring-in's `refs/remotes/original/main`) and whether a
// fast-forward is allowed. There is no second merge implementation: the merge is
// `isomorphic-git`'s with the cifra merge driver, unsaved edits carried on top by
// the sync engine's `captureDirtyWork` / `reapplyDirtyWork`, and a collision left
// for the conflict session (workflow 9).
//
// THE BRING-IN. A fork remembers its original on the shelf (home-book-format
// §4.2, the `original` register). Bringing in is never automatic (workflow 11
// lines 42-44): a sync pass only counts (sync-engine.js, ORIGINAL). On request
// the Worker fetches the original by its link into `refs/remotes/original/main`
// — never touching the fork's `main`, working tree or remote — and previews; on
// confirmation it merges that ref into `main` as a merge commit carrying the
// user's note, pushes to the fork's own remote and moves `followedAt`. The
// original refusing the fetch (404: removed, deleted, a stranger; 403
// taken_down) ends following for good (`goneAt`); offline or a 5xx changes
// nothing. The fork's own sync phase is never touched here (Constraint 2).
//
// CANONICAL FORM (Constraint 7): the merge commit's songs are what the cifra
// merge driver writes; a marked text is never committed — a conflict halts to
// workflow 9. No song text, titles, notes, ids or links in logs: this module
// logs nothing. Framework-free, Worker-only ESM, no React.

import {
  resolveRef,
  readBlob,
  walk,
  TREE,
  deleteRef,
  findMergeBase,
  isDescendent,
  merge as igMerge,
  checkout,
  log as gitLog,
} from 'isomorphic-git';
import { parse, diff, merge as cifraMerge } from 'cifra-md';
import { authorFrom } from './author.js';
import { captureDirtyWork, reapplyDirtyWork } from './sync-engine.js';
import { isAccessRefused, takenDownReason } from './access-refused.js';

const SETLIST_SUFFIX = '.setlist.md';
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
const decoder = new TextDecoder();

// Where a bring-in fetches the original: a remote-tracking ref of its own, by
// URL, so the engine's `origin`-only layer is unaffected (Decision).
export const ORIGINAL_REF = 'refs/remotes/original/main';

// A wall-clock reading as a §3 instant (UTC ISO-8601, literal `Z`).
const instant = (ms) => new Date(ms).toISOString();

// The display name of a song/setlist from its path, when it cannot be read.
export function basename(path) {
  const name = path.split('/').pop() ?? path;
  return name.replace(/\.(setlist\.md|cifra\.md|md)$/i, '');
}

// A song's title from its text, falling back to the file name (never logged).
export function titleOf(path, text) {
  if (text == null) return basename(path);
  try {
    return (parse(text).title || '').trim() || basename(path);
  } catch {
    return basename(path);
  }
}

// An *added* / *changed* / *replace* preview row with its musical diff.
export function diffRow(path, status, beforeModel, afterModel) {
  const { changes, summary } = diff(beforeModel, afterModel);
  return { path, title: (afterModel?.title ?? '').trim() || basename(path), status, changes, summary };
}

// A blob's bytes at `oid` (a commit, with `filepath`) or null when absent.
export async function readBlobBytes(fs, dir, oid, filepath) {
  if (!oid) return null;
  try {
    const { blob } = await readBlob({ fs, dir, oid, filepath });
    return blob;
  } catch {
    return null;
  }
}

function isMergeConflict(err) {
  return (
    err instanceof Error &&
    (err.code === 'MergeConflictError' || err.code === 'MergeNotSupportedError' || err.conflict === true)
  );
}

/**
 * The merge path an upload and a bring-in share (sync.fork_follow AC10).
 *
 * @param {{ fs: object, git: { bookDir: Function, push: Function },
 *   locks: { withLock: Function }, mergeDriver: Function }} deps
 */
export function createMergePath({ fs, git, locks, mergeDriver }) {
  const EMPTY = parse('');

  async function oidAt(dir, ref) {
    try {
      return await resolveRef({ fs, dir, ref });
    } catch {
      return null;
    }
  }

  // The paths that differ across base / ours / theirs (mirrors conflicts.js).
  async function changedPaths(dir, baseOid, oursOid, theirsOid) {
    const rows = await walk({
      fs,
      dir,
      trees: [TREE({ ref: oursOid }), TREE({ ref: baseOid ?? EMPTY_TREE }), TREE({ ref: theirsOid })],
      map: async (filepath, [ours, base, theirs]) => {
        if (filepath === '.') return undefined;
        const types = await Promise.all([ours?.type(), base?.type(), theirs?.type()]);
        if (types.some((ty) => ty === 'tree')) return undefined;
        const [o, b, t] = await Promise.all([
          ours ? ours.oid() : null,
          base ? base.oid() : null,
          theirs ? theirs.oid() : null,
        ]);
        if (o === b && b === t) return undefined;
        return { path: filepath, b, o, t };
      },
    });
    return rows.filter(Boolean);
  }

  /**
   * Classify, song by song, what merging `theirsOid` into `oursOid` (over
   * `baseOid`) would do, with the format's own merge — writing nothing (workflow
   * 7 §The preview). Rows are `{ path, title, status, changes?, summary?, line? }`
   * with `status` 'added' | 'changed' | 'conflict' | 'unresolved'.
   * `incomingOnly` (the bring-in) skips a path *theirs* did not change — the
   * fork's own saves are not something the original brings in; the upload
   * leaves it unset, so its preview is unchanged.
   */
  async function previewMerge(dir, baseOid, oursOid, theirsOid, { incomingOnly = false } = {}) {
    const previews = [];
    for (const { path, o, b, t } of await changedPaths(dir, baseOid, oursOid, theirsOid)) {
      if (incomingOnly && t === b) continue;
      const setlist = path.endsWith(SETLIST_SUFFIX);
      const base = await readBlobBytes(fs, dir, baseOid, path);
      const ours = await readBlobBytes(fs, dir, oursOid, path);
      const theirs = await readBlobBytes(fs, dir, theirsOid, path);
      const outcome = cifraMerge(base, ours, theirs, { setlist });
      if (outcome.kind === 'result') {
        const after = parse(outcome.result);
        const before = ours != null ? parse(decoder.decode(ours)) : EMPTY;
        previews.push(diffRow(path, o === null ? 'added' : 'changed', before, after));
      } else if (outcome.kind === 'conflicts') {
        const first = outcome.conflicts[0];
        const txt = ours != null ? decoder.decode(ours) : theirs != null ? decoder.decode(theirs) : null;
        previews.push({
          path,
          title: titleOf(path, txt),
          status: first.kind === 'unresolved' ? 'unresolved' : 'conflict',
          line: first.line ?? null,
        });
      }
      // kind 'deleted' leaves the preview silent — nothing lands to show.
    }
    return previews;
  }

  // The merge itself, the caller holding the book's lock. `guard(dir)` may
  // refuse before anything is touched (the bring-in's stale check).
  async function mergeLocked(bookId, { theirsRef, identity, fastForward = true, message = 'Merge', guard }) {
    const dir = git.bookDir(bookId);
    if (guard) {
      const refusal = await guard(dir);
      if (refusal) return refusal;
    }
    const theirsOid = await oidAt(dir, theirsRef);
    const oursHead = await oidAt(dir, 'main');
    if (oursHead && theirsOid && (oursHead === theirsOid ||
      (await isDescendent({ fs, dir, oid: oursHead, ancestor: theirsOid, depth: -1 })))) {
      // The book already contains theirs: nothing to merge; drop the ref.
      try { await deleteRef({ fs, dir, ref: theirsRef }); } catch { /* gone */ }
      return { kind: 'merged', pushed: false };
    }
    const captured = await captureDirtyWork({ fs, dir, headOid: oursHead });
    let result;
    try {
      result = await igMerge({
        fs,
        dir,
        ours: 'main',
        theirs: theirsRef,
        author: identity,
        committer: identity,
        abortOnConflict: true,
        mergeDriver,
        message,
        fastForward,
      });
    } catch (err) {
      // Hand off to the existing conflict session (needs_you); keep the ref.
      if (isMergeConflict(err)) return { kind: 'needs_you' };
      throw err;
    }
    await checkout({ fs, dir, ref: 'main', force: true });
    if (captured.length && result.oid && result.oid !== oursHead) {
      await reapplyDirtyWork({ fs, dir, captured });
    }
    try { await deleteRef({ fs, dir, ref: theirsRef }); } catch { /* gone */ }
    await fs.flush?.();
    let pushed = false;
    try {
      await git.push({ dir });
      pushed = true;
    } catch {
      pushed = false; // offline — the merge waits, pushed at the next sync
    }
    return { kind: 'merged', pushed };
  }

  /**
   * Merge the ref `theirsRef` into the book's `main` by the SAME cifra-aware
   * merge sync uses, under the book's lock: a clean merge is committed (a
   * fast-forward only when `fastForward`), unsaved edits are carried on top,
   * still unsaved, the ref is dropped and the merge pushed best-effort. A
   * collision leaves `main` at *ours* with the ref retained for the conflict
   * session. Resolves `{ kind: 'merged', pushed }`, `{ kind: 'needs_you' }` or
   * whatever `guard` refused with.
   */
  function mergeInto(bookId, opts) {
    return locks.withLock(bookId, () => mergeLocked(bookId, opts));
  }

  return { previewMerge, mergeInto, oidAt };
}

/**
 * The bring-in engine (sync.fork_follow AC8-AC11).
 *
 * @param {{
 *   fs: object,
 *   git: { bookDir: Function, push: Function, fetchOriginal: Function },
 *   locks: { withLock: Function },
 *   mergeDriver: Function,
 *   readOriginal: (bookId: string) => Promise<{ bookId, title, link, followedAt, goneAt? } | null>,
 *   recordOriginal: (opts: { bookId: string, original: object }) => Promise<void>,
 *   emitOriginal?: (payload: { bookId: string, newSaves: number, gone: boolean }) => void,
 *   resolveAuthor?: () => Promise<{ id: string, name: string }>,
 *   now?: () => number,
 * }} deps
 */
export function createBringIn(deps) {
  const { fs, git, locks, readOriginal, recordOriginal } = deps;
  const emitOriginal = deps.emitOriginal ?? (() => {});
  const resolveAuthor = deps.resolveAuthor ?? (async () => ({ id: 'device', name: 'Me' }));
  const now = deps.now ?? (() => Date.now());
  const path = createMergePath(deps);

  // bookId -> the preview a BRING_IN may confirm: `{ followId, mainOid,
  // originalOid }`. In memory only: a reload makes every preview stale.
  const follows = new Map();
  // Books whose bring-in collided and was handed to the conflict session; their
  // incoming ref is the original's, not origin/main.
  const handedOff = new Set();

  // Saves (non-merge commits) on the original's head not on the fork's `main` —
  // the same count the service makes (workflow 11 line 46).
  async function countNewSaves(dir, mainOid, originalOid) {
    const inMain = new Set();
    if (mainOid) {
      for (const entry of await gitLog({ fs, dir, ref: mainOid })) inMain.add(entry.oid);
    }
    let n = 0;
    for (const entry of await gitLog({ fs, dir, ref: originalOid })) {
      if (inMain.has(entry.oid)) continue;
      if ((entry.commit.parent?.length ?? 0) < 2) n += 1;
    }
    return n;
  }

  // The original refused access for good: record `goneAt`, say so (workflow 11
  // lines 51-54). The fork's phase is not touched.
  async function markGone(bookId, original) {
    await recordOriginal({ bookId, original: { ...original, goneAt: instant(now()) } });
    emitOriginal({ bookId, newSaves: 0, gone: true });
  }

  /**
   * PREVIEW_BRING_IN: fetch the original into ORIGINAL_REF under the fork's lock
   * and classify what bringing it in would do, writing nothing to the fork.
   * Resolves the BRING_IN_PREVIEW payload.
   */
  async function preview({ bookId }) {
    const original = await readOriginal(bookId);
    if (!original) return { bookId, error: 'not_following' };
    if (original.goneAt) return { bookId, gone: true };
    const outcome = await locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      try {
        await git.fetchOriginal({ dir, url: original.link });
      } catch (err) {
        // A definite refusal from the ORIGINAL — 403 taken_down, or a 404
        // (removed, deleted, a stranger) — ends following; anything else is
        // unreachable and records nothing (AC11).
        if (takenDownReason(err) !== null || isAccessRefused(err)) return { gone: true };
        return { error: 'unreachable' };
      }
      const mainOid = await path.oidAt(dir, 'main');
      const originalOid = await path.oidAt(dir, ORIGINAL_REF);
      if (!originalOid) return { error: 'unreachable' };
      let baseOid = null;
      try {
        baseOid = (await findMergeBase({ fs, dir, oids: [mainOid, originalOid].filter(Boolean) }))?.[0] ?? null;
      } catch {
        baseOid = null;
      }
      const previews = await path.previewMerge(dir, baseOid, mainOid, originalOid, { incomingOnly: true });
      const newSaves = await countNewSaves(dir, mainOid, originalOid);
      await fs.flush?.();
      return { mainOid, originalOid, previews, newSaves };
    });
    if (outcome.gone) {
      follows.delete(bookId);
      await markGone(bookId, original);
      return { bookId, gone: true };
    }
    if (outcome.error) return { bookId, error: outcome.error };
    const followId = globalThis.crypto.randomUUID();
    follows.set(bookId, { followId, mainOid: outcome.mainOid, originalOid: outcome.originalOid });
    return {
      bookId,
      followId,
      original: { bookId: original.bookId, title: original.title },
      newSaves: outcome.newSaves,
      previews: outcome.previews,
    };
  }

  /**
   * BRING_IN: merge the previewed original into the fork's `main` as a merge
   * commit with `note` as its message and the user's identity, carry unsaved
   * edits on top, push to the fork's own remote and move `followedAt`.
   * Resolves the BRING_IN_DONE payload.
   */
  async function bringIn({ bookId, followId, note }) {
    const follow = follows.get(bookId);
    if (!follow || follow.followId !== followId) return { bookId, kind: 'stale' };
    const original = await readOriginal(bookId);
    if (!original || original.goneAt) {
      follows.delete(bookId);
      return { bookId, kind: 'stale' };
    }
    const identity = authorFrom(await resolveAuthor(), now());
    const message = typeof note === 'string' && note.trim() ? note : 'Bring in';
    const result = await path.mergeInto(bookId, {
      theirsRef: ORIGINAL_REF,
      identity,
      message,
      // The user's note is the commit message and history shows where the
      // original came in: never a fast-forward (Decision).
      fastForward: false,
      // A second preview, or a pass / save that moved `main` since: refuse.
      guard: async (dir) => {
        const current = follows.get(bookId);
        if (!current || current.followId !== followId) return { kind: 'stale' };
        if ((await path.oidAt(dir, 'main')) !== follow.mainOid) return { kind: 'stale' };
        if ((await path.oidAt(dir, ORIGINAL_REF)) !== follow.originalOid) return { kind: 'stale' };
        return null;
      },
    });
    if (result.kind === 'stale') return { bookId, kind: 'stale' };
    follows.delete(bookId);
    if (result.kind === 'needs_you') {
      handedOff.add(bookId);
      return { bookId, kind: 'needs_you' };
    }
    await recordOriginal({ bookId, original: { ...original, followedAt: instant(now()) } });
    // On Estante the fork now has them: the count clears (the next pass agrees).
    if (result.pushed) emitOriginal({ bookId, newSaves: 0, gone: false });
    return { bookId, kind: 'merged', pushed: result.pushed };
  }

  /** CANCEL_BRING_IN: drop the fetched ref; the preview is spent. */
  async function cancel({ bookId, followId }) {
    const follow = follows.get(bookId);
    if (followId && follow && follow.followId !== followId) return;
    follows.delete(bookId);
    if (handedOff.has(bookId)) return; // the conflict session owns the ref now
    await locks.withLock(bookId, async () => {
      try {
        await deleteRef({ fs, dir: git.bookDir(bookId), ref: ORIGINAL_REF });
      } catch {
        /* already gone */
      }
      await fs.flush?.();
    });
  }

  /**
   * The incoming ref for a book's conflict session when its bring-in collided —
   * ORIGINAL_REF while that ref is still retained — else null (the caller falls
   * back to the upload / sync ref).
   */
  async function incomingRefFor(bookId, dir) {
    if (!handedOff.has(bookId)) return null;
    if (await path.oidAt(dir, ORIGINAL_REF)) return ORIGINAL_REF;
    handedOff.delete(bookId); // settled or abandoned: the session dropped it
    return null;
  }

  return { preview, bringIn, cancel, incomingRefFor };
}
