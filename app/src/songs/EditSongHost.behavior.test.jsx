// Behavior — editing an existing song, then Save (workflow 4 §A book the user
// cannot push to; books.fork Constraint 7). The host reads the shelf: in a
// reader's book Save opens the make-it-your-own offer, never the save form; in a
// book the user can save to it opens the form as before. Rendered inside
// ThemeRoot so the sheet portals into `.est`
// ([[rac-overlays-portal-outside-est-theme-root]]); the Worker's replies are
// emitted through a store double. Fixtures are purpose-written — never anyone's
// copyrighted words.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import EditSongHost from './EditSongHost.jsx';

// CodeMirror measures geometry jsdom lacks; stub it so the editor mounts
// ([[codemirror-jsdom-getclientrects]]; mirrors NewSong.behavior.test.jsx).
Range.prototype.getClientRects = function getClientRects() {
  return [];
};
Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
};

globalThis.matchMedia = (media) => ({
  media,
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});

afterEach(() => cleanup());

const AT = '2026-10-15T00:00:00.000Z';
const reg = (value) => ({ value, at: AT });
const PATH = 'tarde-clara.cifra.md';
const TEXT = '# Tarde Clara\n\n## A\n```\nC | G\n```\n';

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const commandsOf = (sent, kind) => sent.filter((c) => c.kind === kind);

function renderHost(store, bookId) {
  return render(
    <ThemeRoot store={store}>
      <EditSongHost
        store={store}
        editing={{ bookId, path: PATH, songTitle: 'Tarde Clara' }}
        mode="narrow"
        onBack={() => {}}
        onOpenHistory={() => {}}
        editorRef={{ current: null }}
      />
    </ThemeRoot>,
  );
}

const SHELF = event(EventKind.SHELF, {
  books: {
    'srv-r': { label: reg('Turma de Quarta'), position: reg(0), role: reg('reader') },
    'srv-e': { label: reg('Banda do Bairro'), position: reg(1), role: reg('editor') },
  },
  local: {},
});

describe('edit → Save (books.fork Constraint 7; workflow 4 §A book the user cannot push to)', () => {
  it('in a reader’s book opens the fork offer, not the save form; axe clean', async () => {
    const { store, sent, emit } = makeStore();
    renderHost(store, 'srv-r');
    emit(SHELF);
    emit(event(EventKind.SOURCE, { bookId: 'srv-r', path: PATH, text: TEXT }));

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));

    const dialog = screen.getByRole('dialog', {
      name: 'Turma de Quarta is someone else’s — make it your own?',
    });
    expect(within(dialog).getByRole('button', { name: 'Make it my own' })).toBeInTheDocument();
    // The form never mounted: no preview asked, no save sent.
    expect(commandsOf(sent, CommandKind.PREVIEW_SAVE)).toHaveLength(0);
    expect(commandsOf(sent, CommandKind.SAVE)).toHaveLength(0);
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('in a book the user can save to opens the ordinary save form', () => {
    const { store, sent, emit } = makeStore();
    renderHost(store, 'srv-e');
    emit(SHELF);
    emit(event(EventKind.SOURCE, { bookId: 'srv-e', path: PATH, text: TEXT }));

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));

    expect(screen.queryByRole('button', { name: 'Make it my own' })).toBeNull();
    expect(commandsOf(sent, CommandKind.PREVIEW_SAVE).at(-1).payload).toMatchObject({
      bookId: 'srv-e',
      paths: [PATH],
    });
  });
});
