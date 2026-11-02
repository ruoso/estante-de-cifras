// The boot-route reader for the address a reMarkable shows (reader.pair_web;
// workflow 13 §Where it lives): `estantedecifras.app/pair` opens the app at its
// Pair a device page. `App` reads `location.pathname` at boot, beside the token
// routes, and cleans the address to `/` once it has been read (Decision 2).
//
// Pure, DOM-free (pinned by pair-route.test.js): exactly `/pair`, with an
// optional trailing slash and nothing else. The address holds no token and no
// code — a code is only ever typed on the page (pair_design.md: no code in the
// URL), so nothing after the segment is read.

const PAIR_PATH = /^\/pair\/?$/;

// Whether a pathname is the pairing address.
export function isPairPath(pathname) {
  return typeof pathname === 'string' && PAIR_PATH.test(pathname);
}
