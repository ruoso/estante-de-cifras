import { describe, it, expect } from 'vitest';
import { recoveryEmailState, isLastWayIn } from './recovery-email.js';

// unit (account.recovery_email) — the Recovery email region's state selector
// (workflow 13 §The account screen L135–142) and the last-way-in predicate
// (workflow 13 §The last way in L70–76).
describe('recoveryEmailState', () => {
  it('is none with neither an address nor a pending one', () => {
    expect(recoveryEmailState({ email: null, pending: null })).toBe('none');
    expect(recoveryEmailState()).toBe('none');
  });

  it('is waiting with only a pending address', () => {
    expect(recoveryEmailState({ email: null, pending: 'ana@example.com' })).toBe('waiting');
  });

  it('is confirmed with only a confirmed address', () => {
    expect(recoveryEmailState({ email: 'ana@example.com', pending: null })).toBe('confirmed');
  });

  it('is confirmed+waiting while a change is pending', () => {
    expect(recoveryEmailState({ email: 'ana@example.com', pending: 'bia@example.com' })).toBe(
      'confirmed+waiting',
    );
  });
});

describe('isLastWayIn', () => {
  const one = [{ id: 'k1' }];
  const two = [{ id: 'k1' }, { id: 'k2' }];

  it('is true for exactly one passkey and no confirmed email', () => {
    expect(isLastWayIn({ email: null, passkeys: one })).toBe(true);
  });

  it('stays true while an address is only pending', () => {
    // A pending address is not a way back in; only `email` (confirmed) counts.
    expect(isLastWayIn({ email: null, pending: 'ana@example.com', passkeys: one })).toBe(true);
  });

  it('is false with two passkeys', () => {
    expect(isLastWayIn({ email: null, passkeys: two })).toBe(false);
  });

  it('is false with a confirmed email', () => {
    expect(isLastWayIn({ email: 'ana@example.com', passkeys: one })).toBe(false);
  });

  it('is false with no passkeys at all (nothing to protect)', () => {
    expect(isLastWayIn({ email: null, passkeys: [] })).toBe(false);
  });
});
