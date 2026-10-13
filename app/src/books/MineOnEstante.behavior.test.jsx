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

const renderScreen = (store) =>
  render(
    <ThemeRoot store={store}>
      <BooksScreen store={store} />
    </ThemeRoot>,
  );

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

  it('signed out: shows "Sign in to see them" and offers the passkey surface (W07 L91-92)', async () => {
    const { store, emit } = makeStore();
    renderScreen(store);
    const dialog = openSheet();

    emit(event(EventKind.MINE, { status: 'signed_out', books: [] }));

    expect(within(dialog).getByText(/Sign in to see them/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Sign in' })).toBeInTheDocument();

    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('signed in: lists the account’s off-shelf books, and Add clones one (ADD_MINE)', async () => {
    const { store, sent, emit } = makeStore();
    renderScreen(store);
    const dialog = openSheet();

    emit(event(EventKind.MINE, { status: 'ready', books: MINE }));

    // Both off-shelf books are listed by title.
    expect(within(dialog).getByText('Choros da Ana')).toBeInTheDocument();
    expect(within(dialog).getByText('Turma de quarta')).toBeInTheDocument();

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
});
