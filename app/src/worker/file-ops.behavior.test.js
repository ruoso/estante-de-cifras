import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { resolveRef, readBlob, log as gitLog } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { command, CommandKind, EventKind, EVENT } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { setlistTemplate, readmeTemplate } from '../files/new-file.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

// behavior — the file view's Worker seams (books.file_view) driven through the
// real command/event path: BOOK_TREE, MOVE_FILE (with the setlist relink),
// DELETE_FILE and COMMIT_DIFF, plus RESTORE_VERSION's offline guarantee. Same
// in-process rig as history.behavior.test.js: `createWorkerLogic` over the
// loopback double, injected `fake-indexeddb`, `installWebLocks()`, a shared
// lightning-fs and a book scaffolded with the `git` CLI. State is cross-checked
// with isomorphic-git against the shared fs. All song/setlist text is written
// for this test (no-song-text rule).
//
// Pins workflow 14 L24-29, L134-138, L144-147, L152-159, L161-173; workflow 12;
// and offline-first.

const until = (fn) => {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try {
        fn();
        resolve();
      } catch (err) {
        if (Date.now() - start > 8000) reject(err);
        else setTimeout(tick, 25);
      }
    };
    tick();
  });
};

function run(cmd, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env });
    const out = [];
    const err = [];
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => err.push(c));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(Buffer.concat(out).toString('utf8'));
      else reject(new Error(`${cmd} exited ${code}: ${Buffer.concat(err)}`));
    });
  });
}

const SEED_NAME = 'Score Keeper';
const SEED_EMAIL = 'keeper@example.invalid';
let clock;
function seedEnv() {
  clock += 60000;
  const when = new Date(clock).toISOString();
  return {
    PATH: process.env.PATH,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: SEED_NAME,
    GIT_AUTHOR_EMAIL: SEED_EMAIL,
    GIT_COMMITTER_NAME: SEED_NAME,
    GIT_COMMITTER_EMAIL: SEED_EMAIL,
    GIT_AUTHOR_DATE: when,
    GIT_COMMITTER_DATE: when,
  };
}

const IDENTITY = { id: 'u_file', name: 'A Tester' };

// Purpose-written songs and a setlist.
const VALSA = ['# Valsa da Esquina', '', 'Uma valsa na rua', ''].join('\n');
const OUTRA = ['# Outra', '', 'Outra canção', ''].join('\n');
const SETLIST = ['# Ensaio', '', '1. [Valsa](../valsa.cifra.md)', ''].join('\n');

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
  clock = Date.UTC(2026, 0, 1, 0, 0, 0);
});
afterEach(() => {
  restoreLocks();
});

