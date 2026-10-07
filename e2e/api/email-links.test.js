/**
 * e2e-api — the emailed sign-in link, end to end (workflow 13, the WebAuthn
 * fallback and account-recovery path).
 *
 * Pins the .tji note's e2e clause: "request a link, read it from the mail
 * catcher, redeem it into a session — workflow 13". Black-box against the
 * compose stack over HTTP and the Mailpit HTTP API; the one exception is
 * seeding the fixture account's recovery email through Postgres, which no
 * landed endpoint yet sets (service.email_links refinement, Decisions). A
 * unique recipient per run keeps the shared catcher collision-free under the
 * ≤4-worker run.
 */
import { describe, it, expect } from 'vitest';

import { HttpClient } from './lib/http.js';
import { waitForMessageTo, extractLink } from './lib/mail.js';
import { seedAccount } from './lib/db.js';

function uniqueId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

describe('emailed sign-in link (workflow 13)', () => {
  it('requests a link, reads it from the catcher, and redeems it into a session', async () => {
    const email = `signin-${uniqueId()}@estante.test`;
    const accountId = await seedAccount(email);

    const client = new HttpClient();

    // Request: a device asks for a link; the service answers 202 and mails one.
    const requested = await client.postJson('/api/auth/email/request', { email });
    expect(requested.status).toBe(202);

    // Read it from the catcher, as a user's mail client would, and pull the
    // token the /sign-in/<token> link carries.
    const message = await waitForMessageTo(email);
    expect(message, 'the sign-in mail should arrive at the catcher').not.toBeNull();

    const link = extractLink(message, /https?:\/\/\S*\/sign-in\/\S+/);
    expect(link, 'the mail should carry a /sign-in/<token> link').not.toBeNull();
    const token = link.slice(link.indexOf('/sign-in/') + '/sign-in/'.length).replace(/[\s"'<>]+$/, '');
    expect(token.length).toBeGreaterThan(0);

    // Redeem: the token signs the device in. The response is the Account and
    // the session cookie, which the client now carries on one origin.
    const redeemed = await client.postJson('/api/auth/email/redeem', { token });
    expect(redeemed.status).toBe(200);
    const account = await redeemed.json();
    expect(account.id).toBe(accountId);
    expect(client.cookies.has('estante_session')).toBe(true);
    expect(client.cookies.get('estante_session')).toBeTruthy();

    // Single use: a second redeem of the same token is refused.
    const second = await client.postJson('/api/auth/email/redeem', { token });
    expect(second.status).toBe(401);
  });

  it('answers 202 for an address with no account, mailing nothing', async () => {
    // No account holds this address, so the response is indistinguishable from
    // the account-exists case (202) but nothing is mailed (openapi.yaml:169-172).
    const email = `nobody-${uniqueId()}@estante.test`;
    const client = new HttpClient();

    const requested = await client.postJson('/api/auth/email/request', { email });
    expect(requested.status).toBe(202);

    const message = await waitForMessageTo(email, { timeout: 1500 });
    expect(message, 'no mail should be sent for an address with no account').toBeNull();
  });
});
