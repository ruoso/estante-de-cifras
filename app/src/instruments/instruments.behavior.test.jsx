// behavior — the instrument surface driven through the real command/event path
// (music.instruments; the .tji "the instrument screens with Testing Library and
// axe, stored in the home book"). A real `createWorkerLogic` runs in-process over
// the loopback double with an injected `fake-indexeddb`, `installWebLocks()`
// active, and the git layer against `startGitHttpRemote()`, exactly as the
// preferences-surface behavior test wires it. The chip + overlay render over
// `<ThemeRoot store={store}>`; the home book is read back from the Worker's own
// filesystem to confirm what was stored. All fixtures are written for this test
// (no-song-text rule).
//
// Pins workflow 15; home-book §4.3–§4.4; mockup W15; DIRECTION §3.7 L407-414.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useState } from 'react';
import { IDBFactory } from 'fake-indexeddb';
import { render, screen, within, waitFor, act, fireEvent } from '@testing-library/react';
import { createFileSystem } from '../worker/fs.js';
import { createGitLayer } from '../worker/git.js';
import { createGitHttpClient } from '../worker/git-http.js';
import { createBookLocks } from '../worker/locks.js';
import { createHomeBook, HOME_BOOK_ID } from '../worker/home-book.js';
import { createWorkerLogic } from '../worker/logic.js';
import { createStore } from '../worker/store.js';
import { startGitHttpRemote } from '../test/git-http-remote.js';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { installWebLocks } from '../test/web-locks.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import InstrumentChip from './InstrumentChip.jsx';
import InstrumentsOverlay from './InstrumentsOverlay.jsx';

const IDENTITY = { id: 'u_8f3a21', name: 'A Tester' };
const T_EARLY = Date.UTC(2026, 9, 5, 14, 0, 0);
const GUITAR_TUNING = 'E2 A2 D3 G3 B3 E4';
const UKE_TUNING = 'G4 C4 E4 A4';
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

// The harness that mounts the one shared chip and the overlay it opens, the way
// AppShell wires them — the instrument surface in isolation.
function Surface({ store }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <InstrumentChip store={store} onOpen={() => setOpen(true)} />
      <InstrumentsOverlay store={store} isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

// A fresh Worker-backed store over its own fake IndexedDB and filesystem, with no
// remote — the Worker provisions a local home book on the first write.
function makeFreshWorker(label) {
  const idb = new IDBFactory();
  const name = `instr-${label}-${rand()}`;
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
  );
  return { store: createStore(endpoint), idb, name };
}

