// Behavior — the new-song flow through the real shell, RAC and i18n (songs.new_song,
// workflow 3). It renders <AppShell/> over a store double, drives the ways in
// (Write a song, Create "{query}", new song in this book), and the host the
// NEW_SONG_READY reply mounts, seeding the Worker's replies by emitting events.
// axe (WCAG 2.1 AA) over the ways-in surface, the editor host and the which-book
// control. Fixtures are purpose-written — never anyone's copyrighted words.

import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, within, waitFor } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { MY_SONGS_ID } from '../worker/my-songs.js';
import { checkWcag21aa } from '../a11y/axe.js';
import { injectStyles, expectPopoverSurface } from '../test/theme-styles.js';
import { WIDE_QUERY } from '../shell/layout-mode.js';
import AppShell from '../shell/AppShell.jsx';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import { DEVICES, installWidths } from '../test/widths.js';

// CodeMirror measures geometry jsdom lacks; stub it so the host's editor mounts
// (real geometry is covered at e2e). Mirrors SongEditor.behavior.test.jsx.
Range.prototype.getClientRects = function getClientRects() {
  return [];
};
Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
};

// The shell reads the viewport through matchMedia (jsdom has none). Pin it to
// narrow — the host is a full screen there and on wide alike (W03).
globalThis.matchMedia = (media) => ({
  media,
  matches: media === WIDE_QUERY ? false : false,
  addEventListener() {},
  removeEventListener() {},
});

const pinNarrow = globalThis.matchMedia;
afterEach(() => {
  cleanup();
  globalThis.matchMedia = pinNarrow;
});

const AT = '2026-10-06T00:00:00.000Z';

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

const lastCommand = (sent, kind) => sent.filter((c) => c.kind === kind).at(-1);

// A shelf with *My songs* (local), an editor-role shared book (push-capable) and
// a reader-role shared book (not push-capable).
const SHELF = {
  books: {
    'book-editor': {
      label: { value: 'Banda do Bairro', at: AT },
      role: { value: 'editor', at: AT },
      position: { value: 1, at: AT },
    },
    'book-reader': {
      label: { value: 'Turma de Quarta', at: AT },
      role: { value: 'reader', at: AT },
      position: { value: 2, at: AT },
    },
  },
  local: {
    [MY_SONGS_ID]: { title: { value: 'My songs', at: AT }, position: { value: 0, at: AT } },
  },
};

describe('ways in → NEW_SONG', () => {
  it('the empty shelf "Write a song" starts a new song into My songs (workflow 3 §Ways in L12)', async () => {
    const { store, sent, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);

    // First-run ways-in surface is axe-clean.
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    act(() => fireEvent.click(screen.getByRole('button', { name: /Write a song/ })));
    const cmd = lastCommand(sent, CommandKind.NEW_SONG);
    expect(cmd).toBeTruthy();
    expect(cmd.payload.targetBookId).toBeNull(); // → My songs

    // The Worker ensures the book, surfaces the shelf and replies with the path.
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.NEW_SONG_READY, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md' }));

    // The host is up, showing which book the song goes into.
    expect(screen.getByText(/In My songs/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change book' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('the Create "{query}" row carries the query as the title (workflow 3 §Ways in L10-11)', async () => {
    const { store, sent, emit } = makeStore();
    render(<AppShell store={store} />);

    act(() =>
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'Garota de Ipanema' },
      }),
    );
    const createRow = screen.getByRole('button', { name: /Create .Garota de Ipanema./ });
    expect(createRow).toBeInTheDocument();
    act(() => fireEvent.click(createRow));

    expect(lastCommand(sent, CommandKind.NEW_SONG)).toBeTruthy();
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.NEW_SONG_READY, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md' }));

    // The query becomes the song's title — surfaced in the host's appbar.
    expect(screen.getByText('Garota de Ipanema')).toBeInTheDocument();
  });

  it('"new song in this book" starts a song into that book (workflow 3 §Ways in L13, §Which book L32-33)', async () => {
    const { store, sent, emit } = makeStore();
    render(<AppShell store={store} />);

    emit(event(EventKind.SHELF, SHELF));
    emit(
      event(EventKind.BROWSE_RESULTS, {
        books: [
          {
            bookId: 'book-editor',
            count: 1,
            songs: [{ path: 'a.cifra.md', title: 'A', artist: '', unsaved: false }],
          },
        ],
      }),
    );

    const button = screen.getByRole('button', { name: /New song in Banda do Bairro/ });
    act(() => fireEvent.click(button));
    expect(lastCommand(sent, CommandKind.NEW_SONG).payload.targetBookId).toBe('book-editor');

    emit(event(EventKind.NEW_SONG_READY, { bookId: 'book-editor', path: 'untitled.cifra.md' }));
    expect(screen.getByText(/In Banda do Bairro/)).toBeInTheDocument();
  });
});

