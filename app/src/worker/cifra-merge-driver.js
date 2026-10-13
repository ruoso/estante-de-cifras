// cifra-merge-driver.js — cifra.md's song/setlist merge wired as
// isomorphic-git's `mergeDriver` callback (sync.engine). The `.gitattributes` a
// book is scaffolded with declare `*.cifra.md merge=cifra` /
// `*.setlist.md merge=cifra` (books.js:33); this is what answers to that
// attribute inside the Worker. cifra.md's `merge` was built for exactly this
// seam (cifra_js.merge §Deferred work); the engine is the only consumer.
//
// isomorphic-git calls the driver only for a file BOTH sides changed from the
// common base (the tree walk resolves add/delete/one-sided cases itself —
// index.js mergeBlobs), handing it `{ branches, contents, path }` where
// `contents` is `[base, ours, theirs]` as UTF-8 strings. It expects back
// `{ cleanMerge, mergedText }`:
//   - a clean cifra-aware merge (`Outcome.kind === 'result'`) is
//     `{ cleanMerge: true, mergedText: <canonical result> }` — the §8 writer
//     produced it, so it is canonical by construction (the engine never writes
//     non-canonical text; project rule).
//   - anything that does not merge cleanly (a conflict, or an outcome with no
//     single result text) is `{ cleanMerge: false }`. With the engine's
//     `abortOnConflict`, isomorphic-git then throws and leaves HEAD at ours, and
//     the engine halts the book for sync.conflicts (workflow 8 L47; Decision 3).
//     The marked/conflict Outcome is NOT persisted here — sync.conflicts
//     recomputes it from the byte-deterministic `merge` when the user engages.
//
// Pure and framework-free: it wraps one call to cifra.md `merge` and maps the
// Outcome. No git, no fs, no network, no logging (no song text; standing rule).
// Worker-only ESM, no React.

import { merge as cifraMerge } from 'cifra-md';

// A setlist is merged by the §10 setlist layer, a song by §8; the kind is the
// file's suffix, the same split the save path and books.js:33 use.
const SETLIST_SUFFIX = '.setlist.md';

/**
 * Build the merge-driver callback. `options.merge` injects the cifra.md merge
 * (defaults to the published `cifra-md` export) so a test can observe that the
 * driver is reached and routes setlists to the setlist layer.
 *
 * @param {{ merge?: typeof cifraMerge, onOutcome?: (info: { path: string, outcome: object }) => void }} [options]
 * @returns {(args: { branches: string[], contents: string[], path: string }) =>
 *   { cleanMerge: boolean, mergedText: string }}
 */
export function createCifraMergeDriver(options = {}) {
  const mergeImpl = options.merge ?? cifraMerge;
  const onOutcome = options.onOutcome ?? null;

  return function cifraMergeDriver({ contents, path }) {
    const [base, ours, theirs] = contents;
    const setlist = path.endsWith(SETLIST_SUFFIX);
    const outcome = mergeImpl(base, ours, theirs, { setlist });

    // Let a consumer (sync.conflicts, later) observe the per-file outcome
    // without this driver taking a side effect of its own. The engine passes no
    // observer on the clean path.
    if (onOutcome) onOutcome({ path, outcome });

    if (outcome.kind === 'result') {
      return { cleanMerge: true, mergedText: outcome.result };
    }
    // A conflict (or a deleted/empty outcome that has no single result text):
    // not clean. The engine's `abortOnConflict` turns this into a halt; the
    // `mergedText` is unused when `cleanMerge` is false, so keep ours verbatim.
    return { cleanMerge: false, mergedText: ours };
  };
}

