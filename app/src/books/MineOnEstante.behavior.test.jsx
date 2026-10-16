// behavior (books.add_by_link) — the Add-a-book sheet's "Mine on Estante" section
// with its real collaborators: React Aria Components, real i18n, and the real
// main-thread store + reducer driven through a loopback endpoint whose MINE
// events we inject (the way the Worker would post them after LIST_MINE). Pins
// workflow 7 §Add-a-book "Mine on Estante" (L28-29; W07 L87-95): signed out it
// says so and offers the passkey surface; signed in it lists the off-shelf books
// and an Add clones one (ADD_MINE). Axe covers the open sheet. Book names are
// written for this test (no-song-text rule).
//
// Rendered inside ThemeRoot, as the app mounts it, so the sheet portals into the
// `.est` token root via the app-wide UNSAFE_PortalProvider (shell.portal_provider).

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import BooksScreen from './BooksScreen.jsx';

const renderScreen = (store, props = {}) =>
  render(
    <ThemeRoot store={store}>
      <BooksScreen store={store} {...props} />
    </ThemeRoot>,
  );

// The chooser's Mine on Estante row (books.add_book_chooser; W07 #2 L87-95): a
// group named by the row's name, holding its own controls.
const mineRow = (dialog) => within(dialog).getByRole('group', { name: 'Mine on Estante' });

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const lastCommand = (sent, kind) => [...sent].reverse().find((m) => m.kind === kind);

// Open the Add-a-book sheet and return its dialog node.
function openSheet() {
  act(() => fireEvent.click(screen.getByRole('button', { name: 'Add a book' })));
  return screen.getByRole('dialog');
}

const MINE = [
  { id: 'b-choros', label: 'Choros da Ana', role: 'reader', gitUrl: 'https://e/git/b-choros' },
  { id: 'b-turma', label: 'Turma de quarta', role: 'editor', gitUrl: 'https://e/git/b-turma' },
];

