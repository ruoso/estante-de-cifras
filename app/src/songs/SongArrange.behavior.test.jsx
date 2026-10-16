// behavior (songs.arrange, workflow 5) — the arrange surface with its real
// collaborators: React Aria Components, i18n, the music core and `cifra-md`'s
// §8.5 edit ops + canonical writer, over a loopback-backed store seeded with the
// PREFERENCES / SHELF / INSTRUMENTS / SOURCE / SONG slices. Each choice's effect
// is read back by reparsing the `WRITE` command's text (the Worker owns
// durability; WRITE is silent, so the surface re-renders from its local text).
// axe at WCAG 2.1 AA over each state. Fixtures are songs written for the purpose,
// never anyone's copyrighted words. No CodeMirror stub is needed — the surface is
// chart + diagrams, not an editor.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, act, fireEvent, waitFor } from '@testing-library/react';
import { parse } from 'cifra-md';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { instrumentInstance, configFor } from '../core/instrument.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import SongArrange from './SongArrange.jsx';

const GUITAR_TUNING = 'E2 A2 D3 G3 B3 E4';
const FENCE = '```';
const BOOK = 'local-example-book';
const PATH = 'tarde-clara.cifra.md';

const register = (value) => ({ value, at: '2026-01-01T00:00:00.000Z' });

function installMatchMedia(dark = false) {
  globalThis.matchMedia = (media) => ({ media, matches: dark, addEventListener: () => {}, removeEventListener: () => {} });
}

beforeEach(() => {
  installMatchMedia(false);
  setLocale('en');
});
afterEach(() => {
  delete globalThis.matchMedia;
  vi.restoreAllMocks();
});

// A purpose-written song: a chord-only chart, optional voicing lines after the
// `---` rule.
const song = ({ title = 'Tarde Clara', chart = 'Cm | G | Cm | Fm', voicings = [] }) =>
  [
    `# ${title}`,
    '',
    '## Primeira Parte',
    FENCE,
    chart,
    FENCE,
    ...(voicings.length ? ['', '---', '', ...voicings] : []),
  ].join('\n') + '\n';

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

// The loopback-backed stub Worker: seeds the slices on OPEN, answers the reads,
// records every command, and re-surfaces SONG on SET_VARIATION. WRITE is silent
// (durability only), so it is recorded but surfaces no event.
function makeStore({ text, entry, variations = {} }) {
  const commands = [];
  const state = { variations: { ...variations } };
  const prefs = { instrumentInUse: register(entry.id) };
  const endpoint = createLoopbackEndpoint((port) => ({
    handle(message) {
      commands.push(message);
      const p = message.payload ?? {};
      switch (message.kind) {
        case CommandKind.OPEN:
          port.postMessage(event(EventKind.PREFERENCES, { ...prefs }));
          port.postMessage(event(EventKind.SHELF, {}));
          port.postMessage(event(EventKind.INSTRUMENTS, { instruments: [entry], inUseId: entry.id, standard: entry }));
          break;
        case CommandKind.OPEN_SOURCE:
          port.postMessage(event(EventKind.SOURCE, { bookId: p.bookId, path: p.path, text }));
          break;
        case CommandKind.OPEN_SONG:
          port.postMessage(event(EventKind.SONG, { bookId: p.bookId, path: p.path, transposition: 0, ...state }));
          break;
        case CommandKind.SET_VARIATION:
          state.variations = { ...state.variations, [p.tuning]: p.variation };
          port.postMessage(event(EventKind.SONG, { bookId: p.bookId, path: p.path, transposition: 0, ...state }));
          break;
        default:
          break;
      }
    },
  }));
  return { store: createStore(endpoint), commands };
}

function renderArrange(store, props = {}) {
  return render(
    <ThemeRoot store={store}>
      <SongArrange store={store} bookId={BOOK} path={PATH} mode="narrow" {...props} />
    </ThemeRoot>,
  );
}

async function openArrange(store, props) {
  const utils = renderArrange(store, props);
  act(() => store.open());
  await waitFor(() => expect(screen.getByRole('group', { name: 'Tarde Clara' })).toBeInTheDocument());
  return utils;
}

const lastCommand = (commands, kind) => [...commands].reverse().find((c) => c.kind === kind);
const click = async (el) => {
  await act(async () => {
    fireEvent.click(el);
  });
};
const pressKey = async (el, key) => {
  await act(async () => {
    fireEvent.keyDown(el, { key });
    fireEvent.keyUp(el, { key });
  });
};

// Reparse a WRITE's text and return the voicing block for a label ('' default).
function blockOf(text, label = '') {
  return parse(text).blocks.find((b) => (b.label ?? '') === label);
}

