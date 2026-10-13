// history.js — the Worker's reader of a book's git history (storage.history).
// DIRECTION §4 L441-450: the file view "shows the book as git sees it … the
// book's log with the files each commit touched", and "Song history, in the
// song's own view, is the same log seen through the format … Restoring an old
// version writes it into the working copy, to be saved as a new one; history is
// never rewritten." Workflows 6 (the song's history) and 14 (the file view)
// decide both to their screens; this module is the DATA under those two screens,
// exposed over the store protocol so the main thread shows it without touching
// IndexedDB (DIRECTION §3.7 L407-414).
//
// It is the sibling of working-copy.js and home-book.js, composing the same
// primitives the same way: the git transport (git.js, for `bookDir` only — this
// module makes no network call), the per-book lock (locks.js) and the filesystem
// (fs.js). The LOCAL git reads — `log`, `readBlob`, `walk`/`TREE` — live here,
// called straight on isomorphic-git over the shared `fs`, while git.js stays the
// narrow network transport (working-copy.js Decision 2; home-book.md Decision 3;
// history.md Decision 2 and the §Constraints "git.js stays the network
// transport"). Nothing is added to git.js.
//
// COMPOSITION RULE (locks.md Decision 1): one lock per logical operation. Every
// read — even a pure one — runs inside ONE `withLock`, because a read spans many
// IndexedDB transactions and must present a consistent repository against a
// concurrent save in another tab (DIRECTION §3 L118-119; history.md Decision 5).
// Restore reads the historical blob AND writes the working tree inside the one
// `withLock`; it must NOT delegate to `workingCopy.write`, which would take the
// non-reentrant book lock again and deadlock (history.md Decision 4).
//
// RESTORE DOES NOT COMMIT, CANONICALISE OR PUSH (workflow 6 L53-62; workflow 14
// L76-82; history.md Decision 4): it writes the chosen version's bytes verbatim
// into the working tree at the song's CURRENT path, uncommitted, to be saved as a
// new version later (songs.save_sheet). Checkout-by-ref is rejected: it restores
// the file at its path IN THAT COMMIT, which for a renamed song differs from the
// current path; reading the historical blob and writing it to the current path
// is rename-correct.
//
// No song text, blobs, commit messages or secrets in logs (standing rule): this
// module logs nothing. Errors surface to the caller (logic.js), which turns them
// into a coded ERROR event, never to `console`.
//
// Framework-free, Worker-only: plain ESM, no React; never imported by the main
// thread (DIRECTION §3.7 L407-414).

import {
  log as gitLog,
  readBlob,
  walk,
  TREE,
} from 'isomorphic-git';
import { restoreBlock } from './restore-block.js';

// Short hashes are all of git's machinery that shows (workflow 14 L172-173): a
// seven-character prefix, git's own default abbreviation.
const SHORT = 7;

// The canonical empty-tree oid, the base a root commit (no parent) is diffed
// against so its files read as `added` — the same constant isomorphic-git's own
// `getChanges` uses for a parentless commit.
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

// Versions read back are UTF-8 text returned verbatim, never re-canonicalised
// (workflow 14 L76-82).
const decoder = new TextDecoder('utf-8');

/**
 * Classify a merge's blob for one song against its parents' blobs for that path
 * (history.md Decision 2). PURE and I/O-free: it compares oids only, so it is
 * robust to canonical reserialisation (it compares whole canonical blobs, not
 * lines) and needs no merge engine (this task does not depend on cifra_js.merge).
 *
 * - `'absent'`  — the song is not in the merge (no blob): it has no place in the
 *   song's log.
 * - `'joined'`  — the merge blob equals SOME parent's blob: the song came
 *   verbatim from one side, so the saves the merge joins are already listed as
 *   the saves they came from (workflow 6 L24-31). Omit it.
 * - `'resolution'` — the merge blob differs from EVERY parent: a version no
 *   single save produced, "a change nobody saved in the ordinary way" (workflow 6
 *   L31-32; workflow 9 L69-70). Keep it, flagged *merged, with your resolution*.
 *
 * @param {string|null} mergeBlobOid the song's blob oid at the merge commit
 * @param {Array<string|null>} parentBlobOids the song's blob oid at each parent
 * @returns {'absent'|'joined'|'resolution'}
 */
export function classifyMergeForPath(mergeBlobOid, parentBlobOids) {
  if (!mergeBlobOid) return 'absent';
  if (parentBlobOids.some((oid) => oid === mergeBlobOid)) return 'joined';
  return 'resolution';
}

