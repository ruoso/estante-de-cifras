// fork.js — the Worker's make-it-my-own mechanics (books.fork, workflow 11 §What
// a fork is). It turns a book the user cannot (or can no longer) save to into
// their own copy on Estante, carrying everything on the device across: the
// working tree with its unsaved edits, and the history with its unpushed saves.
//
// Two ways to make the copy, chosen by the service's answer (Constraint 2):
//
//   - **The service copies it.** `POST /api/books/{id}/fork` first. On `201` the
//     device relocates its working copy to the fork's id and points `origin` at
//     the fork's `gitUrl`. Nothing is pushed here: the fork's server head is the
//     original's, so the ordinary sync engine fetches, merges and pushes the
//     local commits on its next pass, like any hosted book with saves waiting
//     (Decision 3 — no fork-specific push).
//   - **The device puts its own copy online.** On `404` (no longer a member, or
//     the original deleted) the service will not copy a book the user is no
//     longer in (Decision 2), so the device creates an empty book with
//     `POST /api/books` and pushes its own history into it — put-online's path.
//     Following has already ended (workflow 11 §When the original can no longer
//     be opened).
//
// Either way one no-change commit marks the fork's history, *Made your own from
// {original}* (Decision 7; W11 board :256): the HEAD tree again, so canonical
// form and the hook are untouched, and no song text goes in it.
//
// Every service call comes BEFORE any device write, so a refusal (`413`, `401`,
// offline) leaves the original exactly as it was (Constraint 4). The shelf
// registers and the search index are logic.js's, as they are for put-online.
//
// COMPOSITION RULE (locks.md Decision 1): one lock per logical operation, never
// nested. The relocation runs under the ORIGINAL's lock (online.js `relocate`);
// the marker commit and the create path's push under the FORK's.
//
// Logs nothing (standing rule). Framework-free, Worker-only: plain ESM, no React.

import { resolveRef, readCommit, commit as gitCommit, deleteRef } from 'isomorphic-git';
import { authorFrom } from './author.js';

/**
 * The fork's marker commit message (W11 board :256). Neutral English, like the
 * default save note: it is git history, not interface copy.
 *
 * @param {string} originalTitle
 * @returns {string}
 */
export function madeYourOwnMessage(originalTitle) {
  return `Made your own from ${originalTitle}`;
}

/**
 * Build the fork operation over the composed primitives.
 *
 * @param {{
 *   fs: import('./fs.js').FileSystem,
 *   git: ReturnType<typeof import('./git.js').createGitLayer>,
 *   locks: ReturnType<typeof import('./locks.js').createBookLocks>,
 *   booksClient: ReturnType<typeof import('./books-client.js').createBooksClient>,
 *   relocate: (opts: { fromId: string, toId: string, gitUrl: string }) => Promise<void>,
 * }} deps
 */
export function createFork({ fs, git, locks, booksClient, relocate } = {}) {
  if (!fs) throw new Error('createFork requires an fs');
  if (!git) throw new Error('createFork requires a git layer');
  if (!locks) throw new Error('createFork requires a lock registry');
  if (!booksClient) throw new Error('createFork requires a books client');
  if (!relocate) throw new Error('createFork requires a relocate');

  // The no-change marker commit on `main`: HEAD's own tree, HEAD as its one
  // parent. Nothing is staged or checked out, so the working tree — unsaved
  // edits included — is untouched. A book with no commit yet has no history to
  // mark, and is left as it is.
  async function markMadeYourOwn(dir, originalTitle, author) {
    let head;
    try {
      head = await resolveRef({ fs, dir, ref: 'main' });
    } catch {
      return null;
    }
    const { commit } = await readCommit({ fs, dir, oid: head });
    const who = authorFrom(author);
    // The full ref name: isomorphic-git writes `ref` as given, and a bare 'main'
    // would land in `.git/main` — shadowing `refs/heads/main` for every later
    // 'main' lookup while HEAD's commits go to the branch.
    return gitCommit({
      fs,
      dir,
      ref: 'refs/heads/main',
      message: madeYourOwnMessage(originalTitle),
      author: who,
      committer: who,
      tree: commit.tree,
      parent: [head],
    });
  }

  /**
   * Make `bookId` the user's own. `title` is the original's title as the shelf
   * shows it (the new book's title on the create path, and the marker's name);
   * `author` the device identity `{ id, name }` the marker commit is made with.
   *
   * Throws — before any device write — when the service refuses (a `413` over
   * the limit, a `401`, any other status) or cannot be reached (offline: the
   * thrown `fetch`). The caller words it.
   *
   * @param {{ bookId: string, title: string, author: { id: string, name: string } }} opts
   * @returns {Promise<{ bookId: string, gitUrl: string, role: string,
   *   via: 'service' | 'own', pushed: boolean }>}
   */
  async function fork({ bookId, title, author }) {
    let book;
    let via = 'service';
    try {
      book = await booksClient.fork(bookId);
    } catch (err) {
      if (err?.status !== 404) throw err;
      // The service will not copy it: the device puts its own copy online.
      via = 'own';
      book = await booksClient.create({ title });
    }
    const forkId = book.id;
    const dir = git.bookDir(forkId);

    await relocate({ fromId: bookId, toId: forkId, gitUrl: book.gitUrl });

    await locks.withLock(forkId, async () => {
      if (via === 'own') {
        // The tracking ref still names the original's server head; the new book
        // is empty, so every local commit is ahead of it. Drop the ref so the
        // engine counts (and pushes) the whole history.
        try {
          await deleteRef({ fs, dir, ref: 'refs/remotes/origin/main' });
        } catch {
          /* never fetched — nothing to drop */
        }
      }
      await markMadeYourOwn(dir, title, author);
    });

    // The create path pushes its history at once, best-effort, as put-online
    // does; a push that cannot complete is retried by the engine like any book
    // with saves waiting (Constraint 4).
    let pushed = false;
    if (via === 'own') {
      try {
        await locks.withLock(forkId, () => git.push({ dir }));
        pushed = true;
      } catch {
        pushed = false;
      }
    }

    return { bookId: forkId, gitUrl: book.gitUrl, role: book.role ?? 'owner', via, pushed };
  }

  return { fork };
}
