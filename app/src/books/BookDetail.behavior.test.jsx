// Behavior (React) — the per-book detail (books.online, workflow 7 L128-137;
// the W07 board copy). The detail renders the applicable acts and chips (words,
// not colour); the delete typed-name confirm acts only on an exact match; the
// remove "what would be lost" confirm shows the unsaved/unpushed warning for a
// hosted book and the "gone for good + Download first" warning for a device-only
// book; axe is clean on each overlay. Rendered inside ThemeRoot the way the app
// mounts it, so its overlays portal into the `.est` token root (the app-wide
// UNSAFE_PortalProvider) — [[rac-overlays-portal-outside-est-theme-root]].
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, within, cleanup, waitFor } from '@testing-library/react';

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
    const { store, sent, emit } = makeStore();
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
    // No survey reply has arrived: the `sync` slice's count stood in
    // (books.remove_counts_unsaved Constraint 3), and the confirm is pressable
    // before the reply and sends REMOVE_BOOK (Constraint 5).
    const confirm = within(dialog).getByRole('button', { name: 'Remove from my shelf' });
    expect(confirm).toBeEnabled();
    act(() => fireEvent.click(confirm));
    expect(lastCommand(sent, CommandKind.REMOVE_BOOK).payload.bookId).toBe('srv-1');
  });

  // books.remove_counts_unsaved — workflow 7 L148-149; Remove-from-shelf board L72-82.
  const survey = (books) => event(EventKind.SIGN_OUT_SURVEY, { books });

  it('Remove counts unsaved songs and names them for a hosted book (workflow 7 L148-149; Remove-from-shelf L72-82)', async () => {
    const { store, sent, emit } = makeStore();
    renderDetail(store, { bookId: 'srv-1', kind: 'shared' });
    emit(hostedShelf());

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Remove from my shelf' })));
    const dialog = screen.getByRole('dialog');
    // Opening asks the Worker for the counts (Constraint 1, Decision 1).
    expect(lastCommand(sent, CommandKind.SURVEY_SIGN_OUT)).toBeTruthy();
    emit(
      survey([
        { id: 'other', title: 'Outro Livro', unsavedSongs: 3, unsavedTitles: ['Canção Alheia'], savesWaiting: 4 },
        { id: 'srv-1', title: 'Choros da Ana', unsavedSongs: 1, unsavedTitles: ['Rua do Porto'], savesWaiting: 0 },
      ]),
    );

    expect(within(dialog).getByText('1 song with unsaved changes will be lost')).toBeInTheDocument();
    expect(within(dialog).getByText(/Rua do Porto/)).toBeInTheDocument();
    // No saves waiting: the second line is the in-step body (Decision 3).
    expect(
      within(dialog).getByText('Deletes this device’s copy only. The book stays on Estante.'),
    ).toBeInTheDocument();
    // Only this book's entry is kept.
    expect(within(dialog).queryByText(/Canção Alheia/)).toBeNull();
    expect(within(dialog).queryByText(/saves not yet on Estante/)).toBeNull();
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('Remove shows unsaved songs beside saves waiting (workflow 7 L148-149; Remove-from-shelf L72-82)', async () => {
    const { store, emit } = makeStore();
    renderDetail(store, { bookId: 'srv-1', kind: 'shared' });
    emit(hostedShelf());

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Remove from my shelf' })));
    const dialog = screen.getByRole('dialog');
    emit(
      survey([
        { id: 'srv-1', title: 'Choros da Ana', unsavedSongs: 2, unsavedTitles: ['Valsa Nova', 'Samba Curto'], savesWaiting: 2 },
      ]),
    );

    const unsaved = within(dialog).getByText('2 songs with unsaved changes will be lost');
    expect(within(dialog).getByText(/Valsa Nova, Samba Curto/)).toBeInTheDocument();
    // The survey's saves waiting is used once it arrives (Decision 2), and the
    // unsaved line sits above it (board L75-76).
    const waiting = within(dialog).getByText(/2 saves not yet on Estante/);
    expect(unsaved.compareDocumentPosition(waiting) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    // A device-only book's dialog asks for no survey (books.remove_counts_unsaved
    // Constraint 4).
    expect(lastCommand(sent, CommandKind.SURVEY_SIGN_OUT)).toBeUndefined();
  });
});

// books.bring_in Constraint 7 — the fork's own detail says the original went
// away, with the day it last brought the original's saves in (workflow 11 §When
// the original goes away; W11 board #4 :169).
describe('BookDetail — the original is no longer shared (books.bring_in; W11 board #4)', () => {
  const YEAR = new Date().getFullYear();
  const ORIGINAL = {
    bookId: 'srv-orig',
    title: 'Choros da Ana',
    link: 'https://estante.example/git/srv-orig',
    followedAt: `${YEAR}-09-28T12:00:00.000Z`,
  };
  const forkShelf = (original) =>
    event(EventKind.SHELF, {
      books: {
        'srv-fork': {
          label: reg('Choros da Ana'),
          position: reg(1),
          role: reg('owner'),
          ...(original ? { original: reg(original) } : {}),
        },
      },
      local: {},
    });
  const TITLE = 'The original is no longer shared with you.';

  it('a fork whose register has goneAt shows the card with its role=status body and the date; axe clean', async () => {
    const { store, emit } = makeStore();
    const { container } = renderDetail(store, { bookId: 'srv-fork', kind: 'shared' });
    emit(forkShelf({ ...ORIGINAL, goneAt: AT }));

    expect(screen.getByText(TITLE)).toBeInTheDocument();
    const body = screen.getByText(/This book stops following Choros da Ana/);
    expect(body).toHaveAttribute('role', 'status');
    expect(body).toHaveTextContent(
      'This book stops following Choros da Ana; it was last brought in on 28 September. Nothing else changes: your copy, its history and its songs are all here, and you save, share and sync it as before.',
    );
    // Independent of the fork's own phase: no lost-access card.
    expect(screen.queryByText('No longer shared with you')).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('the live ORIGINAL gone fact shows the card before the register re-surfaces', () => {
    const { store, emit } = makeStore();
    renderDetail(store, { bookId: 'srv-fork', kind: 'shared' });
    emit(forkShelf(ORIGINAL));
    expect(screen.queryByText(TITLE)).toBeNull();
    emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 0, gone: true }));
    expect(screen.getByText(TITLE)).toBeInTheDocument();
    expect(screen.getByText(/last brought in on 28 September/)).toBeInTheDocument();
  });

  it('a missing followedAt drops the date clause', () => {
    const { store, emit } = makeStore();
    renderDetail(store, { bookId: 'srv-fork', kind: 'shared' });
    emit(forkShelf({ bookId: 'srv-orig', title: 'Choros da Ana', link: ORIGINAL.link, goneAt: AT }));
    expect(screen.getByText(/This book stops following Choros da Ana\. Nothing else changes/)).toHaveAttribute(
      'role',
      'status',
    );
    expect(screen.queryByText(/last brought in/)).toBeNull();
  });

  it('no card for a fork still following, nor for a book that is not a fork', () => {
    const following = makeStore();
    renderDetail(following.store, { bookId: 'srv-fork', kind: 'shared' });
    following.emit(forkShelf(ORIGINAL));
    following.emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 2, gone: false }));
    expect(screen.queryByText(TITLE)).toBeNull();
    cleanup();

    const plain = makeStore();
    renderDetail(plain.store, { bookId: 'srv-fork', kind: 'shared' });
    plain.emit(forkShelf(null));
    expect(screen.queryByText(TITLE)).toBeNull();
  });
});

