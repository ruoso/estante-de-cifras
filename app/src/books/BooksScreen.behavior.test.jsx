// behavior — the book-management screen with its real collaborators: React Aria
// Components, the real i18n catalogues, and the real main-thread store + reducer
// driven through a loopback endpoint whose events we inject (the way the Worker
// would post them). Injecting SHELF events is what lets us seed the shelf — a
// label, a tombstone, the role/sync render-when-present seams (Decision 5) — and
// the re-surface a create produces, deterministically; the Worker side of
// CREATE_BOOK is pinned separately in books.behavior.test.js. Axe (role/name/
// structure — the rules that run under jsdom) covers the list, the open sheet
// and the empty state; contrast is pinned at e2e-web. Rename moved to the
// book's detail (BookDetail.behavior.test.jsx) and a fork's *Bring them in* to
// the book's bar (BookBar.behavior.test.jsx) with books.row_opens_songs. All
// names are written for this test (no-song-text rule).
//
// The screen is rendered inside ThemeRoot, as the app mounts it (App.jsx): the
// per-screen portal workaround is gone (shell.portal_provider), so the sheet
// portals into the `.est` token root through ThemeRoot's
// UNSAFE_PortalProvider — the overlays still open, submit and close, and stay
// axe-clean, now via the app-wide provider.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
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
const renderScreen = (store, props = {}) =>
  render(
    <ThemeRoot store={store}>
      <BooksScreen store={store} {...props} />
    </ThemeRoot>,
  );

// The four ways in of the Add-a-book chooser, in the board's order, each with
// its meta line (books.add_book_chooser; W07 #2 L79-99).
const WAYS = [
  ['New book', 'A name, and an empty book. No account needed.'],
  ['By link', 'Paste a link to a book on Estante.'],
  ['Mine on Estante', 'Your books that are not on this shelf yet.'],
  ['Upload', 'A zip of a book, with or without its history.'],
];