describe('which book', () => {
  it('changing the book right away discards the old placeholder after its last write, leaving no stray draft', async () => {
    const { store, sent, emit } = makeStore();
    render(<AppShell store={store} />);

    act(() => fireEvent.click(screen.getByRole('button', { name: /Write a song/ })));
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.NEW_SONG_READY, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md' }));
    // The template's first write is still debounced; move the draft at once.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Change book' })));
    act(() => fireEvent.click(screen.getByRole('menuitem', { name: 'Banda do Bairro' })));
    emit(event(EventKind.NEW_SONG_READY, { bookId: 'book-editor', path: 'untitled.cifra.md' }));

    const toOld = (c) => c.payload?.bookId === MY_SONGS_ID;
    const lastWriteOld = sent.findLastIndex((c) => c.kind === CommandKind.WRITE && toOld(c));
    const discardOld = sent.findLastIndex(
      (c) => c.kind === CommandKind.DISCARD && toOld(c) && c.payload.paths.includes('untitled.cifra.md'),
    );
    expect(discardOld).toBeGreaterThan(-1);
    expect(discardOld).toBeGreaterThan(lastWriteOld);
  });

  it('defaults to My songs and offers only push-capable books (workflow 3 §Which book L26-33)', async () => {
    const { store, emit } = makeStore();
    render(<AppShell store={store} />);

    act(() => fireEvent.click(screen.getByRole('button', { name: /Write a song/ })));
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.NEW_SONG_READY, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md' }));

    const changeBook = screen.getByRole('button', { name: 'Change book' });
    expect(changeBook).toBeInTheDocument();
    act(() => fireEvent.click(changeBook));

    // The menu offers My songs (local) and the editor-role book, never the
    // reader-role book (`canSaveFor`); the home book is not on the shelf.
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent);
    expect(items).toContain('My songs');
    expect(items).toContain('Banda do Bairro');
    expect(items).not.toContain('Turma de Quarta');
  });

  // books.owner_can_save: a book the signed-in person put online is shelved
  // with role `owner` and is offered beside the editor one; the reader book
  // still is not (workflow 3 §Which book L26-28).
  it('offers an owner-role shared book beside the editor one, never the reader one (books.owner_can_save)', async () => {
    const { store, emit } = makeStore();
    const { container } = render(<AppShell store={store} />);
    const shelf = {
      ...SHELF,
      books: {
        ...SHELF.books,
        'book-owner': {
          label: { value: 'Roda de Sábado', at: AT },
          role: { value: 'owner', at: AT },
          position: { value: 3, at: AT },
        },
      },
    };

    act(() => fireEvent.click(screen.getByRole('button', { name: /Write a song/ })));
    emit(event(EventKind.SHELF, shelf));
    emit(event(EventKind.NEW_SONG_READY, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md' }));

    act(() => fireEvent.click(screen.getByRole('button', { name: 'Change book' })));
    const items = screen.getAllByRole('menuitem').map((el) => el.textContent);
    expect(items).toContain('Roda de Sábado');
    expect(items).toContain('Banda do Bairro');
    expect(items).not.toContain('Turma de Quarta');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

// shell.popover_surface: WhichBook's Change book menu, with two writable books
// offered, is drawn on the shared opaque surface inside the .est theme root,
// axe clean while open (the .tji note: WhichBook's Popover was bare).
describe('the Change book menu (shell.popover_surface)', () => {
  it('the Change book menu is drawn on the popover surface', async () => {
    const removeStyles = injectStyles();
    try {
      const { store, emit } = makeStore();
      // Inside ThemeRoot as App.jsx mounts it: its portal provider keeps the
      // popover in the .est token scope.
      const { container } = render(
        <ThemeRoot store={store}>
          <AppShell store={store} />
        </ThemeRoot>,
      );
      act(() => fireEvent.click(screen.getByRole('button', { name: /Write a song/ })));
      emit(event(EventKind.SHELF, SHELF));
      emit(event(EventKind.NEW_SONG_READY, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md' }));

      act(() => fireEvent.click(screen.getByRole('button', { name: 'Change book' })));
      const menu = await screen.findByRole('menu', { name: 'Change book' });
      expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['My songs', 'Banda do Bairro']);
      expectPopoverSurface(menu);
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    } finally {
      removeStyles();
    }
  });
});

describe('the first save', () => {
  it('Save opens the sheet, confirming sends NAME_AND_SAVE, and SAVED closes the which-book control (workflow 3 §The first save; songs.save_sheet Decision 1)', async () => {
    const { store, sent, emit } = makeStore();
    render(<AppShell store={store} />);

    act(() => fireEvent.click(screen.getByRole('button', { name: /Write a song/ })));
    emit(event(EventKind.SHELF, SHELF));
    emit(event(EventKind.NEW_SONG_READY, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md' }));

    // The editor's Save (its gate already passed) opens the save sheet — it does
    // not commit directly any more (songs.save_sheet Decision 1).
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Save' })));
    expect(lastCommand(sent, CommandKind.PREVIEW_SAVE)).toBeTruthy();

    // The Worker replies with the preview and the stored author name, so the
    // sheet shows what changed and can be confirmed.
    emit(
      event(EventKind.SAVE_PREVIEW, {
        bookId: MY_SONGS_ID,
        previews: [
          { path: 'untitled.cifra.md', title: 'Garota', changes: [], summary: '', isNew: true },
        ],
      }),
    );
    emit(event(EventKind.PREFERENCES, { authorName: { value: 'Marina', at: AT } }));

    // Confirming in the sheet sends NAME_AND_SAVE with the author name.
    const dialog = screen.getByRole('dialog');
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: 'Save' })));
    const cmd = lastCommand(sent, CommandKind.NAME_AND_SAVE);
    expect(cmd).toBeTruthy();
    expect(cmd.payload).toMatchObject({ bookId: MY_SONGS_ID, fromPath: 'untitled.cifra.md' });
    // The name rides along; the Worker resolves the author (account.commit_author
    // Decision 3), so no author id is sent.
    expect(cmd.payload.name).toBe('Marina');
    expect(cmd.payload.author).toBeUndefined();

    // The first save landed: the song is ordinary now, the which-book bar gone.
    emit(
      event(EventKind.SAVED, {
        bookId: MY_SONGS_ID,
        path: 'untitled.cifra.md',
        commit: 'abc123',
        pushed: false,
      }),
    );
    expect(screen.queryByRole('button', { name: 'Change book' })).not.toBeInTheDocument();
  });
});

describe('the editor chrome on a new song (songs.editor_chrome; W03 board)', () => {
  // Start a song from the empty shelf's Write a song, into My songs.
  function startSong() {
    const env = makeStore();
    const utils = render(<AppShell store={env.store} />);
    act(() => fireEvent.click(screen.getByRole('button', { name: /Write a song/ })));
    env.emit(event(EventKind.SHELF, SHELF));
    env.emit(event(EventKind.NEW_SONG_READY, { bookId: MY_SONGS_ID, path: 'untitled.cifra.md' }));
    const view = () => EditorView.findFromDOM(utils.container.querySelector('.cm-editor'));
    return { ...env, ...utils, view };
  }
  const appbarOf = (container) => container.querySelector('.appbar');

  it('the header follows the first heading (the .tji note; W03#3 L91-97)', async () => {
    const { container, view } = startSong();
    const title = () => appbarOf(container).querySelector('.title');
    expect(title()).toHaveTextContent('Untitled song');
    await waitFor(() => expect(view().state.doc.toString()).toMatch(/^# \n/));

    // Type the title into the template's heading.
    act(() => {
      const first = view().state.doc.line(1);
      view().dispatch({ changes: { from: first.to, insert: 'Maré Mansa' } });
    });
    await waitFor(() => expect(title()).toHaveTextContent('Maré Mansa'));
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // Discard's question names it.
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Discard changes' })));
    expect(screen.getByRole('dialog', { name: 'Discard changes to Maré Mansa?' })).toBeInTheDocument();
  });

  for (const device of DEVICES) {
    it(`${device}: the first save is ${device === 'phone' ? 'a bottom sheet' : 'a centred dialog'} (W03#2 L56-82, W03#4 L176-197)`, async () => {
      installWidths(device);
      const { container } = startSong();
      const appbar = appbarOf(container);
      const strip = screen.queryByRole('status');
      if (device === 'phone') {
        // Unsaved from the start: the strip, above the which-book bar.
        expect(strip).toHaveTextContent('unsaved changes');
        expect(strip).toHaveTextContent('Kept on this device');
        const inBook = screen.getByText(/In My songs/);
        expect(strip.compareDocumentPosition(inBook) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(within(appbar).queryByRole('button', { name: 'Discard changes' })).toBeNull();
      } else {
        expect(strip).toBeNull();
        expect(appbar).toHaveTextContent('unsaved changes');
        expect(within(appbar).getByRole('button', { name: 'Discard changes' })).toBeInTheDocument();
      }
      expect(await checkWcag21aa(container)).toHaveNoViolations();

      act(() => fireEvent.click(within(appbar).getByRole('button', { name: 'Save' })));
      const dialog = screen.getByRole('dialog');
      if (device === 'phone') {
        expect(dialog.closest('.sheet')).not.toBeNull();
      } else {
        expect(dialog.closest('.sheet')).toBeNull();
        expect(dialog.closest('.dialog')).not.toBeNull();
        expect(dialog.closest('.scrim.center')).not.toBeNull();
      }
      expect(await checkWcag21aa(dialog)).toHaveNoViolations();
    });
  }
});
