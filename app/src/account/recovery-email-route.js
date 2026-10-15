// The boot-route parser for the recovery email's verification link
// (account.recovery_email; workflow 13 §Confirming it L48): the service mails
// `${ESTANTE_PUBLIC_BASE_URL}/recovery-email/<token>` — a path, like the sign-in
// link — so `App` reads `location.pathname` at boot and hands the token here.
//
// Pure, DOM-free (pinned by recovery-email-route.test.js), the twin of
// sign-in-route.js: exactly one path segment after `/recovery-email/`, an
// optional trailing slash and nothing else. The token is opaque (it holds a
// dot, `<id>.<sig>`) and passes through untouched — never decoded, logged or
// reshaped.

const RECOVERY_EMAIL_PATH = /^\/recovery-email\/([^/?#]+)\/?$/;

// The confirm token in a pathname, or null when the pathname is not a bare
// `/recovery-email/<token>`.
export function recoveryEmailToken(pathname) {
  if (typeof pathname !== 'string') return null;
  const match = RECOVERY_EMAIL_PATH.exec(pathname);
  return match ? match[1] : null;
}
