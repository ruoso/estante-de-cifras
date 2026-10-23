// behavior — the bar above a book's songs (books.row_opens_songs; workflow 7
// §A book's songs L58-85; the Open-a-book board) with its real collaborators:
// React Aria Components, the real i18n catalogues, and the real main-thread
// store + reducer driven through a loopback endpoint whose events we inject the
// way the Worker posts them. The fork's *Bring them in* is pressed through the
// book's page that hosts the bar, so the bring-in screen it opens is the real
// one and its PREVIEW_BRING_IN is the real command. Axe (the rules that run
// under jsdom) on every state. All names are written for this test (no song
// text).

import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import BookBar from './BookBar.jsx';
import BookSongs from './BookSongs.jsx';

const AT = '2026-10-20T14:00:00.000Z';
const reg = (value) => ({ value, at: AT });

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const lastCommand = (sent, kind) => [...sent].reverse().find((m) => m.kind === kind);

const renderBar = (store, props) =>
  render(
    <ThemeRoot store={store}>
      <BookBar store={store} {...props} />
    </ThemeRoot>,
  );

const SHELF = event(EventKind.SHELF, {
  books: { 'b-choros': { label: reg('Choros da Ana'), position: reg(1), role: reg('editor') } },
  local: { 'l-mine': { title: reg('My songs'), position: reg(0) } },
});

describe('BookBar (books.row_opens_songs; workflow 7 L60-85)', () => {
  it('names the book with its meta line and Manage (*Manage {book}*), which calls onManage; an in-step book shows no badge and no notice; axe clean', async () => {
    const managed = [];
    const { store, sent, emit } = makeStore();
    const { container } = renderBar(store, { bookId: 'l-mine', onManage: (id) => managed.push(id) });
    emit(SHELF);
    emit(event(EventKind.INDEX_STATUS, { bookId: 'l-mine', state: 'ready', songs: 14 }));
    emit(event(EventKind.SYNC, { bookId: 'l-mine', phase: 'in_step', at: AT }));

    expect(screen.getByRole('heading', { level: 2, name: 'My songs' })).toBeInTheDocument();
    expect(screen.getByText('On this device · can save · 14 songs')).toBeInTheDocument();
    // In step: no badge, no notice, nothing engaged.
    expect(container.querySelector('.badge')).toBeNull();
    expect(container.querySelector('.notice')).toBeNull();
    expect(sent.some((m) => m.kind === CommandKind.OPEN_CONFLICTS)).toBe(false);

    const manage = screen.getByRole('button', { name: 'Manage My songs' });
    expect(manage).toHaveTextContent('Manage');
    act(() => fireEvent.click(manage));
    // By keyboard too.
    act(() => manage.focus());
    act(() => {
      fireEvent.keyDown(manage, { key: 'Enter' });
      fireEvent.keyUp(manage, { key: 'Enter' });
    });
    expect(managed).toEqual(['l-mine', 'l-mine']);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a book that needs you says *2 songs need you.* with Settle (*Settle conflicts in {book}*), which calls onSettle (workflow 9 §Meeting one); axe clean', async () => {
    const settled = [];
    const { store, sent, emit } = makeStore();
    const { container } = renderBar(store, { bookId: 'b-choros', onSettle: (id) => settled.push(id) });
    emit(SHELF);
    emit(event(EventKind.SYNC, { bookId: 'b-choros', phase: 'needs_you', at: AT }));

    // The state in words on the bar, and Settle before the merge is engaged;
    // the bar never engages it on its own (an abandoned merge stays so).
    expect(screen.getByText('needs you', { selector: '.badge' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settle conflicts in Choros da Ana' })).toBeInTheDocument();
    expect(sent.some((m) => m.kind === CommandKind.OPEN_CONFLICTS)).toBe(false);
    // Engaged (the shelf's press), its model counts the songs.
    emit(
      event(EventKind.CONFLICTS, {
        bookId: 'b-choros',
        inProgress: true,
        songs: [
          { path: 'roda.cifra.md', title: 'Roda de quarta', count: 1 },
          { path: 'valsa.cifra.md', title: 'Valsa da praça', count: 2 },
        ],
        deleted: [],
      }),
    );
    const notice = container.querySelector('.book-bar-notice');
    expect(within(notice).getByRole('status')).toHaveTextContent('2 songs need you.');
    expect(sent.some((m) => m.kind === CommandKind.OPEN_CONFLICTS)).toBe(false);

    const settle = within(notice).getByRole('button', { name: 'Settle conflicts in Choros da Ana' });
    expect(settle).toHaveTextContent('Settle');
    act(() => fireEvent.click(settle));
    expect(settled).toEqual(['b-choros']);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a fork with new saves says so, and *Bring them in* opens the bring-in screen, which sends PREVIEW_BRING_IN (workflow 7 L83-85; workflow 11); axe clean', async () => {
    const { store, sent, emit } = makeStore();
    const { container } = render(
      <ThemeRoot store={store}>
        <BookSongs store={store} bookId="srv-fork" />
      </ThemeRoot>,
    );
    emit(
      event(EventKind.SHELF, {
        books: {
          'srv-fork': {
            label: reg('Choros da Ana'),
            position: reg(0),
            role: reg('owner'),
            original: reg({ bookId: 'srv-orig', title: 'Choros da Ana', link: '/git/srv-orig', followedAt: AT }),
          },
        },
        local: {},
      }),
    );
    emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 3, gone: false }));

    const bar = container.querySelector('.book-bar');
    expect(within(bar).getByText('from Choros da Ana')).toBeInTheDocument();
    expect(within(bar).getByText('Choros da Ana has 3 new saves.')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    const bring = within(bar).getByRole('button', { name: 'Bring them in from Choros da Ana' });
    expect(bring).toHaveTextContent('Bring them in');
    act(() => fireEvent.click(bring));
    expect(screen.getByRole('heading', { name: 'Bring in saves from Choros da Ana' })).toBeInTheDocument();
    expect(lastCommand(sent, CommandKind.PREVIEW_BRING_IN).payload).toEqual({ bookId: 'srv-fork' });

    // Not now returns to the book's page, the bar on it.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Not now' })));
    expect(screen.queryByRole('heading', { name: 'Bring in saves from Choros da Ana' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Manage Choros da Ana' })).toBeInTheDocument();
  });

  it('no Bring them in for a count of 0 or a gone original', () => {
    const { store, emit } = makeStore();
    renderBar(store, { bookId: 'srv-fork' });
    emit(
      event(EventKind.SHELF, {
        books: {
          'srv-fork': {
            label: reg('Choros da Ana'),
            position: reg(0),
            role: reg('owner'),
            original: reg({ bookId: 'srv-orig', title: 'Choros da Ana', followedAt: AT }),
          },
        },
        local: {},
      }),
    );
    emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 0, gone: false }));
    expect(screen.queryByRole('button', { name: /^Bring them in/ })).toBeNull();
    emit(event(EventKind.ORIGINAL, { bookId: 'srv-fork', newSaves: 4, gone: true }));
    expect(screen.queryByRole('button', { name: /^Bring them in/ })).toBeNull();
    expect(screen.getByText('original no longer shared')).toBeInTheDocument();
  });
});
