// The boot-route parser (account.sign_in Decision 4): recognise the emailed
// sign-in link's path, `/sign-in/<token>`, and extract the token. The service
// mails `${ESTANTE_PUBLIC_BASE_URL}/sign-in/<token>` (service/email_links.md) —
// a path, not a hash — so `App` branches on `location.pathname` at boot, beside
// the `#dev/*` hash mounts (App.jsx), and hands the token here.
//
// Pure, DOM-free (pinned by sign-in-route.test.js): exactly one path segment
// after `/sign-in/`, nothing before, an optional trailing slash and nothing
// else. The token is opaque and passes through untouched — never decoded,
// re-encoded, logged or reshaped (Constraints: "passes through the app opaque
// and untouched"); a query string or fragment, extra segments, or an empty
// token all read as "not a sign-in link".

const SIGN_IN_PATH = /^\/sign-in\/([^/?#]+)\/?$/;

// The redeem token in a pathname, or null when the pathname is not a bare
// `/sign-in/<token>`.
export function signInToken(pathname) {
  if (typeof pathname !== 'string') return null;
  const match = SIGN_IN_PATH.exec(pathname);
  return match ? match[1] : null;
}
