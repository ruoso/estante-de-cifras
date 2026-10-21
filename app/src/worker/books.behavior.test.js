import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';
import { log, listFiles, resolveRef, readBlob, add as gitAdd, commit as gitCommit } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook, HOME_BOOK_ID } from './home-book.js';
import { createWorkerLogic } from './logic.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';

// behavior — the shelf WRITE path driven through the real command/event path
// (books.shelf). `createWorkerLogic` runs in-process over the loopback double
// with an injected `fake-indexeddb`, `installWebLocks()` active, and the git
// layer over a `createFileSystem` — NO remote, a LOCAL home book (workflow 7
// L25: "No account needed"). The git CLI is not needed: a local book makes no
// network call, so committed state is asserted against the Worker's own
// lightning-fs with isomorphic-git (`log`, `listFiles`, `resolveRef`,
// `readBlob`). Pins workflow 7 L16-18, L25; home-book-format §2.1, §4.2;
// offline-first. All titles are written for this test (no-song-text / no-labels
// rule).

const IDENTITY = { id: 'u_8f3a21', name: 'A Tester' };
const rand = () => Math.random().toString(36).slice(2);

// The home book's §2.2 identity bytes (distinct from a songbook's), pinned here
// independently of the module.
const HOME_README_BYTES = `# Home book

This repository holds one person's Estante de Cifras settings. Its files are
JSON that merge key by key, the later change winning; it is written and merged
by the app, not edited by hand. The format is docs/home-book-format.md in the
estante-de-cifras repository.
`;
const HOME_GITATTRIBUTES_BYTES = `* text=auto eol=lf
*.json merge=binary
`;
// A new songbook's §2.1 .gitattributes: the cifra merge driver, and nothing
// else (app/example-book/.gitattributes).
const SONGBOOK_GITATTRIBUTES_BYTES = `*.cifra.md merge=cifra
*.setlist.md merge=cifra
`;

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

