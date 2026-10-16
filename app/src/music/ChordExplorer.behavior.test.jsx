// behavior (music.explorer) — the explorer driven through the real command/event
// path: a real `createWorkerLogic` in-process over the loopback double with an
// injected `fake-indexeddb`, `installWebLocks()`, and the git layer against
// `startGitHttpRemote()`, exactly as music.instruments wired it. The screen renders
// over `<ThemeRoot store={store}>`; the home book is read back from the Worker's own
// filesystem to confirm a star was stored. All fixtures are songs/shapes written
// for this test (no-song-text rule).
//
// Pins the .tji behavior clause "the explorer with Testing Library and axe, a
// keyboard path through fingerings, starring"; workflow 16 L38-191; DIRECTION
// §3.2, §3.7; home-book §4.4.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
import ChordExplorer from './ChordExplorer.jsx';

const IDENTITY = { id: 'u_8f3a21', name: 'A Tester' };
const T_EARLY = Date.UTC(2026, 9, 5, 14, 0, 0);
const GUITAR_TUNING = 'E2 A2 D3 G3 B3 E4';
const CAVAQUINHO_TUNING = 'D4 G4 B4 D5';
const SLOW = { timeout: 5000 };
// A real Worker, a git remote and axe over a page of diagrams: past Vitest's 5 s
// default when the full suite loads the machine.
const HEAVY = 20000;
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

