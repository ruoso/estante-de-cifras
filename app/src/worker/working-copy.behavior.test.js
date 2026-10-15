import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { spawn } from 'node:child_process';
import { resolveRef, readBlob } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { command, CommandKind, EventKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

// behavior — the working-copy flow (storage.working_copy acceptance) driven
// through the real command/event path. `createWorkerLogic` runs in-process over
// the loopback double, with an injected `fake-indexeddb`, `installWebLocks()`
// active, a `createFileSystem` fs and the git layer against `startGitHttpRemote()`
// (the v1 push-enabled harness). A second `createFileSystem` over the same
// IndexedDB and FS name is the test's window onto the working copy the Worker
// owns (lightning-fs over one backing store is coherent across instances), and
// it seeds the book by cloning the remote into it before any command is sent.
//
// Pins tasks/40-storage.tji:33 and workflows 3 (L19-23, L51-54, L97-101),
// 4 (L10-65) and 14 (L50-52, L84-113, L154-158). All song text is written for
// this test (no-song-text rule).

// Poll a SYNCHRONOUS assertion until it passes, yielding to the event loop
// between tries (vi.waitFor). It must read only already-folded store state, not
// the filesystem: a loop that re-reads the shared lightning-fs would contend on
// its cross-instance lock and starve the Worker's own write — so command
// completion is observed through the store slice (the events the command emits),
// and the working copy is read exactly once afterwards.
const until = (fn) => vi.waitFor(fn, { timeout: 8000, interval: 25 });

// Wait until a book's lock is free — i.e. the command holding it has finished.
// Used for `WRITE`, which emits no event (it is pure durability): the test
// queues its own request behind the Worker's on the same per-book lock. The
// `setTimeout(0)` lets the loopback deliver the command and the Worker enqueue
// its lock request first, so this one is granted strictly after it releases.
async function settled(bookId) {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await navigator.locks.request(`book:${bookId}`, { mode: 'exclusive' }, () => {});
  await Promise.resolve();
}

// Run a command to completion without blocking the event loop — the harness
// server runs in this process, so a synchronous child would deadlock a network
// op against it (mirrors git.behavior.test.js).
function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
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
const gitRemote = (repoDir, ...args) =>
  run('git', ['--git-dir', repoDir, ...args]).then((s) => s.trim());

// The author identity a SAVE command carries (id + display name). The Worker
// forms the no-reply address from the id (DIRECTION §3.2).
const IDENTITY = { id: 'u_8f3a21', name: 'A Tester' };
const AUTHOR_EMAIL = 'u_8f3a21@users.estantedecifras.app';

// A small original song whose voicings are typed out of code-point order; its
// canonical form reorders them (C, D, Em, G) with the chart untouched. The
// chart references all four chords, so none of the voicings is pruned.
const TYPED_SONG = [
  '# Rainy Window',
  '',
  '## Verse',
  '```',
  'G            C',
  'The rain taps on the glass',
  'Em           D',
  'and I stay in today',
  '```',
  '',
  '---',
  '',
  '## Voicings: E2 A2 D3 G3 B3 E4',
  '- G: 320003',
  '- Em: 022000',
  '- D: xx0232',
  '- C: x32010',
  '',
].join('\n');
const CANONICAL_SONG = [
  '# Rainy Window',
  '',
  '## Verse',
  '```',
  'G            C',
  'The rain taps on the glass',
  'Em           D',
  'and I stay in today',
  '```',
  '',
  '---',
  '',
  '## Voicings: E2 A2 D3 G3 B3 E4',
  '- C: x32010',
  '- D: xx0232',
  '- Em: 022000',
  '- G: 320003',
  '',
].join('\n');

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
});
afterEach(() => {
  restoreLocks();
});

