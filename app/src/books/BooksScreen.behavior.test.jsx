// behavior — the book-management screen with its real collaborators: React Aria
// Components, the real i18n catalogues, and the real main-thread store + reducer
// driven through a loopback endpoint whose events we inject (the way the Worker
// would post them). Injecting SHELF events is what lets us seed the shelf — a
// label, a tombstone, the role/sync render-when-present seams (Decision 5) — and
// the re-surface a create/rename produces, deterministically; the Worker side of
// CREATE_BOOK / RENAME_BOOK is pinned separately in books.behavior.test.js. Axe
// (role/name/structure — the rules that run under jsdom) covers the list, the
// open sheet, the rename dialog and the empty state; contrast is pinned at
// e2e-web. All names are written for this test (no-song-text rule).
//
// The screen is rendered inside ThemeRoot, as the app mounts it (App.jsx): the
// per-screen portal workaround is gone (shell.portal_provider), so the sheet and
// the rename dialog portal into the `.est` token root through ThemeRoot's
// UNSAFE_PortalProvider — the overlays still open, submit and close, and stay
// axe-clean, now via the app-wide provider.

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import BooksScreen from './BooksScreen.jsx';

const AT = '2026-10-05T14:00:00.000Z';
const reg = (value) => ({ value, at: AT });

// Render the screen the way the app mounts it — inside ThemeRoot, so its
// overlays portal into the `.est` token root via the app-wide provider. The one
// store carries both the `shelf` slice the screen reads and the `preferences`
// slice ThemeRoot reads.
const renderScreen = (store) =>
  render(
    <ThemeRoot store={store}>
      <BooksScreen store={store} />
    </ThemeRoot>,
  );

// A real store over a loopback endpoint: `sent` captures the commands the screen
// posts (CREATE_BOOK / RENAME_BOOK); `emit` folds a Worker event into the store
// inside `act`, so the subscribed screen re-renders exactly as in the app.
function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const lastCommand = (sent, kind) => [...sent].reverse().find((m) => m.kind === kind);

