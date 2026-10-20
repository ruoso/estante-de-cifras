// unit (account.sign_in_two_doors) — the shell's reading of the account's state.
// Pins workflow 13 §The banner (*a pending address keeps it*; *What the device
// knows*: shown on the service's answer only) and workflow 1 §Cold (the row is
// offered only while no one is signed in).

import { describe, it, expect } from 'vitest';
import { showsRecoveryBanner, offersFirstRunSignIn } from './account-status.js';

describe('showsRecoveryBanner', () => {
  it('is shown for a signed-in account with no address', () => {
    expect(showsRecoveryBanner({ status: 'in', recovery: { email: null, pending: null } })).toBe(true);
  });

  it('is kept while an address is only pending', () => {
    expect(showsRecoveryBanner({ status: 'in', recovery: { email: null, pending: 'a@x' } })).toBe(true);
  });

  it('is gone once an address is confirmed, pending or not', () => {
    expect(showsRecoveryBanner({ status: 'in', recovery: { email: 'a@x', pending: null } })).toBe(false);
    expect(showsRecoveryBanner({ status: 'in', recovery: { email: 'a@x', pending: 'b@x' } })).toBe(false);
  });

  it('is not shown signed out, before an answer, or before the address is read', () => {
    expect(showsRecoveryBanner({ status: 'out', recovery: null })).toBe(false);
    expect(showsRecoveryBanner({ status: 'unknown', recovery: null })).toBe(false);
    expect(showsRecoveryBanner({ status: 'in', recovery: null })).toBe(false);
  });
});

describe('offersFirstRunSignIn', () => {
  it('is false only when signed in', () => {
    expect(offersFirstRunSignIn({ status: 'in' })).toBe(false);
    expect(offersFirstRunSignIn({ status: 'out' })).toBe(true);
    expect(offersFirstRunSignIn({ status: 'unknown' })).toBe(true);
  });
});