describe('SongArrange — tappable chords and the strip', () => {
  it('renders each chord as a focusable press target and the strip with song/yours/default and their words; axe clean', async () => {
    const { store } = makeStore({
      text: song({ chart: 'G | C | Em', voicings: [`## Voicings: ${GUITAR_TUNING}`, '- G: 320003'] }),
      entry: guitarEntry([{ tuning: GUITAR_TUNING, chord: 'C', shorthand: 'x32010' }]),
    });
    const { container } = await openArrange(store);

    // Every chord in the chart is a focusable button inside the chart group.
    const chart = screen.getByRole('group', { name: 'Tarde Clara' });
    expect(within(chart).getByRole('button', { name: 'G' })).toBeInTheDocument();
    expect(within(chart).getByRole('button', { name: 'C' })).toBeInTheDocument();
    expect(within(chart).getByRole('button', { name: 'E minor' })).toBeInTheDocument();

    // The Shapes strip carries the kind words (a word, never colour alone): C is
    // yours, Em is a default; G is the song's own (no word).
    const strip = screen.getByRole('region', { name: 'Shapes' });
    expect(within(strip).getByText('your shape')).toBeInTheDocument();
    expect(within(strip).getByText('default')).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

// The mode chip names the instrument by the chip's one short label
// (shell.header_chrome): the copy no longer varies between screens, and the
// unlabelled standard fallback reads "Guitar", not "instrument". Pins workflow
// 5's mode chip naming the instrument.
describe('SongArrange — the mode chip', () => {
  it('reads "Arranging · Guitar" with the standard fallback (no label)', async () => {
    const { store } = makeStore({
      text: song({ chart: 'G | C' }),
      entry: { ...guitarEntry(), id: 'standard', label: null },
    });
    await openArrange(store);
    expect(await screen.findByText('Arranging · Guitar')).toBeInTheDocument();
  });
});

// The picker renders a fretboard diagram per candidate, and axe walks all of
// them: deterministic work (no waiting) that runs past Vitest's 5 s default
// when the full suite loads the machine, as the other axe-over-diagram tests do.
const AXE_OVER_PICKER = 20000;

describe('SongArrange — the picker', () => {
  it('Every Cm writes a key-level entry for every Cm, no footnote; axe clean over the open picker', async () => {
    const { store, commands } = makeStore({ text: song({}), entry: guitarEntry() });
    const { container } = await openArrange(store);

    await click(screen.getAllByRole('button', { name: 'C minor' })[0]);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    // The scope defaults to Every Cm; choose the first candidate shape.
    await click(screen.getAllByRole('button', { name: /^Choose Cm,/ })[0]);

    const write = lastCommand(commands, CommandKind.WRITE);
    expect(write).toBeTruthy();
    const block = blockOf(write.payload.text);
    expect(block.voicings.some((v) => v.symbol === 'Cm')).toBe(true);
    // Every Cm shares the one choice: no footnote marker was written.
    expect(write.payload.text).not.toMatch(/Cm\[\d\]/);
  }, AXE_OVER_PICKER);

  it('Only here warns before acting, then marks one occurrence with its own footnote (§8.5.1, §2.4)', async () => {
    // Cm is already chosen at the key, up the neck; playing one occurrence
    // differently is what gives it a footnote marker (§8.5.1 branch 4). A
    // fully-unchosen chord would instead set the whole key (branch 3).
    const { store, commands } = makeStore({
      text: song({ chart: 'Cm | G | Cm | Fm', voicings: [`## Voicings: ${GUITAR_TUNING}`, '- Cm: 8-10-10-8-8-8'] }),
      entry: guitarEntry(),
    });
    await openArrange(store);

    await click(screen.getAllByRole('button', { name: 'C minor' })[0]);
    // Selecting Only here reveals the shared-chart warning before any shape is chosen.
    await click(screen.getByRole('button', { name: 'Only here' }));
    expect(screen.getByText(/marks this bar in the chart/)).toBeInTheDocument();

    // Choose a candidate other than the already-chosen up-the-neck shape.
    const candidates = screen
      .getAllByRole('button', { name: /^Choose Cm,/ })
      .filter((b) => !/8 10 10 8 8 8/.test(b.getAttribute('aria-label')));
    await click(candidates[0]);

    const write = lastCommand(commands, CommandKind.WRITE);
    const text = write.payload.text;
    // That occurrence now carries a footnote marker, and the block holds two Cm
    // shapes (the key's and the per-occurrence one).
    expect(text).toMatch(/Cm\[\d\]/);
    const block = blockOf(text);
    expect(block.voicings.filter((v) => v.symbol === 'Cm')).toHaveLength(2);
  });

  it('Enter a shape chooses a hand-built shape with a non-chord tone; axe clean over the dialog', async () => {
    const { store, commands } = makeStore({ text: song({}), entry: guitarEntry() });
    const { container } = await openArrange(store);

    await click(screen.getAllByRole('button', { name: 'C minor' })[0]);
    await click(screen.getByRole('button', { name: 'Enter a shape' }));

    const dialog = screen.getByRole('dialog', { name: 'Enter a shape for Cm' });
    // Place the high E string at fret 4 — an A♭, not in Cm — a non-chord tone.
    await click(within(dialog).getByRole('radio', { name: 'String 1, fret 4' }));
    expect(within(dialog).getByText('not in the chord')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // The shape is still choosable (a shape can be right and unusual).
    await click(within(dialog).getByRole('button', { name: /^Choose Cm,/ }));
    expect(lastCommand(commands, CommandKind.WRITE)).toBeTruthy();
  }, AXE_OVER_PICKER);

  it('a keyboard path opens the picker, works the segment and a candidate, and returns focus to the chord', async () => {
    const { store, commands } = makeStore({ text: song({}), entry: guitarEntry() });
    await openArrange(store);

    const chord = screen.getAllByRole('button', { name: 'C minor' })[0];
    chord.focus();
    expect(chord).toHaveFocus();
    await pressKey(chord, 'Enter');

    // The picker is open; the every/only-here segment is keyboard-operable.
    const everyCm = screen.getByRole('button', { name: 'Every Cm' });
    everyCm.focus();
    await pressKey(everyCm, 'Enter');

    const choose = screen.getAllByRole('button', { name: /^Choose Cm,/ })[0];
    choose.focus();
    await pressKey(choose, 'Enter');

    expect(lastCommand(commands, CommandKind.WRITE)).toBeTruthy();
    // On close RAC returns focus to the chord that opened the picker.
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('aria-label')).toBe('C minor'),
    );
  });
});

describe('SongArrange — choose these for every unchosen chord', () => {
  it('writes every unchosen chord at its shown shape and leaves a song-sourced chord untouched', async () => {
    const { store, commands } = makeStore({
      text: song({ chart: 'G | C', voicings: [`## Voicings: ${GUITAR_TUNING}`, '- G: 320003'] }),
      entry: guitarEntry(),
    });
    await openArrange(store);

    await click(screen.getByRole('button', { name: 'Choose these for every unchosen chord' }));

    const write = lastCommand(commands, CommandKind.WRITE);
    const block = blockOf(write.payload.text);
    const symbols = block.voicings.map((v) => v.symbol).sort();
    // G (already chosen) stays; C (a default) is now written too.
    expect(symbols).toEqual(['C', 'G']);
  });
});

describe('SongArrange — variations', () => {
  it('adds a fresh variation to the song and switches to it; the selector then appears', async () => {
    const { store, commands } = makeStore({
      text: song({ chart: 'G | C', voicings: [`## Voicings: ${GUITAR_TUNING}`, '- G: 320003', '- C: x32010'] }),
      entry: guitarEntry(),
    });
    await openArrange(store);

    // One variation: the selector is hidden.
    expect(screen.queryByRole('group', { name: 'Variation' })).not.toBeInTheDocument();

    await click(screen.getByRole('button', { name: 'Variations' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a variation' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name for this variation' }), {
      target: { value: 'Up the neck' },
    });
    await click(within(dialog).getByRole('button', { name: 'Add' }));

    // A new block is written and the personal variation-in-use is switched.
    const write = lastCommand(commands, CommandKind.WRITE);
    const labels = parse(write.payload.text).blocks.map((b) => b.label ?? '');
    expect(labels).toContain('Up the neck');
    const setVar = lastCommand(commands, CommandKind.SET_VARIATION);
    expect(setVar.payload.variation).toBe('Up the neck');

    // The selector now shows the two variations.
    await waitFor(() => expect(screen.getByRole('group', { name: 'Variation' })).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Up the neck' })).toBeInTheDocument();
  });

  it('refuses a name already in use with an inline error and writes nothing', async () => {
    const { store, commands } = makeStore({
      text: song({
        chart: 'G | C',
        voicings: [
          `## Voicings: ${GUITAR_TUNING}`,
          '- G: 320003',
          '',
          `## Up the neck: ${GUITAR_TUNING}`,
          '- G: 355433',
        ],
      }),
      entry: guitarEntry(),
    });
    await openArrange(store);

    await click(screen.getByRole('button', { name: 'Variations' }));
    const dialog = screen.getByRole('dialog', { name: 'Add a variation' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name for this variation' }), {
      target: { value: 'Up the neck' },
    });
    await click(within(dialog).getByRole('button', { name: 'Add' }));

    expect(within(dialog).getByRole('alert')).toHaveTextContent(/already a variation called/);
    expect(lastCommand(commands, CommandKind.WRITE)).toBeUndefined();
  });
});
