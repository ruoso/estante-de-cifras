// behavior — the per-song conflict resolver (sync.conflicts, workflow 9
// §Settling one; W09 phone/tablet copy), with Testing Library, a loopback store
// double, real React Aria + i18n, the keyboard path through the actions, and an
// axe check. Fed a CONFLICTS event shaped as the Worker emits it, with songs
// written for the purpose (no-song-text rule).

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import SongConflict from './SongConflict.jsx';
import { labelMarkers } from './conflict-text.js';
import { instrumentInstance, configFor } from '../core/instrument.js';
import { defaultVoicing } from '../core/voicings.js';
import { parseChord } from '../core/notation/parse.js';
import { fingeringFromFrets } from '../core/search.js';
import { parseShorthand } from '../core/fretstring.js';
import { describeFingering } from '../render/index.js';

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

  // --- sync.conflicts_polish: the two diagrams beside each choice (workflow 9
  // §Settling one L49-51, "two bars rendered, two diagrams"; W09#1 L45-77).

  const GUITAR = 'E2 A2 D3 G3 B3 E4';
  const guitar = instrumentInstance({ catalogId: '6guitar', strings: GUITAR, fretCount: 22 });
  // The built-in guitar, as the INSTRUMENTS surface carries it on a first run.
  const GUITAR_ENTRY = {
    id: 'g1',
    catalogId: '6guitar',
    label: 'Guitar',
    tuning: GUITAR,
    fretCount: 22,
    config: configFor(guitar, 'strumming'),
    shapes: [],
  };
  const seedGuitar = (emit) =>
    emit(event(EventKind.INSTRUMENTS, { instruments: [GUITAR_ENTRY], inUseId: GUITAR_ENTRY.id, standard: GUITAR_ENTRY }));

  // A bar conflict on the fourth bar's neighbour: ours wrote G7, Ana D♭7.
  const barMarked = (tail = '') => `# Roda de rua

## Parte
\`\`\`
<<<<<<< ours
C | G7 | F | F
=======
C | Db7 | F | F
>>>>>>> theirs
\`\`\`
${tail}`;
  const barSong = (marked) => ({
    path: PATH,
    title: 'Roda de rua',
    count: 1,
    author: 'Ana',
    marked,
    markedLines: ['C | G7 | F | F'],
    items: [{ kind: 'chart', line: 5, base: ['C | G | F | F'], ours: ['C | G7 | F | F'], theirs: ['C | Db7 | F | F'] }],
  });
  const seedBar = (emit, marked) =>
    emit(event(EventKind.CONFLICTS, { bookId: BOOK, inProgress: true, songs: [barSong(marked)], deleted: [], incoming: [], savesHeld: [] }));

  const card = (container, name) => container.querySelector(`.est-conflict-side[aria-label="${name}"]`);
  const sentence = (symbol, fingering) =>
    describeFingering(fingering, { chord: parseChord(symbol).chord, instrument: guitar });

  it('a bar conflict draws, beside each choice, the diagram of each chord that side wrote in the differing bars (workflow 9 §Settling one L49-51; W09#1 L45-77)', async () => {
    const { store, emit } = makeStore();
    seedGuitar(emit);
    seedBar(emit, barMarked());
    const { container } = renderScreen(store);

    const yours = card(container, 'Yours');
    const anas = card(container, 'Ana’s');
    // The bars are still drawn (the side as a bar), with the diagrams under them.
    expect(yours.querySelector('.chart .barline')).toBeTruthy();
    expect(anas.querySelector('.chart .barline')).toBeTruthy();

    const g7 = defaultVoicing(parseChord('G7').chord, guitar);
    const db7 = defaultVoicing(parseChord('Db7').chord, guitar);
    const yourImgs = within(yours).getAllByRole('img');
    const theirImgs = within(anas).getAllByRole('img');
    expect(yourImgs).toHaveLength(1);
    expect(theirImgs).toHaveLength(1);
    expect(yourImgs[0].getAttribute('aria-label').startsWith(sentence('G7', g7))).toBe(true);
    expect(theirImgs[0].getAttribute('aria-label').startsWith(sentence('Db7', db7))).toBe(true);
    // No diagram for C or F, the unchanged measures.
    for (const img of [...yourImgs, ...theirImgs]) {
      expect(img.getAttribute('aria-label')).not.toMatch(/^(C|F)\b/);
    }
    // Each carries its kind as a visible word: neither song voices them, so the default.
    expect(within(yours).getByText('default')).toBeInTheDocument();
    expect(within(anas).getByText('default')).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it("a side's diagram is the song's own voicing when the song holds one for this tuning (§7.6 order; mockups README L26)", async () => {
    const { store, emit } = makeStore();
    seedGuitar(emit);
    seedBar(emit, barMarked(`\n---\n\n## Voicings: ${GUITAR}\n- G7: 353433\n`));
    const { container } = renderScreen(store);

    const yours = card(container, 'Yours');
    const anas = card(container, 'Ana’s');
    const own = fingeringFromFrets(parseShorthand('353433'), parseChord('G7').chord, guitar);
    const [g7] = within(yours).getAllByRole('img');
    expect(g7.getAttribute('aria-label').startsWith(sentence('G7', own))).toBe(true);
    // The song's own shape is drawn in ink with no word (kind song).
    expect(yours.querySelector('.chord-diagram--song')).toBeTruthy();
    expect(within(yours).queryByText('default')).toBeNull();
    // Ana's D♭7 is not in the block, so it falls back to the default.
    expect(anas.querySelector('.chord-diagram--default')).toBeTruthy();
    expect(within(anas).getByText('default')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('an unvoiceable chord shows its name without a diagram, and never throws', async () => {
    // C13#11 has no shape on a ukulele (voicings.test).
    const uke = 'G4 C4 E4 A4';
    const ukeInst = instrumentInstance({ catalogId: 'ukulele', strings: uke, fretCount: 15 });
    const UKE = { id: 'u1', catalogId: 'ukulele', label: 'Ukulele', tuning: uke, fretCount: 15, config: configFor(ukeInst, 'strumming'), shapes: [] };
    const { store, emit } = makeStore();
    emit(event(EventKind.INSTRUMENTS, { instruments: [UKE], inUseId: UKE.id, standard: GUITAR_ENTRY }));
    const marked = barMarked().replace('C | Db7 | F | F', 'C | C13#11 | F | F');
    emit(
      event(EventKind.CONFLICTS, {
        bookId: BOOK,
        inProgress: true,
        songs: [{ ...barSong(marked), items: [{ kind: 'chart', line: 5, base: ['C | G | F | F'], ours: ['C | G7 | F | F'], theirs: ['C | C13#11 | F | F'] }] }],
        deleted: [],
        incoming: [],
        savesHeld: [],
      }),
    );
    const { container } = renderScreen(store);

    const anas = card(container, 'Ana’s');
    expect(within(anas).queryAllByRole('img')).toHaveLength(0);
    expect(anas.querySelector('.est-conflict-unvoiced')).toHaveTextContent('C13#11');
    // Yours still draws its G7.
    expect(within(card(container, 'Yours')).getAllByRole('img')).toHaveLength(1);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

