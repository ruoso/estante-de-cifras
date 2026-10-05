// git.js — the Worker's git transport (storage.git). DIRECTION §3 L105-106:
// "each book is a git repository on a filesystem backed by IndexedDB, operated
// by isomorphic-git in a Web Worker"; L111: "Saving is a commit, and then a
// push." This module is the transport primitive underneath that: it clones,
// fetches and pushes a book's repository against the one origin (DIRECTION §3.3)
// and settles where on the device a book's repository lives.
//
// It is DELIBERATELY small and stateless. It moves bytes and updates
// `refs/heads/main`; it does not canonicalise, stage, decide when to sync, or
// expose store commands (Decision 4). Its consumers — storage.working_copy
// (save = canonicalise, commit, push), storage.home_book, storage.history,
// storage.download and the sync engine — each `depends !git` and add their own
// protocol kinds and logic.js dispatch when they wire a user-facing flow.
//
// Every call is fixed to the one-origin, single-branch, protocol-v1 shape:
//   - `remote: 'origin'`, `ref: 'main'`, `singleBranch: true` — one book, one
//     branch (workflow 14: only `refs/heads/main` may move, fast-forward only).
//   - the injected `fs` (storage.fs's `createFileSystem` object) for all I/O,
//     and the injected `http` (git-http.js) for all network — so credentials,
//     protocol v1, and the no-logging rule all hold (git-http.js). push is NOT
//     forced (`force` left at its default), so a non-fast-forward is refused by
//     the server through git's own channel (workflow 14 L84-113).
//
// Framework-free, Worker-only: plain ESM, no React. The main thread and the
// view never import it (DIRECTION §3.7).

import {
  clone as gitClone,
  fetch as gitFetch,
  push as gitPush,
} from 'isomorphic-git';

/**
 * Build the git transport layer over an injected filesystem and HTTP client.
 *
 * @param {{ fs: import('./fs.js').FileSystem, http: { request: Function } }} deps
 * @returns {{
 *   clone: (opts: { dir: string, url: string, onProgress?: Function }) => Promise<any>,
 *   fetch: (opts: { dir: string, url: string, onProgress?: Function }) => Promise<any>,
 *   push: (opts: { dir: string, url: string, onProgress?: Function }) => Promise<any>,
 *   bookDir: (bookId: string) => string,
 * }}
 */
export function createGitLayer({ fs, http } = {}) {
  if (!fs) throw new Error('createGitLayer requires an fs');
  if (!http) throw new Error('createGitLayer requires an http client');

  // The one-origin, single-branch shape every operation shares (Decision 5,
  // workflow 14). `url` and `dir` and `onProgress` are per-call.
  const fixed = { fs, http, remote: 'origin', ref: 'main', singleBranch: true };

  /**
   * The device path for a book's repository: a non-bare working directory at
   * `/books/<bookId>` (Decision 5). Non-bare because the editor and download
   * (workflow 7) need a working tree alongside `.git`. The id is treated as an
   * opaque, path-safe segment — the create-book API returns it
   * (foundation/api_contract.md). This one helper centralises the convention so
   * working_copy / home_book / download do not each reinvent it.
   *
   * @param {string} bookId
   * @returns {string}
   */
  function bookDir(bookId) {
    return `/books/${bookId}`;
  }

  /**
   * Populate a book's working directory from the one origin.
   * @param {{ dir: string, url: string, onProgress?: Function }} opts
   */
  function clone({ dir, url, onProgress }) {
    return gitClone({ ...fixed, dir, url, onProgress });
  }

  /**
   * Advance a book's repository with new objects and refs from the origin.
   * @param {{ dir: string, url: string, onProgress?: Function }} opts
   */
  function fetch({ dir, url, onProgress }) {
    return gitFetch({ ...fixed, dir, url, onProgress });
  }

  /**
   * Send local commits on `refs/heads/main` to the origin, fast-forward only,
   * through the v1 receive-pack flow (git-http.js pins v1).
   * @param {{ dir: string, url: string, onProgress?: Function }} opts
   */
  function push({ dir, url, onProgress }) {
    return gitPush({ ...fixed, dir, url, onProgress });
  }

  return { clone, fetch, push, bookDir };
}
