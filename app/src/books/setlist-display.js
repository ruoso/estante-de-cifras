// books/setlist-display.js — pure, framework-free helpers the setlist surface
// (books.setlists) composes on top of cifra-md's §10 model. The format itself
// (reader, writer, editing ops, path machinery) lives in the `cifra-md` package
// and is consumed, not duplicated (DIRECTION §3.6); this module holds only the
// app-side derivations the view needs: resolving a setlist item's
// folder-relative link to a book-root path, deciding which items have gone
// missing against the book's file set, shaping a row for display, and the file
// name a new setlist takes from its title.
//
// A setlist item's `path` is the decoded link exactly as spelled, relative to
// the setlist's OWN folder (it keeps `..`), NOT the book root — resolving it is
// the app's job (spec §10.5; memory setlist-item-path-is-folder-relative). This
// module does that resolution; cifra-md leaves it to "the Worker/the app".
//
// No React, no I/O: strings, arrays and the shared `slugify`. The view and the
// worker behaviour tests both read it.

import { slugify } from '../songs/song-filename.js';

const SETLIST_SUFFIX = '.setlist.md';

// Resolve a folder-relative setlist item path to a book-root path, given the
// setlist's own book-root path. The setlist's directory is its path minus the
// file name; a `..` pops a directory, `.` and empty segments are dropped (§10.5
// step 5 applied against the setlist's folder, as setlist-links.js does for a
// move). A song beside the setlist resolves to `<dir>/<name>`.
export function resolveItemPath(setlistPath, itemPath) {
  const kept = setlistPath.split('/').slice(0, -1);
  for (const seg of itemPath.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') {
      if (kept.length) kept.pop();
      continue;
    }
    kept.push(seg);
  }
  return kept.join('/');
}

// The folder portion of a book-root path, with its trailing slash, or '' at the
// book root — the `bossa/` meta the board draws under a song's name.
export function folderOf(path) {
  if (!path) return '';
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : `${path.slice(0, slash)}/`;
}

// The value of an item's property, or null — `key` and `note` are the two §10.7
// reserved keys the surface reads.
function propertyValue(entries, key) {
  const entry = (entries || []).find((e) => e.type === 'property' && e.key === key);
  return entry ? entry.value : null;
}

// The set of a book's working-tree paths that are actually present — the file
// view's tree entries (`{ path, status }`) minus the ones showing `deleted`, so
// a song deleted in the file view is absent and its setlist link reads missing
// (workflow 12 §Songs moved L83-85; file_view Decision 2).
export function bookFileSet(entries) {
  const set = new Set();
  for (const entry of entries || []) {
    if (entry.status === 'deleted') continue;
    set.add(entry.path);
  }
  return set;
}

// Display rows for a setlist's items (songs and unlinked, in document order,
// skipping notes blocks), each addressed by its 0-based item position `at` —
// the position cifra-md's editing ops take. An item is `missing` when it is an
// unlinked item (not a song link) or a song link whose resolved book-root path
// is absent from `bookPaths` (a present file set, a Set or an iterable of
// paths). `title` is the link text as written; `key`/`note` are the §10.7
// properties; `folder` is the resolved path's folder.
export function setlistRows(model, setlistPath, bookPaths) {
  const present = bookPaths instanceof Set ? bookPaths : new Set(bookPaths || []);
  const rows = [];
  let at = -1;
  for (const el of (model && model.body) || []) {
    if (el.type !== 'song' && el.type !== 'unlinked') continue;
    at += 1;
    const key = propertyValue(el.entries, 'key');
    const note = propertyValue(el.entries, 'note');
    if (el.type === 'song') {
      const resolvedPath = resolveItemPath(setlistPath, el.path);
      rows.push({
        at,
        number: el.number,
        title: el.text,
        path: el.path,
        resolvedPath,
        folder: folderOf(resolvedPath),
        key,
        note,
        missing: !present.has(resolvedPath),
      });
    } else {
      // An unlinked item is not a song link (§10.3.2): it cannot be played and
      // is offered a repoint, which turns it into a song (pointItemAtSong).
      rows.push({
        at,
        number: el.number,
        title: el.content,
        path: null,
        resolvedPath: null,
        folder: '',
        key,
        note,
        missing: true,
      });
    }
  }
  return rows;
}

// The number of items (songs + unlinked) in a setlist model — the count the
// Setlists destination shows beside each setlist.
export function itemCount(model) {
  return ((model && model.body) || []).filter(
    (el) => el.type === 'song' || el.type === 'unlinked',
  ).length;
}

// The file name a new setlist with this `title` takes: the title folded to an
// ASCII slug (the shared `slugify`, so it matches a song's naming) with
// `.setlist.md` appended; an empty title or one that folds to nothing falls back
// to `untitled`. A name already in `existing` gains `-2`, `-3`, … so a second
// new setlist never overwrites the first (as deriveSongFilename does for songs).
export function setlistFilename(title, existing = []) {
  const taken = existing instanceof Set ? existing : new Set(existing);
  const slug = slugify(title) || 'untitled';
  const base = `${slug}${SETLIST_SUFFIX}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${slug}-${n}${SETLIST_SUFFIX}`;
    if (!taken.has(candidate)) return candidate;
  }
}
