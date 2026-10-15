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
import { render, screen, fireEvent, act, within, cleanup } from '@testing-library/react';
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
      // The *Bring them in* button sits beside the count (books.bring_in
      // Constraint 6), named for the original.
      expect(screen.getByRole('button', { name: 'Bring them in from Choros da Ana' })).toHaveTextContent(
        'Bring them in',
      );
      emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 1, gone: false }));
      expect(screen.getByText('Choros da Ana has 1 new save.')).toBeInTheDocument();

      expect(await checkWcag21aa(container)).toHaveNoViolations();
    });

    // books.bring_in Constraint 6 (W11 board #2 :78-83): the button opens the
    // bring-in screen; it is a sibling of the row's open button, which still
    // opens the book.
    it('*Bring them in from {original}* beside the count opens the bring-in screen and sends PREVIEW_BRING_IN; axe clean', async () => {
      const { store, sent, emit } = makeStore();
      const { container } = renderScreen(store);
      emit(forkShelf());
      emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 3, gone: false }));

      const bring = screen.getByRole('button', { name: 'Bring them in from Choros da Ana' });
      const open = screen.getByRole('button', { name: /^Choros da Ana/ });
      expect(open.contains(bring)).toBe(false); // never nested in the open button
      expect(await checkWcag21aa(container)).toHaveNoViolations();

      act(() => fireEvent.click(bring));
      expect(screen.getByRole('heading', { name: 'Bring in saves from Choros da Ana' })).toBeInTheDocument();
      expect(lastCommand(sent, CommandKind.PREVIEW_BRING_IN).payload).toEqual({ bookId: 'srv-fork' });

      // Not now returns to the shelf, focus on the fork's row.
      act(() => fireEvent.click(screen.getByRole('button', { name: 'Not now' })));
      expect(screen.queryByRole('heading', { name: 'Bring in saves from Choros da Ana' })).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: /^Choros da Ana/ }));
    });

    it('Enter on *Bring them in* opens the screen too', () => {
      const { store, sent, emit } = makeStore();
      renderScreen(store);
      emit(forkShelf());
      emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 2, gone: false }));
      const bring = screen.getByRole('button', { name: 'Bring them in from Choros da Ana' });
      act(() => {
        fireEvent.keyDown(bring, { key: 'Enter' });
        fireEvent.keyUp(bring, { key: 'Enter' });
      });
      expect(screen.getByRole('heading', { name: 'Bring in saves from Choros da Ana' })).toBeInTheDocument();
      expect(lastCommand(sent, CommandKind.PREVIEW_BRING_IN).payload).toEqual({ bookId: 'srv-fork' });
    });

    it('no *Bring them in* for a count of 0 or a gone original; the row still opens the book', () => {
      const { store, sent, emit } = makeStore();
      renderScreen(store);
      emit(forkShelf());
      emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 0, gone: false }));
      expect(screen.queryByRole('button', { name: /^Bring them in/ })).toBeNull();
      emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 4, gone: true }));
      expect(screen.queryByRole('button', { name: /^Bring them in/ })).toBeNull();
      cleanup();

      const gone = makeStore();
      renderScreen(gone.store);
      gone.emit(forkShelf({ ...ORIGINAL, goneAt: AT }));
      gone.emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 4, gone: false }));
      expect(screen.queryByRole('button', { name: /^Bring them in/ })).toBeNull();

      // The row's open button still opens the book's detail.
      act(() => fireEvent.click(screen.getByRole('button', { name: /^Choros da Ana/ })));
      expect(screen.getByRole('button', { name: 'Back to books' })).toBeInTheDocument();
      expect(sent.some((m) => m.kind === CommandKind.PREVIEW_BRING_IN)).toBe(false);
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

