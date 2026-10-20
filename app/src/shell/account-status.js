// account-status.js — the pure reading of what the shell knows of the account
// (account.sign_in_two_doors; workflow 13 §The banner, *What the device knows*;
// workflow 1 §Cold). No DOM, no React: the shell and its unit test read these.
//
// `status` is 'unknown' until the service has answered, then 'in' (a 200 from
// `GET /api/account/recovery-email`) or 'out' (a 401); `recovery` is that
// answer's `{ email, pending }`, or null until one is read.

/**
 * The banner is shown on the service's answer only: signed in, the recovery
 * email read, and no confirmed address — a pending one keeps it.
 *
 * @param {{ status: 'unknown'|'in'|'out', recovery?: { email: string|null, pending: string|null } | null }} state
 * @returns {boolean}
 */
export function showsRecoveryBanner({ status, recovery = null } = {}) {
  return status === 'in' && recovery != null && !recovery.email;
}

/**
 * The cold first run's *Sign in or make an account* row is offered only while
 * no one is signed in — and while the device does not yet know, so a row is
 * never missing offline.
 *
 * @param {{ status: 'unknown'|'in'|'out' }} state
 * @returns {boolean}
 */
export function offersFirstRunSignIn({ status } = {}) {
  return status !== 'in';
}
