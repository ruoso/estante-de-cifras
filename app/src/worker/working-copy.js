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
import {
  parseSetlist,
  writeSetlist,
  addSong,
  pathFromSetlistToSong,
  textForSong,
} from 'cifra-md';
import { canonicaliseFile } from './canonicalise.js';
import { relinkSetlists, linksTo } from './setlist-links.js';

const SETLIST_SUFFIX = '.setlist.md';

// The kind of a file by its name (books.file_view: a move keeps its kind).
function kindOfPath(path) {
  const name = path.slice(path.lastIndexOf('/') + 1);
  if (name.endsWith('.cifra.md')) return 'song';
  if (name.endsWith(SETLIST_SUFFIX)) return 'setlist';
  if (name === 'README.md') return 'readme';
  if (name === '.gitattributes') return 'gitattributes';
  return 'other';
}

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
 *   save: (opts: { bookId: string, paths: string[], message: string, author: object|(() => Promise<object>) }) =>
 *     Promise<{ commit: string, pushed: boolean } | { refused: { path: string, reason: string, marker?: string, line?: number } }>,
 *   nameAndSave: (opts: { bookId: string, fromPath: string, toPath: string, message: string, author: object|(() => Promise<object>) }) =>
 *     Promise<{ commit: string, pushed: boolean, path: string } | { refused: { path: string, reason: string, marker?: string, line?: number } }>,
 *   discard: (opts: { bookId: string, paths: string[] }) => Promise<void>,
 *   move: (opts: { bookId: string, fromPath: string, toPath: string }) => Promise<void>,
 *   remove: (opts: { bookId: string, path: string }) => Promise<void>,
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

  // The commit identity: an author object, or a function resolving one, called
  // here inside the book lock — so a save that waited on the sign-in re-author's
  // lock takes the identity as it stands after it (account.commit_author
  // Constraint 6), never one resolved before the account id was stored.
  async function identityOf(author) {
    return typeof author === 'function' ? author() : author;
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
      const who = await identityOf(author);
      const commit = await gitCommit({ fs, dir, message, author: who, committer: who });

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
      const who = await identityOf(author);
      const commit = await gitCommit({ fs, dir, message, author: who, committer: who });

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

  // The book's setlists with their current working-copy text, for the link
  // rewrite a move performs (skipping any deleted from the working tree). Read
  // within the caller's lock; never logged.
  async function readSetlists(dir) {
    const rows = await statusMatrix({ fs, dir });
    const out = [];
    for (const [path, , workdir] of rows) {
      if (!path.endsWith(SETLIST_SUFFIX) || workdir === 0) continue;
      try {
        out.push({ path, text: await fs.promises.readFile(at(dir, path), 'utf8') });
      } catch (err) {
        if (err?.code !== 'ENOENT') throw err;
      }
    }
    return out;
  }

  // Rename or move a file in the working copy, keeping its kind, and rewrite the
  // book's setlist links to it — all uncommitted, saved together later in one
  // commit (books.file_view, workflow 14 L144-146; Decision 2). The bytes move
  // verbatim (canonical form is applied at save). A cross-kind move is refused
  // ("a name keeps its kind"). Like `write`, this stages nothing and makes no
  // commit: the tree's status derives from HEAD vs the working tree, and the
  // shared SAVE stages and commits the new path, the removed old path and the
  // rewritten setlists as one commit. Under ONE lock (Decision 1).
  function move({ bookId, fromPath, toPath }) {
    return locks.withLock(bookId, async () => {
      if (kindOfPath(fromPath) !== kindOfPath(toPath)) {
        throw new Error('a file keeps its kind on a move');
      }
      const dir = git.bookDir(bookId);
      const fromFull = at(dir, fromPath);
      const toFull = at(dir, toPath);

      const bytes = await fs.promises.readFile(fromFull);
      const slash = toFull.lastIndexOf('/');
      if (slash > 0) await mkdirp(toFull.slice(0, slash));
      await fs.promises.writeFile(toFull, bytes);
      if (toFull !== fromFull) {
        try {
          await fs.promises.unlink(fromFull);
        } catch (err) {
          if (err?.code !== 'ENOENT') throw err;
        }
      }

      // A moved song keeps its setlist links reachable (workflow 12); a moved
      // setlist points at no song of its own, so nothing is relinked.
      if (kindOfPath(toPath) === 'song') {
        const changed = relinkSetlists({
          setlists: await readSetlists(dir),
          fromPath,
          toPath,
        });
        for (const s of changed) {
          await fs.promises.writeFile(at(dir, s.path), s.text);
        }
      }

      await fs.flush();
    });
  }

  // The book's setlist items that link to a song, for the rename dialog to list
  // before the move (books.file_view_history_polish, workflow 14 L151-153;
  // Decision 2). The same rule `move` relinks by (`linksTo`). Read-only, under
  // the book's lock so it never interleaves with a write or a move; writes
  // nothing and logs nothing of a setlist's text.
  function links({ bookId, path }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      return linksTo({ setlists: await readSetlists(dir), path });
    });
  }

  // Remove a file from the working copy (books.file_view, workflow 14 L147). A
  // committed file is unlinked from the working tree and reads as `deleted`
  // until a SAVE commits the removal; a never-saved file simply disappears. No
  // commit, and no setlist relink — a deleted song's links become missing items
  // (workflow 12; Decision 2). Under ONE lock.
  function remove({ bookId, path }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      try {
        await fs.promises.unlink(at(dir, path));
      } catch (err) {
        if (err?.code !== 'ENOENT') throw err;
      }
      await fs.flush();
    });
  }

  // Add a song to a setlist as ONE locked, uncommitted working-copy change
  // (books.setlists, workflow 12 §Building one, §Songs from another book; the
  // file_view move+relink precedent). The pieces, all under ONE
  // `withLock(targetBookId)` (Web Locks are non-reentrant), so a confirm is one
  // coherent unsaved change the shared SAVE later commits as one commit:
  //   1. a song from another book is copied into the target book at its own path
  //      first — "a setlist points only into its own book" (workflow 12 L38-40);
  //   2. a `newTitle` starts a fresh setlist model; otherwise the existing
  //      `*.setlist.md` is read and parsed;
  //   3. the item is appended with cifra-md's `addSong`, its link made
  //      folder-relative to the setlist (`pathFromSetlistToSong`) and its text
  //      derived from the song (`textForSong`), and the whole setlist written
  //      back through `writeSetlist` so what lands is canonical.
  // Nothing is staged or committed here (like `write`/`move`): the tree's status
  // derives from HEAD vs the working tree, and SAVE canonicalises, stages and
  // commits the copied song and the rewritten setlist together. The source book
  // is read without its own lock (a local read, like OPEN_SOURCE). `song.title`
  // may be null — the link text then falls back to the file name (§10.10).
  function addToSetlist({ targetBookId, setlistPath, newTitle, song }) {
    return locks.withLock(targetBookId, async () => {
      const dir = git.bookDir(targetBookId);
      const copied = song.bookId !== targetBookId;

      if (copied) {
        const bytes = await fs.promises.readFile(
          `${git.bookDir(song.bookId)}/${song.path}`,
        );
        const destFull = at(dir, song.path);
        const slash = destFull.lastIndexOf('/');
        if (slash > 0) await mkdirp(destFull.slice(0, slash));
        await fs.promises.writeFile(destFull, bytes);
      }

      let model;
      if (newTitle != null) {
        model = { title: newTitle, properties: [], body: [] };
      } else {
        model = parseSetlist(await fs.promises.readFile(at(dir, setlistPath), 'utf8'));
      }

      const dirSegments = setlistPath.split('/').slice(0, -1);
      const rel = pathFromSetlistToSong(dirSegments, song.path.split('/'));
      const fileName = song.path.slice(song.path.lastIndexOf('/') + 1);
      const text = textForSong({ title: song.title || null, fileName });
      model = addSong(model, { text, path: rel });

      const setlistFull = at(dir, setlistPath);
      const setlistSlash = setlistFull.lastIndexOf('/');
      if (setlistSlash > 0) await mkdirp(setlistFull.slice(0, setlistSlash));
      await fs.promises.writeFile(setlistFull, writeSetlist(model));

      await fs.flush();
      return { copied, path: song.path, setlistPath };
    });
  }

  return { write, save, nameAndSave, discard, move, links, remove, addToSetlist };
}
