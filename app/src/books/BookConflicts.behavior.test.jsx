// behavior — the book-level paused panel (sync.conflicts, workflow 9 §Meeting
// one / §The rest / §Leaving one; W09 computer copy), with Testing Library, a
// loopback store double, real React Aria + i18n, the keyboard path, and an axe
// check. Fed a CONFLICTS event shaped as the Worker emits it; songs written for
// the purpose (no-song-text rule).

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import BookConflicts from './BookConflicts.jsx';

globalThis.matchMedia = (media) => ({ media, matches: false, addEventListener() {}, removeEventListener() {} });
afterEach(() => cleanup());

const BOOK = 'book1';

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}
const lastCommand = (sent, kind) => sent.filter((c) => c.kind === kind).at(-1);

const PAYLOAD = {
  bookId: BOOK,
  inProgress: true,
  songs: [{ path: 'carinhoso.cifra.md', title: 'Carinhoso', count: 2, author: 'Ana' }],
  deleted: [{ path: 'brejeiro.cifra.md', title: 'Brejeiro', author: 'Ana', deleted: 'theirs' }],
  incoming: [
    { path: 'tico.cifra.md', title: 'Tico-tico', author: 'Ana', summary: 'added' },
    { path: 'lamentos.cifra.md', title: 'Lamentos', author: 'Ana', summary: 'changed' },
  ],
  savesHeld: [],
};

function renderPanel(store, onSettle = () => {}) {
  return render(
    <ThemeRoot store={store}>
      <BookConflicts store={store} bookId={BOOK} title="Choros da Ana" onSettle={onSettle} />
    </ThemeRoot>,
  );
}

describe('BookConflicts (behavior)', () => {
  it('shows the paused book: N songs need you, the in-conflict list, came-in, saving-held and abandon (W09)', async () => {
    const { store, emit } = makeStore();
    emit(event(EventKind.CONFLICTS, PAYLOAD));
    const { container } = renderPanel(store);

    // Two things need you (one in-conflict song + one deleted-vs-edited).
    expect(screen.getByText('2 songs need you.', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('In conflict')).toBeInTheDocument();
    expect(screen.getByText('Carinhoso')).toBeInTheDocument();
    expect(screen.getByText('2 conflicts')).toBeInTheDocument();
    // The came-in list, with who brought each change (a word, not colour).
    expect(screen.getByText('added by Ana')).toBeInTheDocument();
    expect(screen.getByText('updated by Ana')).toBeInTheDocument();
    // The held-save card and abandon.
    expect(screen.getByText('Saving in this book')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Abandon the merge' })).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('Settle opens the per-song resolver for that song', async () => {
    const { store, emit } = makeStore();
    emit(event(EventKind.CONFLICTS, PAYLOAD));
    let settled = null;
    renderPanel(store, (path) => { settled = path; });

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Settle Carinhoso' })));
    expect(settled).toBe('carinhoso.cifra.md');
  });

  it('a deleted-vs-edited card keeps the song (keeping first) or deletes it', async () => {
    const { store, sent, emit } = makeStore();
    emit(event(EventKind.CONFLICTS, PAYLOAD));
    renderPanel(store);

    expect(screen.getByText('Ana deleted this song. You had edited it.')).toBeInTheDocument();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Keep the song, with the edits' })));
    expect(lastCommand(sent, CommandKind.RESOLVE_CONFLICT).payload).toMatchObject({ bookId: BOOK, path: 'brejeiro.cifra.md', choice: 'keep' });

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Delete it' })));
    expect(lastCommand(sent, CommandKind.RESOLVE_CONFLICT).payload).toMatchObject({ path: 'brejeiro.cifra.md', choice: 'delete' });
  });

  it('the in-conflict row mirrors Keep both (as two songs), firing keep_both_song by keyboard; axe clean (workflow 9 §Keep both, for a song)', async () => {
    const { store, sent, emit } = makeStore();
    emit(event(EventKind.CONFLICTS, PAYLOAD));
    const { container } = renderPanel(store);

    const btn = screen.getByRole('button', { name: 'Keep both versions of Carinhoso as two songs' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    act(() => {
      fireEvent.keyDown(btn, { key: 'Enter' });
      fireEvent.keyUp(btn, { key: 'Enter' });
    });
    expect(lastCommand(sent, CommandKind.RESOLVE_CONFLICT).payload).toMatchObject({
      bookId: BOOK, path: 'carinhoso.cifra.md', choice: 'keep_both_song',
    });
  });

  it('abandon the merge is reachable by keyboard and sends ABANDON_MERGE', async () => {
    const { store, sent, emit } = makeStore();
    emit(event(EventKind.CONFLICTS, PAYLOAD));
    renderPanel(store);

    const btn = screen.getByRole('button', { name: 'Abandon the merge' });
    act(() => {
      fireEvent.keyDown(btn, { key: 'Enter' });
      fireEvent.keyUp(btn, { key: 'Enter' });
    });
    expect(lastCommand(sent, CommandKind.ABANDON_MERGE).payload).toMatchObject({ bookId: BOOK });
  });
});
