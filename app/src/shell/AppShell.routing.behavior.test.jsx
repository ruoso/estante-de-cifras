import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { createStore } from '../worker/store.js';
import { command, event, EventKind, CommandKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { WIDE_QUERY } from './layout-mode.js';
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
