import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { render, screen, waitFor, act } from '@testing-library/react';
import { createFileSystem } from './fs.js';
import { createGitLayer } from './git.js';
import { createGitHttpClient } from './git-http.js';
import { createBookLocks } from './locks.js';
import { createHomeBook, HOME_BOOK_ID } from './home-book.js';
import { createWorkerLogic } from './logic.js';
import { createStore } from './store.js';
import { command, CommandKind } from './protocol.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { installWebLocks } from '../test/web-locks.js';
import { checkWcag21aa } from '../a11y/axe.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';

// behavior — the preferences surface driven through the real command/event path
// (storage.preferences_surface; the .tji's "the Worker against a fake IndexedDB
// and a local git remote surfaces a theme change, the reducer folds it, the
// ThemeRoot re-applies"). `createWorkerLogic` runs in-process over the loopback
// double with an injected `fake-indexeddb`, `installWebLocks()` active, and the
// git layer against `startGitHttpRemote()`; a seeded home book is cloned into the
// Worker's shared lightning-fs the way working-copy.behavior.test.js seeds a
// working copy, and `<ThemeRoot store={store}>` renders over the store the real
// Worker logic drives — replacing shell.tokens' `manualStore()` stub with the
// real producer. All settings are written for this test (no-song-text rule).
//
// Pins tasks/40-storage.tji:79; DIRECTION §3.2 L136-151, §3.7 L407-414;
// home-book-format §4.1; workflow 1 L86-106; workflow 8 L41-47, L72-77.

const IDENTITY = { id: 'u_8f3a21', name: 'A Tester' };

// Two instants, the second the later, so a §5.1 merge resolves deterministically
// (the later change wins). `set` takes `now`, pinning the §3 `at`.
const T_EARLY = Date.UTC(2026, 9, 5, 14, 0, 0);
const T_LATE = Date.UTC(2026, 9, 5, 15, 0, 0);

// The device's light/dark mode (jsdom provides no matchMedia): fixed at light so
// `automatic` resolves to Estante deterministically (resolve.js; the behavior
// here is the *chosen* theme, not the device-mode path shell.tokens already
// pins). A missing matchMedia also reads as light, but installing it keeps the
// automatic resolution explicit.
function installMatchMedia(dark = false) {
  globalThis.matchMedia = (media) => ({
    media,
    matches: dark,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

// The sample surface the themed root wraps: a heading and a status carried by a
// word (never colour alone — mockups README L26-27), so the axe check has real
// structure to inspect.
function Surface() {
  return (
    <main>
      <h1>Estante de Cifras</h1>
      <p role="status">Pronto</p>
    </main>
  );
}

const rootOf = (container) => container.querySelector('.est');
const rand = () => Math.random().toString(36).slice(2);

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
  installMatchMedia(false);
});
afterEach(() => {
  restoreLocks();
  delete globalThis.matchMedia;
});

// A home-book device over its own fake IndexedDB, filesystem and git layer, the
// home book composed over them and the book cloned from the shared remote — used
// to seed and to push remote changes, exactly as home-book.behavior.test.js does.
async function makeHomeDevice(remote, label) {
  const idb = new IDBFactory();
  const name = `ps-${label}-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const locks = createBookLocks({ navigator });
  const dir = git.bookDir(HOME_BOOK_ID);
  await git.clone({ dir, url: remote.url });
  return { home: createHomeBook({ fs, git, locks }) };
}

// The Worker's device: a fresh fake IndexedDB and FS name, the home book cloned
// into the shared lightning-fs through a test-side git layer (so the Worker's own
// fs over the same name+idb sees it), and the Worker-backed store the view reads.
async function makeWorkerDevice(remote, label) {
  const idb = new IDBFactory();
  const name = `psw-${label}-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const dir = git.bookDir(HOME_BOOK_ID);
  await git.clone({ dir, url: remote.url });
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
  );
  return { store: createStore(endpoint) };
}

// Seed the remote home book with one preferences change, pushed up.
async function seedPreference(remote, label, change, now) {
  const device = await makeHomeDevice(remote, label);
  await device.home.set({
    bookId: HOME_BOOK_ID,
    file: 'preferences.json',
    changes: [change],
    author: IDENTITY,
    now,
  });
  await device.home.sync({ bookId: HOME_BOOK_ID, author: IDENTITY });
}

describe('the preferences surface (behavior)', () => {
  it('surfaces the chosen theme on open, and re-applies it when a sync changes the register (workflow 1 L86-106, workflow 8 L41-47 L72-77)', async () => {
    const remote = await startGitHttpRemote();
    try {
      // Seed the remote home book with theme = "palco".
      await seedPreference(remote, 'seed', { path: ['theme'], value: 'palco' }, T_EARLY);

      // The Worker's device clones the seeded home book; render ThemeRoot over
      // the store the real Worker logic drives.
      const { store } = await makeWorkerDevice(remote, 'w');
      const { container } = render(
        <ThemeRoot store={store}>
          <Surface />
        </ThemeRoot>,
      );
      // Before OPEN nothing is folded yet: automatic, device light → Estante.
      expect(rootOf(container)).toHaveClass('theme-estante');

      // (1) OPEN → the Worker reads preferences.json and emits PREFERENCES; the
      // reducer folds it; ThemeRoot applies theme-palco (*surfaces*, *the reducer
      // folds it*, *the ThemeRoot re-applies*).
      act(() => store.open());
      await waitFor(() => expect(rootOf(container)).toHaveClass('theme-palco'));
      expect(await checkWcag21aa(container)).toHaveNoViolations();

      // (2) A second device pushes theme = "estante" with a later `at`.
      await seedPreference(remote, 'two', { path: ['theme'], value: 'estante' }, T_LATE);

      // SYNC_HOME → the Worker fetches, merges key by key (the later change wins),
      // and re-surfaces; ThemeRoot re-applies theme-estante (*re-emitted when sync
      // changes a register*).
      act(() => store.send(command(CommandKind.SYNC_HOME, { author: IDENTITY })));
      await waitFor(() => expect(rootOf(container)).toHaveClass('theme-estante'));
      expect(screen.getByRole('status')).toHaveTextContent('Pronto');
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    } finally {
      await remote.stop();
    }
  });

  it('stays automatic when the home book has no theme register (home-book-format §4.1 L199-202)', async () => {
    const remote = await startGitHttpRemote();
    try {
      // A home book whose preferences.json holds a register, but NOT `theme`.
      await seedPreference(remote, 'seed', { path: ['language'], value: 'pt-BR' }, T_EARLY);

      const { store } = await makeWorkerDevice(remote, 'w');
      const { container } = render(
        <ThemeRoot store={store}>
          <Surface />
        </ThemeRoot>,
      );

      // OPEN surfaces the map (language only); with no `theme` register the slice
      // has no theme, so ThemeRoot stays automatic — device light → Estante. The
      // absent-register path, end to end.
      act(() => store.open());
      // The language register surfaced (the event fired), yet the theme stays
      // automatic: wait for a microtask turn, then assert Estante holds.
      await waitFor(() => expect(store.slice('preferences')).toHaveProperty('language'));
      expect(store.slice('preferences')).not.toHaveProperty('theme');
      expect(rootOf(container)).toHaveClass('theme-estante');
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    } finally {
      await remote.stop();
    }
  });
});