/**
 * Re-apply an unsaved working-copy edit onto the merged committed content, the
 * base/theirs/working-text merge DIRECTION §3.1 describes (sync.unsaved). This
 * is the engine's SECOND, per-file use of cifra.md `merge`, run directly —
 * outside isomorphic-git's tree walk, which only ever sees committed blobs — so
 * the uncommitted edit can be rebased onto the pushed merge without ever being
 * committed. `base` is the pre-merge HEAD blob (the version the edit was made
 * from, `H0`), `ours` is the captured working text (`W`), `theirs` is the
 * merged committed content now checked out (`M`); labelling the user's text as
 * *ours* makes any conflict markers read `<<<<<<< ours` / `>>>>>>> theirs` from
 * the editor's point of view (Constraints). Each input is a UTF-8 string, raw
 * bytes, or `null` (absent), exactly as cifra.md `merge` accepts.
 *
 * Maps the `Outcome` to `{ text, conflict, marked, deleted }`:
 *   - `kind: 'result'` → the canonical merged text, no conflict.
 *   - `kind: 'conflicts'` with a `marked` text (a §8/§11 in-file conflict) →
 *     that conflict-marked text, flagged `conflict`/`marked`. Being marked it
 *     is never canonical and must never be saved or pushed (standing rule;
 *     sync.conflicts owns resolution).
 *   - `kind: 'conflicts'` with no `marked` text (a file-level conflict, e.g.
 *     one side deleted) → keep the user's working text, flagged `conflict`.
 *   - `kind: 'deleted'` → the file is gone (`text: null`, `deleted: true`).
 *
 * Pure: one call to cifra.md `merge` and a mapping. No git, no fs, no logging
 * (no song text; standing rule). `merge` is injectable for tests.
 *
 * @param {{ base: string|Uint8Array|null, ours: string|Uint8Array|null,
 *   theirs: string|Uint8Array|null, setlist?: boolean }} inputs
 * @param {typeof cifraMerge} [merge]
 * @returns {{ text: string|null, conflict: boolean, marked: boolean, deleted: boolean }}
 */
/**
 * Recompute the merge `Outcome` for one file, directly — the per-file call
 * `sync.conflicts` makes on engage to rebuild the byte-deterministic merge the
 * engine persisted nothing of (Decision 1; cifra_js.merge). `base`/`ours`/
 * `theirs` are the file's blobs (UTF-8 strings, raw bytes, or `null` when the
 * file is absent on that side), exactly as cifra.md `merge` accepts. Returns the
 * full `Outcome` (`{ result, deleted, conflicts, marked, kind }`, §11.12) so the
 * caller can write a clean `result`, drop a `deleted`, or materialise a
 * `conflicts` outcome's `marked` text and present its `conflicts`. Pure: one call
 * to cifra.md `merge`, no git, no fs, no logging (no song text; standing rule).
 *
 * @param {{ base: string|Uint8Array|null, ours: string|Uint8Array|null,
 *   theirs: string|Uint8Array|null, setlist?: boolean }} inputs
 * @param {typeof cifraMerge} [merge]
 * @returns {object}  the cifra.md merge `Outcome`
 */
export function recomputeMerge({ base, ours, theirs, setlist = false }, merge = cifraMerge) {
  return merge(base, ours, theirs, { setlist });
}

export function reapplyWorkingText({ base, ours, theirs, setlist = false }, merge = cifraMerge) {
  const outcome = merge(base, ours, theirs, { setlist });
  if (outcome.kind === 'result') {
    return { text: outcome.result, conflict: false, marked: false, deleted: false };
  }
  if (outcome.kind === 'deleted') {
    return { text: null, conflict: false, marked: false, deleted: true };
  }
  // A conflict: write the conflict-marked text when there is one, else keep the
  // user's working text verbatim (a file-level conflict carries no single
  // marked text). Either way the file stays unsaved and, being a conflict,
  // never canonical — never saved or pushed.
  const marked = outcome.marked !== null;
  const asString = (t) => (t == null ? null : typeof t === 'string' ? t : new TextDecoder().decode(t));
  return {
    text: marked ? outcome.marked : asString(ours),
    conflict: true,
    marked,
    deleted: false,
  };
}
