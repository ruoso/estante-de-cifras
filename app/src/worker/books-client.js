// books-client.js — the Worker's `/api/books` HTTP client (books.online). The
// app's first consumer of the service's book endpoints (service.books): it
// creates a book (empty, private — the put-online act, workflow 7 L46-52),
// lists the account's books, and deletes a book from Estante for everyone
// (owner only, workflow 7 L128-137). A sibling of change-check-client.js and
// git-http.js — the third non-git network consumer, and the one choke point for
// these three requests, so the same rules live here and nowhere else
// (Decision 1):
//   - `credentials: 'include'` on every request, so the browser's session
//     cookie flows to the service that authorises the book (DIRECTION §3.3
//     L175-182; "every request for a book needs a session"). The client stores
//     no credentials and reads no cookie.
//   - it logs nothing: not the title, not the returned id or gitUrl, not the
//     response. A book id and a title are account data (standing no-logging
//     rule, mirroring change-check-client.js:11-13).
//   - errors surface as the thrown/rejected value for the caller (logic.js) to
//     turn into a worded message — a quota `413`, a missing session `401`, a
//     non-owner `403` ride on the error's `.status`, carrying no book content.
//
// It shares no code with the service: only this HTTP contract and the format
// (DIRECTION §3.6 L288-291). The request/response shapes are the
// `api/openapi.yaml` `Book`/`CreateBookRequest` schemas (authoritative example:
// e2e/api/books.test.js).
//
// Framework-free, Worker-only: plain ESM, no React, no DOM beyond `fetch`.

// The one books collection and its per-book path (api/openapi.yaml L289-345).
const BOOKS_PATH = '/api/books';

/**
 * Build the `/api/books` client. `options.fetch` injects a `fetch` (a test
 * supplies one to drive and observe the request); it defaults to the global
 * `fetch` the real Worker provides — the same seam change-check-client.js and
 * git-http.js use.
 *
 * @param {{ fetch?: typeof globalThis.fetch }} [options]
 * @returns {{
 *   create: (req: { title: string }) => Promise<Book>,
 *   list: () => Promise<Book[]>,
 *   remove: (bookId: string) => Promise<void>,
 *   accept: (token: string) => Promise<Book>,
 *   fork: (bookId: string) => Promise<Book>,
 *   leave: (bookId: string) => Promise<void>,
 * }}
 * @typedef {{ id: string, title: string, role: 'owner'|'editor'|'reader',
 *   visibility: 'private', gitUrl: string,
 *   original?: { bookId: string, title: string } | null,
 *   ownerName?: string }} Book — `ownerName` only for a book shared with the
 *   caller whose owner has a name (books.owner_name)
 */
export function createBooksClient(options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  // Throw a content-free typed error for a non-2xx response. The status rides
  // the error so the caller can word a quota (413), a missing session (401) or
  // a non-owner refusal (403); the message names only the act and the status,
  // never a book id, title or body (standing no-logging rule).
  function refuse(response) {
    const err = new Error(`books: ${response.status}`);
    err.status = response.status;
    return err;
  }

  /**
   * Create an empty, private book on Estante (POST /api/books {title} → 201
   * Book). The caller becomes its owner; the returned `gitUrl` is what goes
   * into `remote.origin.url` (workflow 7 L46-52). A `413` (over quota), `401`
   * (no session) or `400` surfaces as a typed error carrying only `.status`.
   */
  async function create({ title }) {
    const response = await fetchImpl(BOOKS_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ title }),
    });
    if (!response.ok) throw refuse(response);
    return response.json();
  }

  /**
   * Accept an invitation and join its book (POST /api/invitations/{token}/accept
   * → 200 Book). The joiner becomes a reader or editor as the invitation makes
   * them — the role is the invitation's, not chosen (books.add_by_link). Returns
   * the `Book` ({ id, title, role, visibility, gitUrl }). A refusal surfaces as a
   * typed error carrying only `.status` and, for a 409, the machine-readable
   * `.code` ∈ { invitation_withdrawn, invitation_expired, invitation_exhausted,
   * book_full } — never a title, id or owner (a dead link reveals nothing,
   * workflow 1 §Invited). A `401` (no session) rides on `.status` for the
   * account-first gate; a `404` (unknown token or non-member — conflated so a
   * private book is never confirmed) carries `.status` alone. The token passes
   * through opaque, path-encoded, never logged (standing rule). Accept is the
   * only way to learn a book's title and role (no peek endpoint) and is
   * side-effecting, so the caller attempts it once per real join.
   */
  async function accept(token) {
    const response = await fetchImpl(
      `/api/invitations/${encodeURIComponent(token)}/accept`,
      { method: 'POST', credentials: 'include' },
    );
    if (!response.ok) {
      const err = new Error(`invitations: ${response.status}`);
      err.status = response.status;
      if (response.status === 409) {
        // The Conflict body carries only `{ code, message }` (openapi.yaml L791-833),
        // never book content; read the code to word the refusal. A missing/
        // unparseable body leaves `.code` undefined, read as a generic dead link.
        try {
          const body = await response.json();
          if (body && typeof body.code === 'string') err.code = body.code;
        } catch {
          // No parseable body — the status alone words the refusal.
        }
      }
      throw err;
    }
    return response.json();
  }

  /**
   * List the account's books (GET /api/books → 200 { books }). Returns the
   * array; a `401` surfaces as a typed error.
   */
  async function list() {
    const response = await fetchImpl(BOOKS_PATH, {
      method: 'GET',
      credentials: 'include',
    });
    if (!response.ok) throw refuse(response);
    const body = await response.json();
    return body?.books ?? [];
  }

  /**
   * Delete a book from Estante for everyone (DELETE /api/books/{bookId} → 204,
   * no body — the typed-name guard is the app's). A `403`/`404` (not the owner,
   * or gone) or `401` surfaces as a typed error; a 204 resolves with no value.
   */
  async function remove(bookId) {
    const response = await fetchImpl(`${BOOKS_PATH}/${encodeURIComponent(bookId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok) throw refuse(response);
  }

  /**
   * Fork a book on Estante (POST /api/books/{bookId}/fork → 201 Book, workflow
   * 11; books.fork). A private server-side copy owned by the caller, its
   * `original` set. A `404` (no longer a member, the original deleted — or the
   * home book), `413` (over the account's limits) or `401` surfaces as a typed
   * error carrying only `.status`; offline is the thrown `fetch` itself.
   */
  async function fork(bookId) {
    const response = await fetchImpl(`${BOOKS_PATH}/${encodeURIComponent(bookId)}/fork`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) throw refuse(response);
    return response.json();
  }

  /**
   * End the caller's own membership of a shared book (DELETE
   * /api/books/{bookId}/membership → 204, no body — leaveBook, api/openapi.yaml
   * L668-692; workflow 10 §Leaving a book; books.leave). A `404` (not a member —
   * already removed — or the home book), `409` (owner_cannot_leave) or `401` (no
   * session) surfaces as a typed error carrying only `.status`; offline is the
   * thrown `fetch` itself. The caller decides what a `404` means (books.leave
   * Decision 3: already left).
   */
  async function leave(bookId) {
    const response = await fetchImpl(
      `${BOOKS_PATH}/${encodeURIComponent(bookId)}/membership`,
      { method: 'DELETE', credentials: 'include' },
    );
    if (!response.ok) throw refuse(response);
  }

  return { create, list, remove, accept, fork, leave };
}
