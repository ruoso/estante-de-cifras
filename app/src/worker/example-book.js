// example-book.js — the Worker's seeder for the bundled example book
// (account.first_run, workflow 1 §Cold). The app ships a small, purpose-written
// songbook at app/example-book/ (design.example_book); opening it puts it on the
// shelf as a plain LOCAL book — no account, no network — and makes its songs
// searchable, which is the proof the app does something before a user adds any
// music of their own (DIRECTION §3.3 L175-182: no book without an account, which
// is why the example book ships WITH the app rather than being hosted).
//
// It is the sibling of books.js, composed over the same fs/git/locks primitives
// the same way, and it reuses books.js's `GITATTRIBUTES_BYTES` so the §2.1 merge
// driver has one source of truth (refinement Decision 2). The bundled files are
// imported RAW in the Worker — Vite's root is app/, so app/example-book/ is
// inside the root and bundled (and precached) into the Worker JS, so seeding
// works offline (Decision 2). The main thread never sees these bytes
// (DIRECTION §3.7): the view only sends OPEN_EXAMPLE_BOOK.
//
// COMPOSITION RULE (locks.md Decision 1): the seed (init → write → commit) runs
// inside ONE `withLock` on the reserved book's own id; logic.js takes this lock
// and the home-book lock in sequence, never nested.
//
// No song text, titles or secrets in logs or commit messages (standing rule):
// this module logs nothing, and its commit message names only the act, never a
// song. Framework-free, Worker-only: plain ESM, no React.

import { add as gitAdd, commit as gitCommit, resolveRef } from 'isomorphic-git';
import { authorFrom } from './author.js';
import { GITATTRIBUTES_BYTES } from './books.js';
import readmeBytes from '../../example-book/README.md?raw';

// The reserved local id the example book is seeded under (refinement Decision 3).
// It keeps the `local-` prefix books.js uses for device-born books and is a fixed
// literal so a re-open reuses the one repository instead of accumulating orphans,
// and so the book is recognisable. Like the reserved `home` id, it is a namespace
// key under this device in shelf.json (home-book-format §2.3), so two devices'
// example books never collide.
export const EXAMPLE_BOOK_ID = 'local-example-book';

// The bundled songs and setlists, imported raw in the Worker (Decision 2). The
// glob is relative to this module (app/src/worker/) and resolves to
// app/example-book/*.cifra.md and *.setlist.md; `?raw` + `import: 'default'`
// yields each file's exact bytes. `.gitattributes` is NOT globbed — it reuses the
// `GITATTRIBUTES_BYTES` constant, avoiding a dotfile glob (Decision 2).
const SONG_RAW = import.meta.glob('../../example-book/*.{cifra,setlist}.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function basename(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

// Songs and setlists, name-sorted for a stable commit order.
const songFiles = Object.keys(SONG_RAW)
  .sort()
  .map((path) => ({ name: basename(path), bytes: SONG_RAW[path] }));

// Every file the seeded repository holds, byte for byte: the README whose §2.1
// level-1 heading is the book title, the §2.1 cifra merge driver, and the songs
// and setlists. Exported so the unit test can read the shipped book clean and
// canonical under cifra.md (account.first_run unit; DIRECTION §2.1; cifra.md §8).
export const EXAMPLE_BOOK_FILES = Object.freeze([
  { name: 'README.md', bytes: readmeBytes },
  { name: '.gitattributes', bytes: GITATTRIBUTES_BYTES },
  ...songFiles,
]);

/**
 * Build the example-book seeder over the composed primitives — the same deps and
 * shape as `createBooks` (books.js:55) and `createHomeBook`.
 *
 * @param {{
 *   fs: import('./fs.js').FileSystem,
 *   git: ReturnType<typeof import('./git.js').createGitLayer>,
 *   locks: ReturnType<typeof import('./locks.js').createBookLocks>,
 * }} deps
 * @returns {{
 *   bookId: string,
 *   seed: (opts: { author: { id: string, name: string }, now?: number }) => Promise<{ bookId: string, seeded: boolean }>,
 * }}
 */
export function createExampleBook({ fs, git, locks } = {}) {
  if (!fs) throw new Error('createExampleBook requires an fs');
  if (!git) throw new Error('createExampleBook requires a git layer');
  if (!locks) throw new Error('createExampleBook requires a lock registry');

  const at = (dir, file) => `${dir}/${file}`;

  /**
   * Seed the example book as a local repository under the reserved id, once. If
   * `main` already resolves (a prior open, still on disk) this is a no-op on the
   * git side — it returns `seeded: false` and leaves logic.js to re-assert the
   * shelf entry (Decision 3). Otherwise `git.init` the repository, write the
   * bundled files byte for byte, stage and commit that one first commit — all
   * under the book's lock, no push (offline-first; a local book lives only on the
   * device). Returns the reserved id and whether it wrote a fresh repository.
   */
  function seed({ author, now = Date.now() }) {
    return locks.withLock(EXAMPLE_BOOK_ID, async () => {
      const dir = git.bookDir(EXAMPLE_BOOK_ID);
      try {
        await resolveRef({ fs, dir, ref: 'main' });
        return { bookId: EXAMPLE_BOOK_ID, seeded: false };
      } catch {
        // No committed `main` yet: seed a fresh repository below.
      }
      await git.init({ dir });
      for (const { name, bytes } of EXAMPLE_BOOK_FILES) {
        await fs.promises.writeFile(at(dir, name), bytes);
        await gitAdd({ fs, dir, filepath: name });
      }
      const identity = authorFrom(author, now);
      await gitCommit({
        fs,
        dir,
        // Content-free: names the act, never a song (standing rule).
        message: 'Open example book',
        author: identity,
        committer: identity,
      });
      return { bookId: EXAMPLE_BOOK_ID, seeded: true };
    });
  }

  return { bookId: EXAMPLE_BOOK_ID, seed };
}
