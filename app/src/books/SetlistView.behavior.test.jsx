// behavior — the setlist surface (books.setlists) with its real collaborators
// (RAC, i18n, the loopback store) under jsdom, plus an axe check of every state
// and overlay. Pins workflow 12 §Building one (reorder, key/note, add, remove,
// save), §Songs from another book (the Add-to-setlist copy path), §Songs moved
// L83-85 (a missing item, its notice and the repoint), and the W12 board copy.
// Keyboard reorder is pinned here (jsdom drives keys); pointer drag is pinned at
// e2e (Decision 4). All setlist/song text is written for this test.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent, waitFor, within } from '@testing-library/react';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import SetlistView from './SetlistView.jsx';
import AddToSetlist from './AddToSetlist.jsx';

function installMatchMedia(matches) {
  globalThis.matchMedia = (query) => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

beforeEach(() => {
  installMatchMedia(false);
  setLocale('en');
});
afterEach(() => {
  delete globalThis.matchMedia;
  vi.restoreAllMocks();
});

const BOOK = 'band';
const SETLIST_PATH = 'bar-do-ze.setlist.md';
const SETLIST_TEXT = [
  '# Bar do Zé',
  '',
  '1. [Garota de Ipanema](bossa/garota.cifra.md)',
  '   - key: D',
  '2. [Corcovado](bossa/corcovado.cifra.md)',
  '   - note: start from the B section',
  '3. [Asa Branca](choro/asa-branca.cifra.md)',
  '',
].join('\n');

// A book file set where asa-branca is absent → item 3 is missing.
const ENTRIES = [
  { path: SETLIST_PATH, status: null },
  { path: 'bossa/garota.cifra.md', status: null },
  { path: 'bossa/corcovado.cifra.md', status: null },
  { path: 'forro/asa-branca.cifra.md', status: null }, // a candidate to repoint to
];

const RESULTS = [
  { bookId: BOOK, path: 'forro/asa-branca.cifra.md', title: 'Asa Branca' },
  { bookId: BOOK, path: 'mpb/tarde-clara.cifra.md', title: 'Tarde Clara' },
];

function makeStore({ text = SETLIST_TEXT, entries = ENTRIES, results = RESULTS, setlists = [], shelf = null } = {}) {
  const commands = [];
  let current = text;
  const treeEntries = [...entries];
  const endpoint = createLoopbackEndpoint((port) => ({
    handle(message) {
      commands.push(message);
      const p = message.payload ?? {};
      switch (message.kind) {
        case CommandKind.OPEN_SOURCE:
          port.postMessage(event(EventKind.SOURCE, { bookId: p.bookId, path: p.path, text: current }));
          break;
        case CommandKind.BOOK_TREE:
          port.postMessage(event(EventKind.TREE, { bookId: p.bookId, entries: treeEntries }));
          break;
        case CommandKind.SEARCH:
          port.postMessage(event(EventKind.SEARCH_RESULTS, { query: p.query, results }));
          break;
        case CommandKind.WRITE:
          current = p.text;
          break;
        case CommandKind.SAVE:
          port.postMessage(event(EventKind.SAVED, { bookId: p.bookId, commit: 'c1', pushed: false }));
          break;
        case CommandKind.DISCARD:
          port.postMessage(event(EventKind.DISCARDED, { bookId: p.bookId, paths: p.paths }));
          break;
        case CommandKind.LIST_SETLISTS:
          port.postMessage(event(EventKind.SETLISTS, { setlists }));
          break;
        case CommandKind.ADD_TO_SETLIST:
          port.postMessage(event(EventKind.SETLIST_UPDATED, {
            bookId: p.targetBookId,
            setlistPath: p.setlistPath,
            path: p.song?.path,
            copied: p.song?.bookId !== p.targetBookId,
          }));
          break;
        default:
          break;
      }
    },
  }));
  const store = createStore(endpoint);
  if (shelf) act(() => endpoint.onmessage({ data: event(EventKind.SHELF, shelf) }));
  return { store, commands, getText: () => current };
}

const lastWrite = (commands) =>
  [...commands].reverse().find((c) => c.kind === CommandKind.WRITE)?.payload.text;

function renderSetlist(store, props = {}) {
  return render(
    <ThemeRoot store={store}>
      <SetlistView store={store} bookId={BOOK} path={SETLIST_PATH} mode="wide" {...props} />
    </ThemeRoot>,
  );
}

describe('SetlistView — open (read view)', () => {
  it('shows the songs in order with their key badge, note and a missing item', async () => {
    const { store } = makeStore();
    const { container } = renderSetlist(store);
    await screen.findByText('Garota de Ipanema');

    const names = [...container.querySelectorAll('.setlist-screen .list .name')].map(
      (n) => n.textContent,
    );
    expect(names).toEqual(['Garota de Ipanema', 'Corcovado', 'Asa Branca']);

    expect(screen.getByText('in D')).toBeInTheDocument();
    expect(screen.getByText('start from the B section')).toBeInTheDocument();
    expect(screen.getAllByText('missing').length).toBeGreaterThan(0);
    // The missing notice names the song and its path, and offers a repoint.
    expect(screen.getByText(/Asa Branca is missing\./)).toBeInTheDocument();
    expect(screen.getByText(/Nothing is at choro\/asa-branca\.cifra\.md/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Point it at a song' })).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('raises the Play seam', async () => {
    const onPlay = vi.fn();
    const { store } = makeStore();
    renderSetlist(store, { onPlay });
    const play = await screen.findByRole('button', { name: 'Play' });
    await act(async () => fireEvent.click(play));
    expect(onPlay).toHaveBeenCalledWith({ bookId: BOOK, path: SETLIST_PATH });
  });
});

describe('SetlistView — editor', () => {
  async function openEditor(store) {
    renderSetlist(store);
    await screen.findByText('Garota de Ipanema');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Edit' })));
    await screen.findByRole('grid', { name: 'Songs · drag to reorder' });
  }

  it('edits an item key and note, writing canonical unsaved text', async () => {
    const { store, commands, getText } = makeStore();
    await openEditor(store);

    const corcovadoKey = screen.getByRole('textbox', { name: 'Key for Corcovado' });
    await act(async () => fireEvent.change(corcovadoKey, { target: { value: 'A' } }));
    await waitFor(() => expect(lastWrite(commands)).toContain('key: A'));

    const garotaNote = screen.getByRole('textbox', { name: 'Note for Garota de Ipanema' });
    await act(async () => fireEvent.change(garotaNote, { target: { value: 'capo 2' } }));
    await waitFor(() => expect(lastWrite(commands)).toContain('note: capo 2'));
    expect(getText()).toContain('note: capo 2');
  });

  it('removes an item', async () => {
    const { store, commands } = makeStore();
    await openEditor(store);
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Remove Corcovado from setlist' })),
    );
    await waitFor(() => {
      const text = lastWrite(commands);
      expect(text).toBeDefined();
      expect(text).not.toContain('Corcovado');
    });
  });

  it('adds a song from the in-book search', async () => {
    const { store, commands } = makeStore();
    await openEditor(store);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add song' })));

    const searchField = await screen.findByRole('searchbox', { name: 'Search for a song' });
    await act(async () => fireEvent.change(searchField, { target: { value: 'tarde' } }));
    const pick = await screen.findByRole('button', { name: /Tarde Clara/ });
    await act(async () => fireEvent.click(pick));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add' })));

    await waitFor(() => expect(lastWrite(commands)).toContain('mpb/tarde-clara.cifra.md'));
  });

  it('points a missing item at a song via the in-book search (pointItemAtSong)', async () => {
    const { store, commands, getText } = makeStore();
    await openEditor(store);
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Point it at a song' })),
    );
    const searchField = await screen.findByRole('searchbox', { name: 'Search for a song' });
    await act(async () => fireEvent.change(searchField, { target: { value: 'asa' } }));
    // Scope to the repoint result (its name carries the path), not the row's
    // "Remove Asa Branca" button.
    const pick = await screen.findByRole('button', { name: /forro\/asa-branca\.cifra\.md/ });
    await act(async () => fireEvent.click(pick));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Point here' })));

    await waitFor(() => expect(getText()).toContain('forro/asa-branca.cifra.md'));
    // The old broken link is gone.
    expect(getText()).not.toContain('choro/asa-branca.cifra.md');
    expect(lastWrite(commands)).toContain('forro/asa-branca.cifra.md');
  });

  it('reorders by keyboard (RAC drag-and-drop)', async () => {
    const { store, getText } = makeStore();
    await openEditor(store);

    const handles = screen.getAllByRole('button', { name: 'Drag to reorder' });
    const first = handles[0];
    await act(async () => {
      first.focus();
      fireEvent.keyDown(first, { key: 'Enter' });
      fireEvent.keyUp(first, { key: 'Enter' });
    });
    // Move the pick-up down past the second item and drop.
    await act(async () => {
      fireEvent.keyDown(document.activeElement, { key: 'ArrowDown' });
      fireEvent.keyUp(document.activeElement, { key: 'ArrowDown' });
    });
    await act(async () => {
      fireEvent.keyDown(document.activeElement, { key: 'Enter' });
      fireEvent.keyUp(document.activeElement, { key: 'Enter' });
    });

    await waitFor(() => {
      const text = getText();
      expect(text.indexOf('Corcovado')).toBeLessThan(text.indexOf('Garota de Ipanema'));
    });
  });

  it('shows the unsaved word after an edit, which Save clears', async () => {
    const { store } = makeStore();
    await openEditor(store);
    await act(async () =>
      fireEvent.change(screen.getByRole('textbox', { name: 'Key for Corcovado' }), {
        target: { value: 'A' },
      }),
    );
    expect(await screen.findByText('unsaved changes')).toBeInTheDocument();

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    await waitFor(() => expect(screen.queryByText('unsaved changes')).not.toBeInTheDocument());
  });

  it('is axe-clean in the editor with the repoint panel open', async () => {
    const { store } = makeStore();
    renderSetlist(store);
    await screen.findByText('Garota de Ipanema');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Edit' })));
    await act(async () =>
      fireEvent.click(screen.getByRole('button', { name: 'Point it at a song' })),
    );
    const { container } = renderSetlist(store);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

describe('AddToSetlist dialog', () => {
  const SHELF = {
    local: {
      band: { title: { value: 'Banda do Bairro' }, position: { value: 1 } },
      ana: { title: { value: 'Choros da Ana' }, position: { value: 2 } },
    },
  };
  const SETLISTS = [
    { bookId: 'band', path: 'gigs/bar-do-ze.setlist.md', title: 'Bar do Zé, 10 October', count: 5 },
    { bookId: 'ana', path: 'aula.setlist.md', title: 'Aula de terça', count: 4 },
  ];

  function renderDialog(song) {
    const made = makeStore({ setlists: SETLISTS, shelf: SHELF });
    const onClose = vi.fn();
    const result = render(
      <ThemeRoot store={made.store}>
        <AddToSetlist store={made.store} song={song} onClose={onClose} />
      </ThemeRoot>,
    );
    return { ...made, onClose, ...result };
  }

  it('adds, same-book, with no copy notice (Add)', async () => {
    const { commands } = renderDialog({ bookId: 'band', path: 'bossa/garota.cifra.md', title: 'Garota' });
    await screen.findByRole('button', { name: /Bar do Zé, 10 October/ });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Bar do Zé, 10 October/ })));
    expect(screen.queryByText(/will be copied into/)).not.toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Add' })));
    const add = commands.find((c) => c.kind === CommandKind.ADD_TO_SETLIST);
    expect(add.payload).toMatchObject({
      targetBookId: 'band',
      setlistPath: 'gigs/bar-do-ze.setlist.md',
      song: { bookId: 'band', path: 'bossa/garota.cifra.md' },
    });
    expect(add.payload.newTitle).toBeUndefined();
  });

  it('copies a song from another book (Copy and add + notice)', async () => {
    const { commands, container } = renderDialog({
      bookId: 'ana',
      path: 'choro/chuva.cifra.md',
      title: 'Chuva no Telhado',
    });
    await screen.findByRole('button', { name: /Bar do Zé, 10 October/ });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: /Bar do Zé, 10 October/ })));
    expect(screen.getByText(/This song will be copied into Banda do Bairro first\./)).toBeInTheDocument();
    // W12 tablet #3 L134-151: the Dialog carries the column-and-gap layout
    // class, and holds heading, list, notice, line and actions in the board's
    // order (jsdom has no layout; the gap itself is measured at e2e).
    const dialog = screen.getByRole('dialog', { name: 'Add to setlist' });
    expect(dialog).toHaveClass('setlist-dialog-body');
    const parts = Array.from(dialog.children);
    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe(screen.getByRole('heading', { name: 'Add to setlist' }));
    expect(parts[1]).toBe(within(dialog).getByRole('group', { name: 'Add to setlist' }));
    expect(parts[2]).toHaveClass('notice', 'setlist-copy-notice');
    expect(parts[3].tagName).toBe('P');
    expect(parts[4]).toHaveClass('actions');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy and add' })));
    const add = commands.find((c) => c.kind === CommandKind.ADD_TO_SETLIST);
    expect(add.payload).toMatchObject({ targetBookId: 'band', song: { bookId: 'ana' } });
  });

  it('creates a new setlist (New setlist…)', async () => {
    const { commands, container } = renderDialog({ bookId: 'band', path: 'bossa/garota.cifra.md', title: 'Garota' });
    await screen.findByRole('button', { name: 'New setlist…' });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'New setlist…' })));
    const nameField = await screen.findByRole('textbox', { name: 'Setlist name' });
    // W12 tablet #3: the form spaces its heading, field and actions.
    expect(nameField.closest('form')).toHaveClass('setlist-name-form');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    await act(async () => fireEvent.change(nameField, { target: { value: 'Sábado à noite' } }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create' })));
    const add = commands.find((c) => c.kind === CommandKind.ADD_TO_SETLIST);
    expect(add.payload).toMatchObject({ targetBookId: 'band', newTitle: 'Sábado à noite' });
    expect(add.payload.setlistPath).toBe('sabado-a-noite.setlist.md');
  });
});
