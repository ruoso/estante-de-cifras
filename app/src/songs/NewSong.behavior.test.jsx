// Behavior — the new-song flow through the real shell, RAC and i18n (songs.new_song,
// workflow 3). It renders <AppShell/> over a store double, drives the ways in
// (Write a song, Create "{query}", new song in this book), and the host the
// NEW_SONG_READY reply mounts, seeding the Worker's replies by emitting events.
// axe (WCAG 2.1 AA) over the ways-in surface, the editor host and the which-book
// control. Fixtures are purpose-written — never anyone's copyrighted words.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { MY_SONGS_ID } from '../worker/my-songs.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { WIDE_QUERY } from '../shell/layout-mode.js';
import AppShell from '../shell/AppShell.jsx';

// CodeMirror measures geometry jsdom lacks; stub it so the host's editor mounts
// (real geometry is covered at e2e). Mirrors SongEditor.behavior.test.jsx.
Range.prototype.getClientRects = function getClientRects() {
  return [];
};
Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
};

// The shell reads the viewport through matchMedia (jsdom has none). Pin it to
// narrow — the host is a full screen there and on wide alike (W03).
globalThis.matchMedia = (media) => ({
  media,
  matches: media === WIDE_QUERY ? false : false,
  addEventListener() {},
  removeEventListener() {},
});

afterEach(() => cleanup());

const AT = '2026-10-06T00:00:00.000Z';

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const lastCommand = (sent, kind) => sent.filter((c) => c.kind === kind).at(-1);

// A shelf with *My songs* (local), an editor-role shared book (push-capable) and
// a reader-role shared book (not push-capable).
const SHELF = {
  books: {
    'book-editor': {
      label: { value: 'Banda do Bairro', at: AT },
      role: { value: 'editor', at: AT },
      position: { value: 1, at: AT },
    },
    'book-reader': {
      label: { value: 'Turma de Quarta', at: AT },
      role: { value: 'reader', at: AT },
      position: { value: 2, at: AT },
    },
  },
  local: {
    [MY_SONGS_ID]: { title: { value: 'My songs', at: AT }, position: { value: 0, at: AT } },
  },
};

describe('ways in → NEW_SONG', () => {
  it('the empty shelf "Write a song" starts a new song into My songs (workflow 3 §Ways in L12)', async () => {
    const { store, sent, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);

    // First-run ways-in surface is axe-clean.
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    act(() => fireEvent.click(screen.getByRole('button', { name: /Write a song/ })));
    const cmd = lastCommand(sent, CommandKind.NEW_SONG);
    expect(cmd).toBeTruthy();
    expect(cmd.payload.targetBookId).toBeNull(); // → My songs

    // The Worker ensures the book, surfaces the shelf and replies with the path.
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.NEW_SONG_READY, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md' }));

    // The host is up, showing which book the song goes into.
    expect(screen.getByText(/In My songs/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change book' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('the Create "{query}" row carries the query as the title (workflow 3 §Ways in L10-11)', async () => {
    const { store, sent, emit } = makeStore();
    render(<AppShell store={store} />);

    act(() =>
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'Garota de Ipanema' },
      }),
    );
    const createRow = screen.getByRole('button', { name: /Create .Garota de Ipanema./ });
    expect(createRow).toBeInTheDocument();
    act(() => fireEvent.click(createRow));

    expect(lastCommand(sent, CommandKind.NEW_SONG)).toBeTruthy();
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.NEW_SONG_READY, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md' }));

    // The query becomes the song's title — surfaced in the host's appbar.
    expect(screen.getByText('Garota de Ipanema')).toBeInTheDocument();
  });

  it('"new song in this book" starts a song into that book (workflow 3 §Ways in L13, §Which book L32-33)', async () => {
    const { store, sent, emit } = makeStore();
    render(<AppShell store={store} />);

    emit(event(EventKind.SHELF, SHELF));
    emit(
      event(EventKind.BROWSE_RESULTS, {
        books: [
          {
            bookId: 'book-editor',
            count: 1,
            songs: [{ path: 'a.cifra.md', title: 'A', artist: '', unsaved: false }],
          },
        ],
      }),
    );

    const button = screen.getByRole('button', { name: /New song in Banda do Bairro/ });
    act(() => fireEvent.click(button));
    expect(lastCommand(sent, CommandKind.NEW_SONG).payload.targetBookId).toBe('book-editor');

    emit(event(EventKind.NEW_SONG_READY, { bookId: 'book-editor', path: 'untitled.cifra.md' }));
    expect(screen.getByText(/In Banda do Bairro/)).toBeInTheDocument();
  });
});

describe('which book', () => {
  it('defaults to My songs and offers only push-capable books (workflow 3 §Which book L26-33)', async () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);

    act(() => fireEvent.click(screen.getByRole('button', { name: /Write a song/ })));
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.NEW_SONG_READY, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md' }));

    const changeBook = screen.getByRole('button', { name: 'Change book' });
    expect(changeBook).toBeInTheDocument();
    act(() => fireEvent.click(changeBook));

    // The menu offers My songs (local) and the editor-role book, never the
    // reader-role book (`canSaveFor`); the home book is not on the shelf.
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent);
    expect(items).toContain('My songs');
    expect(items).toContain('Banda do Bairro');
    expect(items).not.toContain('Turma de Quarta');
  });
});

describe('the first save', () => {
  it('pressing Save sends NAME_AND_SAVE, and SAVED closes the which-book control (workflow 3 §The first save)', async () => {
    const { store, sent, emit } = makeStore();
    render(<AppShell store={store} />);

    act(() => fireEvent.click(screen.getByRole('button', { name: /Write a song/ })));
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.NEW_SONG_READY, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md' }));

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    const cmd = lastCommand(sent, CommandKind.NAME_AND_SAVE);
    expect(cmd).toBeTruthy();
    expect(cmd.payload).toMatchObject({ bookId: MY_SONGS_ID, fromPath: 'untitled.cifra.md' });

    // The first save landed: the song is ordinary now, the which-book bar gone.
    emit(
      event(EventKind.SAVED, {
        bookId: MY_SONGS_ID,
        path: 'untitled.cifra.md',
        commit: 'abc123',
        pushed: false,
      }),
    );
    expect(screen.queryByRole('button', { name: 'Change book' })).not.toBeInTheDocument();
  });
});
