// account-client.js — the Worker's `/api/account/home-book` HTTP client
// (account.new_device Decision 1). Signing in makes the device the account's:
// the Worker asks the service where the account's home book is and attaches it
// as the home book's remote (workflow 13 §What comes down). A sibling of
// books-client.js, under the same rules:
//   - `credentials: 'include'` so the browser's session cookie flows (same
//     origin); the client reads no cookie and stores no token;
//   - a `401` is "not signed in" and rides the thrown error's `.status`, so the
//     caller ends quietly — nothing is attached (Constraints);
//   - it logs nothing: not the id, not the URL.
// The response is the `HomeBook` schema of api/openapi.yaml (`{ id, gitUrl }`).
//
// Framework-free, Worker-only: plain ESM, no React, no DOM beyond `fetch`.

const HOME_BOOK_PATH = '/api/account/home-book';

/**
 * Build the client. `options.fetch` injects a `fetch` (a behavior test serves
 * the contract through it); it defaults to the global one.
 *
 * @param {{ fetch?: typeof globalThis.fetch }} [options]
 * @returns {{ homeBook: () => Promise<{ id: string, gitUrl: string }> }}
 */
export function createAccountClient(options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  /**
   * The account's home book (GET /api/account/home-book → 200 HomeBook). A
   * `401` (no session) or any other non-2xx throws an error carrying only
   * `.status`; a network failure throws as `fetch` does (no `.status`).
   */
  async function homeBook() {
    const response = await fetchImpl(HOME_BOOK_PATH, { method: 'GET', credentials: 'include' });
    if (!response.ok) {
      const err = new Error(`home-book: ${response.status}`);
      err.status = response.status;
      throw err;
    }
    const body = await response.json();
    if (!body || typeof body.id !== 'string' || typeof body.gitUrl !== 'string') {
      throw new Error('home-book: malformed');
    }
    return { id: body.id, gitUrl: body.gitUrl };
  }

  return { homeBook };
}
