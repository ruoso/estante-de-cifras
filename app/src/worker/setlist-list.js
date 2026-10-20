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

async function bookSetlists({ fs, bookDir, hasCommits, bookId }) {
  if (!(await hasCommits(bookId))) return [];
  const dir = bookDir(bookId);
  const rows = [];
  for (const path of await setlistPaths(fs, dir)) {
    const text = await fs.promises.readFile(`${dir}/${path}`, 'utf8');
    const model = parseSetlist(text);
    const count = model.body.filter(
      (el) => el.type === 'song' || el.type === 'unlinked',
    ).length;
    rows.push({ bookId, path, title: model.title, count });
  }
  return rows;
}

// `[{ bookId, path, title, count }]` for every listable book, in book order then
// path order.
export async function listSetlists({ fs, bookDir, bookIds, hasCommits }) {
  const setlists = [];
  for (const bookId of bookIds) {
    try {
      setlists.push(...(await bookSetlists({ fs, bookDir, hasCommits, bookId })));
    } catch {
      // An unreadable book contributes nothing; the others still list.
    }
  }
  return setlists;
}
