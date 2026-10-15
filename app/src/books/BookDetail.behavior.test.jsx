// Behavior (React) — the per-book detail (books.online, workflow 7 L128-137;
// the W07 board copy). The detail renders the applicable acts and chips (words,
// not colour); the delete typed-name confirm acts only on an exact match; the
// remove "what would be lost" confirm shows the unsaved/unpushed warning for a
// hosted book and the "gone for good + Download first" warning for a device-only
// book; axe is clean on each overlay. Rendered inside ThemeRoot the way the app
// mounts it, so its overlays portal into the `.est` token root (the app-wide
// UNSAFE_PortalProvider) — [[rac-overlays-portal-outside-est-theme-root]].
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, within, cleanup } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import BookDetail from './BookDetail.jsx';

const AT = '2026-10-08T14:00:00.000Z';
const reg = (value) => ({ value, at: AT });

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const lastCommand = (sent, kind) => [...sent].reverse().find((m) => m.kind === kind);

const renderDetail = (store, props) =>
  render(
    <ThemeRoot store={store}>
      <BookDetail store={store} mode="wide" {...props} />
    </ThemeRoot>,
  );

// A device-only book on the shelf.
const localShelf = (id = 'local-1') =>
  event(EventKind.SHELF, {
    books: {},
    local: { [id]: { title: reg('Exercícios de violão'), position: reg(0) } },
  });

// A hosted book the caller owns.
const hostedShelf = (id = 'srv-1') =>
  event(EventKind.SHELF, {
    books: { [id]: { label: reg('Choros da Ana'), position: reg(1), role: reg('owner') } },
    local: {},
  });

// A hosted book the caller joined as an editor (the losing-access case: still on
// the shelf with its last-known role, but the engine has marked it `gone`).
const memberShelf = (id = 'srv-2') =>
  event(EventKind.SHELF, {
    books: { [id]: { label: reg('Choros da Ana'), position: reg(1), role: reg('editor') } },
    local: {},
  });

