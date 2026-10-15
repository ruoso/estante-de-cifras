import { describe, it, expect } from 'vitest';
import { isAccessRefused, takenDownReason, readerPushRefused } from './access-refused.js';

// unit — the lost-access classifier (sync.lost_access) and the take-down
// classifier (books.notice_surface). Pins DIRECTION §3.3 L338-341 (the service
// refuses before git starts), DIRECTION §3.6 (a taken-down book's reason is
// returned to its owner/members), and the git.go status ladder
// (service/internal/server/git.go:208,217,231,232): 404 is a non-member / no-book
// refusal — lost access — while 403 is a reader push (still a member) OR the
// `taken_down` copyright-notice refusal carrying the operator's reason; neither a
// missing response (offline) nor a 5xx is a refusal. Only a definite 404 is lost
// access; only a `403 taken_down` body carries a reason; the two never overlap.

// An isomorphic-git HTTP error for a non-2xx git response: `code`/`name` are
// 'HttpError' and the status rides under `err.data.statusCode`, with the
// stringified body under `err.data.response` (isomorphic-git 1.x, index.js
// HttpError). Built here so the boundary is tested without a real refusing
// remote. `response` is omitted when not given (an offline / bodyless error).
function httpError(statusCode, response) {
  const err = new Error(`HTTP Error: ${statusCode}`);
  err.code = err.name = 'HttpError';
  err.data = { statusCode, statusMessage: 'x' };
  if (response !== undefined) err.data.response = response;
  return err;
}

// The service's `403 taken_down` body (service/internal/server/git.go:232,
// respond.go:12-30): `{ code, message }`, the message already framed by the
// service. The reason text is written for this test (no real notice).
const TAKEN_DOWN_REASON = 'This book has been taken down: Copyright notice filed by the rights holder.';
const takenDownBody = JSON.stringify({ code: 'taken_down', message: TAKEN_DOWN_REASON });

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

  it('is false for the taken-down 403 — a distinct halt, still a member (the two classifiers do not overlap)', () => {
    expect(isAccessRefused(httpError(403, takenDownBody))).toBe(false);
  });
});

describe('takenDownReason (unit)', () => {
  it('returns the operator message for a 403 whose body is { code: "taken_down", message } (git.go:232)', () => {
    expect(takenDownReason(httpError(403, takenDownBody))).toBe(TAKEN_DOWN_REASON);
  });

  it('is null for a reader-push 403 with no body — still a member, not taken down', () => {
    expect(takenDownReason(httpError(403))).toBeNull();
  });

  it('is null for a 403 whose body has no / another code (a different refusal)', () => {
    expect(takenDownReason(httpError(403, JSON.stringify({ message: 'nope' })))).toBeNull();
    expect(
      takenDownReason(httpError(403, JSON.stringify({ code: 'forbidden', message: 'nope' }))),
    ).toBeNull();
  });

  it('is null for a 404 — that is lost access, not a take-down', () => {
    expect(takenDownReason(httpError(404, takenDownBody))).toBeNull();
  });

  it('is null for a 5xx — the service faltered, not a refusal', () => {
    expect(takenDownReason(httpError(500))).toBeNull();
    expect(takenDownReason(httpError(503))).toBeNull();
  });

  it('is null for a missing response (offline — a thrown fetch, no body)', () => {
    expect(takenDownReason(new TypeError('Failed to fetch'))).toBeNull();
    expect(takenDownReason(httpError(403))).toBeNull();
  });

  it('is null for a malformed response string (not JSON)', () => {
    expect(takenDownReason(httpError(403, 'not json at all'))).toBeNull();
  });

  it('is null for a 403 whose body is valid JSON but carries no message string', () => {
    expect(takenDownReason(httpError(403, JSON.stringify({ code: 'taken_down' })))).toBeNull();
  });

  it('is null for null / undefined / a non-HTTP error', () => {
    expect(takenDownReason(null)).toBeNull();
    expect(takenDownReason(undefined)).toBeNull();
    expect(takenDownReason(new Error('something else'))).toBeNull();
  });
});

// books.fork Constraint 6 — the permanent push refusal a lowered editor meets
// (workflow 10 L83-85): the service's reader-push `403 {code:'forbidden'}`
// (service/internal/server/git.go:276). It is the only error that classifies as
// `cannot_save`; the take-down 403, a 404, offline and a 5xx never do.
const forbiddenBody = JSON.stringify({ code: 'forbidden', message: 'A reader cannot push to this book.' });

describe('readerPushRefused (unit; books.fork Constraint 6, workflow 10 L83-85)', () => {
  it('is true for the reader-push 403 {code: forbidden}', () => {
    expect(readerPushRefused(httpError(403, forbiddenBody))).toBe(true);
  });

  it('is false for a 403 taken_down — the copyright-notice halt', () => {
    expect(readerPushRefused(httpError(403, takenDownBody))).toBe(false);
  });

  it('is false for a 404 — lost access', () => {
    expect(readerPushRefused(httpError(404, JSON.stringify({ code: 'not_found' })))).toBe(false);
  });

  it('is false offline (a thrown fetch, no status)', () => {
    expect(readerPushRefused(new TypeError('Failed to fetch'))).toBe(false);
  });

  it('is false for a 5xx', () => {
    expect(readerPushRefused(httpError(500, JSON.stringify({ code: 'internal' })))).toBe(false);
  });

  it('is false for a 403 with no body or an unparseable one', () => {
    expect(readerPushRefused(httpError(403))).toBe(false);
    expect(readerPushRefused(httpError(403, 'not json'))).toBe(false);
    expect(readerPushRefused(null)).toBe(false);
  });
});
