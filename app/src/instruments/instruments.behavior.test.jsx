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

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
import { injectStyles, expectPopoverSurface } from '../test/theme-styles.js';
import { setLocale } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import InstrumentChip from './InstrumentChip.jsx';
import InstrumentsOverlay from './InstrumentsOverlay.jsx';
import { INSTRUMENTS_WIDE_QUERY, WIDE_QUERY } from '../shell/layout-mode.js';

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
// `onClose` (optional) observes the overlay asking to close.
function Surface({ store, onClose }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <InstrumentChip store={store} onOpen={() => setOpen(true)} />
      <InstrumentsOverlay
        store={store}
        isOpen={open}
        onClose={() => {
          onClose?.();
          setOpen(false);
        }}
      />
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

const renderSurface = (store, onClose) =>
  render(
    <ThemeRoot store={store}>
      <Surface store={store} onClose={onClose} />
    </ThemeRoot>,
  );

const chip = () => screen.getByRole('button', { name: /change instrument/ });
const openOverlay = () => act(() => fireEvent.click(chip()));

describe('the instrument surface (behavior)', () => {
  it('adds an instrument (preset and custom tuning), refuses a bad tuning, and switches the one in use', async () => {
    const { store, idb, name } = makeFreshWorker('add');
    renderSurface(store);
    act(() => store.open());

    // The chip shows the standard-guitar default before anything is set up: the
    // one short label, the full identity as its description (shell.header_chrome).
    await waitFor(() => expect(chip()).toHaveTextContent(/^Guitar$/));
    expect(chip()).toHaveAccessibleDescription('Guitar (6-string), Standard tuning: E2 A2 D3 G3 B3 E4');

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

    // Close the overlay and confirm the chip now reflects the in-use instrument:
    // a custom tuning reads "· Custom", its pitches in the description
    // (shell.header_chrome; workflow 15 §The roster, and switching).
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    await waitFor(() => expect(chip()).toHaveTextContent(/^Guitar · Custom$/));
    expect(chip()).toHaveAccessibleDescription(/custom tuning: G4 C4 E4 A4/);

    const prefs = await readHome(idb, name, 'preferences.json');
    expect(typeof prefs.instrumentInUse.value).toBe('string');
  });

  it('names the instrument in use by its one short label: a default label shortened, a user name kept (shell.header_chrome)', async () => {
    const { store } = makeFreshWorker('chip');
    renderSurface(store);
    act(() => store.open());
    await waitFor(() => expect(chip()).toHaveTextContent(/^Guitar$/));

    // Add a guitar in Drop D without renaming it: the form stores its default
    // label, which the chip shortens; the roster keeps the full one.
    openOverlay();
    await screen.findByRole('heading', { name: 'Instruments' });
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
    await screen.findByRole('heading', { name: 'Add instrument' });
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Drop D' })));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
    await waitFor(() => {
      const row = screen.getByRole('button', { name: /^Open Guitar \(6-string\) · Drop D/ });
      expect(within(row).getByText('in use')).toBeInTheDocument();
    }, SLOW);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    await waitFor(() => expect(chip()).toHaveTextContent(/^Guitar · Drop D$/));
    expect(chip()).toHaveAccessibleName('Guitar · Drop D, change instrument');
    expect(chip()).toHaveAccessibleDescription('Guitar (6-string), Drop D tuning: D2 A2 D3 G3 B3 E4');
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    // Add one the user names, and switch to it: the chip shows the name.
    openOverlay();
    await screen.findByRole('heading', { name: 'Instruments' });
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
    await screen.findByRole('heading', { name: 'Add instrument' });
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Open G' })));
    act(() => fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Slide guitar' } }));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
    const slideRow = await screen.findByRole('button', { name: /^Open Slide guitar/ }, SLOW);
    act(() => fireEvent.click(slideRow));
    const useSlide = await screen.findByRole('button', { name: 'Use this instrument' });
    act(() => fireEvent.click(useSlide));
    await waitFor(() => {
      const row = screen.getByRole('button', { name: /^Open Slide guitar/ });
      expect(within(row).getByText('in use')).toBeInTheDocument();
    });
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    await waitFor(() => expect(chip()).toHaveTextContent(/^Slide guitar$/));
    expect(chip()).toHaveAccessibleDescription('Guitar (6-string), Open G tuning: D2 G2 D3 G3 B3 D4');
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
      // With shapes saved, it names them (workflow 15 §Removing; the N-shapes copy).
      expect(dialog).toHaveTextContent(/Its 1 saved shape and the song variations in use for/);
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

  // music.instruments_roster_default — the built-in standard guitar is a roster
  // row from the first run (workflow 15 §The roster, and switching; board W15 #1).
  const BUILT_IN = /^Open Guitar \(6-string\) · E2 A2 D3 G3 B3 E4/;

  // Add a guitar in Drop D named "My Drop D" from the open roster.
  async function addMyDropD() {
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
    await screen.findByRole('heading', { name: 'Add instrument' });
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Drop D' })));
    act(() =>
      fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'My Drop D' } }),
    );
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
    return screen.findByRole('button', { name: /^Open My Drop D/ }, SLOW);
  }

  it('lists the built-in guitar, in use, on a fresh roster — and writes nothing (AC 1)', async () => {
    const { store, idb, name } = makeFreshWorker('fresh');
    renderSurface(store);
    act(() => store.open());
    await waitFor(() => expect(chip()).toHaveTextContent(/^Guitar$/));

    openOverlay();
    await screen.findByRole('heading', { name: 'Instruments' });
    const row = await screen.findByRole('button', { name: BUILT_IN });
    expect(within(row).getByText('in use')).toBeInTheDocument();
    expect(within(row).getByText('Strumming · 6 strings')).toBeInTheDocument();
    // One instrument row: the built-in (the add row is not an "Open …" row).
    expect(screen.getAllByRole('button', { name: /^Open / })).toHaveLength(1);
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    // Listing it is not a write (home-book §2.1 lazy writes).
    expect(await readHome(idb, name, 'instruments.json')).toEqual({});
    const prefs = await readHome(idb, name, 'preferences.json');
    expect(prefs.instrumentInUse).toBeUndefined();
  });

  it('switches back to the built-in guitar after an add (AC 2)', async () => {
    const { store, idb, name } = makeFreshWorker('back');
    renderSurface(store);
    act(() => store.open());
    await waitFor(() => expect(chip()).toHaveTextContent(/^Guitar$/));
    openOverlay();
    await screen.findByRole('heading', { name: 'Instruments' });

    // The first add goes into use; the built-in stays listed first, unmarked.
    await addMyDropD();
    await waitFor(() => {
      const mine = screen.getByRole('button', { name: /^Open My Drop D/ });
      expect(within(mine).getByText('in use')).toBeInTheDocument();
    }, SLOW);
    const rows = screen.getAllByRole('button', { name: /^Open / });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveAccessibleName(BUILT_IN);
    expect(within(rows[0]).queryByText('in use')).toBeNull();

    // Open the guitar and use it: one tap back to the default.
    act(() => fireEvent.click(rows[0]));
    const useBtn = await screen.findByRole('button', { name: 'Use this instrument' });
    act(() => fireEvent.click(useBtn));
    await waitFor(() => {
      const guitar = screen.getByRole('button', { name: BUILT_IN });
      expect(within(guitar).getByText('in use')).toBeInTheDocument();
    }, SLOW);
    const mine = screen.getByRole('button', { name: /^Open My Drop D/ });
    expect(within(mine).queryByText('in use')).toBeNull();
    await waitFor(async () => {
      const prefs = await readHome(idb, name, 'preferences.json');
      expect(prefs.instrumentInUse.value).toBe('standard');
    }, SLOW);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    await waitFor(() => expect(chip()).toHaveTextContent(/^Guitar$/));
  });

  it("shows the built-in's screen without Remove, stores it on a rules change, and falls back when it is removed (AC 3, AC 4)", async () => {
    const { store, idb, name } = makeFreshWorker('builtin');
    renderSurface(store);
    act(() => store.open());
    await waitFor(() => expect(chip()).toHaveTextContent(/^Guitar$/));
    openOverlay();
    act(() => fireEvent.click(screen.getByRole('button', { name: BUILT_IN })));

    // Its screen: definition, rules, my shapes — and no Remove until stored.
    await screen.findByRole('heading', { name: 'Guitar (6-string) · E2 A2 D3 G3 B3 E4' });
    expect(screen.getByText('Definition')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit rules' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove instrument' })).toBeNull();
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
    expect(await readHome(idb, name, 'instruments.json')).toEqual({});

    // A rules change stores it under the reserved id, definition beside rules.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Edit rules' })));
    await screen.findByRole('heading', { name: 'Voicing rules' });
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Fingerstyle' })));
    await waitFor(async () => {
      const model = await readHome(idb, name, 'instruments.json');
      expect(model.standard.definition.value).toMatchObject({
        catalogId: '6guitar',
        tuning: GUITAR_TUNING,
        fretCount: 22,
      });
      expect(model.standard.rules.value).toEqual({ preset: 'fingerstyle' });
    }, SLOW);

    // Stored, it is an ordinary entry: Remove is offered, and one guitar row remains.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    expect(await screen.findByRole('button', { name: 'Remove instrument' })).toBeInTheDocument();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    await screen.findByRole('heading', { name: 'Instruments' });
    await waitFor(() => {
      const rows = screen.getAllByRole('button', { name: BUILT_IN });
      expect(rows).toHaveLength(1);
      expect(within(rows[0]).getByText(/Fingerstyle · 6 strings/)).toBeInTheDocument();
    });

    // Removing the stored standard falls back to the built-in, listed, in use.
    act(() => fireEvent.click(screen.getByRole('button', { name: BUILT_IN })));
    const removeStored = await screen.findByRole('button', { name: 'Remove instrument' });
    act(() => fireEvent.click(removeStored));
    const dialog = await screen.findByRole('alertdialog');
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' })));
    await waitFor(async () => {
      const model = await readHome(idb, name, 'instruments.json');
      expect(model.standard.definition.value).toBeNull();
    }, SLOW);
    await waitFor(() => {
      const row = screen.getByRole('button', { name: BUILT_IN });
      expect(within(row).getByText('in use')).toBeInTheDocument();
      expect(within(row).getByText('Strumming · 6 strings')).toBeInTheDocument();
    });
  });

  it("stores the built-in under its reserved id when its definition is edited, without switching (AC 3)", async () => {
    const { store, idb, name } = makeFreshWorker('builtin-edit');
    renderSurface(store);
    act(() => store.open());
    await waitFor(() => expect(chip()).toHaveTextContent(/^Guitar$/));
    openOverlay();
    await screen.findByRole('heading', { name: 'Instruments' });
    await addMyDropD();
    await waitFor(async () => {
      const prefs = await readHome(idb, name, 'preferences.json');
      expect(typeof prefs.instrumentInUse.value).toBe('string');
    }, SLOW);
    const mineId = (await readHome(idb, name, 'preferences.json')).instrumentInUse.value;

    act(() => fireEvent.click(screen.getByRole('button', { name: BUILT_IN })));
    const editDefinition = await screen.findByRole('button', { name: 'Edit' });
    act(() => fireEvent.click(editDefinition));
    await screen.findByRole('heading', { name: 'Edit' });
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Open G' })));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
    await waitFor(async () => {
      const model = await readHome(idb, name, 'instruments.json');
      expect(model.standard.definition.value).toMatchObject({ tuning: 'D2 G2 D3 G3 B3 D4' });
      expect(model.standard.rules.value).toEqual({ preset: 'strumming' });
    }, SLOW);
    // Materializing never switches away from the one in use.
    const prefs = await readHome(idb, name, 'preferences.json');
    expect(prefs.instrumentInUse.value).toBe(mineId);
  });

  it('names only the song variations when removing an instrument with no saved shapes (AC 5)', async () => {
    const { store } = makeFreshWorker('noshapes');
    renderSurface(store);
    act(() => store.open());
    await waitFor(() => expect(chip()).toHaveTextContent(/^Guitar$/));
    openOverlay();
    await screen.findByRole('heading', { name: 'Instruments' });
    const mine = await addMyDropD();
    act(() => fireEvent.click(mine));

    const removeMine = await screen.findByRole('button', { name: 'Remove instrument' });
    act(() => fireEvent.click(removeMine));
    const dialog = await screen.findByRole('alertdialog');
    const body = dialog.querySelector('.instr-remove-body');
    expect(body.textContent).toMatch(/^The song variations in use for D2 A2 D3 G3 B3 E4 are removed with it\./);
    expect(dialog).not.toHaveTextContent(/0 saved shape/);
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' })));

    // The removal falls back to the built-in guitar, listed and in use.
    await waitFor(() => {
      const row = screen.getByRole('button', { name: BUILT_IN });
      expect(within(row).getByText('in use')).toBeInTheDocument();
    }, SLOW);
    expect(screen.queryByRole('button', { name: /^Open My Drop D/ })).toBeNull();
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

  // shell.popover_surface constraint 2: the instrument picker's list sits on the
  // shared surface (its own class only sizes it), inside the .est theme root,
  // its focused option on --surface-2; axe clean while open.
  it('the instrument picker is drawn on the popover surface', async () => {
    const removeStyles = injectStyles('instruments/instruments.css');
    try {
      const { store } = makeFreshWorker('picker');
      renderSurface(store);
      act(() => store.open());
      await waitFor(() => expect(chip()).toHaveTextContent(/Guitar/));
      openOverlay();
      act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
      await screen.findByRole('heading', { name: 'Add instrument' });

      await act(async () => fireEvent.click(screen.getByRole('button', { name: /Instrument/ })));
      const listbox = await screen.findByRole('listbox');
      const popover = expectPopoverSurface(listbox);
      expect(popover).toHaveClass('instr-popover');
      const option = within(listbox).getAllByRole('option')[0];
      expect(getComputedStyle(option).minHeight).toBe('44px');
      expect(await checkWcag21aa(document.body)).toHaveNoViolations();
    } finally {
      removeStyles();
    }
  });
});

// music.instruments_layout — the instruments as W15 draws them (workflow 15
// §Where it sits). jsdom has no layout, so these pin structure and order: which
// controls each screen has, where they sit in the DOM, and what each one does.
// The geometry (the full screen, the columns side by side, the rail beside the
// detail) is pinned at e2e-web.
describe('the instruments as drawn (behavior)', () => {
  // A controllable viewport stub, copied from AppShell.behavior.test.jsx: it
  // answers the shell's and the instruments' wide queries with `wide` and every
  // other query (the colour scheme) with false.
  function installViewport(initialWide) {
    let wide = initialWide;
    const listeners = new Set();
    globalThis.matchMedia = (media) => ({
      media,
      get matches() {
        return media === WIDE_QUERY || media === INSTRUMENTS_WIDE_QUERY ? wide : false;
      },
      addEventListener: (_type, cb) => listeners.add(cb),
      removeEventListener: (_type, cb) => listeners.delete(cb),
    });
  }

  const dialog = () => screen.getByRole('dialog');
  const precedes = (a, b) =>
    Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
  const BUILT_IN_ROW = /^Open Guitar \(6-string\) · E2 A2 D3 G3 B3 E4/;
  const BUILT_IN_TITLE = 'Guitar (6-string) · E2 A2 D3 G3 B3 E4';

  async function openFresh(label, onClose) {
    const { store } = makeFreshWorker(label);
    renderSurface(store, onClose);
    act(() => store.open());
    await waitFor(() => expect(chip()).toHaveTextContent(/^Guitar$/));
    openOverlay();
    await screen.findByRole('heading', { name: 'Instruments' });
    return store;
  }

  it('(a) narrow: the roster leaves by Back, not a Close ✕ (AC 1; W15 #1)', async () => {
    installViewport(false);
    const onClose = vi.fn();
    await openFresh('narrow-back', onClose);
    expect(within(dialog()).getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(within(dialog()).queryByRole('button', { name: 'Close' })).toBeNull();
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    act(() => fireEvent.click(within(dialog()).getByRole('button', { name: 'Back' })));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('(b) narrow: adding and editing have one way out, the bar’s ✕ Cancel (AC 1; W15 #2)', async () => {
    installViewport(false);
    await openFresh('one-exit');

    const expectOneExit = async () => {
      const cancels = within(dialog()).getAllByRole('button', { name: 'Cancel' });
      expect(cancels).toHaveLength(1);
      const bar = cancels[0].closest('.appbar');
      expect(bar).not.toBeNull();
      expect(precedes(cancels[0], within(bar).getByRole('heading'))).toBe(true);
      expect(within(dialog()).queryByRole('button', { name: 'Back' })).toBeNull();
      expect(await checkWcag21aa(document.body)).toHaveNoViolations();
      return cancels[0];
    };

    // Add: Cancel returns to the roster.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
    await screen.findByRole('heading', { name: 'Add instrument' });
    {
      const target = await expectOneExit();
      act(() => fireEvent.click(target));
    }
    await screen.findByRole('heading', { name: 'Instruments' });

    // Edit: the same form, whose Cancel returns to the instrument's screen.
    act(() => fireEvent.click(screen.getByRole('button', { name: BUILT_IN_ROW })));
    {
      const target = await screen.findByRole('button', { name: 'Edit' });
      act(() => fireEvent.click(target));
    }
    await screen.findByRole('heading', { name: 'Edit' });
    {
      const target = await expectOneExit();
      act(() => fireEvent.click(target));
    }
    await screen.findByRole('heading', { name: BUILT_IN_TITLE });
  });

  it('(c) the rules in two columns, in reading order, naming the instrument as text (AC 2; W15 #3)', async () => {
    installViewport(false);
    await openFresh('rules-cols');
    act(() => fireEvent.click(screen.getByRole('button', { name: BUILT_IN_ROW })));
    {
      const target = await screen.findByRole('button', { name: 'Edit rules' });
      act(() => fireEvent.click(target));
    }
    await screen.findByRole('heading', { name: 'Voicing rules' });

    const cols = dialog().querySelectorAll('.instr-rules-col');
    expect(cols).toHaveLength(2);
    // Rules on the left; Limits then Costs on the right.
    expect(within(cols[0]).getByRole('switch', { name: 'Root required' })).toBeInTheDocument();
    const maxSpan = within(cols[1]).getByRole('textbox', { name: /^Max span/ });
    const sections = cols[1].querySelectorAll('section');
    expect(sections).toHaveLength(2);
    expect(sections[0]).toContainElement(maxSpan);
    const firstCost = within(sections[1]).getAllByRole('textbox')[0];
    expect(precedes(maxSpan, firstCost)).toBe(true);
    // The preset row comes before both columns.
    const presets = screen.getByRole('group', { name: 'Voicing preset' });
    expect(precedes(presets, cols[0])).toBe(true);
    expect(precedes(presets, cols[1])).toBe(true);

    // The bar names whose rules these are as text, not as a second chip.
    const bar = dialog().querySelector('.appbar');
    const named = within(bar).getByText('Guitar');
    expect(named.closest('button')).toBeNull();
    expect(within(dialog()).queryByRole('button', { name: /change instrument/ })).toBeNull();
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  it('(d) computer: the roster is a rail beside the open instrument (AC 3; W15 #4)', async () => {
    installViewport(true);
    const onClose = vi.fn();
    await openFresh('rail', onClose);

    // Add My Drop D (it goes into use), then switch back to the built-in guitar.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
    await screen.findByRole('heading', { name: 'Add instrument' });
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Drop D' })));
    act(() =>
      fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'My Drop D' } }),
    );
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add instrument' })));
    // A saved add opens the new instrument's screen in the main pane.
    await screen.findByRole('heading', { name: 'My Drop D' }, SLOW);
    act(() => fireEvent.click(screen.getByRole('button', { name: BUILT_IN_ROW })));
    {
      const target = await screen.findByRole('button', { name: 'Use this instrument' });
      act(() => fireEvent.click(target));
    }
    // Use this instrument keeps the detail open; the rail shows the new *in use*.
    await waitFor(() => {
      const guitar = screen.getByRole('button', { name: BUILT_IN_ROW });
      expect(within(guitar).getByText('in use')).toBeInTheDocument();
    }, SLOW);
    expect(screen.getByRole('heading', { name: BUILT_IN_TITLE })).toBeInTheDocument();

    // The rail head's Back closes the instruments; reopen them.
    act(() => fireEvent.click(within(dialog()).getByRole('button', { name: 'Back' })));
    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    openOverlay();

    // One render shows the rail rows and the in-use guitar's screen.
    await screen.findByRole('heading', { name: 'Instruments' });
    const side = dialog().querySelector('.split > .pane.side');
    const main = dialog().querySelector('.split > .pane.main');
    expect(within(side).getByRole('button', { name: /^Open My Drop D/ })).toBeInTheDocument();
    expect(within(main).getByRole('heading', { name: BUILT_IN_TITLE })).toBeInTheDocument();
    expect(within(side).getByRole('button', { name: BUILT_IN_ROW })).toHaveAttribute('aria-current', 'true');
    expect(within(side).getByRole('button', { name: /^Open My Drop D/ })).not.toHaveAttribute('aria-current');
    // The detail has no Back; the rail head has the one.
    expect(within(main).queryByRole('button', { name: 'Back' })).toBeNull();
    expect(within(dialog()).getAllByRole('button', { name: 'Back' })).toHaveLength(1);
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    // A rail row opens its screen, moves the mark, and puts focus on its heading.
    act(() => fireEvent.click(within(side).getByRole('button', { name: /^Open My Drop D/ })));
    const mine = await within(main).findByRole('heading', { name: 'My Drop D' });
    expect(within(side).getByRole('button', { name: /^Open My Drop D/ })).toHaveAttribute('aria-current', 'true');
    expect(within(side).getByRole('button', { name: BUILT_IN_ROW })).not.toHaveAttribute('aria-current');
    await waitFor(() => expect(mine).toHaveFocus());

    // Edit rules opens in the main pane, the rail still shown; its Back returns.
    act(() => fireEvent.click(within(main).getByRole('button', { name: 'Edit rules' })));
    await within(main).findByRole('heading', { name: 'Voicing rules' });
    expect(within(side).getByRole('button', { name: /^Open My Drop D/ })).toBeInTheDocument();
    act(() => fireEvent.click(within(main).getByRole('button', { name: 'Back' })));
    await within(main).findByRole('heading', { name: 'My Drop D' });

    // + Add instrument opens the form in the main pane; its ✕ Cancel returns to
    // the detail that was open.
    act(() => fireEvent.click(within(side).getByRole('button', { name: /^Add instrument.*catalogue/ })));
    await within(main).findByRole('heading', { name: 'Add instrument' });
    expect(within(side).getByRole('button', { name: BUILT_IN_ROW })).toBeInTheDocument();
    act(() => fireEvent.click(within(main).getByRole('button', { name: 'Cancel' })));
    await within(main).findByRole('heading', { name: 'My Drop D' });
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });
});