// A Worker over its own fake IndexedDB and filesystem, the device id computed up
// front (so the test can read the `local` namespace under it), a `fetch` spy
// that records any network attempt and refuses it (offline), and the loopback
// endpoint whose events the test collects. No remote is cloned — a local book
// needs none.
async function makeWorker(label) {
  const idb = new IDBFactory();
  const name = `books-${label}-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const fetchCalls = [];
  const spyFetch = (...args) => {
    fetchCalls.push(args);
    return Promise.reject(new Error('offline: no network in this test'));
  };
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: spyFetch }) });
  const locks = createBookLocks({ navigator });
  // The device id the Worker's surface narrows `local` to (§7); computing it here
  // persists it to the same `meta` db the Worker opens, so both agree.
  const deviceId = await createHomeBook({ fs, git, locks }).ensureDeviceId({ idb, name });
  const events = [];
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: spyFetch }),
  );
  endpoint.onmessage = (ev) => events.push(ev.data);
  const send = (cmd) => endpoint.postMessage(cmd);
  const readHomeFile = (file) => fs.promises.readFile(`${git.bookDir(HOME_BOOK_ID)}/${file}`, 'utf8');
  return { idb, name, fs, git, deviceId, events, send, fetchCalls, readHomeFile };
}

const lastEvent = (events, kind) => [...events].reverse().find((e) => e.kind === kind);

describe('the shelf write path (behavior)', () => {
  it('New book is an empty local repository, no account, re-surfaced and announced, offline (workflow 7 L25; §2.1)', async () => {
    const w = await makeWorker('new');

    w.send(command(CommandKind.CREATE_BOOK, { title: 'Quarta à noite', author: IDENTITY }));

    let created;
    await waitFor(() => {
      created = lastEvent(w.events, EventKind.BOOK_CREATED);
      expect(created).toBeTruthy();
    });
    const { bookId } = created.payload;
    expect(bookId).toMatch(/^local-/);

    // (1) A local home book was provisioned with the §2.2 identity bytes.
    const homeDir = w.git.bookDir(HOME_BOOK_ID);
    expect(await w.readHomeFile('README.md')).toBe(HOME_README_BYTES);
    expect(await w.readHomeFile('.gitattributes')).toBe(HOME_GITATTRIBUTES_BYTES);
    expect(await resolveRef({ fs: w.fs, dir: homeDir, ref: 'main' })).toBeTruthy();

    // (2) The book is a git repo whose ONE commit holds README.md = `# {title}`
    // and the §2.1 .gitattributes — and nothing else (§2.1).
    const bookDir = w.git.bookDir(bookId);
    const files = await listFiles({ fs: w.fs, dir: bookDir, ref: 'main' });
    expect([...files].sort()).toEqual(['.gitattributes', 'README.md']);
    expect(await w.fs.promises.readFile(`${bookDir}/README.md`, 'utf8')).toBe('# Quarta à noite\n');
    expect(await w.fs.promises.readFile(`${bookDir}/.gitattributes`, 'utf8')).toBe(
      SONGBOOK_GITATTRIBUTES_BYTES,
    );
    expect(await log({ fs: w.fs, dir: bookDir, ref: 'main' })).toHaveLength(1);

    // (3) shelf.json holds local.<deviceId>.<bookId>.{ title, position: 0 }.
    const shelf = JSON.parse(await w.readHomeFile('shelf.json'));
    expect(shelf.local[w.deviceId][bookId].title.value).toBe('Quarta à noite');
    expect(shelf.local[w.deviceId][bookId].position.value).toBe(0);

    // (4) SHELF re-surfaced with the book, narrowed to this device.
    const shelfEvent = lastEvent(w.events, EventKind.SHELF);
    expect(shelfEvent.payload.local[bookId].title.value).toBe('Quarta à noite');

    // (5) Offline: no network call, no push.
    expect(w.fetchCalls).toHaveLength(0);
  });

  it('CREATE_BOOK indexes the new book: INDEX_STATUS ready with songs 0 before BOOK_CREATED (books.new_book_counted; workflow 7 L24-26)', async () => {
    const w = await makeWorker('counted');

    w.send(command(CommandKind.CREATE_BOOK, { title: 'Terça cedo', author: IDENTITY }));

    let created;
    await waitFor(() => {
      created = lastEvent(w.events, EventKind.BOOK_CREATED);
      expect(created).toBeTruthy();
    });
    const { bookId } = created.payload;

    // The row's count arrives before the view moves focus to the new row, so it
    // reads *0 songs*, never *still loading* (workflow 7 L24-26).
    const readyAt = w.events.findIndex(
      (e) => e.kind === EventKind.INDEX_STATUS && e.payload.bookId === bookId && e.payload.state === 'ready',
    );
    expect(readyAt).toBeGreaterThanOrEqual(0);
    expect(w.events[readyAt].payload.songs).toBe(0);
    expect(readyAt).toBeLessThan(w.events.indexOf(created));

    // Indexing is local: still no network call, no push (offline-first).
    expect(w.fetchCalls).toHaveLength(0);
  });

  // storage.fs_flush behavior case 3: the CREATE_BOOK handler's tail flush makes
  // BOTH the new book's repo and the home-book shelf write durable against the
  // 500ms superblock debounce. The in-test synchronous turn never elapses the
  // debounce, so a fresh filesystem instance (the cold open a reloaded tab
  // performs) only finds the book and its shelf entry if the handler flushed the
  // global superblock — remove the flush and this ENOENTs / loses the entry.
  // Proves the handler-tail/global-superblock decision (Decision 2, 3). Pins
  // workflow 7 §The book-management screen, DIRECTION §3 L105-110,
  // tasks/40-storage.tji:102.
  it('CREATE_BOOK then an immediate cold reopen finds the book repo AND its shelf entry (storage.fs_flush)', async () => {
    const w = await makeWorker('flush');

    w.send(command(CommandKind.CREATE_BOOK, { title: 'Terça à tarde', author: IDENTITY }));
    let created;
    await waitFor(() => {
      created = lastEvent(w.events, EventKind.BOOK_CREATED);
      expect(created).toBeTruthy();
    });
    const { bookId } = created.payload;

    // A brand-new filesystem instance over the same backing store (idb + name):
    // the cold open a reloaded tab performs. It loads the superblock freshly from
    // IndexedDB, so it only sees data the handler-tail flush forced out.
    const freshFs = createFileSystem(`${w.name}-fs`, { indexedDB: w.idb });
    const freshGit = createGitLayer({
      fs: freshFs,
      http: createGitHttpClient({ fetch: () => Promise.reject(new Error('offline')) }),
    });

    // (1) The new book's repo: README.md = `# {title}\n` and the §2.1
    // .gitattributes — found, no ENOENT.
    const bookDir = freshGit.bookDir(bookId);
    const files = await listFiles({ fs: freshFs, dir: bookDir, ref: 'main' });
    expect([...files].sort()).toEqual(['.gitattributes', 'README.md']);
    expect(await freshFs.promises.readFile(`${bookDir}/README.md`, 'utf8')).toBe(
      '# Terça à tarde\n',
    );
    expect(await freshFs.promises.readFile(`${bookDir}/.gitattributes`, 'utf8')).toBe(
      SONGBOOK_GITATTRIBUTES_BYTES,
    );

    // (2) The home book's shelf.json lists the book under local.<deviceId>.<bookId>
    // — the book is not orphaned off the shelf.
    const homeDir = freshGit.bookDir(HOME_BOOK_ID);
    const shelf = JSON.parse(
      await freshFs.promises.readFile(`${homeDir}/shelf.json`, 'utf8'),
    );
    expect(shelf.local[w.deviceId][bookId].title.value).toBe('Terça à tarde');
    expect(shelf.local[w.deviceId][bookId].position.value).toBe(0);
  });

  it('position increments: a second New book gets position 1 (shelf order)', async () => {
    const w = await makeWorker('pos');

    w.send(command(CommandKind.CREATE_BOOK, { title: 'Primeiro', author: IDENTITY }));
    w.send(command(CommandKind.CREATE_BOOK, { title: 'Segundo', author: IDENTITY }));

    let created;
    await waitFor(() => {
      created = w.events.filter((e) => e.kind === EventKind.BOOK_CREATED);
      expect(created).toHaveLength(2);
    });
    const [first, second] = created.map((e) => e.payload.bookId);

    const shelf = JSON.parse(await w.readHomeFile('shelf.json'));
    expect(shelf.local[w.deviceId][first].position.value).toBe(0);
    expect(shelf.local[w.deviceId][second].position.value).toBe(1);
    expect(w.fetchCalls).toHaveLength(0);
  });

  it('Rename changes nothing in the repository: local → title, shared → label, offline (workflow 7 L16-18)', async () => {
    const w = await makeWorker('rename');

    // Make a local book to rename.
    w.send(command(CommandKind.CREATE_BOOK, { title: 'Exercícios', author: IDENTITY }));
    let created;
    await waitFor(() => {
      created = lastEvent(w.events, EventKind.BOOK_CREATED);
      expect(created).toBeTruthy();
    });
    const { bookId } = created.payload;
    const bookDir = w.git.bookDir(bookId);

    // The book's commit and README blob, before the rename.
    const headBefore = await resolveRef({ fs: w.fs, dir: bookDir, ref: 'main' });
    const readmeBefore = (
      await readBlob({ fs: w.fs, dir: bookDir, oid: headBefore, filepath: 'README.md' })
    ).oid;

    // (1) A local book renames via its `title` register.
    w.send(command(CommandKind.RENAME_BOOK, { bookId, name: 'Quinta', author: IDENTITY }));
    await waitFor(() => {
      const ev = lastEvent(w.events, EventKind.SHELF);
      expect(ev?.payload.local[bookId]?.title?.value).toBe('Quinta');
    });
    const shelf = JSON.parse(await w.readHomeFile('shelf.json'));
    expect(shelf.local[w.deviceId][bookId].title.value).toBe('Quinta');

    // The book's repository is unchanged — asserted by oid (no README edit, no
    // file rename).
    const headAfter = await resolveRef({ fs: w.fs, dir: bookDir, ref: 'main' });
    expect(headAfter).toBe(headBefore);
    const readmeAfter = (
      await readBlob({ fs: w.fs, dir: bookDir, oid: headAfter, filepath: 'README.md' })
    ).oid;
    expect(readmeAfter).toBe(readmeBefore);

    // (2) A shared book id (not in this device's `local`) renames via `label`.
    w.send(command(CommandKind.RENAME_BOOK, { bookId: 'b-shared', name: 'Choros', author: IDENTITY }));
    await waitFor(() => {
      const ev = lastEvent(w.events, EventKind.SHELF);
      expect(ev?.payload.books['b-shared']?.label?.value).toBe('Choros');
    });
    const shelf2 = JSON.parse(await w.readHomeFile('shelf.json'));
    expect(shelf2.books['b-shared'].label.value).toBe('Choros');

    // Offline throughout: no network call, no push.
    expect(w.fetchCalls).toHaveLength(0);
  });

  // storage.shelf_flush behavior case 2: the RENAME_BOOK handler's tail flush
  // makes the home-book shelf register change durable against the 500ms
  // superblock debounce. The only write is home.set's shelf change, which does
  // not flush on its own; the in-test synchronous turn never elapses the
  // debounce, so a fresh filesystem instance (the cold open a reloaded tab
  // performs) only reads the NEW name if the handler forced the global
  // superblock out — remove the flush and it reads the old name. Reads through a
  // FRESH createFileSystem, never the live readHomeFile window, which would pass
  // either way (Decision 4). Both a local book's `title` and a shared book's
  // `label` survive. Pins workflow 7 L16-18, DIRECTION §3 L108-110.
  it('RENAME_BOOK then an immediate cold reopen keeps the new label (storage.shelf_flush)', async () => {
    const w = await makeWorker('rename-flush');

    // A local book to rename, plus a shared-book rename (no repo needed).
    w.send(command(CommandKind.CREATE_BOOK, { title: 'Exercícios', author: IDENTITY }));
    let created;
    await waitFor(() => {
      created = lastEvent(w.events, EventKind.BOOK_CREATED);
      expect(created).toBeTruthy();
    });
    const { bookId } = created.payload;

    w.send(command(CommandKind.RENAME_BOOK, { bookId, name: 'Quinta', author: IDENTITY }));
    await waitFor(() => {
      const ev = lastEvent(w.events, EventKind.SHELF);
      expect(ev?.payload.local[bookId]?.title?.value).toBe('Quinta');
    });
    w.send(command(CommandKind.RENAME_BOOK, { bookId: 'b-shared', name: 'Choros', author: IDENTITY }));
    await waitFor(() => {
      const ev = lastEvent(w.events, EventKind.SHELF);
      expect(ev?.payload.books['b-shared']?.label?.value).toBe('Choros');
    });

    // A brand-new filesystem instance over the same backing store (idb + name):
    // the cold open a reloaded tab performs. It loads the superblock freshly from
    // IndexedDB, so it only sees data the handler-tail flush forced out.
    const freshFs = createFileSystem(`${w.name}-fs`, { indexedDB: w.idb });
    const freshGit = createGitLayer({
      fs: freshFs,
      http: createGitHttpClient({ fetch: () => Promise.reject(new Error('offline')) }),
    });

    const homeDir = freshGit.bookDir(HOME_BOOK_ID);
    const shelf = JSON.parse(
      await freshFs.promises.readFile(`${homeDir}/shelf.json`, 'utf8'),
    );
    // A local book's new name (its `title` register) survives the cold open.
    expect(shelf.local[w.deviceId][bookId].title.value).toBe('Quinta');
    // A shared book's new name (its `label` register) survives the cold open.
    expect(shelf.books['b-shared'].label.value).toBe('Choros');
  });
});

