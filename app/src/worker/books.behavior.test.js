import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';
import { log, listFiles, resolveRef, readBlob } from 'isomorphic-git';
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
});
