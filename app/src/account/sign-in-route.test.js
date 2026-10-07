import { describe, it, expect } from 'vitest';
import { signInToken } from './sign-in-route.js';

// unit (account.sign_in) — the boot-route parser (Decision 4) recognises a
// `/sign-in/<token>` path and extracts the token, and rejects everything else,
// so the emailed-link boot route is pinned without a DOM.
describe('signInToken', () => {
  it('extracts the token from a /sign-in/<token> path', () => {
    expect(signInToken('/sign-in/abc123')).toBe('abc123');
  });

  it('keeps the token opaque — base64url / dotted segments pass through untouched', () => {
    // A signed token can carry `-`, `_` and `.` (service/email_links.md); none is
    // decoded, re-encoded or reshaped (Constraints: "passes through … untouched").
    expect(signInToken('/sign-in/v1.aB-_9x.ZqT')).toBe('v1.aB-_9x.ZqT');
  });

  it('tolerates a single trailing slash', () => {
    expect(signInToken('/sign-in/tok/')).toBe('tok');
  });

  it('rejects a missing or empty token', () => {
    expect(signInToken('/sign-in')).toBeNull();
    expect(signInToken('/sign-in/')).toBeNull();
    expect(signInToken('/sign-in//')).toBeNull();
  });

  it('rejects extra path segments', () => {
    expect(signInToken('/sign-in/tok/extra')).toBeNull();
  });

  it('rejects a different path', () => {
    expect(signInToken('/')).toBeNull();
    expect(signInToken('/signin/tok')).toBeNull();
    expect(signInToken('/books/sign-in/tok')).toBeNull();
    expect(signInToken('/other/tok')).toBeNull();
  });

  it('rejects a path carrying a query or fragment on the segment', () => {
    expect(signInToken('/sign-in/tok?x=1')).toBeNull();
    expect(signInToken('/sign-in/tok#frag')).toBeNull();
  });

  it('rejects a non-string', () => {
    expect(signInToken(null)).toBeNull();
    expect(signInToken(undefined)).toBeNull();
    expect(signInToken(42)).toBeNull();
  });
});
