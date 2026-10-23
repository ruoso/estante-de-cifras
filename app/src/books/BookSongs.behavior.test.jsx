// behavior — a book's page (books.book_page; workflow 7 §A book's page; the
// Open-a-book board) with its real collaborators: React Aria Components, the
// real i18n catalogues, and the real main-thread store + reducer driven through
// a loopback endpoint whose events we inject the way the Worker posts them.
// Axe (the rules that run under jsdom) on every state. All names are written
// for this test (no song text).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import BookSongs from './BookSongs.jsx';

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const AT = '2026-10-23T12:00:00.000Z';
const reg = (value) => ({ value, at: AT });

const SHELF = event(EventKind.SHELF, {
  books: {
    'srv-read': { label: reg('Choros da Bia'), position: reg(1), role: reg('reader') },
  },
  local: {
    'l-ex': { title: reg('Exercícios'), position: reg(0) },
  },
});

const browse = (bookId, songs) =>
  event(EventKind.BROWSE_RESULTS, { books: songs.length ? [{ bookId, count: songs.length, songs }] : [] });

const SONGS = [
  { path: 'escala-maior.cifra.md', title: 'Escala maior', artist: 'Lia', unsaved: false },
  { path: 'arpejos/arpejo-um.cifra.md', title: 'Arpejo um', artist: '', unsaved: true },
];

const lastCommand = (sent, kind) => [...sent].reverse().find((m) => m.kind === kind);

const type = (value) =>
  act(() => {
    fireEvent.change(screen.getByRole('searchbox'), { target: { value } });
  });

// The tab stops in reading order (jsdom does no tabbing of its own).
const tabStops = (container) =>
  [...container.querySelectorAll('button, input, [tabindex]')].filter(
    (el) => !el.disabled && el.getAttribute('tabindex') !== '-1',
  );