const openSheet = () => {
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Add a book' })));
  return screen.getByRole('dialog', { name: 'Add a book' });
};

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
  // books.owner_can_save: a book the signed-in person put online (or forked) is
  // shelved with role `owner`; its row says *can save* in a word (workflow 7 L19).
  it('an owner-role row reads *On Estante · can save · …* (books.owner_can_save, workflow 7 L19)', async () => {
    const { store, emit } = makeStore();
    const { container } = renderScreen(store);
    emit(
      event(EventKind.SHELF, {
        books: { 'srv-own': { label: reg('Roda de Sábado'), position: reg(0), role: reg('owner') } },
        local: {},
      }),
    );
    const row = screen.getByText('Roda de Sábado').closest('.book-row');
    expect(within(row).getByText('On Estante · can save · still loading')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

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
    // Where it lives and can save are words, never colour alone; with no count
    // yet the meta says *still loading* (books.row_opens_songs; workflow 7
    // L21-23).
    expect(screen.getByText('On this device · can save · still loading')).toBeInTheDocument();
    expect(screen.getByText('On Estante · can save · still loading')).toBeInTheDocument();

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

  it('the Add a book sheet opens by keyboard and by pointer on a chooser of four ways in, no field shown; axe clean (W07 #2 L58-103; workflow 7 L23-38)', async () => {
    const { store } = makeStore();
    renderScreen(store);
    const add = screen.getByRole('button', { name: 'Add a book' });

    // Keyboard: focus the trigger and press Enter.
    act(() => add.focus());
    act(() => {
      fireEvent.keyDown(add, { key: 'Enter' });
      fireEvent.keyUp(add, { key: 'Enter' });
    });
    const dialog = screen.getByRole('dialog', { name: 'Add a book' });

    // The four rows, in order: New book, By link and Upload are buttons named
    // by their name and described by their meta line; Mine on Estante is a group
    // holding its own controls.
    for (const [name, meta] of [WAYS[0], WAYS[1], WAYS[3]]) {
      const row = within(dialog).getByRole('button', { name });
      expect(row).toHaveAccessibleDescription(meta);
    }
    const mine = within(dialog).getByRole('group', { name: 'Mine on Estante' });
    expect(within(mine).getByText(WAYS[2][1])).toBeInTheDocument();
    const order = [...dialog.querySelectorAll('.add-choice .name')].map((n) => n.textContent);
    expect(order).toEqual(WAYS.map(([name]) => name));
    // A chooser, not four forms: no field in the sheet.
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    // The rows sit in a plain container, not a list of buttons.
    expect(within(dialog).queryByRole('list')).toBeNull();
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();

    // Close and re-open by pointer.
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Close' })));
    expect(screen.queryByRole('dialog')).toBeNull();
    act(() => fireEvent.click(add));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('New book: chooser → New book step (Book name focused) → submit sends CREATE_BOOK, the book appears via the SHELF re-surface and focus moves to it (workflow 7 L25)', async () => {
    const { store, sent, emit } = makeStore();
    renderScreen(store);

    const dialog = openSheet();
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'New book' })));

    // The step: its heading under the sheet's own, the field focused, Back and
    // New book. The sheet keeps its name.
    expect(screen.getByRole('dialog', { name: 'Add a book' })).toBe(dialog);
    expect(within(dialog).getByRole('heading', { level: 3, name: 'New book' })).toBeInTheDocument();
    const field = within(dialog).getByRole('textbox', { name: 'Book name' });
    expect(field).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Back' })).toBeInTheDocument();
    // Axe the step (scoped to the portaled dialog subtree).
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();

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
    // The new book's row takes focus.
    const row = screen.getByRole('button', { name: /^Quarta à noite/ });
    expect(row).toHaveFocus();
  });

  it('New book: Back returns to the chooser with focus on the New book row; Escape and reopen starts on the chooser with an empty field (books.add_book_chooser)', () => {
    const { store } = makeStore();
    renderScreen(store);

    let dialog = openSheet();
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'New book' })));
    act(() =>
      fireEvent.change(within(dialog).getByRole('textbox', { name: 'Book name' }), { target: { value: 'Rascunho' } }),
    );
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Back' })));
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'New book' })).toHaveFocus();

    // Into the step again, then Escape from it.
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'New book' })));
    act(() => fireEvent.keyDown(within(dialog).getByRole('textbox', { name: 'Book name' }), { key: 'Escape' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    // Reopened: the chooser, and the step's field is empty.
    dialog = openSheet();
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'New book' })));
    expect(within(dialog).getByRole('textbox', { name: 'Book name' })).toHaveValue('');
  });

  it('By link: the step takes a pasted invitation link and Open calls onByLink with its token; a bad link is an alert; axe clean (workflow 7 L27)', async () => {
    const opened = [];
    const { store } = makeStore();
    renderScreen(store, { onByLink: (token) => opened.push(token) });

    let dialog = openSheet();
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'By link' })));
    expect(within(dialog).getByRole('heading', { level: 3, name: 'By link' })).toBeInTheDocument();
    expect(within(dialog).getByText('Paste a link to a book on Estante.')).toBeInTheDocument();
    const field = within(dialog).getByRole('textbox', { name: 'Book link' });
    expect(field).toHaveFocus();
    expect(within(dialog).getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();

    // A bad link: worded, as an alert; the sheet stays.
    act(() => fireEvent.change(field, { target: { value: 'not a link at all' } }));
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Open' })));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('That is not a book link.');
    expect(opened).toEqual([]);
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();

    // A good one starts the invited flow with the token and closes the sheet.
    act(() => fireEvent.change(field, { target: { value: 'https://estante.example/i/tok-quarta' } }));
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Open' })));
    expect(opened).toEqual(['tok-quarta']);
    expect(screen.queryByRole('dialog')).toBeNull();

    // Reopened, the By link field is cleared.
    dialog = openSheet();
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'By link' })));
    expect(within(dialog).getByRole('textbox', { name: 'Book link' })).toHaveValue('');
  });

  it('Upload: the row is the zip picker; a chosen zip calls onUpload with a Uint8Array and its name, and the sheet closes (books.upload_ui Decision 1)', async () => {
    const uploads = [];
    const { store } = makeStore();
    renderScreen(store, { onUpload: (u) => uploads.push(u) });

    const dialog = openSheet();
    // The FileTrigger's accessible `.zip` input belongs to the Upload row.
    const input = dialog.querySelector('input[type="file"]');
    expect(input.getAttribute('accept')).toContain('.zip');
    const row = within(dialog).getByRole('button', { name: 'Upload' });
    let clicked = false;
    input.addEventListener('click', (e) => {
      clicked = true;
      e.preventDefault();
    });
    act(() => fireEvent.click(row));
    expect(clicked).toBe(true);
    // Cancelling the picker (nothing chosen) leaves the chooser open.
    expect(screen.getByRole('dialog', { name: 'Add a book' })).toBeInTheDocument();

    const file = new File([new Uint8Array([1, 2, 3])], 'banda.zip', { type: 'application/zip' });
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
      await Promise.resolve();
    });
    await waitFor(() => expect(uploads).toHaveLength(1));
    expect(uploads[0].bytes).toBeInstanceOf(Uint8Array);
    expect([...uploads[0].bytes]).toEqual([1, 2, 3]);
    expect(uploads[0].fileName).toBe('banda.zip');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keyboard: Tab reaches a row, Enter opens its step, Back by keyboard returns to the chooser (books.add_book_chooser)', () => {
    const { store } = makeStore();
    renderScreen(store);
    const dialog = openSheet();

    // Tab walks the sheet's controls (RAC's focus scope): the rows are among them.
    const newRow = within(dialog).getByRole('button', { name: 'New book' });
    const byLinkRow = within(dialog).getByRole('button', { name: 'By link' });
    expect(newRow.tabIndex).toBe(0);
    expect(byLinkRow.tabIndex).toBe(0);
    act(() => byLinkRow.focus());
    act(() => {
      fireEvent.keyDown(byLinkRow, { key: 'Enter' });
      fireEvent.keyUp(byLinkRow, { key: 'Enter' });
    });
    expect(within(dialog).getByRole('textbox', { name: 'Book link' })).toHaveFocus();

    const back = within(dialog).getByRole('button', { name: 'Back' });
    act(() => back.focus());
    act(() => {
      fireEvent.keyDown(back, { key: 'Enter' });
      fireEvent.keyUp(back, { key: 'Enter' });
    });
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'By link' })).toHaveFocus();
  });

  // books.row_opens_songs — the row says how many songs the book holds, from
  // the Worker's count on INDEX_STATUS (workflow 7 L21-23).
  it('the row reads *On this device · can save · 2 songs*, and *still loading* while the book builds (workflow 7 L21-23)', async () => {
    const { store, emit } = makeStore();
    const { container } = renderScreen(store);
    emit(event(EventKind.SHELF, { books: {}, local: { 'l-1': { title: reg('Exercícios'), position: reg(0) } } }));

    emit(event(EventKind.INDEX_STATUS, { bookId: 'l-1', state: 'ready', songs: 2 }));
    expect(screen.getByText('On this device · can save · 2 songs')).toBeInTheDocument();

    emit(event(EventKind.INDEX_STATUS, { bookId: 'l-1', state: 'building' }));
    expect(screen.getByText('On this device · can save · still loading')).toBeInTheDocument();

    emit(event(EventKind.INDEX_STATUS, { bookId: 'l-1', state: 'ready', songs: 1 }));
    expect(screen.getByText('On this device · can save · 1 song')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  // books.row_opens_songs — pressing a book opens its songs, for every sync
  // phase: a book that needs you opens on its songs too (workflow 7 L28-34;
  // workflow 9 §Meeting one).
  it('pressing the row calls onOpenBookSongs for an in-step book and for a book that needs you (workflow 7 L28-34; workflow 9 §Meeting one)', () => {
    const opened = [];
    const { store, sent, emit } = makeStore();
    renderScreen(store, { onOpenBookSongs: (id) => opened.push(id) });
    emit(
      event(EventKind.SHELF, {
        books: { 'b-1': { label: reg('Choros da Ana'), position: reg(1), role: reg('editor') } },
        local: { 'l-1': { title: reg('Exercícios'), position: reg(0) } },
      }),
    );
    emit(event(EventKind.SYNC, { bookId: 'l-1', phase: 'in_step', at: AT }));
    emit(event(EventKind.SYNC, { bookId: 'b-1', phase: 'needs_you', at: AT }));

    act(() => fireEvent.click(screen.getByRole('button', { name: /^Exercícios/ })));
    act(() => fireEvent.click(screen.getByRole('button', { name: /^Choros da Ana/ })));
    expect(opened).toEqual(['l-1', 'b-1']);
    // The needs-you book's words stay on its row; its press engages nothing.
    expect(screen.getByText('needs you')).toBeInTheDocument();
    expect(sent.some((m) => m.kind === CommandKind.OPEN_CONFLICTS)).toBe(false);
  });

  it('keyboard: the row is one tab stop, Enter opens its songs, and the row holds no Files, pencil or Bring them in (workflow 7 L32)', async () => {
    const opened = [];
    const { store, emit } = makeStore();
    const { container } = renderScreen(store, { onOpenBookSongs: (id) => opened.push(id) });
    emit(event(EventKind.SHELF, { books: {}, local: { 'l-1': { title: reg('Exercícios'), position: reg(0) } } }));

    const bookRow = container.querySelector('.book-row');
    const focusable = bookRow.querySelectorAll('button, [tabindex]:not([tabindex="-1"]), a[href], input');
    expect(focusable).toHaveLength(1);
    const row = within(bookRow).getByRole('button');
    expect(row).toHaveAccessibleName(/^Exercícios/);
    expect(screen.queryByRole('button', { name: /^Files in/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Rename/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Bring them in/ })).toBeNull();

    act(() => row.focus());
    expect(row).toHaveFocus();
    act(() => {
      fireEvent.keyDown(row, { key: 'Enter' });
      fireEvent.keyUp(row, { key: 'Enter' });
    });
    expect(opened).toEqual(['l-1']);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  describe('on a wide viewport', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('is one list: no *Pick a book* pane and no split beside it (workflow 7 L36-37)', async () => {
      vi.stubGlobal('matchMedia', (media) => ({
        media,
        matches: !media.includes('prefers-color-scheme'),
        addEventListener() {},
        removeEventListener() {},
      }));
      const { store, emit } = makeStore();
      const { container } = renderScreen(store);
      emit(event(EventKind.SHELF, { books: {}, local: { 'l-1': { title: reg('Exercícios'), position: reg(0) } } }));

      expect(container.querySelector('.books-split')).toBeNull();
      expect(container.querySelector('.split')).toBeNull();
      expect(screen.queryByText('Pick a book to see its details.')).toBeNull();
      act(() => fireEvent.click(screen.getByRole('button', { name: /^Exercícios/ })));
      // Pressing a row draws no detail beside the list.
      expect(screen.queryByRole('button', { name: /^Back to/ })).toBeNull();
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    });
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
      // The fork is the user's own (role `owner`): it says *can save*
      // (books.owner_can_save, workflow 7 L19).
      expect(screen.getByText('On Estante · can save · still loading')).toBeInTheDocument();
      expect(screen.getByText('from Choros da Ana')).toBeInTheDocument();
      expect(screen.queryByText(/new save/)).toBeNull();

      emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 3, gone: false }));
      expect(screen.getByText('Choros da Ana has 3 new saves.')).toBeInTheDocument();
      // The words stay on the row; *Bring them in* is on the book's bar now
      // (books.row_opens_songs; workflow 7 L83-85), not on the row.
      expect(screen.queryByRole('button', { name: /^Bring them in/ })).toBeNull();
      emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 1, gone: false }));
      expect(screen.getByText('Choros da Ana has 1 new save.')).toBeInTheDocument();

      expect(await checkWcag21aa(container)).toHaveNoViolations();
    });

    it('no *Bring them in* on the row whatever the count; the row opens the book’s songs (books.row_opens_songs)', () => {
      const opened = [];
      const { store, sent, emit } = makeStore();
      renderScreen(store, { onOpenBookSongs: (id) => opened.push(id) });
      emit(forkShelf());
      emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 4, gone: false }));
      expect(screen.queryByRole('button', { name: /^Bring them in/ })).toBeNull();

      act(() => fireEvent.click(screen.getByRole('button', { name: /^Choros da Ana/ })));
      expect(opened).toEqual(['srv-fork']);
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
    // The instrument by the chip's one short label (shell.header_chrome).
    expect(within(status).getByText('Guitar')).toBeInTheDocument();
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
    // The owner-role rows say *can save*, the reader one *reader* — words
    // (books.owner_can_save, workflow 7 L19).
    expect(within(rowOf('Banda do Bairro')).getByText(/^On Estante · can save · /)).toBeInTheDocument();
    expect(within(rowOf('Valsas')).getByText(/^On Estante · can save · /)).toBeInTheDocument();
    expect(within(rowOf('Choros da Ana')).getByText(/^On Estante · reader · /)).toBeInTheDocument();
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