describe('Mine on Estante (behavior)', () => {
  it('opening the sheet asks the Worker for the list (LIST_MINE)', () => {
    const { store, sent } = makeStore();
    renderScreen(store);
    openSheet();
    expect(lastCommand(sent, CommandKind.LIST_MINE)).toBeTruthy();
  });

  it('signed out: the Mine row says "Sign in to see them" and offers a passkey or an emailed link, each to the sign-in seam at its step (W07 L87-95; books.add_book_chooser)', async () => {
    const asked = [];
    const { store, emit } = makeStore();
    renderScreen(store, { onSignIn: (how) => asked.push(how) });
    let dialog = openSheet();

    emit(event(EventKind.MINE, { status: 'signed_out', books: [] }));

    const row = mineRow(dialog);
    expect(within(row).getByText(/Sign in to see them/)).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Sign in with a passkey' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'No passkey here? Email me a link' })).toBeInTheDocument();
    // The old one-word "Sign in" (create intent) is gone.
    expect(within(dialog).queryByRole('button', { name: 'Sign in' })).toBeNull();

    expect(await checkWcag21aa(dialog)).toHaveNoViolations();

    // Each closes the sheet and asks for the sign-in surface at its step.
    act(() => fireEvent.click(within(row).getByRole('button', { name: 'Sign in with a passkey' })));
    expect(asked).toEqual(['method']);
    expect(screen.queryByRole('dialog')).toBeNull();

    dialog = openSheet();
    emit(event(EventKind.MINE, { status: 'signed_out', books: [] }));
    act(() =>
      fireEvent.click(within(mineRow(dialog)).getByRole('button', { name: 'No passkey here? Email me a link' })),
    );
    expect(asked).toEqual(['method', 'email']);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('signed in: lists the account’s off-shelf books, and Add clones one (ADD_MINE)', async () => {
    const { store, sent, emit } = makeStore();
    renderScreen(store);
    const dialog = openSheet();

    emit(event(EventKind.MINE, { status: 'ready', books: MINE }));

    // Both off-shelf books are listed by title, in place, under the Mine row's
    // name on the chooser (books.add_book_chooser Decision 3).
    const row = mineRow(dialog);
    expect(within(row).getByText('Choros da Ana')).toBeInTheDocument();
    expect(within(row).getByText('Turma de quarta')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Sign in with a passkey' })).toBeNull();

    // Axe the open sheet with its list.
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();

    // Add the first: ADD_MINE carries the id, gitUrl, label and granted role —
    // the clone needs no extra fetch, and the role renders on the shelf.
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Add Choros da Ana' })));
    const cmd = lastCommand(sent, CommandKind.ADD_MINE);
    expect(cmd.payload).toMatchObject({
      bookId: 'b-choros',
      gitUrl: 'https://e/git/b-choros',
      label: 'Choros da Ana',
      role: 'reader',
    });
  });

  it('signed in with nothing off-shelf: says every book is already here', () => {
    const { store, emit } = makeStore();
    renderScreen(store);
    const dialog = openSheet();
    emit(event(EventKind.MINE, { status: 'ready', books: [] }));
    expect(within(dialog).getByText('All your books are already on this shelf.')).toBeInTheDocument();
  });

  // Leave on a Mine on Estante row (books.leave; workflow 10 L99-101, L116-117;
  // Leave-book board L143, L192): a book already removed from this shelf is
  // left without adding it back.
  it('a reader’s row offers Leave; an owner’s does not (L99-101)', async () => {
    const { store, emit } = makeStore();
    renderScreen(store);
    const dialog = openSheet();
    emit(
      event(EventKind.MINE, {
        status: 'ready',
        books: [...MINE, { id: 'b-own', label: 'Meus estudos', role: 'owner', gitUrl: 'https://e/git/b-own' }],
      }),
    );

    expect(within(dialog).getByRole('button', { name: 'Leave Choros da Ana' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Leave Turma de quarta' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Leave Meus estudos' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Add Meus estudos' })).toBeInTheDocument();
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('the row’s confirmation is the sentence alone; confirming sends LEAVE_BOOK, and on BOOK_LEFT the row is gone (L116-117; board L192); axe clean', async () => {
    const { store, sent, emit } = makeStore();
    renderScreen(store);
    const sheet = openSheet();
    emit(event(EventKind.MINE, { status: 'ready', books: MINE }));

    act(() => fireEvent.click(within(sheet).getByRole('button', { name: 'Leave Choros da Ana' })));
    const confirm = screen.getByRole('alertdialog');
    expect(within(confirm).getByRole('heading', { name: 'Leave Choros da Ana?' })).toBeInTheDocument();
    expect(
      within(confirm).getByText(
        'You will no longer open or sync it, on any of your devices. The owner can invite you again.',
      ),
    ).toBeInTheDocument();
    // No counts, no "removed from this one", and no survey asked for.
    expect(within(confirm).queryByText(/removed from this one/)).toBeNull();
    expect(within(confirm).queryByText(/will be lost|never will/)).toBeNull();
    expect(lastCommand(sent, CommandKind.SURVEY_SIGN_OUT)).toBeUndefined();
    expect(within(confirm).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancel', 'Leave the book']);
    expect(await checkWcag21aa(confirm)).toHaveNoViolations();

    act(() => fireEvent.click(within(confirm).getByRole('button', { name: 'Leave the book' })));
    expect(lastCommand(sent, CommandKind.LEAVE_BOOK).payload).toMatchObject({ bookId: 'b-choros' });

    // The Worker answered: the reducer drops the row, the other stays.
    emit(event(EventKind.BOOK_LEFT, { bookId: 'b-choros' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(within(sheet).queryByText('Choros da Ana')).toBeNull();
    expect(within(sheet).getByText('Turma de quarta')).toBeInTheDocument();
  });

  // books.owner_name — the row carries the owner's name the listing gave
  // (ownerName), so its confirmation names who can invite you again (Leave-book
  // board L198; workflow 10 §Leaving a book L116-117), and the add writes it on
  // the shelf (ADD_MINE carries it).
  it('a row with ownerName names the owner in its confirmation, and ADD_MINE carries the name; axe clean', async () => {
    const { store, sent, emit } = makeStore();
    renderScreen(store);
    const sheet = openSheet();
    emit(
      event(EventKind.MINE, {
        status: 'ready',
        books: [{ ...MINE[0], ownerName: 'Ana' }, MINE[1]],
      }),
    );

    act(() => fireEvent.click(within(sheet).getByRole('button', { name: 'Leave Choros da Ana' })));
    const confirm = screen.getByRole('alertdialog');
    expect(
      within(confirm).getByText('You will no longer open or sync it, on any of your devices. Ana can invite you again.'),
    ).toBeInTheDocument();
    expect(within(confirm).queryByText(/The owner can invite you again/)).toBeNull();
    expect(await checkWcag21aa(confirm)).toHaveNoViolations();
    act(() => fireEvent.click(within(confirm).getByRole('button', { name: 'Cancel' })));

    act(() => fireEvent.click(within(sheet).getByRole('button', { name: 'Add Choros da Ana' })));
    expect(lastCommand(sent, CommandKind.ADD_MINE).payload).toMatchObject({
      bookId: 'b-choros',
      ownerName: 'Ana',
    });
  });
});
