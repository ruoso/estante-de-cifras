/**
 * e2e-api — the recovery email, end to end (service.recovery_email; workflow 13
 * §The recovery email, §The last way in).
 *
 * Black-box against the compose stack over HTTP and the Mailpit HTTP API, with
 * accounts made the way a device makes them (the passkey ceremony driving the
 * JS software authenticator) and no seeded email: the address is set through
 * the verification link the service mails. A unique address per run keeps the
 * shared catcher collision-free under the ≤4-worker run.
 *
 * Pins the .tji note's first e2e-api clause: a recovery email set, verified
 * from the mailed link on a device with no session (which it does not sign
 * in), then used for an emailed sign-in into the same account; a change that
 * mails the old address a link-less notice; and the last passkey kept until an
 * email is confirmed.
 */
import { describe, it, expect } from 'vitest';

import { HttpClient } from './lib/http.js';
import { baseUrl } from './lib/env.js';
import { Authenticator } from './lib/authenticator.js';
import { latestMessageTo, extractLink } from './lib/mail.js';

function uniqueId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

async function registerNewAccount(client) {
  const beginResp = await client.postJson('/api/auth/passkey/register/begin', {});
  expect(beginResp.status).toBe(200);
  const begin = await beginResp.json();
  const credential = await new Authenticator(baseUrl).create(begin.publicKey);
  const finishResp = await client.postJson('/api/auth/passkey/register/finish', {
    state: begin.state,
    credential,
  });
  expect(finishResp.status).toBe(200);
  return (await finishResp.json()).id;
}

// Poll for the newest message to `recipient` that `accept` takes — an address
// here gets several mails in turn (a verification link, then a sign-in link or
// a notice), so the newest one may still be the previous until the next lands.
async function waitForMail(recipient, accept, { timeout = 5000, interval = 100 } = {}) {
  const deadline = Date.now() + timeout;
  for (;;) {
    const message = await latestMessageTo(recipient);
    if (message && accept(message)) return message;
    if (Date.now() >= deadline) return null;
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

const RECOVERY_LINK = /https?:\/\/\S*\/recovery-email\/\S+/;
const SIGN_IN_LINK = /https?:\/\/\S*\/sign-in\/\S+/;

// Ask for a verification link to `email` and return the token the mailed
// /recovery-email/<token> link carries.
async function requestAndReadToken(client, email) {
  const requested = await client.postJson('/api/account/recovery-email', { email });
  expect(requested.status).toBe(202);
  const message = await waitForMail(email, (m) => extractLink(m, RECOVERY_LINK) !== null);
  expect(message, 'the verification mail should arrive at the catcher').not.toBeNull();
  const link = extractLink(message, RECOVERY_LINK);
  return link.slice(link.indexOf('/recovery-email/') + '/recovery-email/'.length).replace(/[\s"'<>]+$/, '');
}

// Confirm on a fresh device with no session, as opening the mail elsewhere
// would; it must set no session cookie.
async function confirmElsewhere(token) {
  const device = new HttpClient();
  const confirmed = await device.postJson('/api/recovery-email/confirm', { token });
  expect(confirmed.status).toBe(204);
  expect(device.cookies.has('estante_session')).toBe(false);
}

// Sign in by an emailed link to `email` on a fresh device; returns the account id.
async function signInByEmail(email) {
  const device = new HttpClient();
  expect((await device.postJson('/api/auth/email/request', { email })).status).toBe(202);
  const message = await waitForMail(email, (m) => extractLink(m, SIGN_IN_LINK) !== null);
  expect(message, 'the sign-in mail should arrive at the catcher').not.toBeNull();
  const link = extractLink(message, SIGN_IN_LINK);
  const token = link.slice(link.indexOf('/sign-in/') + '/sign-in/'.length).replace(/[\s"'<>]+$/, '');
  const redeemed = await device.postJson('/api/auth/email/redeem', { token });
  expect(redeemed.status).toBe(200);
  expect(device.cookies.has('estante_session')).toBe(true);
  return (await redeemed.json()).id;
}

describe('the recovery email (workflow 13)', () => {
  it('is set, verified from the mail without signing in, then used for an emailed sign-in', async () => {
    const owner = new HttpClient();
    const accountId = await registerNewAccount(owner);
    const email = `recovery-${uniqueId()}@estante.test`;

    expect(await owner.getJson('/api/account/recovery-email')).toEqual({ email: null, pending: null });
    const token = await requestAndReadToken(owner, email);
    expect(await owner.getJson('/api/account/recovery-email')).toEqual({ email: null, pending: email });

    await confirmElsewhere(token);
    expect(await owner.getJson('/api/account/recovery-email')).toEqual({ email, pending: null });

    // The confirmed address is now a way in: an emailed sign-in reaches it and
    // signs a new device into the same account.
    expect(await signInByEmail(email)).toBe(accountId);
  });

  it('a change mails the old address a notice with no link, and the new one signs in', async () => {
    const owner = new HttpClient();
    const accountId = await registerNewAccount(owner);
    const oldEmail = `old-${uniqueId()}@estante.test`;
    const newEmail = `new-${uniqueId()}@estante.test`;

    await confirmElsewhere(await requestAndReadToken(owner, oldEmail));
    const token = await requestAndReadToken(owner, newEmail);
    expect(await owner.getJson('/api/account/recovery-email')).toEqual({ email: oldEmail, pending: newEmail });
    await confirmElsewhere(token);
    expect(await owner.getJson('/api/account/recovery-email')).toEqual({ email: newEmail, pending: null });

    // The newest mail to the old address is the change notice: no link, and
    // not the new address.
    const notice = await waitForMail(oldEmail, (m) => /changed/i.test(m.Subject ?? ''));
    expect(notice, 'the change notice should arrive at the old address').not.toBeNull();
    expect(extractLink(notice)).toBeNull();
    expect(`${notice.Text ?? ''}${notice.HTML ?? ''}`).not.toContain(newEmail);

    expect(await signInByEmail(newEmail)).toBe(accountId);
  });

  it('keeps the last passkey until an email is confirmed', async () => {
    const owner = new HttpClient();
    await registerNewAccount(owner);
    const { passkeys } = await owner.getJson('/api/account/passkeys');
    expect(passkeys).toHaveLength(1);
    const remove = () => owner.fetch(`/api/account/passkeys/${passkeys[0].id}`, { method: 'DELETE' });

    const refused = await remove();
    expect(refused.status).toBe(409);
    expect((await refused.json()).code).toBe('last_way_in');
    expect((await owner.getJson('/api/account/passkeys')).passkeys).toHaveLength(1);

    const email = `last-${uniqueId()}@estante.test`;
    await confirmElsewhere(await requestAndReadToken(owner, email));
    expect((await remove()).status).toBe(204);
  });
});
