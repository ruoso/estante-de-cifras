// The main-thread authentication REST client (account.sign_in Decision 1): a
// small, plain `fetch` module over the `/api/auth/*` and `/api/account/passkeys`
// endpoints (api/openapi.yaml). It is the app's first deliberate non-git network
// consumer. It runs on the main thread because WebAuthn does (`navigator.
// credentials` is absent in a Worker), and it touches no IndexedDB/git/index, so
// it does not cross the Worker boundary (DIRECTION §3.7; Constraints).
//
// One origin, same-origin fetch, JSON bodies, no CORS and no `Authorization`
// header — the `estante_session` cookie the service sets on a successful
// finish/redeem flows on its own (DIRECTION §3.3 lines 171-173). The client
// stores no token and reads no cookie; "signed in" is known only from a
// response (the `Account` a finish/redeem returns). It logs nothing — no
// address, token, credential or account id (Constraints: no secrets in logs).
//
// Errors are typed so the surface can word them (Constraints): `unauthorized`
// for a 401 (a passkey that did not work, an expired/used link) and `network`
// for an unreachable service or a 5xx (offline, a server fault) — both the
// retryable "couldn't reach Estante" case. Nothing in an error names the user.

export class AuthError extends Error {
  constructor(kind, status) {
    super(kind);
    this.name = 'AuthError';
    this.kind = kind; // 'unauthorized' | 'network' | 'not_found'
    this.status = status ?? null;
  }
}

const JSON_HEADERS = { 'content-type': 'application/json' };

// A same-origin JSON POST. A thrown fetch (offline, DNS, blocked) becomes a
// `network` AuthError carrying nothing about the request.
async function postJson(fetchImpl, path, body) {
  try {
    return await fetchImpl(path, {
      method: 'POST',
      headers: JSON_HEADERS,
      credentials: 'same-origin',
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AuthError('network');
  }
}

// A response that should carry an `Account { id }` JSON body: 200 → the body;
// 401 → unauthorized; anything else (a 5xx, a surprise) → network.
async function accountOf(response) {
  if (response.ok) return response.json();
  if (response.status === 401) throw new AuthError('unauthorized', response.status);
  throw new AuthError('network', response.status);
}

// A `begin` response: 200 → `{ publicKey, state }`; anything else → network
// (a begin has no user-facing 401 — authenticate/begin is public).
async function optionsOf(response) {
  if (response.ok) return response.json();
  throw new AuthError('network', response.status);
}

// A same-origin GET (the account-management reads: sessions, passkeys). A thrown
// fetch (offline, DNS, blocked) becomes a `network` AuthError carrying nothing.
async function getJson(fetchImpl, path) {
  let response;
  try {
    response = await fetchImpl(path, { method: 'GET', credentials: 'same-origin' });
  } catch {
    throw new AuthError('network');
  }
  if (response.ok) return response.json();
  if (response.status === 401) throw new AuthError('unauthorized', response.status);
  throw new AuthError('network', response.status);
}

// A same-origin DELETE (revoke a session, remove a passkey): 204 → ok; 401 →
// unauthorized; 404 → not_found (already gone — the caller reconciles the row
// away); anything else → network. A thrown fetch is a `network` error.
async function del(fetchImpl, path) {
  let response;
  try {
    response = await fetchImpl(path, { method: 'DELETE', credentials: 'same-origin' });
  } catch {
    throw new AuthError('network');
  }
  if (response.ok) return undefined;
  if (response.status === 401) throw new AuthError('unauthorized', response.status);
  if (response.status === 404) throw new AuthError('not_found', response.status);
  throw new AuthError('network', response.status);
}

// Percent-encode one opaque, server-assigned path segment (a session or passkey
// id): opaque so encoding is always safe.
const seg = (value) => encodeURIComponent(String(value));

// Build a client bound to a fetch implementation. The behavior level injects a
// loopback double; the app and e2e use the browser's `fetch` (bound lazily so
// the live global is used, never captured).
export function createAuthClient({ fetch: injected } = {}) {
  const fetchImpl = injected ?? ((...args) => globalThis.fetch(...args));

  return {
    // --- passkey registration (register/{begin,finish}) ---------------------
    // Public or authed: with no session, `finish` creates a new account and
    // starts a session (the primary account-creation path); with a session it
    // adds a passkey to this account (the offer-a-passkey case).
    async registerBegin(label) {
      const body = label ? { label } : {};
      return optionsOf(await postJson(fetchImpl, '/api/auth/passkey/register/begin', body));
    },
    async registerFinish({ state, credential, label }) {
      const body = label ? { state, credential, label } : { state, credential };
      return accountOf(await postJson(fetchImpl, '/api/auth/passkey/register/finish', body));
    },

    // --- passkey sign-in (authenticate/{begin,finish}) ----------------------
    async authenticateBegin() {
      return optionsOf(await postJson(fetchImpl, '/api/auth/passkey/authenticate/begin', {}));
    },
    async authenticateFinish({ state, credential }) {
      return accountOf(
        await postJson(fetchImpl, '/api/auth/passkey/authenticate/finish', { state, credential }),
      );
    },

    // --- emailed link (email/{request,redeem}) ------------------------------
    // request is always 202 — the response reveals nothing about who has an
    // account (service/email_links.md); the address is kept to this body.
    async requestEmailLink(email) {
      const response = await postJson(fetchImpl, '/api/auth/email/request', { email });
      if (response.status === 202 || response.ok) return;
      throw new AuthError('network', response.status);
    },
    async redeemEmailLink(token) {
      return accountOf(await postJson(fetchImpl, '/api/auth/email/redeem', { token }));
    },

    // --- session management (account/sessions) ------------------------------
    // The account screen's signed-in-devices roster (workflow 13 §Signed-in
    // devices; api/openapi.yaml listSessions/revokeSession). listSessions is also
    // how the screen learns it is signed in at all — 200 under a session, 401
    // without one (Constraints: the session is a cookie the app never reads).
    // revokeSession signs out ANOTHER device; a 404 means it was already gone.
    async listSessions() {
      return getJson(fetchImpl, '/api/account/sessions');
    },
    async revokeSession(sessionId) {
      return del(fetchImpl, `/api/account/sessions/${seg(sessionId)}`);
    },

    // --- passkey management (account/passkeys) ------------------------------
    // The account screen's passkeys roster (workflow 13 §Passkeys;
    // api/openapi.yaml listPasskeys/removePasskey). "Add a passkey to this device"
    // reuses registerBegin/registerFinish above (the authed register path).
    async listPasskeys() {
      return getJson(fetchImpl, '/api/account/passkeys');
    },
    async removePasskey(passkeyId) {
      return del(fetchImpl, `/api/account/passkeys/${seg(passkeyId)}`);
    },
  };
}