/**
 * Filter a song's raw, newest-first log entries to the versions that show
 * (history.md Decision 2; workflow 6 L24-32). PURE: drops `joined` and `absent`
 * merges, keeps every non-merge and every `resolution` merge, in order, and sets
 * the `resolution` flag on each kept entry (`true` only for a resolution merge).
 * The internal `mergeClass` is stripped from the result.
 *
 * @param {Array<{ isMerge: boolean, mergeClass: string|null }>} rawEntries
 * @returns {Array<object>}
 */
export function filterSongLog(rawEntries) {
  const kept = [];
  for (const { mergeClass, ...entry } of rawEntries) {
    if (!entry.isMerge) {
      kept.push({ ...entry, resolution: false });
    } else if (mergeClass === 'resolution') {
      kept.push({ ...entry, resolution: true });
    }
    // `joined` and `absent` merges are omitted (workflow 6 L24-31).
  }
  return kept;
}

/**
 * Build the history reads over the composed primitives — the same deps and shape
 * as `createWorkingCopy` (working-copy.js:53) and `createHomeBook`
 * (home-book.js:124). `fs` is the shared filesystem, `git` the transport layer
 * (used for its `bookDir` only — history makes no network call) and `locks` the
 * per-book lock registry.
 *
 * @param {{
 *   fs: import('./fs.js').FileSystem,
 *   git: ReturnType<typeof import('./git.js').createGitLayer>,
 *   locks: ReturnType<typeof import('./locks.js').createBookLocks>,
 * }} deps
 * @returns {{
 *   songLog: (opts: { bookId: string, path: string }) => Promise<{ entries: object[] }>,
 *   readVersion: (opts: { bookId: string, path: string, commit: string }) => Promise<{ text: string }>,
 *   restoreVersion: (opts: { bookId: string, path: string, commit: string, fromPath?: string }) => Promise<{ restored: true }>,
 *   restorePart: (opts: { bookId: string, path: string, commit: string, fromPath?: string, block: object }) => Promise<{ restored: boolean }>,
 *   bookLog: (opts: { bookId: string }) => Promise<{ commits: object[] }>,
 *   commitDiff: (opts: { bookId: string, commit: string }) =>
 *     Promise<{ files: { path: string, status: string, before: string, after: string }[] }>,
 * }}
 */