// A Worker-backed store whose shared filesystem already holds a home book cloned
// from the seeded remote (mirrors preferences-surface's makeWorkerDevice).
async function makeSeededWorker(remote, label) {
  const idb = new IDBFactory();
  const name = `instr-${label}-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  await git.clone({ dir: git.bookDir(HOME_BOOK_ID), url: remote.url });
  const endpoint = createLoopbackEndpoint((port) =>
    createWorkerLogic(port, { indexedDB: idb, name, fetch: globalThis.fetch }),
  );
  return { store: createStore(endpoint), idb, name };
}

// Read a home-book settings file from the Worker's own filesystem (a fresh fs
// instance over the same name+idb, after the handler's flush persisted it).
async function readHome(idb, name, file) {
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  const home = createHomeBook({ fs, git, locks: createBookLocks({ navigator }) });
  return home.read({ bookId: HOME_BOOK_ID, file });
}

// Seed a home book on the remote with the given per-file register changes.
async function seedRemote(remote, changesByFile) {
  const idb = new IDBFactory();
  const name = `seed-${rand()}`;
  const fs = createFileSystem(`${name}-fs`, { indexedDB: idb });
  const git = createGitLayer({ fs, http: createGitHttpClient({ fetch: globalThis.fetch }) });
  await git.clone({ dir: git.bookDir(HOME_BOOK_ID), url: remote.url });
  const home = createHomeBook({ fs, git, locks: createBookLocks({ navigator }) });
  for (const [file, changes] of Object.entries(changesByFile)) {
    await home.set({ bookId: HOME_BOOK_ID, file, changes, author: IDENTITY, now: T_EARLY });
  }
  await home.sync({ bookId: HOME_BOOK_ID, author: IDENTITY });
}

const renderSurface = (store) =>
  render(
    <ThemeRoot store={store}>
      <Surface store={store} />
    </ThemeRoot>,
  );

const chip = () => screen.getByRole('button', { name: /change instrument/ });
const openOverlay = () => act(() => fireEvent.click(chip()));

describe('the instrument surface (behavior)', () => {
  it('adds an instrument (preset and custom tuning), refuses a bad tuning, and switches the one in use', async () => {
    const { store, idb, name } = makeFreshWorker('add');
    renderSurface(store);
    act(() => store.open());

    // The chip shows the standard-guitar default before anything is set up.
    await waitFor(() => expect(chip()).toHaveTextContent(/Guitar/));

    // Open the roster and add an instrument on its default (Standard) tuning.
    openOverlay();
    await screen.findByRole('heading', { name: 'Instruments' });
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
    await screen.findByRole('heading', { name: 'Add instrument' });
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));

    // The two registers are stored, read back from the Worker's home book.
    await waitFor(async () => {
      const model = await readHome(idb, name, 'instruments.json');
      const ids = Object.keys(model);
      expect(ids).toHaveLength(1);
      const entry = model[ids[0]];
      expect(entry.definition.value).toMatchObject({
        catalogId: '6guitar',
        tuning: GUITAR_TUNING,
        fretCount: 22,
      });
      expect(entry.definition.at).toBeTruthy();
      expect(entry.rules.value).toEqual({ preset: 'strumming' });
    }, SLOW);

    // The first instrument became the one in use: its roster row is marked with
    // the word "in use" (the chip itself is aria-hidden behind the open overlay).
    await waitFor(() => {
      const row = screen.getByRole('button', { name: /^Open Guitar \(6-string\) · Standard/ });
      expect(within(row).getByText('in use')).toBeInTheDocument();
    });

    // Add a second instrument via a CUSTOM pitch list; a bad list is refused.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
    await screen.findByRole('heading', { name: 'Add instrument' });
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Custom…' })));
    const custom = screen.getByRole('textbox', { name: 'Custom tuning' });
    act(() => fireEvent.change(custom, { target: { value: 'zzz not a tuning' } }));
    // The reason is shown and nothing is stored.
    expect(await screen.findByRole('alert')).toHaveTextContent(/does not read/);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
    expect(screen.getByRole('heading', { name: 'Add instrument' })).toBeInTheDocument();

    // A valid custom list is accepted.
    act(() => fireEvent.change(custom, { target: { value: UKE_TUNING } }));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
    await waitFor(async () => {
      const model = await readHome(idb, name, 'instruments.json');
      expect(Object.keys(model)).toHaveLength(2);
    }, SLOW);

    // Switch the one in use: open the custom instrument and use it.
    await screen.findByRole('heading', { name: 'Instruments' });
    act(() => fireEvent.click(screen.getByRole('button', { name: /^Open .*G4 C4 E4 A4/ })));
    const useBtn = await screen.findByRole('button', { name: 'Use this instrument' });
    act(() => fireEvent.click(useBtn));
    // The custom instrument is now the one in use (its roster row is marked).
    await waitFor(() => {
      const row = screen.getByRole('button', { name: /^Open .*G4 C4 E4 A4/ });
      expect(within(row).getByText('in use')).toBeInTheDocument();
    });

    // Close the overlay and confirm the chip now reflects the in-use instrument.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Close' })));
    await waitFor(() => expect(chip()).toHaveTextContent(/G4 C4 E4 A4/));

    const prefs = await readHome(idb, name, 'preferences.json');
    expect(typeof prefs.instrumentInUse.value).toBe('string');
  });

  it('shows the roster with the in-use marked by the word "in use"', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedRemote(remote, {
        'instruments.json': [
          { path: ['g1', 'definition'], value: { catalogId: '6guitar', label: 'Guitar · Standard', tuning: GUITAR_TUNING, fretCount: 22 } },
          { path: ['g1', 'rules'], value: { preset: 'strumming' } },
        ],
        'preferences.json': [{ path: ['instrumentInUse'], value: 'g1' }],
      });
      const { store } = await makeSeededWorker(remote, 'inuse');
      renderSurface(store);
      act(() => store.open());
      await waitFor(() => expect(chip()).toHaveTextContent(/Guitar · Standard/));
      openOverlay();
      const row = await screen.findByRole('button', { name: /^Open Guitar · Standard/ });
      expect(within(row).getByText('in use')).toBeInTheDocument();
      expect(within(row).getByText(/Strumming · 6 strings/)).toBeInTheDocument();
    } finally {
      await remote.stop();
    }
  });

  it('edits the voicing rules: a toggle turns it Custom, a preset rebuilds, rootInBass forced off on a ukulele', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedRemote(remote, {
        'instruments.json': [
          { path: ['u1', 'definition'], value: { catalogId: 'ukulele', label: 'Ukulele · GCEA', tuning: UKE_TUNING, fretCount: 15 } },
          { path: ['u1', 'rules'], value: { preset: 'strumming' } },
        ],
        'preferences.json': [{ path: ['instrumentInUse'], value: 'u1' }],
      });
      const { store, idb, name } = await makeSeededWorker(remote, 'rules');
      renderSurface(store);
      act(() => store.open());
      await waitFor(() => expect(chip()).toHaveTextContent(/Ukulele/));

      openOverlay();
      const ukeRow = await screen.findByRole('button', { name: /^Open Ukulele/ });
      act(() => fireEvent.click(ukeRow));
      const editRules = await screen.findByRole('button', { name: 'Edit rules' });
      act(() => fireEvent.click(editRules));
      await screen.findByRole('heading', { name: 'Voicing rules' });
      expect(await checkWcag21aa(document.body)).toHaveNoViolations();

      // Root in bass is forced off and disabled on a no-bass instrument.
      const rootInBass = screen.getByRole('switch', { name: 'Root in bass' });
      expect(rootInBass).toBeDisabled();
      expect(rootInBass).not.toBeChecked();

      // Toggling a rule turns the preset Custom and stores the frozen config.
      act(() => fireEvent.click(screen.getByRole('switch', { name: 'Barre allowed' })));
      await waitFor(async () => {
        const model = await readHome(idb, name, 'instruments.json');
        expect(model.u1.rules.value.preset).toBe('custom');
        expect(model.u1.rules.value.config.allowBarre).toBe(false);
      }, SLOW);
      expect(await screen.findByText('Custom')).toBeInTheDocument();

      // Choosing a preset rebuilds from it (stored as a named preset again).
      act(() => fireEvent.click(screen.getByRole('button', { name: 'Fingerstyle' })));
      await waitFor(async () => {
        const model = await readHome(idb, name, 'instruments.json');
        expect(model.u1.rules.value).toEqual({ preset: 'fingerstyle' });
      }, SLOW);
    } finally {
      await remote.stop();
    }
  });

  it('reviews my shapes (drawn as your-shape diagrams), removes one, and removes the instrument', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedRemote(remote, {
        'instruments.json': [
          { path: ['g1', 'definition'], value: { catalogId: '6guitar', label: 'Guitar · Standard', tuning: GUITAR_TUNING, fretCount: 22 } },
          { path: ['g1', 'rules'], value: { preset: 'strumming' } },
        ],
        'shapes.json': [
          { path: ['g1', GUITAR_TUNING, 'Em'], value: '022000' },
          { path: ['g1', GUITAR_TUNING, 'G'], value: '320003' },
        ],
        'preferences.json': [{ path: ['instrumentInUse'], value: 'g1' }],
      });
      const { store, idb, name } = await makeSeededWorker(remote, 'shapes');
      renderSurface(store);
      act(() => store.open());
      await waitFor(() => expect(chip()).toHaveTextContent(/Guitar/));

      openOverlay();
      const gRow = await screen.findByRole('button', { name: /^Open Guitar · Standard/ });
      act(() => fireEvent.click(gRow));

      // The shapes are drawn as "your shape" chord diagrams.
      await waitFor(() => expect(screen.getAllByText('your shape').length).toBe(2));
      expect(await checkWcag21aa(document.body)).toHaveNoViolations();

      // Remove one shape → its leaf register is tombstoned.
      act(() =>
        fireEvent.click(screen.getByRole('button', { name: /Remove your shape for Em, 022000/ })),
      );
      await waitFor(async () => {
        const model = await readHome(idb, name, 'shapes.json');
        expect(model.g1[GUITAR_TUNING].Em.value).toBeNull();
        expect(model.g1[GUITAR_TUNING].G.value).toBe('320003');
      }, SLOW);
      await waitFor(() => expect(screen.getAllByText('your shape').length).toBe(1));

      // Remove the instrument: the confirm names what goes, then tombstones it.
      act(() => fireEvent.click(screen.getByRole('button', { name: 'Remove instrument' })));
      const dialog = await screen.findByRole('alertdialog');
      expect(within(dialog).getByText(new RegExp(GUITAR_TUNING))).toBeInTheDocument();
      act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' })));
      await waitFor(async () => {
        const model = await readHome(idb, name, 'instruments.json');
        expect(model.g1.definition.value).toBeNull();
        expect(model.g1.rules.value).toBeNull();
      }, SLOW);
    } finally {
      await remote.stop();
    }
  });

  it('activates the add flow from the roster by keyboard', async () => {
    const { store } = makeFreshWorker('kbd');
    renderSurface(store);
    act(() => store.open());
    await waitFor(() => expect(chip()).toHaveTextContent(/Guitar/));
    openOverlay();
    const add = await screen.findByRole('button', { name: 'Add instrument' });
    act(() => add.focus());
    expect(add).toHaveFocus();
    act(() => {
      fireEvent.keyDown(add, { key: 'Enter' });
      fireEvent.keyUp(add, { key: 'Enter' });
    });
    expect(await screen.findByRole('heading', { name: 'Add instrument' })).toBeInTheDocument();
  });
});
