// unit — the Setlists destination's lock-free list (books.setlists_resilient
// Constraints 1-3; workflow 12 §The file L34). Over lightning-fs on a fresh fake
// IndexedDB, with books made by isomorphic-git `init`/`add`/`commit` and
// setlists written for the purpose (no one's words). Pins:
//   - a `HEAD`-less directory beside a good book is skipped, nothing throws (H1);
//   - a `HEAD` → `refs/heads/main` with no `main` is not a book yet (M8);
//   - a book whose read throws (any error) is skipped, the other listed;
//   - the row shape (title, song + unlinked count), subfolder paths, and that
//     `.git` is never walked;
//   - each row's status from its blob at `main` — new / unsaved / null — and a
//     status read that throws leaves the row listed, null (books.setlist_done
//     Constraint 4).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { init, add, commit, resolveRef } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { listSetlists, statusAtMain } from './setlist-list.js';
import { installWebLocks } from '../test/web-locks.js';

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

const AUTHOR = { name: 'A Tester', email: 'tester@example.invalid' };
const bookDir = (bookId) => `/books/${bookId}`;

const ENSAIO = [
  '# Ensaio de sábado',
  '',
  '1. [Valsa da esquina](valsa.cifra.md)',
  '2. Uma canção sem arquivo',
  '',
].join('\n');
const AULA = ['# Aula de terça', '', '1. [Chuva fina](../chuva.cifra.md)', ''].join('\n');
const STRAY = ['# Lista perdida', '', '1. Alguma coisa', ''].join('\n');

let counter = 0;
function freshFs() {
  return createFileSystem(`setlist-list-${counter++}`, { indexedDB: new IDBFactory() });
}

async function mkdirp(fs, path) {
  let at = '';
  for (const part of path.split('/').filter(Boolean)) {
    at += `/${part}`;
    try {
      await fs.promises.mkdir(at);
    } catch (err) {
      if (err?.code !== 'EEXIST') throw err;
    }
  }
}

async function writeFile(fs, path, text) {
  await mkdirp(fs, path.slice(0, path.lastIndexOf('/')));
  await fs.promises.writeFile(path, text, 'utf8');
}

// A committed book: `files` written, added and committed on `main`.
async function makeBook(fs, bookId, files) {
  const dir = bookDir(bookId);
  await mkdirp(fs, dir);
  await init({ fs, dir, defaultBranch: 'main' });
  for (const [path, text] of Object.entries(files)) {
    await writeFile(fs, `${dir}/${path}`, text);
    await add({ fs, dir, filepath: path });
  }
  await commit({ fs, dir, message: 'Scaffold', author: AUTHOR });
}

// The same test the Worker uses (logic.js `hasCommits`): a `main` commit.
function hasCommitsOn(fs) {
  return async (bookId) => {
    try {
      await resolveRef({ fs, dir: bookDir(bookId), ref: 'main' });
      return true;
    } catch {
      return false;
    }
  };
}

