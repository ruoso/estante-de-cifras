// behavior — the per-song conflict resolver (sync.conflicts, workflow 9
// §Settling one; W09 phone/tablet copy), with Testing Library, a loopback store
// double, real React Aria + i18n, the keyboard path through the actions, and an
// axe check. Fed a CONFLICTS event shaped as the Worker emits it, with songs
// written for the purpose (no-song-text rule).

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import SongConflict from './SongConflict.jsx';

globalThis.matchMedia = (media) => ({ media, matches: false, addEventListener() {}, removeEventListener() {} });
afterEach(() => cleanup());

const BOOK = 'book1';
const PATH = 'choro.cifra.md';

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}
const lastCommand = (sent, kind) => sent.filter((c) => c.kind === kind).at(-1);

// A marked text with one chart region (fenced, as cifra.md writes it, §11.12.2);
// its ours side is a bar the preview marks.
const MARKED = `## Primeira parte
\`\`\`
C | G | Am | F
<<<<<<< ours
C | G7 | F | F
=======
C | G7 | D7 | F
>>>>>>> theirs
\`\`\`
`;

const SONG = {
  path: PATH,
  title: 'Choro Teste',
  count: 2,
  author: 'Ana',
  marked: MARKED,
  markedLines: ['C | G7 | F | F'],
  items: [
    { kind: 'chart', line: 4, base: ['C | G7 | C | F'], ours: ['C | G7 | F | F'], theirs: ['C | G7 | D7 | F'] },
    { kind: 'voicing', line: 10, tuning: 'E2 A2 D3 G3 B3 E4', variation: '', key: 'G7', chord: 'G7', base: null, ours: '320001', theirs: '353433' },
  ],
};

function seed(emit, overrides = {}) {
  emit(event(EventKind.CONFLICTS, { bookId: BOOK, inProgress: true, songs: [{ ...SONG, ...overrides }], deleted: [], incoming: [], savesHeld: [] }));
}

function renderScreen(store) {
  return render(
    <ThemeRoot store={store}>
      <SongConflict store={store} bookId={BOOK} path={PATH} onClose={() => {}} />
    </ThemeRoot>,
  );
}

describe('SongConflict (behavior)', () => {
  it('walks the conflicts one at a time, two sides named yours and the incoming author (W09)', async () => {
    const { store, emit } = makeStore();
    seed(emit);
    const { container } = renderScreen(store);

    expect(screen.getByText('Conflict 1 of 2')).toBeInTheDocument();
    // The two versions side by side, named *yours* and *Ana's*.
    expect(screen.getByText('Yours')).toBeInTheDocument();
    expect(screen.getByText('Ana’s')).toBeInTheDocument();
    // The chart conflict draws each side as bars (musical terms, not markers).
    expect(container.querySelectorAll('.est-conflict-sides .chart .barline').length).toBeGreaterThanOrEqual(2);
    // The reading-view preview marks the disputed bar.
    expect(container.querySelector('.est-conflict-preview .barline.mark-conf')).toBeTruthy();
    // No conflict markers are shown as the song (Decision: ours, marked).
    expect(container.textContent).not.toContain('<<<<<<<');

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('steps to the voicing conflict and draws each side as a chord diagram', async () => {
    const { store, emit } = makeStore();
    seed(emit);
    renderScreen(store);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next conflict' })));
    expect(screen.getByText('Conflict 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('The shape for G7')).toBeInTheDocument();
    // Two diagrams, one per side (role img from ChordDiagram's SVG).
    expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(2);
  });

  it('keep mine resolves the current region by our side, and records it in “settled so far”', async () => {
    const { store, sent, emit } = makeStore();
    seed(emit);
    renderScreen(store);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Keep mine' })));
    const cmd = lastCommand(sent, CommandKind.RESOLVE_CONFLICT);
    expect(cmd.payload).toMatchObject({ bookId: BOOK, path: PATH, choice: 'mine', index: 0 });
    expect(screen.getByText('Settled so far')).toBeInTheDocument();
  });

  it('take theirs is reachable by keyboard (Enter activates the action)', async () => {
    const { store, sent, emit } = makeStore();
    seed(emit);
    renderScreen(store);

    const btn = screen.getByRole('button', { name: 'Take theirs' });
    act(() => {
      fireEvent.keyDown(btn, { key: 'Enter' });
      fireEvent.keyUp(btn, { key: 'Enter' });
    });
    expect(lastCommand(sent, CommandKind.RESOLVE_CONFLICT).payload).toMatchObject({ choice: 'theirs', index: 0 });
  });

  it('edit opens the raw marked text, and a save that still holds a marker line is refused, pointing at it (§11.12.3; workflow 9 L59)', async () => {
    const { store, sent, emit } = makeStore();
    seed(emit);
    const { container } = renderScreen(store);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Edit' })));
    const editor = screen.getByRole('textbox', { name: 'The song’s text, with the conflict markers' });
    expect(editor).toHaveValue(MARKED);
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(lastCommand(sent, CommandKind.RESOLVE_CONFLICT).payload).toMatchObject({ bookId: BOOK, path: PATH, choice: 'edit' });

    // The Worker refuses a text with a marker line still in it.
    emit(event(EventKind.SAVE_REFUSED, { bookId: BOOK, path: PATH, reason: 'marked', line: 3 }));
    expect(screen.getByRole('alert')).toHaveTextContent('Line 3 is still a conflict marker');
  });

  it('closes when its song leaves the model (settled, or the book abandoned)', async () => {
    const { store, emit } = makeStore();
    seed(emit);
    let closed = false;
    render(
      <ThemeRoot store={store}>
        <SongConflict store={store} bookId={BOOK} path={PATH} onClose={() => { closed = true; }} />
      </ThemeRoot>,
    );
    // The book settles: the slice drops the entry.
    emit(event(EventKind.CONFLICTS, { bookId: BOOK, inProgress: false }));
    expect(closed).toBe(true);
  });
});
