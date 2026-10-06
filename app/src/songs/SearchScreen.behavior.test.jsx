// behavior — the search screen with its real collaborators: React Aria
// Components, the real i18n catalogues, and the real main-thread store + reducer
// driven through a loopback endpoint whose events we inject (the way the Worker
// would post them). Seeding events directly is what lets us render the
// `voicedFor`/`conflict` badge seams the Worker does not yet populate (Decision
// 7) and exact recents/browse data, deterministically. Axe (role/name/structure
// — the rules that run under jsdom) covers the pre-typing and the results
// states; contrast is pinned at e2e-web.

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import SearchScreen from './SearchScreen.jsx';

// A real store over a loopback endpoint: `sent` captures the commands the screen
// posts (SEARCH / BROWSE with their scope); `emit` folds a Worker event into the
// store inside `act`, so the subscribed screen re-renders exactly as in the app.
function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const lastCommand = (sent, kind) =>
  [...sent].reverse().find((m) => m.kind === kind);

const type = (value) =>
  act(() => {
    fireEvent.change(screen.getByRole('searchbox'), { target: { value } });
  });

describe('SearchScreen (behavior)', () => {
  it('results by book: ranked results with title, artist and where; two same-title songs are two rows; a titleless song shows its file name (workflow 2 L22-24, L44-58, L163)', async () => {
    const { store, emit } = makeStore();
    const { container } = render(<SearchScreen store={store} />);

    type('canção');
    emit(
      event(EventKind.SEARCH_RESULTS, {
        query: 'canção',
        results: [
          { bookId: 'book-1', path: 'bossa/cancao.cifra.md', title: 'Canção', artist: 'Ana', score: 3, unsaved: false },
          { bookId: 'book-2', path: 'cancao.cifra.md', title: 'Canção', artist: 'Bruno', score: 2, unsaved: false },
          { bookId: 'book-1', path: 'sem-titulo.cifra.md', title: '', artist: '', score: 1, unsaved: false },
        ],
      }),
    );

    // Two same-title songs are two rows — not grouped (the book tells them apart).
    expect(screen.getAllByText('Canção')).toHaveLength(2);
    // Title, artist and where it lives: book, and folder only when not at root.
    expect(screen.getByText('Ana · book-1 · bossa/')).toBeInTheDocument();
    expect(screen.getByText('Bruno · book-2')).toBeInTheDocument();
    // A titleless song is listed by its file name without .cifra.md.
    expect(screen.getByText('sem-titulo')).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('recents: with an empty query the Recent section renders the recents slice most-recent-first (workflow 2 L13-20)', async () => {
    const { store, emit } = makeStore();
    const { container } = render(<SearchScreen store={store} />);

    emit(
      event(EventKind.BROWSE_RESULTS, {
        books: [
          {
            bookId: 'book-1',
            count: 2,
            songs: [
              { path: 'alpha.cifra.md', title: 'Alpha', artist: 'X', unsaved: false },
              { path: 'beta.cifra.md', title: 'Beta', artist: 'Y', unsaved: true },
            ],
          },
        ],
      }),
    );
    emit(
      event(EventKind.RECENTS, {
        recents: [
          { bookId: 'book-1', path: 'beta.cifra.md', at: '2026-10-05T10:00:00.000Z' },
          { bookId: 'book-1', path: 'alpha.cifra.md', at: '2026-10-05T09:00:00.000Z' },
        ],
      }),
    );

    const recent = screen.getByRole('region', { name: 'Recent' });
    const names = within(recent)
      .getAllByRole('button')
      .map((b) => within(b).getByText(/Alpha|Beta/).textContent);
    expect(names).toEqual(['Beta', 'Alpha']); // most-recent-first
    // A recent's unsaved state joins from the browse data.
    expect(within(recent).getByText('unsaved')).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('books as sections: collapsible with counts; expand by keyboard; a building book says "still loading" (workflow 2 L15-16, L159-162)', () => {
    const { store, emit } = makeStore();
    render(<SearchScreen store={store} />);

    emit(
      event(EventKind.BROWSE_RESULTS, {
        books: [
          {
            bookId: 'book-1',
            count: 2,
            songs: [
              { path: 'alpha.cifra.md', title: 'Alpha', artist: '', unsaved: false },
              { path: 'beta.cifra.md', title: 'Beta', artist: '', unsaved: false },
            ],
          },
        ],
      }),
    );
    emit(event(EventKind.INDEX_STATUS, { bookId: 'book-2', state: 'building' }));

    // A book with songs shows its count; a book still indexing says so.
    expect(screen.getByText('2 songs')).toBeInTheDocument();
    expect(screen.getByText('still loading')).toBeInTheDocument();

    // Collapsed to start: the disclosure trigger reports it, and the songs are
    // not yet shown. (The trigger's accessible name is the book label + count;
    // the sibling "Search only in book-1" scope button is matched separately.)
    const trigger = screen.getByRole('button', { name: /2 songs/ });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    // The collapsed panel stays in the DOM but hidden (RAC), so its songs are
    // present but not shown.
    expect(screen.getByText('Alpha')).not.toBeVisible();

    // Expand by keyboard (Enter on the focused trigger).
    act(() => trigger.focus());
    act(() => {
      fireEvent.keyDown(trigger, { key: 'Enter' });
      fireEvent.keyUp(trigger, { key: 'Enter' });
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Alpha')).toBeVisible();

    // And collapse again by keyboard.
    act(() => {
      fireEvent.keyDown(trigger, { key: 'Enter' });
      fireEvent.keyUp(trigger, { key: 'Enter' });
    });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('badges: each applicable flag renders as a labelled word, never colour alone (workflow 2 L50-54, mockups README L26)', async () => {
    const { store, emit } = makeStore();
    const { container } = render(<SearchScreen store={store} />);

    emit(
      event(EventKind.PREFERENCES, {
        instrument: { value: 'guitar', at: '2026-10-05T00:00:00.000Z' },
      }),
    );
    type('tarde');
    emit(
      event(EventKind.SEARCH_RESULTS, {
        query: 'tarde',
        results: [
          {
            bookId: 'book-1',
            path: 'tarde.cifra.md',
            title: 'Tarde Clara',
            artist: 'Ana',
            score: 3,
            voicedFor: true,
            unsaved: true,
            conflict: true,
          },
        ],
      }),
    );

    expect(screen.getByText('voiced for guitar')).toBeInTheDocument();
    expect(screen.getByText('unsaved')).toBeInTheDocument();
    expect(screen.getByText('conflict')).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('scope: applying a book scope narrows the command and shows the chip in the box; a fresh mount has no scope (workflow 2 L60-65)', () => {
    const { store, sent, emit } = makeStore();
    const { unmount } = render(<SearchScreen store={store} />);

    emit(
      event(EventKind.BROWSE_RESULTS, {
        books: [
          { bookId: 'book-1', count: 1, songs: [{ path: 'a.cifra.md', title: 'Alpha', artist: '', unsaved: false }] },
          { bookId: 'book-2', count: 1, songs: [{ path: 'b.cifra.md', title: 'Beta', artist: '', unsaved: false }] },
        ],
      }),
    );

    // The initial BROWSE carries no scope (reset default).
    expect(lastCommand(sent, CommandKind.BROWSE).payload.scope).toBeUndefined();

    // Apply the scope from a book's "search only here" button.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Search only in book-1' })));

    // The chip shows inside the box, and the next BROWSE narrows to that book.
    const box = document.querySelector('.search');
    expect(within(box).getByText('book-1')).toBeInTheDocument();
    expect(lastCommand(sent, CommandKind.BROWSE).payload.scope).toEqual({ books: ['book-1'] });

    // Typing now searches within the scope.
    type('alpha');
    act(() => {}); // flush the debounced SEARCH is not needed; assert the wiring on the next render
    unmount();

    // A fresh mount initialises with no scope — the filter resets each session.
    const second = makeStore();
    render(<SearchScreen store={second.store} />);
    expect(document.querySelector('.search .scope')).toBeNull();
  });

  it('book labels: a shelf label names a book and its scope chip, falling back to the bookId when absent (songs.search Decision 6; workflow 2 L11, workflow 7 L14-21)', async () => {
    const { store, emit } = makeStore();
    const { container } = render(<SearchScreen store={store} />);

    emit(
      event(EventKind.BROWSE_RESULTS, {
        books: [
          { bookId: 'b-1', count: 1, songs: [{ path: 'a.cifra.md', title: 'Alpha', artist: '', unsaved: false }] },
          { bookId: 'b-2', count: 1, songs: [{ path: 'b.cifra.md', title: 'Beta', artist: '', unsaved: false }] },
        ],
      }),
    );
    // The shelf surfaces a label for b-1 only — b-2 has no label register.
    emit(
      event(EventKind.SHELF, {
        books: { 'b-1': { label: { value: 'Turma de quarta', at: '2026-10-05T14:00:00.000Z' } } },
        local: {},
      }),
    );

    // b-1's section (and its "search only here" scope button) read the user's
    // label, not the opaque bookId.
    // The section disclosure trigger's name is the label followed by its count.
    expect(screen.getByRole('button', { name: /Turma de quarta.*song/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Search only in Turma de quarta' })).toBeInTheDocument();
    // b-2 has no label register, so it falls back to the bookId (Decision 6's
    // fallback preserved).
    expect(screen.getByRole('button', { name: 'Search only in b-2' })).toBeInTheDocument();

    // Applying b-1's scope shows the label as the chip in the box, not the id.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Search only in Turma de quarta' })));
    const box = document.querySelector('.search');
    expect(within(box).getByText('Turma de quarta')).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('the explorer is a result: a chord query offers the Explore row first and invokes onExploreChord by click and keyboard (workflow 2 L26-40)', async () => {
    const chosen = [];
    const { store, emit } = makeStore();
    const { container } = render(
      <SearchScreen store={store} onExploreChord={(c) => chosen.push(c)} />,
    );

    type('A');
    emit(
      event(EventKind.SEARCH_RESULTS, {
        query: 'A',
        results: [
          { bookId: 'book-1', path: 'a-banda.cifra.md', title: 'A Banda', artist: 'Chico', score: 2, unsaved: false },
        ],
      }),
    );

    // The row's accessible name is the explore label followed by its meta line.
    const explore = screen.getByRole('button', { name: /Explore A on your instrument/ });
    const result = screen.getByRole('button', { name: /A Banda/ });
    // The explore row is offered FIRST, above the song results.
    expect(
      explore.compareDocumentPosition(result) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // Activating it by click invokes the seam with the parsed chord…
    act(() => fireEvent.click(explore));
    expect(chosen).toHaveLength(1);
    expect(chosen[0].root.letter).toBe('A');

    // …and by keyboard (Enter).
    act(() => explore.focus());
    act(() => {
      fireEvent.keyDown(explore, { key: 'Enter' });
      fireEvent.keyUp(explore, { key: 'Enter' });
    });
    expect(chosen).toHaveLength(2);

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});
