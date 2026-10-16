// Behavior test for the setlist player (books.play, workflow 12 §Playing
// through, §The key; board W12). It renders SetlistPlay over a loopback store
// whose stub worker answers OPEN_SOURCE (the setlist file and each song),
// BOOK_TREE (the file set, one song deleted so its item is missing) and
// OPEN_SONG (the per-song remembered transposition). An injected Wake Lock
// adapter is spied. Real RAC + i18n; axe on each key state.
//
// jsdom has no layout, so swipe and edge-tap (pointer gestures over the SAME
// next/prev actions) are pinned at e2e; here the keyboard and edge-button
// paths are driven. One gesture per control (memory
// rac-button-keydown-plus-click-cancels-press): buttons by click, the pedal by
// keyDown/keyUp pairs.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, fireEvent, within } from '@testing-library/react';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import SetlistPlay from './SetlistPlay.jsx';

const BOOK = 'book-1';
const SETLIST_PATH = 'gigs/test-set.setlist.md';

const SETLIST_TEXT = [
  '# Test Set',
  '',
  '1. [In G Song](../in-g.cifra.md)',
  '   - key: A',
  '2. [No Key Song](../no-key.cifra.md)',
  '   - key: A',
  '   - note: gentle',
  '3. [Gone Song](../gone.cifra.md)',
  '4. [Own Tune](../own.cifra.md)',
  '5. [Band Key Song](../band-key.cifra.md)',
  '   - key: G',
  '6. [Minor Song](../minor.cifra.md)',
  '   - key: C',
  '',
].join('\n');

// Purpose-written songs (no one's copyrighted words). A fenced bar line so the
// chart parses as bars (memory chart-snippet-needs-a-fence).
const IN_G = ['# In G Song', '- key: G', '', '## Verse', '```', 'G | C | D | G', '```', ''].join('\n');
const NO_KEY = ['# No Key Song', '', '## Verse', '```', 'C | F | G | C', '```', ''].join('\n');
const OWN = ['# Own Tune', '- key: G', '', '## Verse', '```', 'G | C | D | G', '```', ''].join('\n');
// Written in G under a setlist key of G: the band's key is the written one.
const BAND_KEY = ['# Band Key Song', '- key: G', '', '## Verse', '```', 'G | C | D | G', '```', ''].join('\n');
// Written in Am under a setlist key of C: the modes differ (§10.7.1).
const MINOR = ['# Minor Song', '- key: Am', '', '## Verse', '```', 'Am | Dm | E | Am', '```', ''].join('\n');

const TEXT_BY_PATH = {
  [SETLIST_PATH]: SETLIST_TEXT,
  'in-g.cifra.md': IN_G,
  'no-key.cifra.md': NO_KEY,
  'own.cifra.md': OWN,
  'band-key.cifra.md': BAND_KEY,
  'minor.cifra.md': MINOR,
};

// Gone Song is referenced by the setlist but absent from the tree → missing.
const ENTRIES = [
  { path: 'in-g.cifra.md', status: 'clean' },
  { path: 'no-key.cifra.md', status: 'clean' },
  { path: 'own.cifra.md', status: 'clean' },
  { path: 'band-key.cifra.md', status: 'clean' },
  { path: 'minor.cifra.md', status: 'clean' },
  { path: SETLIST_PATH, status: 'clean' },
];

// Own Tune carries a remembered transposition of +2 (so its chart, with no item
// key, reads under the user's own offset — chip "In A").
const SONG_STATE = {
  'own.cifra.md': { transposition: 2, variations: {} },
};