async function setup(bookId) {
  const remote = await startGitHttpRemote();
  const idb = new IDBFactory();
  const name = `fops-${Math.random().toString(36).slice(2)}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const dir = git.bookDir(bookId);
  const workdir = mkdtempSync(nodePath.join(tmpdir(), 'fops-work-'));

  // A counting fetch for the Worker only (the test's own clone uses globalThis
  // directly), so a local read/op sequence can be asserted to make no network
  // call (offline-first).
  let networkCalls = 0;
  const countingFetch = (...args) => {
    networkCalls += 1;
    return globalThis.fetch(...args);
  };

  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: countingFetch }),
  );
  const store = createStore(endpoint);

  async function seed(build) {
    execFileSync('git', ['clone', '-q', remote.repoDir, workdir], { env: seedEnv() });
    const oids = {};
    const g = (...args) => run('git', ['-C', workdir, ...args], seedEnv());
    const w = (file, text) => {
      const full = nodePath.join(workdir, file);
      mkdirSync(nodePath.dirname(full), { recursive: true });
      writeFileSync(full, text);
    };
    const rev = async (ref = 'HEAD') => (await g('rev-parse', ref)).trim();
    await build({ g, w, rev, oids });
    await g('push', '-q', 'origin', 'main');
    await git.clone({ dir, url: remote.url });
    return oids;
  }

  // Resolve a transient event (FILE_MOVED / FILE_DELETED / COMMIT_DIFF / TREE /
  // RESTORED / ERROR) to its payload.
  function waitEvent(kind) {
    return new Promise((resolve) => {
      const unsub = store.subscribeEvents((message) => {
        if (message?.dir === EVENT && message.kind === kind) {
          unsub();
          resolve(message.payload);
        }
      });
    });
  }

  // Read the whole working tree via BOOK_TREE, as a path→status map.
  async function tree() {
    const done = waitEvent(EventKind.TREE);
    store.send(command(CommandKind.BOOK_TREE, { bookId }));
    await done;
    const entries = store.slice('tree')[bookId]?.entries ?? [];
    return Object.fromEntries(entries.map((e) => [e.path, e.status]));
  }

  // Wait for a book's lock to be free (WRITE emits no event).
  async function settled() {
    await new Promise((r) => setTimeout(r, 0));
    await navigator.locks.request(`book:${bookId}`, { mode: 'exclusive' }, () => {});
    await Promise.resolve();
  }

  async function show(ref, path) {
    const oid = await resolveRef({ fs, dir, ref });
    const { blob } = await readBlob({ fs, dir, oid, filepath: path });
    return new TextDecoder().decode(blob);
  }

  async function exists(ref, path) {
    try {
      await show(ref, path);
      return true;
    } catch {
      return false;
    }
  }

  return {
    remote,
    store,
    fs,
    dir,
    bookId,
    seed,
    waitEvent,
    tree,
    settled,
    show,
    exists,
    read: (path) => fs.promises.readFile(`${dir}/${path}`, 'utf8'),
    head: () => resolveRef({ fs, dir, ref: 'main' }),
    commitCount: async () => (await gitLog({ fs, dir })).length,
    network: () => networkCalls,
    resetNetwork: () => {
      networkCalls = 0;
    },
    async cleanup() {
      rmSync(workdir, { recursive: true, force: true });
      await remote.stop();
    },
  };
}

describe('the file view Worker seams (behavior)', () => {
  it('BOOK_TREE lists the allowed kinds with statuses as words, .git excluded (workflow 14 L24-29, L134-138)', async () => {
    const ctx = await setup('book-tree');
    try {
      await ctx.seed(async ({ g, w }) => {
        w('valsa.cifra.md', VALSA);
        w('outra.cifra.md', OUTRA);
        w('gigs/ensaio.setlist.md', SETLIST);
        w('README.md', '# Banda\n');
        w('.gitattributes', '*.cifra.md text\n');
        await g('add', '.');
        await g('commit', '-qm', 'Scaffold');
      });

      // A working-copy edit (unsaved), a never-committed file (new), a removal
      // (deleted).
      ctx.store.send(command(CommandKind.WRITE, {
        bookId: ctx.bookId,
        path: 'valsa.cifra.md',
        text: `${VALSA}Mais uma linha\n`,
      }));
      ctx.store.send(command(CommandKind.WRITE, {
        bookId: ctx.bookId,
        path: 'nova.cifra.md',
        text: '# Nova\n',
      }));
      await ctx.settled();
      ctx.store.send(command(CommandKind.DELETE_FILE, { bookId: ctx.bookId, path: 'outra.cifra.md' }));
      await ctx.waitEvent(EventKind.FILE_DELETED);

      const tree = await ctx.tree();
      expect(tree['valsa.cifra.md']).toBe('unsaved');
      expect(tree['nova.cifra.md']).toBe('new');
      expect(tree['outra.cifra.md']).toBe('deleted');
      expect(tree['gigs/ensaio.setlist.md']).toBe(null);
      expect(tree['README.md']).toBe(null);
      expect(tree['.gitattributes']).toBe(null);
      // Only the allowed kinds; nothing from `.git`.
      expect(Object.keys(tree).some((p) => p.startsWith('.git/'))).toBe(false);
    } finally {
      await ctx.cleanup();
    }
  });

  it('MOVE_FILE keeps the kind, relinks setlists, and a following SAVE makes one commit (workflow 14 L144-146, L152-159)', async () => {
    const ctx = await setup('book-move');
    try {
      await ctx.seed(async ({ g, w }) => {
        w('valsa.cifra.md', VALSA);
        w('gigs/ensaio.setlist.md', SETLIST);
        await g('add', '.');
        await g('commit', '-qm', 'Scaffold');
      });
      const before = await ctx.head();

      ctx.store.send(command(CommandKind.MOVE_FILE, {
        bookId: ctx.bookId,
        fromPath: 'valsa.cifra.md',
        toPath: 'mpb/valsa-da-esquina.cifra.md',
      }));
      await ctx.waitEvent(EventKind.FILE_MOVED);

      // Uncommitted working-copy state: bytes at the new path, old path gone,
      // the setlist rewritten to the new relative path; HEAD unmoved.
      expect(await ctx.read('mpb/valsa-da-esquina.cifra.md')).toBe(VALSA);
      await expect(ctx.read('valsa.cifra.md')).rejects.toBeTruthy();
      expect(await ctx.read('gigs/ensaio.setlist.md')).toContain('../mpb/valsa-da-esquina.cifra.md');
      expect(await ctx.head()).toBe(before);

      const countBefore = await ctx.commitCount();
      ctx.store.send(command(CommandKind.SAVE, {
        bookId: ctx.bookId,
        paths: ['mpb/valsa-da-esquina.cifra.md', 'valsa.cifra.md', 'gigs/ensaio.setlist.md'],
        message: 'Move Valsa to mpb/',
        author: IDENTITY,
      }));
      await until(() => expect(ctx.store.slice('save')[ctx.bookId]?.status).toBe('saved'));

      // One commit holding the new song, the removal and the rewritten setlist.
      expect(await ctx.commitCount()).toBe(countBefore + 1);
      expect(await ctx.show('main', 'mpb/valsa-da-esquina.cifra.md')).toBe(VALSA);
      expect(await ctx.exists('main', 'valsa.cifra.md')).toBe(false);
      expect(await ctx.show('main', 'gigs/ensaio.setlist.md')).toContain(
        '../mpb/valsa-da-esquina.cifra.md',
      );
    } finally {
      await ctx.cleanup();
    }
  });

  it('FILE_LINKS lists the setlist items linking to a song, skips a deleted setlist, writes nothing (workflow 14 L151-158; books.file_view_history_polish)', async () => {
    const ctx = await setup('book-links');
    try {
      await ctx.seed(async ({ g, w }) => {
        w('mpb/valsa.cifra.md', VALSA);
        w('mpb/outra.cifra.md', OUTRA);
        w(
          'gigs/ensaio.setlist.md',
          ['# Ensaio', '', '1. [Outra](../mpb/outra.cifra.md)', '2. Something not yet written', '3. [Valsa](../mpb/valsa.cifra.md)', ''].join('\n'),
        );
        w('old.setlist.md', ['# Old', '', '1. [Valsa](mpb/valsa.cifra.md)', ''].join('\n'));
        await g('add', '.');
        await g('commit', '-qm', 'Scaffold');
      });
      // A setlist deleted in the working copy but not yet saved: no longer linking.
      ctx.store.send(command(CommandKind.DELETE_FILE, { bookId: ctx.bookId, path: 'old.setlist.md' }));
      await ctx.waitEvent(EventKind.FILE_DELETED);
      const statusBefore = await ctx.tree();
      const before = await ctx.head();

      const reply = ctx.waitEvent(EventKind.FILE_LINKS);
      ctx.store.send(command(CommandKind.FILE_LINKS, { bookId: ctx.bookId, path: 'mpb/valsa.cifra.md' }));
      expect(await reply).toEqual({
        bookId: ctx.bookId,
        path: 'mpb/valsa.cifra.md',
        links: [{ setlist: 'gigs/ensaio.setlist.md', item: 3 }],
      });

      // Read-only: the working tree's status and HEAD are unchanged.
      expect(await ctx.tree()).toEqual(statusBefore);
      expect(statusBefore['old.setlist.md']).toBe('deleted');
      expect(await ctx.head()).toBe(before);
    } finally {
      await ctx.cleanup();
    }
  });

  it('MOVE_FILE across kinds is refused (workflow 14 L146)', async () => {
    const ctx = await setup('book-kind');
    try {
      await ctx.seed(async ({ g, w }) => {
        w('valsa.cifra.md', VALSA);
        await g('add', '.');
        await g('commit', '-qm', 'Scaffold');
      });
      const error = ctx.waitEvent(EventKind.ERROR);
      ctx.store.send(command(CommandKind.MOVE_FILE, {
        bookId: ctx.bookId,
        fromPath: 'valsa.cifra.md',
        toPath: 'valsa.setlist.md',
      }));
      expect(await error).toBeTruthy();
      // The file was not moved.
      expect(await ctx.read('valsa.cifra.md')).toBe(VALSA);
      await expect(ctx.read('valsa.setlist.md')).rejects.toBeTruthy();
    } finally {
      await ctx.cleanup();
    }
  });

  it('DELETE_FILE leaves a committed file deleted until save, and does not relink a referencing setlist (workflow 14 L147; workflow 12)', async () => {
    const ctx = await setup('book-del');
    try {
      await ctx.seed(async ({ g, w }) => {
        w('valsa.cifra.md', VALSA);
        w('gigs/ensaio.setlist.md', SETLIST);
        await g('add', '.');
        await g('commit', '-qm', 'Scaffold');
      });

      ctx.store.send(command(CommandKind.DELETE_FILE, { bookId: ctx.bookId, path: 'valsa.cifra.md' }));
      await ctx.waitEvent(EventKind.FILE_DELETED);

      expect((await ctx.tree())['valsa.cifra.md']).toBe('deleted');
      // The setlist still points at the (now missing) song — a missing item.
      expect(await ctx.read('gigs/ensaio.setlist.md')).toContain('../valsa.cifra.md');

      ctx.store.send(command(CommandKind.SAVE, {
        bookId: ctx.bookId,
        paths: ['valsa.cifra.md'],
        message: 'Delete Valsa',
        author: IDENTITY,
      }));
      await until(() => expect(ctx.store.slice('save')[ctx.bookId]?.status).toBe('saved'));
      expect(await ctx.exists('main', 'valsa.cifra.md')).toBe(false);

      // A never-saved file is unlinked outright.
      ctx.store.send(command(CommandKind.WRITE, {
        bookId: ctx.bookId,
        path: 'temp.cifra.md',
        text: '# Temp\n',
      }));
      await ctx.settled();
      ctx.store.send(command(CommandKind.DELETE_FILE, { bookId: ctx.bookId, path: 'temp.cifra.md' }));
      await ctx.waitEvent(EventKind.FILE_DELETED);
      expect((await ctx.tree())['temp.cifra.md']).toBeUndefined();
    } finally {
      await ctx.cleanup();
    }
  });

  it('COMMIT_DIFF returns per-file before/after for an add, a modify and a delete (workflow 14 L161-167)', async () => {
    const ctx = await setup('book-diff');
    try {
      const oids = await ctx.seed(async ({ g, w, rev, oids }) => {
        w('a.cifra.md', '# A\n\nfirst\n');
        await g('add', '.');
        await g('commit', '-qm', 'Add A');
        oids.c1 = await rev();
        w('a.cifra.md', '# A\n\nsecond\n');
        w('b.cifra.md', '# B\n\nbee\n');
        await g('add', '.');
        await g('commit', '-qm', 'Edit A, add B');
        oids.c2 = await rev();
        await g('rm', 'b.cifra.md');
        await g('commit', '-qm', 'Remove B');
        oids.c3 = await rev();
      });

      const diff2 = ctx.waitEvent(EventKind.COMMIT_DIFF);
      ctx.store.send(command(CommandKind.COMMIT_DIFF, { bookId: ctx.bookId, commit: oids.c2 }));
      const files2 = (await diff2).files;
      const byPath2 = Object.fromEntries(files2.map((f) => [f.path, f]));
      expect(byPath2['a.cifra.md']).toMatchObject({ status: 'modified', before: '# A\n\nfirst\n', after: '# A\n\nsecond\n' });
      expect(byPath2['b.cifra.md']).toMatchObject({ status: 'added', before: '', after: '# B\n\nbee\n' });

      const diff3 = ctx.waitEvent(EventKind.COMMIT_DIFF);
      ctx.store.send(command(CommandKind.COMMIT_DIFF, { bookId: ctx.bookId, commit: oids.c3 }));
      const files3 = (await diff3).files;
      expect(files3).toEqual([{ path: 'b.cifra.md', status: 'deleted', before: '# B\n\nbee\n', after: '' }]);

      const diff1 = ctx.waitEvent(EventKind.COMMIT_DIFF);
      ctx.store.send(command(CommandKind.COMMIT_DIFF, { bookId: ctx.bookId, commit: oids.c1 }));
      const files1 = (await diff1).files;
      expect(files1).toEqual([{ path: 'a.cifra.md', status: 'added', before: '', after: '# A\n\nfirst\n' }]);
    } finally {
      await ctx.cleanup();
    }
  });

  it('RESTORE_VERSION writes a past version uncommitted and makes no network call (workflow 14 L169-173; offline-first)', async () => {
    const ctx = await setup('book-restore');
    try {
      const oids = await ctx.seed(async ({ g, w, rev, oids }) => {
        w('a.cifra.md', '# A\n\nfirst\n');
        await g('add', '.');
        await g('commit', '-qm', 'Add A');
        oids.c1 = await rev();
        w('a.cifra.md', '# A\n\nsecond\n');
        await g('add', '.');
        await g('commit', '-qm', 'Edit A');
        oids.c2 = await rev();
      });
      const before = await ctx.head();
      ctx.resetNetwork();

      ctx.store.send(command(CommandKind.RESTORE_VERSION, {
        bookId: ctx.bookId,
        path: 'a.cifra.md',
        commit: oids.c1,
        fromPath: 'a.cifra.md',
      }));
      await ctx.waitEvent(EventKind.RESTORED);

      expect(await ctx.read('a.cifra.md')).toBe('# A\n\nfirst\n');
      expect(await ctx.head()).toBe(before); // uncommitted
      // The whole local sequence (restore + a tree read) touched no network.
      await ctx.tree();
      expect(ctx.network()).toBe(0);
    } finally {
      await ctx.cleanup();
    }
  });
  // books.file_view_create_menu — the *New* menu's CREATE_FILE: a setlist named
  // as it is made and holding only its title, the README holding the book's
  // title, each a working-copy change saved like any other (workflow 14
  // L147-171, L170-171; Constraint 5: named under the lock, nothing overwritten).
  // Every event the Worker posts, in order, until `until` has arrived.
  function eventsUntil(store, last) {
    const seen = [];
    return new Promise((resolve) => {
      const unsub = store.subscribeEvents((message) => {
        if (message?.dir !== EVENT) return;
        seen.push({ kind: message.kind, payload: message.payload });
        if (message.kind === last) {
          unsub();
          resolve(seen);
        }
      });
    });
  }

  it('CREATE_FILE writes a setlist holding only its title, uncommitted, -2 when taken, listed at once, saved unchanged (workflow 14 L147-171)', async () => {
    const ctx = await setup('book-create-setlist');
    try {
      await ctx.seed(async ({ g, w }) => {
        w('valsa.cifra.md', VALSA);
        w('README.md', '# Banda\n');
        await g('add', '.');
        await g('commit', '-qm', 'Scaffold');
      });
      const before = await ctx.head();

      const events = eventsUntil(ctx.store, EventKind.TREE);
      ctx.store.send(command(CommandKind.CREATE_FILE, {
        bookId: ctx.bookId,
        kind: 'setlist',
        folder: 'ensaios',
        title: 'Rehearsal set',
      }));
      const seen = (await events).filter((e) => e.kind === EventKind.FILE_CREATED || e.kind === EventKind.TREE);
      // FILE_CREATED first, then the refreshed TREE listing the path as new.
      expect(seen.map((e) => e.kind)).toEqual([EventKind.FILE_CREATED, EventKind.TREE]);
      expect(seen[0].payload).toEqual({ bookId: ctx.bookId, path: 'ensaios/rehearsal-set.setlist.md' });
      expect(seen[1].payload.entries).toContainEqual({ path: 'ensaios/rehearsal-set.setlist.md', status: 'new' });
      expect(await ctx.read('ensaios/rehearsal-set.setlist.md')).toBe(setlistTemplate('Rehearsal set'));
      // No commit.
      expect(await ctx.head()).toBe(before);

      // The same title again takes -2; the first is not overwritten.
      const again = ctx.waitEvent(EventKind.FILE_CREATED);
      ctx.store.send(command(CommandKind.CREATE_FILE, {
        bookId: ctx.bookId,
        kind: 'setlist',
        folder: 'ensaios',
        title: 'Rehearsal set',
      }));
      expect((await again).path).toBe('ensaios/rehearsal-set-2.setlist.md');

      // LIST_SETLISTS lists it at once (the Setlists tab), before any save.
      const listed = ctx.waitEvent(EventKind.SETLISTS);
      ctx.store.send(command(CommandKind.LIST_SETLISTS, {}));
      const { setlists } = await listed;
      expect(setlists).toContainEqual(
        expect.objectContaining({ bookId: ctx.bookId, path: 'ensaios/rehearsal-set.setlist.md', title: 'Rehearsal set', count: 0 }),
      );

      // A following SAVE commits it unchanged: it is already canonical.
      ctx.store.send(command(CommandKind.SAVE, {
        bookId: ctx.bookId,
        paths: ['ensaios/rehearsal-set.setlist.md'],
        message: 'Add Rehearsal set',
        author: IDENTITY,
      }));
      await until(() => expect(ctx.store.slice('save')[ctx.bookId]?.status).toBe('saved'));
      expect(await ctx.show('main', 'ensaios/rehearsal-set.setlist.md')).toBe(setlistTemplate('Rehearsal set'));
    } finally {
      await ctx.cleanup();
    }
  });

  it('CREATE_FILE writes the README with the book title, and refuses when one exists, overwriting nothing (workflow 14 L147-171; Constraint 5)', async () => {
    const ctx = await setup('book-create-readme');
    try {
      await ctx.seed(async ({ g, w }) => {
        w('valsa.cifra.md', VALSA);
        await g('add', '.');
        await g('commit', '-qm', 'Scaffold');
      });
      const before = await ctx.head();

      const created = ctx.waitEvent(EventKind.FILE_CREATED);
      ctx.store.send(command(CommandKind.CREATE_FILE, { bookId: ctx.bookId, kind: 'readme', title: 'Banda do Bairro' }));
      expect((await created).path).toBe('README.md');
      expect(await ctx.read('README.md')).toBe(readmeTemplate('Banda do Bairro'));
      expect(await ctx.read('README.md')).toBe('# Banda do Bairro\n');
      expect(await ctx.head()).toBe(before);
      expect((await ctx.tree())['README.md']).toBe('new');

      // Now one is there: refused, the file unchanged.
      const refused = ctx.waitEvent(EventKind.CREATE_REFUSED);
      ctx.store.send(command(CommandKind.CREATE_FILE, { bookId: ctx.bookId, kind: 'readme', title: 'Another' }));
      expect(await refused).toEqual({ bookId: ctx.bookId, kind: 'readme', reason: 'exists' });
      expect(await ctx.read('README.md')).toBe('# Banda do Bairro\n');
    } finally {
      await ctx.cleanup();
    }
  });
});