describe('BooksScreen (behavior)', () => {
  it('the shelf lists every book with title, where-it-lives and can-save, ordered by position (workflow 7 L14-21)', async () => {
    const { store, emit } = makeStore();
    const { container } = renderScreen(store);

    emit(
      event(EventKind.SHELF, {
        books: { 'b-1': { label: reg('Choros da Ana'), position: reg(1), role: reg('editor') } },
        local: { 'l-1': { title: reg('Exercícios de violão'), position: reg(0) } },
      }),
    );

    // Both rows render with their title and meta line.
    expect(screen.getByText('Choros da Ana')).toBeInTheDocument();
    expect(screen.getByText('Exercícios de violão')).toBeInTheDocument();
    // Where it lives and can save are words, never colour alone.
    expect(screen.getByText('On this device · can save')).toBeInTheDocument();
    expect(screen.getByText('On Estante · can save')).toBeInTheDocument();

    // Ordered by position: the local book (0) before the shared book (1).
    const titles = [...container.querySelectorAll('.book-row .name')].map((n) => n.textContent);
    expect(titles).toEqual(['Exercícios de violão', 'Choros da Ana']);

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('title or label: a register shows, a tombstoned/absent register falls back to the id (workflow 7 L16-18; §5.3)', () => {
    const { store, emit } = makeStore();
    renderScreen(store);

    emit(
      event(EventKind.SHELF, {
        books: {
          'b-labelled': { label: reg('Turma de quarta'), position: reg(0) },
          'b-tombstoned': { label: reg(null), position: reg(1) },
        },
        local: {},
      }),
    );

    expect(screen.getByText('Turma de quarta')).toBeInTheDocument();
    // A cleared label falls back to the opaque id.
    expect(screen.getByText('b-tombstoned')).toBeInTheDocument();
  });

  // The shelf of three local books the sync tests seed; the `sync` facts are
  // injected per book as SYNC events (the real reducer slice sync.states reads),
  // not as a shelf register (the retired placeholder). HH:MM below is built from
  // local wall-clock so "offline since 09:40" holds in any CI timezone.
  const lastInStepAt = (h, m) => new Date(2026, 9, 7, h, m, 0).toISOString();
  const seedShelf = (emit) =>
    emit(
      event(EventKind.SHELF, {
        books: {},
        local: {
          'l-steady': { title: reg('Em dia'), position: reg(0) },
          'l-unsaved': { title: reg('Atrasado'), position: reg(1) },
          'l-offline': { title: reg('Sem rede'), position: reg(2) },
        },
      }),
    );

  it('each sync state renders its word, queried by text not colour; an in-step book shows no badge (workflow 8 L28-34; README L26)', async () => {
    const { store, emit } = makeStore();
    const { container } = renderScreen(store);

    seedShelf(emit);
    // l-steady gets an in_step fact (nothing on the row); the other two a word.
    emit(event(EventKind.SYNC, { bookId: 'l-steady', phase: 'in_step', at: AT }));
    emit(event(EventKind.SYNC, { bookId: 'l-unsaved', phase: 'saves_waiting', savesWaiting: 2, at: AT }));
    emit(
      event(EventKind.SYNC, {
        bookId: 'l-offline',
        phase: 'offline',
        lastInStep: lastInStepAt(9, 40),
        at: AT,
      }),
    );

    expect(screen.getByText('2 saves waiting to go up')).toBeInTheDocument();
    expect(screen.getByText('offline since 09:40')).toBeInTheDocument();
    // The in-step book carries no badge — its absence is "in step" (mockup L48).
    const steady = [...container.querySelectorAll('.book-row')].find(
      (r) => r.querySelector('.name')?.textContent === 'Em dia',
    );
    expect(steady.querySelector('.badge')).toBeNull();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('the header quiet mark is present when any book is out of step and absent when all are in step (workflow 8 L36-37)', () => {
    const { store, emit } = makeStore();
    renderScreen(store);
    seedShelf(emit);

    // All in step: no mark anywhere.
    emit(event(EventKind.SYNC, { bookId: 'l-steady', phase: 'in_step', at: AT }));
    expect(screen.queryByRole('img', { name: 'Some books are not in step' })).toBeNull();

    // One book goes out of step: the one quiet mark appears.
    emit(event(EventKind.SYNC, { bookId: 'l-offline', phase: 'offline', lastInStep: null, at: AT }));
    expect(screen.getByRole('img', { name: 'Some books are not in step' })).toBeInTheDocument();
  });

  it('Sync now is reachable by keyboard and sends SYNC { reason: "sync-now" }, returning at once (workflow 8 L37)', () => {
    const { store, sent, emit } = makeStore();
    renderScreen(store);
    seedShelf(emit);

    const syncNow = screen.getByRole('button', { name: 'Sync now' });
    act(() => syncNow.focus());
    expect(syncNow).toHaveFocus();
    act(() => {
      fireEvent.keyDown(syncNow, { key: 'Enter' });
      fireEvent.keyUp(syncNow, { key: 'Enter' });
    });

    const cmd = lastCommand(sent, CommandKind.SYNC);
    expect(cmd.payload.reason).toBe('sync-now');
  });

  it('the Add a book sheet opens by keyboard and by pointer (workflow 7 L25)', () => {
    const { store } = makeStore();
    renderScreen(store);
    const add = screen.getByRole('button', { name: 'Add a book' });

    // Keyboard: focus the trigger and press Enter.
    act(() => add.focus());
    act(() => {
      fireEvent.keyDown(add, { key: 'Enter' });
      fireEvent.keyUp(add, { key: 'Enter' });
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Close and re-open by pointer.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Cancel' })));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => fireEvent.click(add));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('New book: submits a name, sends CREATE_BOOK, the book appears via the SHELF re-surface and focus moves to it (workflow 7 L25)', async () => {
    const { store, sent, emit } = makeStore();
    renderScreen(store);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Add a book' })));
    const dialog = screen.getByRole('dialog');
    // Axe the open sheet (scoped to the portaled dialog subtree).
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();

    const field = within(dialog).getByRole('textbox', { name: 'Book name' });
    act(() => fireEvent.change(field, { target: { value: 'Quarta à noite' } }));
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'New book' })));

    // CREATE_BOOK carries the typed title.
    expect(lastCommand(sent, CommandKind.CREATE_BOOK).payload.title).toBe('Quarta à noite');
    // The sheet closed.
    expect(screen.queryByRole('dialog')).toBeNull();

    // The Worker's re-surface adds the new local book; it appears and takes focus.
    emit(
      event(EventKind.SHELF, {
        books: {},
        local: { 'local-new': { title: reg('Quarta à noite'), position: reg(0) } },
      }),
    );
    // The open row (not the "Rename …" button) takes focus.
    const row = screen.getByRole('button', { name: /^Quarta à noite/ });
    expect(row).toHaveFocus();
  });

  it('Rename: opens with the current name, submits RENAME_BOOK and the row re-labels (workflow 7 L16-18)', async () => {
    const { store, sent, emit } = makeStore();
    renderScreen(store);

    emit(
      event(EventKind.SHELF, {
        books: {},
        local: { 'l-1': { title: reg('Exercícios'), position: reg(0) } },
      }),
    );

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Rename Exercícios' })));
    const dialog = screen.getByRole('dialog');
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();

    // The field opens pre-filled with the current name.
    const field = within(dialog).getByRole('textbox', { name: 'Name on your shelf' });
    expect(field).toHaveValue('Exercícios');

    act(() => fireEvent.change(field, { target: { value: 'Quinta' } }));
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Save' })));

    // RENAME_BOOK carries the book id and the new name.
    const cmd = lastCommand(sent, CommandKind.RENAME_BOOK);
    expect(cmd.payload.bookId).toBe('l-1');
    expect(cmd.payload.name).toBe('Quinta');

    // The re-surface re-labels the row.
    emit(
      event(EventKind.SHELF, {
        books: {},
        local: { 'l-1': { title: reg('Quinta'), position: reg(0) } },
      }),
    );
    expect(screen.getByText('Quinta')).toBeInTheDocument();
    expect(screen.queryByText('Exercícios')).toBeNull();
  });

  it('empty shelf: a role=status line and the Add a book affordance, never a blank pane (Decision 7)', async () => {
    const { store } = makeStore();
    const { container } = renderScreen(store);

    // No SHELF emitted — the slice starts empty.
    expect(screen.getByRole('status')).toHaveTextContent('No books yet. Add a book to start.');
    expect(screen.getByRole('button', { name: 'Add a book' })).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  // books.fork AC5 — the fork on the shelf (workflow 11 §What a fork is,
  // §Following the original; W11 board #2 :68-97 and #4 :153).
  describe('a fork on the shelf (books.fork; W11 board #2, #4)', () => {
    const ORIGINAL = {
      bookId: 'srv-orig',
      title: 'Choros da Ana',
      link: 'https://estante.example/git/srv-orig',
      followedAt: AT,
    };
    const forkShelf = (original = ORIGINAL) =>
      event(EventKind.SHELF, {
        books: {
          // The original's registers cleared, as the fork's one write leaves them.
          'srv-orig': { label: reg(null), link: reg(null), position: reg(null), role: reg(null) },
          'srv-fork': {
            label: reg('Choros da Ana'),
            link: reg('https://estante.example/git/srv-fork'),
            position: reg(1),
            role: reg('owner'),
            original: reg(original),
          },
        },
        local: { 'l-1': { title: reg('My songs'), position: reg(0) } },
      });

    it('one row, the original’s label, with *from {original}*; the *N new saves* line from an ORIGINAL event; axe clean', async () => {
      const { store, emit } = makeStore();
      const { container } = renderScreen(store);
      emit(forkShelf());

      // One row, not two: the original's tombstoned entry draws nothing.
      expect(screen.getAllByText('Choros da Ana')).toHaveLength(1);
      expect(screen.getByText('from Choros da Ana')).toBeInTheDocument();
      expect(screen.queryByText(/new save/)).toBeNull();

      emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 3, gone: false }));
      expect(screen.getByText('Choros da Ana has 3 new saves.')).toBeInTheDocument();
      // Bring them in is books.bring_in's (Decision 5): no dead control here.
      expect(screen.queryByRole('button', { name: 'Bring them in' })).toBeNull();
      emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 1, gone: false }));
      expect(screen.getByText('Choros da Ana has 1 new save.')).toBeInTheDocument();

      expect(await checkWcag21aa(container)).toHaveNoViolations();
    });

    it('once the original is gone the badge reads *original no longer shared*, in a word', async () => {
      const { store, emit } = makeStore();
      const { container } = renderScreen(store);
      emit(forkShelf({ ...ORIGINAL, goneAt: AT }));

      expect(screen.getByText('original no longer shared')).toBeInTheDocument();
      expect(screen.getByText('from Choros da Ana')).toBeInTheDocument();
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    });

    it('says the post-fork footnote once BOOK_FORKED arrives', async () => {
      const { store, emit } = makeStore();
      const { container } = renderScreen(store);
      emit(forkShelf());
      expect(screen.queryByText(/is your own now/)).toBeNull();

      emit(event(EventKind.BOOK_FORKED, { previousBookId: 'srv-orig', bookId: 'srv-fork', via: 'service' }));
      const note = screen.getByText(/Choros da Ana is your own now: it took the place of the original/);
      expect(note).toHaveAttribute('role', 'status');
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    });

    it('a cannot_save book reads *can’t save here* on the shelf (books.fork AC2)', () => {
      const { store, emit } = makeStore();
      renderScreen(store);
      emit(
        event(EventKind.SHELF, {
          books: { 'srv-2': { label: reg('Banda do Bairro'), position: reg(0), role: reg('reader') } },
          local: {},
        }),
      );
      emit(event(EventKind.SYNC, { bookId: 'srv-2', phase: 'cannot_save', savesWaiting: 1, at: AT }));
      expect(screen.getByText('can’t save here')).toBeInTheDocument();
    });
  });
});
