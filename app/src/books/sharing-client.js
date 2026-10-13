// The main-thread sharing-management REST client (books.share Decision 1): a
// small, plain `fetch` module over the `Sharing` endpoints of the API contract
// (api/openapi.yaml tag Sharing, L410-546). It mirrors account/auth-client.js —
// same-origin fetch, JSON bodies, no CORS and no Authorization header; the
// `estante_session` cookie `credentials: 'include'` carries flows on its own.
//
// It runs on the MAIN thread, not through the Worker (Decision 1): list-members,
// list/create/withdraw-invitation and change-role/remove-member touch NO
// Worker-owned data (git, the working copy, the search index) and have no local
// projection — they are request/response server-registry state, like sign-in.
// The Worker's books-client.js stays Worker-side precisely because create/accept/
// remove each have a git/index follow-on; these six have none.
//
// It logs NOTHING — no ids, titles, tokens, session or book content (Constraints:
// no secrets in logs). Refusals surface as typed, status-bearing errors carrying
// only `code`/`status` for the view to word (mirroring books-client.js): a 404
// conflates "no such book" and "not a member" so a private book is never
// confirmed to a stranger; a 403 is a signed-in member attempting an owner-only
// action; a 401 is no session; a thrown fetch (offline, DNS, blocked) is a
// `network` error. Nothing in an error names the user or the book.

export class SharingError extends Error {
  constructor(status, code) {
    super(code ?? 'sharing_error');
    this.name = 'SharingError';
    this.status = status ?? null; // the HTTP status, or null for an unreachable service
    this.code = code ?? null; // the Error.code from the body, or 'network' when thrown
  }
}

const JSON_HEADERS = { 'content-type': 'application/json' };

// Percent-encode one opaque path segment (a book id, user id or invitation id):
// they are server-assigned and opaque, so encoding is always safe.
const seg = (value) => encodeURIComponent(String(value));

// A same-origin fetch that turns a thrown request (offline, DNS, blocked) into a
// `network` SharingError carrying nothing about the request.
async function send(fetchImpl, path, { method = 'GET', body } = {}) {
  try {
    return await fetchImpl(path, {
      method,
      headers: body === undefined ? undefined : JSON_HEADERS,
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new SharingError(null, 'network');
  }
}

// The `Error.code` from a refusal body, read defensively (the body may be empty
// or not JSON). Only the code is read — never the message, which is not shown.
async function codeOf(response) {
  try {
    const body = await response.json();
    const code = body?.code;
    return typeof code === 'string' && code ? code : null;
  } catch {
    return null;
  }
}

// A response that should carry a JSON body: the parsed body on 2xx, else a typed
// SharingError carrying only the status and the body's code.
async function bodyOf(response) {
  if (response.ok) return response.json();
  throw new SharingError(response.status, await codeOf(response));
}

// A response that should be an empty 2xx (a 204): nothing on success, else a
// typed SharingError.
async function emptyOf(response) {
  if (response.ok) return undefined;
  throw new SharingError(response.status, await codeOf(response));
}

// Build a client bound to a fetch implementation. The behavior level injects a
// loopback double; the app and e2e use the browser's `fetch` (bound lazily so the
// live global is used, never captured).
export function createSharingClient({ fetch: injected } = {}) {
  const fetchImpl = injected ?? ((...args) => globalThis.fetch(...args));
  const base = (bookId) => `/api/books/${seg(bookId)}`;

  return {
    // GET /api/books/{bookId}/members → MemberList (any member; a stranger 404s).
    async listMembers(bookId) {
      return bodyOf(await send(fetchImpl, `${base(bookId)}/members`));
    },

    // GET /api/books/{bookId}/invitations → InvitationList (owner only).
    async listInvitations(bookId) {
      return bodyOf(await send(fetchImpl, `${base(bookId)}/invitations`));
    },

    // POST /api/books/{bookId}/invitations → Invitation WITH its url (owner only,
    // the one time the raw token is returned). The body carries only the keys the
    // owner set: role (required), and expiry / useLimit when chosen.
    async createInvitation(bookId, { role, expiry, useLimit } = {}) {
      const body = { role };
      if (expiry !== undefined && expiry !== null) body.expiry = expiry;
      if (useLimit !== undefined && useLimit !== null) body.useLimit = useLimit;
      return bodyOf(await send(fetchImpl, `${base(bookId)}/invitations`, { method: 'POST', body }));
    },

    // DELETE /api/books/{bookId}/invitations/{invitationId} → 204 (owner only).
    async withdrawInvitation(bookId, invitationId) {
      return emptyOf(
        await send(fetchImpl, `${base(bookId)}/invitations/${seg(invitationId)}`, {
          method: 'DELETE',
        }),
      );
    },

    // PATCH /api/books/{bookId}/members/{userId} → Member (owner only, lazy).
    async changeMemberRole(bookId, userId, role) {
      return bodyOf(
        await send(fetchImpl, `${base(bookId)}/members/${seg(userId)}`, {
          method: 'PATCH',
          body: { role },
        }),
      );
    },

    // DELETE /api/books/{bookId}/members/{userId} → 204 (owner only, lazy).
    async removeMember(bookId, userId) {
      return emptyOf(
        await send(fetchImpl, `${base(bookId)}/members/${seg(userId)}`, { method: 'DELETE' }),
      );
    },
  };
}
