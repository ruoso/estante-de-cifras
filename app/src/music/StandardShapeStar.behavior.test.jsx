// behavior (music.explorer_standard_shapes) — starring a shape while the in-use
// instrument is the synthesized standard-guitar fallback, driven through the real
// command/event path: a real `createWorkerLogic` in-process over the loopback
// double with an injected `fake-indexeddb`, `installWebLocks()`, and the git layer
// against `startGitHttpRemote()`, exactly as music.instruments/music.explorer wired
// it. The worker starts with NO instrument configured (the remote holds only its
// seed commit, no home-book files → every settling file reads as `{}`), so the
// in-use instrument is the synthesized standard. The home book is read back from
// the Worker's own filesystem to confirm the star and the materialization. All
// fixtures are shapes written for this test (no-song-text rule).
//
// Pins the .tji behavior clause "star a shape on the standard fallback, confirm the
// leaf persists in shapes.json and is read back by the explorer"; workflow 15
// L71-82, L84-100; home-book §4.4, §4.3, §2.1; DIRECTION §3.2.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import { createFileSystem } from '../worker/fs.js';
import { createGitLayer } from '../worker/git.js';
import { createGitHttpClient } from '../worker/git-http.js';
import { createBookLocks } from '../worker/locks.js';
import { createHomeBook, HOME_BOOK_ID } from '../worker/home-book.js';
import { createWorkerLogic } from '../worker/logic.js';
import { createStore } from '../worker/store.js';
import { STANDARD_INSTRUMENT_ID } from '../worker/instruments.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import ChordExplorer from './ChordExplorer.jsx';

const GUITAR_TUNING = 'E2 A2 D3 G3 B3 E4';
const SLOW = { timeout: 5000 };
const rand = () => Math.random().toString(36).slice(2);

