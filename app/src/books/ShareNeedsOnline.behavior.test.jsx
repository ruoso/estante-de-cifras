// behavior (books.share_needs_online; workflow 10 §Sharing a song, workflow 7
// §Putting a book online) — the body a song's Share holds for a book only on
// this device, with its real collaborators (React Aria Components, i18n, the
// store over a recording endpoint), inside ThemeRoot; axe at WCAG 2.1 AA in each
// state.
//
// Pins: the words (*only on this device*, *Put it online to invite people*, the
// book detail's private line); signed in (or unknown), Put online sends
// PUT_ONLINE {bookId} and says *Putting it online…*; signed out, *Sign in to put
// it online* and no Put online; the refusals worded as in the book detail
// (Constraint 6), a `signed_out` one also offering the sign-in.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import ShareNeedsOnline from './ShareNeedsOnline.jsx';

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const sentOf = (sent, kind) => sent.filter((m) => m.kind === kind);

function renderBody(props = {}) {
  const { store, sent, emit } = makeStore();
  const onSignIn = vi.fn();
  const view = render(
    <ThemeRoot store={store}>
      <ShareNeedsOnline store={store} bookId="local-1" bookTitle="My songs" accountStatus="in" onSignIn={onSignIn} {...props} />
    </ThemeRoot>,
  );
  return { ...view, store, sent, emit, onSignIn };
}

beforeEach(() => setLocale('en'));

describe('Share on a book only on this device (workflow 10 §Sharing a song)', () => {
  it('signed in: the words and Put online, which sends PUT_ONLINE and says Putting it online…', async () => {
    const { container, sent } = renderBody();

    expect(screen.getByText('My songs is only on this device. Put it online to invite people.')).toBeInTheDocument();
    // The local book's one sentence (books.put_online_confirm Constraint 1).
    expect(
      screen.getByText('Only on this device: nobody else can see it. Put it online to invite people — up to 50.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in to put it online' })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    const put = screen.getByRole('button', { name: 'Put online' });
    fireEvent.click(put);
    // One press, no dialog (books.put_online_confirm Constraint 7).
    expect(screen.queryByRole('alertdialog')).toBeNull();
    const commands = sentOf(sent, CommandKind.PUT_ONLINE);
    expect(commands).toHaveLength(1);
    expect(commands[0].payload).toEqual({ bookId: 'local-1' });
    expect(screen.getByRole('status')).toHaveTextContent('Putting it online…');
    expect(put).toBeDisabled();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('unknown account status still offers Put online (Decision 4)', () => {
    renderBody({ accountStatus: 'unknown' });
    expect(screen.getByRole('button', { name: 'Put online' })).toBeInTheDocument();
  });

  it('signed out: Sign in to put it online, no Put online; pressing it calls onSignIn', async () => {
    const { container, sent, onSignIn } = renderBody({ accountStatus: 'out' });

    expect(screen.queryByRole('button', { name: 'Put online' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to put it online' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(sentOf(sent, CommandKind.PUT_ONLINE)).toHaveLength(0);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('an offline refusal is worded as in the book detail, and Put online is offered again', async () => {
    const { container, emit } = renderBody();
    fireEvent.click(screen.getByRole('button', { name: 'Put online' }));

    emit(event(EventKind.BOOK_ONLINE_REFUSED, { bookId: 'local-1', reason: 'offline' }));
    expect(screen.getByRole('alert')).toHaveTextContent('You’re offline. Connect, then put it online.');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('button', { name: 'Put online' })).not.toBeDisabled();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a signed_out refusal is worded as in the book detail and also offers signing in', async () => {
    const { container, emit, onSignIn } = renderBody({ accountStatus: 'unknown' });
    fireEvent.click(screen.getByRole('button', { name: 'Put online' }));

    emit(event(EventKind.BOOK_ONLINE_REFUSED, { bookId: 'local-1', reason: 'signed_out' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Sign in to put a book online.');
    fireEvent.click(screen.getByRole('button', { name: 'Sign in to put it online' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a refusal for another book changes nothing here', () => {
    const { emit } = renderBody();
    fireEvent.click(screen.getByRole('button', { name: 'Put online' }));
    emit(event(EventKind.BOOK_ONLINE_REFUSED, { bookId: 'other', reason: 'quota' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('Putting it online…');
  });
});
