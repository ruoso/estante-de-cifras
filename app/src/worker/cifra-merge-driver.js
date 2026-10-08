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