describe('BookDetail (workflow 7; W07 board)', () => {
  it('a device-only book shows Put online, Download and Remove — not Delete (L46-52)', async () => {
    const { store, emit } = makeStore();
    const { container } = renderDetail(store, { bookId: 'local-1', kind: 'local' });
    emit(localShelf());

    expect(screen.getByRole('button', { name: 'Put online' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove from my shelf' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete the book' })).toBeNull();
    // Where-it-lives chip is a word, not colour alone.
    expect(screen.getByText('On this device')).toBeInTheDocument();
    expect(screen.getByText('You can save')).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a hosted owned book shows Download, Remove and Delete, and the Estante chips (L136-137)', async () => {
    const { store, emit } = makeStore();
    renderDetail(store, { bookId: 'srv-1', kind: 'shared' });
    emit(hostedShelf());

    expect(screen.queryByRole('button', { name: 'Put online' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove from my shelf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete the book' })).toBeInTheDocument();
    expect(screen.getByText('On Estante · private')).toBeInTheDocument();
    expect(screen.getByText('You own it')).toBeInTheDocument();
  });

  it('Put online dispatches PUT_ONLINE, and a quota refusal words a message (acceptance 2)', async () => {
    const { store, sent, emit } = makeStore();
    renderDetail(store, { bookId: 'local-1', kind: 'local' });
    emit(localShelf());

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Put online' })));
    expect(lastCommand(sent, CommandKind.PUT_ONLINE).payload.bookId).toBe('local-1');

    // The service create was refused for quota: a worded message appears.
    emit(event(EventKind.BOOK_ONLINE_REFUSED, { bookId: 'local-1', reason: 'quota' }));
    expect(screen.getByText(/Your account is full/)).toBeInTheDocument();
  });

  it('the Delete typed-name confirm acts only on an exact match (service.books guard)', async () => {
    const { store, sent, emit } = makeStore();
    renderDetail(store, { bookId: 'srv-1', kind: 'shared' });
    emit(hostedShelf());

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Delete the book' })));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Delete Choros da Ana from Estante\?/)).toBeInTheDocument();
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();

    const field = within(dialog).getByRole('textbox', { name: 'Type the book’s name to confirm' });
    const confirm = within(dialog).getByRole('button', { name: 'Delete the book' });

    // A wrong name does nothing.
    act(() => fireEvent.change(field, { target: { value: 'Wrong name' } }));
    act(() => fireEvent.click(confirm));
    expect(lastCommand(sent, CommandKind.DELETE_BOOK)).toBeUndefined();

    // The exact name enables the delete.
    act(() => fireEvent.change(field, { target: { value: 'Choros da Ana' } }));
    act(() => fireEvent.click(confirm));
    expect(lastCommand(sent, CommandKind.DELETE_BOOK).payload.bookId).toBe('srv-1');
  });

  it('Remove warns of unpushed saves for a hosted book (L128-135)', async () => {
    const { store, emit } = makeStore();
    renderDetail(store, { bookId: 'srv-1', kind: 'shared' });
    emit(hostedShelf());
    // The book has two saves not yet on Estante.
    emit(
      event(EventKind.SYNC, { bookId: 'srv-1', phase: 'saves_waiting', savesWaiting: 2, at: AT }),
    );

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Remove from my shelf' })));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/2 saves not yet on Estante/)).toBeInTheDocument();
    // A hosted book's remove offers no Download — the book stays on Estante.
    expect(within(dialog).queryByRole('button', { name: 'Download' })).toBeNull();
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('a gone book shows the no-longer-shared notice and offers Download and Make this book your own (sync.lost_access AC2-4; workflow 8 L66-69; W11 board)', async () => {
    const { store, sent, emit } = makeStore();
    const { container } = renderDetail(store, { bookId: 'srv-2', kind: 'shared' });
    emit(memberShelf());
    // The engine marked the book gone (the live `sync` slice the shelf badge
    // reads too — no new store).
    emit(event(EventKind.SYNC, { bookId: 'srv-2', phase: 'gone', at: AT }));

    // The notice names the state in a word, in a live region (never colour alone;
    // Constraint 5, mockups/README.md:26).
    expect(screen.getByText('No longer shared with you')).toBeInTheDocument();
    const body = screen.getByText(/no longer shared with you, so it will not sync again/);
    expect(body).toHaveAttribute('role', 'status');
    // The notice says the copy, history and songs are all here (readable as is).
    expect(body).toHaveTextContent(/your copy, its history and its songs are all here/);

    // Both escape offers are present and labelled (acceptance 4).
    const download = screen.getByRole('button', { name: 'Download' });
    const fork = screen.getByRole('button', { name: 'Make this book your own' });
    expect(download).toBeInTheDocument();
    expect(fork).toBeInTheDocument();

    // Keyboard-reachable: focus and activate the fork offer. It opens the
    // make-it-your-own sheet (books.fork AC3) — following has already ended, so
    // the *keeps following* point is dropped — whose confirm sends FORK_BOOK.
    fork.focus();
    expect(fork).toHaveFocus();
    act(() => fireEvent.click(fork));
    const sheet = screen.getByRole('dialog', { name: /make it your own\?/ });
    expect(within(sheet).queryByText(/keeps following/)).toBeNull();
    expect(lastCommand(sent, CommandKind.FORK_BOOK)).toBeUndefined();
    expect(await checkWcag21aa(sheet)).toHaveNoViolations();
    act(() => fireEvent.click(within(sheet).getByRole('button', { name: 'Make it my own' })));
    expect(lastCommand(sent, CommandKind.FORK_BOOK).payload.bookId).toBe('srv-2');
    act(() => fireEvent.click(within(sheet).getByRole('button', { name: 'Not now' })));

    // Download stays wired to the existing zip (functional, acceptance 4).
    act(() => fireEvent.click(download));
    expect(lastCommand(sent, CommandKind.DOWNLOAD_BOOK).payload.bookId).toBe('srv-2');

    // axe clean at WCAG 2.1 AA on the gone detail.
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a book not gone shows no losing-access notice (the notice is scoped to the gone phase)', async () => {
    const { store, emit } = makeStore();
    renderDetail(store, { bookId: 'srv-1', kind: 'shared' });
    emit(hostedShelf());
    emit(event(EventKind.SYNC, { bookId: 'srv-1', phase: 'in_step', at: AT }));

    expect(screen.queryByText('No longer shared with you')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make this book your own' })).toBeNull();
  });

  it('a taken-down book shows the operator reason in a live region beside Download, no gone card and no fork (books.notice_surface; workflow 10 §A copyright notice; DIRECTION §3.6)', async () => {
    const { store, sent, emit } = makeStore();
    // The reason is written for this test — the service frames it; it is never a
    // real notice (no-song-text / no-copyrighted-words rule).
    const REASON =
      'This book has been taken down: a copyright notice was filed by the rights holder.';
    const { container } = renderDetail(store, { bookId: 'srv-2', kind: 'shared' });
    emit(memberShelf());
    // The engine recovered the take-down reason from the git refusal and emitted
    // the distinct `taken_down` phase carrying it (the live `sync` slice).
    emit(event(EventKind.SYNC, { bookId: 'srv-2', phase: 'taken_down', reason: REASON, at: AT }));

    // The localized title frames the notice; the reason is rendered verbatim in a
    // live region (state carried by a word, never colour alone — Constraint 5,
    // mockups/README.md:26).
    expect(screen.getByText('This book has been taken down')).toBeInTheDocument();
    const body = screen.getByText(REASON);
    expect(body).toHaveAttribute('role', 'status');

    // It is NOT the lost-access card: no "no longer shared with you" copy, and no
    // fork offer (a copyright take-down is not a make-it-your-own case — Decision 3).
    expect(screen.queryByText('No longer shared with you')).toBeNull();
    expect(
      screen.queryByText(/no longer shared with you, so it will not sync again/),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Make this book your own' })).toBeNull();

    // Download stays reachable — the book is still readable and exportable
    // (acceptance 5; the universal card).
    const download = screen.getByRole('button', { name: 'Download' });
    act(() => fireEvent.click(download));
    expect(lastCommand(sent, CommandKind.DOWNLOAD_BOOK).payload.bookId).toBe('srv-2');

    // axe clean at WCAG 2.1 AA on the taken-down detail.
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a book not taken down shows no take-down notice (the notice is scoped to the taken_down phase)', async () => {
    const { store, emit } = makeStore();
    renderDetail(store, { bookId: 'srv-1', kind: 'shared' });
    emit(hostedShelf());
    emit(event(EventKind.SYNC, { bookId: 'srv-1', phase: 'in_step', at: AT }));

    expect(screen.queryByText('This book has been taken down')).toBeNull();
  });

  // books.fork AC2 — lowered to reader with saves not yet pushed (workflow 10
  // L83-85): the push was refused `403 forbidden`, the engine says cannot_save.
  it('a cannot_save book says how many saves can no longer go to it, with Make this book your own and Download; axe clean', async () => {
    const { store, sent, emit } = makeStore();
    const { container } = renderDetail(store, { bookId: 'srv-2', kind: 'shared' });
    emit(memberShelf());
    emit(event(EventKind.SYNC, { bookId: 'srv-2', phase: 'cannot_save', savesWaiting: 1, at: AT }));

    expect(screen.getByText('Can’t save here')).toBeInTheDocument();
    const body = screen.getByText(
      '1 save can no longer go to Choros da Ana: you can read it, but no longer save to it.',
    );
    expect(body).toHaveAttribute('role', 'status');
    expect(screen.getByRole('button', { name: 'Download' })).toBeInTheDocument();
    // The deliberate Fork card stands down while this card makes the offer.
    expect(screen.queryByRole('button', { name: 'Fork' })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Make this book your own' })));
    const sheet = screen.getByRole('dialog', { name: /make it your own\?/ });
    act(() => fireEvent.click(within(sheet).getByRole('button', { name: 'Make it my own' })));
    expect(lastCommand(sent, CommandKind.FORK_BOOK).payload.bookId).toBe('srv-2');
  });

  it('the plural count reads *N saves can no longer go to …*', () => {
    const { store, emit } = makeStore();
    renderDetail(store, { bookId: 'srv-2', kind: 'shared' });
    emit(memberShelf());
    emit(event(EventKind.SYNC, { bookId: 'srv-2', phase: 'cannot_save', savesWaiting: 3, at: AT }));
    expect(
      screen.getByText('3 saves can no longer go to Choros da Ana: you can read it, but no longer save to it.'),
    ).toBeInTheDocument();
  });

  // books.fork AC4 — the deliberate way in (W11 board :189-196): a Fork card on a
  // hosted book the user does not own, between Download and Remove.
  for (const role of ['reader', 'editor']) {
    it(`a ${role}'s hosted book carries the Fork card, which opens the sheet; axe clean`, async () => {
      const { store, sent, emit } = makeStore();
      const { container } = renderDetail(store, { bookId: 'srv-3', kind: 'shared' });
      emit(
        event(EventKind.SHELF, {
          books: { 'srv-3': { label: reg('Banda do Bairro'), position: reg(1), role: reg(role) } },
          local: {},
        }),
      );

      expect(
        screen.getByText('Your own copy of Banda do Bairro, with its history, that keeps following it.'),
      ).toBeInTheDocument();
      // Between Download and Remove, in reading order.
      const names = screen.getAllByRole('button').map((b) => b.textContent);
      const at = (n) => names.findIndex((x) => x.includes(n));
      expect(at('Download')).toBeLessThan(at('Fork'));
      expect(at('Fork')).toBeLessThan(at('Remove from my shelf'));
      expect(await checkWcag21aa(container)).toHaveNoViolations();

      act(() => fireEvent.click(screen.getByRole('button', { name: 'Fork' })));
      const sheet = screen.getByRole('dialog', { name: 'Banda do Bairro is someone else’s — make it your own?' });
      // It keeps following its original: the point is there.
      expect(within(sheet).getByText(/keeps following Banda do Bairro/)).toBeInTheDocument();
      expect(await checkWcag21aa(sheet)).toHaveNoViolations();
      act(() => fireEvent.click(within(sheet).getByRole('button', { name: 'Make it my own' })));
      expect(lastCommand(sent, CommandKind.FORK_BOOK).payload.bookId).toBe('srv-3');
    });
  }

  it('no Fork card for an owned, local, home or taken-down book', () => {
    const owned = makeStore();
    renderDetail(owned.store, { bookId: 'srv-1', kind: 'shared' });
    owned.emit(hostedShelf());
    expect(screen.queryByRole('button', { name: 'Fork' })).toBeNull();
    cleanup();

    const local = makeStore();
    renderDetail(local.store, { bookId: 'local-1', kind: 'local' });
    local.emit(localShelf());
    expect(screen.queryByRole('button', { name: 'Fork' })).toBeNull();
    cleanup();

    const home = makeStore();
    renderDetail(home.store, { bookId: 'home', kind: 'shared' });
    home.emit(
      event(EventKind.SHELF, {
        books: { home: { label: reg('Home'), role: reg('reader') } },
        local: {},
      }),
    );
    expect(screen.queryByRole('button', { name: 'Fork' })).toBeNull();
    cleanup();

    const takenDown = makeStore();
    renderDetail(takenDown.store, { bookId: 'srv-2', kind: 'shared' });
    takenDown.emit(memberShelf());
    takenDown.emit(
      event(EventKind.SYNC, { bookId: 'srv-2', phase: 'taken_down', reason: 'A notice written for this test.', at: AT }),
    );
    expect(screen.queryByRole('button', { name: 'Fork' })).toBeNull();
  });

  it('Remove warns a device-only book is gone for good and offers Download first (L128-135)', async () => {
    const { store, sent, emit } = makeStore();
    renderDetail(store, { bookId: 'local-1', kind: 'local' });
    emit(localShelf());

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Remove from my shelf' })));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/deletes it for good/)).toBeInTheDocument();
    // Download is offered first (workflow 7 L128-135).
    const download = within(dialog).getByRole('button', { name: 'Download' });
    act(() => fireEvent.click(download));
    expect(lastCommand(sent, CommandKind.DOWNLOAD_BOOK).payload.bookId).toBe('local-1');
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });
});
