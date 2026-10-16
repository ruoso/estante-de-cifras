// Behavior — editing an existing song, then Save (workflow 4 §A book the user
// cannot push to; books.fork Constraint 7). The host reads the shelf: in a
// reader's book Save opens the make-it-your-own offer, never the save form; in a
// book the user can save to it opens the form as before. Rendered inside
// ThemeRoot so the sheet portals into `.est`
// ([[rac-overlays-portal-outside-est-theme-root]]); the Worker's replies are
// emitted through a store double. Fixtures are purpose-written — never anyone's
// copyrighted words.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within, waitFor } from '@testing-library/react';
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

function renderHost(store, bookId, editorRef = { current: null }, mode = 'narrow') {
  return render(
    <ThemeRoot store={store}>
      <EditSongHost
        store={store}
        editing={{ bookId, path: PATH, songTitle: 'Tarde Clara' }}
        mode={mode}
        onBack={() => {}}
        onOpenHistory={() => {}}
        editorRef={editorRef}
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

describe('edit → Discard (workflow 4 §Discarding)', () => {
  const CODA = '\n## Coda\n```\nG | C\n```\n';
  const EDITED = TEXT + CODA;
  // The section-added record the Worker's preview reports for that edit.
  const ADDED = { kind: 'section', op: 'added', where: { section: 'Coda' }, before: null, after: 'Coda' };

  async function editThenDiscard() {
    const env = makeStore();
    const editorRef = { current: null };
    renderHost(env.store, 'srv-e', editorRef);
    env.emit(SHELF);
    env.emit(event(EventKind.SOURCE, { bookId: 'srv-e', path: PATH, text: TEXT }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(TEXT));
    // An edit, then the appbar's Discard at once — inside the write debounce.
    act(() => editorRef.current.dispatch({ changes: { from: TEXT.length, insert: CODA } }));
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Discard changes' })));
    return { ...env, editorRef };
  }

  it('Discard right after an edit previews the edit', async () => {
    const { sent, emit } = await editThenDiscard();

    // The edit reaches the Worker before the confirm asks for its preview.
    const kinds = sent.map((c) => c.kind);
    const write = kinds.lastIndexOf(CommandKind.WRITE);
    const previewAt = kinds.indexOf(CommandKind.PREVIEW_SAVE);
    expect(write).toBeGreaterThanOrEqual(0);
    expect(sent[write].payload).toMatchObject({ bookId: 'srv-e', path: PATH, text: EDITED });
    expect(write).toBeLessThan(previewAt);
    expect(sent[previewAt].payload).toMatchObject({ bookId: 'srv-e', paths: [PATH] });

    emit(
      event(EventKind.SAVE_PREVIEW, {
        bookId: 'srv-e',
        previews: [{ path: PATH, title: 'Tarde Clara', changes: [ADDED], summary: 'Coda: section added', isNew: false }],
      }),
    );

    // What would be lost lists the edit — the same rows the save sheet shows.
    const dialog = screen.getByRole('dialog', { name: 'Discard changes to Tarde Clara?' });
    expect(within(dialog).getByText(/This would be lost/)).toBeInTheDocument();
    expect(within(dialog).getByText('Coda')).toBeInTheDocument();
    expect(within(dialog).getByText('section added')).toBeInTheDocument();
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('a confirmed discard writes nothing back', async () => {
    const { sent, emit } = await editThenDiscard();
    const dialog = screen.getByRole('dialog', { name: 'Discard changes to Tarde Clara?' });
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' })));
    const discardAt = sent.findIndex((c) => c.kind === CommandKind.DISCARD);
    expect(sent[discardAt].payload).toMatchObject({ bookId: 'srv-e', paths: [PATH] });

    const opensBefore = commandsOf(sent, CommandKind.OPEN_SOURCE).length;
    emit(event(EventKind.DISCARDED, { bookId: 'srv-e', paths: [PATH] }));
    // The editor remounted to re-read the reverted text.
    expect(commandsOf(sent, CommandKind.OPEN_SOURCE).length).toBe(opensBefore + 1);

    // Past the editor's 400 ms write debounce: no WRITE after the DISCARD.
    await act(() => new Promise((resolve) => setTimeout(resolve, 500)));
    expect(sent.slice(discardAt + 1).filter((c) => c.kind === CommandKind.WRITE)).toEqual([]);
  });
});

describe('the edit host’s unsaved changes mark', () => {
  const CODA = '\n## Coda\n```\nG | C\n```\n';

  // `wide` is the tablet/computer host (the mark in the app bar); `narrow` the
  // phone's (the mark in a strip directly under the app bar, W04 L35-36).
  for (const mode of ['wide', 'narrow']) {
    it(`the app bar carries the unsaved changes mark while the text is unsaved (sync.in_place_notices; W08#3 L96, W04 L107/L158) — ${mode}`, async () => {
      const { store, emit, sent } = makeStore();
      const editorRef = { current: null };
      const { container } = renderHost(store, 'srv-e', editorRef, mode);
      emit(SHELF);
      emit(event(EventKind.SOURCE, { bookId: 'srv-e', path: PATH, text: TEXT, unsaved: false }));
      await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(TEXT));

      // Opened in step: no mark.
      expect(screen.queryByText('unsaved changes')).toBeNull();

      // A typed change: the word mark shows, where this device draws it.
      act(() => editorRef.current.dispatch({ changes: { from: TEXT.length, insert: CODA } }));
      const mark = await screen.findByText('unsaved changes');
      expect(mark).toHaveClass('badge', 'unsaved', 'dot');
      const appbar = container.querySelector('.appbar');
      if (mode === 'wide') {
        expect(appbar).toContainElement(mark);
      } else {
        expect(appbar).not.toContainElement(mark);
        expect(mark.closest('.edit-song-unsaved-strip')).not.toBeNull();
        // The strip sits directly under the app bar.
        expect(appbar.nextElementSibling).toBe(mark.closest('.edit-song-unsaved-strip'));
      }
      expect(await checkWcag21aa(container)).toHaveNoViolations();

      // Discard: the editor remounts, and the fresh SOURCE reads in step.
      act(() => fireEvent.click(screen.getByRole('button', { name: 'Discard changes' })));
      const dialog = screen.getByRole('dialog', { name: 'Discard changes to Tarde Clara?' });
      act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' })));
      const opensBefore = commandsOf(sent, CommandKind.OPEN_SOURCE).length;
      emit(event(EventKind.DISCARDED, { bookId: 'srv-e', paths: [PATH] }));
      expect(commandsOf(sent, CommandKind.OPEN_SOURCE).length).toBe(opensBefore + 1);
      emit(event(EventKind.SOURCE, { bookId: 'srv-e', path: PATH, text: TEXT, unsaved: false }));
      await waitFor(() => expect(screen.queryByText('unsaved changes')).toBeNull());
    });
  }
});
