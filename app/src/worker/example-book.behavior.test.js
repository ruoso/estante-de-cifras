import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';
import { log, listFiles } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook, HOME_BOOK_ID } from './home-book.js';
import { createWorkerLogic } from './logic.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import { EXAMPLE_BOOK_ID, EXAMPLE_BOOK_FILES } from './example-book.js';

// behavior — opening the bundled example book driven through the real
// command/event path (account.first_run, workflow 1 §Cold). `createWorkerLogic`
// runs in-process over the loopback double with an injected `fake-indexeddb`,
// `installWebLocks()` active, and the git layer over a `createFileSystem` — NO
// remote, a LOCAL home book (no account). Committed state is asserted against the
// Worker's own lightning-fs with isomorphic-git. Pins workflow 1 L29-33;
// home-book-format §4.2; DIRECTION §3.7. The seeded book is the project's
// purpose-written example (no copyrighted words; the first standing rule).

const IDENTITY = { id: 'local', name: 'Me' };
const LABEL = 'Example Book';
const rand = () => Math.random().toString(36).slice(2);

// The bundled files keyed by name, for byte-for-byte tree assertions.
const bundled = Object.fromEntries(EXAMPLE_BOOK_FILES.map((f) => [f.name, f.bytes]));

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

async function makeWorker(label) {
  const idb = new IDBFactory();
  const name = `example-${label}-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const fetchCalls = [];
  const spyFetch = (...args) => {
    fetchCalls.push(args);
    return Promise.reject(new Error('offline: no network in this test'));
  };
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: spyFetch }) });
  const locks = createBookLocks({ navigator });
  const deviceId = await createHomeBook({ fs, git, locks }).ensureDeviceId({ idb, name });
  const events = [];
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: spyFetch }),
  );
  endpoint.onmessage = (ev) => events.push(ev.data);
  const send = (cmd) => endpoint.postMessage(cmd);
  const readHomeFile = (file) =>
    fs.promises.readFile(`${git.bookDir(HOME_BOOK_ID)}/${file}`, 'utf8');
  return { idb, name, fs, git, deviceId, events, send, fetchCalls, readHomeFile };
}

const lastEvent = (events, kind) => [...events].reverse().find((e) => e.kind === kind);
const open = (w) => w.send(command(CommandKind.OPEN_EXAMPLE_BOOK, { title: LABEL, author: IDENTITY }));

describe('opening the example book (behavior)', () => {
  it('seeds one local repository at the reserved id whose tree is the bundled files byte for byte (workflow 1 L29-33)', async () => {
    const w = await makeWorker('seed');
    open(w);

    let created;
    await waitFor(() => {
      created = lastEvent(w.events, EventKind.BOOK_CREATED);
      expect(created).toBeTruthy();
    });
    expect(created.payload.bookId).toBe(EXAMPLE_BOOK_ID);

    // The repository's one commit holds exactly the bundled files, byte for byte.
    const dir = w.git.bookDir(EXAMPLE_BOOK_ID);
    const files = await listFiles({ fs: w.fs, dir, ref: 'main' });
    expect([...files].sort()).toEqual(EXAMPLE_BOOK_FILES.map((f) => f.name).sort());
    for (const { name, bytes } of EXAMPLE_BOOK_FILES) {
      expect(await w.fs.promises.readFile(`${dir}/${name}`, 'utf8')).toBe(bytes);
    }
    // The §2.1 README (its H1 is the title) and the §2.1 .gitattributes.
    expect(bundled['README.md'].startsWith('# Example Book')).toBe(true);
    expect(bundled['.gitattributes']).toBe('*.cifra.md merge=cifra\n*.setlist.md merge=cifra\n');
    expect(await log({ fs: w.fs, dir, ref: 'main' })).toHaveLength(1);

    // shelf.local.<deviceId>.<exampleId>.{ title, position }.
    const shelf = JSON.parse(await w.readHomeFile('shelf.json'));
    const entry = shelf.local[w.deviceId][EXAMPLE_BOOK_ID];
    expect(entry.title.value).toBe(LABEL);
    expect(entry.position.value).toBe(0);
  });

  it('emits SHELF before BOOK_CREATED, with the book under its label (home-book-format §4.2)', async () => {
    const w = await makeWorker('events');
    open(w);
    await waitFor(() => expect(lastEvent(w.events, EventKind.BOOK_CREATED)).toBeTruthy());

    const kinds = w.events.map((e) => e.kind);
    expect(kinds.indexOf(EventKind.SHELF)).toBeGreaterThanOrEqual(0);
    expect(kinds.indexOf(EventKind.SHELF)).toBeLessThan(kinds.indexOf(EventKind.BOOK_CREATED));

    const shelfEvent = lastEvent(w.events, EventKind.SHELF);
    expect(shelfEvent.payload.local[EXAMPLE_BOOK_ID].title.value).toBe(LABEL);
  });

  it('indexes the book so a SEARCH finds a song in it', async () => {
    const w = await makeWorker('search');
    open(w);
    await waitFor(() => expect(lastEvent(w.events, EventKind.BOOK_CREATED)).toBeTruthy());

    w.send(command(CommandKind.SEARCH, { query: 'ferry' }));
    let results;
    await waitFor(() => {
      const ev = lastEvent(w.events, EventKind.SEARCH_RESULTS);
      results = ev?.payload.results ?? [];
      expect(results.length).toBeGreaterThan(0);
    });
    expect(results.some((r) => r.bookId === EXAMPLE_BOOK_ID)).toBe(true);
  });

  it('makes no network call and no push (offline-first)', async () => {
    const w = await makeWorker('offline');
    open(w);
    await waitFor(() => expect(lastEvent(w.events, EventKind.BOOK_CREATED)).toBeTruthy());
    expect(w.fetchCalls).toHaveLength(0);
  });

  it('is idempotent: a second open adds no second repository and no duplicate entry (Decision 3)', async () => {
    const w = await makeWorker('idem');

    open(w);
    await waitFor(() => expect(w.events.filter((e) => e.kind === EventKind.BOOK_CREATED)).toHaveLength(1));
    open(w);
    await waitFor(() => expect(w.events.filter((e) => e.kind === EventKind.BOOK_CREATED)).toHaveLength(2));

    // Only the home book and the one example repository exist on disk.
    const books = await w.fs.promises.readdir('/books');
    expect([...books].sort()).toEqual([EXAMPLE_BOOK_ID, HOME_BOOK_ID].sort());
    // The repository was written once — the second open skipped the git write.
    const dir = w.git.bookDir(EXAMPLE_BOOK_ID);
    expect(await log({ fs: w.fs, dir, ref: 'main' })).toHaveLength(1);
    // Exactly one local shelf entry for this device, at its original position.
    const shelf = JSON.parse(await w.readHomeFile('shelf.json'));
    expect(Object.keys(shelf.local[w.deviceId])).toEqual([EXAMPLE_BOOK_ID]);
    expect(shelf.local[w.deviceId][EXAMPLE_BOOK_ID].position.value).toBe(0);
  });
});
