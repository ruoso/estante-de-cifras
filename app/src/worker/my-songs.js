// my-songs.js — the reserved *My songs* book (songs.new_song, workflow 3 §Which
// book). *My songs* is the device-local default a new song goes into when it is
// not started from another book. It is "listed from the start … created when the
// first song is written into it" (workflow 1 §My songs; account.first_run
// reserved the identity in first-run.js:48-54). This module mints its repository
// — idempotently, under the fixed reserved id — the first time a song is started
// into it.
//
// It mirrors example-book.js exactly (the reference "idempotent create under a
// reserved id"): a fixed `local-` id so a second start reuses the one repository
// instead of accumulating orphans; `resolveRef` for the idempotency check; the
// §2.1 songbook scaffold (`README.md` = the title, `.gitattributes` = the shared
// merge driver); one commit; and an `fs.flush()` because this is a permanent
// local book that must survive an immediate reload (fs.js Decision 6). It
// differs from example-book.js only in having no bundled songs — it starts
// empty, the user's first song being written into it right after.
//
// Framework-free, Worker-only. Logs nothing (standing rule). No push: *My songs*
// is local, it reaches no one (offline-first; no book without an account —
// DIRECTION §3).

import { add as gitAdd, commit as gitCommit, resolveRef } from 'isomorphic-git';
import { authorFrom } from './author.js';
import { GITATTRIBUTES_BYTES } from './books.js';

// The reserved id, fixed so every surface names the same repository: first-run.js
// lists `MY_SONGS = { id: 'local-my-songs', … }`, and this task creates it under
// that id (first-run.js:48-54). The `local-` prefix marks it device-born, like
// every other local book (books.js, example-book.js).
export const MY_SONGS_ID = 'local-my-songs';

// The §2.1 README identity bytes, from the book's title (same helper shape as
// books.js's local-book scaffold).
const readmeBytes = (title) => `# ${title}\n`;

/**
 * Build the *My songs* provisioner over the composed primitives, mirroring
 * `createExampleBook` / `createBooks`.
 *
 * @param {{
 *   fs: import('./fs.js').FileSystem,
 *   git: ReturnType<typeof import('./git.js').createGitLayer>,
 *   locks: ReturnType<typeof import('./locks.js').createBookLocks>,
 * }} deps
 * @returns {{ bookId: string, ensure: (opts: { title: string, author: object, now?: number }) => Promise<{ bookId: string, created: boolean }> }}
 */
export function createMySongs({ fs, git, locks } = {}) {
  if (!fs) throw new Error('createMySongs requires an fs');
  if (!git) throw new Error('createMySongs requires a git layer');
  if (!locks) throw new Error('createMySongs requires a lock registry');

  const at = (dir, file) => `${dir}/${file}`;

  // Ensure the *My songs* repository exists, idempotently under the reserved id
  // (workflow 3 §Which book L28). A committed `main` means it is already there —
  // nothing to do; otherwise init + scaffold + one commit, then flush so the
  // permanent local book survives an immediate reload. `title` is the localised
  // *My songs* label (the view knows the language), written as the §2.1 README
  // identity. All under the book's own lock, taken once (locks.md Decision 1).
  function ensure({ title, author, now = Date.now() }) {
    return locks.withLock(MY_SONGS_ID, async () => {
      const dir = git.bookDir(MY_SONGS_ID);
      try {
        await resolveRef({ fs, dir, ref: 'main' });
        return { bookId: MY_SONGS_ID, created: false };
      } catch {
        // No committed `main` yet: provision a fresh local repository below.
      }
      await git.init({ dir });
      await fs.promises.writeFile(at(dir, 'README.md'), readmeBytes(title));
      await gitAdd({ fs, dir, filepath: 'README.md' });
      await fs.promises.writeFile(at(dir, '.gitattributes'), GITATTRIBUTES_BYTES);
      await gitAdd({ fs, dir, filepath: '.gitattributes' });
      const identity = authorFrom(author, now);
      await gitCommit({
        fs,
        dir,
        // Content-free: names the act, never the book's title (standing rule).
        message: 'Create book',
        author: identity,
        committer: identity,
      });
      // Force the inode table out now (fs.js Decision 6), like example-book.js's
      // seed: *My songs* is a permanent local book that must survive a reload
      // straight away, not only once lightning-fs's debounced superblock save
      // happens to fire (offline-first; the book lives only on the device).
      await fs.flush();
      return { bookId: MY_SONGS_ID, created: true };
    });
  }

  return { bookId: MY_SONGS_ID, ensure };
}