export function createHistory({ fs, git, locks } = {}) {
  if (!fs) throw new Error('createHistory requires an fs');
  if (!git) throw new Error('createHistory requires a git layer');
  if (!locks) throw new Error('createHistory requires a lock registry');

  const at = (dir, path) => `${dir}/${path}`;

  // `mkdir -p` the directory (same mechanics as working-copy.js:63-74):
  // lightning-fs's `mkdir` is not recursive, and a restored song may sit under a
  // sub-directory the clone did not create.
  async function mkdirp(dir) {
    const segments = dir.split('/').filter(Boolean);
    let cursor = '';
    for (const segment of segments) {
      cursor += `/${segment}`;
      try {
        await fs.promises.mkdir(cursor);
      } catch (err) {
        if (err?.code !== 'EEXIST') throw err;
      }
    }
  }

  // The song's blob oid at a commit, or `null` when the path is not in that
  // commit's tree (isomorphic-git throws NotFoundError). Reads the blob (cheap at
  // test/book scale) and returns only its oid, which is what classification and
  // rename-following compare.
  async function songBlobOid(dir, commitOid, filepath) {
    try {
      const { oid } = await readBlob({ fs, dir, oid: commitOid, filepath });
      return oid;
    } catch (err) {
      if (err?.code === 'NotFoundError') return null;
      throw err;
    }
  }

  // The first path in a commit's tree whose blob oid equals `blobOid`, or `null`.
  // Used to recover a song's PRE-rename path: a content-preserving rename
  // (history.md Decision 3) keeps the blob, so the path the song had before the
  // rename is the path holding that same blob in the older commit.
  async function pathOfBlob(dir, commitOid, blobOid) {
    const found = await walk({
      fs,
      dir,
      trees: [TREE({ ref: commitOid })],
      map: async (filepath, [entry]) => {
        if (!entry) return undefined;
        // Recurse into directories (return undefined), match on blobs only.
        if ((await entry.type()) === 'tree') return undefined;
        return (await entry.oid()) === blobOid ? filepath : undefined;
      },
    });
    return found.find(Boolean) ?? null;
  }

  // The files one commit touched against its FIRST parent (workflow 14 L161-173),
  // each `{ path, status }` with status `added` / `modified` / `deleted`. A root
  // commit (no parent) is diffed against the empty tree, so its files read as
  // `added`. Mirrors isomorphic-git's own `getChanges` shape (a blob whose oid
  // moved), walking into directories and reporting blob changes only.
  async function changedFiles(dir, commitOid, firstParentOid) {
    const base = firstParentOid ?? EMPTY_TREE;
    const changes = await walk({
      fs,
      dir,
      trees: [TREE({ ref: commitOid }), TREE({ ref: base })],
      map: async (filepath, [current, previous]) => {
        if (filepath === '.') return undefined;
        const [currentType, previousType] = await Promise.all([
          current && current.type(),
          previous && previous.type(),
        ]);
        // Recurse into any directory on either side; report blobs only.
        if (currentType === 'tree' || previousType === 'tree') return undefined;
        const [newOid, oldOid] = await Promise.all([
          current ? current.oid() : null,
          previous ? previous.oid() : null,
        ]);
        if (newOid === oldOid) return undefined;
        let status;
        if (oldOid === null) status = 'added';
        else if (newOid === null) status = 'deleted';
        else status = 'modified';
        return { path: filepath, status };
      },
    });
    return changes;
  }

  // Shared commit-metadata projection (author, dates, parents, short hash) used by
  // both logs. Carries the author's name/email and the author instant; never the
  // committer, which the no-reply address makes identical here anyway.
  function metaOf(entry) {
    const parents = entry.commit.parent ?? [];
    return {
      commit: entry.oid,
      short: entry.oid.slice(0, SHORT),
      parents,
      isMerge: parents.length >= 2,
      author: {
        name: entry.commit.author.name,
        email: entry.commit.author.email,
      },
      timestamp: entry.commit.author.timestamp,
      timezoneOffset: entry.commit.author.timezoneOffset,
      message: entry.commit.message,
    };
  }

  /**
   * A song's versions, newest first, following renames (workflow 6 L11-37;
   * acceptance). `log({ filepath, follow: true })` crosses content-preserving
   * renames and already drops a merge whose song came verbatim from one side; we
   * then classify each raw commit for the song and filter (history.md Decision 2):
   * a non-merge that changed the song is kept; a `joined` merge is omitted; a
   * `resolution` merge (the song differs from every parent) is kept and flagged.
   * Each entry's `path` is the song's path AT THAT COMMIT, so a later
   * `readVersion` / `restoreVersion` addresses the pre-rename blob.
   */
  function songLog({ bookId, path }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      const raw = await gitLog({ fs, dir, filepath: path, follow: true });

      // A diamond makes `log` visit a shared ancestor once per branch; dedupe by
      // oid, keeping the first (newest) occurrence so ordering is preserved.
      const seen = new Set();
      const rawEntries = [];
      // Track the song's path newest-first: at a commit where it is absent at the
      // current path, a content-preserving rename moved it — recover the old path
      // by the blob carried from the newer commit (history.md Decision 3).
      let currentPath = path;
      let prevBlobOid = null;
      for (const entry of raw) {
        if (seen.has(entry.oid)) continue;
        seen.add(entry.oid);

        let blobOid = await songBlobOid(dir, entry.oid, currentPath);
        let pathAtCommit = currentPath;
        if (blobOid === null && prevBlobOid) {
          const olderPath = await pathOfBlob(dir, entry.oid, prevBlobOid);
          if (olderPath) {
            pathAtCommit = olderPath;
            currentPath = olderPath;
            blobOid = prevBlobOid;
          }
        }

        const meta = metaOf(entry);
        let mergeClass = null;
        if (meta.isMerge) {
          const parentBlobOids = await Promise.all(
            meta.parents.map((parentOid) =>
              songBlobOid(dir, parentOid, pathAtCommit),
            ),
          );
          mergeClass = classifyMergeForPath(blobOid, parentBlobOids);
        }

        rawEntries.push({ ...meta, path: pathAtCommit, mergeClass });
        prevBlobOid = blobOid;
      }

      return { entries: filterSongLog(rawEntries) };
    });
  }

  /**
   * The song's exact bytes at a commit, read as UTF-8 and returned verbatim
   * (workflow 6 L39-51; workflow 14 L76-82). `path` is the entry's HISTORICAL
   * path (what `songLog` returned), so a pre-rename version reads correctly.
   */
  function readVersion({ bookId, path, commit }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      const { blob } = await readBlob({ fs, dir, oid: commit, filepath: path });
      return { text: decoder.decode(blob) };
    });
  }

  /**
   * Restore a chosen version into the working copy (workflow 6 L53-62; workflow
   * 14 L76-82; history.md Decision 4). Reads the historical blob (`fromPath` at
   * `commit`, defaulting to `path`) and writes its bytes to the song's CURRENT
   * `path` in the working tree, uncommitted, inside ONE lock — never through
   * `workingCopy.write` (the non-reentrant lock would deadlock). Rename-correct:
   * a renamed song restores to its current name. Does not commit, canonicalise or
   * push — the subsequent save is what canonicalises and commits.
   */
  function restoreVersion({ bookId, path, commit, fromPath }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      const { blob } = await readBlob({
        fs,
        dir,
        oid: commit,
        filepath: fromPath ?? path,
      });
      const full = at(dir, path);
      const slash = full.lastIndexOf('/');
      if (slash > 0) await mkdirp(full.slice(0, slash));
      await fs.promises.writeFile(full, blob);
      return { restored: true };
    });
  }

  /**
   * Restore ONE block of a version into the working copy (songs.restore_part,
   * workflow 6 §Restoring). Mirrors `restoreVersion` byte-for-byte except for the
   * splice: it reads the historical blob (`fromPath` at `commit`) AND the current
   * working copy, splices `block` of the version's model into the working model and
   * writes the result canonical (`restoreBlock`), all inside ONE lock — never
   * through `workingCopy.write` (the non-reentrant lock would deadlock). Writes the
   * song's CURRENT `path` uncommitted; does not commit, canonicalise elsewhere or
   * push — the subsequent save is what commits. When the splice brings nothing back
   * (a no-op, or a voicing block §8.3 I1 prunes to nothing) it writes nothing and
   * returns `{ restored: false }`, so the UI says so rather than opening an empty
   * save sheet (behaviour 4).
   */
  function restorePart({ bookId, path, commit, fromPath, block }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      const full = at(dir, path);
      const { blob } = await readBlob({
        fs,
        dir,
        oid: commit,
        filepath: fromPath ?? path,
      });
      const versionText = decoder.decode(blob);
      const workingText = decoder.decode(await fs.promises.readFile(full));
      const result = restoreBlock(workingText, versionText, block);
      if (result.empty) return { restored: false };
      const slash = full.lastIndexOf('/');
      if (slash > 0) await mkdirp(full.slice(0, slash));
      await fs.promises.writeFile(full, result.text);
      return { restored: true };
    });
  }

  /**
   * The book's whole log — git's own view for the file view (workflow 14
   * L161-173). Every commit, newest first, merges included and marked
   * (`isMerge`), each with its short hash, author, date, message, parents and the
   * files it touched (against its first parent), a deletion appearing as
   * `deleted` in its commit.
   */
  function bookLog({ bookId }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      const raw = await gitLog({ fs, dir });
      const commits = [];
      for (const entry of raw) {
        const meta = metaOf(entry);
        const files = await changedFiles(dir, entry.oid, meta.parents[0] ?? null);
        commits.push({ ...meta, files });
      }
      return { commits };
    });
  }

  // A blob's text at a ref, or '' when the path is absent there (an add has no
  // parent blob, a delete no commit blob). Verbatim UTF-8, never
  // re-canonicalised.
  async function blobText(dir, oid, filepath) {
    try {
      const { blob } = await readBlob({ fs, dir, oid, filepath });
      return decoder.decode(blob);
    } catch (err) {
      if (err?.code === 'NotFoundError') return '';
      throw err;
    }
  }

  /**
   * One commit's per-file before/after texts for the file view's diff pane
   * (workflow 14 L161-167; history.md Decision 4). Reuses the same tree-walk as
   * `bookLog` to find the files the commit touched (against its first parent),
   * then reads each file at the commit and at the parent: `before` is empty for
   * an add, `after` empty for a delete. The view runs the pure `lineDiff` over
   * them (the Worker owns only the git reads — Decision 4). Under ONE lock.
   */
  function commitDiff({ bookId, commit }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      const [entry] = await gitLog({ fs, dir, ref: commit, depth: 1 });
      const firstParent = entry?.commit?.parent?.[0] ?? null;
      const base = firstParent ?? EMPTY_TREE;
      const touched = await changedFiles(dir, commit, firstParent);
      const files = [];
      for (const { path, status } of touched) {
        const before = status === 'added' ? '' : await blobText(dir, base, path);
        const after = status === 'deleted' ? '' : await blobText(dir, commit, path);
        files.push({ path, status, before, after });
      }
      return { files };
    });
  }

  return { songLog, readVersion, restoreVersion, restorePart, bookLog, commitDiff };
}
