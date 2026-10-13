// The invitation boot-route parser (books.add_by_link, workflow 1 §Invited):
// recognise an invitation link's path, `/i/<token>`, and extract the token. The
// service builds the link as `${ESTANTE_PUBLIC_BASE_URL}/i/<raw-token>`
// (service.sharing) — a path, not a hash — so `App` branches on
// `location.pathname` at boot, beside the `/sign-in/<token>` redeem route
// (sign-in-route.js), and hands the token here.
//
// Pure, DOM-free (pinned by invitation-route.test.js): exactly one path segment
// after `/i/`, nothing before, an optional trailing slash and nothing else. The
// token is opaque and passes through untouched — never decoded, re-encoded,
// logged or reshaped; a query string or fragment, extra segments, or an empty
// token all read as "not an invitation link". `fromLink` additionally accepts a
// whole URL (the "paste a link" affordance in the Add-a-book sheet, W07 L85):
// it parses out the pathname first, then applies the same rule.

const INVITATION_PATH = /^\/i\/([^/?#]+)\/?$/;

// The invitation token in a pathname, or null when the pathname is not a bare
// `/i/<token>`.
export function invitationToken(pathname) {
  if (typeof pathname !== 'string') return null;
  const match = INVITATION_PATH.exec(pathname);
  return match ? match[1] : null;
}

// The invitation token in a pasted link (an absolute `https://…/i/<token>` URL,
// or a bare `/i/<token>` path), or null when it is not an invitation link. Only
// the pathname is read; the origin, query and fragment are ignored.
export function tokenFromLink(link) {
  if (typeof link !== 'string') return null;
  const trimmed = link.trim();
  if (!trimmed) return null;
  let pathname = trimmed;
  try {
    pathname = new URL(trimmed).pathname;
  } catch {
    // Not an absolute URL — treat the whole string as a path below.
  }
  return invitationToken(pathname);
}
