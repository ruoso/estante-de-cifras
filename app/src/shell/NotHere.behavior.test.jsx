import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createStore } from '../worker/store.js';
import { event, EventKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { WIDE_QUERY } from './layout-mode.js';
import AppShell from './AppShell.jsx';

// behavior (shell.routing) — an address for something not on this device opens
// a plain not-here screen, never an empty song. AppShell booted at the address
// over a synchronous fake Worker port. Pins workflow 7 §Links to books
// (L52-60), workflow 1 §Invited (L61-66: names nothing about the book) and
// workflow 12 L83-85 (a missing item says so).

const AT = '2026-10-15T00:00:00.000Z';
const BOOK = 'b1';
const BOOK_LABEL = 'Banda do Bairro';
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
// A book whose tree has one song, and one present only as deleted.
const ENTRIES = [
  { path: 'choro/outra.cifra.md', status: null },
  { path: 'choro/apagada.cifra.md', status: 'deleted' },
];

function makeStore() {
  const endpoint = { postMessage: () => {}, onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, emit };
}

function bootAt(pathname) {
  history.replaceState(null, '', pathname);
  const { store, emit } = makeStore();
  const view = render(<AppShell store={store} />);
  return { ...view, emit };
}

beforeEach(() => {
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
  history.replaceState(null, '', '/');
});

describe('NotHere (behavior)', () => {
  it('a book not on this device names nothing about it', async () => {
    const { container, emit } = bootAt('/b/unknown-book-id/x.cifra.md');
    emit(event(EventKind.SHELF, SHELF));
    const heading = screen.getByRole('heading', { name: 'This link doesn’t open a book' });
    expect(heading).toHaveFocus();
    expect(screen.queryByRole('group', { name: /x/ })).not.toBeInTheDocument();
    expect(container.textContent).not.toContain('unknown-book-id');
    expect(container.textContent).not.toContain('x.cifra.md');
    // The URL stays at the address while not-here shows.
    expect(location.pathname).toBe('/b/unknown-book-id/x.cifra.md');
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Go to Books' }));
    expect(screen.getByRole('tab', { name: 'Books' })).toHaveAttribute('aria-selected', 'true');
    expect(location.pathname).toBe('/books');
  });

  it('a song no longer in the book says so and offers the book', async () => {
    const { container, emit } = bootAt('/b/b1/choro/sumida.cifra.md');
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.TREE, { bookId: BOOK, entries: ENTRIES }));
    expect(screen.getByRole('heading', { name: `This song isn’t in ${BOOK_LABEL}` })).toBeInTheDocument();
    expect(screen.getByText('It may have been renamed, moved or deleted.')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: `Open ${BOOK_LABEL}’s songs` }));
    expect(location.pathname).toBe('/b/b1');
    expect(screen.getByRole('button', { name: 'Clear filter' })).toBeInTheDocument();
  });

  it('a song present only as deleted is not here either', () => {
    const { emit } = bootAt('/b/b1/choro/apagada.cifra.md');
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.TREE, { bookId: BOOK, entries: ENTRIES }));
    expect(screen.getByRole('heading', { name: `This song isn’t in ${BOOK_LABEL}` })).toBeInTheDocument();
  });

  it('a setlist no longer in the book', async () => {
    const { container, emit } = bootAt('/b/b1/sumido.setlist.md');
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.TREE, { bookId: BOOK, entries: ENTRIES }));
    expect(screen.getByRole('heading', { name: `This setlist isn’t in ${BOOK_LABEL}` })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('Back from not-here goes to search at /', () => {
    const { emit } = bootAt('/b/unknown-book-id');
    emit(event(EventKind.SHELF, SHELF));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(location.pathname).toBe('/');
  });
});
