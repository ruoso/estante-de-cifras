// recovery-email.js — the pure shapes of the account screen's Recovery email
// region (account.recovery_email; workflow 13 §The recovery email L32–68, §The
// last way in L70–76, §The account screen L135–142). No DOM, no React: the
// region and the Passkeys rows read these, and recovery-email.test.js pins them.

/**
 * Which of the region's states to draw from `GET /api/account/recovery-email`.
 * `pending` is still reported after it has expired, so an expired request stays
 * `waiting` with Send again (service.recovery_email).
 *
 * @param {{ email?: string|null, pending?: string|null }} state
 * @returns {'none'|'waiting'|'confirmed'|'confirmed+waiting'}
 */
export function recoveryEmailState({ email = null, pending = null } = {}) {
  if (email && pending) return 'confirmed+waiting';
  if (email) return 'confirmed';
  if (pending) return 'waiting';
  return 'none';
}

/**
 * Whether the account's only passkey is its last way in: no confirmed email and
 * exactly one passkey. A pending address does not lift it — only a confirmed one
 * is a way back in (workflow 13 L70–76).
 *
 * @param {{ email?: string|null, passkeys?: Array<unknown> }} state
 * @returns {boolean}
 */
export function isLastWayIn({ email = null, passkeys = [] } = {}) {
  return !email && passkeys.length === 1;
}
