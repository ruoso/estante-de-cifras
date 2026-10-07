import { describe, it, expect } from 'vitest';
import { shouldOfferPasskey } from './offer-passkey.js';

// unit (account.sign_in) — the offer-a-passkey predicate (Decision 5; workflow
// 13 lines 23-24): offer after an email redeem and after a cross-device /
// another-ecosystem passkey assertion, skip after a same-ecosystem (platform)
// one and after a registration (which just created a passkey here).
describe('shouldOfferPasskey', () => {
  it('offers after an emailed-link redeem', () => {
    expect(shouldOfferPasskey({ method: 'redeem' })).toBe(true);
  });

  it('offers after a cross-platform passkey assertion', () => {
    expect(
      shouldOfferPasskey({ method: 'authenticate', authenticatorAttachment: 'cross-platform' }),
    ).toBe(true);
  });

  it('offers after an assertion that reports no attachment', () => {
    expect(shouldOfferPasskey({ method: 'authenticate', authenticatorAttachment: null })).toBe(true);
    expect(shouldOfferPasskey({ method: 'authenticate' })).toBe(true);
  });

  it('skips after a platform passkey assertion (already resident here)', () => {
    expect(
      shouldOfferPasskey({ method: 'authenticate', authenticatorAttachment: 'platform' }),
    ).toBe(false);
  });

  it('does not offer after a registration (a passkey was just created here)', () => {
    expect(shouldOfferPasskey({ method: 'register' })).toBe(false);
    expect(
      shouldOfferPasskey({ method: 'register', authenticatorAttachment: 'cross-platform' }),
    ).toBe(false);
  });

  it('does not offer for an unknown or empty outcome', () => {
    expect(shouldOfferPasskey()).toBe(false);
    expect(shouldOfferPasskey({})).toBe(false);
    expect(shouldOfferPasskey({ method: 'nope' })).toBe(false);
  });
});