async function makeSeededWorker(remote, label) {
  const idb = new IDBFactory();
  const name = `explorer-${label}-${rand()}`;
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

// A home book whose in-use instrument is the given catalogue instrument.
function instrumentSeed(id, { catalogId, tuning, fretCount }) {
  return {
    'instruments.json': [
      { path: [id, 'definition'], value: { catalogId, label: null, tuning, fretCount } },
      { path: [id, 'rules'], value: { preset: 'strumming' } },
    ],
    'preferences.json': [{ path: ['instrumentInUse'], value: id }],
  };
}

const renderExplorer = (store, initialText, props = {}) =>
  render(
    <ThemeRoot store={store}>
      <ChordExplorer store={store} initialText={initialText} mode="narrow" onBack={() => {}} {...props} />
    </ThemeRoot>,
  );

describe('the chord explorer (behavior)', () => {
  // shell.display_preferences — pins workflow 16 L216-228: every candidate
  // diagram follows the hand and neck chosen (the explorer and the in-song
  // picker share FingeringGroups), while which shapes are found, their order,
  // grouping and accessible names are unchanged from the default render.
  it('draws every candidate as a left-handed horizontal neck when chosen, order and names unchanged, axe clean', async () => {
    const remote = await startGitHttpRemote();
    try {
      const guitar = instrumentSeed('g1', { catalogId: '6guitar', tuning: GUITAR_TUNING, fretCount: 22 });
      // What the explorer shows for C: each group's heading and, in order,
      // every diagram's accessible name — and every diagram host.
      const snapshot = (container) => ({
        groups: [...container.querySelectorAll('.shapes[role="group"]')].map((g) =>
          g.getAttribute('aria-label'),
        ),
        names: screen.getAllByRole('img').map((d) => d.getAttribute('aria-label')),
      });

      await seedRemote(remote, guitar);
      const plain = await makeSeededWorker(remote, 'display-default');
      const first = renderExplorer(plain.store, 'C');
      act(() => plain.store.open());
      await screen.findByText('Open', {}, SLOW);
      const defaults = snapshot(first.container);
      for (const host of first.container.querySelectorAll('.chord-diagram')) {
        expect(host.querySelector('svg')).toHaveClass('ec-diagram-vertical');
        expect(host).not.toHaveClass('chord-diagram--left');
      }
      first.unmount();

      await seedRemote(remote, {
        'preferences.json': [
          { path: ['diagramHanded'], value: 'left' },
          { path: ['diagramOrientation'], value: 'horizontal' },
        ],
      });
      const chosen = await makeSeededWorker(remote, 'display-chosen');
      const second = renderExplorer(chosen.store, 'C');
      act(() => chosen.store.open());
      await screen.findByText('Open', {}, SLOW);
      await waitFor(() =>
        expect(chosen.store.slice('preferences')?.diagramOrientation?.value).toBe('horizontal'),
      );

      const hosts = [...second.container.querySelectorAll('.chord-diagram')];
      expect(hosts.length).toBeGreaterThan(1);
      for (const host of hosts) {
        expect(host).toHaveClass('chord-diagram--left', 'chord-diagram--horizontal');
        expect(host.querySelector('svg')).toHaveClass('ec-diagram-horizontal');
      }
      expect(snapshot(second.container)).toEqual(defaults);

      expect(await checkWcag21aa(document.body)).toHaveNoViolations();
    } finally {
      await remote.stop();
    }
  }, HEAVY);

  it('shows the ranked groups with difficulty words and accessible diagram names, axe clean', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedRemote(remote, instrumentSeed('g1', { catalogId: '6guitar', tuning: GUITAR_TUNING, fretCount: 22 }));
      const { store } = await makeSeededWorker(remote, 'ranked');
      renderExplorer(store, 'A');
      act(() => store.open());

      // The Open group and at least one fretted group appear, in the core's order.
      await screen.findByText('Open', {}, SLOW);
      expect(screen.getByText('Fret 2')).toBeInTheDocument();

      // Each shape carries a difficulty word (never the number, never colour alone),
      // lowercase as workflow 16 L49-55 writes it and the W16 board's badges draw it.
      expect(screen.getAllByText(/^(easy|medium|hard)$/).length).toBeGreaterThan(1);

      // The diagrams carry the describeFingering accessible name.
      const diagrams = screen.getAllByRole('img');
      expect(diagrams.length).toBeGreaterThan(1);
      expect(
        diagrams.some((d) => /open position/.test(d.getAttribute('aria-label') ?? '')),
      ).toBe(true);

      expect(await checkWcag21aa(document.body)).toHaveNoViolations();
    } finally {
      await remote.stop();
    }
  });

  it('gives a full keyboard path to every star, show more, and enter a shape', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedRemote(remote, instrumentSeed('g1', { catalogId: '6guitar', tuning: GUITAR_TUNING, fretCount: 22 }));
      const { store } = await makeSeededWorker(remote, 'keys');
      renderExplorer(store, 'A');
      act(() => store.open());
      await screen.findByText('Open', {}, SLOW);

      // Every shape's star is a focusable button reachable by keyboard.
      const stars = screen.getAllByRole('button', { name: /Star A,/ });
      expect(stars.length).toBeGreaterThan(1);
      for (const star of stars) {
        act(() => star.focus());
        expect(star).toHaveFocus();
      }

      // *Enter a shape* is reachable.
      const enter = screen.getByRole('button', { name: /Enter a shape/ });
      act(() => enter.focus());
      expect(enter).toHaveFocus();

      // *Show more* is reachable and activates by keyboard, revealing the rest
      // (display-only — it never changes the search).
      const before = screen.getAllByRole('button', { name: /Star A,/ }).length;
      const more = screen.getAllByRole('button', { name: /Show \d+ more/ })[0];
      act(() => more.focus());
      expect(more).toHaveFocus();
      act(() => fireEvent.keyDown(more, { key: 'Enter' }));
      act(() => fireEvent.keyUp(more, { key: 'Enter' }));
      await waitFor(() =>
        expect(screen.getAllByRole('button', { name: /Star A,/ }).length).toBeGreaterThan(before),
      );
    } finally {
      await remote.stop();
    }
  });

  it('stars a shape by keyboard (SAVE_SHAPE), reads it back, then unstars it (REMOVE_SHAPE)', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedRemote(remote, instrumentSeed('g1', { catalogId: '6guitar', tuning: GUITAR_TUNING, fretCount: 22 }));
      const { store, idb, name } = await makeSeededWorker(remote, 'star');
      renderExplorer(store, 'A');
      act(() => store.open());
      await screen.findByText('Open', {}, SLOW);

      // Star the first shape by keyboard.
      const star = screen.getAllByRole('button', { name: /Star A,/ })[0];
      act(() => star.focus());
      act(() => fireEvent.keyDown(star, { key: 'Enter' }));
      act(() => fireEvent.keyUp(star, { key: 'Enter' }));

      // One leaf written to shapes.json for A on this tuning (by chord, canonical).
      let stored;
      await waitFor(async () => {
        const model = await readHome(idb, name, 'shapes.json');
        stored = model?.g1?.[GUITAR_TUNING]?.A;
        expect(typeof stored?.value).toBe('string');
      }, SLOW);

      // It now reads as *your shape* and its button is pressed; unstar it.
      const unstar = await screen.findByRole('button', { name: /Your shape for A, .* — unstar/ });
      expect(unstar).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getAllByText('your shape').length).toBeGreaterThan(0);

      act(() => fireEvent.click(unstar));
      await waitFor(async () => {
        const model = await readHome(idb, name, 'shapes.json');
        expect(model.g1[GUITAR_TUNING].A.value).toBeNull();
      }, SLOW);
    } finally {
      await remote.stop();
    }
  });

  it('re-derives the shapes when the chord in the input changes', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedRemote(remote, instrumentSeed('g1', { catalogId: '6guitar', tuning: GUITAR_TUNING, fretCount: 22 }));
      const { store } = await makeSeededWorker(remote, 'rederive');
      const typed = [];
      renderExplorer(store, 'A', { onTextChange: (v) => typed.push(v) });
      act(() => store.open());
      await screen.findAllByRole('button', { name: /Star A,/ }, SLOW);

      const input = screen.getByRole('textbox', { name: 'Chord' });
      act(() => fireEvent.change(input, { target: { value: 'Am' } }));

      // The edit is reported up: search holds the same symbol (workflow 16 L24-26).
      expect(typed.at(-1)).toBe('Am');

      // The shapes are now Am's, not A's.
      await screen.findAllByRole('button', { name: /Star Am,/ }, SLOW);
      expect(screen.queryByRole('button', { name: /Star A,/ })).not.toBeInTheDocument();
    } finally {
      await remote.stop();
    }
  });

  // Extended by music.fourth_with_seventh_spelling: the reading and the flip back
  // are spelled in the user's (brazilian) dialect — C7(4), C7(add4), never C47 or
  // a bare C7(4) for the added fourth (workflow 16 L109-115) — and a star on the
  // added-fourth reading is keyed C7(add4), so it reads back on that reading
  // (§Starring L120-131; home-book format §4.4).
  it('shows the §5.6 reading it took and re-runs the search on the flip (C7(4))', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedRemote(remote, instrumentSeed('g1', { catalogId: '6guitar', tuning: GUITAR_TUNING, fretCount: 22 }));
      const { store, idb, name } = await makeSeededWorker(remote, 'flip');
      renderExplorer(store, 'C7(4)');
      act(() => store.open());

      // The Brazilian default reads the suspended fourth, and says so.
      await screen.findByText(/^Read as C7\(4\) — suspended 4th\./, {}, SLOW);
      const flip = screen.getByRole('button', { name: /Read as .* instead/ });

      // Flipping re-runs the search on the other reading (added fourth), without
      // changing the preference.
      act(() => fireEvent.click(flip));
      await screen.findByText(/^Read as C7\(add4\) — added 4th\./, {}, SLOW);
      expect(screen.getByRole('button', { name: 'Read as C7(4) instead?' })).toBeInTheDocument();
      expect(await checkWcag21aa(document.body)).toHaveNoViolations();

      // Star the first added-fourth shape by keyboard.
      const star = (await screen.findAllByRole('button', { name: /Star C7\(add4\),/ }, SLOW))[0];
      act(() => star.focus());
      act(() => fireEvent.keyDown(star, { key: 'Enter' }));
      act(() => fireEvent.keyUp(star, { key: 'Enter' }));

      // Stored under the brazilian spelling that reads back as the added fourth.
      await waitFor(async () => {
        const model = await readHome(idb, name, 'shapes.json');
        expect(typeof model?.g1?.[GUITAR_TUNING]?.['C7(add4)']?.value).toBe('string');
      }, SLOW);

      // And it shows as *your shape* on that reading.
      const unstar = await screen.findByRole('button', { name: /Your shape for C7\(add4\), .* — unstar/ }, SLOW);
      expect(unstar).toHaveAttribute('aria-pressed', 'true');
    } finally {
      await remote.stop();
    }
  }, HEAVY);

  it('spells the C7+ flip as workflow 16 names it (C7♯5), and the flip back in the user\'s dialect (C7M), axe clean', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedRemote(remote, instrumentSeed('g1', { catalogId: '6guitar', tuning: GUITAR_TUNING, fretCount: 22 }));
      const { store } = await makeSeededWorker(remote, 'flip-copy');
      renderExplorer(store, 'C7+');
      act(() => store.open());

      // The default (brazilian) dialect reads the major seventh; the flip names
      // the other reading in American with ♯ (§Viewing by notation, the delta).
      await screen.findByText(/major 7th/, {}, SLOW);
      const flip = screen.getByRole('button', { name: 'Read as C7♯5 instead?' });

      act(() => fireEvent.click(flip));
      await screen.findByText(/raised 5th/, {}, SLOW);
      expect(screen.getByRole('button', { name: 'Read as C7M instead?' })).toBeInTheDocument();

      expect(await checkWcag21aa(document.body)).toHaveNoViolations();
    } finally {
      await remote.stop();
    }
  }, HEAVY);

  it('names the reason and points at the rules when no shape fits (empty state), axe clean', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedRemote(remote, instrumentSeed('c1', { catalogId: 'cavaquinho', tuning: CAVAQUINHO_TUNING, fretCount: 15 }));
      const { store } = await makeSeededWorker(remote, 'empty');
      renderExplorer(store, 'C13');
      act(() => store.open());

      await screen.findByRole('heading', { name: 'No shape fits the rules' }, SLOW);
      // The instrument is named by the chip's one short label (shell.header_chrome).
      expect(screen.getByText(/^C13 asks for more notes than Cavaquinho can sound/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Voicing rules' })).toBeInTheDocument();
      expect(await checkWcag21aa(document.body)).toHaveNoViolations();
    } finally {
      await remote.stop();
    }
  });

  it('keeps the last good results, dimmed, when the symbol becomes unparseable', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedRemote(remote, instrumentSeed('g1', { catalogId: '6guitar', tuning: GUITAR_TUNING, fretCount: 22 }));
      const { store } = await makeSeededWorker(remote, 'unreadable');
      renderExplorer(store, 'A');
      act(() => store.open());
      await screen.findByText('Open', {}, SLOW);
      const goodCount = screen.getAllByRole('img').length;

      const input = screen.getByRole('textbox', { name: 'Chord' });
      act(() => fireEvent.change(input, { target: { value: 'zzz' } }));

      // It says the symbol is not a chord, and keeps the last good shapes (dimmed)
      // rather than emptying — the diagrams are still on screen.
      await screen.findByText(/is not a chord this app can read/, {}, SLOW);
      expect(screen.getAllByRole('img').length).toBe(goodCount);
    } finally {
      await remote.stop();
    }
  });
});

