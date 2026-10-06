// working-copy.js — the working copy, save and discard (storage.working_copy).
// DIRECTION §3 L108-111: "What the user is editing is the working copy, written
// to storage as they type, so closing the tab loses nothing"; "Saving is a
// commit, and then a push." This module is the Worker's mechanism for that: it
// composes the git transport (git.js), the per-book lock (locks.js) and the
// filesystem (fs.js) into the three operations the editor drives — write, save,
// discard.
//
// It is where the LOCAL git operations live — `add`, `remove`, `commit`,
// `checkout`, `statusMatrix` — called straight on isomorphic-git over the shared
// `fs`. git.js stays the narrow network transport (clone / fetch / push); it
// "does not canonicalise, stage, or decide when to sync — its consumers do"
// (git.md Decision 4, Decision 2 here). The network url is not passed in: the
// clone wrote `remote.origin.url` into the book's config, and push reads it.
//
// COMPOSITION RULE (locks.md Decision 1): one lock per logical operation. A save
// is canonicalise -> write back -> add -> commit -> push, all inside ONE
// `withLock`; a write and a discard each run under one. Never reacquired per git
// call, never nested (Web Locks are non-reentrant). A write is locked too
// (Decision 3): a keystroke-write and a sync's merge both mutate the working
// tree and must not interleave (DIRECTION §3.1).
//
// Framework-free, Worker-only: plain ESM, no React. Logs nothing — never song
// text, commit messages or secrets (standing rule). Errors surface to the
// caller (logic.js), which turns them into events, never to `console`.

import {
  add as gitAdd,
  remove as gitRemove,
  commit as gitCommit,
  checkout as gitCheckout,
  statusMatrix,
} from 'isomorphic-git';
import { canonicaliseFile } from './canonicalise.js';

/**
 * Build the working-copy operations over the composed primitives. `fs` is the
 * shared filesystem (fs.js), `git` the transport layer (git.js) — used for its
 * `bookDir` and `push` — and `locks` the per-book lock registry (locks.js).
 *
 * @param {{
 *   fs: import('./fs.js').FileSystem,
 *   git: ReturnType<typeof import('./git.js').createGitLayer>,
 *   locks: ReturnType<typeof import('./locks.js').createBookLocks>,
 * }} deps
 * @returns {{
 *   write: (opts: { bookId: string, path: string, text: string|Uint8Array }) => Promise<void>,
 *   save: (opts: { bookId: string, paths: string[], message: string, author: object }) =>
 *     Promise<{ commit: string, pushed: boolean } | { refused: { path: string, reason: string, marker?: string, line?: number } }>,
 *   nameAndSave: (opts: { bookId: string, fromPath: string, toPath: string, message: string, author: object }) =>
 *     Promise<{ commit: string, pushed: boolean, path: string } | { refused: { path: string, reason: string, marker?: string, line?: number } }>,
 *   discard: (opts: { bookId: string, paths: string[] }) => Promise<void>,
 * }}
 */
