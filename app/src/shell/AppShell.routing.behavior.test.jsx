import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor, within } from '@testing-library/react';
import { createStore } from '../worker/store.js';
import { command, event, EventKind, CommandKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { instrumentInstance, configFor } from '../core/instrument.js';
import { WIDE_QUERY, READING_ACTIONS_WIDE_QUERY } from './layout-mode.js';
import AppShell from './AppShell.jsx';

// behavior (shell.routing) — the URL follows where you are: AppShell with its
// real screens over a synchronous fake Worker port, in jsdom's real History.
// Pins DIRECTION §3.7 "The address follows where you are", workflow 7 §Links to
// books, workflow 1 §Invited.

// CodeMirror (the editor layer) measures text through Range rects jsdom lacks.
Range.prototype.getClientRects = function getClientRects() {
  return [];
};
Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
};

const AT = '2026-10-15T00:00:00.000Z';
const BOOK = 'b1';
const BOOK_LABEL = 'Banda do Bairro';
const SONG_PATH = 'choro/tarde-clara.cifra.md';
const SONG_TITLE = 'Tarde Clara';
const SONG_URL = '/b/b1/choro/tarde-clara.cifra.md';
const SETLIST_PATH = 'sabado.setlist.md';
const FENCE = '```';
const SONG_TEXT = [`# ${SONG_TITLE}`, '', '## Verse', FENCE, 'G  C | Am  D', FENCE, ''].join('\n');
const SETLIST_TEXT = ['# Sábado no bar', '', `1. [${SONG_TITLE}](${SONG_PATH})`, ''].join('\n');

const SHELF = {
  books: {
    [BOOK]: {
      label: { value: BOOK_LABEL, at: AT },
      role: { value: 'editor', at: AT },
      position: { value: 1, at: AT },
    },
  },
  local: {},
};
const ENTRIES = [
  { path: SONG_PATH, status: null },
  { path: SETLIST_PATH, status: null },
];
// A second song, for the steps reached past another song.
const OTHER_PATH = 'choro/noite-alta.cifra.md';
const OTHER_TITLE = 'Noite Alta';
const OTHER_URL = '/b/b1/choro/noite-alta.cifra.md';
const OTHER_TEXT = [`# ${OTHER_TITLE}`, '', '## Verse', FENCE, 'D  G | Em  A', FENCE, ''].join('\n');

// The guitar in use, so the wizard over arrange has its policies.
const GUITAR_TUNING = 'E2 A2 D3 G3 B3 E4';
function guitarEntry() {
  const inst = instrumentInstance({ catalogId: '6guitar', strings: GUITAR_TUNING, fretCount: 22 });
  return {
    id: 'g1',
    catalogId: '6guitar',
    label: 'Guitar',
    tuning: GUITAR_TUNING,
    fretCount: 22,
    config: configFor(inst, 'strumming'),
    shapes: [],
  };
}

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

// Wait for the popstate a history traversal fires (jsdom fires it on a task).
async function traverse(go) {
  await act(async () => {
    const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    go();
    await popped;
  });
}

function openSongFromSearch(emit) {
  emit(event(EventKind.SHELF, SHELF));
  act(() => {
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'tarde' } });
  });
  emit(
    event(EventKind.SEARCH_RESULTS, {
      query: 'tarde',
      results: [{ bookId: BOOK, path: SONG_PATH, title: SONG_TITLE, artist: '', score: 3, unsaved: false }],
    }),
  );
  fireEvent.click(screen.getAllByRole('button', { name: new RegExp(SONG_TITLE) })[0]);
  emit(event(EventKind.SOURCE, { bookId: BOOK, path: SONG_PATH, text: SONG_TEXT }));
}

beforeEach(() => {
  history.replaceState(null, '', '/');
  // The rename record lives in sessionStorage (book-renames.js); no case's
  // record leaks into the next.
  sessionStorage.clear();
  globalThis.matchMedia = (media) => ({
    media,
    matches: media === WIDE_QUERY ? false : false,
    addEventListener() {},
    removeEventListener() {},
  });
});

afterEach(() => {
  cleanup();
  delete globalThis.matchMedia;
});

