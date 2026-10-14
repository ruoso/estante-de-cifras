// SongReading behavior (songs.reading): the reading view with its real RAC
// controls, i18n and the pure music core, over a loopback-backed store whose
// stub Worker serves seeded source / song / instruments / preferences slices and
// answers the three reading commands (OPEN_SONG, SET_TRANSPOSITION,
// SET_VARIATION) by re-surfacing SONG — the Worker's own storage round-trip is
// pinned separately in song-state.behavior.test.js. axe (WCAG 2.1 AA) runs over
// what each state renders. Fixtures are purpose-written songs, never anyone's
// copyrighted words (no-song-text rule).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, act, fireEvent, waitFor } from '@testing-library/react';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { instrumentInstance, configFor } from '../core/instrument.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import SongReading from './SongReading.jsx';

const GUITAR_TUNING = 'E2 A2 D3 G3 B3 E4';
const UKE_TUNING = 'G4 C4 E4 A4';
const FENCE = '```';

function installMatchMedia(dark = false) {
  globalThis.matchMedia = (media) => ({
    media,
    matches: dark,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

beforeEach(() => {
  installMatchMedia(false);
  setLocale('en');
  // The More/Print path calls window.print; jsdom has no implementation.
  globalThis.print = vi.fn();
});
afterEach(() => {
  delete globalThis.matchMedia;
  vi.restoreAllMocks();
});

// A song as cifra.md holds it: title, an optional property list, a chart, and
// optional voicing blocks after a --- rule.
const song = ({ title = 'Tarde Clara', props = [], chart = 'G  C | Am  D', voicings = [] }) =>
  [
    `# ${title}`,
    ...(props.length ? ['', ...props.map((p) => `- ${p}`)] : []),
    '',
    '## Verse',
    FENCE,
    chart,
    FENCE,
    ...(voicings.length ? ['', '---', '', ...voicings] : []),
  ].join('\n') + '\n';

// The glyph layer of the chart's first chord line: the visible chord glyphs
// (the `.g` spans) of the first measure or run, joined with a space. The chord
// name now sits beside each glyph in a visually-hidden node for a screen reader
// (shell.a11y_chart), so the drawn text reads from the glyph layer.
function chartFirstLineGlyphs() {
  const line = screen.getByRole('group', { name: 'Tarde Clara' }).querySelector('.barline .m, .runline');
  return Array.from(line.querySelectorAll('.g')).map((g) => g.textContent).join(' ');
}

// A standard guitar roster entry, as the INSTRUMENTS surface carries it.
function guitarEntry(shapes = []) {
  const inst = instrumentInstance({ catalogId: '6guitar', strings: GUITAR_TUNING, fretCount: 22 });
  return {
    id: 'g1',
    catalogId: '6guitar',
    label: 'Guitar',
    tuning: GUITAR_TUNING,
    fretCount: 22,
    config: configFor(inst, 'strumming'),
    shapes,
  };
}
function ukeEntry() {
  const inst = instrumentInstance({ catalogId: 'ukulele', strings: UKE_TUNING, fretCount: 15 });
  return {
    id: 'u1',
    catalogId: 'ukulele',
    label: 'Ukulele',
    tuning: UKE_TUNING,
    fretCount: 15,
    config: configFor(inst, 'strumming'),
    shapes: [],
  };
}

const BOOK = 'local-example-book';
const PATH = 'tarde-clara.cifra.md';

// A preferences.json register as the PREFERENCES surface carries it (a flat map
// of `{ value, at }`, home-book-format §4.1).
const register = (value) => ({ value, at: '2026-01-01T00:00:00.000Z' });

// A loopback store whose stub Worker serves the seeded slices and answers the
// reading commands. Records every command for the dispatch assertions. The home
// book's preferences default to "this instrument is in use" (the usual reading
// state — `instrumentInUse` present suppresses the first-open prompt); the
// first_song tests pass their own `preferences` to exercise the fresh-install
// gate, and MARK_INSTRUMENT_PROMPT_SEEN re-surfaces PREFERENCES with the flag set,
// as the Worker's handler does.
function makeStore({ text, entry, transposition = 0, variations = {}, preferences }) {
  const commands = [];
  const state = { transposition, variations: { ...variations } };
  const prefs = { ...(preferences ?? { instrumentInUse: register(entry.id) }) };
  // The working-copy text the stub serves on OPEN_SOURCE. Mutable so a test can
  // land a merged version (sync.read_in_place): the view re-issues OPEN_SOURCE
  // and the stub answers with the new bytes, as the real Worker does after a
  // clean merge rewrites the working copy.
  let currentText = text;
  // Captured so a test can push a transient MERGED fact down the Worker→main
  // channel, the way the sync engine's emitMerged does.
  let workerPort;
  const endpoint = createLoopbackEndpoint((port) => {
    workerPort = port;
    return {
    handle(message) {
      commands.push(message);
      const p = message.payload ?? {};
      switch (message.kind) {
        case CommandKind.OPEN:
          port.postMessage(event(EventKind.PREFERENCES, { ...prefs }));
          port.postMessage(event(EventKind.SHELF, {}));
          port.postMessage(
            event(EventKind.INSTRUMENTS, { instruments: [entry], inUseId: entry.id, standard: entry }),
          );
          break;
        case CommandKind.MARK_INSTRUMENT_PROMPT_SEEN:
          prefs.instrumentPromptSeen = register(true);
          port.postMessage(event(EventKind.PREFERENCES, { ...prefs }));
          break;
        case CommandKind.OPEN_SOURCE:
          port.postMessage(event(EventKind.SOURCE, { bookId: p.bookId, path: p.path, text: currentText }));
          break;
        case CommandKind.OPEN_SONG:
          port.postMessage(
            event(EventKind.SONG, { bookId: p.bookId, path: p.path, ...state }),
          );
          break;
        case CommandKind.SET_TRANSPOSITION:
          state.transposition = p.semitones;
          port.postMessage(event(EventKind.SONG, { bookId: p.bookId, path: p.path, ...state }));
          break;
        case CommandKind.SET_VARIATION:
          state.variations = { ...state.variations, [p.tuning]: p.variation };
          port.postMessage(event(EventKind.SONG, { bookId: p.bookId, path: p.path, ...state }));
          break;
        case CommandKind.BROWSE:
          port.postMessage(event(EventKind.BROWSE_RESULTS, { books: [] }));
          break;
        case CommandKind.RECORD_RECENT:
          port.postMessage(event(EventKind.RECENTS, { recents: [] }));
          break;
        default:
          break;
      }
    },
    };
  });
  return {
    store: createStore(endpoint),
    commands,
    // Land a merged version of the song, then announce it on the open `kind`
    // channel (what the engine's emitMerged does). Callers set the new bytes
    // first so the view's re-issued OPEN_SOURCE reads them.
    setSource: (next) => {
      currentText = next;
    },
    emitMerged: (payload) => workerPort.postMessage(event(EventKind.MERGED, payload)),
  };
}

function renderReading(store, props = {}) {
  return render(
    <ThemeRoot store={store}>
      <SongReading store={store} bookId={BOOK} path={PATH} mode="narrow" {...props} />
    </ThemeRoot>,
  );
}

async function openAndWait(store, props) {
  const utils = renderReading(store, props);
  act(() => store.open());
  await waitFor(() => expect(screen.getByRole('group', { name: 'Tarde Clara' })).toBeInTheDocument());
  return utils;
}

const lastCommand = (commands, kind) => [...commands].reverse().find((c) => c.kind === kind);

// RAC controls respond to a click through usePress; flush the store's async
// SONG re-surface by awaiting an async act, as the sibling behavior tests do.
const click = async (el) => {
  await act(async () => {
    fireEvent.click(el);
  });
};

describe('SongReading — the chart and the shapes (workflow 2 L69-77, L88-108)', () => {
  it('renders the parsed song as a chart and resolves/marks each shape song/yours/default', async () => {
    const { store } = makeStore({
      text: song({
        props: ['key: G', 'artist: Pedro Araújo'],
        voicings: ['## Voicings: E2 A2 D3 G3 B3 E4', '- G: 320003', '- C: x32010'],
      }),
      entry: guitarEntry([{ tuning: GUITAR_TUNING, chord: 'Am', shorthand: 'x02210' }]),
    });
    await openAndWait(store);

    // The chart drew the chords (a chart line shows its measures as cells).
    expect(chartFirstLineGlyphs()).toBe('G C');

    // The shapes section: G and C are the song's (no kind word); Am is yours;
    // D is the default — the non-song ones carry a word, never colour alone.
    const shapes = screen.getByRole('region', { name: 'Shapes' });
    expect(within(shapes).getByText('your shape')).toBeInTheDocument();
    expect(within(shapes).getByText('default')).toBeInTheDocument();

    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  it('Edit hands the song (book, path and title) to the host that opens the editor (workflow 4)', async () => {
    const onEdit = vi.fn();
    const { store } = makeStore({ text: song({ chart: 'G  C  Am' }), entry: guitarEntry() });
    await openAndWait(store, { onEdit });

    await click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith({ bookId: BOOK, path: PATH, title: 'Tarde Clara' });
  });

  it('shows the no-voicings notice and an Arrange action (→ onArrange) for a song with no block', async () => {
    const onArrange = vi.fn();
    const { store } = makeStore({ text: song({ chart: 'G  C  Am' }), entry: guitarEntry() });
    await openAndWait(store, { onArrange });

    expect(
      screen.getByText(/Nobody has chosen shapes for Guitar in this song yet/),
    ).toBeInTheDocument();
    await click(screen.getByRole('button', { name: 'Arrange for Guitar' }));
    expect(onArrange).toHaveBeenCalledWith({ bookId: BOOK, path: PATH });

    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  it('lists a chord the search cannot voice as unvoiced, the song still read', async () => {
    // C13#11 has no shape on a ukulele (voicings.test), so it is unvoiced.
    const { store } = makeStore({ text: song({ chart: 'C  C13#11' }), entry: ukeEntry() });
    await openAndWait(store);
    expect(screen.getByText(/No playable shape for C13#11\./)).toBeInTheDocument();
  });
});

describe('SongReading — the variation picker (workflow 2 L73-74, L120-125)', () => {
  const twoVariations = song({
    chart: 'C',
    voicings: [
      '## Voicings: E2 A2 D3 G3 B3 E4',
      '- C: x32010',
      '',
      '## Up the neck: E2 A2 D3 G3 B3 E4',
      '- C: 8-10-10-9-8-8',
    ],
  });

  it('offers a keyboard-operable picker that dispatches SET_VARIATION and re-renders', async () => {
    const { store, commands } = makeStore({ text: twoVariations, entry: guitarEntry() });
    await openAndWait(store);

    const picker = screen.getByLabelText('Variation');
    await click(picker);
    await click(await screen.findByRole('option', { name: 'Up the neck' }));

    const cmd = lastCommand(commands, CommandKind.SET_VARIATION);
    expect(cmd.payload).toMatchObject({ bookId: BOOK, path: PATH, variation: 'Up the neck' });
    await waitFor(() => expect(screen.getByLabelText('Variation')).toHaveTextContent('Up the neck'));
  });

  it('hides the picker while transposed', async () => {
    const { store } = makeStore({ text: twoVariations, entry: guitarEntry(), transposition: 2 });
    await openAndWait(store);
    expect(screen.queryByLabelText('Variation')).not.toBeInTheDocument();
  });
});

describe('SongReading — transpose (workflow 2 L111-146; W02 L181-186)', () => {
  it('dispatches SET_TRANSPOSITION and shows the chip, the reset, and the arranging-off note', async () => {
    const { store, commands } = makeStore({
      text: song({ props: ['key: G'], chart: 'G  C | Am  D' }),
      entry: guitarEntry(),
    });
    await openAndWait(store);

    await click(screen.getByRole('button', { name: 'Transpose' }));
    await click(await screen.findByRole('button', { name: 'Up a semitone' }));

    const cmd = lastCommand(commands, CommandKind.SET_TRANSPOSITION);
    expect(cmd.payload).toMatchObject({ bookId: BOOK, path: PATH, semitones: 1 });

    // The chip appears in the status row (and in the still-open popover).
    await waitFor(() => expect(screen.getAllByText('Transposed to Ab (+1)').length).toBeGreaterThan(0));
    expect(screen.getAllByRole('button', { name: 'Back to G' }).length).toBeGreaterThan(0);
    expect(screen.getByText('Arranging is off while transposed')).toBeInTheDocument();
    // Every shape is now yours/default — the song's own voicings are suppressed,
    // so each diagram carries a kind word (never a bare "song").
    await waitFor(() => expect(screen.getAllByText(/^(your shape|default)$/).length).toBeGreaterThan(0));

    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  it('shows the signed offset without a key name for a keyless song (acceptance 3)', async () => {
    const { store } = makeStore({ text: song({ chart: 'C  F  G' }), entry: guitarEntry(), transposition: 3 });
    await openAndWait(store);
    expect(screen.getByText('Transposed (+3)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to the written key' })).toBeInTheDocument();
  });
});

describe('SongReading — full screen, print, add to setlist, share', () => {
  it('enters a chrome-free full screen and returns (axe in full screen)', async () => {
    const { store } = makeStore({ text: song({}), entry: guitarEntry() });
    await openAndWait(store);

    await click(screen.getByRole('button', { name: 'Full screen' }));
    const exit = await screen.findByRole('button', { name: 'Exit full screen' });
    // Chrome is gone — the app bar's Back is not rendered in full screen.
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument();
    // The sheet is still there.
    expect(screen.getByRole('group', { name: 'Tarde Clara' })).toBeInTheDocument();

    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    await click(exit);
    expect(await screen.findByRole('button', { name: 'Back' })).toBeInTheDocument();
  });

  it('marks chrome for print and keeps the sheet, shapes carrying a word', async () => {
    const { store } = makeStore({
      text: song({ voicings: ['## Voicings: E2 A2 D3 G3 B3 E4', '- G: 320003'] }),
      entry: guitarEntry(),
    });
    const { container } = await openAndWait(store);
    // The chrome the print stylesheet hides is marked; the sheet it keeps is not.
    expect(container.querySelector('.appbar.reading-chrome')).toBeInTheDocument();
    expect(container.querySelector('.reading-actionbar.reading-chrome')).toBeInTheDocument();
    expect(container.querySelector('.reading-sheet')).toBeInTheDocument();
    // A shape prints its kind as a word, not colour alone (default here).
    expect(screen.getAllByText('default').length).toBeGreaterThan(0);
  });

  it('invokes onAddToSetlist and onShare from the overflow menu', async () => {
    const onAddToSetlist = vi.fn();
    const onShare = vi.fn();
    const { store } = makeStore({ text: song({}), entry: guitarEntry() });
    await openAndWait(store, { onAddToSetlist, onShare });

    await click(screen.getByRole('button', { name: 'More' }));
    await click(await screen.findByRole('menuitem', { name: 'Add to setlist' }));
    expect(onAddToSetlist).toHaveBeenCalledWith({ bookId: BOOK, path: PATH });

    await click(screen.getByRole('button', { name: 'More' }));
    await click(await screen.findByRole('menuitem', { name: 'Share' }));
    expect(onShare).toHaveBeenCalledWith({ bookId: BOOK, path: PATH });
  });
});

describe('SongReading — the first-open instrument prompt (songs.first_song, workflow 1 §The instrument)', () => {
  const PATH2 = 'segunda-musica.cifra.md';
  const promptText = /Playing on guitar/;

  it('shows the prompt on the first open, with Change and dismiss, axe clean (W01 L104-108)', async () => {
    // Fresh install: neither instrumentInUse nor instrumentPromptSeen is set.
    const { store } = makeStore({ text: song({}), entry: guitarEntry(), preferences: {} });
    await openAndWait(store);

    expect(screen.getByText(promptText)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change instrument' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep guitar and dismiss' })).toBeInTheDocument();

    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });

  it('dismiss keeps guitar, sends MARK_INSTRUMENT_PROMPT_SEEN, and never asks again', async () => {
    const { store, commands } = makeStore({ text: song({}), entry: guitarEntry(), preferences: {} });
    await openAndWait(store);

    await click(screen.getByRole('button', { name: 'Keep guitar and dismiss' }));
    expect(lastCommand(commands, CommandKind.MARK_INSTRUMENT_PROMPT_SEEN)).toBeTruthy();
    // After the PREFERENCES re-surface with the flag set, the notice is gone.
    await waitFor(() => expect(screen.queryByText(promptText)).not.toBeInTheDocument());

    // A freshly opened second song (same home book) shows no notice.
    render(
      <ThemeRoot store={store}>
        <SongReading store={store} bookId={BOOK} path={PATH2} mode="narrow" />
      </ThemeRoot>,
    );
    await waitFor(() =>
      expect(screen.getAllByRole('group', { name: 'Tarde Clara' }).length).toBeGreaterThan(0),
    );
    expect(screen.queryByText(promptText)).not.toBeInTheDocument();
  });

  it('Change instrument opens the roster overlay and marks the prompt seen', async () => {
    const { store, commands } = makeStore({ text: song({}), entry: guitarEntry(), preferences: {} });
    await openAndWait(store);

    await click(screen.getByRole('button', { name: 'Change instrument' }));
    expect(lastCommand(commands, CommandKind.MARK_INSTRUMENT_PROMPT_SEEN)).toBeTruthy();
    // The existing instruments overlay is now open (instrumentsOpen true).
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Instruments' })).toBeInTheDocument();
  });

  it('never shows the prompt when a non-default instrument is in use (AC 4)', async () => {
    const { store } = makeStore({
      text: song({}),
      entry: guitarEntry(),
      preferences: { instrumentInUse: register('g1') },
    });
    await openAndWait(store);
    expect(screen.queryByText(promptText)).not.toBeInTheDocument();
  });

  it('never shows the prompt once it has been seen', async () => {
    const { store } = makeStore({
      text: song({}),
      entry: guitarEntry(),
      preferences: { instrumentPromptSeen: register(true) },
    });
    await openAndWait(store);
    expect(screen.queryByText(promptText)).not.toBeInTheDocument();
  });

  it('exposes dismiss and change as keyboard-reachable, keyboard-operable buttons (§3.7)', async () => {
    const { store, commands } = makeStore({ text: song({}), entry: guitarEntry(), preferences: {} });
    await openAndWait(store);

    const dismiss = screen.getByRole('button', { name: 'Keep guitar and dismiss' });
    const change = screen.getByRole('button', { name: 'Change instrument' });
    // Both are focusable (reachable by Tab).
    act(() => change.focus());
    expect(change).toHaveFocus();
    act(() => dismiss.focus());
    expect(dismiss).toHaveFocus();
    // And operable by keyboard: Enter on dismiss sends the command (RAC Button
    // usePress fires the press on key-up).
    await act(async () => {
      fireEvent.keyDown(dismiss, { key: 'Enter' });
      fireEvent.keyUp(dismiss, { key: 'Enter' });
    });
    expect(lastCommand(commands, CommandKind.MARK_INSTRUMENT_PROMPT_SEEN)).toBeTruthy();
  });
});

describe('SongReading — a merge landing while open (sync.read_in_place, workflow 8 §"A song open while it changes")', () => {
  // Two versions of the same song (same title, so the chart group keeps its
  // name): the merged version changes the chart so the swap is observable.
  const V1 = song({ props: ['key: G'], chart: 'G  C' });
  const V2 = song({ props: ['key: G'], chart: 'A  D' });

  it('updates in place, keeps the place, shows the notice and opens history at the commit (workflow 8 L51-52; W08 L65/L177)', async () => {
    const onOpenHistory = vi.fn();
    const { store, commands, setSource, emitMerged } = makeStore({ text: V1, entry: guitarEntry() });
    const { container } = await openAndWait(store, { onOpenHistory });

    // The reader is scrolled down the page; the place is captured before the swap
    // and restored after re-layout. jsdom has no layout, so this pins the
    // scrollTop fallback (Decision 4); the visual guarantee is e2e-web.
    const scroll = container.querySelector('.reading-scroll');
    scroll.scrollTop = 120;

    const before = commands.filter((c) => c.kind === CommandKind.OPEN_SOURCE).length;
    setSource(V2);
    await act(async () => {
      emitMerged({ bookId: BOOK, changed: [{ path: PATH, author: 'Ana', commit: 'c0ffee' }] });
    });

    // The view re-issued OPEN_SOURCE for its open path and the chart shows the
    // merged version; the old chord is gone.
    await waitFor(() => expect(chartFirstLineGlyphs()).toBe('A D'));
    expect(commands.filter((c) => c.kind === CommandKind.OPEN_SOURCE).length).toBe(before + 1);
    expect(screen.queryByText('G C')).not.toBeInTheDocument();

    // The place is kept (scrollTop restored across the swap).
    expect(scroll.scrollTop).toBe(120);

    // The notice: role="status", naming Ana, not aria-hiding the chart.
    const notice = screen.getByRole('status');
    expect(within(notice).getByText('Updated by Ana')).toBeInTheDocument();
    expect(chartFirstLineGlyphs()).toBe('A D');

    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    // "See what changed" opens history for the song at the incoming commit.
    await click(within(notice).getByRole('button', { name: 'See what changed' }));
    expect(onOpenHistory).toHaveBeenCalledWith({ bookId: BOOK, path: PATH, commit: 'c0ffee' });

    // It is dismissible (and never stole focus — a plain Button press).
    await click(within(notice).getByRole('button', { name: 'Dismiss update notice' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('defers in full screen and applies on leaving it, collapsing to the most recent (workflow 8 L53-54; W08 L120/L155/L159; §3.7 L438-440)', async () => {
    const onOpenHistory = vi.fn();
    const { store, commands, setSource, emitMerged } = makeStore({ text: V1, entry: guitarEntry() });
    await openAndWait(store, { onOpenHistory });

    await click(screen.getByRole('button', { name: 'Full screen' }));
    await screen.findByRole('button', { name: 'Exit full screen' });

    const before = commands.filter((c) => c.kind === CommandKind.OPEN_SOURCE).length;
    setSource(V2);
    await act(async () => {
      emitMerged({ bookId: BOOK, changed: [{ path: PATH, author: 'Ana', commit: 'c0ffee' }] });
      // A second merge while full screen collapses to the most recent pending
      // update (acceptance 4).
      emitMerged({ bookId: BOOK, changed: [{ path: PATH, author: 'Bruno', commit: 'beef' }] });
    });

    // The update waits: no notice, no text swap, no re-request while full screen.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(chartFirstLineGlyphs()).toBe('G C');
    expect(commands.filter((c) => c.kind === CommandKind.OPEN_SOURCE).length).toBe(before);

    expect(await checkWcag21aa(document.body)).toHaveNoViolations(); // the waiting full-screen state

    // Leaving full screen applies the deferred update and shows the notice, for
    // the most recent pending merge.
    await click(screen.getByRole('button', { name: 'Exit full screen' }));
    await waitFor(() => expect(chartFirstLineGlyphs()).toBe('A D'));
    const notice = screen.getByRole('status');
    expect(within(notice).getByText('Updated by Bruno')).toBeInTheDocument();
    await click(within(notice).getByRole('button', { name: 'See what changed' }));
    expect(onOpenHistory).toHaveBeenCalledWith({ bookId: BOOK, path: PATH, commit: 'beef' });
  });

  it('ignores a MERGED event for a different song or book', async () => {
    const { store, commands, setSource, emitMerged } = makeStore({ text: V1, entry: guitarEntry() });
    await openAndWait(store);

    const before = commands.filter((c) => c.kind === CommandKind.OPEN_SOURCE).length;
    setSource(V2); // would surface if the view wrongly applied it
    await act(async () => {
      emitMerged({ bookId: BOOK, changed: [{ path: 'outra-musica.cifra.md', author: 'Ana', commit: 'x' }] });
      emitMerged({ bookId: 'other-book', changed: [{ path: PATH, author: 'Ana', commit: 'y' }] });
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(chartFirstLineGlyphs()).toBe('G C');
    expect(commands.filter((c) => c.kind === CommandKind.OPEN_SOURCE).length).toBe(before);
  });
});

describe('SongReading — the wide master-detail (shell.layout)', () => {
  it('places search beside the song on the computer', async () => {
    const { store } = makeStore({ text: song({}), entry: guitarEntry() });
    render(
      <ThemeRoot store={store}>
        <SongReading store={store} bookId={BOOK} path={PATH} mode="wide" />
      </ThemeRoot>,
    );
    act(() => store.open());
    await waitFor(() => expect(screen.getByRole('group', { name: 'Tarde Clara' })).toBeInTheDocument());
    // The search box sits in the side pane beside the reading view.
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
  });
});
