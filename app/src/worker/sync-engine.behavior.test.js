import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { add, commit, readCommit, resolveRef } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook } from './home-book.js';
import { createCifraMergeDriver } from './cifra-merge-driver.js';
import { createSyncEngine } from './sync-engine.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';

// behavior — the sync engine over a real local git remote and a fake IndexedDB
// (the .tji's behavior clause). Device B is a `createSyncEngine` over a
// `createFileSystem` fs + the git transport; other devices advance the shared
// `startGitHttpRemote()` bare repo with the host `git` CLI (async spawn, never
// sync — the harness server runs in this process). Pins workflow 8 L42-47,
// L59-62, L72-76 and DIRECTION §3.1. All songs and settings are written for this
// test — never anyone's words (no-song-text rule).

const BOOK = 'book1';
const SONG = 'song.cifra.md';

// A base song with two clearly separate sections, so an edit to one and an edit
// to the other merge cleanly by the cifra-aware rules (§11 chart merge).
const BASE_SONG = `# Sync Test Song

## Verse
First verse line
Second verse line

## Chorus
First chorus line
Second chorus line
`;
// One device edits the verse; another edits the chorus. Non-touching → clean.
const VERSE_EDIT = BASE_SONG.replace('First verse line', 'First verse line from the remote');
const CHORUS_EDIT = BASE_SONG.replace('Second chorus line', 'Second chorus line from the device');

const AUTHOR = { name: 'Device B', email: 'b@example.invalid', timestamp: 1577836800, timezoneOffset: 0 };
const SYNC_IDENTITY = { id: 'device-b', name: 'Device B' };

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
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

function cliEnv(home) {
  return {
    PATH: process.env.PATH,
    HOME: home,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_AUTHOR_NAME: 'Other Device',
    GIT_AUTHOR_EMAIL: 'other@example.invalid',
    GIT_COMMITTER_NAME: 'Other Device',
    GIT_COMMITTER_EMAIL: 'other@example.invalid',
    GIT_AUTHOR_DATE: '2020-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2020-01-01T00:00:00Z',
  };
}

const remoteHead = (repoDir) =>
  run('git', ['--git-dir', repoDir, 'rev-parse', 'refs/heads/main']).then((s) => s.trim());

// Advance the bare remote through a throwaway CLI clone: write `files`, commit,
// push to `main`. Used to simulate another device (and a racer).
let scratchDirs = [];
async function advanceRemote(remote, files, message) {
  const work = mkdtempSync(path.join(tmpdir(), 'estante-sync-adv-'));
  scratchDirs.push(work);
  const env = cliEnv(work);
  const checkout = path.join(work, 'repo');
  await run('git', ['clone', '-q', remote.repoDir, checkout], { env });
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(checkout, name), content);
  }
  await run('git', ['-C', checkout, 'add', '.'], { env });
  await run('git', ['-C', checkout, 'commit', '-q', '-m', message], { env });
  await run('git', ['-C', checkout, 'push', '-q', 'origin', 'main'], { env });
  return remoteHead(remote.repoDir);
}