// The header chrome around the explorer (shell.header_chrome): on wide the search
// rail is headed by the wordmark and the chip and the app bar carries none — one
// chip per screen, reachable above both scrollers (Decision 7); on narrow the
// chip sits in the app bar. Pins workflow 16 L29-31 (as amended) and L154-156.
describe('the chord explorer header chrome (behavior)', () => {
  const chips = () => screen.getAllByRole('button', { name: /, change instrument$/ });

  it('wide: the rail head carries Estante and the chip, the app bar none, axe clean', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedRemote(remote, instrumentSeed('g1', { catalogId: '6guitar', tuning: GUITAR_TUNING, fretCount: 22 }));
      const { store } = await makeSeededWorker(remote, 'wide-head');
      const { container } = renderExplorer(store, 'A', { mode: 'wide' });
      act(() => store.open());
      await screen.findByText('Open', {}, SLOW);

      const head = container.querySelector('.explorer-side .rail-head');
      expect(head).toHaveTextContent(/^Estante/);
      await waitFor(() => expect(within(head).getByRole('button', { name: 'Guitar, change instrument' })).toBeInTheDocument());
      expect(within(container.querySelector('.pane.main .appbar')).queryByRole('button', { name: /change instrument/ })).toBeNull();
      expect(chips()).toHaveLength(1);

      expect(await checkWcag21aa(document.body)).toHaveNoViolations();
    } finally {
      await remote.stop();
    }
  }, HEAVY);

  it('narrow: the chip sits in the app bar', async () => {
    const remote = await startGitHttpRemote();
    try {
      await seedRemote(remote, instrumentSeed('g1', { catalogId: '6guitar', tuning: GUITAR_TUNING, fretCount: 22 }));
      const { store } = await makeSeededWorker(remote, 'narrow-head');
      const { container } = renderExplorer(store, 'A');
      act(() => store.open());
      await screen.findByText('Open', {}, SLOW);

      const appbar = container.querySelector('.appbar');
      await waitFor(() => expect(within(appbar).getByRole('button', { name: 'Guitar, change instrument' })).toBeInTheDocument());
      expect(container.querySelector('.wordmark')).toBeNull();
      expect(chips()).toHaveLength(1);
    } finally {
      await remote.stop();
    }
  }, HEAVY);
});
