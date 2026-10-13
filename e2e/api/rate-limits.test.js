/**
 * e2e-api — abuse-prone requests are rate-limited (service.rate_limits;
 * DIRECTION §3.3).
 *
 * Pins the .tji note's e2e clause, "repeated sign-in attempts limited against
 * the stack", via the emailed sign-in link — a sign-in attempt (workflow 13's
 * fallback path). Of the four limits this one is chosen for e2e (Decision 4)
 * because its key is an email address the test fully controls and no other test
 * shares, so firing the burst is deterministic and isolated, with no
 * window-timing assumptions and no risk of tripping (or being tripped by)
 * another test that shares the stack's single client IP. The IP-keyed sign-in
 * limiter and the account-keyed limiters are pinned at the behavior level, where
 * the test controls the IP and mints its own accounts.
 *
 * The per-address default is EmailLinksPerHourPerAddress (5) in
 * service/internal/ratelimit; this test fires that many + 1 for one unique,
 * account-less address (every request is answered 202 up to the cap, since the
 * address has no account) and asserts the extra is 429 with Retry-After, while a
 * different address is still served.
 */
import { describe, it, expect } from 'vitest';

import { HttpClient } from './lib/http.js';

// Must match EmailLinksPerHourPerAddress in service/internal/ratelimit (a Go
// const the JS side cannot import); the gate runs both, so a change there that
// is not mirrored here fails this test rather than passing silently.
const PER_ADDRESS_LIMIT = 5;

function uniqueId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

describe('rate limits (service.rate_limits)', () => {
  it('limits repeated emailed sign-in link requests for one address, serving others', async () => {
    const email = `flood-${uniqueId()}@estante.test`;
    const client = new HttpClient();

    // Up to the cap, each request is accepted (202 for an account-less address,
    // indistinguishable from the account-exists case — openapi.yaml:169-172).
    for (let i = 0; i < PER_ADDRESS_LIMIT; i++) {
      const resp = await client.postJson('/api/auth/email/request', { email });
      expect(resp.status, `request ${i + 1} should be accepted`).toBe(202);
    }

    // The next request for the same address is refused with 429 + Retry-After.
    const limited = await client.postJson('/api/auth/email/request', { email });
    expect(limited.status, 'the over-cap request should be rate-limited').toBe(429);
    const body = await limited.json();
    expect(body.code).toBe('rate_limited');
    const retryAfter = Number(limited.headers.get('retry-after'));
    expect(Number.isInteger(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThanOrEqual(1);

    // A different address is unaffected — the limit keys on the address, so it
    // is isolated from any other address's budget (Decision 4).
    const other = await client.postJson('/api/auth/email/request', {
      email: `fresh-${uniqueId()}@estante.test`,
    });
    expect(other.status, 'a different address should still be served').toBe(202);
  });
});