// Bring up a remote, a fresh IndexedDB, the Worker-backed store, and a test-side
// fs/git window cloned onto the seeded book. A unique FS name per test keeps the
// backing stores isolated; the Worker's fs (`${name}-fs`) and the test's share
// the name so they see one working copy.
async function setup(bookId) {
  const remote = await startGitHttpRemote();
  const idb = new IDBFactory();
  const name = `wc-${Math.random().toString(36).slice(2)}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const dir = git.bookDir(bookId);
  await git.clone({ dir, url: remote.url });

  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
  );
  const store = createStore(endpoint);

  return {
    remote,
    store,
    fs,
    dir,
    bookId,
    idb,
    name,
    read: (path) => fs.promises.readFile(`${dir}/${path}`, 'utf8'),
    head: () => resolveRef({ fs, dir, ref: 'main' }),
    status: () => store.slice('save')[bookId]?.status,
    // The cold open a reloaded tab performs: a brand-new createFileSystem over
    // the SAME backing store (idb + `${name}-fs`), with a matching git layer and
    // the book's dir. It loads the superblock freshly from IndexedDB, so it only
    // finds data a `flush()` already forced out — never the Worker's still-live
    // in-memory inode table (Decision 5).
    reopen() {
      const freshFs = createFileSystem(`${name}-fs`, { indexedDB: idb });
      const freshGit = createGitLayer({
        fs: freshFs,
        http: createGitHttpClient({ fetch: globalThis.fetch }),
      });
      const freshDir = freshGit.bookDir(bookId);
      return {
        fs: freshFs,
        git: freshGit,
        dir: freshDir,
        read: (path) => freshFs.promises.readFile(`${freshDir}/${path}`, 'utf8'),
        async show(ref, path) {
          const oid = await resolveRef({ fs: freshFs, dir: freshDir, ref });
          const { blob } = await readBlob({ fs: freshFs, dir: freshDir, oid, filepath: path });
          return new TextDecoder().decode(blob);
        },
      };
    },
    async cleanup() {
      await remote.stop();
    },
  };
}

describe('the working copy, save and discard (behavior)', () => {
  it('WRITEs the typed bytes into the working copy with no new commit (workflow 3 L19-23, 4 L10-15)', async () => {
    const ctx = await setup('book-write');
    try {
      const before = await ctx.head();
      ctx.store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: 'rainy-window.cifra.md',
          text: TYPED_SONG,
        }),
      );
      await settled(ctx.bookId);
      // The working file holds exactly what was typed (no canonicalisation).
      expect(await ctx.read('rainy-window.cifra.md')).toBe(TYPED_SONG);
      // …and no commit was made: HEAD is still the seed.
      expect(await ctx.head()).toBe(before);
    } finally {
      await ctx.cleanup();
    }
  });

  it('SAVEs one file as a canonical commit authored by the no-reply address, and pushes (workflow 4 L24-56, 14 L50-52)', async () => {
    const ctx = await setup('book-save-one');
    try {
      const seed = await gitRemote(ctx.remote.repoDir, 'rev-parse', 'refs/heads/main');
      // Signed in as IDENTITY's account: the Worker authors the save as it
      // (account.commit_author Constraint 2). No service answers the attach here;
      // the account id is kept all the same.
      const attached = new Promise((resolve) => {
        const off = ctx.store.subscribeEvents((message) => {
          if (message.kind === EventKind.HOME_ATTACHED) {
            off();
            resolve();
          }
        });
      });
      ctx.store.send(command(CommandKind.ATTACH_HOME, { accountId: IDENTITY.id }));
      await attached;
      ctx.store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: 'rainy-window.cifra.md',
          text: TYPED_SONG,
        }),
      );
      ctx.store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: ['rainy-window.cifra.md'],
          message: 'Add Rainy Window',
          name: IDENTITY.name,
        }),
      );
      await until(() => expect(ctx.status()).toBe('saved'));

      const outcome = ctx.store.slice('save')[ctx.bookId];
      expect(outcome.pushed).toBe(true);

      // The remote's main advanced to the saved commit (push to the local remote).
      const remoteHead = await gitRemote(ctx.remote.repoDir, 'rev-parse', 'refs/heads/main');
      expect(remoteHead).not.toBe(seed);
      expect(remoteHead).toBe(outcome.commit);

      // The committed blob is the CANONICAL text (voicings reordered), read from
      // the pushed commit with the git CLI.
      const blob = await run('git', [
        '--git-dir',
        ctx.remote.repoDir,
        'show',
        'main:rainy-window.cifra.md',
      ]);
      expect(blob).toBe(CANONICAL_SONG);

      // Authored (and committed) by the per-user no-reply address.
      expect(await gitRemote(ctx.remote.repoDir, 'log', '-1', '--format=%ae', 'main')).toBe(
        AUTHOR_EMAIL,
      );
      expect(await gitRemote(ctx.remote.repoDir, 'log', '-1', '--format=%ce', 'main')).toBe(
        AUTHOR_EMAIL,
      );

      // The working file now agrees with the committed blob (both canonical).
      expect(await ctx.read('rainy-window.cifra.md')).toBe(CANONICAL_SONG);
    } finally {
      await ctx.cleanup();
    }
  });

  it('SAVEs several files in ONE commit (workflow 4 L59-65, 14 L154-158)', async () => {
    const ctx = await setup('book-save-many');
    try {
      const seed = await gitRemote(ctx.remote.repoDir, 'rev-parse', 'refs/heads/main');

      const songB = TYPED_SONG.replace('Rainy Window', 'Second Song');
      ctx.store.send(
        command(CommandKind.WRITE, { bookId: ctx.bookId, path: 'a.cifra.md', text: TYPED_SONG }),
      );
      ctx.store.send(
        command(CommandKind.WRITE, { bookId: ctx.bookId, path: 'b.cifra.md', text: songB }),
      );
      ctx.store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: ['a.cifra.md', 'b.cifra.md'],
          message: 'Add two songs',
          author: IDENTITY,
        }),
      );
      await until(() => expect(ctx.status()).toBe('saved'));

      const commit = ctx.store.slice('save')[ctx.bookId].commit;
      // Exactly one parent — one commit, not two — and that parent is the seed.
      expect(await gitRemote(ctx.remote.repoDir, 'log', '-1', '--format=%P', commit)).toBe(seed);
      // Both files changed in the single commit.
      const changed = (
        await gitRemote(
          ctx.remote.repoDir,
          'diff-tree',
          '--no-commit-id',
          '--name-only',
          '-r',
          commit,
        )
      )
        .split('\n')
        .sort();
      expect(changed).toEqual(['a.cifra.md', 'b.cifra.md']);
    } finally {
      await ctx.cleanup();
    }
  });

  it('DISCARDs edits back to HEAD and removes a never-saved new file (workflow 4 L73-77, 3 L51-54)', async () => {
    const ctx = await setup('book-discard');
    try {
      // First save a song so it is tracked at HEAD.
      ctx.store.send(
        command(CommandKind.WRITE, { bookId: ctx.bookId, path: 'song.cifra.md', text: TYPED_SONG }),
      );
      ctx.store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: ['song.cifra.md'],
          message: 'Add a song',
          author: IDENTITY,
        }),
      );
      await until(() => expect(ctx.status()).toBe('saved'));
      expect(await ctx.read('song.cifra.md')).toBe(CANONICAL_SONG);

      // Now edit the saved song and write a brand-new (never-saved) file.
      const edited = CANONICAL_SONG.replace('The rain taps on the glass', 'A different line');
      ctx.store.send(
        command(CommandKind.WRITE, { bookId: ctx.bookId, path: 'song.cifra.md', text: edited }),
      );
      ctx.store.send(
        command(CommandKind.WRITE, { bookId: ctx.bookId, path: 'new.cifra.md', text: TYPED_SONG }),
      );
      await settled(ctx.bookId);
      // Both edits landed: the saved song now diverges, and the new file exists.
      expect(await ctx.read('song.cifra.md')).toBe(edited);
      expect(await ctx.read('new.cifra.md')).toBe(TYPED_SONG);

      // Discard both: the edit reverts to the saved (canonical) text; the
      // never-saved file is deleted.
      ctx.store.send(
        command(CommandKind.DISCARD, {
          bookId: ctx.bookId,
          paths: ['song.cifra.md', 'new.cifra.md'],
        }),
      );
      await until(() => expect(ctx.status()).toBe('discarded'));

      expect(await ctx.read('song.cifra.md')).toBe(CANONICAL_SONG);
      let gone = false;
      try {
        await ctx.read('new.cifra.md');
      } catch {
        gone = true;
      }
      expect(gone).toBe(true);
    } finally {
      await ctx.cleanup();
    }
  });

  // storage.fs_flush behavior case 1: a save's flush makes the commit durable
  // against the 500ms superblock debounce. The in-test synchronous turn never
  // elapses the debounce, so a fresh filesystem instance (the cold open a
  // reloaded tab performs) only finds the saved bytes if `save` flushed the
  // inode table — remove the flush and this ENOENTs. Pins DIRECTION §3 L111-113,
  // workflow 4 §Saving, tasks/40-storage.tji:102.
  it('SAVE then an immediate cold reopen finds the committed and working-copy bytes (storage.fs_flush)', async () => {
    const ctx = await setup('book-save-flush');
    try {
      ctx.store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: 'rainy-window.cifra.md',
          text: TYPED_SONG,
        }),
      );
      ctx.store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: ['rainy-window.cifra.md'],
          message: 'Add Rainy Window',
          author: IDENTITY,
        }),
      );
      await until(() => expect(ctx.status()).toBe('saved'));

      // A brand-new filesystem instance over the same backing store — no ENOENT.
      const fresh = ctx.reopen();
      expect(await fresh.read('rainy-window.cifra.md')).toBe(CANONICAL_SONG);
      expect(await fresh.show('HEAD', 'rainy-window.cifra.md')).toBe(CANONICAL_SONG);
    } finally {
      await ctx.cleanup();
    }
  });

  // storage.fs_flush behavior case 2: a discard's flush makes the reverted
  // working-tree state durable. A fresh instance reads the reverted tracked file
  // back as its HEAD bytes and sees the discarded never-saved file stay gone,
  // while its still-tracked siblings are found. Pins workflow 4 §Discarding,
  // tasks/40-storage.tji:102.
  it('DISCARD then an immediate cold reopen reads reverted/removed state durably (storage.fs_flush)', async () => {
    const ctx = await setup('book-discard-flush');
    try {
      // Save a song so it is tracked at HEAD.
      ctx.store.send(
        command(CommandKind.WRITE, { bookId: ctx.bookId, path: 'song.cifra.md', text: TYPED_SONG }),
      );
      ctx.store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: ['song.cifra.md'],
          message: 'Add a song',
          author: IDENTITY,
        }),
      );
      await until(() => expect(ctx.status()).toBe('saved'));

      // Edit the saved song and add a brand-new (never-saved) file.
      const edited = CANONICAL_SONG.replace('The rain taps on the glass', 'A different line');
      ctx.store.send(
        command(CommandKind.WRITE, { bookId: ctx.bookId, path: 'song.cifra.md', text: edited }),
      );
      ctx.store.send(
        command(CommandKind.WRITE, { bookId: ctx.bookId, path: 'new.cifra.md', text: TYPED_SONG }),
      );
      await settled(ctx.bookId);

      // Discard both.
      ctx.store.send(
        command(CommandKind.DISCARD, {
          bookId: ctx.bookId,
          paths: ['song.cifra.md', 'new.cifra.md'],
        }),
      );
      await until(() => expect(ctx.status()).toBe('discarded'));

      // A brand-new filesystem instance over the same backing store: the reverted
      // file reads back as its HEAD bytes and the never-saved file stays gone.
      const fresh = ctx.reopen();
      expect(await fresh.read('song.cifra.md')).toBe(CANONICAL_SONG);
      let gone = false;
      try {
        await fresh.read('new.cifra.md');
      } catch {
        gone = true;
      }
      expect(gone).toBe(true);
    } finally {
      await ctx.cleanup();
    }
  });

  it('REFUSES a save of a marked text — no commit, no push (workflow 14 L84-113, spec §11.12.3)', async () => {
    const ctx = await setup('book-marked');
    try {
      const remoteBefore = await gitRemote(ctx.remote.repoDir, 'rev-parse', 'refs/heads/main');
      const localBefore = await ctx.head();

      const marked = [
        '# Rainy Window',
        '',
        '## Verse',
        '```',
        '<<<<<<< ours',
        'G            C',
        '=======',
        'G            Am',
        '>>>>>>> theirs',
        '```',
        '',
      ].join('\n');
      ctx.store.send(
        command(CommandKind.WRITE, { bookId: ctx.bookId, path: 'rainy-window.cifra.md', text: marked }),
      );
      ctx.store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: ['rainy-window.cifra.md'],
          message: 'Add Rainy Window',
          author: IDENTITY,
        }),
      );
      await until(() => expect(ctx.status()).toBe('refused'));

      const outcome = ctx.store.slice('save')[ctx.bookId];
      expect(outcome.path).toBe('rainy-window.cifra.md');
      expect(outcome.reason).toBe('marked');
      expect(outcome.marker).toBe('<<<<<<< ours');

      // Nothing moved: the remote ref is unchanged and no new local commit exists.
      expect(await gitRemote(ctx.remote.repoDir, 'rev-parse', 'refs/heads/main')).toBe(
        remoteBefore,
      );
      expect(await ctx.head()).toBe(localBefore);
    } finally {
      await ctx.cleanup();
    }
  });

  // books.save_readme_verbatim — a README is not a song (workflow 14 L73): it is
  // saved as written, not through the song writer, which would drop the `---`
  // and the heading under it and collapse the blank-line run.
  const README = '# Livro de Ensaio\n\nNotas do grupo.  \n\n\n---\n\n## Usage\n\nAbra uma cifra.\n';

  it('SAVEs a README.md as written — the rule and the headings under it committed unchanged (workflow 14 L73)', async () => {
    const ctx = await setup('book-readme');
    try {
      ctx.store.send(command(CommandKind.WRITE, { bookId: ctx.bookId, path: 'README.md', text: README }));
      ctx.store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: ['README.md'],
          message: 'Update README.md',
          author: IDENTITY,
        }),
      );
      await until(() => expect(ctx.status()).toBe('saved'));

      // The pushed commit holds the README byte for byte (read untrimmed).
      const blob = await run('git', ['--git-dir', ctx.remote.repoDir, 'show', 'main:README.md']);
      expect(blob).toBe(README);
      expect(await ctx.read('README.md')).toBe(README);
    } finally {
      await ctx.cleanup();
    }
  });

  it('REFUSES a README.md holding a marker line — no commit, no push (spec §11.12.3)', async () => {
    const ctx = await setup('book-readme-marked');
    try {
      const remoteBefore = await gitRemote(ctx.remote.repoDir, 'rev-parse', 'refs/heads/main');
      const localBefore = await ctx.head();

      const marked = '# Livro de Ensaio\n\n<<<<<<< ours\nAbra uma cifra.\n=======\nAbra um setlist.\n>>>>>>> theirs\n';
      ctx.store.send(command(CommandKind.WRITE, { bookId: ctx.bookId, path: 'README.md', text: marked }));
      ctx.store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: ['README.md'],
          message: 'Update README.md',
          author: IDENTITY,
        }),
      );
      await until(() => expect(ctx.status()).toBe('refused'));

      const outcome = ctx.store.slice('save')[ctx.bookId];
      expect(outcome.path).toBe('README.md');
      expect(outcome.reason).toBe('marked');
      expect(outcome.marker).toBe('<<<<<<< ours');

      expect(await gitRemote(ctx.remote.repoDir, 'rev-parse', 'refs/heads/main')).toBe(
        remoteBefore,
      );
      expect(await ctx.head()).toBe(localBefore);
    } finally {
      await ctx.cleanup();
    }
  });
});

