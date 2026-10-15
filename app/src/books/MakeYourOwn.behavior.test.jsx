// Behavior (React) — the make-it-your-own sheet (books.fork, workflow 11 §Ways
// in; W11 board #1 :49-63). Rendered inside ThemeRoot the way the app mounts it,
// so the overlay portals into the `.est` token root
// ([[rac-overlays-portal-outside-est-theme-root]]); the Worker's replies are
// emitted through a store double and the commands it sends are asserted. Book
// names are written for the test (no-song-text rule).
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import MakeYourOwn from './MakeYourOwn.jsx';

globalThis.matchMedia = (media) => ({
  media,
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});

afterEach(() => cleanup());

const BOOK = 'srv-orig';
const TITLE = 'Choros da Ana';

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const commandsOf = (sent, kind) => sent.filter((c) => c.kind === kind);

function Harness({ store, open, props }) {
  return (
    <ThemeRoot store={store}>
      <MakeYourOwn store={store} isOpen={open} bookId={BOOK} bookTitle={TITLE} {...props} />
    </ThemeRoot>
  );
}

// Mount closed, then open — as a host does, so the portal container exists.
function renderSheet(store, props = {}) {
  const utils = render(<Harness store={store} open={false} props={props} />);
  utils.rerender(<Harness store={store} open props={props} />);
  return utils;
}

describe('make it your own — the sheet (books.fork; W11 board #1)', () => {
  it('shows the board #1 copy: title, body, the three points, the small print and both buttons; axe clean', async () => {
    const { store, sent } = makeStore();
    renderSheet(store);

    const dialog = screen.getByRole('dialog', {
      name: 'Choros da Ana is someone else’s — make it your own?',
    });
    expect(
      within(dialog).getByText('You can read Choros da Ana, but not save to it. Making it your own gives you:'),
    ).toBeInTheDocument();
    const points = within(dialog).getAllByRole('listitem');
    expect(points.map((p) => p.textContent)).toEqual([
      'Your own copy of the book, with all its history. Your edits move into it and save there.',
      'It keeps following Choros da Ana: when it has new saves, you choose when to bring them in.',
      'It takes the place of Choros da Ana on your shelf, so nothing shows twice.',
    ]);
    expect(
      within(dialog).getByText(
        'Your copy goes on Estante, private to you. You can share it, with its own limit of 50 people.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Make it my own' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Not now' })).toBeInTheDocument();
    // Nothing is sent until the user confirms.
    expect(commandsOf(sent, CommandKind.FORK_BOOK)).toHaveLength(0);
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('after losing access drops the *keeps following* point (workflow 11 §When the original can no longer be opened)', async () => {
    const { store } = makeStore();
    renderSheet(store, { following: false });
    const points = screen.getAllByRole('listitem').map((p) => p.textContent);
    expect(points).toHaveLength(2);
    expect(points.some((p) => /keeps following/.test(p))).toBe(false);
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();
  });

  it('Make it my own sends FORK_BOOK and says the busy word in role="status"; BOOK_FORKED closes it', async () => {
    const { store, sent, emit } = makeStore();
    const onForked = vi.fn();
    const onClose = vi.fn();
    renderSheet(store, { onForked, onClose });

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Make it my own' })));
    const forks = commandsOf(sent, CommandKind.FORK_BOOK);
    expect(forks).toHaveLength(1);
    expect(forks[0].payload.bookId).toBe(BOOK);
    expect(screen.getByRole('status')).toHaveTextContent('Making it your own…');
    // Busy: a second press sends nothing more.
    expect(screen.getByRole('button', { name: 'Make it my own' })).toBeDisabled();

    // Another book's fork does not touch this sheet.
    emit(event(EventKind.BOOK_FORKED, { previousBookId: 'other', bookId: 'x' }));
    expect(onForked).not.toHaveBeenCalled();

    emit(event(EventKind.BOOK_FORKED, { previousBookId: BOOK, bookId: 'srv-fork', via: 'service' }));
    expect(onForked).toHaveBeenCalledWith(
      expect.objectContaining({ previousBookId: BOOK, bookId: 'srv-fork' }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('says the offline and 413 refusals in words, and stays open for another try (Constraint 8)', async () => {
    const { store, emit } = makeStore();
    renderSheet(store);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Make it my own' })));
    emit(event(EventKind.FORK_FAILED, { bookId: BOOK, code: 'offline', message: 'fork: unreachable' }));
    expect(screen.getByRole('status')).toHaveTextContent('Making it your own needs the network.');
    const again = screen.getByRole('button', { name: 'Make it my own' });
    expect(again).toBeEnabled();
    expect(await checkWcag21aa(screen.getByRole('dialog'))).toHaveNoViolations();

    act(() => fireEvent.click(again));
    emit(event(EventKind.FORK_FAILED, { bookId: BOOK, code: 'quota', message: 'fork: 413' }));
    expect(screen.getByRole('status')).toHaveTextContent('This would put you over your limit on Estante.');
  });

  it('is keyboard-operable: both buttons take focus in the tab order; Enter makes it, Space on Not now closes', async () => {
    const { store, sent } = makeStore();
    const onClose = vi.fn();
    renderSheet(store, { onClose });

    const make = screen.getByRole('button', { name: 'Make it my own' });
    const notNow = screen.getByRole('button', { name: 'Not now' });
    // Both are in the tab order (no negative tabindex) and take focus.
    for (const el of [make, notNow]) {
      expect(el.getAttribute('tabindex')).not.toBe('-1');
      el.focus();
      expect(el).toHaveFocus();
    }

    // Enter on Make it my own (a RAC Button: keyDown + keyUp, one gesture).
    make.focus();
    fireEvent.keyDown(make, { key: 'Enter' });
    fireEvent.keyUp(make, { key: 'Enter' });
    expect(commandsOf(sent, CommandKind.FORK_BOOK)).toHaveLength(1);

    // Space on Not now closes the sheet.
    notNow.focus();
    fireEvent.keyDown(notNow, { key: ' ' });
    fireEvent.keyUp(notNow, { key: ' ' });
    expect(onClose).toHaveBeenCalled();
  });
});
