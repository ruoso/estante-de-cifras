import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { waitFor } from '@testing-library/react';
import { log } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook, HOME_BOOK_ID } from './home-book.js';
import { createWorkerLogic } from './logic.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { songRefOf } from './songs.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';

// behavior — the reading-state command/event path (songs.reading) driven through
// the real Worker. `createWorkerLogic` runs in-process over the loopback double
// with an injected `fake-indexeddb`, `installWebLocks()` active, and the git
// layer over a `createFileSystem` — NO remote, a LOCAL home book (reading state
// is a preference, auto-committed, never pushed — DIRECTION §3.2). A local home
// book makes no network call, so "no user push" is asserted by the offline fetch
// spy staying empty, and the commit by the Worker's own lightning-fs. Pins
// DIRECTION §3.2, home-book-format §4.5, workflow 2 L73-74, L135-138. Song refs
// are written for this test (no-song-text rule).

const IDENTITY = { id: 'u_8f3a21', name: 'A Tester' };
const rand = () => Math.random().toString(36).slice(2);

// The song the reading state is keyed by — a book id and a purpose-written path.
const BOOK = 'local-example-book';
const PATH = 'tarde-clara.cifra.md';
const REF = songRefOf(BOOK, PATH);
// The §6.3 tuning identity the per-tuning variation map is keyed by (a guitar).
const GUITAR = '40 45 50 55 59 64';

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

async function makeWorker(label) {
  const idb = new IDBFactory();
  const name = `song-state-${label}-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const fetchCalls = [];
  const spyFetch = (...args) => {
    fetchCalls.push(args);
    return Promise.reject(new Error('offline: no network in this test'));
  };
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: spyFetch }) });
  const locks = createBookLocks({ navigator });
  await createHomeBook({ fs, git, locks }).ensureDeviceId({ idb, name });
  const events = [];
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: spyFetch }),
  );
  endpoint.onmessage = (ev) => events.push(ev.data);
  const send = (cmd) => endpoint.postMessage(cmd);
  const readSongs = async () => {
    try {
      return JSON.parse(await fs.promises.readFile(`${git.bookDir(HOME_BOOK_ID)}/songs.json`, 'utf8'));
    } catch (err) {
      if (err?.code === 'ENOENT') return null;
      throw err;
    }
  };
  const homeCommitCount = async () => {
    try {
      return (await log({ fs, dir: git.bookDir(HOME_BOOK_ID), ref: 'main' })).length;
    } catch {
      return 0;
    }
  };
  return { idb, name, fs, git, events, send, fetchCalls, readSongs, homeCommitCount };
}

const lastEvent = (events, kind) => [...events].reverse().find((e) => e.kind === kind);
const waitForSong = async (w) => {
  let song;
  await waitFor(() => {
    song = lastEvent(w.events, EventKind.SONG);
    expect(song).toBeTruthy();
  });
  return song.payload;
};

describe('the reading-state path (behavior)', () => {
  it('OPEN_SONG surfaces the written key and no variation for a fresh song (§4.5)', async () => {
    const w = await makeWorker('open');
    w.send(command(CommandKind.OPEN_SONG, { bookId: BOOK, path: PATH }));
    const payload = await waitForSong(w);
    expect(payload).toMatchObject({ bookId: BOOK, path: PATH, transposition: 0, variations: {} });
    // A pure read surfaced it without writing a home book at all.
    expect(await w.readSongs()).toBeNull();
    expect(w.fetchCalls).toHaveLength(0);
  });

  it('SET_TRANSPOSITION writes the offset register, re-surfaces SONG, commits, never pushes', async () => {
    const w = await makeWorker('transpose');
    const before = await w.homeCommitCount();

    w.send(command(CommandKind.SET_TRANSPOSITION, { bookId: BOOK, path: PATH, semitones: 2, author: IDENTITY }));
    await waitFor(() => {
      const song = lastEvent(w.events, EventKind.SONG);
      expect(song?.payload?.transposition).toBe(2);
    });

    // The register landed in songs.json under the §2.3 ref.
    const songs = await w.readSongs();
    expect(songs[REF].transposition.value).toBe(2);
    expect(typeof songs[REF].transposition.at).toBe('string');
    // An automatic home-book commit was made, and no network/push happened.
    expect(await w.homeCommitCount()).toBeGreaterThan(before);
    expect(w.fetchCalls).toHaveLength(0);

    // A later OPEN_SONG re-surfaces the remembered offset (re-applied on open).
    w.send(command(CommandKind.OPEN_SONG, { bookId: BOOK, path: PATH }));
    await waitFor(() => {
      const song = lastEvent(w.events, EventKind.SONG);
      expect(song?.payload?.transposition).toBe(2);
    });
  });

  it('SET_VARIATION writes the per-tuning register and re-surfaces SONG (workflow 2 L73-74)', async () => {
    const w = await makeWorker('variation');

    w.send(
      command(CommandKind.SET_VARIATION, {
        bookId: BOOK,
        path: PATH,
        tuning: GUITAR,
        variation: 'Up the neck',
        author: IDENTITY,
      }),
    );
    await waitFor(() => {
      const song = lastEvent(w.events, EventKind.SONG);
      expect(song?.payload?.variations?.[GUITAR]).toBe('Up the neck');
    });

    const songs = await w.readSongs();
    expect(songs[REF].variation[GUITAR].value).toBe('Up the neck');
    expect(w.fetchCalls).toHaveLength(0);
  });

  it('RECORD_RECENT on open makes no home-book song commit (Decision 2)', async () => {
    const w = await makeWorker('recent');
    w.send(command(CommandKind.RECORD_RECENT, { bookId: BOOK, path: PATH }));
    await waitFor(() => expect(lastEvent(w.events, EventKind.RECENTS)).toBeTruthy());
    // Recents are device-local: songs.json was never written.
    expect(await w.readSongs()).toBeNull();
    expect(w.fetchCalls).toHaveLength(0);
  });
});
