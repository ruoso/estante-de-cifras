// behavior (songs.wizard_ui, workflow 5) — the voicing wizard with its real
// collaborators: React Aria Components, i18n, the pure voicing-plan engine and
// `cifra-md`'s §8.5 ops + canonical writer, over a loopback-backed store seeded
// with the PREFERENCES / SHELF / INSTRUMENTS / SOURCE / SONG slices (the
// SongEditor arrange rig). The plan's effect is read back by reparsing the recorded
// `WRITE` command's text; the preview writes nothing. axe at WCAG 2.1 AA over
// each state. Fixtures are songs written for the purpose, never anyone's
// copyrighted words. The wizard is a surface of policies, diagrams and a text
// field; only the focus-return harness mounts the editor, whose CodeMirror needs
// the geometry stub below.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, within, act, fireEvent, waitFor } from '@testing-library/react';
import { parse } from 'cifra-md';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { instrumentInstance, configFor } from '../core/instrument.js';
import { parseChord } from '../core/notation/parse.js';
import { formatChord } from '../core/notation/format.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import SongWizard from './SongWizard.jsx';
import SongEditor from '../editor/SongEditor.jsx';
import { installWidths } from '../test/widths.js';

// CodeMirror's measure pass needs geometry jsdom lacks (the editor harness).
Range.prototype.getClientRects = function getClientRects() {
  return [];
};
Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
};

const GUITAR_TUNING = 'E2 A2 D3 G3 B3 E4';
const UKULELE_TUNING = 'G4 C4 E4 A4';
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

// A purpose-written song: optional `- key: value` properties, a chord-only
// chart, optional voicing lines after the `---` rule.
const song = ({ title = 'Tarde Clara', props = [], chart = 'G | C | Am | Em', voicings = [] }) =>
  [
    `# ${title}`,
    '',
    ...(props.length ? [...props.map((p) => `- ${p}`), ''] : []),
    '## Primeira Parte',
    FENCE,
    chart,
    FENCE,
    ...(voicings.length ? ['', '---', '', ...voicings] : []),
  ].join('\n') + '\n';

// The open-position shapes `openPosition` chooses for G C Am Em — so a song voiced
// with exactly these has nothing the planner would change.
const OPEN_BLOCK = [
  `## Voicings: ${GUITAR_TUNING}`,
  '- G: 320003',
  '- C: x32010',
  '- Am: x02210',
  '- Em: 022000',
];

function guitarEntry() {
  const inst = instrumentInstance({ catalogId: '6guitar', strings: GUITAR_TUNING, fretCount: 22 });
  return {
    id: 'g1',
    catalogId: '6guitar',
    label: 'Guitar',
    tuning: GUITAR_TUNING,
    fretCount: 22,
    config: configFor(inst, 'strumming'),
    shapes: [],
  };
}

function ukuleleEntry() {
  const inst = instrumentInstance({ catalogId: 'ukulele', strings: UKULELE_TUNING, fretCount: 15 });
  return {
    id: 'u1',
    catalogId: 'ukulele',
    label: 'Ukulele',
    tuning: UKULELE_TUNING,
    fretCount: 15,
    config: configFor(inst, 'strumming'),
    shapes: [],
  };
}

