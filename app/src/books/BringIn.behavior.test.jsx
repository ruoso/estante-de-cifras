// behavior — the *Bring them in* screen (books.bring_in; workflow 11 §Following
// the original; W11 board #3). Synthetic BRING_IN_PREVIEW / BRING_IN_DONE replies
// through the real main-thread store over an inline endpoint (the upload
// preview's pattern, upload_ui Decision 7; books.bring_in Decision 8): the
// Worker's own path against a real original remote is pinned in
// worker/bring-in.behavior.test.js, and the e2e-web journey runs it on the stack.
// Axe (WCAG 2.1 AA — the rules that run under jsdom) covers the preview and the
// offline reply. Song and book names are written for this test (no-song-text
// rule).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import BringIn from './BringIn.jsx';

const BOOK_ID = 'srv-fork';
const ORIGINAL = 'Choros da Ana';

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const commands = (sent, kind) => sent.filter((m) => m.kind === kind);
const lastCommand = (sent, kind) => [...sent].reverse().find((m) => m.kind === kind);

function renderBringIn(store, props = {}) {
  const onClose = vi.fn();
  const onNeedsYou = vi.fn();
  const utils = render(
    <ThemeRoot store={store}>
      <BringIn
        store={store}
        bookId={BOOK_ID}
        book={ORIGINAL}
        original={ORIGINAL}
        onClose={onClose}
        onNeedsYou={onNeedsYou}
        {...props}
      />
    </ThemeRoot>,
  );
  return { ...utils, onClose, onNeedsYou };
}

const CHANGES = [
  { kind: 'chord', op: 'changed', where: { section: 'Primeira Parte', bar: 5 }, before: 'G7', after: 'Db7' },
];

// W11 board data L240-251: a changed, an added and a conflict row (in the
// Worker's order, not alphabetical).
const PREVIEW = {
  bookId: BOOK_ID,
  followId: 'f-1',
  original: { bookId: 'srv-orig', title: ORIGINAL },
  newSaves: 3,
  previews: [
    { path: 'tarde.cifra.md', title: 'Tarde Clara', status: 'changed', changes: CHANGES },
    { path: 'choro/nasce.cifra.md', title: 'Nasce o Dia', status: 'added' },
    { path: 'lamento.cifra.md', title: 'Lamento Azul', status: 'conflict' },
  ],
};
const preview = (overrides = {}) => event(EventKind.BRING_IN_PREVIEW, { ...PREVIEW, ...overrides });
const done = (payload) => event(EventKind.BRING_IN_DONE, { bookId: BOOK_ID, ...payload });

const press = (button) =>
  act(() => {
    fireEvent.keyDown(button, { key: 'Enter' });
    fireEvent.keyUp(button, { key: 'Enter' });
  });

// The screen's tab order: its enabled, tabbable controls in document order.
const tabOrder = (container) =>
  [...container.querySelectorAll('.bring-in input, .bring-in button, .bring-in [tabindex]')].filter(
    (el) => !el.disabled && el.getAttribute('tabindex') !== '-1',
  );