// Device B: a fresh fake IndexedDB + fs + git transport + lock registry, with
// the book cloned from the shared remote.
async function makeDeviceB(remote, bookId = BOOK) {
  const idb = new IDBFactory();
  const name = `sync-b-${Math.random().toString(36).slice(2)}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  const dir = git.bookDir(bookId);
  await git.clone({ dir, url: remote.url });
  return {
    fs,
    git,
    locks,
    dir,
    read: (file) => fs.promises.readFile(`${dir}/${file}`, 'utf8'),
    head: () => resolveRef({ fs, dir, ref: 'main' }),
    // Commit a working-copy change locally (an already-saved edit).
    async commitLocal(file, content, message) {
      await fs.promises.writeFile(`${dir}/${file}`, content);
      await add({ fs, dir, filepath: file });
      return commit({ fs, dir, message, author: AUTHOR });
    },
  };
}

// Build an engine for device B, reaching the real per-book git ops; only the
// change-check is stubbed (behavior clause). `overrides` can wrap `pushBook` to
// force a race, and supply `surfaceHome`.
function engineFor(device, { changed = [], mergeDriver, overrides = {} } = {}) {
  const facts = [];
  const merges = [];
  const changeCheck = {
    check: async () =>
      new Map(changed.map((c) => [c.bookId, { bookId: c.bookId, status: 'changed', head: c.head }])),
  };
  const engine = createSyncEngine({
    fs: device.fs,
    git: device.git,
    locks: device.locks,
    changeCheck,
    mergeDriver: mergeDriver ?? createCifraMergeDriver(),
    homeBook: overrides.homeBook,
    resolveAuthor: async () => SYNC_IDENTITY,
    surfaceHome: overrides.surfaceHome,
    emit: (payload) => facts.push(payload),
    emitMerged: (payload) => merges.push(payload),
    now: () => Date.UTC(2026, 9, 7, 12, 0, 0),
    ...overrides.engine,
  });
  return { engine, facts, merges };
}

const lastPhase = (facts, bookId = BOOK) =>
  [...facts].reverse().find((f) => f.bookId === bookId)?.phase;

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
  scratchDirs = [];
});
afterEach(() => {
  restoreLocks();
  for (const d of scratchDirs) rmSync(d, { recursive: true, force: true });
});

describe('sync engine over a real remote (behavior)', () => {
  it('fetches, cifra-aware-merges cleanly, makes a hidden two-parent merge commit and pushes it', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed the base song');
      const b = await makeDeviceB(remote);

      // Another device edits the verse and pushes; device B edits the chorus and
      // commits it locally (an already-saved edit, ahead of its origin).
      const theirHead = await advanceRemote(remote, { [SONG]: VERSE_EDIT }, 'edit the verse');
      await b.commitLocal(SONG, CHORUS_EDIT, 'edit the chorus');

      const { engine, facts } = engineFor(b, { changed: [{ bookId: BOOK, head: theirHead }] });
      await engine.pass();

      // A two-parent merge commit sits at the local head (hidden from history —
      // workflow 6; two parents is the marker).
      const mergeOid = await b.head();
      const { commit: mergeCommit } = await readCommit({ fs: b.fs, dir: b.dir, oid: mergeOid });
      expect(mergeCommit.parent).toHaveLength(2);

      // The merged working copy holds BOTH the remote's verse edit and the
      // device's chorus edit, cifra-aware.
      const merged = await b.read(SONG);
      expect(merged).toContain('First verse line from the remote');
      expect(merged).toContain('Second chorus line from the device');

      // The merge commit was pushed; the remote advanced to it, and it is a
      // fast-forward of the remote's prior head (their edit is a parent).
      expect(await remoteHead(remote.repoDir)).toBe(mergeOid);
      expect(lastPhase(facts)).toBe('in_step');
    } finally {
      await remote.stop();
    }
  });

  it('retries a lost race and succeeds within three', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed the base song');
      const b = await makeDeviceB(remote);
      const theirHead = await advanceRemote(remote, { [SONG]: VERSE_EDIT }, 'edit the verse');
      await b.commitLocal(SONG, CHORUS_EDIT, 'edit the chorus');

      // Wrap push so the FIRST push loses a race: a third device slips a new,
      // non-conflicting file in just before B's push lands, making it non-ff.
      let raced = false;
      const realPush = (bookId) => b.git.push({ dir: b.git.bookDir(bookId) });
      const pushBook = vi.fn(async (bookId) => {
        if (!raced) {
          raced = true;
          await advanceRemote(remote, { 'late.cifra.md': '# Late\n\nA late line\n' }, 'race in');
        }
        return realPush(bookId);
      });

      const { engine, facts } = engineFor(b, {
        changed: [{ bookId: BOOK, head: theirHead }],
        overrides: { engine: { pushBook } },
      });
      await engine.pass();

      // Two pushes: the first lost the race, the retry (after refetch+remerge)
      // landed. The book is in step and carries the late file too.
      expect(pushBook).toHaveBeenCalledTimes(2);
      expect(await remoteHead(remote.repoDir)).toBe(await b.head());
      expect(await b.read('late.cifra.md')).toContain('A late line');
      expect(lastPhase(facts)).toBe('in_step');
    } finally {
      await remote.stop();
    }
  });

  it('gives up and leaves the book syncing when the race outlasts three retries', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed the base song');
      const b = await makeDeviceB(remote);
      const theirHead = await advanceRemote(remote, { [SONG]: VERSE_EDIT }, 'edit the verse');
      await b.commitLocal(SONG, CHORUS_EDIT, 'edit the chorus');

      // A racer wins before EVERY push attempt, so no push ever fast-forwards.
      let n = 0;
      const realPush = (bookId) => b.git.push({ dir: b.git.bookDir(bookId) });
      const pushBook = vi.fn(async (bookId) => {
        n += 1;
        await advanceRemote(remote, { [`race-${n}.cifra.md`]: `# Race ${n}\n\nline ${n}\n` }, `race ${n}`);
        return realPush(bookId);
      });

      const { engine, facts } = engineFor(b, {
        changed: [{ bookId: BOOK, head: theirHead }],
        overrides: { engine: { pushBook } },
      });
      await engine.pass();

      // Initial push + three retries = four attempts, all lost; the book is left
      // syncing for the next pass (workflow 8 L59-62).
      expect(pushBook).toHaveBeenCalledTimes(4);
      expect(lastPhase(facts)).toBe('syncing');
    } finally {
      await remote.stop();
    }
  });

  it('pushes committed work while deferring the incoming merge over an unsaved edit, leaving it intact', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed the base song');
      const b = await makeDeviceB(remote);

      // The device commits a new song (ahead of its origin), the remote stays put
      // on the base song, then the device starts an UNSAVED edit on the base song.
      await b.commitLocal('fresh.cifra.md', '# Fresh\n\nA fresh line\n', 'add a fresh song');
      const headBeforePass = await b.head();
      const UNSAVED = BASE_SONG.replace('First verse line', 'an unsaved work-in-progress line');
      await b.fs.promises.writeFile(`${b.dir}/${SONG}`, UNSAVED); // dirty working tree, no commit

      // The change check reports nothing moved; the engine still pushes the
      // committed fresh song (the offline-save retry).
      const { engine, facts } = engineFor(b, { changed: [] });
      await engine.pass();

      // The committed work went up; the remote now has the fresh song.
      expect(await remoteHead(remote.repoDir)).toBe(headBeforePass);
      expect(
        await run('git', ['--git-dir', remote.repoDir, 'cat-file', '-e', `main:fresh.cifra.md`]).then(
          () => true,
          () => false,
        ),
      ).toBe(true);
      // The unsaved edit was never clobbered — HEAD did not move to a merge and
      // the working file still holds the work in progress.
      expect(await b.head()).toBe(headBeforePass);
      expect(await b.read(SONG)).toContain('an unsaved work-in-progress line');
      expect(lastPhase(facts)).toBe('in_step');
    } finally {
      await remote.stop();
    }
  });

  it('defers the incoming merge over an unsaved edit when the book moved (edit intact, HEAD unmoved)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed the base song');
      const b = await makeDeviceB(remote);
      const headBefore = await b.head();

      // The remote moves (another device edits the verse), and the device has an
      // UNSAVED edit on the same song (no commit of its own).
      const theirHead = await advanceRemote(remote, { [SONG]: VERSE_EDIT }, 'edit the verse');
      const UNSAVED = BASE_SONG.replace('Second chorus line', 'an unsaved chorus in progress');
      await b.fs.promises.writeFile(`${b.dir}/${SONG}`, UNSAVED);

      const { engine, facts } = engineFor(b, { changed: [{ bookId: BOOK, head: theirHead }] });
      await engine.pass();

      // The origin was fetched, but the merge was deferred: HEAD did not move to
      // a merge commit and the unsaved edit is intact (the merge is sync.unsaved).
      expect(await resolveRef({ fs: b.fs, dir: b.dir, ref: 'refs/remotes/origin/main' })).toBe(theirHead);
      expect(await b.head()).toBe(headBefore);
      expect(await b.read(SONG)).toContain('an unsaved chorus in progress');
      expect(await b.read(SONG)).not.toContain('First verse line from the remote');
      expect(lastPhase(facts)).toBe('syncing'); // not in step — a merge still waits
    } finally {
      await remote.stop();
    }
  });

  it('routes the home book to its own key-by-key merge (never the cifra-aware one) and re-surfaces after', async () => {
    const remote = await startGitHttpRemote();
    try {
      // Device B holds the home book; another device sets a preference and syncs.
      const b = await makeDeviceB(remote, 'home');
      const homeBook = createHomeBook({ fs: b.fs, git: b.git, locks: b.locks });

      // Another device (its own fs) sets theme and pushes it up.
      const other = await makeDeviceB(remote, 'home');
      const otherHome = createHomeBook({ fs: other.fs, git: other.git, locks: other.locks });
      await otherHome.set({
        bookId: 'home',
        file: 'preferences.json',
        changes: [{ path: ['theme'], value: 'palco' }],
        author: SYNC_IDENTITY,
        now: Date.UTC(2026, 9, 7, 10, 0, 0),
      });
      await otherHome.sync({ bookId: 'home', author: SYNC_IDENTITY });

      // Device B sets a DIFFERENT key locally (ahead), then runs a pass.
      await homeBook.set({
        bookId: 'home',
        file: 'preferences.json',
        changes: [{ path: ['language'], value: 'pt-BR' }],
        author: SYNC_IDENTITY,
        now: Date.UTC(2026, 9, 7, 11, 0, 0),
      });

      const mergeDriver = vi.fn(createCifraMergeDriver()); // the cifra driver, spied
      const surfaceHome = vi.fn(async () => {});
      const { engine, facts } = engineFor(b, {
        changed: [],
        mergeDriver,
        overrides: { homeBook, surfaceHome },
      });
      await engine.pass();

      // The home book was routed to home-book.js `sync`: the merged preferences
      // hold BOTH keys (key by key), and the cifra-aware merge driver was never
      // reached (the home book never takes the songbook path).
      const prefs = await run('git', ['--git-dir', remote.repoDir, 'show', 'main:preferences.json']);
      expect(prefs).toContain('"theme"');
      expect(prefs).toContain('"language"');
      expect(mergeDriver).not.toHaveBeenCalled();
      // The home-book-derived slices re-surface after the sync (the SYNC_HOME path).
      expect(surfaceHome).toHaveBeenCalledTimes(1);
      expect(lastPhase(facts, 'home')).toBe('in_step');
    } finally {
      await remote.stop();
    }
  });

  it('announces a landed clean merge, naming the changed song and the INCOMING author (sync.read_in_place AC 1; workflow 8 L51; Decision 5)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed the base song');
      const b = await makeDeviceB(remote);
      const theirHead = await advanceRemote(remote, { [SONG]: VERSE_EDIT }, 'edit the verse');
      await b.commitLocal(SONG, CHORUS_EDIT, 'edit the chorus');

      const { engine, merges } = engineFor(b, { changed: [{ bookId: BOOK, head: theirHead }] });
      await engine.pass();

      expect(merges).toHaveLength(1);
      expect(merges[0].bookId).toBe(BOOK);
      const changed = merges[0].changed;
      expect(changed).toHaveLength(1);
      // "Who made the change" is the other device (its verse-edit commit), not the
      // device's own merge identity ("Device B"); the commit is the incoming oid
      // the history link targets (Decision 5).
      expect(changed[0]).toMatchObject({ path: SONG, author: 'Other Device', commit: theirHead });
      // The fact carries metadata only — never song text (standing rule).
      expect(Object.keys(changed[0]).sort()).toEqual(['author', 'commit', 'path']);
      expect(JSON.stringify(merges)).not.toMatch(/verse|chorus/i);
    } finally {
      await remote.stop();
    }
  });

  it('announces a fast-forward merge too (no local commits — the incoming version arrives straight) (AC 1; workflow 8 L42-45)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed the base song');
      const b = await makeDeviceB(remote);
      // B has no local commit; the remote edits the verse → a fast-forward.
      const theirHead = await advanceRemote(remote, { [SONG]: VERSE_EDIT }, 'edit the verse');

      const { engine, merges } = engineFor(b, { changed: [{ bookId: BOOK, head: theirHead }] });
      await engine.pass();

      // The working copy fast-forwarded to theirs, and the merge was announced.
      expect(await b.head()).toBe(theirHead);
      expect(merges).toHaveLength(1);
      expect(merges[0].changed).toEqual([{ path: SONG, author: 'Other Device', commit: theirHead }]);
    } finally {
      await remote.stop();
    }
  });

  it('emits no MERGED fact when a clean merge brings no song change (AC 1 negative)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed the base song');
      const b = await makeDeviceB(remote);
      // The remote changes only a non-song file; B has a local song commit → a
      // clean two-parent merge that moves no `*.cifra.md`.
      const theirHead = await advanceRemote(remote, { 'README.md': '# A book\n' }, 'add a readme');
      await b.commitLocal(SONG, CHORUS_EDIT, 'edit the chorus');

      const { engine, merges } = engineFor(b, { changed: [{ bookId: BOOK, head: theirHead }] });
      await engine.pass();

      // A real merge landed (two parents) but no song moved → no MERGED fact.
      const { commit } = await readCommit({ fs: b.fs, dir: b.dir, oid: await b.head() });
      expect(commit.parent).toHaveLength(2);
      expect(merges).toHaveLength(0);
    } finally {
      await remote.stop();
    }
  });

  it('emits no MERGED fact when the incoming merge is deferred over an unsaved edit (the boundary to sync.unsaved)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed the base song');
      const b = await makeDeviceB(remote);
      const theirHead = await advanceRemote(remote, { [SONG]: VERSE_EDIT }, 'edit the verse');
      const UNSAVED = BASE_SONG.replace('Second chorus line', 'an unsaved chorus in progress');
      await b.fs.promises.writeFile(`${b.dir}/${SONG}`, UNSAVED); // dirty tree, no commit

      const { engine, merges } = engineFor(b, { changed: [{ bookId: BOOK, head: theirHead }] });
      await engine.pass();

      // The merge was deferred by the dirty-tree guard — its signal is
      // sync.unsaved's, not a MERGED fact (acceptance 1; Decision 3).
      expect(merges).toHaveLength(0);
    } finally {
      await remote.stop();
    }
  });
});