// The loopback-backed stub Worker: seeds the slices on
// OPEN, answers the reads, records every command, and re-surfaces SONG on
// SET_VARIATION. WRITE is silent (durability only) — recorded, no event.
function makeStore({ text, entry, variations = {}, notation = null }) {
  const commands = [];
  const state = { variations: { ...variations } };
  const prefs = { instrumentInUse: register(entry.id), ...(notation ? { notation } : {}) };
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

function renderWizard(store, props = {}) {
  return render(
    <ThemeRoot store={store}>
      <SongWizard store={store} bookId={BOOK} path={PATH} mode="narrow" {...props} />
    </ThemeRoot>,
  );
}

async function openWizard(store, props) {
  const utils = renderWizard(store, props);
  act(() => store.open());
  await waitFor(() => expect(screen.getByRole('group', { name: 'Choose a policy' })).toBeInTheDocument());
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
const blockOf = (text, label = '') => parse(text).blocks.find((b) => (b.label ?? '') === label);
const fretsOf = (block, key) => block.voicings.find((v) => v.key === key)?.frets;

// Reach the preview: choose a policy, then "See the plan".
async function toPreview(policyName = 'Down at the nut') {
  await click(screen.getByRole('button', { name: policyName }));
  await click(screen.getByRole('button', { name: 'See the plan' }));
}

describe('SongWizard — step one, the policy list', () => {
  it('shows every policy for the instrument, how-it-works and citations; axe clean', async () => {
    const { store } = makeStore({ text: song({}), entry: guitarEntry() });
    const { container } = await openWizard(store);

    // On guitar, all three policies (choro needs ≥5 strings).
    expect(screen.getByRole('button', { name: 'The smoothest path' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Down at the nut' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choro, beside a seven-string' })).toBeInTheDocument();

    // How it works is a disclosure per policy; choro's cited works resolve from
    // SOURCES, and the heuristics (the smoothest path, down at the nut) say they
    // are a rule of thumb about hands with no source.
    const hows = screen.getAllByRole('button', { name: 'How it works' });
    expect(hows).toHaveLength(3);
    await click(hows[2]); // choroCentro
    expect(hows[2]).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getAllByText(/Campos Ramos/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rule of thumb about hands/).length).toBeGreaterThan(0);

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('omits Choro on a four-string instrument', async () => {
    const { store } = makeStore({ text: song({}), entry: ukuleleEntry() });
    await openWizard(store);

    expect(screen.getByRole('button', { name: 'The smoothest path' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Down at the nut' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Choro, beside a seven-string' })).not.toBeInTheDocument();
  });
});

describe('SongWizard — step two, the preview (written to nothing)', () => {
  it('shows the diagrams, the would-change summary and a chord it could not voice; writes nothing', async () => {
    // C/F# has an F# bass that is not a chord tone of C, which choro cannot place.
    const { store, commands } = makeStore({
      text: song({ chart: 'C/F# | G | C | Am' }),
      entry: guitarEntry(),
    });
    const { container } = await openWizard(store);

    await toPreview('Choro, beside a seven-string');

    // The plan previews as diagrams (role=img), a "would change" line, and names
    // the chord it could not voice.
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
    expect(screen.getByText(/would change\./)).toBeInTheDocument();
    expect(screen.getByText(/No shape for .*C\/F#/)).toBeInTheDocument();

    // Nothing is persisted at the preview step.
    expect(lastCommand(commands, CommandKind.WRITE)).toBeUndefined();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('when the plan changes nothing, says so and offers nothing to write (songs.wizard_review)', async () => {
    const { store, commands } = makeStore({
      text: song({ voicings: OPEN_BLOCK }),
      entry: guitarEntry(),
    });
    const { container } = await openWizard(store);

    await toPreview('Down at the nut');

    expect(screen.getByText(/^Every chord already has the shape this would choose, so there is nothing to write\./)).toBeInTheDocument();
    // No where-to-put-it question, no Write the plan: only the way back.
    expect(screen.queryByRole('radiogroup', { name: 'Where to put the plan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Write the plan' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    // Every shape is the song's already: each reads *as now*.
    const words = [...container.querySelectorAll('.wizard-preview .chord-diagram__who')].map((w) => w.textContent);
    expect(words).toEqual(['as now', 'as now', 'as now', 'as now']);
    expect(lastCommand(commands, CommandKind.WRITE)).toBeUndefined();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('names every shape it previews, marks which ones change, and counts chords, not the places they are played (songs.wizard_review)', async () => {
    // G is played three times: the count is of the four chords.
    const { store } = makeStore({
      text: song({ chart: 'G | C | G | Am | G | Em', voicings: OPEN_BLOCK }),
      entry: guitarEntry(),
    });
    const { container } = await openWizard(store);
    await toPreview('Choro, beside a seven-string');

    const diagrams = [...container.querySelectorAll('.wizard-preview .chord-diagram')];
    const names = diagrams.map((d) => d.querySelector('.chord-diagram__chord')?.textContent);
    expect(names).toEqual(['G', 'C', 'Am', 'Em']);
    // The choro shapes are inversions: what each sounds is named beside it.
    const sounded = diagrams.map((d) => d.querySelector('.chord-diagram__sounded')?.textContent ?? null);
    expect(sounded.some((name) => name && name.includes('/'))).toBe(true);
    const words = diagrams.map((d) => d.querySelector('.chord-diagram__who')?.textContent);
    const changing = words.filter((w) => w === 'new shape').length;
    expect(changing).toBeGreaterThan(0);
    expect(words.every((w) => w === 'new shape' || w === 'as now')).toBe(true);
    expect(screen.getByText(`${changing} of 4 chords would change.`)).toBeInTheDocument();
  });
});

describe('SongWizard — into a new variation first', () => {
  it('offers new (selected) and over when the in-use variation has choices, and writes the plan into the named block', async () => {
    const { store, commands } = makeStore({
      text: song({ voicings: OPEN_BLOCK }),
      entry: guitarEntry(),
    });
    const { container } = await openWizard(store);

    await toPreview('The smoothest path');

    // Into a new variation is first and selected; over this one second.
    const newVar = screen.getByRole('radio', { name: /Into a new variation/ });
    const over = screen.getByRole('radio', { name: /Replace “Default”/ });
    expect(newVar).toBeChecked();
    expect(over).not.toBeChecked();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // Name it and write.
    const name = screen.getByRole('textbox', { name: 'Name for this variation' });
    fireEvent.change(name, { target: { value: 'Up the neck' } });
    await click(screen.getByRole('button', { name: 'Write the plan' }));

    const write = lastCommand(commands, CommandKind.WRITE);
    expect(write).toBeTruthy();
    const text = write.payload.text;
    // The plan is under the new block; the default is untouched.
    expect(fretsOf(blockOf(text, 'Up the neck'), 'C')).toEqual(['x', 3, 2, 0, 5, 3]);
    expect(fretsOf(blockOf(text, ''), 'C')).toEqual(['x', 3, 2, 0, 1, 0]);
    // The personal register switches into the new block.
    expect(lastCommand(commands, CommandKind.SET_VARIATION).payload.variation).toBe('Up the neck');
  });

  it('refuses a name already in use inline and writes nothing', async () => {
    const { store, commands } = makeStore({
      text: song({ voicings: [...OPEN_BLOCK, '', `## Up the neck: ${GUITAR_TUNING}`, '- G: 355433'] }),
      entry: guitarEntry(),
    });
    await openWizard(store);

    await toPreview('The smoothest path');
    const name = screen.getByRole('textbox', { name: 'Name for this variation' });
    fireEvent.change(name, { target: { value: 'Up the neck' } });
    await click(screen.getByRole('button', { name: 'Write the plan' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/already a variation called/);
    expect(lastCommand(commands, CommandKind.WRITE)).toBeUndefined();
  });
});

// The computer split (songs.arrange_polish Decision 6-8; W05#4 L164-231): at
// ARRANGE_WIDE_QUERY the wizard sits in a 380px side pane beside a main pane
// whose chart previews the plan; below it the full-screen
// layout stays. The step back reads **Back** in both. Pins the workflow 5 delta
// lines 91-93 and W05#4.
describe('SongWizard — the computer split', () => {
  const sidePane = (container) => container.querySelector('.pane.side');
  const mainPane = (container) => container.querySelector('.pane.main');

  it('on a computer: the plan step and its actions in the side pane, the preview chart beside it; ✕ is the one way out, with no WRITE; axe clean', async () => {
    installWidths('computer');
    const onBack = vi.fn();
    const { store, commands } = makeStore({ text: song({ voicings: OPEN_BLOCK }), entry: guitarEntry() });
    const { container } = await openWizard(store, { mode: 'wide', onBack });
    expect(sidePane(container)).toBeTruthy();
    const side = within(sidePane(container));
    const main = within(mainPane(container));

    // The policy step: the main pane shows the chart with the variation's
    // current shapes.
    expect(side.getByRole('group', { name: 'Choose a policy' })).toBeInTheDocument();
    expect(side.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(side.getByText('Voicing wizard')).toBeInTheDocument();
    expect(main.getByRole('group', { name: 'Tarde Clara' })).toBeInTheDocument();
    expect(main.getByRole('heading', { name: 'Shapes · Default' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    await toPreview('The smoothest path');
    expect(side.getByRole('radiogroup', { name: 'Where to put the plan' })).toBeInTheDocument();
    expect(side.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(side.getByRole('button', { name: 'Write the plan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Other ways/ })).toBeNull();

    expect(main.getByText('Tarde Clara')).toBeInTheDocument();
    expect(main.getByText('Arranging · Guitar')).toBeInTheDocument();
    // A mention, not a switch: no instrument chip button in the wizard.
    expect(screen.queryByRole('button', { name: /change instrument/ })).toBeNull();
    // No second way out beside ✕ (songs.wizard_review).
    expect(main.queryByRole('button', { name: 'Done' })).toBeNull();
    expect(main.getByText('Preview of the plan')).toBeInTheDocument();
    expect(main.getByRole('group', { name: 'Tarde Clara' })).toBeInTheDocument();
    fireEvent.change(side.getByRole('textbox', { name: 'Name for this variation' }), {
      target: { value: 'Up the neck' },
    });
    const column = main.getByRole('region', { name: 'Shapes · Up the neck' });
    expect(column.querySelectorAll('.chord-diagram').length).toBeGreaterThan(0);
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // Back (not Other ways) returns to the policy step.
    await click(side.getByRole('button', { name: 'Back' }));
    expect(side.getByRole('group', { name: 'Choose a policy' })).toBeInTheDocument();

    // ✕ closes the wizard; nothing is written.
    await click(side.getByRole('button', { name: 'Cancel' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(lastCommand(commands, CommandKind.WRITE)).toBeUndefined();
  }, 20000);

  it('at 700px (the tablet) the existing full-screen layout stays, and Back returns to the policy step; axe clean', async () => {
    installWidths('tablet');
    const { store } = makeStore({ text: song({ voicings: OPEN_BLOCK }), entry: guitarEntry() });
    const { container } = await openWizard(store, { mode: 'wide' });
    expect(sidePane(container)).toBeNull();
    expect(container.querySelector('.wizard-wide')).toBeTruthy();

    await toPreview('The smoothest path');
    expect(screen.queryByText('Preview of the plan')).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    await click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('group', { name: 'Choose a policy' })).toBeInTheDocument();
  }, 20000);
});

describe('SongWizard — over this one, and the no-choices shortcut', () => {
  it('writes the plan into the in-use variation when over this one is chosen', async () => {
    const { store, commands } = makeStore({
      text: song({ voicings: OPEN_BLOCK }),
      entry: guitarEntry(),
    });
    await openWizard(store);

    await toPreview('The smoothest path');
    await click(screen.getByRole('radio', { name: /Replace “Default”/ }));
    await click(screen.getByRole('button', { name: 'Write the plan' }));

    const write = lastCommand(commands, CommandKind.WRITE);
    expect(fretsOf(blockOf(write.payload.text, ''), 'C')).toEqual(['x', 3, 2, 0, 5, 3]);
    // Over this one stays in the default variation — no register switch.
    expect(lastCommand(commands, CommandKind.SET_VARIATION)).toBeUndefined();
  });

  it('writes straight in with no new/over question when the in-use variation has no choices', async () => {
    const { store, commands } = makeStore({
      text: song({}), // no voicings block
      entry: guitarEntry(),
    });
    await openWizard(store);

    await toPreview('Down at the nut');
    // No new/over question is offered.
    expect(screen.queryByRole('radio', { name: /Into a new variation/ })).not.toBeInTheDocument();

    await click(screen.getByRole('button', { name: 'Write the plan' }));
    const write = lastCommand(commands, CommandKind.WRITE);
    expect(fretsOf(blockOf(write.payload.text, ''), 'C')).toEqual(['x', 3, 2, 0, 1, 0]);
  });
});

// A minimal harness mirroring AppShell's wiring: the editor's preview opens the
// wizard over the editor, and closing it re-mounts the editor with focus sent
// back to the Run-the-wizard button (songs.wizard_ui Decision 1;
// songs.arrange_in_editor; the AppShell focus return).
function Harness({ store }) {
  const [wizard, setWizard] = useState(null);
  const [ret, setRet] = useState(false);
  if (wizard) {
    return (
      <SongWizard
        store={store}
        bookId={BOOK}
        path={PATH}
        mode="narrow"
        onBack={() => {
          setWizard(null);
          setRet(true);
        }}
      />
    );
  }
  return (
    <SongEditor
      store={store}
      bookId={BOOK}
      path={PATH}
      layoutMode="narrow"
      startOnPreview
      onRunWizard={(args) => setWizard(args)}
      autoFocusWizard={ret}
      onWizardFocusReturned={() => setRet(false)}
    />
  );
}

describe('SongWizard — a keyboard path, and focus back to the editor', () => {
  it('runs open → policy → stylistic question → preview → new → write by keyboard, returning focus to Run the wizard', async () => {
    const { store, commands } = makeStore({
      text: song({ voicings: OPEN_BLOCK }),
      entry: guitarEntry(),
    });
    render(
      <ThemeRoot store={store}>
        <Harness store={store} />
      </ThemeRoot>,
    );
    act(() => store.open());
    const runBtn = await screen.findByRole('button', { name: 'Run the wizard' });
    await waitFor(() => expect(runBtn).not.toBeDisabled());

    // Open the wizard from the editor's preview with the keyboard.
    runBtn.focus();
    expect(runBtn).toHaveFocus();
    await pressKey(runBtn, 'Enter');
    await waitFor(() => expect(screen.getByRole('group', { name: 'Choose a policy' })).toBeInTheDocument());

    // Choose choro by keyboard; its stylistic radiogroup appears in the focus
    // path (one radio holds the roving tabindex, the others are reachable).
    const choro = screen.getByRole('button', { name: 'Choro, beside a seven-string' });
    choro.focus();
    await pressKey(choro, 'Enter');
    const stylistic = screen.getByRole('radiogroup', {
      name: 'Where no third above the other guitar is in the chord',
    });
    const thirdBelow = within(stylistic).getByRole('radio', { name: /A third below/ });
    thirdBelow.focus();
    expect(thirdBelow).toHaveFocus();

    // Reach the preview.
    const see = screen.getByRole('button', { name: 'See the plan' });
    see.focus();
    await pressKey(see, 'Enter');

    // Into a new variation is selected by default; type a name and write.
    expect(screen.getByRole('radio', { name: /Into a new variation/ })).toBeChecked();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name for this variation' }), {
      target: { value: 'Up the neck' },
    });
    const writeBtn = screen.getByRole('button', { name: 'Write the plan' });
    writeBtn.focus();
    await pressKey(writeBtn, 'Enter');

    // The plan was written, and focus is back on the editor's Run-the-wizard button.
    expect(lastCommand(commands, CommandKind.WRITE)).toBeTruthy();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Run the wizard' })).toHaveFocus());
  });
});

describe("SongWizard — the song's own notation (workflow 5 §The wizard; cifra.md §5.6)", () => {
  it("offers an american song's C7+ the sharp-fifth shapes", async () => {
    // A brazilian user plans an american song: the planner reads C7+ as C7♯5
    // and C7(4) as C7add4 (analyseSong with the song's dialect); the preview
    // spells those chords in the user's notation.
    const { store, commands } = makeStore({
      text: song({ props: ['notation: american'], chart: 'C7+  C7(4)' }),
      entry: guitarEntry(),
      notation: register('brazilian'),
    });
    const { container } = await openWizard(store);
    await toPreview();

    const sharpFifth = formatChord(parseChord('C7+', 'american').chord, 'brazilian');
    const addedFourth = formatChord(parseChord('C7(4)', 'american').chord, 'brazilian');
    expect(sharpFifth).toBe('C7(5+)');
    expect(addedFourth).toBe('C7(add4)');

    const names = Array.from(container.querySelectorAll('.wizard-shapes [role="img"]')).map((el) =>
      el.getAttribute('aria-label'),
    );
    expect(names).toHaveLength(2);
    expect(names[0].startsWith(sharpFifth)).toBe(true);
    expect(names[1].startsWith(addedFourth)).toBe(true);
    // Not the brazilian readings (C7M, C7(4) as a suspended seventh).
    for (const n of names) {
      expect(n.startsWith('C7M')).toBe(false);
      expect(n.startsWith('C7(4)')).toBe(false);
    }
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // The plan writes voicings keyed by the symbols as written (cifra.md §8).
    await click(screen.getByRole('button', { name: 'Write the plan' }));
    const write = lastCommand(commands, CommandKind.WRITE);
    expect(write).toBeTruthy();
    const block = blockOf(write.payload.text);
    expect(block.voicings.map((v) => v.key).sort()).toEqual(['C7(4)', 'C7+']);
    expect(write.payload.text).toContain('- notation: american');
  });
});
