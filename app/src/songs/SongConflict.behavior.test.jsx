// behavior — the per-song conflict resolver (sync.conflicts, workflow 9
// §Settling one; W09 phone/tablet copy), with Testing Library, a loopback store
// double, real React Aria + i18n, the keyboard path through the actions, and an
// axe check. Fed a CONFLICTS event shaped as the Worker emits it, with songs
// written for the purpose (no-song-text rule).

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import SongConflict from './SongConflict.jsx';
import { labelMarkers } from './conflict-text.js';

globalThis.matchMedia = (media) => ({ media, matches: false, addEventListener() {}, removeEventListener() {} });
afterEach(() => cleanup());

// CodeMirror (the edit view's source editor) measures text geometry with
// Range.getClientRects during its async measure pass; jsdom has no layout and
// does not implement it. Stub it so the measure pass is a no-op here — real
// geometry is covered at the e2e level.
Range.prototype.getClientRects = function getClientRects() {
  return [];
};
Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
};

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

  it('titles a chart conflict by its section and bar (sync.conflicts_editing; W09#1 L42)', async () => {
    const { store, emit } = makeStore();
    seed(emit);
    const { container } = renderScreen(store);

    // The region's ours line is the second of Primeira parte (bars 5-8); its
    // third measure differs from theirs, so bar 7 (cifra.md §2.8).
    expect(screen.getByRole('heading', { name: 'Primeira parte, bar 7' })).toBeInTheDocument();
    expect(screen.queryByText('A bar you both changed')).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('falls back to A bar you both changed when the region has no named section', async () => {
    const { store, emit } = makeStore();
    seed(emit, { marked: MARKED.replace('## Primeira parte\n', '') });
    renderScreen(store);

    expect(screen.getByRole('heading', { name: 'A bar you both changed' })).toBeInTheDocument();
  });

  it('Edit mounts the source editor on the marked text, markers named for the people, and a refused save goes to the line (sync.conflicts_editing; W09#3 L158-163, L284-308; workflow 9 §Settling one)', async () => {
    const { store, sent, emit } = makeStore();
    seed(emit);
    const { container } = renderScreen(store);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Edit' })));
    const editor = screen.getByRole('textbox', { name: 'The song’s text, with the conflict markers' });
    // The source editor of workflow 3, not a textarea: CodeMirror with numbered lines.
    expect(editor).toHaveClass('cm-content');
    expect(editor.closest('.cm-editor')).toBeTruthy();
    expect(container.querySelector('.cm-lineNumbers')).toBeTruthy();
    // The markers name the people, as the side cards do.
    expect(editor.textContent).toContain('<<<<<<< yours');
    expect(editor.textContent).toContain('>>>>>>> Ana’s');
    expect(editor.textContent).not.toContain('<<<<<<< ours');
    expect(editor.textContent).not.toContain('>>>>>>> theirs');
    // The marker lines are coloured as marker lines (est-mk), and carried by their text.
    const markerLines = [...editor.querySelectorAll('.cm-line.est-mk')].map((l) => l.textContent);
    expect(markerLines).toEqual(expect.arrayContaining(['<<<<<<< yours', '=======', '>>>>>>> Ana’s']));
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    const cmd = lastCommand(sent, CommandKind.RESOLVE_CONFLICT);
    expect(cmd.payload).toMatchObject({ bookId: BOOK, path: PATH, choice: 'edit' });
    expect(cmd.payload.text).toBe(labelMarkers(MARKED, { yours: 'yours', theirs: 'Ana’s' }));

    // The Worker refuses a text with a marker line still in it, pointing at it.
    emit(event(EventKind.SAVE_REFUSED, { bookId: BOOK, path: PATH, reason: 'marked', line: 4 }));
    expect(screen.getByRole('alert')).toHaveTextContent('Line 4 is still a conflict marker');
    const goTo = screen.getByRole('button', { name: 'Go to line 4' });

    act(() => fireEvent.click(goTo));
    const view = EditorView.findFromDOM(container.querySelector('.cm-editor'));
    expect(view.state.doc.lineAt(view.state.selection.main.head).number).toBe(4);
    expect(view.state.selection.main.head).toBe(view.state.doc.line(4).from);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'The song’s text, with the conflict markers' }));
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('with no author, the theirs marker reads theirs', async () => {
    const { store, emit } = makeStore();
    seed(emit, { author: null });
    renderScreen(store);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Edit' })));
    const editor = screen.getByRole('textbox', { name: 'The song’s text, with the conflict markers' });
    expect(editor.textContent).toContain('>>>>>>> theirs');
    expect(editor.textContent).toContain('<<<<<<< yours');
  });

  it('offers Keep both only on a voicing step, not on a chart step, and the old hint is gone (workflow 9 §Settling one as amended)', async () => {
    const { store, emit } = makeStore();
    seed(emit);
    const { container } = renderScreen(store);

    // Step 1 is the chart conflict: no per-conflict Keep both, no textual hint.
    expect(screen.queryByRole('button', { name: 'Keep both' })).toBeNull();
    expect(screen.queryByText(/choose Edit and put/i)).toBeNull();

    // Step 2 is the voicing: Keep both appears, replacing the hint.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next conflict' })));
    expect(screen.getByText('The shape for G7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep both' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('keep both on a voicing is reachable by keyboard and fires the keep_both choice for that step', async () => {
    const { store, sent, emit } = makeStore();
    seed(emit);
    renderScreen(store);

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Next conflict' })));
    const btn = screen.getByRole('button', { name: 'Keep both' });
    act(() => {
      fireEvent.keyDown(btn, { key: 'Enter' });
      fireEvent.keyUp(btn, { key: 'Enter' });
    });
    expect(lastCommand(sent, CommandKind.RESOLVE_CONFLICT).payload).toMatchObject({
      bookId: BOOK, path: PATH, choice: 'keep_both', index: 1, author: 'Ana',
    });
  });

  it('the whole-song Keep both fires the keep_both_song choice, and axe is clean (workflow 9 §Keep both, for a song)', async () => {
    const { store, sent, emit } = makeStore();
    seed(emit);
    const { container } = renderScreen(store);

    const btn = screen.getByRole('button', { name: 'Keep both, as two songs' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    act(() => fireEvent.click(btn));
    expect(lastCommand(sent, CommandKind.RESOLVE_CONFLICT).payload).toMatchObject({
      bookId: BOOK, path: PATH, choice: 'keep_both_song', author: 'Ana',
    });
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