describe('listSetlists (unit)', () => {
  it('skips a HEAD-less directory beside a good book, and does not throw (Constraints 1-2; H1)', async () => {
    const fs = freshFs();
    await makeBook(fs, 'band', { 'ensaio.setlist.md': ENSAIO });
    // What an interrupted clone or a non-atomic removeTree can leave: a setlist
    // in the tree and an empty `.git`.
    await writeFile(fs, '/books/broken/perdida.setlist.md', STRAY);
    await mkdirp(fs, '/books/broken/.git');

    const rows = await listSetlists({
      fs,
      bookDir,
      bookIds: ['broken', 'band'],
      hasCommits: hasCommitsOn(fs),
    });
    expect(rows).toEqual([
      { bookId: 'band', path: 'ensaio.setlist.md', title: 'Ensaio de sábado', count: 2, status: null },
    ]);
  });

  it('skips a book whose HEAD names refs/heads/main with no main (Constraint 1; M8)', async () => {
    const fs = freshFs();
    await makeBook(fs, 'band', { 'ensaio.setlist.md': ENSAIO });
    await mkdirp(fs, '/books/half');
    await init({ fs, dir: '/books/half', defaultBranch: 'main' });
    await writeFile(fs, '/books/half/perdida.setlist.md', STRAY);

    const rows = await listSetlists({
      fs,
      bookDir,
      bookIds: ['band', 'half'],
      hasCommits: hasCommitsOn(fs),
    });
    expect(rows.map((r) => r.bookId)).toEqual(['band']);
  });

  it('skips a book whose read throws a non-ENOENT error and lists the other (Constraint 2)', async () => {
    const fs = freshFs();
    await makeBook(fs, 'band', { 'ensaio.setlist.md': ENSAIO });
    await makeBook(fs, 'ana', { 'aula.setlist.md': AULA });
    const failing = new Error('the store is unreadable');
    failing.code = 'EIO';
    // An fs whose reads under one book throw; everything else passes through.
    const flaky = {
      promises: new Proxy(fs.promises, {
        get(target, prop) {
          const fn = target[prop];
          if (typeof fn !== 'function') return fn;
          return (path, ...rest) => {
            if (typeof path === 'string' && path.startsWith('/books/ana')) {
              return Promise.reject(failing);
            }
            return fn(path, ...rest);
          };
        },
      }),
    };

    const rows = await listSetlists({
      fs: flaky,
      bookDir,
      bookIds: ['ana', 'band'],
      hasCommits: async () => true,
    });
    expect(rows.map((r) => r.bookId)).toEqual(['band']);

    // And a `hasCommits` that throws for one book skips only that book.
    const rows2 = await listSetlists({
      fs,
      bookDir,
      bookIds: ['ana', 'band'],
      hasCommits: async (bookId) => {
        if (bookId === 'ana') throw failing;
        return true;
      },
    });
    expect(rows2.map((r) => r.bookId)).toEqual(['band']);
  });

  it('rows carry title and the song + unlinked count; subfolders by path; .git never walked (Constraint 3; workflow 12 §The file)', async () => {
    const fs = freshFs();
    await makeBook(fs, 'band', {
      'valsa.cifra.md': '# Valsa da esquina\n',
      'ensaio.setlist.md': ENSAIO,
      'gigs/aula.setlist.md': AULA,
    });
    await makeBook(fs, 'ana', { 'aula.setlist.md': AULA });
    // A setlist-named file inside `.git` must never be listed.
    await writeFile(fs, '/books/band/.git/escondida.setlist.md', STRAY);
    // An uncommitted setlist present in the tree is listed (the tree reports it `new`).
    await writeFile(fs, '/books/band/nova.setlist.md', STRAY);

    const rows = await listSetlists({
      fs,
      bookDir,
      bookIds: ['band', 'ana'],
      hasCommits: hasCommitsOn(fs),
    });
    expect(rows).toEqual([
      { bookId: 'band', path: 'ensaio.setlist.md', title: 'Ensaio de sábado', count: 2, status: null },
      { bookId: 'band', path: 'gigs/aula.setlist.md', title: 'Aula de terça', count: 1, status: null },
      { bookId: 'band', path: 'nova.setlist.md', title: 'Lista perdida', count: 1, status: null },
      { bookId: 'ana', path: 'aula.setlist.md', title: 'Aula de terça', count: 1, status: null },
    ]);
  });

  it('rows carry the setlist\'s status: new for a file never committed, unsaved for one changed since main, null when clean (books.setlist_done Constraint 4)', async () => {
    const fs = freshFs();
    await makeBook(fs, 'band', {
      'ensaio.setlist.md': ENSAIO,
      'gigs/aula.setlist.md': AULA,
    });
    // One committed setlist edited in the working tree, one left clean, one
    // written and never committed.
    await writeFile(fs, '/books/band/ensaio.setlist.md', `${ENSAIO}3. Mais uma\n`);
    await writeFile(fs, '/books/band/nova.setlist.md', STRAY);

    const rows = await listSetlists({
      fs,
      bookDir,
      bookIds: ['band'],
      hasCommits: hasCommitsOn(fs),
      statusOf: statusAtMain({ fs, bookDir }),
    });
    expect(rows.map((r) => [r.path, r.status])).toEqual([
      ['ensaio.setlist.md', 'unsaved'],
      ['gigs/aula.setlist.md', null],
      ['nova.setlist.md', 'new'],
    ]);
  });

  it('a status read that throws leaves the row listed with status null (books.setlist_done Constraint 4; setlists_resilient Constraint 2)', async () => {
    const fs = freshFs();
    await makeBook(fs, 'band', { 'ensaio.setlist.md': ENSAIO });
    await writeFile(fs, '/books/band/nova.setlist.md', STRAY);
    const failing = new Error('the store is unreadable');
    failing.code = 'EIO';

    const rows = await listSetlists({
      fs,
      bookDir,
      bookIds: ['band'],
      hasCommits: hasCommitsOn(fs),
      statusOf: async (bookId, path) => {
        if (path === 'nova.setlist.md') throw failing;
        return 'unsaved';
      },
    });
    expect(rows).toEqual([
      { bookId: 'band', path: 'ensaio.setlist.md', title: 'Ensaio de sábado', count: 2, status: 'unsaved' },
      { bookId: 'band', path: 'nova.setlist.md', title: 'Lista perdida', count: 1, status: null },
    ]);
  });
});