describe('AppShell routing (behavior)', () => {
  it('opening a song pushes its address', () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    const before = history.length;
    openSongFromSearch(emit);
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();
    expect(location.pathname).toBe(SONG_URL);
    expect(history.length).toBe(before + 1);
  });

  it('back returns to the place before', async () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    openSongFromSearch(emit);
    await traverse(() => history.back());
    expect(screen.queryByRole('group', { name: SONG_TITLE })).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(location.pathname).toBe('/');
  });

  it('the in-app Back walks history', async () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    openSongFromSearch(emit);
    const depth = history.state.depth;
    await traverse(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    expect(location.pathname).toBe('/');
    expect(history.state.depth).toBe(depth - 1);
    expect(screen.queryByRole('group', { name: SONG_TITLE })).not.toBeInTheDocument();
  });

  it('switching tabs replaces, not pushes', () => {
    const { store } = makeStore();
    render(<AppShell store={store} />);
    const before = history.length;
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));
    expect(location.pathname).toBe('/books');
    expect(history.length).toBe(before);
    fireEvent.click(screen.getByRole('tab', { name: 'Setlists' }));
    expect(location.pathname).toBe('/setlists');
    expect(history.length).toBe(before);
  });

  it('a layer is a history step with the same address', async () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    openSongFromSearch(emit);
    const before = history.length;
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(location.pathname).toBe(SONG_URL);
    expect(history.length).toBe(before + 1);
    expect(history.state.layers).toEqual(['editor']);

    await traverse(() => history.back());
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();
    expect(location.pathname).toBe(SONG_URL);
  });

  // songs.show_the_file — the reading view's *Show the file* (workflow 14 §The
  // view L132-135) opens the file view as a layer over the song.
  const showTheFile = () => {
    fireEvent.click(screen.getAllByRole('button', { name: 'More' })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Show the file' }));
  };
  const MOVED_PATH = 'choro/tarde-clara-2.cifra.md';
  const MOVED_URL = '/b/b1/choro/tarde-clara-2.cifra.md';

  it('show the file is a layer over the song; back returns to the song (Constraint 4; books.file_view Decision 7)', async () => {
    const { store, sent, emit } = makeStore();
    render(<AppShell store={store} />);
    openSongFromSearch(emit);
    const before = history.length;
    showTheFile();
    // The file view, at the song's file: on a phone, its file pane.
    expect(screen.queryByRole('group', { name: SONG_TITLE })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to files' })).toBeInTheDocument();
    expect(sent.some((m) => m.kind === CommandKind.OPEN_SOURCE && m.payload.path === SONG_PATH)).toBe(true);
    // A history step with the same address.
    expect(location.pathname).toBe(SONG_URL);
    expect(history.length).toBe(before + 1);
    expect(history.state.layers).toEqual(['files']);
    // The tree, the song's row marked; the in-app Back returns to the song.
    fireEvent.click(screen.getByRole('button', { name: 'Back to files' }));
    emit(event(EventKind.TREE, { bookId: BOOK, entries: ENTRIES }));
    const tree = screen.getByRole('group', { name: `Files in ${BOOK_LABEL}` });
    expect(within(tree).getByRole('button', { name: /tarde-clara\.cifra\.md/ })).toHaveAttribute('aria-pressed', 'true');
    await traverse(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();
    expect(location.pathname).toBe(SONG_URL);
    expect(history.state.layers).toEqual([]);

    // And the browser's back does the same.
    showTheFile();
    expect(history.state.layers).toEqual(['files']);
    await traverse(() => history.back());
    expect(screen.queryByRole('button', { name: 'Back to files' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();
    expect(location.pathname).toBe(SONG_URL);
  });

  it('a song moved in the file view opened from it follows the move (Constraint 6)', async () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    openSongFromSearch(emit);
    showTheFile();
    emit(event(EventKind.FILE_MOVED, { bookId: BOOK, fromPath: SONG_PATH, toPath: MOVED_PATH }));
    // The address names where the song is now, still under the file view.
    expect(location.pathname).toBe(MOVED_URL);
    expect(history.state.layers).toEqual(['files']);
    await traverse(() => history.back());
    // Back: the reading view of the song at its new path.
    expect(location.pathname).toBe(MOVED_URL);
    expect(history.state.layers).toEqual([]);
    expect(screen.queryByText(/isn.t here|not here/i)).toBeNull();
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: MOVED_PATH, text: SONG_TEXT }));
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();
  });

  it('a song deleted in the file view opened from it closes; back lands on the destination (Constraint 6)', async () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    openSongFromSearch(emit);
    showTheFile();
    emit(event(EventKind.FILE_DELETED, { bookId: BOOK, path: SONG_PATH }));
    expect(history.state.layers).toEqual(['files']);
    await traverse(() => history.back());
    // Back: the destination underneath, no song open.
    expect(location.pathname).toBe('/');
    expect(screen.queryByRole('group', { name: SONG_TITLE })).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('show the file on a book needing you opens its conflicts (Constraint 5; workflow 9)', () => {
    const { store, sent, emit } = makeStore();
    render(<AppShell store={store} />);
    openSongFromSearch(emit);
    emit(event(EventKind.SYNC, { bookId: BOOK, phase: 'needs_you', at: AT }));
    showTheFile();
    expect(sent.some((m) => m.kind === CommandKind.OPEN_CONFLICTS && m.payload.bookId === BOOK)).toBe(true);
    expect(history.state.layers).toEqual(['conflicts']);
    expect(screen.queryByRole('button', { name: 'Back to files' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: `Files in ${BOOK_LABEL}` })).not.toBeInTheDocument();
  });

  it('forward does not reopen a closed layer', async () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    openSongFromSearch(emit);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await traverse(() => history.back());
    await traverse(() => history.forward());
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();
    expect(location.pathname).toBe(SONG_URL);
    expect(history.state.layers).toEqual([]);
  });

  it('back after a reload under a layer leaves the song, not a dead step', async () => {
    const first = makeStore();
    render(<AppShell store={first.store} />);
    openSongFromSearch(first.emit);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(history.state.layers).toEqual(['editor']);

    // A reload keeps the address and drops the layer: the song is shown again.
    cleanup();
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.TREE, { bookId: BOOK, entries: ENTRIES }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: SONG_PATH, text: SONG_TEXT }));
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();

    // The entry below the reloaded one is the same song with no layer; Back
    // walks past it to search.
    await traverse(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    await waitFor(() => expect(location.pathname).toBe('/'));
    expect(screen.queryByRole('group', { name: SONG_TITLE })).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  // shell.routing_reload_scope_step — after a reload only the entries that are
  // the same place, naming only layers the reload dropped, are passed over
  // (DIRECTION §3.7 "The address follows where you are"; workflow 2 §Scope).
  it('back after a reload keeps a scope-only step', async () => {
    // The entries a previous page left: the song opened from unscoped search,
    // then the same song in the book's scope under the editor (the same
    // address). Seeding history stands for entries written before the load.
    history.replaceState({ place: { tab: 'search' }, layers: [], depth: 0 }, '', '/');
    const song = { bookId: BOOK, path: SONG_PATH };
    history.pushState({ place: { tab: 'search', song }, layers: [], depth: 1 }, '', SONG_URL);
    history.pushState({ place: { tab: 'search', book: BOOK, song }, layers: ['editor'], depth: 2 }, '', SONG_URL);

    // The reload lands on the second.
    const { store, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.TREE, { bookId: BOOK, entries: ENTRIES }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: SONG_PATH, text: SONG_TEXT }));
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();
    expect(history.state.depth).toBe(2);

    // Back lands on the scope-only step: the song stays, at its address.
    await traverse(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();
    expect(location.pathname).toBe(SONG_URL);
    expect(history.state.depth).toBe(1);
    // The shell's scope followed the entry: the hook writes what the shell
    // shows, and the place it shows names no book.
    expect(history.state.place.book).toBeUndefined();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // And the book's scope chip is gone when the song closes onto search.
    await traverse(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    expect(location.pathname).toBe('/');
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clear filter' })).not.toBeInTheDocument();
  });

  it('back after a reload under arrange and the wizard leaves the song', async () => {
    const first = makeStore();
    render(<AppShell store={first.store} />);
    openSongFromSearch(first.emit);
    const guitar = guitarEntry();
    first.emit(event(EventKind.INSTRUMENTS, { instruments: [guitar], inUseId: guitar.id, standard: guitar }));
    fireEvent.click(screen.getByRole('button', { name: 'Arrange' }));
    expect(history.state.layers).toEqual(['arrange']);
    fireEvent.click(screen.getByRole('button', { name: 'Run the wizard' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'The smoothest path' })).toBeInTheDocument());
    expect(history.state.layers).toEqual(['wizard', 'arrange']);

    // A reload keeps the address and drops both layers.
    cleanup();
    const { store, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.TREE, { bookId: BOOK, entries: ENTRIES }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: SONG_PATH, text: SONG_TEXT }));
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();

    // Both the arrange-only entry and the bare song entry are passed over.
    await traverse(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    await waitFor(() => expect(location.pathname).toBe('/'));
    expect(screen.queryByRole('group', { name: SONG_TITLE })).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('after a reload, a same-song step reached past another song is real', async () => {
    // The computer layout: the search beside the song opens another song (a
    // push). The tablet reads without the rail (songs.reading_chrome Decision 1).
    globalThis.matchMedia = (media) => ({
      media,
      matches: media === WIDE_QUERY || media === READING_ACTIONS_WIDE_QUERY,
      addEventListener() {},
      removeEventListener() {},
    });
    const results = [
      { bookId: BOOK, path: SONG_PATH, title: SONG_TITLE, artist: '', score: 3, unsaved: false },
      { bookId: BOOK, path: OTHER_PATH, title: OTHER_TITLE, artist: '', score: 2, unsaved: false },
    ];
    const entries = [...ENTRIES, { path: OTHER_PATH, status: null }];
    const first = makeStore();
    render(<AppShell store={first.store} />);
    first.emit(event(EventKind.SHELF, SHELF));
    const openFromSearch = (title, path, text) => {
      act(() => {
        fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'a' } });
      });
      first.emit(event(EventKind.SEARCH_RESULTS, { query: 'a', results }));
      fireEvent.click(screen.getAllByRole('button', { name: new RegExp(title) })[0]);
      first.emit(event(EventKind.SOURCE, { bookId: BOOK, path, text }));
    };
    // S, then T, then S again, then the editor over S.
    openFromSearch(SONG_TITLE, SONG_PATH, SONG_TEXT);
    openFromSearch(OTHER_TITLE, OTHER_PATH, OTHER_TEXT);
    expect(location.pathname).toBe(OTHER_URL);
    openFromSearch(SONG_TITLE, SONG_PATH, SONG_TEXT);
    expect(location.pathname).toBe(SONG_URL);
    expect(history.state.depth).toBe(3);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(history.state.layers).toEqual(['editor']);

    cleanup();
    const { store, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.TREE, { bookId: BOOK, entries }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: SONG_PATH, text: SONG_TEXT }));
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();

    // Back passes over the bare S below the editor and lands on T.
    await traverse(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    await waitFor(() => expect(location.pathname).toBe(OTHER_URL));
    emit(event(EventKind.TREE, { bookId: BOOK, entries }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: OTHER_PATH, text: OTHER_TEXT }));
    await waitFor(() => expect(screen.getByRole('group', { name: OTHER_TITLE })).toBeInTheDocument());

    // The reload's record is spent: the earlier S is a real step.
    await traverse(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: SONG_PATH, text: SONG_TEXT }));
    await waitFor(() => expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument());
    expect(location.pathname).toBe(SONG_URL);
    expect(history.state.depth).toBe(1);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a deep URL opens its screen — a song, with its book as the scope', async () => {
    history.replaceState(null, '', SONG_URL);
    const { store, sent, emit } = makeStore();
    render(<AppShell store={store} />);
    // Resolving: nothing opens before the shelf and the tree say it is here.
    // The destination shows meanwhile, marked busy.
    expect(screen.queryByRole('group', { name: SONG_TITLE })).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
    emit(event(EventKind.SHELF, SHELF));
    expect(sent).toContainEqual(command(CommandKind.BOOK_TREE, { bookId: BOOK }));
    emit(event(EventKind.TREE, { bookId: BOOK, entries: ENTRIES }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: SONG_PATH, text: SONG_TEXT }));
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();
    expect(location.pathname).toBe(SONG_URL);
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();

    // Its Back lands on the book's songs (workflow 2 §Scope): search, scoped.
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(location.pathname).toBe('/b/b1');
    expect(screen.getByRole('button', { name: 'Clear filter' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Search songs, words and chords' })).toHaveTextContent(BOOK_LABEL);
  });

  it('a deep URL opens its screen — a setlist', () => {
    history.replaceState(null, '', `/b/b1/${SETLIST_PATH}`);
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.TREE, { bookId: BOOK, entries: ENTRIES }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: SETLIST_PATH, text: SETLIST_TEXT }));
    expect(screen.getByRole('heading', { level: 2, name: 'Sábado no bar' })).toBeInTheDocument();
    expect(location.pathname).toBe(`/b/b1/${SETLIST_PATH}`);
  });

  it("a deep URL opens its screen — a book's songs", () => {
    history.replaceState(null, '', '/b/b1');
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, SHELF));
    expect(screen.getByRole('button', { name: 'Clear filter' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Search songs, words and chords' })).toHaveTextContent(BOOK_LABEL);
    expect(location.pathname).toBe('/b/b1');
  });

  it('a fork or put-online follows the address', () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    openSongFromSearch(emit);
    const before = history.length;
    emit(event(EventKind.BOOK_FORKED, { previousBookId: BOOK, bookId: 'fork-1', via: 'service' }));
    expect(location.pathname).toBe('/b/fork-1/choro/tarde-clara.cifra.md');
    emit(event(EventKind.BOOK_ONLINE, { previousBookId: 'fork-1', bookId: 'sr_online' }));
    expect(location.pathname).toBe('/b/sr_online/choro/tarde-clara.cifra.md');
    expect(history.length).toBe(before);
  });

  it('back after a fork lands on the fork, not the book it left', async () => {
    history.replaceState(null, '', '/b/b1');
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    openSongFromSearch(emit);
    expect(location.pathname).toBe(SONG_URL);
    emit(event(EventKind.BOOK_FORKED, { previousBookId: BOOK, bookId: 'fork-1', via: 'service' }));
    // The device's copy now lives under the fork's id only.
    emit(event(EventKind.SHELF, { ...SHELF, books: { 'fork-1': SHELF.books[BOOK] } }));
    await traverse(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    expect(location.pathname).toBe('/b/fork-1');
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /doesn’t open a book/ })).not.toBeInTheDocument();
  });

  // shell.routing_rename_across_reload — the rename record outlives a reload
  // (DIRECTION §3.7 "The address follows where you are"; workflow 7 §Links to
  // books L45–48). The reload: cleanup() and a fresh AppShell on a fresh store,
  // keeping jsdom's location, history and sessionStorage.
  async function backAfterRenameAndReload(renameEvent, newId, goBack) {
    history.replaceState(null, '', '/b/b1');
    const first = makeStore();
    render(<AppShell store={first.store} />);
    openSongFromSearch(first.emit);
    expect(location.pathname).toBe(SONG_URL);
    first.emit(event(renameEvent, { previousBookId: BOOK, bookId: newId, via: 'service' }));
    expect(location.pathname).toBe(`/b/${newId}/${SONG_PATH}`);
    cleanup();

    const { store, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);
    // The device's copy now lives under the new id only.
    emit(event(EventKind.SHELF, { ...SHELF, books: { [newId]: SHELF.books[BOOK] } }));
    emit(event(EventKind.TREE, { bookId: newId, entries: ENTRIES }));
    emit(event(EventKind.SOURCE, { bookId: newId, path: SONG_PATH, text: SONG_TEXT }));
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();

    await traverse(goBack);
    expect(location.pathname).toBe(`/b/${newId}`);
    expect(history.state.place.book).toBe(newId);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Search songs, words and chords' })).toHaveTextContent(BOOK_LABEL);
    expect(screen.queryByRole('heading', { name: /doesn’t open a book/ })).not.toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  }

  it('back after a fork and a reload lands on the fork, not not-here', async () => {
    await backAfterRenameAndReload(EventKind.BOOK_FORKED, 'fork-1', () =>
      fireEvent.click(screen.getByRole('button', { name: 'Back' })),
    );
  });

  it('back after a put-online and a reload lands on the new id', async () => {
    // routing.md Decision 8: BOOK_ONLINE follows like a fork; the system back.
    await backAfterRenameAndReload(EventKind.BOOK_ONLINE, 'sr_online', () => history.back());
  });

  it('an invitation link ends on the song address', () => {
    // App.jsx captures the token and the `#<path>` anchor at boot; the shell
    // gets them as props, with the URL still on the invitation.
    history.replaceState(null, '', `/i/tok-secret#${SONG_PATH}`);
    const { store, emit } = makeStore();
    render(<AppShell store={store} inviteToken="tok-secret" inviteSongAnchor={SONG_PATH} />);
    expect(location.href).not.toContain('tok-secret');
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.BOOK_CLONED, { bookId: BOOK }));
    expect(location.pathname).toBe(SONG_URL);
    expect(location.href).not.toContain('tok-secret');
  });

  // books.invited_presentation — workflow 1 §Invited, the presentation
  // paragraph: a refusal is a dialog over the shelf, and dismissing it leaves
  // the person there. The modal aria-hides the shell, so the shell's tabs are
  // queried with `hidden: true` until it closes.
  function refusedOverShell() {
    history.replaceState(null, '', '/i/tok-dead');
    const { store, emit } = makeStore();
    const view = render(<AppShell store={store} inviteToken="tok-dead" />);
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.BOOK_REFUSED, { reason: 'dead' }));
    // The shell is rendered behind the dialog: its tab navigation is in the DOM.
    expect(screen.getAllByRole('tablist', { hidden: true }).length).toBeGreaterThan(0);
    const dialog = screen.getByRole('alertdialog', { name: 'This link doesn’t open a book' });
    // The invited screen's own heading is not rendered in the refused state.
    expect(screen.queryByRole('heading', { name: /invited to a book on Estante|Opening the invitation/, hidden: true })).toBeNull();
    return { ...view, dialog };
  }

  it('a refused invitation is a dialog over the shell; OK leaves it on Search', async () => {
    const { container, dialog } = refusedOverShell();
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'OK' })));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Search' })).toHaveAttribute('aria-selected', 'true');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a refused invitation’s “Add a book by its link” leaves the shell on Books', () => {
    const { dialog } = refusedOverShell();
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Add a book by its link' })));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Books' })).toHaveAttribute('aria-selected', 'true');
  });

  it('axe: the shell after a deep boot', async () => {
    history.replaceState(null, '', SONG_URL);
    const { store, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.TREE, { bookId: BOOK, entries: ENTRIES }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: SONG_PATH, text: SONG_TEXT }));
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

