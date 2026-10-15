import { describe, it, expect } from 'vitest';
import { recoveryEmailToken } from './recovery-email-route.js';

// unit (account.recovery_email) — the boot-route parser for the recovery
// email's verification link: workflow 13 §Confirming it L48, the link opens the
// app's own page. The token is `<id>.<sig>` and passes through untouched.
describe('recoveryEmailToken', () => {
  it('extracts a dotted token from /recovery-email/<id>.<sig>', () => {
    expect(recoveryEmailToken('/recovery-email/AAAA-_x.BBBB_-y')).toBe('AAAA-_x.BBBB_-y');
  });

  it('tolerates a single trailing slash', () => {
    expect(recoveryEmailToken('/recovery-email/tok/')).toBe('tok');
  });

  it('is null for an empty token', () => {
    expect(recoveryEmailToken('/recovery-email/')).toBeNull();
  });

  it('is null for extra segments', () => {
    expect(recoveryEmailToken('/recovery-email/a/b')).toBeNull();
  });

  it('is null for the sign-in link and the root', () => {
    expect(recoveryEmailToken('/sign-in/tok')).toBeNull();
    expect(recoveryEmailToken('/')).toBeNull();
    expect(recoveryEmailToken(undefined)).toBeNull();
  });
});
