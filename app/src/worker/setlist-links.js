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

// The 0-based item positions (song + unlinked, in document order) of a parsed
// setlist whose song link resolves to `songPath` — the one rule both the
// dialog's dry read (`linksTo`) and the move's rewrite (`relinkSetlists`) use,
// so what the rename dialog lists is what the save rewrites (Decision 1).
function linkedPositions(parsed, dirSegments, songPath) {
  const positions = [];
  let itemPos = -1;
  for (const el of parsed.body) {
    if (el.type !== 'song' && el.type !== 'unlinked') continue;
    itemPos += 1;
    if (el.type === 'song' && resolveToBookRoot(dirSegments, el.path) === songPath) {
      positions.push(itemPos);
    }
  }
  return positions;
}

/**
 * The setlist items that link to a song (books.file_view_history_polish,
 * workflow 14 L151-153; W14 tablet #3): what a rename of it will update.
 *
 * @param {object} args
 * @param {{ path: string, text: string }[]} args.setlists the book's setlists,
 *   each with its book-root `path` and current working-copy `text`.
 * @param {string} args.path the song's book-root path.
 * @returns {{ setlist: string, item: number }[]} each linking item, with its
 *   setlist's book-root path and its 1-based number among the setlist's items
 *   (the number the setlist shows), in setlist-path then item order.
 */
export function linksTo({ setlists, path }) {
  const links = [];
  const sorted = [...setlists].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const { path: setlist, text } of sorted) {
    const dirSegments = setlist.split('/').slice(0, -1);
    for (const at of linkedPositions(parseSetlist(text), dirSegments, path)) {
      links.push({ setlist, item: at + 1 });
    }
  }
  return links;
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
    const positions = linkedPositions(parsed, dirSegments, fromPath);
    if (positions.length === 0) continue;
    const newDest = pathFromSetlistToSong(dirSegments, toSegments);
    let model = parsed;
    for (const at of positions) model = retargetItem(model, at, newDest);
    const out = writeSetlist(model);
    if (out !== text) changed.push({ path, text: out });
  }
  return changed;
}
