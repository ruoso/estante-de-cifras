// behavior — the book-level paused panel (sync.conflicts, workflow 9 §Meeting
// one / §The rest / §Leaving one; W09 computer copy), with Testing Library, a
// loopback store double, real React Aria + i18n, the keyboard path, and an axe
// check. Fed a CONFLICTS event shaped as the Worker emits it; songs written for
// the purpose (no-song-text rule).

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
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

  it('the in-conflict and came-in rows are theme rows in a reset list (W09#4 L222)', async () => {
    const { store, emit } = makeStore();
    emit(event(EventKind.CONFLICTS, PAYLOAD));
    const { container } = renderPanel(store);

    const inConflict = screen.getByRole('list', { name: 'In conflict' });
    const cameIn = screen.getByRole('list', { name: 'Came in, already here' });
    // Both lists keep the class the reset rule (list-style, margin, padding)
    // targets; jsdom has no layout, so the absent indent is pinned in e2e-web.
    expect(inConflict.tagName).toBe('UL');
    expect(inConflict).toHaveClass('est-bookconf-list');
    expect(cameIn.tagName).toBe('UL');
    expect(cameIn).toHaveClass('est-bookconf-incoming');
    const rows = within(inConflict).getAllByRole('listitem');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).toHaveClass('row');
    for (const row of within(cameIn).getAllByRole('listitem')) expect(row).toHaveClass('row');

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('embedded, it renders as pane content, not a screen, keeping its app bar', async () => {
    const { store, emit } = makeStore();
    emit(event(EventKind.CONFLICTS, PAYLOAD));
    let closed = 0;
    const { container } = render(
      <ThemeRoot store={store}>
        <BookConflicts store={store} bookId={BOOK} title="Choros da Ana" embedded onClose={() => { closed += 1; }} />
      </ThemeRoot>,
    );

    expect(container.querySelector('.screen')).toBeNull();
    expect(container.querySelector('.est-bookconf-embedded')).toBeTruthy();
    expect(screen.getByText('Choros da Ana')).toBeInTheDocument();
    expect(screen.getByText('needs you')).toBeInTheDocument();
    expect(screen.getByText('In conflict')).toBeInTheDocument();
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    expect(closed).toBe(1);

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  // sync.conflicts_row_summary: the row's .meta line names the song's conflicts
  // as the resolver titles them (W09#4 L222). The song is the resolver's
  // fixture (SongConflict.behavior.test.jsx): a chart region in Primeira parte
  // whose third measure differs, and a G7 voicing.
  it('the in-conflict row carries a summary line naming its conflicts by place (W09#4 L222), axe clean', async () => {
    const marked = [
      '## Primeira parte',
      '```',
      'C | G | Am | F',
      '<<<<<<< ours',
      'C | G7 | F | F',
      '=======',
      'C | G7 | D7 | F',
      '>>>>>>> theirs',
      '```',
      '',
    ].join('\n');
    const song = {
      path: 'choro-teste.cifra.md',
      title: 'Choro Teste',
      count: 2,
      author: 'Ana',
      marked,
      markedLines: ['C | G7 | F | F'],
      items: [
        { kind: 'chart', line: 4, base: ['C | G7 | C | F'], ours: ['C | G7 | F | F'], theirs: ['C | G7 | D7 | F'] },
        { kind: 'voicing', line: 10, tuning: 'E2 A2 D3 G3 B3 E4', variation: '', key: 'G7', chord: 'G7', base: null, ours: '320001', theirs: '353433' },
      ],
    };
    const { store, emit } = makeStore();
    emit(event(EventKind.CONFLICTS, { ...PAYLOAD, songs: [song] }));
    const { container } = renderPanel(store);

    const list = screen.getByRole('list', { name: 'In conflict' });
    const row = within(list).getByRole('listitem');
    const grow = row.querySelector('.grow');
    expect(grow.children).toHaveLength(2);
    expect(grow.children[0]).toHaveClass('name');
    expect(grow.children[0]).toHaveTextContent('Choro Teste');
    expect(grow.children[1]).toHaveClass('meta');
    expect(grow.children[1].textContent).toBe('Primeira parte, bar 7 · The shape for G7');
    // The badge and the actions are unchanged.
    expect(within(row).getByText('2 conflicts')).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Settle Choro Teste' })).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a row whose song has no items shows the title alone', () => {
    const { store, emit } = makeStore();
    emit(event(EventKind.CONFLICTS, PAYLOAD));
    renderPanel(store);

    const row = within(screen.getByRole('list', { name: 'In conflict' })).getByRole('listitem');
    expect(within(row).getByText('Carinhoso')).toBeInTheDocument();
    expect(row.querySelector('.meta')).toBeNull();
  });
});
