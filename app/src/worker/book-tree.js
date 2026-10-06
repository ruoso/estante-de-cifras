// The file view's working-tree reader (books.file_view, workflow 14 §The view).
// It walks the book as git sees it — every file the book holds, with its
// working-copy status as a word — which the search index cannot give (it holds
// only `*.cifra.md` songs, no setlists/README/.gitattributes, no delete or
// conflict status; Decision 1). A local, offline read under the book lock,
// framework-free Worker code: the view reads the `tree` slice and never touches
// git or the working tree directly (DIRECTION §3.7).
//
// Status is computed from `statusMatrix` (which reports every path in HEAD or
// the working tree, so a never-committed file reads as `new` and a removed one
// as `deleted` — exactly the states the view shows) plus a marked-text check
// for `conflict` (workflow 9; no sync yet in M2, so the slot renders only when
// a marked file is present). `.git` is never tracked, so it never appears; only
// the allowed kinds are kept (workflow 14 L24-29).
import { statusMatrix } from 'isomorphic-git';
import { markerLines } from 'cifra-md';

const SETLIST_SUFFIX = '.setlist.md';
const SONG_SUFFIX = '.cifra.md';
const decoder = new TextDecoder('utf-8');

// The kind of a file by its name, or `null` for anything a book may not hold
// (workflow 14 L24-29; DIRECTION §2.1). The last path segment only.
function kindOf(name) {
  if (name.endsWith(SONG_SUFFIX) && name.length > SONG_SUFFIX.length) return 'song';
  if (name.endsWith(SETLIST_SUFFIX) && name.length > SETLIST_SUFFIX.length) return 'setlist';
  if (name === 'README.md') return 'readme';
  if (name === '.gitattributes') return 'gitattributes';
  return null;
}

function baseName(path) {
  const slash = path.lastIndexOf('/');
  return slash >= 0 ? path.slice(slash + 1) : path;
}

export function createBookTree({ fs, git, locks } = {}) {
  if (!fs) throw new Error('createBookTree needs fs');
  if (!git) throw new Error('createBookTree needs git');
  if (!locks) throw new Error('createBookTree needs locks');

  // Whether a present song/setlist carries conflict markers (marked text,
  // workflow 9). Read verbatim, never re-canonicalised; an unreadable file is
  // not a conflict. Never logs the bytes.
  async function isMarked(dir, path) {
    try {
      const bytes = await fs.promises.readFile(`${dir}/${path}`);
      const text = typeof bytes === 'string' ? bytes : decoder.decode(bytes);
      return markerLines(text).length > 0;
    } catch {
      return false;
    }
  }

  // The working tree of a book: every allowed file with its status. One lock,
  // one logical read (locks.md Decision 1).
  function tree({ bookId }) {
    return locks.withLock(bookId, async () => {
      const dir = git.bookDir(bookId);
      // rows: [filepath, HEAD, WORKDIR, STAGE]; HEAD 0 absent / 1 present,
      // WORKDIR 0 absent / 1 same as HEAD / 2 different.
      const rows = await statusMatrix({ fs, dir });
      const entries = [];
      for (const [path, head, workdir] of rows) {
        const kind = kindOf(baseName(path));
        if (!kind) continue;
        let status = null;
        if (workdir === 0 && head === 1) {
          status = 'deleted';
        } else if (workdir !== 0) {
          const marked =
            (kind === 'song' || kind === 'setlist') && (await isMarked(dir, path));
          if (marked) status = 'conflict';
          else if (head === 0) status = 'new';
          else if (workdir === 2) status = 'unsaved';
        }
        entries.push({ path, status });
      }
      return { entries };
    });
  }

  return { tree };
}