describe('BringIn — the lifecycle (books.bring_in Constraint 5; workflow 11 §Following the original)', () => {
  it('on mount sends PREVIEW_BRING_IN { bookId } and shows the fetching status; focus is on the heading', () => {
    const { store, sent } = makeStore();
    renderBringIn(store);
    expect(lastCommand(sent, CommandKind.PREVIEW_BRING_IN).payload).toEqual({ bookId: BOOK_ID });
    expect(screen.getByRole('status')).toHaveTextContent(`Fetching the new saves from ${ORIGINAL}…`);
    const heading = screen.getByRole('heading', { name: `Bring in saves from ${ORIGINAL}` });
    expect(document.activeElement).toBe(heading);
  });

  it('a changed, an added and a conflict row: title, body, rows, note, conflict notice, caption; axe clean (W11 #3)', async () => {
    const { store, emit } = makeStore();
    const { container } = renderBringIn(store);
    emit(preview());

    expect(screen.getByRole('heading', { name: `Bring in saves from ${ORIGINAL}` })).toBeInTheDocument();
    expect(
      screen.getByText(
        `3 new saves in ${ORIGINAL} since you last brought them in. Nothing is written to ${ORIGINAL} until you confirm.`,
      ),
    ).toBeInTheDocument();
    // Each row's title and status word (the upload's rows, PreviewRows).
    for (const [title, word] of [
      ['Tarde Clara', 'changed'],
      ['Nasce o Dia', 'added'],
      ['Lamento Azul', 'conflict'],
    ]) {
      const row = screen.getByText(title).closest('.row');
      expect(row.querySelector('.badge')).toHaveTextContent(word);
    }
    // The changed row's diff lines (DiffRows).
    expect(screen.getByText('Primeira Parte bar 5')).toBeInTheDocument();
    expect(screen.getByText('G7 → Db7')).toBeInTheDocument();
    // The note, already written: every row's title, alphabetical.
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue(
      `Bring in changes from ${ORIGINAL}: Lamento Azul, Nasce o Dia, and Tarde Clara`,
    );
    // The conflict notice names the conflicting song.
    expect(
      screen.getByText(
        'Lamento Azul meets your own edits. After confirming you’ll settle it one conflict at a time; the rest comes in at once.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Merges into your copy, saves, and sends it to Estante.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Bring them in' })).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('keyboard: Tab reaches the note, Not now, Bring them in; Enter on Not now sends CANCEL_BRING_IN and closes', () => {
    const { store, sent, emit } = makeStore();
    const { container, onClose } = renderBringIn(store);
    emit(preview());

    const note = screen.getByRole('textbox', { name: 'Note' });
    const notNow = screen.getByRole('button', { name: 'Not now' });
    const confirm = screen.getByRole('button', { name: 'Bring them in' });
    const order = tabOrder(container);
    expect(order.indexOf(note)).toBeGreaterThan(-1);
    expect(order.indexOf(notNow)).toBeGreaterThan(order.indexOf(note));
    expect(order.indexOf(confirm)).toBeGreaterThan(order.indexOf(notNow));

    press(notNow);
    expect(lastCommand(sent, CommandKind.CANCEL_BRING_IN).payload).toEqual({ bookId: BOOK_ID, followId: 'f-1' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Enter on Bring them in sends BRING_IN with the edited note, disables both buttons, and merged closes with no cancel', () => {
    const { store, sent, emit } = makeStore();
    const { onClose, unmount } = renderBringIn(store);
    emit(preview());

    const note = screen.getByRole('textbox', { name: 'Note' });
    act(() => fireEvent.change(note, { target: { value: 'Bring in the new endings' } }));
    press(screen.getByRole('button', { name: 'Bring them in' }));

    expect(lastCommand(sent, CommandKind.BRING_IN).payload).toEqual({
      bookId: BOOK_ID,
      followId: 'f-1',
      note: 'Bring in the new endings',
    });
    expect(screen.getByRole('button', { name: 'Bring them in' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeDisabled();
    expect(screen.getByText('Bringing them in…')).toHaveAttribute('role', 'status');

    emit(done({ kind: 'merged', pushed: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount(); // the parent closes it: still no cancel after a BRING_IN
    expect(commands(sent, CommandKind.CANCEL_BRING_IN)).toHaveLength(0);
  });

  it('needs_you hands off with onNeedsYou(bookId) once the book reads needs you (workflow 9)', () => {
    const { store, emit } = makeStore();
    const { onNeedsYou, onClose } = renderBringIn(store);
    emit(preview());
    press(screen.getByRole('button', { name: 'Bring them in' }));

    emit(done({ kind: 'needs_you' }));
    emit(event(EventKind.SYNC, { bookId: BOOK_ID, phase: 'needs_you', at: '2026-10-15T12:00:00.000Z' }));
    expect(onNeedsYou).toHaveBeenCalledWith(BOOK_ID);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('stale re-sends PREVIEW_BRING_IN and says the preview was made again (Decision 5)', () => {
    const { store, sent, emit } = makeStore();
    renderBringIn(store);
    emit(preview());
    press(screen.getByRole('button', { name: 'Bring them in' }));
    expect(commands(sent, CommandKind.PREVIEW_BRING_IN)).toHaveLength(1);

    emit(done({ kind: 'stale' }));
    expect(commands(sent, CommandKind.PREVIEW_BRING_IN)).toHaveLength(2);
    expect(
      screen.getByText('Something changed since this preview, so it was made again. Check it, then bring them in.'),
    ).toBeInTheDocument();

    // The new preview is the one a confirm quotes.
    emit(preview({ followId: 'f-2' }));
    press(screen.getByRole('button', { name: 'Bring them in' }));
    expect(lastCommand(sent, CommandKind.BRING_IN).payload.followId).toBe('f-2');
  });

  it('unreachable: the offline copy, no Bring them in, nothing else sent; axe clean (Constraint 2)', async () => {
    const { store, sent, emit } = makeStore();
    const { container, onClose } = renderBringIn(store);
    emit(event(EventKind.BRING_IN_PREVIEW, { bookId: BOOK_ID, error: 'unreachable' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'Bringing them in needs the network. Nothing changed: connect, then try again.',
    );
    expect(screen.queryByRole('button', { name: 'Bring them in' })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    press(screen.getByRole('button', { name: 'Not now' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(sent.map((m) => m.kind)).toEqual([CommandKind.PREVIEW_BRING_IN]);
  });

  it('gone (and not_following): the original is no longer shared, no Bring them in (Decision 7)', () => {
    for (const reply of [{ gone: true }, { error: 'not_following' }]) {
      const { store, emit } = makeStore();
      renderBringIn(store);
      emit(event(EventKind.BRING_IN_PREVIEW, { bookId: BOOK_ID, ...reply }));
      expect(screen.getByRole('status')).toHaveTextContent('The original is no longer shared with you.');
      expect(screen.queryByRole('button', { name: 'Bring them in' })).toBeNull();
      cleanup();
    }
  });

  it('a reply for another bookId is ignored', () => {
    const { store, sent, emit } = makeStore();
    const { onClose } = renderBringIn(store);
    emit(preview({ bookId: 'srv-other' }));
    expect(screen.getByRole('status')).toHaveTextContent(`Fetching the new saves from ${ORIGINAL}…`);
    expect(screen.queryByRole('button', { name: 'Bring them in' })).toBeNull();

    emit(preview());
    press(screen.getByRole('button', { name: 'Bring them in' }));
    emit(event(EventKind.BRING_IN_DONE, { bookId: 'srv-other', kind: 'merged', pushed: true }));
    expect(onClose).not.toHaveBeenCalled();
    expect(commands(sent, CommandKind.PREVIEW_BRING_IN)).toHaveLength(1);
  });
});
