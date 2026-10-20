// behavior — the search screen with its real collaborators: React Aria
// Components, the real i18n catalogues, and the real main-thread store + reducer
// driven through a loopback endpoint whose events we inject (the way the Worker
// would post them). Seeding events directly is what lets us render the
// `voicedFor`/`conflict` badge seams the Worker does not yet populate (Decision
// 7) and exact recents/browse data, deterministically. Axe (role/name/structure
// — the rules that run under jsdom) covers the pre-typing and the results
// states; contrast is pinned at e2e-web.

import { useState } from 'react';
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

// A shelf naming the given books, so a test about something else reads names,
// not ids (a book with no name reads *Untitled book* — songs.no_raw_ids).
const AT = '2026-10-05T14:00:00.000Z';
const labelled = (labels) =>
  event(EventKind.SHELF, {
    books: Object.fromEntries(
      Object.entries(labels).map(([id, label], i) => [id, { label: { value: label, at: AT }, position: { value: i, at: AT } }]),
    ),
    local: {},
  });

const lastCommand = (sent, kind) =>
  [...sent].reverse().find((m) => m.kind === kind);

const type = (value) =>
  act(() => {
    fireEvent.change(screen.getByRole('searchbox'), { target: { value } });
  });

describe('SearchScreen (behavior)', () => {
  it('results by book: ranked results with title, artist and where; two same-title songs are two rows; a titleless song reads Untitled song (workflow 2 L22-24, L44-58, L180-182 amended)', async () => {
    const { store, emit } = makeStore();
    const { container } = render(<SearchScreen store={store} />);
    emit(labelled({ 'book-1': 'Choros da Lia', 'book-2': 'Banda do Bairro' }));

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
    expect(screen.getByText('Ana · Choros da Lia · bossa/')).toBeInTheDocument();
    expect(screen.getByText('Bruno · Banda do Bairro')).toBeInTheDocument();
    // A titleless song is listed as *Untitled song*, never by its file name
    // (workflow 3 L37-41).
    expect(screen.getByText('Untitled song')).toBeInTheDocument();
    expect(screen.queryByText(/sem-titulo/)).toBeNull();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a setlist result is marked "Setlist", shows its title and location (not the file name), offers no Add-to-setlist, and opens via onOpenSetlist (books.setlist_search; workflow 12 L33-34, DIRECTION §4 L470, mockups README L26)', async () => {
    const opened = [];
    const added = [];
    const { store, emit } = makeStore();
    const { container } = render(
      <SearchScreen
        store={store}
        onOpenSetlist={(x) => opened.push(x)}
        onAddToSetlist={(x) => added.push(x)}
      />,
    );
    emit(labelled({ 'book-1': 'Choros da Lia' }));

    type('noite');
    emit(
      event(EventKind.SEARCH_RESULTS, {
        query: 'noite',
        results: [
          { bookId: 'book-1', path: 'shows/minha-noite.setlist.md', title: 'Minha Noite', kind: 'setlist', score: 3, unsaved: false },
          { bookId: 'book-1', path: 'noite.cifra.md', title: 'Noite Azul', artist: 'Ana', kind: 'song', score: 2, unsaved: false },
        ],
      }),
    );

    // Marked by the WORD "Setlist" (status by a word, never colour alone).
    expect(screen.getByText('Setlist')).toBeInTheDocument();
    // Title and where it lives — never the *.setlist.md file name (DIRECTION §4 L470).
    expect(screen.getByText('Minha Noite')).toBeInTheDocument();
    expect(screen.getByText('Choros da Lia · shows/')).toBeInTheDocument();
    expect(screen.queryByText(/minha-noite\.setlist\.md/)).toBeNull();

    // No Add-to-setlist on the setlist row; the song row keeps it.
    expect(screen.queryByRole('button', { name: 'Add Minha Noite to a setlist' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Add Noite Azul to a setlist' })).toBeInTheDocument();

    // Opening it routes through onOpenSetlist with its location; the button's
    // accessible name carries the title AND that it is a setlist.
    const setlistButton = screen.getByRole('button', { name: /Minha Noite/ });
    expect(setlistButton).toHaveAccessibleName(/Setlist/);
    act(() => fireEvent.click(setlistButton));
    expect(opened).toEqual([{ bookId: 'book-1', path: 'shows/minha-noite.setlist.md' }]);
    expect(added).toHaveLength(0);

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

  it('a book still coming down reads its fill word, never "0 songs", and offers no New song; once it lands it reads its count (books.setlists_resilient Constraint 7; workflow 2 L177-179)', async () => {
    const { store, emit } = makeStore();
    const { container } = render(<SearchScreen store={store} />);

    // Two books of the shelf fill, nothing indexed for either.
    // Named as this device's books, so either can take a new song once it lands.
    emit(
      event(EventKind.SHELF, {
        books: {},
        local: {
          'book-a': { title: { value: 'Roda A', at: AT }, position: { value: 0, at: AT } },
          'book-b': { title: { value: 'Roda B', at: AT }, position: { value: 1, at: AT } },
        },
      }),
    );
    emit(event(EventKind.SHELF_FILL, { bookId: 'book-a', state: 'waiting', progress: 0 }));
    emit(event(EventKind.SHELF_FILL, { bookId: 'book-b', state: 'cloning', progress: 40 }));

    // Both are listed, by the shelf's word.
    expect(screen.getByRole('button', { name: /Roda A.*waiting/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Roda B.*cloning 40%/ })).toBeInTheDocument();
    expect(screen.getByText('waiting')).toBeInTheDocument();
    expect(screen.getByText('cloning 40%')).toBeInTheDocument();
    expect(screen.queryByText(/\b0 songs/)).not.toBeInTheDocument();
    // Nothing is there to write into yet: no New song, no Save all.
    expect(screen.queryByRole('button', { name: 'New song in Roda A' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New song in Roda B' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save all/ })).not.toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // book-b lands: fill ready, indexed with its songs → its song count.
    emit(event(EventKind.SHELF_FILL, { bookId: 'book-b', state: 'ready', progress: 100, songs: 2 }));
    emit(event(EventKind.INDEX_STATUS, { bookId: 'book-b', state: 'ready', songs: 2 }));
    emit(
      event(EventKind.BROWSE_RESULTS, {
        books: [
          {
            bookId: 'book-b',
            count: 2,
            songs: [
              { path: 'alpha.cifra.md', title: 'Alpha', artist: '', unsaved: false },
              { path: 'beta.cifra.md', title: 'Beta', artist: '', unsaved: false },
            ],
          },
        ],
      }),
    );
    expect(screen.getByRole('button', { name: /Roda B.*2 songs/ })).toBeInTheDocument();
    expect(screen.queryByText('cloning 40%')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New song in Roda B' })).toBeInTheDocument();
    // book-a is still waiting.
    expect(screen.getByText('waiting')).toBeInTheDocument();
    expect(screen.queryByText(/\b0 songs/)).not.toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('badges: each applicable flag renders as a labelled word, never colour alone (workflow 2 L50-54, mockups README L26)', async () => {
    const { store, emit } = makeStore();
    const { container } = render(<SearchScreen store={store} />);

    // The instrument in use, named by the chip's one short label
    // (shell.header_chrome): the standard-guitar fallback reads "Guitar".
    emit(
      event(EventKind.INSTRUMENTS, {
        instruments: [],
        inUseId: null,
        standard: { id: 'standard', catalogId: '6guitar', label: null, tuning: 'E2 A2 D3 G3 B3 E4' },
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

    expect(screen.getByText('voiced for Guitar')).toBeInTheDocument();
    expect(screen.getByText('unsaved')).toBeInTheDocument();
    expect(screen.getByText('conflict')).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('scope: applying a book scope narrows the command and shows the chip in the box; a fresh mount has no scope (workflow 2 L60-65)', () => {
    const { store, sent, emit } = makeStore();
    const { unmount } = render(<SearchScreen store={store} />);
    emit(labelled({ 'book-1': 'Choros da Lia', 'book-2': 'Banda do Bairro' }));

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
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Search only in Choros da Lia' })));

    // The chip shows inside the box, and the next BROWSE narrows to that book.
    const box = document.querySelector('.search');
    expect(within(box).getByText('Choros da Lia')).toBeInTheDocument();
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

  it('book labels: a shelf label names a book and its scope chip, falling back to Untitled book — never the bookId — when absent (songs.search Decision 6; workflow 2 L11, workflow 7 L14-21; songs.no_raw_ids)', async () => {
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
    // b-2 has no label register, so it reads *Untitled book*, never its id
    // (songs.no_raw_ids Constraint 1).
    expect(screen.getByRole('button', { name: 'Search only in Untitled book' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /b-2/ })).toBeNull();

    // Applying b-1's scope shows the label as the chip in the box, not the id.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Search only in Turma de quarta' })));
    const box = document.querySelector('.search');
    expect(within(box).getByText('Turma de quarta')).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  // songs.no_raw_ids acceptance — a book absent from the `shelf` slice (the
  // orphan the OPEN heal targets, or a hosted clone it never adopts) is
  // *Untitled book* in its section, a song row's meta, a recent and the scope
  // chip, and nowhere its id; a titleless song is *Untitled song*, not its
  // placeholder file name. Pins workflow 2 L180-185 (amended), workflow 3 L37-41.
  it('a book with no shelf entry reads Untitled book everywhere, never its id; a titleless song reads Untitled song; axe clean (songs.no_raw_ids; workflow 2 L180-185)', async () => {
    const ORPHAN = 'local-6467d4de-1111-4222-8333-944455556666';
    const { store, emit } = makeStore();
    const { container } = render(<SearchScreen store={store} />);
    emit(event(EventKind.SHELF, { books: {}, local: {} }));
    emit(
      event(EventKind.BROWSE_RESULTS, {
        books: [
          {
            bookId: ORPHAN,
            count: 2,
            songs: [
              { path: 'sets/untitled-2.cifra.md', title: '', artist: '', unsaved: false },
              { path: 'lua.cifra.md', title: 'Lua de Vidro', artist: '', unsaved: false },
            ],
          },
        ],
      }),
    );
    emit(event(EventKind.INDEX_STATUS, { bookId: ORPHAN, state: 'ready', songs: 2 }));
    emit(
      event(EventKind.RECENTS, {
        recents: [{ bookId: ORPHAN, path: 'lua.cifra.md', at: '2026-10-05T10:00:00.000Z' }],
      }),
    );

    // The section and the recent name the book *Untitled book*.
    expect(screen.getByRole('button', { name: /Untitled book.*2 songs/ })).toBeInTheDocument();
    const recent = screen.getByRole('region', { name: 'Recent' });
    expect(within(recent).getByText(/Untitled book/)).toBeInTheDocument();
    // The titleless song row reads *Untitled song*, its meta the book and folder.
    expect(screen.getAllByText('Untitled song').length).toBeGreaterThan(0);
    expect(screen.getByText('Untitled book · sets/')).toBeInTheDocument();
    expect(screen.queryByText(/untitled-\d|untitled$/)).toBeNull();
    expect(container.textContent).not.toContain(ORPHAN);
    expect(container.textContent).not.toMatch(/local-[0-9a-f]{8}/);
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // The scope chip names it the same way.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Search only in Untitled book' })));
    const box = document.querySelector('.search');
    expect(within(box).getByText('Untitled book')).toBeInTheDocument();
    expect(container.textContent).not.toContain(ORPHAN);
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

  it('names the instrument in use in the Explore row by the chip label (shell.header_chrome; workflow 2 L28)', async () => {
    const { store, emit } = makeStore();
    const { container } = render(<SearchScreen store={store} onExploreChord={() => {}} />);
    // The standard-guitar fallback (no instrument set up).
    emit(
      event(EventKind.INSTRUMENTS, {
        instruments: [],
        inUseId: null,
        standard: { id: 'standard', catalogId: '6guitar', label: null, tuning: 'E2 A2 D3 G3 B3 E4' },
      }),
    );
    type('A');
    expect(screen.getByRole('button', { name: /Explore A on your Guitar/ })).toBeInTheDocument();

    // A cavaquinho in use, added on its standard tuning under its default label.
    const cavaquinho = {
      id: 'c1',
      catalogId: 'cavaquinho',
      label: 'Cavaquinho · Standard (Brazil)',
      tuning: 'D4 G4 B4 D5',
    };
    emit(event(EventKind.INSTRUMENTS, { instruments: [cavaquinho], inUseId: 'c1', standard: null }));
    expect(screen.getByRole('button', { name: /Explore A on your Cavaquinho/ })).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('nothing matched: what was searched, Create, and the paste hint (W03#1 L40-46; workflow 3 §Ways in L15-17)', async () => {
    const { store, emit } = makeStore();
    const AT = '2026-10-18T00:00:00.000Z';
    emit(
      event(EventKind.SHELF, {
        books: { 'srv-b': { label: { value: 'Banda do Bairro', at: AT }, position: { value: 1, at: AT } } },
        local: { 'local-my-songs': { title: { value: 'My songs', at: AT }, position: { value: 0, at: AT } } },
      }),
    );
    const { container } = render(<SearchScreen store={store} />);

    type('Brisa de Março');
    emit(event(EventKind.SEARCH_RESULTS, { query: 'Brisa de Março', results: [] }));

    expect(screen.getByRole('heading', { level: 2, name: 'No songs match' })).toBeInTheDocument();
    expect(
      screen.getByText('Searched titles, artists, sections, words and chords in My songs and Banda do Bairro.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create .Brisa de Março./ })).toBeInTheDocument();
    expect(screen.getByText('Or paste a whole song, copied from anywhere, into a new one.')).toBeInTheDocument();
    // The paste hint is plain text, not a control.
    expect(screen.queryByRole('button', { name: /paste/i })).toBeNull();
    // The status line still announces the miss.
    expect(screen.getByRole('status')).toHaveTextContent('No songs match “Brisa de Março”.');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

// books.row_opens_songs — the bar above a book's songs (workflow 7 §A book's
// songs L60-73; workflow 2 §Scope): it shows while the scope is one book or a
// folder in it, stays while typing, and goes when ✕ clears the scope.
describe('SearchScreen — the book’s bar (books.row_opens_songs)', () => {
  const SHELF = event(EventKind.SHELF, {
    books: {},
    local: {
      'l-mine': { title: { value: 'My songs', at: 'x' }, position: { value: 0, at: 'x' } },
      'l-ex': { title: { value: 'Exercícios', at: 'x' }, position: { value: 1, at: 'x' } },
    },
  });
  const BROWSE = event(EventKind.BROWSE_RESULTS, {
    books: [
      {
        bookId: 'l-mine',
        count: 2,
        songs: [
          { path: 'manha.cifra.md', title: 'Manhã na varanda', artist: '', unsaved: false },
          { path: 'feira.cifra.md', title: 'Caminho da feira', artist: '', unsaved: false },
        ],
      },
    ],
  });

  // The shell holds the scope; this harness does the same, so ✕ clears it.
  function Scoped({ store, initial }) {
    const [scope, setScope] = useState(initial);
    return <SearchScreen store={store} scope={scope} onScopeChange={setScope} />;
  }

  // The tab stops in reading order (jsdom does no tabbing of its own).
  const tabStops = (container) =>
    [...container.querySelectorAll('button, input, [tabindex]')].filter(
      (el) => !el.disabled && el.getAttribute('tabindex') !== '-1',
    );

  it('with scope {bookId} the bar sits between the box and the results: after ✕, before the first result in tab order; axe clean (workflow 7 L60-67)', async () => {
    const { store, emit } = makeStore();
    const { container } = render(<Scoped store={store} initial={{ bookId: 'l-mine' }} />);
    emit(SHELF);
    emit(BROWSE);

    const bar = container.querySelector('.book-bar');
    expect(within(bar).getByRole('heading', { name: 'My songs' })).toBeInTheDocument();
    const box = container.querySelector('.search');
    const results = container.querySelector('.search-results');
    expect(box.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bar.compareDocumentPosition(results) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const stops = tabStops(container);
    const clear = screen.getByRole('button', { name: 'Clear filter' });
    const manage = screen.getByRole('button', { name: 'Manage My songs' });
    const first = within(results).getAllByRole('button')[0];
    expect(stops.indexOf(clear)).toBeLessThan(stops.indexOf(manage));
    expect(stops.indexOf(manage)).toBeLessThan(stops.indexOf(first));
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('shows for *Search only in* ({books:[id]}) and for a folder in the book ({bookId, prefix}) (workflow 7 L69-73)', () => {
    const one = makeStore();
    const { unmount } = render(<Scoped store={one.store} initial={{ books: ['l-mine'] }} />);
    one.emit(SHELF);
    expect(screen.getByRole('button', { name: 'Manage My songs' })).toBeInTheDocument();
    unmount();

    const folder = makeStore();
    render(<Scoped store={folder.store} initial={{ bookId: 'l-ex', prefix: 'escalas' }} />);
    folder.emit(SHELF);
    expect(screen.getByRole('button', { name: 'Manage Exercícios' })).toBeInTheDocument();
  });

  it('stays while typing, and ✕ clears the scope and the bar goes (workflow 7 L69-73; workflow 2 §Scope)', () => {
    const { store, emit } = makeStore();
    render(<Scoped store={store} initial={{ bookId: 'l-mine' }} />);
    emit(SHELF);

    type('manhã');
    expect(screen.getByRole('button', { name: 'Manage My songs' })).toBeInTheDocument();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Clear filter' })));
    expect(screen.queryByRole('button', { name: /^Manage/ })).toBeNull();
    expect(document.querySelector('.book-bar')).toBeNull();
  });

  it('a two-book scope or no scope shows no bar (workflow 2 §Scope)', () => {
    const two = makeStore();
    const { unmount } = render(<Scoped store={two.store} initial={{ books: ['l-mine', 'l-ex'] }} />);
    two.emit(SHELF);
    expect(document.querySelector('.book-bar')).toBeNull();
    unmount();

    const none = makeStore();
    render(<Scoped store={none.store} initial={null} />);
    none.emit(SHELF);
    expect(document.querySelector('.book-bar')).toBeNull();
  });

  it('a song in a book that needs you reads *conflict* once the book is engaged (workflow 9 §Meeting one)', () => {
    const { store, emit } = makeStore();
    render(<Scoped store={store} initial={{ bookId: 'l-mine' }} />);
    emit(SHELF);
    emit(BROWSE);
    emit(event(EventKind.SYNC, { bookId: 'l-mine', phase: 'needs_you' }));
    emit(
      event(EventKind.CONFLICTS, {
        bookId: 'l-mine',
        inProgress: true,
        songs: [{ path: 'manha.cifra.md', title: 'Manhã na varanda', count: 1 }],
        deleted: [],
      }),
    );
    // The scoped book's section is open: its songs list under the bar.
    expect(screen.getByRole('button', { name: /^My songs/ })).toHaveAttribute('aria-expanded', 'true');
    const row = screen.getByRole('button', { name: /^Manhã na varanda/ });
    expect(within(row).getByText('conflict')).toBeInTheDocument();
    expect(within(screen.getByRole('button', { name: /^Caminho da feira/ })).queryByText('conflict')).toBeNull();
  });
});

// books.owner_can_save: a book the signed-in person put online is shelved with
// role `owner`; its section offers the new-song affordance (`canWriteTo` →
// `canSaveFor`), and a reader-role book's section still does not (workflow 3
// §Which book L28).
describe('SearchScreen — an owner-role book offers a new song (books.owner_can_save)', () => {
  it('the owner-role section offers New song in this book; the reader one does not', async () => {
    const written = [];
    const { store, emit } = makeStore();
    const { container } = render(<SearchScreen store={store} onWriteSong={(w) => written.push(w)} />);
    emit(
      event(EventKind.BROWSE_RESULTS, {
        books: [
          { bookId: 'srv-own', count: 1, songs: [{ path: 'a.cifra.md', title: 'Feira de Domingo', artist: '', unsaved: false }] },
          { bookId: 'srv-read', count: 1, songs: [{ path: 'b.cifra.md', title: 'Aurora Mansa', artist: '', unsaved: false }] },
        ],
      }),
    );
    emit(
      event(EventKind.SHELF, {
        books: {
          'srv-own': { label: { value: 'Roda de Sábado' }, role: { value: 'owner' } },
          'srv-read': { label: { value: 'Songbook do Coral' }, role: { value: 'reader' } },
        },
        local: {},
      }),
    );
    const newSong = screen.getByRole('button', { name: 'New song in Roda de Sábado' });
    expect(screen.queryByRole('button', { name: 'New song in Songbook do Coral' })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    act(() => fireEvent.click(newSong));
    expect(written).toEqual([{ bookId: 'srv-own' }]);
  });
});

// shell.narrow_fixes — one clear control per search field: with a query typed
// the field holds exactly one clear button, the app's ✕ "Clear search"; it and
// Escape (RAC SearchField) both empty the field. The browser's own cancel × is
// a pseudo-element jsdom cannot see; e2e-web pins it hidden
// (narrow-fixes.spec.js, Decision 6).
describe('SearchScreen — one clear control (shell.narrow_fixes)', () => {
  it('with a query typed, exactly one /clear/i button in the field; ✕ and Escape each empty it; axe clean', async () => {
    const { store } = makeStore();
    const { container } = render(<SearchScreen store={store} />);
    const field = container.querySelector('.search .field');
    const searchbox = screen.getByRole('searchbox');

    type('Morning');
    expect(searchbox).toHaveValue('Morning');
    const clears = within(field).getAllByRole('button', { name: /clear/i });
    expect(clears).toHaveLength(1);
    expect(clears[0]).toHaveAccessibleName('Clear search');
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    act(() => fireEvent.click(clears[0]));
    expect(screen.getByRole('searchbox')).toHaveValue('');

    type('Morning');
    expect(screen.getByRole('searchbox')).toHaveValue('Morning');
    act(() => {
      fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' });
      fireEvent.keyUp(screen.getByRole('searchbox'), { key: 'Escape' });
    });
    expect(screen.getByRole('searchbox')).toHaveValue('');
  });
});