// songs.save_empty_message — workflow 4 §Saving: a save is never left without a
// message, and a save that cannot be made answers the sheet's SAVE_REFUSED.
describe('a save with no message, a save that fails (behavior)', () => {
  it('SAVE with a blank note commits with Update <path> (workflow 4 §Saving)', async () => {
    const ctx = await setup('book-blank-note');
    try {
      // A file that is not a song: no musical summary, the sheet's note empty.
      ctx.store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: 'README.md',
          text: '# A book for testing\n\nWritten for this test.\n',
        }),
      );
      ctx.store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: ['README.md'],
          message: '',
          author: IDENTITY,
        }),
      );
      await until(() => expect(ctx.status()).toBe('saved'));
      const first = ctx.store.slice('save')[ctx.bookId].commit;
      expect(await gitRemote(ctx.remote.repoDir, 'log', '-1', '--format=%s', 'main')).toBe(
        'Update README.md',
      );

      // A whitespace-only note on a song is blank too.
      ctx.store.send(
        command(CommandKind.WRITE, {
          bookId: ctx.bookId,
          path: 'rainy-window.cifra.md',
          text: TYPED_SONG,
        }),
      );
      ctx.store.send(
        command(CommandKind.SAVE, {
          bookId: ctx.bookId,
          paths: ['rainy-window.cifra.md'],
          message: '   ',
          author: IDENTITY,
        }),
      );
      await until(() => expect(ctx.store.slice('save')[ctx.bookId].commit).not.toBe(first));
      expect(await gitRemote(ctx.remote.repoDir, 'log', '-1', '--format=%s', 'main')).toBe(
        'Update rainy-window.cifra.md',
      );
    } finally {
      await ctx.cleanup();
    }
  });

  it('a SAVE that throws answers SAVE_REFUSED failed, not ERROR (workflow 4 §Saving)', async () => {
    const ctx = await setup('book-save-throws');
    try {
      const localBefore = await ctx.head();
      // A book with no repository on this device: the save throws inside the
      // case (no test-only seam).
      ctx.store.send(
        command(CommandKind.SAVE, {
          bookId: 'book-not-on-this-device',
          paths: ['README.md'],
          message: 'Update README.md',
          author: IDENTITY,
        }),
      );
      await until(() =>
        expect(ctx.store.slice('save')['book-not-on-this-device']?.status).toBe('refused'),
      );
      const outcome = ctx.store.slice('save')['book-not-on-this-device'];
      expect(outcome.reason).toBe('failed');
      expect(outcome.path).toBe('README.md');
      // No generic ERROR reached the store.
      expect(ctx.store.slice('connection')?.status).not.toBe('error');
      // The seeded book's working copy is as it was.
      expect(await ctx.head()).toBe(localBefore);
    } finally {
      await ctx.cleanup();
    }
  });
});
