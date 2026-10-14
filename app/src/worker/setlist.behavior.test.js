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
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

// behavior — the setlist Worker seams (books.setlists) driven through the real
// command/event path: LIST_SETLISTS across the loaded books, and ADD_TO_SETLIST
// (same-book add, cross-book copy, new-setlist create) as one locked, uncommitted
// change that a following SAVE commits as one commit. Same in-process rig as
// file-ops.behavior.test.js — `createWorkerLogic` over the loopback double,
// injected `fake-indexeddb`, `installWebLocks()`, a shared lightning-fs, books
// scaffolded with the `git` CLI — with state cross-checked by isomorphic-git
// against the shared fs. All song/setlist text is written for this test.
//
// Pins workflow 12 §Building one (L57-61), §Songs from another book (L38-40),
// §The file (L34), and the one-lock/one-commit rule (Decision 3; the file_view
// move+relink precedent).

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

const IDENTITY = { id: 'u_setl', name: 'A Tester' };

// Purpose-written songs and setlists.
const VALSA = ['# Valsa da Esquina', '', 'Uma valsa na rua', ''].join('\n');
const CHUVA = ['# Chuva no Telhado', '', 'Cai a chuva', ''].join('\n');
const SETLIST = ['# Ensaio', '', '1. [Valsa](valsa.cifra.md)', ''].join('\n');

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
  clock = Date.UTC(2026, 0, 1, 0, 0, 0);
});
afterEach(() => {
  restoreLocks();
});

