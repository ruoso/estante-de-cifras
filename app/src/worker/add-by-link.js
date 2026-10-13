// add-by-link.js — the Worker's clone-a-hosted-book mechanic (books.add_by_link,
// workflow 1 §Invited, workflow 7 §By link / §Mine on Estante). The sibling of
// online.js: where online.js turns a device-only book INTO a hosted one, this
// clones a book that is ALREADY hosted onto this device — the collaborator's and
// the second device's only path onto a shelf (DIRECTION §3.1 L133-134: a clone is
// a network git fetch through the one service).
//
// It holds just the git/fs half — `cloneHosted`, a fetch of the whole repository
// into bookDir(serviceId) under the book's lock. The HTTP accept call
// (books-client.js) and the shelf-register write (logic.js, mirroring the
// CREATE_BOOK / PUT_ONLINE split where the git mechanics live in a module and the
// home-book write stays in logic.js) are the caller's. Both ADD_BY_LINK (accept
// then clone) and ADD_MINE (clone — already a member) reuse this one helper
// (Decision 3). The shelf register is written only AFTER the clone lands, so a
// failed or cancelled clone leaves no half-book (Decision 4).
//
// COMPOSITION RULE (locks.md Decision 1): one lock per logical operation. The
// clone runs under the (service) book's lock — nothing else knows the id until
// the shelf write that follows it.
//
// No song text, titles, ids or secrets in logs (standing rule): this module logs
// nothing. The git HTTP client carries the same-origin session cookie
// (git-http.js `credentials: 'include'`), so the clone reaches a private book the
// account is a member of. Framework-free, Worker-only: plain ESM, no React.

/**
 * Build the clone-a-hosted-book mechanic over the composed primitives — the same
 * deps and shape as `createOnline`, minus the books client (the accept/list calls
 * stay in logic.js).
 *
 * @param {{
 *   git: ReturnType<typeof import('./git.js').createGitLayer>,
 *   locks: ReturnType<typeof import('./locks.js').createBookLocks>,
 * }} deps
 */
export function createAddByLink({ git, locks } = {}) {
  if (!git) throw new Error('createAddByLink requires a git layer');
  if (!locks) throw new Error('createAddByLink requires a lock registry');

  /**
   * Clone a hosted book into its device directory. A git-over-HTTP fetch of the
   * whole repository from `gitUrl` into `bookDir(id)` under the book's lock;
   * isomorphic-git's clone writes `remote.origin.url` itself, so the sync engine
   * reaches it on its next pass with no extra plumbing. `onProgress` carries the
   * cancellable clone progress (workflow 7 L33) when the caller passes it. No
   * shelf write here — the caller writes the register only after this resolves
   * (Decision 4).
   *
   * @param {{ id: string, gitUrl: string, onProgress?: Function }} opts
   */
  function cloneHosted({ id, gitUrl, onProgress }) {
    return locks.withLock(id, () =>
      git.clone({ dir: git.bookDir(id), url: gitUrl, onProgress }),
    );
  }

  return { cloneHosted };
}
