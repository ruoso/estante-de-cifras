// The Setlists destination's list (books.setlists, workflow 12 §The file L34;
// books.setlists_resilient). Every listable book's `*.setlist.md` files with
// their title and song count, read from the working tree as it is on disk.
//
// A plain `readdir` walk that skips `.git`, as the search index's sweep does
// (search-index.js `songPaths`) — no `statusMatrix`, no book lock, so a book
// being cloned or synced never holds the list up (Decision 1; DIRECTION §3.7
// offline first). A file present in the working tree is exactly what the book
// tree reports as not `deleted`, so the rows are the ones the tree gave.
//
// A book is listable only once it has a commit (`hasCommits`, the test the
// shelf fill trusts; Decision 2): a directory left with no `HEAD`, or with a
// `HEAD` and no `main`, is not a book yet. A book whose read throws — any error —
// is skipped and the rest are listed (Constraint 2). Framework-free Worker code;
// it logs nothing (no titles, no text).
//
// Each row carries the setlist's status word (books.setlist_done Constraint 4;
// workflow 12 §Building one): `new` for a file `main` does not hold, `unsaved`
// for one whose text differs from `main`'s, `null` when clean — from an injected
// `statusOf(bookId, path, text)`, per setlist, still no lock and no book-wide
// `statusMatrix` (Decision 2). A status read that throws leaves that row `null`.
import { readBlob, resolveRef } from 'isomorphic-git';
import { parseSetlist } from 'cifra-md';

const SETLIST_SUFFIX = '.setlist.md';

function isSetlist(name) {
  return name.endsWith(SETLIST_SUFFIX) && name.length > SETLIST_SUFFIX.length;
}

// One book's setlist paths, relative to its directory, in the order git walks a
// tree (names sorted within each folder). A missing directory has none.
async function setlistPaths(fs, dir) {
  const out = [];
  async function walk(rel) {
    const abs = rel ? `${dir}/${rel}` : dir;
    let names;
    try {
      names = await fs.promises.readdir(abs);
    } catch (err) {
      if (err?.code === 'ENOENT') return;
      throw err;
    }
    for (const name of [...names].sort()) {
      if (name === '.git') continue;
      const childRel = rel ? `${rel}/${name}` : name;
      const stat = await fs.promises.stat(`${dir}/${childRel}`);
      if (stat.isDirectory()) await walk(childRel);
      else if (isSetlist(name)) out.push(childRel);
    }
  }
  await walk('');
  return out;
}

// The `statusOf` the Worker injects: the path's blob at `main`, read without the
// book lock (as `hasCommits` reads `main`), against the working file's text. No
// blob at that path → `new`; any other failure throws, and the row reads `null`.
export function statusAtMain({ fs, bookDir }) {
  return async (bookId, path, text) => {
    const dir = bookDir(bookId);
    const oid = await resolveRef({ fs, dir, ref: 'main' });
    let blob;
    try {
      ({ blob } = await readBlob({ fs, dir, oid, filepath: path }));
    } catch (err) {
      if (err?.code === 'NotFoundError') return 'new';
      throw err;
    }
    return new TextDecoder().decode(blob) === text ? null : 'unsaved';
  };
}

async function rowStatus(statusOf, bookId, path, text) {
  if (!statusOf) return null;
  try {
    return (await statusOf(bookId, path, text)) ?? null;
  } catch {
    return null;
  }
}

async function bookSetlists({ fs, bookDir, hasCommits, statusOf, bookId }) {
  if (!(await hasCommits(bookId))) return [];
  const dir = bookDir(bookId);
  const rows = [];
  for (const path of await setlistPaths(fs, dir)) {
    const text = await fs.promises.readFile(`${dir}/${path}`, 'utf8');
    const model = parseSetlist(text);
    const count = model.body.filter(
      (el) => el.type === 'song' || el.type === 'unlinked',
    ).length;
    const status = await rowStatus(statusOf, bookId, path, text);
    rows.push({ bookId, path, title: model.title, count, status });
  }
  return rows;
}

// `[{ bookId, path, title, count, status }]` for every listable book, in book
// order then path order.
export async function listSetlists({ fs, bookDir, bookIds, hasCommits, statusOf }) {
  const setlists = [];
  for (const bookId of bookIds) {
    try {
      setlists.push(...(await bookSetlists({ fs, bookDir, hasCommits, statusOf, bookId })));
    } catch {
      // An unreadable book contributes nothing; the others still list.
    }
  }
  return setlists;
}