// One Worker over a shared fs, with any number of books each cloned from its own
// bare remote (so a cross-book copy has two real books on one device).
async function setup() {
  const idb = new IDBFactory();
  const name = `setl-${Math.random().toString(36).slice(2)}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
  );
  const store = createStore(endpoint);
  const remotes = [];
  const workdirs = [];

  async function seedBook(bookId, build) {
    const remote = await startGitHttpRemote();
    remotes.push(remote);
    const dir = git.bookDir(bookId);
    const workdir = mkdtempSync(nodePath.join(tmpdir(), 'setl-work-'));
    workdirs.push(workdir);
    execFileSync('git', ['clone', '-q', remote.repoDir, workdir], { env: seedEnv() });
    const g = (...args) => run('git', ['-C', workdir, ...args], seedEnv());
    const w = (file, text) => {
      const full = nodePath.join(workdir, file);
      mkdirSync(nodePath.dirname(full), { recursive: true });
      writeFileSync(full, text);
    };
    await build({ g, w });
    await g('push', '-q', 'origin', 'main');
    await git.clone({ dir, url: remote.url });
    return dir;
  }

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

  async function settled(bookId) {
    await new Promise((r) => setTimeout(r, 0));
    await navigator.locks.request(`book:${bookId}`, { mode: 'exclusive' }, () => {});
    await Promise.resolve();
  }

  async function show(dir, ref, path) {
    const oid = await resolveRef({ fs, dir, ref });
    const { blob } = await readBlob({ fs, dir, oid, filepath: path });
    return new TextDecoder().decode(blob);
  }

  async function exists(dir, ref, path) {
    try {
      await show(dir, ref, path);
      return true;
    } catch {
      return false;
    }
  }

  return {
    store,
    fs,
    git,
    seedBook,
    waitEvent,
    settled,
    show,
    exists,
    read: (dir, path) => fs.promises.readFile(`${dir}/${path}`, 'utf8'),
    commitCount: async (dir) => (await gitLog({ fs, dir })).length,
    async cleanup() {
      for (const workdir of workdirs) rmSync(workdir, { recursive: true, force: true });
      for (const remote of remotes) await remote.stop();
    },
  };
}

describe('the setlist Worker seams (behavior)', () => {
  it('LIST_SETLISTS returns every loaded book\'s setlists with title and count (workflow 12 §The file L34)', async () => {
    const ctx = await setup();
    try {
      await ctx.seedBook('band', async ({ g, w }) => {
        w('valsa.cifra.md', VALSA);
        w('gigs/ensaio.setlist.md', SETLIST);
        await g('add', '.');
        await g('commit', '-qm', 'Scaffold');
      });
      await ctx.seedBook('ana', async ({ g, w }) => {
        w('chuva.cifra.md', CHUVA);
        w('aula.setlist.md', ['# Aula de terça', '', '1. [Chuva](chuva.cifra.md)', ''].join('\n'));
        await g('add', '.');
        await g('commit', '-qm', 'Scaffold');
      });

      const done = ctx.waitEvent(EventKind.SETLISTS);
      ctx.store.send(command(CommandKind.LIST_SETLISTS, {}));
      await done;

      const setlists = ctx.store.slice('setlists') ?? [];
      const byTitle = Object.fromEntries(setlists.map((s) => [s.title, s]));
      expect(byTitle['Ensaio']).toMatchObject({ bookId: 'band', path: 'gigs/ensaio.setlist.md', count: 1 });
      expect(byTitle['Aula de terça']).toMatchObject({ bookId: 'ana', path: 'aula.setlist.md', count: 1 });
    } finally {
      await ctx.cleanup();
    }
  });

  it('ADD_TO_SETLIST into a setlist in the song\'s own book adds a canonical item, unsaved (workflow 12 §Building one)', async () => {
    const ctx = await setup();
    try {
      const dir = await ctx.seedBook('band', async ({ g, w }) => {
        w('valsa.cifra.md', VALSA);
        w('chuva.cifra.md', CHUVA);
        w('gigs/ensaio.setlist.md', SETLIST);
        await g('add', '.');
        await g('commit', '-qm', 'Scaffold');
      });
      const before = await ctx.commitCount(dir);

      ctx.store.send(command(CommandKind.ADD_TO_SETLIST, {
        targetBookId: 'band',
        setlistPath: 'gigs/ensaio.setlist.md',
        song: { bookId: 'band', path: 'chuva.cifra.md', title: 'Chuva no Telhado' },
      }));
      await ctx.waitEvent(EventKind.SETLIST_UPDATED);

      // The item is appended, folder-relative, in canonical form; still unsaved.
      const text = await ctx.read(dir, 'gigs/ensaio.setlist.md');
      expect(text).toContain('[Valsa](valsa.cifra.md)');
      expect(text).toContain('[Chuva no Telhado](../chuva.cifra.md)');
      expect(await ctx.commitCount(dir)).toBe(before); // HEAD unmoved — unsaved
      expect(await ctx.show(dir, 'main', 'gigs/ensaio.setlist.md')).not.toContain('Chuva');
    } finally {
      await ctx.cleanup();
    }
  });

  it('ADD_TO_SETLIST from another book copies the song and adds the item, both saved as one commit (workflow 12 §Songs from another book L38-40)', async () => {
    const ctx = await setup();
    try {
      const bandDir = await ctx.seedBook('band', async ({ g, w }) => {
        w('valsa.cifra.md', VALSA);
        w('gigs/ensaio.setlist.md', SETLIST);
        await g('add', '.');
        await g('commit', '-qm', 'Scaffold');
      });
      await ctx.seedBook('ana', async ({ g, w }) => {
        w('choro/chuva.cifra.md', CHUVA);
        await g('add', '.');
        await g('commit', '-qm', 'Scaffold');
      });
      const before = await ctx.commitCount(bandDir);

      // Add Ana's Chuva to the Band's setlist — copied into the Band's book first.
      ctx.store.send(command(CommandKind.ADD_TO_SETLIST, {
        targetBookId: 'band',
        setlistPath: 'gigs/ensaio.setlist.md',
        song: { bookId: 'ana', path: 'choro/chuva.cifra.md', title: 'Chuva no Telhado' },
      }));
      const updated = await ctx.waitEvent(EventKind.SETLIST_UPDATED);
      expect(updated.copied).toBe(true);

      // Uncommitted: the song copied into the Band's book, the setlist relinked;
      // HEAD unmoved.
      expect(await ctx.read(bandDir, 'choro/chuva.cifra.md')).toBe(CHUVA);
      expect(await ctx.read(bandDir, 'gigs/ensaio.setlist.md')).toContain(
        '[Chuva no Telhado](../choro/chuva.cifra.md)',
      );
      expect(await ctx.commitCount(bandDir)).toBe(before);

      // A following SAVE commits the copy and the setlist change as ONE commit.
      ctx.store.send(command(CommandKind.SAVE, {
        bookId: 'band',
        paths: ['choro/chuva.cifra.md', 'gigs/ensaio.setlist.md'],
        message: 'Add Chuva to Ensaio',
        author: IDENTITY,
      }));
      await until(() => expect(ctx.store.slice('save').band?.status).toBe('saved'));

      expect(await ctx.commitCount(bandDir)).toBe(before + 1);
      expect(await ctx.show(bandDir, 'main', 'choro/chuva.cifra.md')).toBe(CHUVA);
      expect(await ctx.show(bandDir, 'main', 'gigs/ensaio.setlist.md')).toContain(
        '[Chuva no Telhado](../choro/chuva.cifra.md)',
      );
    } finally {
      await ctx.cleanup();
    }
  });

  it('ADD_TO_SETLIST with a newTitle creates the *.setlist.md, unsaved (workflow 12 §Building one L58-59)', async () => {
    const ctx = await setup();
    try {
      const dir = await ctx.seedBook('band', async ({ g, w }) => {
        w('valsa.cifra.md', VALSA);
        await g('add', '.');
        await g('commit', '-qm', 'Scaffold');
      });

      ctx.store.send(command(CommandKind.ADD_TO_SETLIST, {
        targetBookId: 'band',
        setlistPath: 'sabado-a-noite.setlist.md',
        newTitle: 'Sábado à noite',
        song: { bookId: 'band', path: 'valsa.cifra.md', title: 'Valsa da Esquina' },
      }));
      await ctx.waitEvent(EventKind.SETLIST_UPDATED);

      const text = await ctx.read(dir, 'sabado-a-noite.setlist.md');
      expect(text).toContain('# Sábado à noite');
      expect(text).toContain('[Valsa da Esquina](valsa.cifra.md)');
      // Not yet committed.
      expect(await ctx.exists(dir, 'main', 'sabado-a-noite.setlist.md')).toBe(false);
    } finally {
      await ctx.cleanup();
    }
  });
});
