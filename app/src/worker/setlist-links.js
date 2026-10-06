// Rewriting a book's setlist links when a song moves (books.file_view,
// workflow 14 L144-146; workflow 12). A rename/move keeps a song reachable: a
// setlist whose item points at the moved song is rewritten to the new relative
// path, in the same save. Pure — no I/O, no git — so it unit-tests without a
// working copy; the Worker's `move` gathers the book's setlists and writes back
// the ones this returns (Decision 2).
//
// It composes cifra.md's setlist exports, which the format owns (the app writes
// no second implementation — DIRECTION §3.6): `parseSetlist`/`writeSetlist` for
// the canonical round-trip, `pathFromSetlistToSong` for the new book-root →
// relative destination, `retargetItem` for the item rewrite. Book-root
// resolution of an item's link is this helper's job (cifra.md leaves it to "the
// Worker": a parsed item's `path` is relative to the setlist's own folder).
import { parseSetlist, writeSetlist, pathFromSetlistToSong, retargetItem } from 'cifra-md';

// Resolve a setlist-folder-relative destination (possibly with leading `..`) to
// a book-root path, given the setlist's own directory as segments.
function resolveToBookRoot(dirSegments, relPath) {
  const kept = [...dirSegments];
  for (const seg of relPath.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (kept.length) kept.pop();
      continue;
    }
    kept.push(seg);
  }
  return kept.join('/');
}

/**
 * Rewrite the setlists that reference a moved song.
 *
 * @param {object} args
 * @param {{ path: string, text: string }[]} args.setlists the book's setlists,
 *   each with its book-root `path` and current working-copy `text`.
 * @param {string} args.fromPath the song's book-root path before the move.
 * @param {string} args.toPath the song's book-root path after the move.
 * @returns {{ path: string, text: string }[]} only the setlists whose canonical
 *   text changed, each with its new canonical `text`.
 */
export function relinkSetlists({ setlists, fromPath, toPath }) {
  const toSegments = toPath.split('/');
  const changed = [];
  for (const { path, text } of setlists) {
    const dirSegments = path.split('/').slice(0, -1);
    const parsed = parseSetlist(text);
    // The 0-based item positions (song + unlinked, in document order) whose
    // song link resolves to the moved song.
    const positions = [];
    let itemPos = -1;
    for (const el of parsed.body) {
      if (el.type !== 'song' && el.type !== 'unlinked') continue;
      itemPos += 1;
      if (el.type === 'song' && resolveToBookRoot(dirSegments, el.path) === fromPath) {
        positions.push(itemPos);
      }
    }
    if (positions.length === 0) continue;
    const newDest = pathFromSetlistToSong(dirSegments, toSegments);
    let model = parsed;
    for (const at of positions) model = retargetItem(model, at, newDest);
    const out = writeSetlist(model);
    if (out !== text) changed.push({ path, text: out });
  }
  return changed;
}
