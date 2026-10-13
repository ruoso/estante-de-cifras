// book-route.js — deep links into a book and its songs (books.share, workflow 10
// §Sharing a song L92-101; Decision 2). Two link shapes, both consumed once at
// boot (mirroring invitation-route.js / sign-in-route.js — parse, clean the URL,
// seed view-state):
//
//   - `/b/<bookId>/<path>` — a song's plain address for someone already a member
//     (workflow 10 L95-96). A boot on it opens that song in the book the account
//     already holds. The book id is one opaque segment; the song path may carry
//     slashes (a song in a folder).
//   - `/i/<token>#<path>` — an ordinary invitation link (books.add_by_link mints
//     the `/i/<token>` path) with the shared song's path appended as a
//     CLIENT-ONLY URL fragment. The fragment is never sent to the service (the
//     accept POSTs only the token, and `CreateInvitationRequest` is
//     `additionalProperties: false`), so no contract changes; the app reads the
//     fragment on `BOOK_CLONED` and opens that song in the freshly cloned book.
//
// Pure and DOM-free (pinned by book-route.test.js): a path is read from
// `location.pathname`, the song anchor from `location.hash`. Each path segment
// round-trips through encode/decodeURIComponent so a path with spaces or reserved
// characters survives the URL untouched; a decode that throws falls back to the
// raw segment rather than losing the link.

const BOOK_SONG_PATH = /^\/b\/([^/]+)\/(.+)$/;

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function decodePath(encoded) {
  return encoded.split('/').map(decodeSegment).join('/');
}

function encodePath(path) {
  return String(path)
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

// The `{ bookId, path }` of a `/b/<bookId>/<path>` address, or null when the
// pathname is not one. The path keeps its slashes (a folder-nested song).
export function bookSongRoute(pathname) {
  if (typeof pathname !== 'string') return null;
  const match = BOOK_SONG_PATH.exec(pathname);
  if (!match) return null;
  const bookId = decodeSegment(match[1]);
  const path = decodePath(match[2]);
  if (!bookId || !path) return null;
  return { bookId, path };
}

// The song path an invitation link carried as a `#<path>` fragment, or null when
// there is none (a bare `/i/<token>` with no fragment). Accepts the fragment with
// or without its leading `#`.
export function songAnchorFromHash(hash) {
  if (typeof hash !== 'string') return null;
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return null;
  return decodePath(raw);
}

// The plain address of a song for a member to copy, `/b/<bookId>/<path>`
// (workflow 10 L95-96). The id and each path segment are percent-encoded; the
// path's slashes are preserved so the address reads as a folder path.
export function bookSongPath(bookId, path) {
  return `/b/${encodeURIComponent(bookId)}/${encodePath(path)}`;
}

// An invitation link with the shared song appended as a client-only fragment,
// `<url>#<path>` (Decision 2). `url` is the `/i/<token>` link the service
// returned on create; the fragment never reaches the server.
export function invitationSongLink(url, path) {
  return `${url}#${encodePath(path)}`;
}
