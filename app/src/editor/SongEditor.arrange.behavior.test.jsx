// behavior (workflow 4 §Editing; workflow 5) — the editor's preview arranges:
// the arrange screen's tappable chart, picker and shapes over the live buffer,
// a choice landing in the buffer as one undoable change and persisted through
// the editor's own debounced WRITE. Real collaborators: CodeMirror, React Aria
// Components, i18n, the music core and `cifra-md`'s §8.5 ops and writer, over a
// loopback-backed store seeded with the slices the preview reads. Fixtures are
// songs written for the purpose.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, act, fireEvent, waitFor } from '@testing-library/react';
import { undo } from '@codemirror/commands';
import { parse } from 'cifra-md';
import { createLoopbackEndpoint } from '../test/loopback.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { instrumentInstance, configFor } from '../core/instrument.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import SongEditor from './SongEditor.jsx';

// CodeMirror's measure pass needs geometry jsdom lacks; a no-op stub keeps it
// quiet (real geometry is e2e's).
Range.prototype.getClientRects = function getClientRects() {
  return [];
};
Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
};

const GUITAR_TUNING = 'E2 A2 D3 G3 B3 E4';
const FENCE = '```';
const BOOK = 'local-example-book';
const PATH = 'tarde-clara.cifra.md';
const register = (value) => ({ value, at: '2026-01-01T00:00:00.000Z' });

const SONG = ['# Tarde Clara', '', '## Primeira Parte', FENCE, 'Cm | G | Cm | Fm', FENCE, ''].join('\n');

function installMatchMedia() {
  globalThis.matchMedia = (media) => ({ media, matches: false, addEventListener: () => {}, removeEventListener: () => {} });
}

beforeEach(() => {
  installMatchMedia();
  setLocale('en');
});
afterEach(() => {
  delete globalThis.matchMedia;
  vi.restoreAllMocks();
});

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

function makeStore(text) {
  const commands = [];
  const entry = guitarEntry();
  const endpoint = createLoopbackEndpoint((port) => ({
    handle(message) {
      commands.push(message);
      const p = message.payload ?? {};
      switch (message.kind) {
        case CommandKind.OPEN:
          port.postMessage(event(EventKind.PREFERENCES, { instrumentInUse: register(entry.id) }));
          port.postMessage(event(EventKind.INSTRUMENTS, { instruments: [entry], inUseId: entry.id, standard: entry }));
          break;
        case CommandKind.OPEN_SOURCE:
          port.postMessage(event(EventKind.SOURCE, { bookId: p.bookId, path: p.path, text }));
          break;
        case CommandKind.OPEN_SONG:
          port.postMessage(event(EventKind.SONG, { bookId: p.bookId, path: p.path, transposition: 0, variations: {} }));
          break;
        default:
          break;
      }
    },
  }));
  return { store: createStore(endpoint), commands };
}

const click = async (el) => {
  await act(async () => {
    fireEvent.click(el);
  });
};

async function openEditor(text) {
  const { store, commands } = makeStore(text);
  const editorRef = { current: null };
  const utils = render(
    <ThemeRoot store={store}>
      <SongEditor store={store} bookId={BOOK} path={PATH} layoutMode="wide" editorRef={editorRef} onSave={() => {}} />
    </ThemeRoot>,
  );
  act(() => store.open());
  await waitFor(() => expect(editorRef.current?.state.doc.toString()).toBe(text));
  const preview = utils.container.querySelector('.est-editor-preview');
  return { ...utils, store, commands, editorRef, preview };
}

// The picker draws a diagram per candidate and axe walks them all.
const AXE_OVER_PICKER = 20000;

describe('SongEditor — the preview arranges (workflow 4 §Editing)', () => {
  it('the preview shows the chart, then every chord’s diagram below it, with the instrument named', async () => {
    const { preview } = await openEditor(SONG);
    const shapes = await within(preview).findByRole('region', { name: 'Shapes' });
    const chart = preview.querySelector('.chart');
    // Below the chart, in the same flow.
    expect(chart.compareDocumentPosition(shapes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // One diagram per distinct chord: Cm, G, Fm.
    expect(shapes.querySelectorAll('.shapes > *')).toHaveLength(3);
    expect(within(preview).getByText('Tap a chord to choose its shape')).toBeInTheDocument();
    expect(within(preview).getByRole('button', { name: /Guitar/ })).toBeInTheDocument();
  });

  it('a chord opens the picker; choosing puts the voicing into the buffer, one undo takes it back, and the editor WRITEs it', async () => {
    const { container, commands, editorRef, preview } = await openEditor(SONG);
    await click((await within(preview).findAllByRole('button', { name: 'C minor' }))[0]);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    await click(screen.getAllByRole('button', { name: /^Choose Cm,/ })[0]);

    const after = editorRef.current.state.doc.toString();
    const block = parse(after).blocks.find((b) => (b.label ?? '') === '');
    expect(block.voicings.some((v) => v.symbol === 'Cm')).toBe(true);
    // The picker closed, the diagrams follow the buffer: Cm is the song's now.
    expect(screen.queryByRole('dialog')).toBeNull();

    // The editor's own debounced WRITE carries it to the working copy.
    await waitFor(
      () => expect(commands.filter((c) => c.kind === CommandKind.WRITE).at(-1)?.payload.text).toBe(after),
      { timeout: 2000 },
    );

    act(() => {
      undo(editorRef.current);
    });
    expect(editorRef.current.state.doc.toString()).toBe(SONG);
  }, AXE_OVER_PICKER);

  it('while a line stops the save, the chart reads but takes no taps, and says why', async () => {
    // A voicing line the reader cannot read (§7) is a save blocker; `write`
    // could drop it, so the preview does not write.
    const BLOCKED = SONG + '\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n\n- Cm: not-a-shape\n';
    const { preview } = await openEditor(BLOCKED);
    await waitFor(() =>
      expect(within(preview).getByText('Fix the lines marked in the text to choose shapes here.')).toBeInTheDocument(),
    );
    expect(within(preview.querySelector('.chart')).queryAllByRole('button')).toHaveLength(0);
    expect(within(preview).getByRole('button', { name: 'Choose these for every unchosen chord' })).toBeDisabled();
  });
});
