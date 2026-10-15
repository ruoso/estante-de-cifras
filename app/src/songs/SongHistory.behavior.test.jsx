// SongHistory (behavior) — the history surface against the real Worker rig
// (songs.history, workflow 6; the rig of history.behavior.test.js). A loopback
// store drives `createWorkerLogic` over a real lightning-fs cloned from a local
// git-http remote, so SONG_LOG, READ_VERSION, PREVIEW_SAVE, OPEN_SOURCE and
// RESTORE_VERSION run against a repository built in the test with the git CLI;
// the component renders with real React Aria and i18n inside ThemeRoot, and axe
// checks the list, the version view and the open restore dialog. The surface is
// CodeMirror-free, so no jsdom geometry stub is needed (Decision 6). Fixtures
// are purpose-written songs, never anyone's words (standing rule).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import nodePath from 'node:path';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { parse, write } from 'cifra-md';
import { createFileSystem } from '../worker/fs.js';
import { createGitLayer } from '../worker/git.js';
import { createGitHttpClient } from '../worker/git-http.js';
import { createWorkerLogic } from '../worker/logic.js';
import { createStore } from '../worker/store.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';
import { checkWcag21aa } from '../a11y/axe.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import SongHistory from './SongHistory.jsx';

const BOOK = 'book-hist';
const SONG = 'rua-do-porto.cifra.md';
// The account this device signs in as before the history is read: the Worker
// marks a save by its address `author.self`, which the view reads as *you*
// (account.commit_author Decision 7; workflow 6 L16-19).
const ACCOUNT_ID = 'u_hist';
const YOU_EMAIL = `${ACCOUNT_ID}@users.estantedecifras.app`;

const V1 = ['# Rua do Porto', '', '## Primeira Parte', '```', 'C', 'desci a rua', '```', ''].join('\n');
const V2 = ['# Rua do Porto', '', '## Primeira Parte', '```', 'C7', 'desci a rua', '```', ''].join('\n');
const DIRTY = ['# Rua do Porto', '', '## Primeira Parte', '```', 'Am', 'desci a rua', '```', ''].join('\n');

// Two-section songs for block restore (songs.restore_part): Primeira Parte is
// shared across the versions; only Refrão differs (G → G7), so restoring the
// Refrão block leaves Primeira Parte untouched.
const B_V1 = ['# Rua do Porto', '', '## Primeira Parte', '```', 'C', 'desci a rua', '```', '', '## Refrão', '```', 'G', 'e cantei', '```', ''].join('\n');
const B_V2 = ['# Rua do Porto', '', '## Primeira Parte', '```', 'C', 'desci a rua', '```', '', '## Refrão', '```', 'G7', 'e cantei', '```', ''].join('\n');
// An unsaved edit to Primeira Parte only (Refrão left at HEAD's G7): restoring the
// Refrão block must not ask (that block is clean), restoring Primeira Parte must.
const B_DIRTY = ['# Rua do Porto', '', '## Primeira Parte', '```', 'Am', 'desci a rua', '```', '', '## Refrão', '```', 'G7', 'e cantei', '```', ''].join('\n');
// The working copy after restoring the Refrão block over B_DIRTY: Primeira Parte's
// unsaved Am is intact, Refrão is back to V1's G.
const B_DIRTY_REFRAO_RESTORED = ['# Rua do Porto', '', '## Primeira Parte', '```', 'Am', 'desci a rua', '```', '', '## Refrão', '```', 'G', 'e cantei', '```', ''].join('\n');

// A song with a voicing block the chart never plays (D5 on a second instrument):
// V1 carries it, V2 dropped it. Restoring that block brings nothing back — §8.3 I1
// prunes it (behaviour 4).
const VC_V1 = ['# Rua do Porto', '', '## Parte', '```', '| C | G |', '```', '', '---', '', '## Voicings: G4 C4 E4 A4', '- C: 0003', '- G: 0232', '', '## Voicings: D4 G4 B4 E4', '- D5: 0000', ''].join('\n');
const VC_V2 = ['# Rua do Porto', '', '## Parte', '```', '| C | G |', '```', '', '---', '', '## Voicings: G4 C4 E4 A4', '- C: 0003', '- G: 0232', ''].join('\n');

// A version too old to read in blocks: a title-only early placeholder (behaviour 5).
const OLD_V1 = '# Rua do Porto\n';

