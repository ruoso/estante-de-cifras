// change-check-client.js — the Worker's change-check HTTP client (sync.engine).
// The sync engine's second non-git network consumer, a sibling of git-http.js:
// it POSTs `/api/shelf/change-check` to learn which hosted books moved, so a
// pass fetches only those (DIRECTION §3.3 L195-198, 366-367; workflow 8 L21-24).
//
// Like git-http.js it is the one choke point for this request, so the same three
// rules live here and nowhere else:
//   - `credentials: 'include'` on the request, so the browser's session cookie
//     flows to the service that authorises the shelf (DIRECTION §3.3 L206-211;
//     "every request for a book needs a session"). The client stores no
//     credentials and reads no cookie.
//   - it logs nothing: not the book ids, not the heads, not the response. A book
//     id is account data (standing no-logging rule, mirroring git-http.js:19-22).
//   - errors surface as the thrown/rejected value for the caller (the engine) to
//     turn into a sync fact — never to `console`. Offline-first: the engine
//     treats any failure as "no news" and retries next pass (never an error to
//     the user — DIRECTION §1 L29-31).
//
// Framework-free, Worker-only: plain ESM, no React, no DOM beyond `fetch`.

// The one endpoint (api/openapi.yaml ChangeCheckRequest/Response L1074-1120).
const CHANGE_CHECK_PATH = '/api/shelf/change-check';

// The service caps the request at 500 books (ShelfBookHead maxItems, L1079); a
// shelf never approaches it, but the request is built to the contract.
const MAX_BOOKS = 500;

/**
 * Build the change-check client. `options.fetch` injects a `fetch` (a test
 * supplies one to drive and observe the request); it defaults to the global
 * `fetch` the real Worker provides — the same seam git-http.js uses.
 *
 * @param {{ fetch?: typeof globalThis.fetch }} [options]
 * @returns {{ check: (books: Array<{ bookId: string, head: string|null }>) =>
 *   Promise<Map<string, { bookId: string, status: 'changed'|'unchanged'|'gone', head?: string }>> }}
 */
export function createChangeCheckClient(options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  /**
   * Ask the service which of `books` moved. Each entry is `{ bookId, head }`
   * with `head` null when the device holds nothing yet (an empty book, L1070).
   * Resolves to a Map keyed by book id carrying only the books with news —
   * `changed` (with its new `head`) or `gone`; an unchanged book is omitted by
   * the service and so absent from the Map (L1114-1116). Rejects when the
   * service cannot be reached or answers non-2xx; the engine treats that as "no
   * news this pass" (offline-first).
   */
  async function check(books) {
    const payload = {
      books: books.slice(0, MAX_BOOKS).map(({ bookId, head }) => ({
        bookId,
        head: head ?? null,
      })),
    };

    const response = await fetchImpl(CHANGE_CHECK_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // The session cookie must flow so the service can authorise the shelf
      // (DIRECTION §3.3; an unauthenticated run is a 401 and simply does not
      // sync).
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // A 401 (no session), a 5xx, anything else: not news, a reason to retry
      // next pass. The caller never surfaces it (offline-first). The status
      // rides the error for the caller to branch on; no book id or head.
      const err = new Error(`change-check: ${response.status}`);
      err.status = response.status;
      throw err;
    }

    const body = await response.json();
    const map = new Map();
    for (const change of body?.books ?? []) {
      if (change?.bookId) map.set(change.bookId, change);
    }
    return map;
  }

  return { check };
}