// behavior — the shelf heal at OPEN (songs.no_raw_ids Constraints 6-8;
// workflow 7 L16-21, amended). A `local-…` book on the device whose entry in
// THIS device's shelf namespace is gone — a device id minted afresh, or a reload
// between the book's repository and its shelf write (the refinement's causes
// 1-2) — is put back under its README's heading when the app opens. Each case
// edits the device's storage the way a cold tab would see it (a fresh
// filesystem over the same IndexedDB), then starts a new Worker over it and
// sends OPEN, as a reload does.
describe('the shelf heal at OPEN (behavior; songs.no_raw_ids)', () => {
  const offline = () => Promise.reject(new Error('offline: no network in this test'));

  // A cold view of the device's filesystem (a new lightning-fs instance over the
  // same backing store) with its own git layer and home book.
  function cold(w) {
    const fs = createFileSystem(`${w.name}-fs`, { indexedDB: w.idb });
    const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: offline }) });
    const home = createHomeBook({ fs, git, locks: createBookLocks({ navigator }) });
    return { fs, git, home };
  }

  // A new Worker over the same IndexedDB (a reload), sent OPEN. Resolves once
  // its first SHELF event is out — the heal runs before it — and the book
  // `waitFor` names has been indexed (OPEN's sweep is done with it).
  async function reopen(w, indexed) {
    const events = [];
    const endpoint = createLoopbackEndpoint((port) =>
      createWorkerLogic(port, { indexedDB: w.idb, name: w.name, fetch: offline }),
    );
    endpoint.onmessage = (ev) => events.push(ev.data);
    endpoint.postMessage(command(CommandKind.OPEN, {}));
    await waitFor(() => {
      expect(lastEvent(events, EventKind.SHELF)).toBeTruthy();
      expect(
        events.some((e) => e.kind === EventKind.INDEX_STATUS && e.payload.bookId === indexed && e.payload.state === 'ready'),
      ).toBe(true);
    });
    return events;
  }

  const homeHead = (w) => {
    const { fs, git } = cold(w);
    return resolveRef({ fs, dir: git.bookDir(HOME_BOOK_ID), ref: 'main' });
  };
  const readShelf = async (w) => {
    const { fs, git } = cold(w);
    return JSON.parse(await fs.promises.readFile(`${git.bookDir(HOME_BOOK_ID)}/shelf.json`, 'utf8'));
  };

  async function createBook(w, title) {
    w.send(command(CommandKind.CREATE_BOOK, { title, author: IDENTITY }));
    let created;
    await waitFor(() => {
      created = w.events.find((e) => e.kind === EventKind.BOOK_CREATED);
      expect(created).toBeTruthy();
    });
    return created.payload.bookId;
  }

  // Drop the book's entry from this device's namespace in shelf.json (absent,
  // not tombstoned) and commit, as if the shelf write had never landed.
  async function dropEntry(w, bookId) {
    const { fs, git } = cold(w);
    const dir = git.bookDir(HOME_BOOK_ID);
    const shelf = JSON.parse(await fs.promises.readFile(`${dir}/shelf.json`, 'utf8'));
    delete shelf.local[w.deviceId][bookId];
    await fs.promises.writeFile(`${dir}/shelf.json`, `${JSON.stringify(shelf, null, 2)}\n`);
    await gitAdd({ fs, dir, filepath: 'shelf.json' });
    const who = { name: IDENTITY.name, email: `${IDENTITY.id}@example.test`, timestamp: 1760000000, timezoneOffset: 0 };
    await gitCommit({ fs, dir, ref: 'refs/heads/main', message: 'Update shelf.json', author: who, committer: who });
    await fs.flush();
  }

  it('OPEN puts a local book with no shelf entry back under its README heading (workflow 7 L16-21; causes 1-2)', async () => {
    const w = await makeWorker('heal');
    const kept = await createBook(w, 'Rascunhos');
    w.events.length = 0;
    const lost = await createBook(w, 'Cadernos da Praça');
    await dropEntry(w, lost);
    expect((await readShelf(w)).local[w.deviceId][lost]).toBeUndefined();

    const events = await reopen(w, lost);

    const surfaced = lastEvent(events, EventKind.SHELF).payload.local;
    expect(surfaced[lost].title.value).toBe('Cadernos da Praça');
    expect(typeof surfaced[lost].position.value).toBe('number');
    // Past every position on the shelf, so it does not collide with the kept one.
    expect(surfaced[lost].position.value).toBeGreaterThan(surfaced[kept].position.value);
    // Durable: the home book holds it in this device's namespace.
    expect((await readShelf(w)).local[w.deviceId][lost].title.value).toBe('Cadernos da Praça');
    expect(w.fetchCalls).toHaveLength(0);
  });

  it('a second OPEN writes nothing — the home book’s main is unchanged (Constraint 6)', async () => {
    const w = await makeWorker('heal-twice');
    const lost = await createBook(w, 'Cadernos da Praça');
    await dropEntry(w, lost);
    await reopen(w, lost);
    const healed = await homeHead(w);

    const events = await reopen(w, lost);

    expect(await homeHead(w)).toBe(healed);
    expect(lastEvent(events, EventKind.SHELF).payload.local[lost].title.value).toBe('Cadernos da Praça');
  });

  it('a removed book is not resurrected — its tombstoned entry stays (Constraint 8; §5.3)', async () => {
    const w = await makeWorker('heal-removed');
    const removed = await createBook(w, 'Antigo');
    // Tombstone the entry as removeFromShelf does, leaving the directory.
    const { fs, home } = cold(w);
    await home.set({
      bookId: HOME_BOOK_ID,
      file: 'shelf.json',
      changes: [
        { path: ['local', w.deviceId, removed, 'title'], value: null },
        { path: ['local', w.deviceId, removed, 'position'], value: null },
      ],
      author: IDENTITY,
    });
    await fs.flush();
    const before = await homeHead(w);

    const events = await reopen(w, removed);

    const surfaced = lastEvent(events, EventKind.SHELF).payload.local[removed];
    expect(surfaced.title.value).toBeNull();
    expect(surfaced.position.value).toBeNull();
    expect(await homeHead(w)).toBe(before);
  });

  it('a hosted clone with no books entry is not adopted as local (Constraint 8; Decision 4)', async () => {
    const w = await makeWorker('heal-hosted');
    await createBook(w, 'Rascunhos');
    // A hosted book's clone (a service id, not `local-…`) on the device with no
    // shelf entry at all.
    const HOSTED = 'b7c1e2d3-0000-4000-8000-000000000001';
    const { fs, git } = cold(w);
    const dir = git.bookDir(HOSTED);
    await git.init({ dir });
    await fs.promises.writeFile(`${dir}/README.md`, '# Clone da Turma\n');
    await gitAdd({ fs, dir, filepath: 'README.md' });
    const who = { name: IDENTITY.name, email: `${IDENTITY.id}@example.test`, timestamp: 1760000000, timezoneOffset: 0 };
    await gitCommit({ fs, dir, ref: 'refs/heads/main', message: 'Create book', author: who, committer: who });
    await fs.flush();
    const before = await homeHead(w);

    const events = await reopen(w, HOSTED);

    const shelf = lastEvent(events, EventKind.SHELF).payload;
    expect(shelf.local[HOSTED]).toBeUndefined();
    expect(shelf.books[HOSTED]).toBeUndefined();
    expect(await homeHead(w)).toBe(before);
  });
});