function installMatchMedia(matches) {
  globalThis.matchMedia = (query) => ({
    matches, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

beforeEach(() => { installMatchMedia(false); setLocale('en'); });
afterEach(() => { delete globalThis.matchMedia; vi.restoreAllMocks(); });

function makeStore() {
  const endpoint = createLoopbackEndpoint((port) => ({
    handle(message) {
      const p = message.payload ?? {};
      switch (message.kind) {
        case CommandKind.OPEN_SOURCE:
          port.postMessage(event(EventKind.SOURCE, {
            bookId: p.bookId, path: p.path, text: TEXT_BY_PATH[p.path] ?? '',
          }));
          break;
        case CommandKind.BOOK_TREE:
          port.postMessage(event(EventKind.TREE, { bookId: p.bookId, entries: ENTRIES }));
          break;
        case CommandKind.OPEN_SONG:
          port.postMessage(event(EventKind.SONG, {
            bookId: p.bookId, path: p.path,
            ...(SONG_STATE[p.path] ?? { transposition: 0, variations: {} }),
          }));
          break;
        default:
          break;
      }
    },
  }));
  return createStore(endpoint);
}

function makeWakeLock() {
  return { supported: true, request: vi.fn(() => Promise.resolve()), release: vi.fn(() => Promise.resolve()) };
}

function renderPlayer(store, props = {}) {
  const wakeLock = props.wakeLock ?? makeWakeLock();
  const onStop = props.onStop ?? vi.fn();
  const utils = render(
    <ThemeRoot store={store}>
      <SetlistPlay store={store} bookId={BOOK} path={SETLIST_PATH} mode="narrow"
        onStop={onStop} wakeLock={wakeLock} />
    </ThemeRoot>,
  );
  return { ...utils, wakeLock, onStop };
}

// The chord names the chart draws, in order (sung `.c` and bar-line `.g` glyphs).
function chartChords(container) {
  return Array.from(container.querySelectorAll('.chart .c, .chart .g')).map((el) => el.textContent);
}

// Step forward through the playable list to the song titled `title`.
async function playTo(title) {
  await screen.findByRole('group', { name: 'In G Song' });
  for (let i = 0; i < 5 && !screen.queryByRole('group', { name: title }); i += 1) {
    await pressKey('ArrowRight');
  }
  await screen.findByRole('group', { name: title });
}

// Drive the pedal: a page key on the focused surface (it bubbles to the
// surface's keydown binding). One keyDown/keyUp gesture.
async function pressKey(key) {
  await act(async () => {
    const el = document.activeElement ?? document.body;
    fireEvent.keyDown(el, { key });
    fireEvent.keyUp(el, { key });
  });
}

describe('SetlistPlay — the setlist player', () => {
  it('opens on the first linked song, transposed to the setlist key (AC 3; W12 L78/L81)', async () => {
    const store = makeStore();
    renderPlayer(store);
    await screen.findByRole('group', { name: 'In G Song' });
    // The chip names the current key, and the body names the setlist key over
    // the written one.
    expect(screen.getByText('In A')).toBeInTheDocument();
    expect(screen.getByText('Setlist key A · written in G')).toBeInTheDocument();
  });

  it('puts the chip in the bar beside Stop, and the setlist line in the sheet (W12 phone #2 L78, L81)', async () => {
    const store = makeStore();
    renderPlayer(store);
    await screen.findByRole('group', { name: 'In G Song' });
    const bar = screen.getByRole('button', { name: 'Stop playing' }).closest('.play-bar');
    expect(within(bar).getByText('In A')).toBeInTheDocument();
    const sheet = screen.getByRole('region', { name: 'In G Song' });
    expect(within(sheet).getByText('Setlist key A · written in G')).toBeInTheDocument();
  });

  it('names a setlist key equal to the written key, untransposed (§The key; cifra.md §10.7.1 L335-337)', async () => {
    const store = makeStore();
    const { container } = renderPlayer(store);
    await playTo('Band Key Song');
    const bar = screen.getByRole('button', { name: 'Stop playing' }).closest('.play-bar');
    expect(within(bar).getByText('In G')).toBeInTheDocument();
    expect(screen.getByText('Setlist key G')).toBeInTheDocument();
    expect(screen.queryByText(/written in/)).not.toBeInTheDocument();
    // Not moved: the chords are as written.
    const chords = chartChords(container);
    expect(chords).toEqual(expect.arrayContaining(['G', 'C', 'D']));
    expect(chords).not.toContain('A');
  });

  it('shows a setlist key in another mode as a note, untransposed, with no chip (cifra.md §10.7.1 L342-347)', async () => {
    const store = makeStore();
    const { container } = renderPlayer(store);
    await playTo('Minor Song');
    expect(screen.getByText('Setlist key C')).toBeInTheDocument();
    expect(screen.queryByText(/written in/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^In /)).not.toBeInTheDocument();
    const chords = chartChords(container);
    expect(chords).toEqual(expect.arrayContaining(['Am', 'Dm', 'E']));
    expect(chords).not.toContain('Cm');
  });

  it('shows a keyless song under an item key as a note, untransposed (AC 3; §The key L52-54)', async () => {
    const store = makeStore();
    renderPlayer(store);
    await screen.findByRole('group', { name: 'In G Song' });
    await pressKey('ArrowRight'); // → No Key Song
    await screen.findByRole('group', { name: 'No Key Song' });
    expect(screen.getByText('Setlist key A')).toBeInTheDocument();
    expect(screen.queryByText(/written in/)).not.toBeInTheDocument();
    // Not transposed: no "In {key}" chip.
    expect(screen.queryByText(/^In /)).not.toBeInTheDocument();
  });

  it('reads an item with no key under the user’s own remembered transposition (AC 3; §The key L49-51)', async () => {
    const store = makeStore();
    renderPlayer(store);
    await screen.findByRole('group', { name: 'In G Song' });
    await pressKey('ArrowRight'); // No Key Song
    await pressKey('ArrowRight'); // skips Gone Song (missing) → Own Tune
    await screen.findByRole('group', { name: 'Own Tune' });
    // Own offset +2 over written G → chip "In A", and no setlist-key line.
    expect(screen.getByText('In A')).toBeInTheDocument();
    expect(screen.queryByText(/Setlist key/)).not.toBeInTheDocument();
  });

  it('skips the missing item, showing the next-song title on the Next card (AC 2, 4)', async () => {
    const store = makeStore();
    renderPlayer(store);
    await screen.findByRole('group', { name: 'In G Song' });
    // The Next card names the upcoming song and its note.
    expect(screen.getByText('2. No Key Song')).toBeInTheDocument();
    expect(screen.getByText('Note: gentle')).toBeInTheDocument();
    // Position of three playable songs (Gone Song is skipped, never counted).
    expect(screen.getByText('1 of 5 · screen kept awake')).toBeInTheDocument();
    await pressKey('ArrowRight'); // No Key Song
    await screen.findByRole('group', { name: 'No Key Song' });
    // From here the Next card points straight at Own Tune — Gone Song is gone.
    expect(screen.getByText('4. Own Tune')).toBeInTheDocument();
    expect(screen.queryByText(/Gone Song/)).not.toBeInTheDocument();
  });

  it('navigates next and previous by the edge Buttons, clamping at the ends (AC 4)', async () => {
    const store = makeStore();
    renderPlayer(store);
    await screen.findByRole('group', { name: 'In G Song' });
    // At the first song, Previous is disabled (no wrap).
    expect(screen.getByRole('button', { name: 'Previous song' })).toBeDisabled();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Next song' })));
    await screen.findByRole('group', { name: 'No Key Song' });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Previous song' })));
    await screen.findByRole('group', { name: 'In G Song' });
  });

  it('navigates by the arrow and page keys the pedal sends (AC 4; workflow 12 L66-69)', async () => {
    const store = makeStore();
    renderPlayer(store);
    await screen.findByRole('group', { name: 'In G Song' });
    await pressKey('PageDown'); // next
    await screen.findByRole('group', { name: 'No Key Song' });
    await pressKey('PageUp'); // previous
    await screen.findByRole('group', { name: 'In G Song' });
    await pressKey('ArrowRight');
    await screen.findByRole('group', { name: 'No Key Song' });
    await pressKey('ArrowLeft');
    await screen.findByRole('group', { name: 'In G Song' });
  });

  it('requests the Wake Lock on open and releases it on Stop; shows the status word (AC 5)', async () => {
    const store = makeStore();
    const { wakeLock, onStop } = renderPlayer(store);
    await screen.findByRole('group', { name: 'In G Song' });
    expect(wakeLock.request).toHaveBeenCalledWith('screen');
    expect(screen.getByText(/screen kept awake/)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Stop playing' })));
    expect(onStop).toHaveBeenCalled();
    expect(wakeLock.release).toHaveBeenCalled();
  });

  it('leaves the player on Escape (AC 1)', async () => {
    const store = makeStore();
    const { onStop } = renderPlayer(store);
    await screen.findByRole('group', { name: 'In G Song' });
    await pressKey('Escape');
    expect(onStop).toHaveBeenCalled();
  });

  it('is axe-clean on the transposed, note-only, own-transposition, equal-key and mode-mismatch states', async () => {
    const store = makeStore();
    const { container } = renderPlayer(store);
    await screen.findByRole('group', { name: 'In G Song' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    await pressKey('ArrowRight');
    await screen.findByRole('group', { name: 'No Key Song' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    await pressKey('ArrowRight');
    await screen.findByRole('group', { name: 'Own Tune' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    await pressKey('ArrowRight');
    await screen.findByRole('group', { name: 'Band Key Song' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    await pressKey('ArrowRight');
    await screen.findByRole('group', { name: 'Minor Song' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});
