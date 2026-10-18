// Behavior — editing an existing song, then Save (workflow 4 §A book the user
// cannot push to; books.fork Constraint 7). The host reads the shelf: in a
// reader's book Save opens the make-it-your-own offer, never the save form; in a
// book the user can save to it opens the form as before. Rendered inside
// ThemeRoot so the sheet portals into `.est`
// ([[rac-overlays-portal-outside-est-theme-root]]); the Worker's replies are
// emitted through a store double. Fixtures are purpose-written — never anyone's
// copyrighted words.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within, waitFor } from '@testing-library/react';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { checkWcag21aa } from '../a11y/axe.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import EditSongHost from './EditSongHost.jsx';
import { installWidths } from '../test/widths.js';

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

function renderHost(
  store,
  bookId,
  editorRef = { current: null },
  mode = 'narrow',
  { songTitle = 'Tarde Clara', onEdit = () => {} } = {},
) {
  return render(
    <ThemeRoot store={store}>
      <EditSongHost
        store={store}
        editing={{ bookId, path: PATH, songTitle }}
        mode={mode}
        onBack={() => {}}
        onOpenHistory={() => {}}
        onEdit={onEdit}
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

describe('the editor chrome as drawn (songs.editor_chrome; W04 board; workflow 4 §Editing, §Saving)', () => {
  const CODA = '\n## Coda\n```\nG | C\n```\n';
  afterEach(() => {
    // Back to the file's own pin: no width line matches.
    installWidths('phone');
  });

  // Mount on a saved song and wait for its text in the buffer.
  async function openSong({ mode, songTitle, onEdit, text = TEXT } = {}) {
    const env = makeStore();
    const editorRef = { current: null };
    const utils = renderHost(env.store, 'srv-e', editorRef, mode, { songTitle, onEdit });
    env.emit(SHELF);
    env.emit(event(EventKind.SOURCE, { bookId: 'srv-e', path: PATH, text, unsaved: false }));
    await waitFor(() => expect(editorRef.current.state.doc.toString()).toBe(text));
    return { ...env, ...utils, editorRef };
  }
  const appbarOf = (container) => container.querySelector('.appbar');
  const edit = (editorRef, insert = CODA) =>
    act(() =>
      editorRef.current.dispatch({ changes: { from: editorRef.current.state.doc.length, insert } }),
    );
  // Replace the first line (the `#` heading) of the buffer.
  const setHeading = (editorRef, line) =>
    act(() => {
      const first = editorRef.current.state.doc.line(1);
      editorRef.current.dispatch({ changes: { from: first.from, to: first.to, insert: line } });
    });

  it('phone: Save in the header, the unsaved strip, Discard below (W04#1 L28-52, W04#2 L75-94)', async () => {
    installWidths('phone');
    const { container, editorRef, emit } = await openSong({ mode: 'narrow' });
    const appbar = appbarOf(container);
    expect(within(appbar).getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(within(appbar).getByText('Tarde Clara')).toBeInTheDocument();
    expect(within(appbar).getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(within(appbar).queryByRole('button', { name: 'Discard changes' })).toBeNull();
    // Opened in step: no strip.
    expect(screen.queryByRole('status')).toBeNull();

    edit(editorRef);
    const strip = await screen.findByRole('status');
    expect(strip).toHaveTextContent('unsaved changes');
    expect(strip).toHaveTextContent('Kept on this device');
    expect(within(strip).getByText('unsaved changes')).toHaveClass('badge', 'unsaved', 'dot');
    expect(appbar).not.toHaveTextContent('unsaved changes');
    // The strip sits directly under the app bar.
    expect(appbar.nextElementSibling).toBe(strip);

    // The bottom bar: Add section and Discard changes; the editor's own bar
    // holds only Text | Preview.
    const bottom = container.querySelector('.editor-chrome-bottom');
    expect(within(bottom).getByRole('button', { name: 'Add section' })).toBeInTheDocument();
    expect(within(bottom).getByRole('button', { name: 'Discard changes' })).toBeInTheDocument();
    const bar = container.querySelector('.est-editor-bar');
    expect(within(bar).queryByRole('button', { name: 'Add section' })).toBeNull();
    expect(within(bar).queryByRole('button', { name: 'Save' })).toBeNull();
    // The bottom bar's Add section is the editor's.
    act(() => fireEvent.click(within(bottom).getByRole('button', { name: 'Add section' })));
    expect(editorRef.current.state.doc.toString()).toMatch(/## \n```\n\n```\n?$/);
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // Save opens the bottom sheet.
    act(() => fireEvent.click(within(appbar).getByRole('button', { name: 'Save' })));
    const dialog = screen.getByRole('dialog');
    expect(dialog.closest('.sheet')).not.toBeNull();
    expect(dialog.closest('.sheet').querySelector('.grip')).not.toBeNull();
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();

    // Saved: the strip goes.
    emit(event(EventKind.SAVED, { bookId: 'srv-e', paths: [PATH] }));
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('phone: a discard takes the strip away', async () => {
    installWidths('phone');
    const { editorRef, emit, sent } = await openSong({ mode: 'narrow' });
    edit(editorRef);
    await screen.findByRole('status');
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Discard changes' })));
    const dialog = screen.getByRole('dialog', { name: 'Discard changes to Tarde Clara?' });
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Discard changes' })));
    const opensBefore = commandsOf(sent, CommandKind.OPEN_SOURCE).length;
    emit(event(EventKind.DISCARDED, { bookId: 'srv-e', paths: [PATH] }));
    expect(commandsOf(sent, CommandKind.OPEN_SOURCE).length).toBe(opensBefore + 1);
    emit(event(EventKind.SOURCE, { bookId: 'srv-e', path: PATH, text: TEXT, unsaved: false }));
    await waitFor(() => expect(screen.queryByText('unsaved changes')).toBeNull());
  });

  it('the title follows the heading (the .tji note; workflow 4 §Editing)', async () => {
    installWidths('phone');
    const { container, editorRef } = await openSong({ mode: 'narrow', songTitle: 'Tarde Antiga' });
    const title = () => appbarOf(container).querySelector('.title');
    // The text's heading, not the stale title the host was opened with.
    await waitFor(() => expect(title()).toHaveTextContent('Tarde Clara'));

    setHeading(editorRef, '# Tarde Clara Nova');
    await waitFor(() => expect(title()).toHaveTextContent('Tarde Clara Nova'));
    act(() => fireEvent.click(within(appbarOf(container)).getByRole('button', { name: 'Save' })));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Save Tarde Clara Nova' })).toBeInTheDocument();
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' })));

    // No heading: the host's own title again.
    setHeading(editorRef, '');
    await waitFor(() => expect(title()).toHaveTextContent('Tarde Antiga'));
  });

  it('tablet: everything in the header, the save a centred dialog (W04#3 L104-110)', async () => {
    installWidths('tablet');
    const { container, editorRef } = await openSong({ mode: 'wide' });
    edit(editorRef);
    const appbar = appbarOf(container);
    await waitFor(() => expect(appbar).toHaveTextContent('unsaved changes'));
    const kids = [...appbar.children];
    const at = (pred) => kids.findIndex(pred);
    const titleAt = at((el) => el.classList.contains('title'));
    const markAt = at((el) => el.textContent === 'unsaved changes');
    const discardAt = at((el) => el.textContent === 'Discard changes');
    const saveAt = at((el) => el.textContent === 'Save');
    // Back · title · unsaved changes · Discard changes · Save, in that order.
    expect(titleAt).toBe(1);
    expect(markAt).toBe(titleAt + 1);
    expect(discardAt).toBe(markAt + 1);
    expect(saveAt).toBe(discardAt + 1);
    // No strip and no bottom bar on a tablet.
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.querySelector('.editor-chrome-bottom')).toBeNull();
    // The editor's bar keeps Add section and draws no Save of its own.
    const bar = container.querySelector('.est-editor-bar');
    expect(within(bar).getByRole('button', { name: 'Add section' })).toBeInTheDocument();
    expect(within(bar).queryByRole('button', { name: 'Save' })).toBeNull();
    // The preview beside the text.
    expect(screen.getByRole('region', { name: 'Preview' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    act(() => fireEvent.click(within(appbar).getByRole('button', { name: 'Save' })));
    const dialog = screen.getByRole('dialog');
    expect(dialog.closest('.dialog')).not.toBeNull();
    expect(dialog.closest('.scrim.center')).not.toBeNull();
    expect(dialog.closest('.sheet')).toBeNull();
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('computer: the Unsaved pane and the save panel (W04#4 L162-207; workflow 4 §Saving)', async () => {
    installWidths('computer');
    const onEdit = vi.fn();
    const { container, editorRef, emit, sent } = await openSong({ mode: 'wide', onEdit });
    emit(
      event(EventKind.SHELF, {
        books: {
          'srv-e': { label: reg('Banda do Bairro'), position: reg(0), role: reg('editor') },
          'srv-c': { label: reg('Choros da Lia'), position: reg(1), role: reg('editor') },
        },
        local: {},
      }),
    );
    emit(event(EventKind.PREFERENCES, { authorName: { value: 'Marina', at: AT } }));
    emit(
      event(EventKind.BROWSE_RESULTS, {
        books: [
          { bookId: 'srv-e', count: 1, songs: [{ path: PATH, title: 'Tarde Clara', artist: '', unsaved: false }] },
          {
            bookId: 'srv-c',
            count: 1,
            songs: [{ path: 'choro/lua-de-vidro.cifra.md', title: 'Lua de Vidro', artist: '', unsaved: true }],
          },
        ],
      }),
    );
    // The pane asked for the browse itself.
    expect(commandsOf(sent, CommandKind.BROWSE).length).toBeGreaterThan(0);
    edit(editorRef);

    // The Unsaved list: the current song first and selected, the other below.
    const pane = screen.getByRole('region', { name: 'Unsaved' });
    const rows = within(pane).getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Tarde Clara');
    expect(rows[0]).toHaveAttribute('aria-selected', 'true');
    expect(rows[1]).toHaveTextContent('Lua de Vidro');
    expect(rows[1]).toHaveTextContent('Choros da Lia · choro/');
    expect(rows[1]).toHaveTextContent('unsaved');
    expect(screen.getByRole('region', { name: 'Preview' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // Choosing the other song opens it through the host's onEdit.
    act(() => fireEvent.click(rows[1]));
    expect(onEdit).toHaveBeenCalledWith({
      bookId: 'srv-c',
      path: 'choro/lua-de-vidro.cifra.md',
      title: 'Lua de Vidro',
    });

    // Save opens the panel beside the song: a region, not a dialog, focus on
    // its heading; the editor stays, the preview goes.
    const headerSave = within(appbarOf(container)).getByRole('button', { name: 'Save' });
    act(() => fireEvent.click(headerSave));
    const panel = screen.getByRole('region', { name: 'Save Tarde Clara' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(within(panel).getByRole('heading', { name: 'Save Tarde Clara' }));
    expect(screen.queryByRole('region', { name: 'Preview' })).toBeNull();
    expect(editorRef.current.contentDOM.closest('[hidden]')).toBeNull();
    expect(editorRef.current.contentDOM).toHaveAttribute('contenteditable', 'true');

    // Escape in the panel closes it, and focus returns to the header's Save.
    act(() => fireEvent.keyDown(within(panel).getByRole('heading'), { key: 'Escape' }));
    expect(screen.queryByRole('region', { name: 'Save Tarde Clara' })).toBeNull();
    expect(document.activeElement).toBe(headerSave);

    act(() => fireEvent.click(headerSave));
    const reopened = screen.getByRole('region', { name: 'Save Tarde Clara' });
    const preview = (summary) =>
      emit(
        event(EventKind.SAVE_PREVIEW, {
          bookId: 'srv-e',
          previews: [{ path: PATH, title: 'Tarde Clara', changes: [], summary, isNew: false }],
        }),
      );
    preview('Coda: section added');
    const note = within(reopened).getByRole('textbox', { name: 'Note' });
    expect(note).toHaveValue('Coda: section added');
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // An edit after it opened re-asks the preview; the untouched note follows.
    const previewsBefore = commandsOf(sent, CommandKind.PREVIEW_SAVE).length;
    edit(editorRef, '\n## Ponte\n```\nAm | D\n```\n');
    await waitFor(() => expect(commandsOf(sent, CommandKind.PREVIEW_SAVE).length).toBe(previewsBefore + 1), {
      timeout: 2000,
    });
    preview('Coda: section added; Ponte: section added');
    expect(note).toHaveValue('Coda: section added; Ponte: section added');

    // A typed note is kept through the next preview.
    act(() => fireEvent.change(note, { target: { value: 'Coda e ponte novas' } }));
    preview('something else');
    expect(note).toHaveValue('Coda e ponte novas');

    // The panel's Save sends SAVE with the note.
    act(() => fireEvent.click(within(reopened).getByRole('button', { name: 'Save' })));
    expect(commandsOf(sent, CommandKind.SAVE).at(-1).payload).toMatchObject({
      bookId: 'srv-e',
      paths: [PATH],
      message: 'Coda e ponte novas',
    });
  });

  describe('Save in the header keeps the editor’s gate (editor Decision 10; W04#4 L178-184)', () => {
    const BAD = [
      '# Tarde Clara',
      '## Primeira Parte',
      '```',
      'G  D',
      '```',
      '',
      '---',
      '',
      '## Voicings: E2 A2 D3 G3 B3 E4',
      '- G: 320003',
      '- Em: 02200', // 5 frets for a 6-string tuning (cifra.md §7.4)
    ].join('\n');

    for (const [device, mode] of [
      ['phone', 'narrow'],
      ['tablet', 'wide'],
      ['computer', 'wide'],
    ]) {
      it(`${device}: the header’s Save shows the stop and opens nothing`, async () => {
        installWidths(device);
        const { container, sent } = await openSong({ mode, text: BAD });
        act(() => fireEvent.click(within(appbarOf(container)).getByRole('button', { name: 'Save' })));
        expect(screen.getByRole('alert')).toHaveTextContent('Not saved');
        expect(screen.queryByRole('dialog')).toBeNull();
        expect(screen.queryByRole('region', { name: /^Save / })).toBeNull();
        expect(commandsOf(sent, CommandKind.PREVIEW_SAVE)).toHaveLength(0);
      });
    }

    it('computer: the open panel’s Save stops on a voicing typed after it opened', async () => {
      installWidths('computer');
      const { container, editorRef, emit, sent } = await openSong({ mode: 'wide' });
      emit(event(EventKind.PREFERENCES, { authorName: { value: 'Marina', at: AT } }));
      act(() => fireEvent.click(within(appbarOf(container)).getByRole('button', { name: 'Save' })));
      const panel = screen.getByRole('region', { name: 'Save Tarde Clara' });
      edit(editorRef, '\n---\n\n## Voicings: E2 A2 D3 G3 B3 E4\n- Em: 02200\n');
      act(() => fireEvent.click(within(panel).getByRole('button', { name: 'Save' })));
      expect(screen.getByRole('alert')).toHaveTextContent('Not saved');
      expect(commandsOf(sent, CommandKind.SAVE)).toHaveLength(0);
    });
  });
});