// jsdom has no matchMedia; a stub drives the layout. matches:false is the phone
// (the surface's default), the one all the content assertions need; one axe test
// flips it true for the computer split.
let mediaMatches = false;
beforeEach(() => {
  mediaMatches = false;
  globalThis.matchMedia = (media) => ({
    media,
    get matches() {
      return mediaMatches;
    },
    addEventListener() {},
    removeEventListener() {},
  });
});

const until = (fn) => vi.waitFor(fn, { timeout: 8000, interval: 25 });

// Async git CLI runner (a sync child would deadlock against the in-process
// http remote), mirroring history.behavior.test.js.
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

let clock;
function seedEnv() {
  clock += 60000;
  const when = new Date(clock).toISOString();
  return {
    PATH: process.env.PATH,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Score Keeper',
    GIT_AUTHOR_EMAIL: 'keeper@example.invalid',
    GIT_COMMITTER_NAME: 'Score Keeper',
    GIT_COMMITTER_EMAIL: 'keeper@example.invalid',
    GIT_AUTHOR_DATE: when,
    GIT_COMMITTER_DATE: when,
  };
}

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
  clock = Date.UTC(2026, 0, 1, 0, 0, 0);
});
afterEach(() => {
  cleanup();
  restoreLocks();
});

async function setup(bookId) {
  const remote = await startGitHttpRemote();
  const idb = new IDBFactory();
  const name = `hist-${Math.random().toString(36).slice(2)}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const dir = git.bookDir(bookId);
  const workdir = mkdtempSync(nodePath.join(tmpdir(), 'hist-work-'));

  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
  );
  const store = createStore(endpoint);

  // Sign the device in (ATTACH_HOME with the sign-in reply's account id): the
  // attach itself meets no service here and attaches nothing, but the id is kept.
  const attached = new Promise((resolve) => {
    const off = store.subscribeEvents((message) => {
      if (message.kind === EventKind.HOME_ATTACHED) {
        off();
        resolve();
      }
    });
  });
  store.send(command(CommandKind.ATTACH_HOME, { accountId: ACCOUNT_ID }));
  await attached;

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

  return {
    store,
    fs,
    dir,
    bookId,
    seed,
    read: (path) => fs.promises.readFile(`${dir}/${path}`, 'utf8'),
    async settled() {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await navigator.locks.request(`book:${bookId}`, { mode: 'exclusive' }, () => {});
      await Promise.resolve();
    },
    async cleanup() {
      rmSync(workdir, { recursive: true, force: true });
      await remote.stop();
    },
  };
}

// A linear two-version history: V1 by Ana (the first version), then V2 by the
// device identity (so it reads as *you*).
async function seedTwoVersions(ctx) {
  return ctx.seed(async ({ g, w, rev, oids }) => {
    w(SONG, V1);
    await g('add', '.');
    await g('commit', '-qm', 'First version', '--author=Ana <ana@example.invalid>');
    oids.c1 = await rev();
    w(SONG, V2);
    await g('add', '.');
    await g('commit', '-qm', 'Darker turn', `--author=Me <${YOU_EMAIL}>`);
    oids.c2 = await rev();
  });
}

// A linear two-version history with arbitrary bytes: v1 by Ana, v2 as *you*.
async function seedPair(ctx, v1, v2) {
  return ctx.seed(async ({ g, w, rev, oids }) => {
    w(SONG, v1);
    await g('add', '.');
    await g('commit', '-qm', 'First version', '--author=Ana <ana@example.invalid>');
    oids.c1 = await rev();
    w(SONG, v2);
    await g('add', '.');
    await g('commit', '-qm', 'Darker turn', `--author=Me <${YOU_EMAIL}>`);
    oids.c2 = await rev();
  });
}

function renderHistory(store, props = {}) {
  return render(
    <ThemeRoot store={store}>
      <SongHistory store={store} bookId={BOOK} path={SONG} songTitle="Rua do Porto" {...props} />
    </ThemeRoot>,
  );
}

describe('SongHistory', () => {
  it('lists versions newest-first, marks *you* vs an author name, axe-clean (§The list L11-37)', async () => {
    const ctx = await setup(BOOK);
    try {
      await seedTwoVersions(ctx);
      const { container } = renderHistory(ctx.store);

      // Both versions render; the device save reads as *you*, Ana's as her name.
      await screen.findByRole('button', { name: /Darker turn/ });
      expect(screen.getByText(/^you · /)).toBeInTheDocument();
      expect(screen.getByText(/^Ana · /)).toBeInTheDocument();

      expect(await checkWcag21aa(container)).toHaveNoViolations();
    } finally {
      await ctx.cleanup();
    }
  });

  it('pins the unsaved changes first with the *unsaved* word badge (§The list L23-26)', async () => {
    const ctx = await setup(BOOK);
    try {
      await seedTwoVersions(ctx);
      // Dirty the working copy through the Worker so the save preview reports it.
      ctx.store.send(command(CommandKind.WRITE, { bookId: BOOK, path: SONG, text: DIRTY }));
      await ctx.settled();

      renderHistory(ctx.store);
      const unsaved = await screen.findByText('Unsaved, on this device');
      const row = unsaved.closest('.row');
      expect(within(row).getByText('unsaved')).toBeInTheDocument();
    } finally {
      await ctx.cleanup();
    }
  });

  it('reads a version as it was — the chart and the what-changed rows (§A version L39-45)', async () => {
    const ctx = await setup(BOOK);
    try {
      await seedTwoVersions(ctx);
      const { container } = renderHistory(ctx.store);

      fireEvent.click(await screen.findByRole('button', { name: /Darker turn/ }));

      // The song as it was, drawn as a chart; and the chord change from V1→V2.
      expect(await screen.findByRole('group', { name: 'The song as it was' })).toBeInTheDocument();
      expect(screen.getByText('What changed from the version before')).toBeInTheDocument();
      await screen.findByText('C → C7');

      expect(await checkWcag21aa(container)).toHaveNoViolations();
    } finally {
      await ctx.cleanup();
    }
  });

  it('compare with now re-diffs against the working copy (§A version L46-50)', async () => {
    const ctx = await setup(BOOK);
    try {
      await seedTwoVersions(ctx);
      ctx.store.send(command(CommandKind.WRITE, { bookId: BOOK, path: SONG, text: DIRTY }));
      await ctx.settled();
      renderHistory(ctx.store);

      fireEvent.click(await screen.findByRole('button', { name: /Darker turn/ }));
      // The default card diffs against the version before (V1 → V2).
      await screen.findByText('C → C7');
      fireEvent.click(screen.getByRole('button', { name: 'Compare with now' }));

      expect(await screen.findByText('What changed from this version to now')).toBeInTheDocument();
      expect(await screen.findByText('C7 → Am')).toBeInTheDocument();
    } finally {
      await ctx.cleanup();
    }
  });

  it('show the text reveals the line diff, classed del/add (§A version L43-45)', async () => {
    const ctx = await setup(BOOK);
    try {
      await seedTwoVersions(ctx);
      const { container } = renderHistory(ctx.store);

      fireEvent.click(await screen.findByRole('button', { name: /Darker turn/ }));
      await screen.findByText('C → C7');
      fireEvent.click(screen.getByRole('switch', { name: 'Show the text' }));

      const del = container.querySelector('.est-history-text .ln.del');
      const add = container.querySelector('.est-history-text .ln.add');
      expect(del?.textContent).toBe('C');
      expect(add?.textContent).toBe('C7');
    } finally {
      await ctx.cleanup();
    }
  });

  it('restore with a clean working copy sends RESTORE_VERSION and hands off to save (§Restoring)', async () => {
    const ctx = await setup(BOOK);
    try {
      await seedTwoVersions(ctx);
      const onRestored = vi.fn();
      renderHistory(ctx.store, { onRestored });

      // Open the first version and restore it; no unsaved changes, so no prompt.
      fireEvent.click(await screen.findByRole('button', { name: /First version/ }));
      await screen.findByRole('group', { name: 'The song as it was' });
      fireEvent.click(screen.getByRole('button', { name: 'Restore this version' }));

      await until(() => expect(onRestored).toHaveBeenCalled());
      // The working copy now holds the restored (older) version, uncommitted.
      await until(async () => expect(await ctx.read(SONG)).toBe(V1));
    } finally {
      await ctx.cleanup();
    }
  });

  it('restore over unsaved changes asks first; cancelling leaves the working copy (§Restoring L57-58)', async () => {
    const ctx = await setup(BOOK);
    try {
      await seedTwoVersions(ctx);
      ctx.store.send(command(CommandKind.WRITE, { bookId: BOOK, path: SONG, text: DIRTY }));
      await ctx.settled();
      const onRestored = vi.fn();
      renderHistory(ctx.store, { onRestored });

      // Wait for the preview to land (the unsaved row proves it) before restoring,
      // so the dirty working copy triggers the confirm rather than a direct restore.
      await screen.findByText('Unsaved, on this device');
      fireEvent.click(screen.getByRole('button', { name: /First version/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Restore this version' }));

      // It asks first, showing what would be lost; axe the open dialog.
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(/Restore the version of/)).toBeInTheDocument();
      expect(await checkWcag21aa(dialog)).toHaveNoViolations();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Keep my changes' }));
      await until(() => expect(screen.queryByRole('dialog')).toBeNull());

      // Nothing restored: the working copy still holds the unsaved edit.
      expect(onRestored).not.toHaveBeenCalled();
      expect(await ctx.read(SONG)).toBe(DIRTY);
    } finally {
      await ctx.cleanup();
    }
  });

  it('hides an ordinary merge, shows a resolution merge labelled (§The list L28-32; workflow 9)', async () => {
    const ctx = await setup('book-merge');
    try {
      await ctx.seed(async ({ g, w }) => {
        w(SONG, 'S0\n');
        w('other.cifra.md', 'O0\n');
        await g('add', '.');
        await g('commit', '-qm', 'base');
        // Joined merge: one side edits the song, the other a different file; the
        // merged song comes verbatim from one side (ordinary — hidden).
        await g('checkout', '-qb', 'feat');
        w(SONG, 'SA\n');
        await g('add', '.');
        await g('commit', '-qm', 'edit song on feat');
        await g('checkout', '-q', 'main');
        w('other.cifra.md', 'O1\n');
        await g('add', '.');
        await g('commit', '-qm', 'edit other on main');
        await g('merge', '--no-ff', '-q', 'feat', '-m', 'ordinary joined merge');
        // Resolution merge: both sides edit the song, resolved to a third value.
        await g('checkout', '-qb', 'kranch');
        w(SONG, 'SX\n');
        await g('add', '.');
        await g('commit', '-qm', 'edit song SX');
        await g('checkout', '-q', 'main');
        w(SONG, 'SY\n');
        await g('add', '.');
        await g('commit', '-qm', 'edit song SY');
        try {
          await g('merge', '--no-ff', '-q', 'kranch', '-m', 'resolution merge');
        } catch {
          // conflict expected; resolve below.
        }
        w(SONG, 'SZ\n');
        await g('add', '.');
        await g('commit', '--no-edit', '-qm', 'resolution merge');
      });

      render(
        <ThemeRoot store={ctx.store}>
          <SongHistory store={ctx.store} bookId="book-merge" path={SONG} songTitle="S" />
        </ThemeRoot>,
      );

      // The resolution merge is listed with its localized label...
      expect(await screen.findByText('Merged, with your resolution')).toBeInTheDocument();
      // ...and the ordinary joined merge never appears.
      expect(screen.queryByText('ordinary joined merge')).toBeNull();
    } finally {
      await ctx.cleanup();
    }
  });

  // ---- Restoring part of a version (songs.restore_part, workflow 6 §Restoring).

  it('offers *Restore this block* per differing block on compare-with-now, and restores only that block (behaviours 1,2)', async () => {
    const ctx = await setup(BOOK);
    try {
      await seedPair(ctx, B_V1, B_V2);
      const onRestored = vi.fn();
      const { container } = renderHistory(ctx.store, { onRestored });

      fireEvent.click(await screen.findByRole('button', { name: /First version/ }));
      await screen.findByRole('group', { name: 'The song as it was' });
      fireEvent.click(screen.getByRole('button', { name: 'Compare with now' }));

      // Only Refrão differs (G → G7); Primeira Parte is identical, so it is not
      // offered. One *Restore this block*, scoped to Refrão.
      const buttons = await screen.findAllByRole('button', { name: /Restore this block/ });
      expect(buttons).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Restore this block: Refrão' })).toBeInTheDocument();
      expect(await checkWcag21aa(container)).toHaveNoViolations();

      // Clean working copy, so no confirm: the block restores and hands off to save.
      fireEvent.click(buttons[0]);
      await until(() => expect(onRestored).toHaveBeenCalled());
      // Only Refrão changed; the whole song is V1's canonical form (they differ
      // only in Refrão).
      await until(async () => expect(await ctx.read(SONG)).toBe(write(parse(B_V1))));
    } finally {
      await ctx.cleanup();
    }
  });

  it('a block with no unsaved changes restores without asking, leaving another block’s edit intact (behaviours 2,3)', async () => {
    const ctx = await setup(BOOK);
    try {
      await seedPair(ctx, B_V1, B_V2);
      // Unsaved edit to Primeira Parte only; Refrão stays at HEAD's G7.
      ctx.store.send(command(CommandKind.WRITE, { bookId: BOOK, path: SONG, text: B_DIRTY }));
      await ctx.settled();
      const onRestored = vi.fn();
      renderHistory(ctx.store, { onRestored });

      await screen.findByText('Unsaved, on this device');
      fireEvent.click(screen.getByRole('button', { name: /First version/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Compare with now' }));

      // Refrão has no unsaved changes, so restoring it does not ask.
      fireEvent.click(await screen.findByRole('button', { name: 'Restore this block: Refrão' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      await until(() => expect(onRestored).toHaveBeenCalled());
      // Refrão is back to G; Primeira Parte's unsaved Am is untouched.
      await until(async () => expect(await ctx.read(SONG)).toBe(write(parse(B_DIRTY_REFRAO_RESTORED))));
    } finally {
      await ctx.cleanup();
    }
  });

  it('a block with unsaved changes asks first, block-scoped; cancelling leaves the copy; axe (behaviour 3)', async () => {
    const ctx = await setup(BOOK);
    try {
      await seedPair(ctx, B_V1, B_V2);
      ctx.store.send(command(CommandKind.WRITE, { bookId: BOOK, path: SONG, text: B_DIRTY }));
      await ctx.settled();
      const onRestored = vi.fn();
      renderHistory(ctx.store, { onRestored });

      await screen.findByText('Unsaved, on this device');
      fireEvent.click(screen.getByRole('button', { name: /First version/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Compare with now' }));

      // Primeira Parte holds the unsaved Am, so restoring it asks first.
      fireEvent.click(await screen.findByRole('button', { name: 'Restore this block: Primeira Parte' }));
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText('Restore Primeira Parte?')).toBeInTheDocument();
      expect(await checkWcag21aa(dialog)).toHaveNoViolations();

      fireEvent.click(within(dialog).getByRole('button', { name: 'Keep my changes' }));
      await until(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(onRestored).not.toHaveBeenCalled();
      expect(await ctx.read(SONG)).toBe(B_DIRTY);
    } finally {
      await ctx.cleanup();
    }
  });

  it('a block that brings nothing back says so and does not open the save sheet (behaviour 4)', async () => {
    const ctx = await setup(BOOK);
    try {
      await seedPair(ctx, VC_V1, VC_V2);
      const onRestored = vi.fn();
      renderHistory(ctx.store, { onRestored });

      fireEvent.click(await screen.findByRole('button', { name: /First version/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Compare with now' }));

      // The D4 G4 B4 E4 block's chord (D5) is never played, so restoring it prunes
      // to nothing: a word-carried notice, and the save sheet never opens.
      fireEvent.click(
        await screen.findByRole('button', { name: 'Restore this block: Voicings for D4 G4 B4 E4' }),
      );
      await screen.findByText('Restoring this block brings nothing back.');
      expect(onRestored).not.toHaveBeenCalled();
      expect(await ctx.read(SONG)).toBe(write(parse(VC_V2)));
    } finally {
      await ctx.cleanup();
    }
  });

  it('a version too old to read in blocks offers only the whole-version restore, with a note (behaviour 5)', async () => {
    const ctx = await setup(BOOK);
    try {
      await seedPair(ctx, OLD_V1, B_V2);
      const { container } = renderHistory(ctx.store);

      fireEvent.click(await screen.findByRole('button', { name: /First version/ }));
      fireEvent.click(await screen.findByRole('button', { name: 'Compare with now' }));

      expect(
        await screen.findByText(/too old to restore block by block/),
      ).toBeInTheDocument();
      // No per-block affordance; the whole-version restore is still offered.
      expect(screen.queryByRole('button', { name: /Restore this block/ })).toBeNull();
      expect(screen.getByRole('button', { name: 'Restore this version' })).toBeInTheDocument();
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    } finally {
      await ctx.cleanup();
    }
  });

  it('draws the computer two-pane split, axe-clean (§Responsive; W06 computer)', async () => {
    const ctx = await setup(BOOK);
    try {
      await seedTwoVersions(ctx);
      mediaMatches = true; // wide + computer
      const { container } = renderHistory(ctx.store);

      // The list sits beside the version; a version is open by default.
      await screen.findByRole('button', { name: /Darker turn/ });
      expect(container.querySelector('.est-history-split')).toBeTruthy();
      await screen.findByRole('group', { name: 'The song as it was' });

      expect(await checkWcag21aa(container)).toHaveNoViolations();
    } finally {
      await ctx.cleanup();
    }
  });
});
