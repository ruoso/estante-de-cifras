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
//
// An error also carries the server's `code` when the `{code, message}` body has
// one (account.recovery_email Decision 4), and the recovery-email and
// passkey-delete calls type their codes into kinds of their own: 429 →
// `rate_limited`, `link_invalid`, `address_taken`, `passkey_refused` →
// `refused`, `confirm_by_email`, `last_way_in` and `bad_request`. The view words
// each kind itself; the server's English `message` is never read.

export class AuthError extends Error {
  constructor(kind, status, code) {
    super(kind);
    this.name = 'AuthError';
    // 'unauthorized' | 'network' | 'not_found' | 'mismatch' | 'rate_limited' |
    // 'link_invalid' | 'address_taken' | 'refused' | 'confirm_by_email' |
    // 'last_way_in' | 'bad_request'
    this.kind = kind;
    this.status = status ?? null;
    this.code = code ?? null;
  }
}

// The server's error `code`, read from a `{code, message}` body when one is
// present; null when the body is absent or not JSON. Only the code is kept.
async function codeOf(response) {
  try {
    const body = await response.json();
    return typeof body?.code === 'string' ? body.code : null;
  } catch {
    return null;
  }
}

// The kinds a recovery-email or passkey-delete answer types into, by code.
const KIND_BY_CODE = {
  link_invalid: 'link_invalid',
  address_taken: 'address_taken',
  passkey_refused: 'refused',
  confirm_by_email: 'confirm_by_email',
  last_way_in: 'last_way_in',
  bad_request: 'bad_request',
};

// Type a non-ok response into an AuthError: 401 → unauthorized, 429 →
// rate_limited, a known code → its kind, anything else (a 5xx, a surprise) →
// network.
async function failureOf(response) {
  const code = await codeOf(response);
  if (response.status === 401) return new AuthError('unauthorized', response.status, code);
  if (response.status === 429) return new AuthError('rate_limited', response.status, code);
  const kind = code ? KIND_BY_CODE[code] : undefined;
  return new AuthError(kind ?? 'network', response.status, code);
}

// An answer with no body to keep (202/204): ok → done, else the typed failure.
async function emptyOf(response) {
  if (response.ok) return undefined;
  throw await failureOf(response);
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
  // 409 last_way_in: the account's last passkey with no recovery email
  // (account.recovery_email; workflow 13 §The last way in).
  if (response.status === 409) throw await failureOf(response);
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
    // Sign out of THIS device (account.sign_out; api/openapi.yaml signOut, line
    // 211). Clears the session cookie server-side; the app never reads or clears
    // the cookie itself (sign_in Decision: the session is the service's). 204 on
    // success, 401 when there is no session — the device is already account-free
    // either way, so the caller tears down locally first and treats both as done
    // (the teardown must not wait on the network, Decision 4).
    async signOut() {
      const response = await postJson(fetchImpl, '/api/auth/signout', {});
      if (response.ok) return undefined;
      if (response.status === 401) throw new AuthError('unauthorized', response.status);
      throw new AuthError('network', response.status);
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

    // --- deleting the account (account.leaving, workflow 17) ----------------
    // DELETE /api/account with the typed confirmation in the body
    // (`{ confirm: <email> }`, api/openapi.yaml deleteAccount). The server
    // compares it to the account's own email and never echoes the address
    // (Decision 4; the EmailLinkRequest precedent). This is the one call in the
    // app that waits for a connection (workflow 17 §Offline), so a thrown fetch
    // surfaces as `network` and the Worker device teardown runs only on the 204.
    // 204 → done; 400 → `mismatch` (the typed address was wrong — the dialog
    // stays open and words it, never showing the real one); 401 → unauthorized.
    async deleteAccount(confirmEmail) {
      let response;
      try {
        response = await fetchImpl('/api/account', {
          method: 'DELETE',
          headers: JSON_HEADERS,
          credentials: 'same-origin',
          body: JSON.stringify({ confirm: confirmEmail }),
        });
      } catch {
        throw new AuthError('network');
      }
      if (response.ok) return undefined;
      if (response.status === 400) throw new AuthError('mismatch', response.status);
      if (response.status === 401) throw new AuthError('unauthorized', response.status);
      throw new AuthError('network', response.status);
    },

    // --- deleting a passkey-only account (workflow 17 §An account with no email)
    // begin → `{ publicKey, state }`: a non-discoverable assertion over the
    // account's own passkeys, sealed for deletion. 400 `confirm_by_email` when
    // the account has a confirmed email (it confirms by the typed field instead).
    async beginDeletePasskey() {
      const response = await postJson(fetchImpl, '/api/account/delete/begin', {});
      if (response.ok) return response.json();
      throw await failureOf(response);
    },
    // DELETE /api/account with `{ passkey: { state, credential } }` → 204. 400
    // `passkey_refused` → `refused`; 400 `confirm_mismatch` (the account gained
    // an email since begin — the wrong branch) → `confirm_by_email`, so the
    // dialog switches to the typed field.
    async deleteAccountByPasskey({ state, credential }) {
      let response;
      try {
        response = await fetchImpl('/api/account', {
          method: 'DELETE',
          headers: JSON_HEADERS,
          credentials: 'same-origin',
          body: JSON.stringify({ passkey: { state, credential } }),
        });
      } catch {
        throw new AuthError('network');
      }
      if (response.ok) return undefined;
      const failure = await failureOf(response);
      if (failure.code === 'confirm_mismatch') {
        throw new AuthError('confirm_by_email', failure.status, failure.code);
      }
      throw failure;
    },

    // --- the recovery email (account.recovery_email; workflow 13) ------------
    // Plain session HTTP, like sessions and passkeys: nothing touches the Worker,
    // IndexedDB or a book. The address is kept to these bodies and never logged.
    // GET → `{ email, pending }`, both nullable (`pending` is still reported
    // after it expires, so the region keeps offering Send again).
    async getRecoveryEmail() {
      return getJson(fetchImpl, '/api/account/recovery-email');
    },
    // POST `{ email }` → 202, always (it reveals nothing about who holds the
    // address); 400 → `bad_request`; 429 → `rate_limited`.
    async requestRecoveryEmail(email) {
      return emptyOf(await postJson(fetchImpl, '/api/account/recovery-email', { email }));
    },
    // POST `{ token }` with no session → 204 (confirmed). 400 → `link_invalid`
    // (expired, used, tampered or unknown); 409 → `address_taken`; 429 →
    // `rate_limited`. Sets no cookie: it never signs in.
    async confirmRecoveryEmail(token) {
      return emptyOf(await postJson(fetchImpl, '/api/recovery-email/confirm', { token }));
    },
  };
}
