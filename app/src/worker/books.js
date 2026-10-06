// books.js — the Worker's creator of local songbook repositories (books.shelf,
// workflow 7 L25). DIRECTION §3 L105-106: "each book is a git repository on a
// filesystem backed by IndexedDB." A NEW BOOK is "a name, and an empty local
// repository. No account needed." — so this module `git.init`s a repository on
// the device, scaffolds it to the §2.1 shape (a README whose level-1 heading is
// the title, and the cifra merge driver in .gitattributes), and makes its one
// first commit. No network: a local book reaches the service only when it is
// later put online (books.online, DIRECTION §3.6).
//
// It is the sibling of working-copy.js and home-book.js, composed over the same
// primitives the same way (the git transport, the per-book lock, the shared
// filesystem). The LOCAL git write — `init`, `add`, `commit` — runs straight on
// isomorphic-git over the shared `fs`, while git.js stays the narrow network
// transport (working-copy.js Decision 2; home-book.md Decision 3).
//
// COMPOSITION RULE (locks.md Decision 1): one lock per logical operation. The
// create (init → scaffold → commit) runs inside ONE `withLock` on the new book's
// own id — a different repository from the home book the shelf entry is written
// to, so the two never nest (Web Locks are non-reentrant): logic.js takes this
// lock and the home-book lock in sequence, never one inside the other.
//
// No song text, titles, labels or secrets in logs or commit messages (standing
// rule): this module logs nothing, and its commit message names only the act,
// never the book's title. Framework-free, Worker-only: plain ESM, no React.

import { add as gitAdd, commit as gitCommit } from 'isomorphic-git';
import { authorFrom } from './author.js';

// The §2.1 identity bytes a new SONGBOOK is scaffolded with: the cifra merge
// driver for songs and setlists (app/example-book/.gitattributes). UTF-8, LF,
// one trailing newline — the §6.3 text rules. (The home book uses different
// bytes, `*.json merge=binary`; a songbook holds `*.cifra.md` / `*.setlist.md`.)
const GITATTRIBUTES_BYTES = `*.cifra.md merge=cifra
*.setlist.md merge=cifra
`;

// The README of a new book: its title as the level-1 heading (DIRECTION §2.1
// L74 — "A book's title is the level-1 heading of its README"). One trailing
// newline, LF.
const readmeBytes = (title) => `# ${title}\n`;

/**
 * Build the local-book creator over the composed primitives — the same deps and
 * shape as `createHomeBook` (home-book.js:124) and `createWorkingCopy`.
 *
 * @param {{
 *   fs: import('./fs.js').FileSystem,
 *   git: ReturnType<typeof import('./git.js').createGitLayer>,
 *   locks: ReturnType<typeof import('./locks.js').createBookLocks>,
 * }} deps
 * @returns {{
 *   createLocal: (opts: { title: string, author: { id: string, name: string }, now?: number }) => Promise<{ bookId: string }>,
 * }}
 */
export function createBooks({ fs, git, locks } = {}) {
  if (!fs) throw new Error('createBooks requires an fs');
  if (!git) throw new Error('createBooks requires a git layer');
  if (!locks) throw new Error('createBooks requires a lock registry');

  const at = (dir, file) => `${dir}/${file}`;

  /**
   * Create an empty local songbook: mint a path-safe local id, `git.init` the
   * repository at `/books/<id>`, scaffold `README.md` (`# {title}`) and
   * `.gitattributes` (the §2.1 cifra merge driver), and commit that one first
   * commit — all under the new book's lock. No push — offline-first; a local
   * book lives only on the device. Returns the minted `bookId` so logic.js can
   * write the shelf entry and announce the book.
   */
  async function createLocal({ title, author, now = Date.now() }) {
    // A path-safe, unique local id — opaque, like a service book id, but minted
    // on the device. The `local-` prefix keeps it out of the reserved `home`
    // id's way and marks it as device-born.
    const bookId = `local-${globalThis.crypto.randomUUID()}`;
    await locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
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
    });
    return { bookId };
  }

  return { createLocal };
}
