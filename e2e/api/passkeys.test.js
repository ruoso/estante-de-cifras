/**
 * e2e-api — passkeys, end to end (workflow 13; DIRECTION §3.6 one origin).
 *
 * Pins the .tji note's e2e clause: "register and sign in over HTTP against the
 * stack with a software authenticator". Black-box against the compose stack
 * over HTTP, driving a JS software authenticator (Node WebCrypto + CBOR) over
 * the ceremony options the API returns — exactly what a user's device would do.
 * Fixtures are synthetic accounts the flow itself creates (no seeded email, no
 * real address, no song text): first-run account creation lives in
 * register/finish (service.passkeys Decision 7).
 */
import { describe, it, expect } from 'vitest';

import { HttpClient } from './lib/http.js';
import { baseUrl } from './lib/env.js';
import { Authenticator } from './lib/authenticator.js';

async function registerNewAccount(client, authenticator) {
  const beginResp = await client.postJson('/api/auth/passkey/register/begin', {});
  expect(beginResp.status).toBe(200);
  const begin = await beginResp.json();
  expect(begin.publicKey).toBeTruthy();
  expect(begin.state).toBeTruthy();

  const credential = await authenticator.create(begin.publicKey);
  const finishResp = await client.postJson('/api/auth/passkey/register/finish', {
    state: begin.state,
    credential,
  });
  expect(finishResp.status).toBe(200);
  const account = await finishResp.json();
  expect(account.id).toBeTruthy();
  return account.id;
}

describe('passkeys (workflow 13)', () => {
  it('registers a passkey over HTTP, starting a session', async () => {
    const client = new HttpClient();
    const authenticator = new Authenticator(baseUrl);

    const accountId = await registerNewAccount(client, authenticator);

    // The finish started a session the client now carries on one origin.
    expect(client.cookies.has('estante_session')).toBe(true);
    expect(client.cookies.get('estante_session')).toBeTruthy();

    // An authenticated route succeeds with that session, and lists the passkey.
    const listResp = await client.get('/api/account/passkeys');
    expect(listResp.status).toBe(200);
    const list = await listResp.json();
    expect(Array.isArray(list.passkeys)).toBe(true);
    expect(list.passkeys.length).toBe(1);
    expect(list.passkeys[0].id).toBeTruthy();
    expect(list.passkeys[0]).toHaveProperty('createdAt');

    // The account id is tied to the session, not a client-chosen value.
    expect(accountId).toBeTruthy();
  });

  it('signs in with the passkey from a fresh client', async () => {
    // Register on one client/device.
    const registrar = new HttpClient();
    const authenticator = new Authenticator(baseUrl);
    const accountId = await registerNewAccount(registrar, authenticator);

    // Sign in on a fresh client (a new device, no cookie) via discoverable
    // sign-in — no username sent (workflow 13 §same ecosystem).
    const client = new HttpClient();
    const beginResp = await client.postJson('/api/auth/passkey/authenticate/begin', {});
    expect(beginResp.status).toBe(200);
    const begin = await beginResp.json();

    const credential = await authenticator.get(begin.publicKey);
    const finishResp = await client.postJson('/api/auth/passkey/authenticate/finish', {
      state: begin.state,
      credential,
    });
    expect(finishResp.status).toBe(200);
    const account = await finishResp.json();
    expect(account.id).toBe(accountId);
    expect(client.cookies.has('estante_session')).toBe(true);
  });

  it('refuses an unknown credential with 401', async () => {
    // The authenticator makes a resident credential by beginning and "creating"
    // a registration, but the client never finishes it — so nothing is stored.
    const client = new HttpClient();
    const authenticator = new Authenticator(baseUrl);
    const beginResp = await client.postJson('/api/auth/passkey/register/begin', {});
    expect(beginResp.status).toBe(200);
    const begin = await beginResp.json();
    await authenticator.create(begin.publicKey);

    // Signing in with that unknown credential is refused, with no session.
    const signInClient = new HttpClient();
    const aBeginResp = await signInClient.postJson('/api/auth/passkey/authenticate/begin', {});
    expect(aBeginResp.status).toBe(200);
    const aBegin = await aBeginResp.json();
    const credential = await authenticator.get(aBegin.publicKey);
    const finishResp = await signInClient.postJson('/api/auth/passkey/authenticate/finish', {
      state: aBegin.state,
      credential,
    });
    expect(finishResp.status).toBe(401);
    expect(signInClient.cookies.has('estante_session')).toBe(false);
  });
});