export function createWorkingCopy({ fs, git, locks } = {}) {
  if (!fs) throw new Error('createWorkingCopy requires an fs');
  if (!git) throw new Error('createWorkingCopy requires a git layer');
  if (!locks) throw new Error('createWorkingCopy requires a lock registry');

  const at = (dir, path) => `${dir}/${path}`;

  // `mkdir -p` the directory: create each ancestor in turn, ignoring an
  // already-present one. lightning-fs's `mkdir` is not recursive, and a new
  // song may sit under a sub-directory the clone did not create.
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

  // Write the editor's current text straight into the book's working copy
  // (DIRECTION §3 L108-110). No canonicalisation and no commit — just
  // durability. Under the book lock, so it never interleaves with a sync's
  // merge (Decision 3).
  function write({ bookId, path, text }) {
    return locks.withLock(bookId, async () => {
      const full = at(git.bookDir(bookId), path);
      const slash = full.lastIndexOf('/');
      if (slash > 0) await mkdirp(full.slice(0, slash));
      await fs.promises.writeFile(full, text);
      // Force the inode table out now (fs.js Decision 6): the bytes are already
      // committed, but without the superblock a reload moments after a keystroke
      // would not FIND them — exactly the loss "written to storage as they type,
      // so closing the tab loses nothing" (DIRECTION §3 L108-110) forbids.
      await fs.flush();
    });
  }

  // Save the named paths as ONE commit, authored by the per-user no-reply
  // address, then push (workflow 4 L24-65, workflow 14 L154-158). Canonicalise
  // every file first; a single marked or unreadable file aborts the whole save
  // before any commit (Decision 5). Offline-first: a failed push keeps the
  // local commit and resolves `pushed: false` (Decision 8).
  function save({ bookId, paths, message, author }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);

      // Pass 1 — canonicalise (or note a deletion). Nothing is written back or
      // staged yet, so a refusal here leaves the working copy and the repo
      // untouched.
      const plan = [];
      for (const path of paths) {
        const full = at(dir, path);
        let present = true;
        try {
          await fs.promises.stat(full);
        } catch (err) {
          if (err?.code === 'ENOENT') present = false;
          else throw err;
        }
        if (!present) {
          plan.push({ path, remove: true });
          continue;
        }
        const result = canonicaliseFile(path, await fs.promises.readFile(full));
        if (!result.ok) {
          return {
            refused: {
              path,
              reason: result.reason,
              marker: result.marker,
              line: result.line,
            },
          };
        }
        plan.push({ path, text: result.text });
      }

      // Pass 2 — write the canonical text back so the committed blob and the
      // working file agree (both canonical), stage, and make one commit.
      for (const step of plan) {
        if (step.remove) {
          await gitRemove({ fs, dir, filepath: step.path });
        } else {
          await fs.promises.writeFile(at(dir, step.path), step.text);
          await gitAdd({ fs, dir, filepath: step.path });
        }
      }
      const commit = await gitCommit({ fs, dir, message, author, committer: author });

      // Force the inode table out now (fs.js Decision 6), still inside the save's
      // single lock: the commit the user chose to keep is the durable artifact,
      // and a reload moments later must not read it back as ENOENT. Runs before
      // the best-effort push so the commit's durability never waits on the
      // network (DIRECTION §3 L111-113; workflow 4 §Saving).
      await fs.flush();

      // The commit is durable locally; the push is best-effort. A push that
      // fails (no network, or a ref the server would not fast-forward) does not
      // roll back the commit — the sync engine retries it (Decision 8). The
      // outcome carries whether it landed.
      let pushed = false;
      try {
        await git.push({ dir });
        pushed = true;
      } catch {
        pushed = false;
      }
      return { commit, pushed };
    });
  }

  // The first save of a new song (songs.new_song, workflow 3 §The first save):
  // rename the uncommitted placeholder (`fromPath`) to its title's slug
  // (`toPath`), then the same canonical commit-and-push a SAVE does — all under
  // ONE lock (Decision 1). The placeholder was never committed (a `WRITE`-only
  // file, no HEAD blob), so no `git mv` is needed: writing the canonical text at
  // `toPath` and unlinking `fromPath` is the whole rename. Canonicality and the
  // offline-push behavior are exactly the SAVE path's; the naming is a thin step
  // in front of it (Decision 4). A marked/unreadable file refuses before any
  // commit, like SAVE (Decision 5) — though the editor's pre-save gate blocks
  // that for a new song (editor.md Decision 3).
  function nameAndSave({ bookId, fromPath, toPath, message, author }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      const fromFull = at(dir, fromPath);
      const toFull = at(dir, toPath);

      // Canonicalise the placeholder's current bytes; a refusal here leaves the
      // working copy and the repo untouched (nothing written back or staged).
      const result = canonicaliseFile(toPath, await fs.promises.readFile(fromFull));
      if (!result.ok) {
        return {
          refused: {
            path: fromPath,
            reason: result.reason,
            marker: result.marker,
            line: result.line,
          },
        };
      }

      // Rename: write the canonical text at the final name (creating its folder
      // if the new song sits under one), then drop the placeholder. The
      // committed blob and the working file agree (both canonical).
      const slash = toFull.lastIndexOf('/');
      if (slash > 0) await mkdirp(toFull.slice(0, slash));
      await fs.promises.writeFile(toFull, result.text);
      if (toFull !== fromFull) {
        try {
          await fs.promises.unlink(fromFull);
        } catch (err) {
          if (err?.code !== 'ENOENT') throw err;
        }
      }
      await gitAdd({ fs, dir, filepath: toPath });
      const commit = await gitCommit({ fs, dir, message, author, committer: author });

      // Force the inode table out now (fs.js Decision 6), inside the one lock and
      // before the best-effort push, so the commit the user chose to keep is
      // durable without waiting on the network (mirrors `save`).
      await fs.flush();

      // The commit is durable locally; the push is best-effort (offline-first).
      // A local book has no remote, so push throws and resolves `pushed: false`;
      // an online book pushes, or queues (`pushed: false`) with the commit kept.
      let pushed = false;
      try {
        await git.push({ dir });
        pushed = true;
      } catch {
        pushed = false;
      }
      return { commit, pushed, path: toPath };
    });
  }

  // Put the named paths back as last saved (workflow 4 L73-77): a tracked file
  // is checked out from HEAD; a never-saved new file (no HEAD blob) is deleted
  // (workflow 3 L51-54). Under the book lock.
  function discard({ bookId, paths }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      for (const path of paths) {
        const [row] = await statusMatrix({ fs, dir, filepaths: [path] });
        const inHead = row ? row[1] : 0; // row = [filepath, HEAD, WORKDIR, STAGE]
        if (inHead === 0) {
          try {
            await fs.promises.unlink(at(dir, path));
          } catch (err) {
            if (err?.code !== 'ENOENT') throw err;
          }
        } else {
          await gitCheckout({ fs, dir, ref: 'HEAD', filepaths: [path], force: true });
        }
      }
      // Force the inode table out now (fs.js Decision 6), still inside the
      // discard's single lock: the reverted/removed working-tree state must be
      // durable, not lost to the 500ms debounce if the tab reloads immediately
      // (workflow 4 §Discarding).
      await fs.flush();
    });
  }

  return { write, save, nameAndSave, discard };
}
