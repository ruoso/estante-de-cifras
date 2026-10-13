import { describe, it, expect } from 'vitest';
import { invitationToken, tokenFromLink } from './invitation-route.js';

// unit (books.add_by_link) — the invitation boot-route parser (workflow 1
// §Invited) recognises a `/i/<token>` path and extracts the opaque token, and
// `tokenFromLink` pulls it from a pasted absolute link (the Add-a-book sheet's
// "By link"). Pure, DOM-free; everything else reads as "not an invitation link".
describe('invitationToken', () => {
  it('extracts the token from a /i/<token> path', () => {
    expect(invitationToken('/i/abc123')).toBe('abc123');
  });

  it('keeps the token opaque — base64url / dotted segments pass through untouched', () => {
    expect(invitationToken('/i/v1.aB-_9x.ZqT')).toBe('v1.aB-_9x.ZqT');
  });

  it('tolerates a single trailing slash', () => {
    expect(invitationToken('/i/tok/')).toBe('tok');
  });

  it('rejects a missing or empty token', () => {
    expect(invitationToken('/i')).toBeNull();
    expect(invitationToken('/i/')).toBeNull();
    expect(invitationToken('/i//')).toBeNull();
  });

  it('rejects extra segments, a different path, and a query/fragment', () => {
    expect(invitationToken('/i/tok/extra')).toBeNull();
    expect(invitationToken('/sign-in/tok')).toBeNull();
    expect(invitationToken('/invite/tok')).toBeNull();
    expect(invitationToken('/i/tok?x=1')).toBeNull();
    expect(invitationToken('/i/tok#frag')).toBeNull();
  });

  it('rejects a non-string', () => {
    expect(invitationToken(null)).toBeNull();
    expect(invitationToken(42)).toBeNull();
  });
});

describe('tokenFromLink', () => {
  it('extracts the token from a full invitation URL, ignoring origin/query/fragment', () => {
    expect(tokenFromLink('https://estante.app/i/v1.aB-_9x')).toBe('v1.aB-_9x');
    expect(tokenFromLink('https://estante.app/i/tok?x=1#y')).toBe('tok');
  });

  it('accepts a bare /i/<token> path and trims surrounding whitespace', () => {
    expect(tokenFromLink('  /i/tok  ')).toBe('tok');
  });

  it('rejects a link that is not an invitation link, and empties', () => {
    expect(tokenFromLink('https://estante.app/sign-in/tok')).toBeNull();
    expect(tokenFromLink('https://estante.app/')).toBeNull();
    expect(tokenFromLink('not a url')).toBeNull();
    expect(tokenFromLink('')).toBeNull();
    expect(tokenFromLink(null)).toBeNull();
  });
});
