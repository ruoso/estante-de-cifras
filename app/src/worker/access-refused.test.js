import { describe, it, expect } from 'vitest';
import { isAccessRefused } from './access-refused.js';

// unit — the lost-access classifier (sync.lost_access). Pins DIRECTION §3.3
// L338-341 (the service refuses before git starts) and the git.go status ladder
// (service/internal/server/git.go:208,217,231): 404 is a non-member / no-book
// refusal — lost access — while 403 is a reader push (still a member), and
// neither a missing response (offline) nor a 5xx is a refusal. Only a definite
// 404 halts the book; the rest stay on the engine's silent-retry path.

// An isomorphic-git HTTP error for a non-2xx git response: `code`/`name` are
// 'HttpError' and the status rides under `err.data.statusCode` (isomorphic-git
// 1.x, index.js HttpError). Built here so the boundary is tested without a real
// refusing remote.
function httpError(statusCode) {
  const err = new Error(`HTTP Error: ${statusCode}`);
  err.code = err.name = 'HttpError';
  err.data = { statusCode, statusMessage: 'x' };
  return err;
}

describe('isAccessRefused (unit)', () => {
  it('is true for a 404 git-http error — no longer a member / no such book', () => {
    expect(isAccessRefused(httpError(404))).toBe(true);
  });

  it('is false for a 403 — a reader push, still a member', () => {
    expect(isAccessRefused(httpError(403))).toBe(false);
  });

  it('is false for a missing response (offline — a thrown fetch, no HTTP status)', () => {
    expect(isAccessRefused(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('is false for a 5xx — the service faltered, not a refusal', () => {
    expect(isAccessRefused(httpError(500))).toBe(false);
    expect(isAccessRefused(httpError(503))).toBe(false);
  });

  it('is false for null / undefined / a non-HTTP error', () => {
    expect(isAccessRefused(null)).toBe(false);
    expect(isAccessRefused(undefined)).toBe(false);
    expect(isAccessRefused(new Error('something else'))).toBe(false);
  });
});