function installMatchMedia(dark = false) {
  globalThis.matchMedia = (media) => ({
    media,
    matches: dark,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

let restoreLocks;
beforeEach(() => {
  restoreLocks = installWebLocks();
  installMatchMedia(false);
  setLocale('en');
});
afterEach(() => {
  restoreLocks();
  delete globalThis.matchMedia;
});

// A worker over a freshly-cloned, un-seeded home book: no instruments.json, no
// preferences.json → the in-use instrument is the synthesized standard guitar.
async function makeEmptyWorker(remote, label) {
  const idb = new IDBFactory();
  const name = `std-${label}-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  await git.clone({ dir: git.bookDir(HOME_BOOK_ID), url: remote.url });
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
  );
  return { store: createStore(endpoint), idb, name };
}

async function readHome(idb, name, file) {
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const home = createHomeBook({ fs, git, locks: createBookLocks({ navigator }) });
  return home.read({ bookId: HOME_BOOK_ID, file });
}

const renderExplorer = (store, initialText) =>
  render(
    <ThemeRoot store={store}>
      <ChordExplorer store={store} initialText={initialText} mode="narrow" onBack={() => {}} />
    </ThemeRoot>,
  );

describe('starring on the standard-guitar fallback (behavior)', () => {
  it('persists the star under the reserved id, materializes the standard in use, reviews it, and unstars — axe clean', async () => {
    const remote = await startGitHttpRemote();
    try {
      const { store, idb, name } = await makeEmptyWorker(remote, 'star');
      renderExplorer(store, 'A');
      act(() => store.open());

      // The synthesized standard (guitar, standard tuning) ranks A's shapes.
      await screen.findByText('Open', {}, SLOW);
      expect(await checkWcag21aa(document.body)).toHaveNoViolations();

      // (a) Star the first shape. It writes one leaf under the RESERVED id —
      // never the fragile "null" key the old fallback produced (home-book §4.4).
      const star = screen.getAllByRole('button', { name: /Star A,/ })[0];
      act(() => fireEvent.click(star));

      let leaf;
      await waitFor(async () => {
        const model = await readHome(idb, name, 'shapes.json');
        leaf = model?.[STANDARD_INSTRUMENT_ID]?.[GUITAR_TUNING]?.A;
        expect(typeof leaf?.value).toBe('string');
      }, SLOW);

      // The explorer reads it back: the shape draws *your shape* and its star is
      // pressed (DIRECTION §3.2 — personal state commits, no explicit save).
      const unstar = await screen.findByRole(
        'button',
        { name: /Your shape for A, .* — unstar/ },
        SLOW,
      );
      expect(unstar).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getAllByText('your shape').length).toBeGreaterThan(0);

      // (b) The standard is now a real instrument in instruments.json, in use —
      // the canonical definition + rules a hand-added Guitar · Standard writes
      // (home-book §2.1 lazy write, §4.3; workflow 15 L84-100).
      await waitFor(async () => {
        const model = await readHome(idb, name, 'instruments.json');
        expect(model?.[STANDARD_INSTRUMENT_ID]?.definition?.value).toEqual({
          catalogId: '6guitar',
          label: null,
          tuning: GUITAR_TUNING,
          fretCount: 22,
        });
        expect(model[STANDARD_INSTRUMENT_ID].rules.value).toEqual({ preset: 'strumming' });
      }, SLOW);
      await waitFor(async () => {
        const prefs = await readHome(idb, name, 'preferences.json');
        expect(prefs?.instrumentInUse?.value).toBe(STANDARD_INSTRUMENT_ID);
      }, SLOW);

      // (c) It appears in the roster, in use, and its shape is in the my-shapes
      // review — indistinguishable from a hand-added instrument (MyShapes.jsx).
      const chip = screen.getByRole('button', { name: /change instrument/ });
      act(() => fireEvent.click(chip));
      await screen.findByRole('heading', { name: 'Instruments' }, SLOW);
      const rosterRow = await screen.findByRole('button', { name: /Open Guitar/ }, SLOW);
      expect(rosterRow).toHaveTextContent(/in use/i);
      expect(await checkWcag21aa(document.body)).toHaveNoViolations();
      act(() => fireEvent.click(rosterRow));
      expect(
        await screen.findByRole('button', { name: /Remove your shape for A,/ }, SLOW),
      ).toBeInTheDocument();
    } finally {
      await remote.stop();
    }
  }, 20000);

  it('a second star adds another leaf without re-materializing the instrument or changing the in-use', async () => {
    const remote = await startGitHttpRemote();
    try {
      const { store, idb, name } = await makeEmptyWorker(remote, 'second');
      renderExplorer(store, 'A');
      act(() => store.open());
      await screen.findByText('Open', {}, SLOW);

      // First star (chord A) → materialization.
      act(() => fireEvent.click(screen.getAllByRole('button', { name: /Star A,/ })[0]));
      await waitFor(async () => {
        const model = await readHome(idb, name, 'instruments.json');
        expect(typeof model?.[STANDARD_INSTRUMENT_ID]?.definition?.value).toBe('object');
      }, SLOW);
      await screen.findByRole('button', { name: /Your shape for A, .* — unstar/ }, SLOW);
      const instrumentsAfterFirst = JSON.stringify(await readHome(idb, name, 'instruments.json'));
      const prefsAfterFirst = JSON.stringify(await readHome(idb, name, 'preferences.json'));

      // (e) Star a shape for a second chord — shapes are keyed by chord
      // (home-book §4.4), so this adds *another* leaf. The definition + rules
      // registers and the in-use preference are untouched: the materialization is
      // idempotent, not re-run on every star (acceptance #2).
      const input = screen.getByRole('textbox', { name: 'Chord' });
      act(() => fireEvent.change(input, { target: { value: 'E' } }));
      act(() => fireEvent.click(screen.getAllByRole('button', { name: /Star E,/ })[0]));
      await waitFor(async () => {
        const byChord = (await readHome(idb, name, 'shapes.json'))?.[STANDARD_INSTRUMENT_ID]?.[
          GUITAR_TUNING
        ];
        expect(typeof byChord?.A?.value).toBe('string');
        expect(typeof byChord?.E?.value).toBe('string');
      }, SLOW);

      expect(JSON.stringify(await readHome(idb, name, 'instruments.json'))).toBe(
        instrumentsAfterFirst,
      );
      expect(JSON.stringify(await readHome(idb, name, 'preferences.json'))).toBe(prefsAfterFirst);
    } finally {
      await remote.stop();
    }
  }, 20000);

  it('unstars the materialized standard — tombstones the leaf (home-book §4.4, §5.3)', async () => {
    const remote = await startGitHttpRemote();
    try {
      const { store, idb, name } = await makeEmptyWorker(remote, 'unstar');
      renderExplorer(store, 'A');
      act(() => store.open());
      await screen.findByText('Open', {}, SLOW);

      act(() => fireEvent.click(screen.getAllByRole('button', { name: /Star A,/ })[0]));
      // First star on the fallback materializes the standard — three serialized
      // home-book commits (instruments, preferences, shapes) before the leaf
      // lands. Wait on that real write (as the sibling tests do) so the unstar
      // query covers only the re-render, not the whole round-trip.
      await waitFor(async () => {
        const model = await readHome(idb, name, 'shapes.json');
        expect(typeof model?.[STANDARD_INSTRUMENT_ID]?.[GUITAR_TUNING]?.A?.value).toBe('string');
      }, SLOW);
      const unstar = await screen.findByRole(
        'button',
        { name: /Your shape for A, .* — unstar/ },
        SLOW,
      );
      act(() => fireEvent.click(unstar));
      await waitFor(async () => {
        const model = await readHome(idb, name, 'shapes.json');
        const regs = Object.values(model?.[STANDARD_INSTRUMENT_ID]?.[GUITAR_TUNING] ?? {});
        expect(regs.length).toBeGreaterThan(0);
        expect(regs.every((r) => r.value === null)).toBe(true);
      }, SLOW);
    } finally {
      await remote.stop();
    }
  }, 20000);
});
