import { describe, it, expect, beforeEach, afterEach, onTestFinished } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor, within } from '@testing-library/react';
import { createStore } from '../worker/store.js';
import { command, event, EventKind, CommandKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { instrumentInstance, configFor } from '../core/instrument.js';
import { WIDE_QUERY, READING_ACTIONS_WIDE_QUERY } from './layout-mode.js';
import AppShell from './AppShell.jsx';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import { createAuthClient } from '../account/auth-client.js';

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

// The account-making double (Every entry opens both sections; shell.overlay_stacking):
// a loopback auth client and a WebAuthn stand-in, shared by the describes below.
const OPTIONS = { publicKey: { challenge: 'c', rp: { id: '127.0.0.1' } }, state: 's' };

function makeAuth(routes = {}) {
  const calls = [];
  const fetch = async (path, init = {}) => {
    const method = init.method ?? 'GET';
    calls.push({ method, path });
    const handler = {
      'GET /api/account/recovery-email': () => ({ status: 401 }),
      'GET /api/account/sessions': () => ({ status: 401 }),
      'POST /api/auth/passkey/register/begin': () => ({ body: OPTIONS }),
      'POST /api/auth/passkey/register/finish': () => ({ body: { id: 'u_new' } }),
      'POST /api/auth/passkey/authenticate/begin': () => ({ body: OPTIONS }),
      'POST /api/auth/passkey/authenticate/finish': () => ({ body: { id: 'u_old' } }),
      ...routes,
    }[`${method} ${path}`];
    if (!handler) throw new TypeError(`no route for ${method} ${path}`);
    const result = handler();
    const status = result.status ?? 200;
    return { ok: status >= 200 && status < 300, status, json: async () => result.body };
  };
  return { client: createAuthClient({ fetch }), calls };
}

// jsdom has no WebAuthn: a platform authenticator stand-in.
function installWebAuthn() {
  const PublicKeyCredential = function PublicKeyCredential() {};
  PublicKeyCredential.parseCreationOptionsFromJSON = (json) => json;
  PublicKeyCredential.parseRequestOptionsFromJSON = (json) => json;
  globalThis.PublicKeyCredential = PublicKeyCredential;
  const cred = () => ({
    id: 'c1',
    type: 'public-key',
    authenticatorAttachment: 'platform',
    toJSON: () => ({ id: 'c1', rawId: 'c1', type: 'public-key', response: {}, clientExtensionResults: {} }),
  });
  Object.defineProperty(globalThis.navigator, 'credentials', {
    configurable: true,
    value: { create: async () => cred(), get: async () => cred() },
  });
}
function removeWebAuthn() {
  delete globalThis.PublicKeyCredential;
  delete globalThis.navigator.credentials;
}

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

  // books.row_opens_songs Decision *`openBook` splits into its two meanings*:
  // the file opener no longer diverts a book that needs you to its conflicts —
  // those are reached by *Settle* on the book's bar.
  it('show the file on a book needing you opens the file view, not its conflicts (books.row_opens_songs)', () => {
    const { store, sent, emit } = makeStore();
    render(<AppShell store={store} />);
    openSongFromSearch(emit);
    emit(event(EventKind.SYNC, { bookId: BOOK, phase: 'needs_you', at: AT }));
    const before = sent.filter((m) => m.kind === CommandKind.OPEN_CONFLICTS).length;
    showTheFile();
    expect(sent.filter((m) => m.kind === CommandKind.OPEN_CONFLICTS).length).toBe(before);
    expect(history.state.layers).toEqual(['files']);
    expect(screen.getByRole('button', { name: 'Back to files' })).toBeInTheDocument();
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

  // books.setlist_row_opens (workflow 12 §Playing through, as amended; the
  // `play` layer's Back): a song pressed in the setlist's list mounts the player
  // at that song, and Stop playing returns to the setlist with focus on its row.
  it('a setlist song pressed in its row plays from it; Stop returns focus to the row', async () => {
    const TWO = ['# Sábado no bar', '', `1. [${SONG_TITLE}](${SONG_PATH})`, `2. [${OTHER_TITLE}](${OTHER_PATH})`, ''].join('\n');
    history.replaceState(null, '', `/b/b1/${SETLIST_PATH}`);
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.TREE, { bookId: BOOK, entries: [...ENTRIES, { path: OTHER_PATH, status: null }] }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: SETLIST_PATH, text: TWO }));

    fireEvent.click(screen.getByRole('button', { name: new RegExp(OTHER_TITLE) }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: OTHER_PATH, text: OTHER_TEXT }));
    expect(screen.getByRole('group', { name: OTHER_TITLE })).toBeInTheDocument();
    expect(screen.getByText(/^2 of 2/)).toBeInTheDocument();

    await traverse(() => fireEvent.click(screen.getByRole('button', { name: 'Stop playing' })));
    expect(screen.getByRole('heading', { level: 2, name: 'Sábado no bar' })).toBeInTheDocument();
    expect(location.pathname).toBe(`/b/b1/${SETLIST_PATH}`);
    await waitFor(() => expect(screen.getByRole('button', { name: new RegExp(OTHER_TITLE) })).toHaveFocus());
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

  // songs.search_scope_follows — workflow 2 §Scope, *After a save, the scope
  // follows the song*; §The search screen (a section's open state lasts the
  // session); DIRECTION §3.7 (the address follows where you are).
  it('the scope follows a save: scoped to a book, a new song saved into My songs leaves Search scoped to My songs at its address, no step of its own; axe clean', async () => {
    const MINE = 'l-mine';
    const shelf = {
      ...SHELF,
      local: { [MINE]: { title: { value: 'My songs', at: AT }, position: { value: 0, at: AT } } },
    };
    const browseOf = (ids) =>
      event(EventKind.BROWSE_RESULTS, {
        books: [
          { bookId: BOOK, count: 1, songs: [{ path: SONG_PATH, title: SONG_TITLE, artist: '', unsaved: false }] },
          { bookId: MINE, count: 1, songs: [{ path: 'valsa-nova.cifra.md', title: 'Valsa nova', artist: '', unsaved: false }] },
        ].filter((b) => ids.includes(b.bookId)),
      });
    const { store, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, shelf));
    emit(browseOf([BOOK, MINE]));

    // Scoped to Banda do Bairro: a step of its own, at the book's address.
    fireEvent.click(screen.getByRole('button', { name: `Search only in ${BOOK_LABEL}` }));
    expect(location.pathname).toBe('/b/b1');
    const scopedDepth = history.state.depth;
    emit(browseOf([BOOK]));
    expect(screen.queryByRole('button', { name: /^My songs/ })).toBeNull();

    // Nothing matches: Create makes a new song in My songs.
    act(() => {
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Valsa nova' } });
    });
    emit(event(EventKind.SEARCH_RESULTS, { query: 'Valsa nova', results: [] }));
    fireEvent.click(screen.getByRole('button', { name: /Create “Valsa nova”/ }));
    emit(event(EventKind.NEW_SONG_READY, { bookId: MINE, path: 'untitled.cifra.md' }));
    const lengthWithEditor = history.length;
    expect(history.state.depth).toBe(scopedDepth + 1);

    // The first save lands: the host closes and the scope follows the song.
    const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    emit(event(EventKind.SAVED, { bookId: MINE, path: 'valsa-nova.cifra.md' }));
    await act(async () => {
      await popped;
    });
    expect(location.pathname).toBe(`/b/${MINE}`);
    expect(history.length).toBe(lengthWithEditor);
    expect(history.state.depth).toBe(scopedDepth);
    expect(history.state.layers).toEqual([]);
    expect(screen.getByRole('group', { name: 'Search songs, words and chords' })).toHaveTextContent('My songs');
    expect(screen.getByRole('button', { name: 'Manage My songs' })).toBeInTheDocument();

    // Its section is open with the song in it, under its own count; the book
    // the scope left is not listed.
    act(() => {
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: '' } });
    });
    emit(browseOf([MINE]));
    const mine = screen.getByRole('button', { name: /^My songs.*1 song$/ });
    expect(mine).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Valsa nova')).toBeVisible();
    expect(screen.queryByRole('button', { name: new RegExp(`^${BOOK_LABEL}`) })).toBeNull();
    expect(screen.queryByText('0 songs')).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // The section's open state lasts the session: closed, it is still closed
    // after Books and back to Search.
    fireEvent.click(mine);
    expect(screen.getByRole('button', { name: /^My songs.*1 song$/ })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Search' }));
    expect(screen.getByRole('button', { name: /^My songs.*1 song$/ })).toHaveAttribute('aria-expanded', 'false');

    // One Back goes where Back went from the scoped search: the unscoped one.
    await traverse(() => history.back());
    expect(location.pathname).toBe('/');
    expect(history.state.depth).toBe(scopedDepth - 1);
  });

  it('the scope follows a save: an edit saved in the scoped book leaves the scope and address untouched', async () => {
    history.replaceState(null, '', '/');
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, SHELF));
    emit(
      event(EventKind.BROWSE_RESULTS, {
        books: [{ bookId: BOOK, count: 1, songs: [{ path: SONG_PATH, title: SONG_TITLE, artist: '', unsaved: false }] }],
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: `Search only in ${BOOK_LABEL}` }));
    expect(location.pathname).toBe('/b/b1');
    // Its section is open (the bar's book): open the song, then edit it.
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${SONG_TITLE}`) }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: SONG_PATH, text: SONG_TEXT }));
    expect(location.pathname).toBe(SONG_URL);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const depth = history.state.depth;

    const popped = new Promise((resolve) => window.addEventListener('popstate', resolve, { once: true }));
    emit(event(EventKind.SAVED, { bookId: BOOK, paths: [SONG_PATH] }));
    await act(async () => {
      await popped;
    });
    expect(location.pathname).toBe(SONG_URL);
    expect(history.state.depth).toBe(depth - 1);
    await traverse(() => history.back());
    expect(location.pathname).toBe('/b/b1');
    expect(screen.getByRole('group', { name: 'Search songs, words and chords' })).toHaveTextContent(BOOK_LABEL);
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

  it('an invitation link ends on the setlist address', () => {
    // books.setlist_invitation Constraint 5 (workflow 10 §Sharing a song or a
    // setlist): the anchor names a setlist, so it opens the setlist on the
    // Setlists tab — at its address, never on the token.
    const LESSON_PATH = 'lessons/lesson-3.setlist.md';
    const LESSON_TEXT = ['# Lesson 3', '', `1. [${SONG_TITLE}](../${SONG_PATH})`, ''].join('\n');
    history.replaceState(null, '', `/i/tok-secret#${LESSON_PATH}`);
    const { store, emit } = makeStore();
    render(<AppShell store={store} inviteToken="tok-secret" inviteSongAnchor={LESSON_PATH} />);
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.BOOK_CLONED, { bookId: BOOK }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: LESSON_PATH, text: LESSON_TEXT }));
    expect(location.pathname).toBe(`/b/${BOOK}/${LESSON_PATH}`);
    expect(screen.getByRole('heading', { level: 2, name: 'Lesson 3' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Setlists', selected: true })).toBeInTheDocument();
    expect(history.state.place.tab).toBe('setlists');
    expect(screen.queryByRole('group', { name: SONG_TITLE })).toBeNull();
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
// behavior (books.setlist_making; workflow 12 §Building one; W12 #8-11): a
// setlist made from the Setlists tab opens in its editor on the Setlists tab at
// its own address; one made from Add to setlist over a song opens, through
// *Open setlist*, as a new place whose Back returns to the song (Constraint 8).
describe('AppShell making a setlist (behavior)', () => {
  const NEW_PATH = 'thursday-lesson.setlist.md';
  const NEW_URL = `/b/b1/${NEW_PATH}`;

  it('narrow, New setlist… → Create → FILE_CREATED mounts the new setlist’s editor on the Setlists tab at its address', async () => {
    const { store, sent, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, SHELF));
    fireEvent.click(screen.getByRole('tab', { name: 'Setlists' }));
    emit(event(EventKind.SETLISTS, { setlists: [] }));
    expect(
      screen.getByText('No setlists yet. Make one with New setlist, or add a song to a setlist from search or the reading view.'),
    ).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'New setlist…' })));
    const name = await screen.findByRole('textbox', { name: 'Setlist name' });
    await act(async () => fireEvent.change(name, { target: { value: 'Thursday lesson' } }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create' })));
    const create = sent.find((m) => m.kind === CommandKind.CREATE_FILE);
    expect(create.payload).toEqual({ bookId: BOOK, kind: 'setlist', title: 'Thursday lesson' });

    const before = history.length;
    emit(event(EventKind.FILE_CREATED, { bookId: BOOK, path: NEW_PATH }));
    emit(event(EventKind.TREE, { bookId: BOOK, entries: [...ENTRIES, { path: NEW_PATH, status: 'new' }] }));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: NEW_PATH, text: '# Thursday lesson\n' }));
    const panel = screen.getByRole('tabpanel', { name: 'Setlists' });
    const addSong = within(panel).getByRole('button', { name: 'Add song' });
    expect(within(panel).getByRole('button', { name: 'Done' })).toBeInTheDocument();
    expect(within(panel).getByText('not saved yet')).toBeInTheDocument();
    await waitFor(() => expect(addSong).toHaveFocus());
    expect(screen.getByRole('tab', { name: 'Setlists' })).toHaveAttribute('aria-selected', 'true');
    expect(location.pathname).toBe(NEW_URL);
    expect(history.length).toBe(before + 1);
    // Editing is not a place: the entry names the setlist only.
    expect(history.state.place).toEqual({ tab: 'setlists', setlist: { bookId: BOOK, path: NEW_PATH } });
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('narrow, from a song open in the reading view, Add to setlist → New setlist → Create → Open setlist shows the setlist; Back returns to the song', async () => {
    const { store, sent, emit } = makeStore();
    render(<AppShell store={store} />);
    openSongFromSearch(emit);
    emit(event(EventKind.TREE, { bookId: BOOK, entries: ENTRIES }));
    fireEvent.click(screen.getAllByRole('button', { name: 'More' })[0]);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add to setlist' }));
    emit(event(EventKind.SETLISTS, { setlists: [] }));
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'New setlist…' })));
    const name = await screen.findByRole('textbox', { name: 'Setlist name' });
    await act(async () => fireEvent.change(name, { target: { value: 'Gig Night' } }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create' })));
    const add = sent.find((m) => m.kind === CommandKind.ADD_TO_SETLIST);
    expect(add.payload).toMatchObject({ targetBookId: BOOK, setlistPath: 'gig-night.setlist.md', newTitle: 'Gig Night' });
    emit(
      event(EventKind.SETLIST_UPDATED, {
        bookId: BOOK,
        setlistPath: 'gig-night.setlist.md',
        path: SONG_PATH,
        copied: false,
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(`${SONG_TITLE} is in Gig Night.`);

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Open setlist' })));
    const GIG = ['# Gig Night', '', `1. [${SONG_TITLE}](${SONG_PATH})`, ''].join('\n');
    emit(
      event(EventKind.TREE, {
        bookId: BOOK,
        entries: [...ENTRIES, { path: 'gig-night.setlist.md', status: 'new' }],
      }),
    );
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: 'gig-night.setlist.md', text: GIG }));
    expect(screen.queryByRole('dialog', { name: 'Add to setlist' })).not.toBeInTheDocument();
    // The song does not stay in front of the setlist.
    expect(screen.queryByRole('group', { name: SONG_TITLE })).not.toBeInTheDocument();
    const panel = screen.getByRole('tabpanel', { name: 'Setlists' });
    expect(within(panel).getByRole('heading', { level: 2, name: 'Gig Night' })).toBeInTheDocument();
    expect(within(panel).getAllByText('not saved yet').length).toBeGreaterThan(0);
    expect(location.pathname).toBe('/b/b1/gig-night.setlist.md');

    await traverse(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    emit(event(EventKind.SOURCE, { bookId: BOOK, path: SONG_PATH, text: SONG_TEXT }));
    await waitFor(() => expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument());
    expect(location.pathname).toBe(SONG_URL);
    expect(screen.queryByRole('heading', { level: 2, name: 'Gig Night' })).not.toBeInTheDocument();
  });
});

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

  // Books → the book's songs → Manage → Share (books.row_opens_songs).
  function openBookDetail(emit) {
    emit(event(EventKind.SHELF, OWNED));
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${BOOK_LABEL}`) }));
    fireEvent.click(screen.getByRole('button', { name: `Manage ${BOOK_LABEL}` }));
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
    expect(history.state.layers).toEqual(['bookDetail', 'people']);

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

  // books.setlist_picker_fixes (workflow 10 **Where it sits** and its delta;
  // Constraint 4): Done on a made invitation returns to where it was made from —
  // the book's detail from the phone's sheet, the people screen from there —
  // never to another destination. The fetch answers Create link with a link.
  const answerInvitations = () => {
    const answer = globalThis.fetch;
    globalThis.fetch = async (path, init) => {
      if (String(path).endsWith('/invitations') && init?.method === 'POST') {
        return {
          ok: true,
          status: 201,
          json: async () => ({ id: 'inv-1', url: 'https://estante.app/i/tok-done', role: 'reader' }),
        };
      }
      return answer(path, init);
    };
  };
  // Create link on the shown invitation, then Done on the made link.
  async function createThenDone(within_ = screen) {
    fireEvent.click(await within_.findByRole('button', { name: 'Create link' }));
    expect(await screen.findByRole('textbox', { name: 'Invitation link' })).toHaveValue(
      'https://estante.app/i/tok-done',
    );
    await traverse(() => fireEvent.click(screen.getByRole('button', { name: 'Done' })));
  }
  const expectNotOnSetlists = () => {
    expect(location.pathname).not.toMatch(/setlists/);
    expect(history.state.place.tab).not.toBe('setlists');
    expect(screen.queryByRole('tab', { name: 'Setlists', selected: true })).toBeNull();
  };

  it('narrow: Done on an invitation made from the Share sheet returns to the book detail, not Setlists (axe clean)', async () => {
    answerInvitations();
    const { store, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);
    openBookDetail(emit);
    expect(location.pathname).toBe(`/b/${BOOK}`);

    const sheet = await screen.findByRole('dialog', { name: `Share ${BOOK_LABEL}` });
    fireEvent.click(await within(sheet).findByRole('button', { name: /^Invite people/ }));
    expect(await screen.findByRole('region', { name: 'New invitation' })).toBeInTheDocument();
    expect(history.state.layers).toEqual(['bookDetail', 'newInvitation']);

    await createThenDone();
    expect(screen.queryByRole('region', { name: 'New invitation' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Share', exact: true })).toBeInTheDocument();
    // shell.surface_restore_focus Constraints 1-2: focus lands on the restored
    // detail's Share, not on <body>.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Share', exact: true }));
    expect(location.pathname).toBe(`/b/${BOOK}`);
    expect(history.state.layers).toEqual(['bookDetail']);
    expectNotOnSetlists();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('narrow: Done on an invitation made from the people screen returns to it; its Back returns to the book', async () => {
    answerInvitations();
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    openBookDetail(emit);

    const sheet = await screen.findByRole('dialog', { name: `Share ${BOOK_LABEL}` });
    fireEvent.click(await within(sheet).findByRole('button', { name: /^Members/ }));
    const people = await screen.findByRole('region', { name: `${BOOK_LABEL} · People` });
    fireEvent.click(within(people).getByRole('button', { name: 'New invitation' }));
    expect(await screen.findByRole('region', { name: 'New invitation' })).toBeInTheDocument();
    expect(history.state.layers).toEqual(['bookDetail', 'people', 'newInvitation']);

    await createThenDone();
    const again = screen.getByRole('region', { name: `${BOOK_LABEL} · People` });
    expect(history.state.layers).toEqual(['bookDetail', 'people']);
    expectNotOnSetlists();
    // shell.surface_restore_focus Constraints 1-3: the restored people screen's
    // title heading holds focus.
    expect(document.activeElement).toBe(
      within(again).getByRole('heading', { level: 1, name: `${BOOK_LABEL} · People` }),
    );

    await traverse(() => fireEvent.click(within(again).getByRole('button', { name: 'Back' })));
    expect(screen.queryByRole('region', { name: `${BOOK_LABEL} · People` })).toBeNull();
    expect(screen.getByRole('button', { name: 'Share', exact: true })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Share', exact: true }));
    expect(history.state.layers).toEqual(['bookDetail']);
  });

  // shell.surface_restore_focus Constraint 1: the flag is set in the closer, so
  // the system back (popstate's reconcile) restores focus as Back does.
  it('narrow: the system back from the people screen focuses Share on the restored book detail', async () => {
    const { store, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);
    openBookDetail(emit);
    const sheet = await screen.findByRole('dialog', { name: `Share ${BOOK_LABEL}` });
    fireEvent.click(await within(sheet).findByRole('button', { name: /^Members/ }));
    const people = await screen.findByRole('region', { name: `${BOOK_LABEL} · People` });
    await within(people).findByText('Bia Rocha');
    expect(history.state.layers).toEqual(['bookDetail', 'people']);

    await traverse(() => history.back());
    expect(screen.queryByRole('region', { name: `${BOOK_LABEL} · People` })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Share', exact: true }));
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  // shell.surface_restore_focus Constraint 4: on a tablet or a computer Back
  // from the people screen goes through the same closer; the New invitation
  // dialog's Done keeps RAC's own restore to its trigger, never the flag.
  it('wide: Back from the people screen focuses Share on the book detail; the New invitation dialog’s Done leaves focus on New invitation', async () => {
    wide();
    answerInvitations();
    const { store, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);
    openBookDetail(emit);
    const people = await screen.findByRole('region', { name: `${BOOK_LABEL} · People` });
    await within(people).findByText('Ana (you)');

    // RAC restores focus to what held it before the dialog opened.
    const trigger = within(people).getByRole('button', { name: 'New invitation' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'New invitation' });
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Create link' }));
    await within(dialog).findByRole('textbox', { name: 'Invitation link' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New invitation' })).toBeNull());
    const still = screen.getByRole('region', { name: `${BOOK_LABEL} · People` });
    await waitFor(() =>
      expect(document.activeElement).toBe(within(still).getByRole('button', { name: 'New invitation' })),
    );

    await traverse(() => fireEvent.click(within(still).getByRole('button', { name: 'Back' })));
    expect(screen.queryByRole('region', { name: `${BOOK_LABEL} · People` })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Share', exact: true }));
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  // shell.surface_restore_focus_song Constraints 1-4 (and the predecessor's
  // guard): a people screen opened from a song's share closes onto the reading
  // view, whose share opener — More on a phone — takes focus, so no flag is left
  // for a later, unrelated book-detail mount.
  it('narrow: Back from a people screen opened over a song focuses its More, and leaves no pending focus', async () => {
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
    await screen.findByRole('group', { name: SONG_TITLE });
    fireEvent.click(screen.getAllByRole('button', { name: 'More' })[0]);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Share' }));
    const sheet = await screen.findByRole('dialog', { name: `Share ${SONG_TITLE}` });
    fireEvent.click(await within(sheet).findByRole('button', { name: /^Members/ }));
    const people = await screen.findByRole('region', { name: `${BOOK_LABEL} · People` });
    await within(people).findByText('Bia Rocha');

    await traverse(() => fireEvent.click(within(people).getByRole('button', { name: 'Back' })));
    expect(screen.queryByRole('region', { name: `${BOOK_LABEL} · People` })).toBeNull();
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'More' })[0]);
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // Later: off the song, then the book's detail through Books → Manage.
    await traverse(() => history.back());
    expect(screen.queryByRole('group', { name: SONG_TITLE })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));
    fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${BOOK_LABEL}`) }));
    const manage = screen.getByRole('button', { name: `Manage ${BOOK_LABEL}` });
    manage.focus();
    fireEvent.click(manage);
    const share = await screen.findByRole('button', { name: 'Share', exact: true });
    expect(document.activeElement).not.toBe(share);
  });

  // The owned book's song, opened from search and read.
  async function openOwnedSong(emit) {
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
    await screen.findByRole('group', { name: SONG_TITLE });
  }

  // shell.surface_restore_focus_song Constraint 1's order: an invitation made
  // from the people screen over a song returns focus to that screen's title
  // (`'people'` before `'song'`); its Back then focuses the song's More.
  it('narrow: Done on an invitation made from a song’s people screen returns to its title; Back then focuses the song’s More', async () => {
    answerInvitations();
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    await openOwnedSong(emit);
    fireEvent.click(screen.getAllByRole('button', { name: 'More' })[0]);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Share' }));
    const sheet = await screen.findByRole('dialog', { name: `Share ${SONG_TITLE}` });
    fireEvent.click(await within(sheet).findByRole('button', { name: /^Members/ }));
    const people = await screen.findByRole('region', { name: `${BOOK_LABEL} · People` });
    fireEvent.click(within(people).getByRole('button', { name: 'New invitation' }));
    expect(await screen.findByRole('region', { name: 'New invitation' })).toBeInTheDocument();

    await createThenDone();
    const again = screen.getByRole('region', { name: `${BOOK_LABEL} · People` });
    expect(document.activeElement).toBe(
      within(again).getByRole('heading', { level: 1, name: `${BOOK_LABEL} · People` }),
    );

    await traverse(() => fireEvent.click(within(again).getByRole('button', { name: 'Back' })));
    expect(screen.queryByRole('region', { name: `${BOOK_LABEL} · People` })).toBeNull();
    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getAllByRole('button', { name: 'More' })[0]);
  });

  // shell.surface_restore_focus_song Constraints 4-5: on wide, Manage in the
  // song's panel goes through the same closer; Back focuses the share opener —
  // the app bar's Share on the computer, More on the tablet.
  it('wide: Back from a people screen opened from a song’s panel focuses Share on the computer and More on the tablet', async () => {
    for (const computer of [true, false]) {
      wide(computer);
      const { store, emit } = makeStore();
      const { container } = render(<AppShell store={store} />);
      await openOwnedSong(emit);
      if (computer) {
        fireEvent.click(screen.getByRole('button', { name: 'Share', exact: true }));
      } else {
        fireEvent.click(screen.getAllByRole('button', { name: 'More' })[0]);
        fireEvent.click(await screen.findByRole('menuitem', { name: 'Share' }));
      }
      const panel = screen.getByRole('complementary', { name: `Share ${SONG_TITLE}` });
      const manage = await within(panel).findByRole('button', { name: 'Manage' });
      await act(async () => fireEvent.click(manage));
      const people = await screen.findByRole('region', { name: `${BOOK_LABEL} · People` });
      await within(people).findByText('Bia Rocha');

      await traverse(() => fireEvent.click(within(people).getByRole('button', { name: 'Back' })));
      expect(screen.queryByRole('region', { name: `${BOOK_LABEL} · People` })).toBeNull();
      expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();
      expect(screen.queryByRole('complementary', { name: `Share ${SONG_TITLE}` })).toBeNull();
      expect(document.activeElement).toBe(
        computer
          ? screen.getByRole('button', { name: 'Share', exact: true })
          : screen.getAllByRole('button', { name: 'More' })[0],
      );
      expect(await checkWcag21aa(container)).toHaveNoViolations();
      cleanup();
      history.replaceState(null, '', '/');
      sessionStorage.clear();
    }
  });

  it('narrow: after a put-online from the book detail, Done on the sheet’s invitation returns to the book at its service id', async () => {
    answerInvitations();
    const LOCAL_ID = 'local-1';
    const SERVICE_ID = 'srv-1';
    const { store, sent, emit } = makeStore();
    render(<AppShell store={store} />);
    emit(event(EventKind.SHELF, {
      books: {},
      local: { [LOCAL_ID]: { title: { value: 'My songs', at: AT }, position: { value: 0, at: AT } } },
    }));
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));
    fireEvent.click(screen.getByRole('button', { name: /^My songs/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Manage My songs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Put online' }));
    // The card asks first (books.put_online_confirm): confirm in the dialog.
    fireEvent.click(
      within(screen.getByRole('alertdialog', { name: 'Put My songs online?' })).getByRole('button', { name: 'Put online' }),
    );
    expect(sent.filter((m) => m.kind === CommandKind.PUT_ONLINE).map((m) => m.payload)).toEqual([
      { bookId: LOCAL_ID },
    ]);
    emit(event(EventKind.SHELF, {
      books: {
        [SERVICE_ID]: {
          label: { value: 'My songs', at: AT },
          role: { value: 'owner', at: AT },
          position: { value: 0, at: AT },
        },
      },
      local: {},
    }));
    emit(event(EventKind.BOOK_ONLINE, { previousBookId: LOCAL_ID, bookId: SERVICE_ID }));
    expect(location.pathname).toBe(`/b/${SERVICE_ID}`);

    fireEvent.click(await screen.findByRole('button', { name: 'Share', exact: true }));
    const sheet = await screen.findByRole('dialog', { name: 'Share My songs' });
    fireEvent.click(await within(sheet).findByRole('button', { name: /^Invite people/ }));
    expect(await screen.findByRole('region', { name: 'New invitation' })).toBeInTheDocument();

    await createThenDone();
    expect(screen.queryByRole('region', { name: 'New invitation' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Share', exact: true })).toBeInTheDocument();
    expect(location.pathname).toBe(`/b/${SERVICE_ID}`);
    expect(history.state.layers).toEqual(['bookDetail']);
    expectNotOnSetlists();
  });

  it('wide: Done on the New invitation dialog closes it over the people screen, history untouched', async () => {
    wide();
    answerInvitations();
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);
    openBookDetail(emit);
    const people = await screen.findByRole('region', { name: `${BOOK_LABEL} · People` });
    await within(people).findByText('Ana (you)');
    const before = { state: history.state, length: history.length, path: location.pathname };

    fireEvent.click(within(people).getByRole('button', { name: 'New invitation' }));
    const dialog = await screen.findByRole('dialog', { name: 'New invitation' });
    fireEvent.click(await within(dialog).findByRole('button', { name: 'Create link' }));
    expect(await within(dialog).findByRole('textbox', { name: 'Invitation link' })).toHaveValue(
      'https://estante.app/i/tok-done',
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New invitation' })).toBeNull());
    expect(screen.getByRole('region', { name: `${BOOK_LABEL} · People` })).toBeInTheDocument();
    expect(history.state).toEqual(before.state);
    expect(history.length).toBe(before.length);
    expect(location.pathname).toBe(before.path);
    expectNotOnSetlists();
  });

  // books.share_needs_online (workflow 10 §Sharing a song): a song in a book only
  // on this device — *My songs* before it goes online.
  const LOCAL = 'local-1';
  const SERVICE = 'srv-1';
  const LOCAL_SHELF = {
    books: {},
    local: { [LOCAL]: { title: { value: 'My songs', at: AT }, position: { value: 0, at: AT } } },
  };
  const ONLINE_SHELF = {
    books: {
      [SERVICE]: {
        label: { value: 'My songs', at: AT },
        role: { value: 'owner', at: AT },
        position: { value: 0, at: AT },
      },
    },
    local: {},
  };
  // The account probe's answer: signed in (200) or signed out (401).
  const authAs = (signedIn) =>
    createAuthClient({
      fetch: async (path) => {
        if (String(path) === '/api/account/recovery-email') {
          return signedIn
            ? { ok: true, status: 200, json: async () => ({ email: null, pending: null }) }
            : { ok: false, status: 401, json: async () => ({}) };
        }
        throw new TypeError(`no route for ${path}`);
      },
    });
  // Every request the sharing client makes for a book.
  const bookCalls = [];
  const recordBookCalls = () => {
    bookCalls.length = 0;
    const answer = globalThis.fetch;
    globalThis.fetch = async (path, init) => {
      if (String(path).startsWith('/api/books/')) bookCalls.push(String(path));
      return answer(path, init);
    };
  };
  function openLocalSongShare(emit) {
    emit(event(EventKind.SHELF, LOCAL_SHELF));
    act(() => {
      fireEvent.change(screen.getAllByRole('searchbox')[0], { target: { value: 'tarde' } });
    });
    emit(
      event(EventKind.SEARCH_RESULTS, {
        query: 'tarde',
        results: [{ bookId: LOCAL, path: SONG_PATH, title: SONG_TITLE, artist: '', score: 3, unsaved: false }],
      }),
    );
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(SONG_TITLE) })[0]);
    emit(event(EventKind.SOURCE, { bookId: LOCAL, path: SONG_PATH, text: SONG_TEXT }));
    fireEvent.click(screen.getByRole('button', { name: 'Share', exact: true }));
    return screen.getByRole('complementary', { name: `Share ${SONG_TITLE}` });
  }

  it('a local book’s song: Share says it is only on this device, asks Estante nothing, and after Put online is the owner’s invite (Constraint 5)', async () => {
    wide(true);
    recordBookCalls();
    const { store, sent, emit } = makeStore();
    const { container } = render(<AppShell store={store} authClient={authAs(true)} />);

    const panel = openLocalSongShare(emit);
    expect(within(panel).getByText('My songs is only on this device. Put it online to invite people.')).toBeInTheDocument();
    expect(within(panel).queryByRole('textbox', { name: 'Song address' })).toBeNull();
    const put = await within(panel).findByRole('button', { name: 'Put online' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    expect(bookCalls).toEqual([]);

    fireEvent.click(put);
    const putCommands = sent.filter((m) => m.kind === CommandKind.PUT_ONLINE);
    expect(putCommands.map((m) => m.payload)).toEqual([{ bookId: LOCAL }]);
    expect(within(panel).getByRole('status')).toHaveTextContent('Putting it online…');

    // The Worker surfaces the shelf, then announces the adopted id (logic.js
    // PUT_ONLINE): nothing is asked under the old id in between.
    emit(event(EventKind.SHELF, ONLINE_SHELF));
    expect(within(panel).getByRole('status')).toHaveTextContent('Putting it online…');
    expect(bookCalls).toEqual([]);
    emit(event(EventKind.BOOK_ONLINE, { previousBookId: LOCAL, bookId: SERVICE }));
    // The open song follows to the adopted id and reads its source there.
    emit(event(EventKind.SOURCE, { bookId: SERVICE, path: SONG_PATH, text: SONG_TEXT }));

    const same = screen.getByRole('complementary', { name: `Share ${SONG_TITLE}` });
    expect(await within(same).findByRole('button', { name: 'Create link' })).toBeInTheDocument();
    expect(within(same).getByText('Invite someone to this song')).toBeInTheDocument();
    await waitFor(() => expect(bookCalls).toContain(`/api/books/${SERVICE}/members`));
    expect(bookCalls.every((p) => p.startsWith(`/api/books/${SERVICE}/`))).toBe(true);
  });

  it('a local book’s song, signed out: Sign in to put it online opens the sign-in surface, and closing it returns to the song with the share open (Constraint 4)', async () => {
    wide(true);
    recordBookCalls();
    const { store, emit } = makeStore();
    render(<AppShell store={store} authClient={authAs(false)} />);

    const panel = openLocalSongShare(emit);
    const signIn = await within(panel).findByRole('button', { name: 'Sign in to put it online' });
    expect(within(panel).queryByRole('button', { name: 'Put online' })).toBeNull();

    fireEvent.click(signIn);
    expect(screen.getByRole('heading', { name: 'Sign in or make an account' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(screen.getByRole('group', { name: SONG_TITLE })).toBeInTheDocument();
    const again = screen.getByRole('complementary', { name: `Share ${SONG_TITLE}` });
    expect(within(again).getByRole('button', { name: 'Sign in to put it online' })).toBeInTheDocument();
    expect(bookCalls).toEqual([]);
  });

  // shell.overlay_stacking (workflow 10 §Sharing a song, workflow 13 §Signing in,
  // or making an account): SignIn stands in for the whole shell, so on Done the
  // song and its still-open sheet mount again in one commit (AppShell's
  // onDone). The sheet must come back in ThemeRoot's overlay layer — after the
  // song's positioned `.scroll` body in document order, so the song never
  // paints over it.
  it('narrow: a local book’s song, signed out: Sign in to put it online, Make an account, Not now — the share sheet comes back in the overlay layer, after the song in document order (shell.overlay_stacking)', async () => {
    installWebAuthn();
    onTestFinished(removeWebAuthn);
    recordBookCalls();
    const { client } = makeAuth();
    const { store, emit } = makeStore();
    const { container } = render(
      <ThemeRoot store={store}>
        <AppShell store={store} authClient={client} />
      </ThemeRoot>,
    );

    emit(event(EventKind.SHELF, LOCAL_SHELF));
    act(() => {
      fireEvent.change(screen.getAllByRole('searchbox')[0], { target: { value: 'tarde' } });
    });
    emit(
      event(EventKind.SEARCH_RESULTS, {
        query: 'tarde',
        results: [{ bookId: LOCAL, path: SONG_PATH, title: SONG_TITLE, artist: '', score: 3, unsaved: false }],
      }),
    );
    fireEvent.click(screen.getAllByRole('button', { name: new RegExp(SONG_TITLE) })[0]);
    emit(event(EventKind.SOURCE, { bookId: LOCAL, path: SONG_PATH, text: SONG_TEXT }));
    await screen.findByRole('group', { name: SONG_TITLE });
    fireEvent.click(screen.getAllByRole('button', { name: 'More' })[0]);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Share' }));
    const sheet = await screen.findByRole('dialog', { name: `Share ${SONG_TITLE}` });

    fireEvent.click(await within(sheet).findByRole('button', { name: 'Sign in to put it online' }));
    fireEvent.click(screen.getByRole('button', { name: 'Make an account' }));
    await screen.findByRole('heading', { name: 'Add a recovery email' });
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));

    const again = await screen.findByRole('dialog', { name: `Share ${SONG_TITLE}` });
    const est = container.querySelector('.est');
    const layer = est.querySelector('.est-overlays');
    expect(layer).toContainElement(again);
    expect(est.lastElementChild).toBe(layer);
    // The open sheet aria-hides the song beneath it, so its body is found by class.
    expect(within(est).getByRole('group', { name: SONG_TITLE, hidden: true })).toBeInTheDocument();
    const body = est.querySelector('.reading-scroll');
    expect(body).not.toBeNull();
    expect(layer).not.toContainElement(body);
    expect(body.compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bookCalls).toEqual([]);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  // books.setlist_invitation (workflow 12 §Sharing one; workflow 10 **Where it
  // sits**, Constraints 4 and 6): Share on an open setlist — the sheet on a
  // phone, whose inline invite's Done comes back to the sheet and Close to the
  // setlist at its address; the panel on wide, whose Manage leads to the people
  // screen over the setlist and its Back back to the setlist; and a local
  // book's setlist share following the book online.
  const SETLIST_URL = `/b/${BOOK}/${SETLIST_PATH}`;
  const SETLIST_TITLE = 'Sábado no bar';
  function openSetlistAt(emit, { shelf = OWNED, bookId = BOOK } = {}) {
    history.replaceState(null, '', `/b/${bookId}/${SETLIST_PATH}`);
    return () => {
      emit(event(EventKind.SHELF, shelf));
      emit(event(EventKind.TREE, { bookId, entries: ENTRIES }));
      emit(event(EventKind.SOURCE, { bookId, path: SETLIST_PATH, text: SETLIST_TEXT }));
      expect(screen.getByRole('heading', { level: 2, name: SETLIST_TITLE })).toBeInTheDocument();
    };
  }
  const setlistScreen = () =>
    screen.getByRole('heading', { level: 2, name: SETLIST_TITLE }).closest('.setlist-screen');

  it('narrow: a setlist’s More → Share → Invite someone to this setlist → Create link → Done → Close lands on the setlist, never /setlists', async () => {
    answerInvitations();
    const { store, emit } = makeStore();
    const arrive = openSetlistAt(emit);
    const { container } = render(<AppShell store={store} />);
    arrive();
    expect(location.pathname).toBe(SETLIST_URL);

    fireEvent.click(within(setlistScreen()).getByRole('button', { name: 'More' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Share' }));
    const sheet = await screen.findByRole('dialog', { name: `Share ${SETLIST_TITLE}` });
    expect(await within(sheet).findByRole('textbox', { name: 'Setlist address' })).toHaveValue(
      `${location.origin}${SETLIST_URL}`,
    );
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(await within(sheet).findByRole('button', { name: 'Invite someone to this setlist' }));
    fireEvent.click(await within(sheet).findByRole('button', { name: 'Create link' }));
    expect(await within(sheet).findByRole('textbox', { name: 'Invitation link' })).toHaveValue(
      `https://estante.app/i/tok-done#${SETLIST_PATH}`,
    );
    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(await within(sheet).findByRole('button', { name: 'Invite someone to this setlist' })).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('heading', { level: 2, name: SETLIST_TITLE })).toBeInTheDocument();
    expect(location.pathname).toBe(SETLIST_URL);
    expect(location.pathname).not.toBe('/setlists');
    expect(screen.getByRole('tab', { name: 'Setlists', selected: true })).toBeInTheDocument();
  });

  it('wide: a setlist’s Share → Manage shows the people screen over the setlist; its Back returns to the setlist at its address', async () => {
    wide();
    const { store, emit } = makeStore();
    const arrive = openSetlistAt(emit);
    const { container } = render(<AppShell store={store} />);
    arrive();

    fireEvent.click(within(setlistScreen()).getByRole('button', { name: 'Share', exact: true }));
    const panel = screen.getByRole('complementary', { name: `Share ${SETLIST_TITLE}` });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(panel).getByText(new RegExp(`Everyone you invite joins ${BOOK_LABEL}`))).toBeInTheDocument();
    await within(panel).findByText(/0 invitations/);
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    await act(async () => fireEvent.click(within(panel).getByRole('button', { name: 'Manage' })));
    const people = await screen.findByRole('region', { name: `${BOOK_LABEL} · People` });
    expect(screen.queryByRole('heading', { level: 2, name: SETLIST_TITLE })).toBeNull();
    expect(history.state.layers).toEqual(['people']);

    await traverse(() => fireEvent.click(within(people).getByRole('button', { name: 'Back' })));
    expect(screen.queryByRole('region', { name: `${BOOK_LABEL} · People` })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: SETLIST_TITLE })).toBeInTheDocument();
    expect(location.pathname).toBe(SETLIST_URL);
    expect(history.state.place.tab).toBe('setlists');
    // shell.surface_restore_focus_song Constraints 4-5: the setlist's app-bar
    // Share — its share opener on wide — holds focus.
    expect(document.activeElement).toBe(within(setlistScreen()).getByRole('button', { name: 'Share', exact: true }));
  });

  // shell.surface_restore_focus_song Constraints 1 and 4: the flag is set in the
  // people closer, so the system back gets it too; on narrow the setlist's More
  // is its share opener.
  it('narrow: a setlist’s More → Share → Members → the system back focuses the setlist’s More (axe clean)', async () => {
    const { store, emit } = makeStore();
    const arrive = openSetlistAt(emit);
    const { container } = render(<AppShell store={store} />);
    arrive();

    fireEvent.click(within(setlistScreen()).getByRole('button', { name: 'More' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Share' }));
    const sheet = await screen.findByRole('dialog', { name: `Share ${SETLIST_TITLE}` });
    fireEvent.click(await within(sheet).findByRole('button', { name: /^Members/ }));
    const people = await screen.findByRole('region', { name: `${BOOK_LABEL} · People` });
    await within(people).findByText('Bia Rocha');

    await traverse(() => history.back());
    expect(screen.queryByRole('region', { name: `${BOOK_LABEL} · People` })).toBeNull();
    expect(location.pathname).toBe(SETLIST_URL);
    expect(document.activeElement).toBe(within(setlistScreen()).getByRole('button', { name: 'More' }));
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('wide: a local book’s setlist share says it is only on this device, then after BOOK_ONLINE is the owner’s setlist share under the new id (Constraint 4)', async () => {
    wide();
    recordBookCalls();
    const { store, emit } = makeStore();
    const arrive = openSetlistAt(emit, { shelf: LOCAL_SHELF, bookId: LOCAL });
    render(<AppShell store={store} authClient={authAs(true)} />);
    arrive();

    fireEvent.click(within(setlistScreen()).getByRole('button', { name: 'Share', exact: true }));
    const panel = screen.getByRole('complementary', { name: `Share ${SETLIST_TITLE}` });
    expect(within(panel).getByText('My songs is only on this device. Put it online to invite people.')).toBeInTheDocument();
    expect(within(panel).queryByRole('textbox', { name: 'Setlist address' })).toBeNull();
    expect(bookCalls).toEqual([]);

    emit(event(EventKind.SHELF, ONLINE_SHELF));
    emit(event(EventKind.BOOK_ONLINE, { previousBookId: LOCAL, bookId: SERVICE }));
    emit(event(EventKind.SOURCE, { bookId: SERVICE, path: SETLIST_PATH, text: SETLIST_TEXT }));

    const same = screen.getByRole('complementary', { name: `Share ${SETLIST_TITLE}` });
    expect(within(same).getByRole('textbox', { name: 'Setlist address' })).toHaveValue(
      `${location.origin}/b/${SERVICE}/${SETLIST_PATH}`,
    );
    expect(await within(same).findByRole('button', { name: 'Create link' })).toBeInTheDocument();
    expect(within(same).getByText('Invite someone to this setlist')).toBeInTheDocument();
    await waitFor(() => expect(bookCalls).toContain(`/api/books/${SERVICE}/members`));
    expect(bookCalls.every((p) => p.startsWith(`/api/books/${SERVICE}/`))).toBe(true);
  });
});

// behavior (books.add_book_chooser) — the Add-a-book chooser's seams into the
// shell: the upload preview is a full-screen surface (Decision 5; W07 #3;
// upload_ui Decision 1): no rail beside it, Cancel returns to Books with the rail
// back. Its sign-in seams are pinned below, with every other entry into the one
// sign-in surface.
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

// behavior (account.sign_in_two_doors) — every entry opens the one sign-in
// surface at its two sections; only *Mine*'s emailed link names a step. Making
// an account attaches the home book (and accepts an invitation) while *Add a
// recovery email* still shows — nothing waits on it — and signing in never
// registers. Pins workflow 13 L10-39 and §Asked when the account is made, and
// workflow 1 §Invited. The auth client is a loopback double injected into the
// shell, which shares it with the surface and the account screen.
describe('Every entry opens both sections', () => {
  beforeEach(installWebAuthn);
  afterEach(removeWebAuthn);

  function expectBothSections() {
    expect(screen.getByRole('group', { name: 'Already have an account?' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'New here?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use a passkey' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Make an account' })).toBeInTheDocument();
  }

  it('the first-run row opens the surface at both sections', async () => {
    const { client } = makeAuth();
    const { store } = makeStore();
    render(<AppShell store={store} authClient={client} />);
    fireEvent.click(screen.getByRole('button', { name: /^Sign in or make an account/ }));
    expect(screen.getByRole('heading', { name: 'Sign in or make an account' })).toBeInTheDocument();
    expectBothSections();
  });

  it('the account card opens the surface at both sections', async () => {
    const { client } = makeAuth();
    const { store } = makeStore();
    render(<AppShell store={store} authClient={client} />);
    fireEvent.click(screen.getByRole('button', { name: 'Account' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sign in or make an account' }));
    expect(screen.getByRole('heading', { name: 'Sign in or make an account' })).toBeInTheDocument();
    expectBothSections();
  });

  it('Mine on Estante’s passkey button opens both sections; its emailed link opens the email step with the field focused', async () => {
    const { client } = makeAuth();
    const { store, emit } = makeStore();
    render(<AppShell store={store} authClient={client} />);

    emit(event(EventKind.SHELF, SHELF));
    fireEvent.click(screen.getByRole('tab', { name: 'Books' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add a book' }));
    let dialog = screen.getByRole('dialog', { name: 'Add a book' });
    emit(event(EventKind.MINE, { status: 'signed_out', books: [] }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Sign in with a passkey' }));
    expect(screen.getByRole('heading', { name: 'Sign in or make an account' })).toBeInTheDocument();
    expectBothSections();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Add a book' }));
    dialog = screen.getByRole('dialog', { name: 'Add a book' });
    emit(event(EventKind.MINE, { status: 'signed_out', books: [] }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'No passkey here? Email me a link' }));
    expect(screen.getByRole('heading', { name: 'Email me a link' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your email' })).toHaveFocus());
    expect(screen.queryByRole('group', { name: 'New here?' })).toBeNull();
  });

  it('an invitation in its prompt phase shows the invitation heading and both sections', () => {
    const { client } = makeAuth();
    const { store, emit } = makeStore();
    render(<AppShell store={store} authClient={client} inviteToken="tok_inv" />);
    emit(event(EventKind.NEED_ACCOUNT, { token: 'tok_inv' }));
    expect(screen.getByRole('heading', { name: 'You’re invited to a book on Estante' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Sign in or make an account' })).toBeNull();
    expectBothSections();
  });

  it('Make an account from the first-run row attaches the home book while Add a recovery email still shows; Not now closes the surface', async () => {
    const { client, calls } = makeAuth();
    const { store, sent } = makeStore();
    render(<AppShell store={store} authClient={client} />);
    fireEvent.click(screen.getByRole('button', { name: /^Sign in or make an account/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Make an account' }));

    await screen.findByRole('heading', { name: 'Add a recovery email' });
    const attach = sent.find((m) => m.kind === CommandKind.ATTACH_HOME);
    expect(attach).toBeTruthy();
    expect(attach.payload).toMatchObject({ accountId: 'u_new' });
    expect(calls.some((c) => c.path.includes('/authenticate/'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('heading', { name: 'Add a recovery email' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'New here?' })).toBeNull();
    expect(screen.getByRole('tablist', { name: 'Destinations' })).toBeInTheDocument();
  });

  it('Make an account from an invitation re-sends the accept while the step shows; Not now leaves the step', async () => {
    const { client } = makeAuth();
    const { store, emit, sent } = makeStore();
    render(<AppShell store={store} authClient={client} inviteToken="tok_inv" />);
    emit(event(EventKind.NEED_ACCOUNT, { token: 'tok_inv' }));
    const accepts = () => sent.filter((m) => m.kind === CommandKind.ADD_BY_LINK).length;
    expect(accepts()).toBe(1);

    fireEvent.click(screen.getByRole('button', { name: 'Make an account' }));
    await screen.findByRole('heading', { name: 'Add a recovery email' });
    expect(accepts()).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByRole('heading', { name: 'Add a recovery email' })).toBeNull();
    // Behind it, the invitation is being opened.
    expect(screen.getByRole('heading', { name: 'Opening the invitation' })).toBeInTheDocument();
  });

  it('Use a passkey from the first-run row signs in: authenticate, never register, and no recovery step', async () => {
    const { client, calls } = makeAuth();
    const { store, sent } = makeStore();
    render(<AppShell store={store} authClient={client} />);
    fireEvent.click(screen.getByRole('button', { name: /^Sign in or make an account/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Use a passkey' }));

    await waitFor(() => expect(sent.some((m) => m.kind === CommandKind.ATTACH_HOME)).toBe(true));
    expect(calls.some((c) => c.path === '/api/auth/passkey/authenticate/finish')).toBe(true);
    expect(calls.some((c) => c.path.includes('/register/'))).toBe(false);
    await waitFor(() => expect(screen.queryByRole('group', { name: 'New here?' })).toBeNull());
    expect(screen.queryByRole('heading', { name: 'Add a recovery email' })).toBeNull();
  });
});