// Leaving one shared book (books.leave; workflow 10 §Leaving a book L95-143;
// Leave-book board L72-77, L103-106, L121-134, L192). The card is a member's
// only; the confirmation counts what this device would lose from the Worker's
// SIGN_OUT_SURVEY (Decision 2); the view sends LEAVE_BOOK and reacts to
// BOOK_LEFT / LEAVE_FAILED.
describe('Leave this book (books.leave; workflow 10 §Leaving a book)', () => {
  const readerShelf = (id = 'srv-3') =>
    event(EventKind.SHELF, {
      books: { [id]: { label: reg('Roda de Choro'), position: reg(1), role: reg('reader') } },
      local: {},
    });
  const leaveCard = () => screen.queryByRole('button', { name: 'Leave this book' });
  const openLeave = () => {
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Leave this book' })));
    return screen.getByRole('alertdialog');
  };
  const survey = (books) => event(EventKind.SIGN_OUT_SURVEY, { books });

  it('is shown to a reader and to an editor, below Remove from my shelf (L95-101); axe clean on the card', async () => {
    for (const [shelf, id] of [
      [readerShelf(), 'srv-3'],
      [memberShelf(), 'srv-2'],
    ]) {
      const { store, emit } = makeStore();
      const { container } = renderDetail(store, { bookId: id, kind: 'shared' });
      emit(shelf);
      const leave = leaveCard();
      expect(leave).toBeInTheDocument();
      expect(screen.getByText('Stop following it on all your devices.')).toBeInTheDocument();
      // Below the Remove card, in document order.
      const remove = screen.getByRole('button', { name: 'Remove from my shelf' });
      expect(remove.compareDocumentPosition(leave) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(await checkWcag21aa(container)).toHaveNoViolations();
      cleanup();
    }
  });

  it('is not shown to an owner (who sees Delete), a local book, a gone book or a taken-down book (L95-101, L141-143)', () => {
    const owned = makeStore();
    renderDetail(owned.store, { bookId: 'srv-1', kind: 'shared' });
    owned.emit(hostedShelf());
    expect(screen.getByRole('button', { name: 'Delete the book' })).toBeInTheDocument();
    expect(leaveCard()).toBeNull();
    cleanup();

    const local = makeStore();
    renderDetail(local.store, { bookId: 'local-1', kind: 'local' });
    local.emit(localShelf());
    expect(leaveCard()).toBeNull();
    cleanup();

    const gone = makeStore();
    renderDetail(gone.store, { bookId: 'srv-2', kind: 'shared' });
    gone.emit(memberShelf());
    gone.emit(event(EventKind.SYNC, { bookId: 'srv-2', phase: 'gone', at: AT }));
    expect(leaveCard()).toBeNull();
    cleanup();

    const takenDown = makeStore();
    renderDetail(takenDown.store, { bookId: 'srv-2', kind: 'shared' });
    takenDown.emit(memberShelf());
    takenDown.emit(
      event(EventKind.SYNC, { bookId: 'srv-2', phase: 'taken_down', reason: 'A notice written for this test.', at: AT }),
    );
    expect(leaveCard()).toBeNull();
  });

  it('with nothing to lose: the sentence, Leave the book and Cancel, no typed name (L114-116)', async () => {
    const { store, sent, emit } = makeStore();
    renderDetail(store, { bookId: 'srv-3', kind: 'shared' });
    emit(readerShelf());

    const dialog = openLeave();
    // Opening asks the Worker for the counts (Decision 2).
    expect(lastCommand(sent, CommandKind.SURVEY_SIGN_OUT)).toBeTruthy();
    emit(survey([{ id: 'srv-3', title: 'Roda de Choro', unsavedSongs: 0, unsavedTitles: [], savesWaiting: 0 }]));

    expect(within(dialog).getByRole('heading', { name: 'Leave Roda de Choro?' })).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'You will no longer open or sync it, on any of your devices, and it is removed from this one. The owner can invite you again.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getAllByRole('button').map((b) => b.textContent)).toEqual(['Cancel', 'Leave the book']);
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(within(dialog).queryByText(/will be lost/)).toBeNull();
  });

  it('counts 2 unsaved songs and 3 saves waiting; Make it my own first opens the fork sheet, Download first sends DOWNLOAD_BOOK (L106-113); axe clean', async () => {
    const { store, sent, emit } = makeStore();
    renderDetail(store, { bookId: 'srv-2', kind: 'shared' });
    emit(memberShelf());

    const dialog = openLeave();
    // The Leave the book button is pressable before the survey arrives (Constraint 5).
    expect(within(dialog).getByRole('button', { name: 'Leave the book' })).toBeEnabled();
    emit(
      survey([
        { id: 'other', title: 'Another book', unsavedSongs: 9, unsavedTitles: [], savesWaiting: 9 },
        { id: 'srv-2', title: 'Choros da Ana', unsavedSongs: 2, unsavedTitles: ['Valsa Nova', 'Samba Curto'], savesWaiting: 3 },
      ]),
    );

    expect(within(dialog).getByText('2 songs with unsaved changes will be lost')).toBeInTheDocument();
    expect(within(dialog).getByText(/Valsa Nova, Samba Curto/)).toBeInTheDocument();
    expect(within(dialog).getByText('3 saves have not reached the book and never will')).toBeInTheDocument();
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();

    // Download first sends DOWNLOAD_BOOK and leaves the dialog open.
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Download first' })));
    expect(lastCommand(sent, CommandKind.DOWNLOAD_BOOK).payload).toEqual({ bookId: 'srv-2' });
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();

    // Make it my own first closes the dialog and opens the fork sheet.
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Make it my own first' })));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('dialog', { name: /make it your own\?/ })).toBeInTheDocument();
    expect(lastCommand(sent, CommandKind.LEAVE_BOOK)).toBeUndefined();
  });

  it('Leave the book sends LEAVE_BOOK {bookId}, and BOOK_LEFT closes the detail (L119-125)', () => {
    const { store, sent, emit } = makeStore();
    let backs = 0;
    renderDetail(store, { bookId: 'srv-3', kind: 'shared', onBack: () => (backs += 1) });
    emit(readerShelf());

    const dialog = openLeave();
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Leave the book' })));
    expect(lastCommand(sent, CommandKind.LEAVE_BOOK).payload).toMatchObject({ bookId: 'srv-3' });

    // Another book's BOOK_LEFT is not ours.
    emit(event(EventKind.BOOK_LEFT, { bookId: 'srv-other' }));
    expect(backs).toBe(0);
    emit(event(EventKind.BOOK_LEFT, { bookId: 'srv-3' }));
    expect(backs).toBe(1);
  });

  it('LEAVE_FAILED keeps the dialog open with “You did not leave …” in a live region (L128-130, Decision 7); axe clean', async () => {
    const { store, sent, emit } = makeStore();
    renderDetail(store, { bookId: 'srv-3', kind: 'shared' });
    emit(readerShelf());

    const dialog = openLeave();
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Leave the book' })));
    emit(event(EventKind.LEAVE_FAILED, { bookId: 'srv-3', reason: 'network' }));

    expect(screen.getByRole('alertdialog')).toBe(dialog);
    const status = within(dialog).getByRole('status');
    expect(status).toHaveTextContent('You did not leave Roda de Choro. You are still a member.');
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();

    // The buttons stay, so the person can retry.
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Leave the book' })));
    expect(sent.filter((m) => m.kind === CommandKind.LEAVE_BOOK)).toHaveLength(2);
  });

  it('offline: the button is disabled and the card says Leaving needs a connection (L127-128, Decision 8)', async () => {
    const { store, emit } = makeStore();
    const { container } = renderDetail(store, { bookId: 'srv-3', kind: 'shared' });
    emit(readerShelf());
    try {
      await act(async () => {
        globalThis.dispatchEvent(new Event('offline'));
      });
      expect(leaveCard()).toBeDisabled();
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent('Leaving needs a connection. Nothing has changed; you are still a member.');
      expect(await checkWcag21aa(container)).toHaveNoViolations();

      await act(async () => {
        globalThis.dispatchEvent(new Event('online'));
      });
      expect(leaveCard()).toBeEnabled();
      expect(screen.queryByText(/Leaving needs a connection/)).toBeNull();
    } finally {
      globalThis.dispatchEvent(new Event('online'));
    }
  });

  it('Escape cancels, sends nothing, and returns focus to the card’s button', async () => {
    const { store, sent, emit } = makeStore();
    renderDetail(store, { bookId: 'srv-3', kind: 'shared' });
    emit(readerShelf());

    // Keyboard path: the card's button holds focus when the dialog opens.
    act(() => leaveCard().focus());
    const dialog = openLeave();
    await act(async () => {
      fireEvent.keyDown(dialog, { key: 'Escape' });
      fireEvent.keyUp(dialog, { key: 'Escape' });
    });

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(lastCommand(sent, CommandKind.LEAVE_BOOK)).toBeUndefined();
    await waitFor(() => expect(document.activeElement).toBe(leaveCard()));
  });
});