// account.new_device — the shelf on a new device (workflow 13 §What comes down,
// §Books that were only on the other device; W13 board frame 2): the restore
// notice, the fill rows as words with a labelled bar, and the only-on rows that
// do not open. Axe-clean.
describe('BooksScreen on a new device (account.new_device, behavior)', () => {
  const SHELF = {
    books: {
      'b-banda': { label: reg('Banda do Bairro'), link: reg('/git/b-banda'), position: reg(0), role: reg('owner') },
      'b-choros': { label: reg('Choros da Ana'), link: reg('/git/b-choros'), position: reg(1), role: reg('reader') },
      'b-valsas': { label: reg('Valsas'), link: reg('/git/b-valsas'), position: reg(2), role: reg('owner') },
    },
    local: {},
    elsewhere: [{ deviceId: 'dev-phone', bookId: 'l-rasc', title: 'Rascunhos', kind: 'android-phone', position: 3 }],
  };

  function seed(emit) {
    emit(
      event(EventKind.PREFERENCES, {
        notation: reg('brazilian'),
        language: reg('en'),
      }),
    );
    emit(
      event(EventKind.INSTRUMENTS, {
        instruments: [],
        inUseId: null,
        standard: { id: 'standard', catalogId: '6guitar', tuning: 'E2 A2 D3 G3 B3 E4', label: '' },
      }),
    );
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.HOME_ATTACHED, { attached: true, restored: true }));
    emit(event(EventKind.SHELF_FILL, { bookId: 'b-banda', state: 'ready', progress: 100, songs: 21 }));
    emit(event(EventKind.SHELF_FILL, { bookId: 'b-choros', state: 'cloning', progress: 45 }));
    emit(event(EventKind.SHELF_FILL, { bookId: 'b-valsas', state: 'waiting', progress: 0 }));
  }

  it('shows the restore notice with its summary line, announced, and dismissable', async () => {
    const { store, emit } = makeStore();
    const { container } = renderScreen(store);
    seed(emit);

    const notice = container.querySelector('.restore-notice');
    expect(notice).toBeTruthy();
    const status = within(notice).getByRole('status');
    expect(status).toHaveTextContent('Home book restored. Your instrument, notation and language are set.');
    expect(within(status).getByText('Brazilian notation')).toBeInTheDocument();
    expect(within(status).getByText('English')).toBeInTheDocument();
    expect(within(status).getByText(/E2 A2 D3 G3 B3 E4/)).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss the home book notice' }));
    expect(container.querySelector('.restore-notice')).toBeNull();
  });

  it('is not shown when nothing came down (a first device)', () => {
    const { store, emit } = makeStore();
    const { container } = renderScreen(store);
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.HOME_ATTACHED, { attached: true, restored: false }));
    expect(container.querySelector('.restore-notice')).toBeNull();
  });

  it('fill rows read ready (with songs), cloning 45% with a labelled bar, and waiting — words, not colour', async () => {
    const { store, emit } = makeStore();
    const { container } = renderScreen(store);
    seed(emit);

    const rowOf = (title) => screen.getByText(title).closest('.book-row');
    expect(within(rowOf('Banda do Bairro')).getByText('ready')).toBeInTheDocument();
    expect(within(rowOf('Banda do Bairro')).getByText('21 songs · searchable')).toBeInTheDocument();
    expect(within(rowOf('Choros da Ana')).getByText('cloning 45%')).toBeInTheDocument();
    expect(within(rowOf('Choros da Ana')).getByText('songs searchable as they arrive')).toBeInTheDocument();
    const bar = within(rowOf('Choros da Ana')).getByRole('progressbar', { name: 'Bringing Choros da Ana to this device' });
    expect(bar).toHaveAttribute('aria-valuenow', '45');
    expect(within(rowOf('Valsas')).getByText('waiting')).toBeInTheDocument();
    expect(within(rowOf('Valsas')).getByText('next in line')).toBeInTheDocument();
    // Only the cloning book draws a bar.
    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
    // The shelf's count is announced politely.
    expect(screen.getByText('3 books')).toHaveAttribute('role', 'status');

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('lists a book only on another device as a row that does not open', async () => {
    const { store, emit } = makeStore();
    const { container } = renderScreen(store);
    seed(emit);

    const line = screen.getByText('Only on your Android phone: Rascunhos');
    const row = line.closest('.elsewhere-row');
    expect(within(row).getByText('Put it online there to have it here.')).toBeInTheDocument();
    // Not a link or a button that opens: nothing interactive in it.
    expect(within(row).queryByRole('button')).toBeNull();
    expect(within(row).queryByRole('link')).toBeNull();
    expect(line.closest('button')).toBeNull();
    // After the shelf's own books.
    const rows = [...container.querySelectorAll('.book-row, .elsewhere-row')];
    expect(rows[rows.length - 1]).toBe(row);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});