// behavior (books.setlist_chrome) — on a phone an open setlist sits in the
// Setlists tab panel with the tab bar below it and no wordmark row above (W12
// phone #1, L28-67, tab bar L62-66; header_chrome Decision 8); a destination tab
// leaves it and replaces the entry (routing Decision 4); tablet and computer are
// unchanged (W12 #3, #4). Reuses the setlist fixture of the deep-link case.
describe('AppShell setlist chrome on a phone (behavior)', () => {
  const SETLIST_TITLE = 'Sábado no bar';
  const SETLIST_URL = `/b/b1/${SETLIST_PATH}`;

  // Setlists tab → the listed setlist → its read view.
  function openSetlistFromDestination(emit, entries = ENTRIES) {
    emit(event(EventKind.SHELF, SHELF));
    fireEvent.click(screen.getByRole('tab', { name: 'Setlists' }));
    emit(
      event(EventKind.SETLISTS, {
        setlists: [{ bookId: BOOK, path: SETLIST_PATH, title: SETLIST_TITLE, count: 1 }],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(SETLIST_TITLE) }));
    emit(event(EventKind.TREE, { bookId: BOOK, entries }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: SETLIST_PATH, text: SETLIST_TEXT }));
    expect(screen.getByRole('heading', { level: 2, name: SETLIST_TITLE })).toBeInTheDocument();
  }

  it('narrow, a setlist opened from the Setlists destination keeps the tab bar, Setlists on, no wordmark row, axe-clean', async () => {
    const { store, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);
    openSetlistFromDestination(emit);
    expect(location.pathname).toBe(SETLIST_URL);

    const tablist = screen.getByRole('tablist', { name: 'Destinations' });
    expect(tablist).toHaveClass('tabbar');
    expect(within(tablist).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Search',
      'Books',
      'Setlists',
    ]);
    expect(screen.getByRole('tab', { name: 'Setlists' })).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel', { name: 'Setlists' });
    expect(within(panel).getByRole('heading', { level: 2, name: SETLIST_TITLE })).toBeInTheDocument();
    // The setlist's own app bar is the first row: no wordmark, no chip.
    expect(container.querySelector('.header-chrome')).toBeNull();
    expect(container.querySelector('.wordmark')).toBeNull();
    expect(screen.queryByRole('button', { name: /change instrument/ })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('narrow, the Search tab leaves the setlist and replaces the entry', () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    openSetlistFromDestination(emit);
    const before = history.length;
    fireEvent.click(screen.getByRole('tab', { name: 'Search' }));
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: SETLIST_TITLE })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Search' })).toHaveAttribute('aria-selected', 'true');
    expect(location.pathname).toBe('/');
    expect(history.length).toBe(before);
  });

  it('narrow, a setlist opened from search is on the Setlists tab; Back lands on Search', async () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, SHELF));
    act(() => {
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'sabado' } });
    });
    emit(
      event(EventKind.SEARCH_RESULTS, {
        query: 'sabado',
        results: [
          { bookId: BOOK, path: SETLIST_PATH, title: SETLIST_TITLE, kind: 'setlist', score: 3, unsaved: false },
        ],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(SETLIST_TITLE) }));
    emit(event(EventKind.TREE, { bookId: BOOK, entries: ENTRIES }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: SETLIST_PATH, text: SETLIST_TEXT }));
    const panel = screen.getByRole('tabpanel', { name: 'Setlists' });
    expect(within(panel).getByRole('heading', { level: 2, name: SETLIST_TITLE })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Setlists' })).toHaveAttribute('aria-selected', 'true');
    expect(location.pathname).toBe(SETLIST_URL);

    await traverse(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    expect(screen.queryByRole('heading', { level: 2, name: SETLIST_TITLE })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Search' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(location.pathname).toBe('/');
  });

  it('narrow, the editor keeps the tab bar', () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    // The setlist already carries an unsaved edit, so the editor offers Discard.
    openSetlistFromDestination(emit, [
      { path: SONG_PATH, status: null },
      { path: SETLIST_PATH, status: 'unsaved' },
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Discard' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: 'Destinations' })).toHaveClass('tabbar');
    expect(screen.getByRole('tab', { name: 'Setlists' })).toHaveAttribute('aria-selected', 'true');
  });

  it('wide, unchanged: an open setlist has no tab bar and no rail', () => {
    globalThis.matchMedia = (media) => ({
      media,
      matches: media === WIDE_QUERY,
      addEventListener() {},
      removeEventListener() {},
    });
    const { store, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);
    openSetlistFromDestination(emit);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(container.querySelector('.tabbar')).toBeNull();
    expect(container.querySelector('.rail')).toBeNull();
  });
});

