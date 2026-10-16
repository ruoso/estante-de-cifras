import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { add, commit, readBlob, readCommit, resolveRef } from 'isomorphic-git';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook } from './home-book.js';
import { createCifraMergeDriver } from './cifra-merge-driver.js';
import { createSyncEngine } from './sync-engine.js';
import { createSyncScheduler } from './sync-scheduler.js';
import { parse, diff } from 'cifra-md';
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
// A second song the device commits a change to, so its local head diverges from
// the origin and the committed merge is a genuine two-parent merge commit (not a
// fast-forward) that must be pushed — the merge-under-unsaved cases assert that.
const SONG2 = 'other.cifra.md';
// A third song the device edits but no one else touches — the dirty file with no
// incoming change, which must be preserved byte-for-byte (sync.unsaved AC 3).
const UNTOUCHED = 'untouched.cifra.md';

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
// Both sides edit the SAME line differently → a cifra-aware conflict (§11 chart
// merge): `cifraMerge` returns `kind:'conflicts'` with a `<<<<<<< ours` /
// `>>>>>>> theirs` marked text, ours the device's working edit.
const VERSE_EDIT_REMOTE = BASE_SONG.replace('First verse line', 'First verse line from the remote');
const VERSE_EDIT_DEVICE = BASE_SONG.replace('First verse line', 'First verse line from the device');
// A deliberately NON-canonical working edit (trailing spaces, extra blank lines)
// to a song no one else touches: the engine must restore it byte-for-byte, never
// re-canonicalise it (AC 3). If it wrongly ran the re-apply merge over an
// unchanged file, cifra.md would canonicalise these bytes away.
const UNTOUCHED_UNSAVED =
  BASE_SONG.replace('Second chorus line', 'Second chorus line in progress   ') + '\n\n';

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
async function makeDeviceB(remote, bookId = BOOK, { fetch: fetchImpl = globalThis.fetch } = {}) {
  const idb = new IDBFactory();
  const name = `sync-b-${Math.random().toString(36).slice(2)}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: fetchImpl }) });
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
    // The committed bytes of a file at the current HEAD — what `reconcile`
    // compares the working copy against to derive `unsaved` (search-index.js:400).
    async headBlob(file) {
      const oid = await resolveRef({ fs, dir, ref: 'main' });
      const { blob } = await readBlob({ fs, dir, oid, filepath: file });
      return new TextDecoder().decode(blob);
    },
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

  it('pushes committed work with an unsaved edit present and nothing incoming, leaving the edit intact', async () => {
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

  // sync.unsaved — merging under unsaved changes (supersedes the dirty-tree
  // guard sync.engine shipped). DIRECTION §3.1 L129-131; workflow 8 L40-47,
  // L55-56; workflow 4 L17-21, L54-56.
  it('merges base, theirs and the working text: pushes the committed merge and folds the unsaved edit under it (AC 2; DIRECTION §3.1; workflow 8 L40-47)', async () => {
    const remote = await startGitHttpRemote();
    try {
      // Seed the song the remote will edit, plus a second song the device
      // commits a change to so the committed merge is a genuine two-parent merge.
      await advanceRemote(remote, { [SONG]: BASE_SONG, [SONG2]: BASE_SONG }, 'seed the songs');
      const b = await makeDeviceB(remote);

      // Device: a committed change to the OTHER song (so local diverges from the
      // origin), and an UNSAVED edit to the chorus of the song the remote moves.
      await b.commitLocal(SONG2, CHORUS_EDIT, 'edit the other song');
      await b.fs.promises.writeFile(`${b.dir}/${SONG}`, CHORUS_EDIT); // dirty, no commit
      // Another device saves a change to a DIFFERENT part of the same song.
      const theirHead = await advanceRemote(remote, { [SONG]: VERSE_EDIT }, 'edit the verse');

      const { engine, facts } = engineFor(b, { changed: [{ bookId: BOOK, head: theirHead }] });
      await engine.pass();

      // HEAD advanced to a two-parent merge commit, and the remote received it.
      const mergeOid = await b.head();
      const { commit: mergeCommit } = await readCommit({ fs: b.fs, dir: b.dir, oid: mergeOid });
      expect(mergeCommit.parent).toHaveLength(2);
      expect(await remoteHead(remote.repoDir)).toBe(mergeOid);

      // The working file holds the incoming verse change WITH the device's chorus
      // edit applied on top — the base/theirs/working-text merge.
      const working = await b.read(SONG);
      expect(working).toContain('First verse line from the remote');
      expect(working).toContain('Second chorus line from the device');

      // The edit stays unsaved: the working text differs from the committed HEAD
      // blob, which is exactly what `reconcile` reads as `unsaved` (search-index
      // :400) — the incoming verse edit alone, without the uncommitted chorus.
      const committed = await b.headBlob(SONG);
      expect(committed).toContain('First verse line from the remote');
      expect(committed).not.toContain('Second chorus line from the device');
      expect(working).not.toBe(committed);

      // The committed merge pushed only the committed side — the unsaved chorus
      // edit never reached the remote.
      const remoteSong = await run('git', ['--git-dir', remote.repoDir, 'show', `main:${SONG}`]);
      expect(remoteSong).not.toContain('Second chorus line from the device');
      expect(lastPhase(facts)).toBe('in_step');
    } finally {
      await remote.stop();
    }
  });

  it('keeps the edits unsaved on top, and leaves a dirty file with no incoming change byte-for-byte (AC 2, AC 3; workflow 4 L17-21)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(
        remote,
        { [SONG]: BASE_SONG, [UNTOUCHED]: BASE_SONG },
        'seed the songs',
      );
      const b = await makeDeviceB(remote);

      // Two unsaved edits: one to the song the remote moves, one to a song no one
      // else touches (the latter deliberately non-canonical).
      await b.fs.promises.writeFile(`${b.dir}/${SONG}`, CHORUS_EDIT);
      await b.fs.promises.writeFile(`${b.dir}/${UNTOUCHED}`, UNTOUCHED_UNSAVED);
      const theirHead = await advanceRemote(remote, { [SONG]: VERSE_EDIT }, 'edit the verse');

      const { engine } = engineFor(b, { changed: [{ bookId: BOOK, head: theirHead }] });
      await engine.pass();

      // The merged song survives on top of the incoming change and reads unsaved.
      const working = await b.read(SONG);
      expect(working).toContain('First verse line from the remote');
      expect(working).toContain('Second chorus line from the device');
      expect(working).not.toBe(await b.headBlob(SONG));

      // The file with no incoming change is preserved byte-for-byte — the
      // re-apply's one-side path returns the working text verbatim, never
      // re-canonicalising it (AC 3).
      expect(await b.read(UNTOUCHED)).toBe(UNTOUCHED_UNSAVED);
    } finally {
      await remote.stop();
    }
  });

  it('writes a marked working file when the unsaved edit conflicts with the incoming change, pushing only the clean committed merge (AC 4; workflow 4 L54-56; workflow 8 L47)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG, [SONG2]: BASE_SONG }, 'seed the songs');
      const b = await makeDeviceB(remote);

      // A committed change to the OTHER song (a real merge commit to push), and an
      // UNSAVED edit to the SAME verse line the remote edits — so `cifraMerge`
      // conflicts on the re-apply.
      await b.commitLocal(SONG2, CHORUS_EDIT, 'edit the other song');
      await b.fs.promises.writeFile(`${b.dir}/${SONG}`, VERSE_EDIT_DEVICE); // dirty, no commit
      const theirHead = await advanceRemote(remote, { [SONG]: VERSE_EDIT_REMOTE }, 'edit the verse');

      const { engine, facts } = engineFor(b, { changed: [{ bookId: BOOK, head: theirHead }] });
      await engine.pass();

      // The working file is the conflict-marked text: ours is the device's edit,
      // theirs the incoming one (sync.unsaved labels the user's text as ours).
      const working = await b.read(SONG);
      expect(working).toContain('<<<<<<< ours');
      expect(working).toContain('First verse line from the device');
      expect(working).toContain('=======');
      expect(working).toContain('First verse line from the remote');
      expect(working).toContain('>>>>>>> theirs');

      // The committed merge still pushed cleanly, and nothing marked reached the
      // remote — the markers live only in the uncommitted working tree.
      const mergeOid = await b.head();
      expect(await remoteHead(remote.repoDir)).toBe(mergeOid);
      const remoteSong = await run('git', ['--git-dir', remote.repoDir, 'show', `main:${SONG}`]);
      expect(remoteSong).not.toContain('<<<<<<<');
      expect(remoteSong).toContain('First verse line from the remote');
      expect(lastPhase(facts)).toBe('in_step');
    } finally {
      await remote.stop();
    }
  });

  it('emits the read-in-place fact naming the incoming author for a song re-merged under an unsaved edit (AC 5; workflow 8 L55-56)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed the base song');
      const b = await makeDeviceB(remote);

      // An unsaved chorus edit; the remote edits the verse of the same song.
      await b.fs.promises.writeFile(`${b.dir}/${SONG}`, CHORUS_EDIT);
      const theirHead = await advanceRemote(remote, { [SONG]: VERSE_EDIT }, 'edit the verse');

      const { engine, merges } = engineFor(b, { changed: [{ bookId: BOOK, head: theirHead }] });
      await engine.pass();

      // The same { bookId, path, author } fact sync.read_in_place emits — the
      // editor view (deferred) shows the merged working text and says what came in.
      expect(merges).toHaveLength(1);
      expect(merges[0].bookId).toBe(BOOK);
      expect(merges[0].changed).toEqual([{ path: SONG, author: 'Other Device', commit: theirHead, summary: '' }]);
      // Metadata only — never song text (standing rule).
      expect(JSON.stringify(merges)).not.toMatch(/verse|chorus/i);
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
      // The fact carries metadata and the musical summary only — never song text
      // (standing rule; the summary field is sync.in_place_notices'). A lyrics-only
      // change has no musical summary.
      expect(Object.keys(changed[0]).sort()).toEqual(['author', 'commit', 'path', 'summary']);
      expect(changed[0].summary).toBe('');
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
      expect(merges[0].changed).toEqual([{ path: SONG, author: 'Other Device', commit: theirHead, summary: '' }]);
    } finally {
      await remote.stop();
    }
  });

  it('MERGED carries each changed song\'s musical summary of what came in (sync.in_place_notices; W08#3 L103-105)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed the base song');
      const b = await makeDeviceB(remote);
      const before = await b.head();
      // The other device adds a section to the song and adds a new song.
      const WITH_BRIDGE = `${BASE_SONG}\n## Bridge\n\`\`\`\nAm | F | C | G\n\`\`\`\n`;
      const NEW_SONG = 'new.cifra.md';
      const theirHead = await advanceRemote(
        remote,
        { [SONG]: WITH_BRIDGE, [NEW_SONG]: BASE_SONG.replace('Sync Test Song', 'Harbour Lights') },
        'add a bridge and a song',
      );

      const { engine, merges } = engineFor(b, { changed: [{ bookId: BOOK, head: theirHead }] });
      await engine.pass();

      expect(merges).toHaveLength(1);
      const byPath = Object.fromEntries(merges[0].changed.map((c) => [c.path, c]));
      // The summary is diff(parse(before), parse(after)).summary for the path.
      const expected = diff(parse(BASE_SONG), parse(WITH_BRIDGE)).summary;
      expect(expected).not.toBe('');
      expect(byPath[SONG].summary).toBe(expected);
      expect(byPath[SONG].summary).toMatch(/Bridge/);
      // A song added remotely diffs against an empty parse.
      const added = diff(parse(''), parse(await b.headBlob(NEW_SONG))).summary;
      expect(added).not.toBe('');
      expect(byPath[NEW_SONG].summary).toBe(added);
      expect(before).not.toBe(theirHead);
    } finally {
      await remote.stop();
    }
  });

  it('asks for a re-index whenever a merge moves the head, song change or not (search finds what sync brought in)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed the base song');
      const b = await makeDeviceB(remote);
      const theirHead = await advanceRemote(remote, { 'README.md': '# A book\n' }, 'add a readme');
      const moved = [];
      const { engine, merges } = engineFor(b, {
        changed: [{ bookId: BOOK, head: theirHead }],
        overrides: { engine: { onHeadMoved: async (bookId) => moved.push(bookId) } },
      });
      await engine.pass();
      expect(moved).toEqual([BOOK]);
      expect(merges).toHaveLength(0);

      // A pass that brings nothing new does not ask again.
      await engine.pass();
      expect(moved).toEqual([BOOK]);
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

  it('pushes saves left waiting by an offline cold open once the network is back, with no online event (sync.states; workflow 8 L31)', async () => {
    // An offline cold open: the open pass cannot reach the service and leaves
    // the book with saves waiting. The DOM `online` event may never fire after a
    // page is loaded with no network (Chromium can report navigator.onLine true
    // on such a page, so there is no offline→online edge) — so nothing but the
    // five-minute heartbeat used to ask again. The scheduler now retries an
    // unreachable pass with saves waiting on a short backoff.
    const remote = await startGitHttpRemote();
    try {
      await advanceRemote(remote, { [SONG]: BASE_SONG }, 'seed the base song');
      const net = { offline: false };
      const netFetch = (...args) =>
        net.offline ? Promise.reject(new TypeError('Failed to fetch')) : globalThis.fetch(...args);
      const b = await makeDeviceB(remote, BOOK, { fetch: netFetch });
      net.offline = true;
      await b.commitLocal(SONG, CHORUS_EDIT, 'first offline save');
      await b.commitLocal(SONG, CHORUS_EDIT.replace('First chorus', 'First chorus, again'), 'second offline save');

      const facts = [];
      const engine = createSyncEngine({
        fs: b.fs,
        git: b.git,
        locks: b.locks,
        changeCheck: {
          check: async () => {
            if (net.offline) throw new TypeError('Failed to fetch');
            return new Map();
          },
        },
        mergeDriver: createCifraMergeDriver(),
        resolveAuthor: async () => SYNC_IDENTITY,
        emit: (payload) => facts.push(payload),
        now: () => Date.UTC(2026, 9, 7, 12, 0, 0),
      });
      // A hand-driven clock: the heartbeat and the retry are recorded, never
      // fired by wall time.
      const timeouts = [];
      const passes = [];
      const scheduler = createSyncScheduler({
        run: () => {
          const p = engine.pass();
          passes.push(p);
          return p;
        },
        setInterval: () => 1,
        clearInterval: () => {},
        setTimeout: (fn, ms) => {
          timeouts.push({ fn, ms, cleared: false });
          return timeouts.length;
        },
        clearTimeout: (id) => {
          if (timeouts[id - 1]) timeouts[id - 1].cleared = true;
        },
      });
      const settle = async () => {
        for (let i = 0; i < passes.length; i += 1) await passes[i];
        await new Promise((r) => setTimeout(r, 0));
      };
      const live = () => timeouts.filter((t) => !t.cleared);

      // The open pass, offline: two saves waiting.
      scheduler.start();
      scheduler.trigger();
      await settle();
      expect(facts.at(-1)).toMatchObject({ bookId: BOOK, phase: 'saves_waiting', savesWaiting: 2 });
      expect(await remoteHead(remote.repoDir)).not.toBe(await b.head());

      // A retry is armed though no trigger came; still offline, it fails and
      // backs off.
      expect(live()).toHaveLength(1);
      const first = live()[0];
      first.cleared = true;
      first.fn();
      await settle();
      expect(facts.at(-1)?.phase).toBe('saves_waiting');
      expect(live()).toHaveLength(1);
      expect(live()[0].ms).toBeGreaterThan(first.ms);

      // The network returns — no `online` event, no Sync now. The armed retry
      // pushes both saves and the book reads in step; no further retry is armed.
      net.offline = false;
      const next = live()[0];
      next.cleared = true;
      next.fn();
      await settle();
      expect(facts.at(-1)).toMatchObject({ bookId: BOOK, phase: 'in_step' });
      expect(await remoteHead(remote.repoDir)).toBe(await b.head());
      expect(live()).toHaveLength(0);
      scheduler.stop();
    } finally {
      await remote.stop();
    }
  });

});
