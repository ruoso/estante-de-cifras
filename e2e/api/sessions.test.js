/**
 * e2e-api — sessions and devices, end to end (workflow 13 §The account screen,
 * §Signing out; service.sessions refinement).
 *
 * Black-box against the compose stack over HTTP, with the cookie-jar
 * HttpClient standing in for a device's browser on the one origin (DIRECTION
 * §3.3 line 206). Sign-in is the emailed link — a fixture account's recovery
 * email is seeded through Postgres (no landed endpoint sets accounts.email),
 * then the link is read from the Mailpit catcher, as email-links.test.js does.
 * A unique recipient per run keeps the shared catcher collision-free.
 *
 * Pins the note's named e2e: a session carried across calls; a signed-out
 * device refused at its next request; and signing another device out from one.
 */
import { describe, it, expect } from 'vitest';

import { HttpClient } from './lib/http.js';
import { seedAccount } from './lib/db.js';
import { listMessages, getMessage, extractLink } from './lib/mail.js';

function uniqueId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Poll the catcher for a message to `recipient` whose id is not already in
// `seenIds` — so a second requested link is read rather than the first,
// without clearing the shared mailbox (which other parallel tests share).
async function waitForNewMessageTo(recipient, seenIds, { timeout = 5000, interval = 100 } = {}) {
  const deadline = Date.now() + timeout;
  const target = recipient.toLowerCase();
  for (;;) {
    const { messages } = await listMessages();
    const summary = (messages ?? []).find(
      (m) => !seenIds.has(m.ID) && (m.To ?? []).some((a) => (a.Address ?? '').toLowerCase() === target),
    );
    if (summary) {
      seenIds.add(summary.ID);
      return getMessage(summary.ID);
    }
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

// Sign `client` in for `email` via the emailed link: request, read a fresh link
// from the catcher, redeem it into a session the client now carries.
async function signInViaEmail(client, email, seenIds) {
  const requested = await client.postJson('/api/auth/email/request', { email });
  expect(requested.status).toBe(202);

  const message = await waitForNewMessageTo(email, seenIds);
  expect(message, 'the sign-in mail should arrive at the catcher').not.toBeNull();
  const link = extractLink(message, /https?:\/\/\S*\/sign-in\/\S+/);
  expect(link, 'the mail should carry a /sign-in/<token> link').not.toBeNull();
  const token = link.slice(link.indexOf('/sign-in/') + '/sign-in/'.length).replace(/[\s"'<>]+$/, '');

  const redeemed = await client.postJson('/api/auth/email/redeem', { token });
  expect(redeemed.status).toBe(200);
  expect(client.cookies.has('estante_session')).toBe(true);
  return redeemed.json();
}

describe('sessions and devices (workflow 13)', () => {
  it('carries a session across calls and lists the current device', async () => {
    const email = `sessions-${uniqueId()}@estante.test`;
    const accountId = await seedAccount(email);
    const seen = new Set();

    const client = new HttpClient();
    const account = await signInViaEmail(client, email, seen);
    expect(account.id).toBe(accountId);

    // The same client, on one origin, reaches an authenticated route and sees
    // its own session listed, marked current.
    const listResp = await client.get('/api/account/sessions');
    expect(listResp.status).toBe(200);
    const { sessions } = await listResp.json();
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBe(1);
    expect(sessions[0].current).toBe(true);
    expect(sessions[0]).toHaveProperty('lastUsedAt');
  });

  it('refuses a signed-out device at its next request', async () => {
    const email = `signout-${uniqueId()}@estante.test`;
    await seedAccount(email);
    const seen = new Set();

    const client = new HttpClient();
    await signInViaEmail(client, email, seen);
    // The real session value this device holds, to replay after sign-out.
    const sessionValue = client.cookies.get('estante_session');
    expect(sessionValue).toBeTruthy();

    // Sign out: 204, and the session cookie is cleared from the jar.
    const out = await client.fetch('/api/auth/signout', { method: 'POST' });
    expect(out.status).toBe(204);
    expect(client.cookies.has('estante_session')).toBe(false);

    // Replaying the very session that was signed out no longer resolves — the
    // row was revoked, so a lingering or copied cookie is refused too.
    const stale = await fetch(client.url('/api/account/sessions'), {
      method: 'GET',
      headers: { cookie: `estante_session=${sessionValue}` },
    });
    expect(stale.status).toBe(401);
  });

  it('signs another device out from one', async () => {
    const email = `revoke-${uniqueId()}@estante.test`;
    await seedAccount(email);
    const seen = new Set();

    // Two devices on one account: two links, two redeems, two sessions.
    const deviceA = new HttpClient();
    const deviceB = new HttpClient();
    await signInViaEmail(deviceA, email, seen);
    await signInViaEmail(deviceB, email, seen);

    // Device A lists both sessions and finds B's — the one that is not its own.
    const listResp = await deviceA.get('/api/account/sessions');
    expect(listResp.status).toBe(200);
    const { sessions } = await listResp.json();
    expect(sessions.length).toBe(2);
    const others = sessions.filter((s) => !s.current);
    expect(others.length).toBe(1);
    const bSessionId = others[0].id;

    // A signs B out; B stops working at its next request (lazy revocation).
    const revoked = await deviceA.fetch(`/api/account/sessions/${bSessionId}`, { method: 'DELETE' });
    expect(revoked.status).toBe(204);

    const bNext = await deviceB.get('/api/account/sessions');
    expect(bNext.status).toBe(401);

    // A is unaffected.
    const aStill = await deviceA.get('/api/account/sessions');
    expect(aStill.status).toBe(200);
  });
});
