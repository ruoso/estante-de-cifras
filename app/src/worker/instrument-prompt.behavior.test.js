// Behavior (Worker) — the first-open instrument prompt's "answered" flag
// (songs.first_song, workflow 1 §The instrument). Drives the real Worker logic
// in-process over the loopback endpoint against a fake IndexedDB and the Web
// Locks shim: MARK_INSTRUMENT_PROMPT_SEEN writes the single `instrumentPromptSeen`
// register into the home book's preferences.json (home-book-format §4.1),
// auto-commits it locally, never pushes (DIRECTION §3.2), and re-surfaces
// PREFERENCES — provisioning a local home book first on a brand-new profile. The
// online case clones a real git smart-HTTP remote to prove a configured remote is
// still never pushed to. No song text, no values logged (standing rule).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { execFileSync } from 'node:child_process';
import { log as gitLog, resolveRef } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { HOME_BOOK_ID } from './home-book.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

const AUTHOR = { id: 'local', name: 'Me' };
const HOME_DIR = `/books/${HOME_BOOK_ID}`;

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

const until = (fn) => new Promise((resolve, reject) => {
  const started = Date.now();
  const tick = async () => {
    try {
      resolve(await fn());
    } catch (err) {
      if (Date.now() - started > 8000) reject(err);
      else setTimeout(tick, 25);
    }
  };
  tick();
});

// A new fake-IndexedDB + Worker-logic store, with no network (a local home book
// never fetches — an offline fetch spy stands in), mirroring the sibling rigs.
function makeWorker() {
  const idb = new IDBFactory();
  const name = `ip-${Math.random().toString(36).slice(2)}`;
  const offlineFetch = () => Promise.reject(new Error('offline'));
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: offlineFetch }),
  );
  const store = createStore(endpoint);
  const events = [];
  store.subscribeEvents((m) => events.push(m));
  const lastEvent = (kind) => events.filter((e) => e.kind === kind).at(-1);
  return { store, events, lastEvent, name, idb };
}

// The remote's current HEAD, read with the git CLI the harness already requires.
const remoteHead = (repoDir) =>
  execFileSync('git', ['-C', repoDir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

describe('MARK_INSTRUMENT_PROMPT_SEEN — the "answered" flag (songs.first_song)', () => {
  it('writes one instrumentPromptSeen register, re-surfaces PREFERENCES, and survives a reload (home-book §4.1)', async () => {
    const w = makeWorker();
    w.store.open();
    await until(() => expect(w.store.slice('connection').status).toBe('ready'));

    w.store.send(command(CommandKind.MARK_INSTRUMENT_PROMPT_SEEN, { author: AUTHOR }));
    await until(() => {
      const reg = w.store.slice('preferences').instrumentPromptSeen;
      expect(reg?.value).toBe(true);
      // A §3 register envelope: the boolean value and a well-formed instant.
      expect(typeof reg.at).toBe('string');
      expect(reg.at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
    // The PREFERENCES event carried the set register.
    expect(w.lastEvent(EventKind.PREFERENCES).payload.instrumentPromptSeen?.value).toBe(true);

    // It survives: a fresh Worker over the same backing store reads it back.
    const endpoint = createLoopbackEndpoint((port) =>
      createWorkerLogic(port, { indexedDB: w.idb, name: w.name, fetch: () => Promise.reject(new Error('offline')) }),
    );
    const store2 = createStore(endpoint);
    store2.open();
    await until(() => expect(store2.slice('preferences').instrumentPromptSeen?.value).toBe(true));
  });

  it('provisions a local home book when absent, then writes the flag (workflow 1 §The home book)', async () => {
    const w = makeWorker();
    w.store.open();
    await until(() => expect(w.store.slice('connection').status).toBe('ready'));

    // Brand-new profile: no home book committed yet.
    const fs = createFileSystem(`${w.name}-fs`, { indexedDB: w.idb });
    await expect(resolveRef({ fs, dir: HOME_DIR, ref: 'main' })).rejects.toBeTruthy();

    w.store.send(command(CommandKind.MARK_INSTRUMENT_PROMPT_SEEN, { author: AUTHOR }));
    await until(() => expect(w.store.slice('preferences').instrumentPromptSeen?.value).toBe(true));

    // The command created the local home book before writing: its history is the
    // scaffold commit, then the one register write.
    const head = await resolveRef({ fs, dir: HOME_DIR, ref: 'main' });
    expect(head).toBeTruthy();
    const log = await gitLog({ fs, dir: HOME_DIR, depth: 10 });
    expect(log).toHaveLength(2);
  });

  it('auto-commits the flag locally and never pushes, even with a remote configured (DIRECTION §3.2)', async () => {
    const remote = await startGitHttpRemote();
    const idb = new IDBFactory();
    const name = `ipr-${Math.random().toString(36).slice(2)}`;
    const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
    const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
    try {
      // Give the home book a remote, as sign-in would (a cloned home book, so
      // ensureLocal is a no-op and the only commit is the register write).
      await git.clone({ dir: git.bookDir(HOME_BOOK_ID), url: remote.url });

      const endpoint = createLoopbackEndpoint((port) =>
        createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
      );
      const store = createStore(endpoint);
      store.open();
      await until(() => expect(store.slice('connection').status).toBe('ready'));

      const localBefore = await resolveRef({ fs, dir: HOME_DIR, ref: 'main' });
      const remoteBefore = remoteHead(remote.repoDir);

      store.send(command(CommandKind.MARK_INSTRUMENT_PROMPT_SEEN, { author: AUTHOR }));
      await until(() => expect(store.slice('preferences').instrumentPromptSeen?.value).toBe(true));

      // One new local commit, its parent the pre-write HEAD...
      const localAfter = await resolveRef({ fs, dir: HOME_DIR, ref: 'main' });
      expect(localAfter).not.toBe(localBefore);
      const [head] = await gitLog({ fs, dir: HOME_DIR, depth: 2 });
      expect(head.commit.parent).toEqual([localBefore]);
      // ...and nothing pushed: the remote HEAD is exactly where it was.
      expect(remoteHead(remote.repoDir)).toBe(remoteBefore);
    } finally {
      await remote.stop();
    }
  });
});