describe('BookSongs — a book’s page (books.book_page)', () => {
  it('names the book as the page’s heading, then Books, New song and Manage in the book’s card, and the search, then the songs as one flat list; axe clean', async () => {
    const { store, sent, emit } = makeStore();
    const onBack = vi.fn();
    const { container } = render(<BookSongs store={store} bookId="l-ex" onBack={onBack} />);
    emit(SHELF);
    emit(event(EventKind.INDEX_STATUS, { bookId: 'l-ex', state: 'ready', songs: 2 }));
    emit(browse('l-ex', SONGS));

    // It browses the one book.
    expect(lastCommand(sent, CommandKind.BROWSE).payload).toEqual({ scope: { books: ['l-ex'] } });

    expect(screen.getByRole('heading', { level: 1, name: 'Exercícios' })).toBeInTheDocument();
    expect(container.querySelector('.book-bar')).toHaveTextContent('On this device · can save · 2 songs');

    // Every song, flat: no book section to open, no book named on each row; a
    // song in a folder says its folder.
    expect(container.querySelector('.book')).toBeNull();
    const list = within(container.querySelector('.search-results')).getAllByRole('button', { name: /^(Escala maior|Arpejo um)/ });
    expect(list).toHaveLength(2);
    expect(screen.getByText('Lia')).toBeInTheDocument();
    expect(screen.getByText('arpejos/')).toBeInTheDocument();
    expect(screen.queryByText(/Exercícios ·/)).toBeNull();

    const stops = tabStops(container);
    const back = screen.getByRole('button', { name: 'Back to Books' });
    const manage = screen.getByRole('button', { name: 'Manage Exercícios' });
    const newSong = screen.getByRole('button', { name: 'New song in Exercícios' });
    const field = screen.getByRole('searchbox', { name: 'Search in Exercícios' });
    expect(back).toHaveTextContent('Books');
    expect(newSong).toHaveTextContent('New song');
    expect(container.querySelector('.book-bar')).toContainElement(newSong);
    expect(stops.indexOf(back)).toBeLessThan(stops.indexOf(newSong));
    expect(stops.indexOf(newSong)).toBeLessThan(stops.indexOf(manage));
    expect(stops.indexOf(manage)).toBeLessThan(stops.indexOf(field));
    expect(stops.indexOf(field)).toBeLessThan(stops.indexOf(list[0]));

    act(() => fireEvent.click(back));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('New song starts a song in this book; a song row opens it; Save all saves the book’s changed songs', () => {
    const { store, emit } = makeStore();
    const onWriteSong = vi.fn();
    const onOpenSong = vi.fn();
    render(<BookSongs store={store} bookId="l-ex" onWriteSong={onWriteSong} onOpenSong={onOpenSong} />);
    emit(SHELF);
    emit(browse('l-ex', SONGS));

    act(() => fireEvent.click(screen.getByRole('button', { name: 'New song in Exercícios' })));
    expect(onWriteSong).toHaveBeenCalledWith({ bookId: 'l-ex' });

    act(() => fireEvent.click(screen.getByRole('button', { name: /^Escala maior/ })));
    expect(onOpenSong).toHaveBeenCalledWith({ bookId: 'l-ex', path: 'escala-maior.cifra.md' });

    expect(screen.getByText('1 song with unsaved changes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save all changes in Exercícios' })).toBeInTheDocument();
  });

  it('an empty book says so, and New song is the way on', async () => {
    const { store, emit } = makeStore();
    const { container } = render(<BookSongs store={store} bookId="l-ex" />);
    emit(SHELF);
    emit(event(EventKind.INDEX_STATUS, { bookId: 'l-ex', state: 'ready', songs: 0 }));
    emit(browse('l-ex', []));

    expect(screen.getByText('No songs in this book yet. Start one with New song.')).toBeInTheDocument();
    expect(container.querySelector('.book-bar')).toHaveTextContent('0 songs');
    expect(screen.getByRole('button', { name: 'New song in Exercícios' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('while the book is still being read it says so in words, not as an empty book', () => {
    const { store, emit } = makeStore();
    render(<BookSongs store={store} bookId="l-ex" />);
    emit(SHELF);
    emit(event(EventKind.INDEX_STATUS, { bookId: 'l-ex', state: 'building' }));

    expect(screen.getByText('Still loading this book’s songs…')).toBeInTheDocument();
    expect(screen.queryByText(/No songs in this book yet/)).toBeNull();
  });

  it('a book the person cannot save to offers no New song, and its empty state says nothing of one', () => {
    const { store, emit } = makeStore();
    render(<BookSongs store={store} bookId="srv-read" />);
    emit(SHELF);
    emit(event(EventKind.INDEX_STATUS, { bookId: 'srv-read', state: 'ready', songs: 0 }));
    emit(browse('srv-read', []));

    expect(screen.queryByRole('button', { name: /^New song/ })).toBeNull();
    expect(screen.getByText('No songs in this book yet.')).toBeInTheDocument();
  });

  it('typing searches this book only; nothing matched offers the song as a new one in this book', async () => {
    const { store, sent, emit } = makeStore();
    const onWriteSong = vi.fn();
    const { container } = render(<BookSongs store={store} bookId="l-ex" onWriteSong={onWriteSong} />);
    emit(SHELF);
    emit(browse('l-ex', SONGS));

    type('escala');
    await waitFor(() =>
      expect(lastCommand(sent, CommandKind.SEARCH)?.payload).toEqual({ query: 'escala', scope: { books: ['l-ex'] } }),
    );
    emit(
      event(EventKind.SEARCH_RESULTS, {
        query: 'escala',
        results: [{ bookId: 'l-ex', path: 'escala-maior.cifra.md', title: 'Escala maior', artist: 'Lia', score: 1, unsaved: false }],
      }),
    );
    expect(screen.getByRole('heading', { name: /escala/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Escala maior/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Arpejo um/ })).toBeNull();

    type('valsa');
    emit(event(EventKind.SEARCH_RESULTS, { query: 'valsa', results: [] }));
    expect(screen.getByRole('heading', { name: 'No songs match' })).toBeInTheDocument();
    expect(screen.getByText('Searched titles, artists, sections, words and chords in Exercícios.')).toBeInTheDocument();
    act(() => fireEvent.click(screen.getByRole('button', { name: /^Create “valsa”/ })));
    expect(onWriteSong).toHaveBeenCalledWith({ title: 'valsa', bookId: 'l-ex' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});