// behavior (books.share_people; workflow 10 §Who sees whom **Where it sits**) —
// where each sharing surface sits by layout: on a phone *Share* on a book opens
// the sheet, whose Members row opens the people screen full-screen, and Back
// returns to the book; on a tablet or a computer *Share* opens the people
// screen; *Share* on a song is a panel beside the chart, the reading view still
// there and not aria-hidden. The sharing client's `fetch` is a loopback double.
describe('AppShell share surfaces (behavior)', () => {
  const OWNED = {
    books: {
      [BOOK]: {
        label: { value: BOOK_LABEL, at: AT },
        role: { value: 'owner', at: AT },
        position: { value: 1, at: AT },
      },
    },
    local: {},
  };
  const MEMBERS = {
    members: [
      { userId: '00000000-0000-4000-8000-000000000001', role: 'owner', displayName: 'Ana' },
      { userId: '00000000-0000-4000-8000-000000000002', role: 'reader', displayName: 'Bia Rocha' },
    ],
    count: 1,
    limit: 50,
  };
  let realFetch;
  beforeEach(() => {
    realFetch = globalThis.fetch;
    globalThis.fetch = async (path) => {
      const body = String(path).endsWith('/members') ? MEMBERS : { invitations: [] };
      return { ok: true, status: 200, json: async () => body };
    };
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const wide = (computer = false) => {
    globalThis.matchMedia = (media) => ({
      media,
      matches: media === WIDE_QUERY || (computer && media === READING_ACTIONS_WIDE_QUERY),
      addEventListener() {},
      removeEventListener() {},
    });
  };

  function openBookDetail(emit) {
    emit(event(EventKind.SHELF, OWNED));
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${BOOK_LABEL}`) }));
    fireEvent.click(screen.getByRole('button', { name: 'Share', exact: true }));
  }

  it('narrow: Share on a book opens the sheet; Members opens the people screen full-screen; Back returns to the book', async () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    openBookDetail(emit);

    const sheet = await screen.findByRole('dialog', { name: `Share ${BOOK_LABEL}` });
    fireEvent.click(await within(sheet).findByRole('button', { name: /^Members/ }));

    const people = await screen.findByRole('region', { name: `${BOOK_LABEL} · People` });
    expect(await within(people).findByText('Bia Rocha')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
    // A full screen: the shell is not shown beneath it.
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(history.state.layers).toEqual(['people']);

    await traverse(() => fireEvent.click(within(people).getByRole('button', { name: 'Back' })));
    expect(screen.queryByRole('region', { name: `${BOOK_LABEL} · People` })).toBeNull();
    // Back on the book that was open, its Share still there.
    expect(screen.getByRole('button', { name: 'Share', exact: true })).toBeInTheDocument();
  });

  it('wide: Share on a book opens the people screen', async () => {
    wide();
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    openBookDetail(emit);

    const people = await screen.findByRole('region', { name: `${BOOK_LABEL} · People` });
    expect(await within(people).findByText('Ana (you)')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('wide: Share on a song opens the panel beside the chart, the reading view present and not aria-hidden', async () => {
    wide(true);
    const { store, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, OWNED));
    act(() => {
      fireEvent.change(screen.getAllByRole('searchbox')[0], { target: { value: 'tarde' } });
    });
    emit(
      event(EventKind.SEARCH_RESULTS, {
        query: 'tarde',
        results: [{ bookId: BOOK, path: SONG_PATH, title: SONG_TITLE, artist: '', score: 3, unsaved: false }],
      }),
    );
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(SONG_TITLE) })[0]);
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: SONG_PATH, text: SONG_TEXT }));

    fireEvent.click(screen.getByRole('button', { name: 'Share', exact: true }));
    const panel = screen.getByRole('complementary', { name: `Share ${SONG_TITLE}` });
    expect(panel).toBeInTheDocument();
    const song = screen.getByRole('group', { name: SONG_TITLE });
    expect(song.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    await within(panel).findByText(/0 invitations/);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

// behavior (books.add_book_chooser) — the Add-a-book chooser's seams into the
// shell. Mine on Estante signs in an EXISTING account (Decision 4; workflow 7
// L32-38): its "Sign in with a passkey" opens SignIn in sign-in intent and its
// "No passkey here? Email me a link" at the email step, while the empty shelf's
// first-run Sign in keeps create intent (account.first_run). The intent is read
// off the one request "Use a passkey" makes: authenticate/begin for sign-in,
// register/begin for create. And the upload preview is a full-screen surface
// (Decision 5; W07 #3; upload_ui Decision 1): no rail beside it, Cancel returns
// to Books with the rail back.
describe('AppShell and the Add-a-book chooser (behavior)', () => {
  let realFetch;
  let requests;
  beforeEach(() => {
    realFetch = globalThis.fetch;
    requests = [];
    globalThis.fetch = (path) => {
      requests.push(String(path));
      return Promise.reject(new TypeError('offline in this test'));
    };
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  function openSheetOnBooks(emit) {
    emit(event(EventKind.SHELF, SHELF));
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a book' }));
    return screen.getByRole('dialog', { name: 'Add a book' });
  }

  it('Mine’s sign-in is for an existing account: the passkey at the method step, the emailed link at the email step; the empty shelf’s Sign in still creates', async () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);

    // "Sign in with a passkey" → the Sign in surface, in sign-in intent.
    let dialog = openSheetOnBooks(emit);
    emit(event(EventKind.MINE, { status: 'signed_out', books: [] }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign in with a passkey' }));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use a passkey' }));
    await waitFor(() => expect(requests).toContain('/api/auth/passkey/authenticate/begin'));
    expect(requests.some((p) => p.includes('/register/'))).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    // "No passkey here? Email me a link" → the same surface at the email step.
    dialog = openSheetOnBooks(emit);
    emit(event(EventKind.MINE, { status: 'signed_out', books: [] }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'No passkey here? Email me a link' }));
    expect(screen.getByRole('heading', { name: 'Email me a link' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Your email' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    cleanup();

    // The empty shelf's first-run Sign in keeps create intent (on Search: the
    // address followed the Books tab, so start again from the root).
    history.replaceState(null, '', '/');
    requests.length = 0;
    const fresh = makeStore();
    render(<AppShell store={fresh.store} />);
    fireEvent.click(screen.getByRole('button', { name: /^Sign in/ }));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use a passkey' }));
    await waitFor(() => expect(requests).toContain('/api/auth/passkey/register/begin'));
    expect(requests.some((p) => p.includes('/authenticate/'))).toBe(false);
  });

  it('the upload preview is a full-screen surface: no rail beside it, and Cancel returns to Books with the rail back (W07 #3)', async () => {
    globalThis.matchMedia = (media) => ({
      media,
      matches: media === WIDE_QUERY,
      addEventListener() {},
      removeEventListener() {},
    });
    const { store, emit, sent } = makeStore();
    const { container } = render(<AppShell store={store} />);
    expect(screen.getByRole('tablist', { name: 'Destinations' })).toHaveClass('rail');

    const dialog = openSheetOnBooks(emit);
    const input = dialog.querySelector('input[type="file"]');
    const file = new File([new Uint8Array([80, 75, 5, 6])], 'banda.zip', { type: 'application/zip' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
      await Promise.resolve();
    });

    await screen.findByRole('button', { name: 'Cancel the upload' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Upload banda.zip')).toBeInTheDocument();
    // Nothing of the shell beside or under it: no rail, no tab bar.
    expect(screen.queryByRole('tablist', { name: 'Destinations' })).toBeNull();
    expect(screen.queryByRole('tablist', { hidden: true })).toBeNull();
    expect(container.querySelector('.pane.main')).toBeNull();
    // The preview's messages to the Worker are its own (PREVIEW_UPLOAD).
    expect(sent.some((m) => m.kind === CommandKind.PREVIEW_UPLOAD)).toBe(true);
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel the upload' }));
    expect(screen.getByRole('tablist', { name: 'Destinations' })).toHaveClass('rail');
    expect(screen.getByRole('tab', { name: 'Books' })).toHaveAttribute('aria-selected', 'true');
  });
});
