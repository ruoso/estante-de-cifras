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
import { parseChord } from '../core/notation/parse.js';
import { defaultVoicing } from '../core/voicings.js';
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

// A purpose-written song: a chord-only chart, an optional property list,
// optional voicing lines after the `---` rule.
const song = ({ title = 'Tarde Clara', props = [], chart = 'Cm | G | Cm | Fm', voicings = [] }) =>
  [
    `# ${title}`,
    ...(props.length ? ['', ...props.map((p) => `- ${p}`)] : []),
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
function makeStore({ text, entry, variations = {}, preferences }) {
  const commands = [];
  const state = { variations: { ...variations } };
  const prefs = { ...(preferences ?? { instrumentInUse: register(entry.id) }) };
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

// jsdom moves no focus on Tab: step to the next tabbable control in document
// order (a roving radio group exposes only its selected radio), as a browser does.
const tabbables = () =>
  [...document.querySelectorAll('button, input, [tabindex]')].filter(
    (el) => el.tabIndex >= 0 && !el.disabled && !el.closest('[hidden], [aria-hidden="true"], [inert]'),
  );
const tab = async () => {
  const list = tabbables();
  const from = document.activeElement;
  await act(async () => {
    fireEvent.keyDown(from, { key: 'Tab' });
    const at = list.indexOf(from);
    const next = at < 0 ? list.find((el) => from.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) : list[at + 1];
    next?.focus();
    fireEvent.keyUp(next ?? from, { key: 'Tab' });
  });
};
const arrow = async (key) => {
  await act(async () => {
    fireEvent.keyDown(document.activeElement, { key });
    fireEvent.keyUp(document.activeElement, { key });
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

// The mode chip is the instrument chip carrying the mode (songs.arrange_polish
// Decision 1): one /change instrument/ button per screen (header_chrome D7),
// named by the chip's one short label after the mode, the full identity as its
// description, opening the instruments as reading's chip does. Pins workflow 15
// lines 62-69 and the workflow 5 delta lines 28-33.
describe('SongArrange — the mode chip', () => {
  it('is the one instrument chip, "Arranging · Guitar", described by the full identity; axe clean', async () => {
    const { store } = makeStore({
      text: song({ chart: 'G | C' }),
      entry: { ...guitarEntry(), id: 'standard', label: null },
    });
    const { container } = await openArrange(store);
    const chips = await screen.findAllByRole('button', { name: /change instrument/ });
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveAccessibleName('Arranging · Guitar, change instrument');
    expect(chips[0]).toHaveAccessibleDescription('Guitar (6-string), Standard tuning: E2 A2 D3 G3 B3 E4');
    expect(chips[0]).toHaveTextContent('Arranging · Guitar');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('reads "Arranging · Cavaquinho" with a cavaquinho in use', async () => {
    const tuning = 'D4 G4 B4 D5';
    const inst = instrumentInstance({ catalogId: 'cavaquinho', strings: tuning, fretCount: 17 });
    const entry = {
      id: 'c1',
      catalogId: 'cavaquinho',
      label: null,
      tuning,
      fretCount: 17,
      config: configFor(inst, 'strumming'),
      shapes: [],
    };
    const { store } = makeStore({ text: song({ chart: 'G | C' }), entry });
    await openArrange(store);
    expect(await screen.findByRole('button', { name: 'Arranging · Cavaquinho, change instrument' })).toBeInTheDocument();
  });

  it('pressing it opens the instruments overlay; axe clean', async () => {
    const { store } = makeStore({ text: song({ chart: 'G | C' }), entry: guitarEntry() });
    await openArrange(store);
    await click(await screen.findByRole('button', { name: 'Arranging · Guitar, change instrument' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Instruments' })).toBeInTheDocument();
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();
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

// Entering a shape is a screen of arrange, not a dialog over the picker
// (songs.arrange_polish Decision 2; board W05#3): its own app bar, the context
// line and the help, the shared builder naming each note's part in the chord,
// the foreign-note notice; Back reopens the picker as it was, *Choose this
// shape* writes as a listed candidate does. Pins the workflow 5 delta lines
// 43-51 and W05#3.
describe('SongArrange — entering a shape inline', () => {
  // Cm already chosen at the key, so *Only here* writes a footnote (§8.5.1
  // branch 4 — [[only-here-needs-prechosen-key]]).
  const CHOSEN = song({ chart: 'Cm | G | Cm | Fm', voicings: [`## Voicings: ${GUITAR_TUNING}`, '- Cm: 8-10-10-8-8-8'] });

  // Open the picker on the first Cm from the keyboard (focus on the chord), set
  // *Only here*, and enter the screen.
  async function toScreen() {
    const chord = screen.getAllByRole('button', { name: 'C minor' })[0];
    act(() => chord.focus());
    await pressKey(chord, 'Enter');
    await click(screen.getByRole('button', { name: 'Only here' }));
    await click(screen.getByRole('button', { name: 'Enter a shape' }));
    return chord;
  }

  // x35544, string by string (low → high is string 6 → 1).
  async function enterX35544() {
    await click(screen.getByRole('radio', { name: 'String 5, fret 3' }));
    await click(screen.getByRole('radio', { name: 'String 4, fret 5' }));
    await click(screen.getByRole('radio', { name: 'String 3, fret 5' }));
    await click(screen.getByRole('radio', { name: 'String 2, fret 4' }));
    await click(screen.getByRole('radio', { name: 'String 1, fret 4' }));
  }

  const rowOf = (name) =>
    within(screen.getByRole('region', { name: 'Notes it holds' }))
      .getAllByRole('listitem')
      .find((li) => li.querySelector('.name')?.textContent === name);
  const rowText = (name) =>
    [...rowOf(name).querySelectorAll('.name, .meta, .enter-shape-notename, .badge')].map((n) => n.textContent).join(' · ');

  it('opens a screen — no dialog — reads the roles, the summary and the notice; axe clean', async () => {
    const { store } = makeStore({ text: CHOSEN, entry: guitarEntry() });
    const { container } = await openArrange(store);
    await toScreen();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Enter a shape for Cm' })).toBeInTheDocument();
    expect(container.querySelector('.arrange-enter-place').textContent).toMatch(
      /^Tarde Clara · Primeira Parte, bar 1 · only here\.?$/,
    );
    expect(
      screen.getByText('Tap a string at a fret to place a finger; tap above the nut to mute or open it.'),
    ).toBeInTheDocument();
    // The instrument is named, not a switch (Decision 3): no chip button here.
    expect(screen.queryByRole('button', { name: /change instrument/ })).toBeNull();
    expect(screen.getByText('Guitar')).toBeInTheDocument();

    await enterX35544();
    expect(rowText('A2')).toBe('A2 · fret 3 · C · root');
    expect(rowText('D3')).toBe('D3 · fret 5 · G · fifth');
    expect(rowText('B3')).toBe('B3 · fret 4 · E♭ · minor third');
    expect(rowText('E4 · high E')).toBe('E4 · high E · fret 4 · A♭ · not in Cm');
    expect(rowOf('E4 · high E').querySelector('.badge.conflict')).toBeTruthy();
    expect(screen.getByText('C · E♭ · G · A♭')).toBeInTheDocument();
    expect(
      screen.getByText('The A♭ on the high E string is not in Cm, which is C, E♭ and G. You can still choose this shape.'),
    ).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  }, AXE_OVER_PICKER);

  it('Back reopens the picker on Cm with Only here still on, focus on Enter a shape', async () => {
    const { store } = makeStore({ text: CHOSEN, entry: guitarEntry() });
    await openArrange(store);
    await toScreen();

    await click(screen.getByRole('button', { name: 'Back' }));
    const picker = await screen.findByRole('dialog', { name: 'Shapes for Cm' });
    expect(within(picker).getByRole('button', { name: 'Only here' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(within(picker).getByRole('button', { name: 'Enter a shape' })).toHaveFocus());
  });

  it('Cancel returns to the picker as well', async () => {
    const { store } = makeStore({ text: CHOSEN, entry: guitarEntry() });
    await openArrange(store);
    await toScreen();
    await click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('dialog', { name: 'Shapes for Cm' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Enter a shape for Cm' })).toBeNull();
  });

  it('Choose this shape sends one WRITE carrying the shape (only here: its footnote) and focus lands on the chord', async () => {
    const { store, commands } = makeStore({ text: CHOSEN, entry: guitarEntry() });
    await openArrange(store);
    await toScreen();
    await enterX35544();
    // x35544 is read out as drawn but the hand model finds no fingering for it
    // (*can't be played as entered*); muting the high E leaves x3554x to choose.
    expect(screen.getByRole('button', { name: /^Choose Cm,/ })).toBeDisabled();
    await click(screen.getByRole('radio', { name: 'Mute string 1' }));

    const before = commands.filter((c) => c.kind === CommandKind.WRITE).length;
    await click(screen.getByRole('button', { name: /^Choose Cm,/ }));
    const writes = commands.filter((c) => c.kind === CommandKind.WRITE);
    expect(writes).toHaveLength(before + 1);
    const text = writes.at(-1).payload.text;
    expect(text).toMatch(/Cm\[\d\]/);
    expect(blockOf(text).voicings.some((v) => v.symbol === 'Cm' && v.frets.join('') === 'x3554x')).toBe(true);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Enter a shape for Cm' })).toBeNull();
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('C minor'));
  });

  it('a keyboard-only pass: Tab to the grid, arrows across a string, Enter on Choose', async () => {
    const { store, commands } = makeStore({ text: song({}), entry: guitarEntry() });
    await openArrange(store);
    const chord = screen.getAllByRole('button', { name: 'C minor' })[0];
    act(() => chord.focus());
    await pressKey(chord, 'Enter');
    const row = screen.getByRole('button', { name: 'Enter a shape' });
    act(() => row.focus());
    await pressKey(row, 'Enter');

    // The screen's heading has focus on arrival (Back sits before it); Tab goes
    // into the grid.
    const heading = screen.getByRole('heading', { level: 1, name: 'Enter a shape for Cm' });
    await waitFor(() => expect(heading).toHaveFocus());
    await tab();
    expect(document.activeElement).toHaveAttribute('aria-label', 'Mute string 6');
    // Tab to string 5's group, arrow across it to fret 3.
    await tab();
    expect(document.activeElement).toHaveAttribute('aria-label', 'Mute string 5');
    for (let i = 0; i < 4; i += 1) await arrow('ArrowRight');
    expect(document.activeElement).toHaveAttribute('aria-label', 'String 5, fret 3');
    expect(screen.getByRole('radio', { name: 'String 5, fret 3' })).toBeChecked();
    for (const n of [4, 3, 2, 1]) {
      await tab();
      expect(document.activeElement).toHaveAttribute('aria-label', `Mute string ${n}`);
    }
    // String 5 at fret 3 alone is a playable fragment; Tab past the grid to
    // Cancel, then Choose, and press it with Enter.
    await tab();
    expect(document.activeElement).toHaveTextContent('Cancel');
    await tab();
    expect(document.activeElement.getAttribute('aria-label')).toMatch(/^Choose Cm,/);
    await pressKey(document.activeElement, 'Enter');
    expect(lastCommand(commands, CommandKind.WRITE)).toBeTruthy();
    await waitFor(() => expect(document.activeElement?.getAttribute('aria-label')).toBe('C minor'));
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

  it('writes an american song\'s unchosen chords as the song reads them (cifra.md §5.6)', async () => {
    // A brazilian preference over an american song: unchosenPlan reads the
    // chart in the song's notation, so C7+ is written at the sharp-fifth
    // default and C7(4) at the added-fourth one — not C7M's and C7sus4's.
    const entry = guitarEntry();
    const { store, commands } = makeStore({
      text: song({ props: ['notation: american'], chart: 'C7+ | C7(4)' }),
      entry,
      preferences: { instrumentInUse: register(entry.id), notation: register('brazilian') },
    });
    await openArrange(store);
    expect(await checkWcag21aa(document.body)).toHaveNoViolations();

    const instrument = instrumentInstance({
      catalogId: entry.catalogId,
      label: entry.label,
      strings: entry.tuning,
      fretCount: entry.fretCount,
      heuristics: entry.config,
    });
    const fretsOf = (symbol, dialect) => defaultVoicing(parseChord(symbol, dialect).chord, instrument).frets;
    expect(fretsOf('C7#5', 'american')).not.toEqual(fretsOf('C7M', 'brazilian'));
    expect(fretsOf('C7add4', 'american')).not.toEqual(fretsOf('C7sus4', 'brazilian'));

    await click(screen.getByRole('button', { name: 'Choose these for every unchosen chord' }));

    const write = lastCommand(commands, CommandKind.WRITE);
    const block = blockOf(write.payload.text);
    const fretsBySymbol = Object.fromEntries(block.voicings.map((v) => [v.symbol, v.frets]));
    expect(fretsBySymbol['C7+']).toEqual(fretsOf('C7#5', 'american'));
    expect(fretsBySymbol['C7(4)']).toEqual(fretsOf('C7add4', 'american'));
    // The song's text keeps its notation and its symbols as written (§8).
    expect(parse(write.payload.text).properties).toContainEqual({ key: 'notation', value: 'american' });
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
