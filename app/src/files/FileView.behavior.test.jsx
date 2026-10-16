// behavior — the file view React screen (books.file_view, workflow 14) over a
// pure store double: slices are seeded by emitting their events, and the
// commands the view sends are captured and asserted. Real React Aria Components
// and i18n; axe (WCAG 2.1 AA) over each state. The CodeMirror geometry stub is
// installed because the raw editor (SongEditor) mounts here (memory
// codemirror-jsdom-getclientrects). Fixtures are purpose-written.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { EditorView } from '@codemirror/view';
import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind, CommandKind } from '../worker/protocol.js';
import { t } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import FileView from './FileView.jsx';

Range.prototype.getClientRects = function getClientRects() {
  return [];
};
Range.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
};

const BOOK = 'local-example-book';

// jsdom has no matchMedia; a stub keeps SongEditor's useLayoutMode happy.
beforeEach(() => {
  globalThis.matchMedia = (media) => ({
    media,
    matches: true,
    addEventListener() {},
    removeEventListener() {},
  });
});

function makeStore() {
  const sent = [];
  const endpoint = { postMessage: (m) => sent.push(m), onmessage: null };
  const store = createStore(endpoint);
  const emit = (ev) => act(() => endpoint.onmessage({ data: ev }));
  return { store, sent, emit };
}

function renderView(store, props = {}) {
  return render(
    <ThemeRoot store={store}>
      <FileView store={store} bookId={BOOK} mode="wide" {...props} />
    </ThemeRoot>,
  );
}

const seedTree = (emit, entries) => emit(event(EventKind.TREE, { bookId: BOOK, entries }));

const kind = (m, k) => m.filter((c) => c.kind === k);

describe('the file view (behavior)', () => {
  it('the tree lists only the allowed kinds, each status a word (workflow 14 L24-29, L134-138)', async () => {
    const { store, emit } = makeStore();
    const { container } = renderView(store);
    seedTree(emit, [
      { path: 'mpb/valsa.cifra.md', status: 'unsaved' },
      { path: 'mpb/choro.cifra.md', status: null },
      { path: 'gigs/ensaio.setlist.md', status: 'new' },
      { path: 'perdida.cifra.md', status: 'deleted' },
      { path: 'conflito.cifra.md', status: 'conflict' },
      { path: 'README.md', status: null },
      { path: '.gitattributes', status: null },
      { path: 'notes.txt', status: null }, // not an allowed kind
    ]);

    // Folders and the allowed files render; the stray kind does not.
    expect(screen.getByText('mpb')).toBeInTheDocument();
    expect(screen.getByText('gigs')).toBeInTheDocument();
    expect(screen.getByText('valsa.cifra.md')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.queryByText('notes.txt')).toBeNull();

    // Each status is its word.
    expect(screen.getByText('unsaved changes')).toBeInTheDocument();
    expect(screen.getByText('new')).toBeInTheDocument();
    expect(screen.getByText('deleted')).toBeInTheDocument();
    expect(screen.getByText('conflict')).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('selecting a file mounts the raw editor and shows its source (workflow 14 L148)', async () => {
    const { store, sent, emit } = makeStore();
    const { container } = renderView(store);
    seedTree(emit, [{ path: 'valsa.cifra.md', status: null }]);

    act(() => fireEvent.click(screen.getByRole('button', { name: /valsa\.cifra\.md/ })));
    // The editor loads via OPEN_SOURCE for the chosen file.
    expect(kind(sent, 'open_source').some((c) => c.payload.path === 'valsa.cifra.md')).toBe(true);
    // Its toolbar (the raw editor) is mounted.
    expect(screen.getByRole('button', { name: t('editor.source.save') })).toBeInTheDocument();

    emit(event(EventKind.SOURCE, { bookId: BOOK, path: 'valsa.cifra.md', text: 'Uma valsa na rua' }));
    await waitFor(() => expect(container.textContent).toContain('Uma valsa na rua'));
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  // Open the rename dialog on a file of the tree.
  const openRenameOn = (path) => {
    const name = path.split('/').at(-1);
    act(() => fireEvent.click(screen.getByRole('button', { name: new RegExp(name.replace(/\./g, '\\.')) })));
    act(() => fireEvent.click(screen.getByRole('button', { name: t('fileView.renameLabel', { name: path }) })));
    return screen.getByRole('dialog');
  };

  it('rename pins the kind and lists the setlist links it updates; submit sends MOVE_FILE (workflow 14 L151-153; W14 tablet #3 L144-147)', async () => {
    const { store, sent, emit } = makeStore();
    renderView(store);
    seedTree(emit, [{ path: 'valsa.cifra.md', status: null }]);
    const dialog = openRenameOn('valsa.cifra.md');

    // The extension is pinned beside the field.
    expect(within(dialog).getAllByText(/\.cifra\.md/).length).toBeGreaterThan(0);
    // Opening it on a song asks the Worker which setlist items link to it; until
    // the reply, no notice is drawn.
    expect(kind(sent, 'file_links').at(-1).payload).toEqual({ bookId: BOOK, path: 'valsa.cifra.md' });
    expect(within(dialog).queryByText(t('fileView.linkNotice'))).toBeNull();

    emit(
      event(EventKind.FILE_LINKS, {
        bookId: BOOK,
        path: 'valsa.cifra.md',
        links: [
          { setlist: 'gigs/ensaio.setlist.md', item: 3 },
          { setlist: 'gigs/ferias.setlist.md', item: 1 },
        ],
      }),
    );
    expect(within(dialog).getByText(t('fileView.linkNotice'))).toBeInTheDocument();
    const lines = within(dialog).getAllByRole('listitem').map((li) => li.textContent);
    expect(lines).toEqual(['gigs/ensaio.setlist.md · item 3', 'gigs/ferias.setlist.md · item 1']);
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();

    const field = within(dialog).getByRole('textbox');
    act(() => fireEvent.change(field, { target: { value: 'nova-valsa' } }));
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: t('fileView.renameConfirm') })));

    expect(kind(sent, 'move_file')).toContainEqual(
      expect.objectContaining({
        payload: { bookId: BOOK, fromPath: 'valsa.cifra.md', toPath: 'nova-valsa.cifra.md' },
      }),
    );
  });

  it('a song with no links shows no link notice (books.file_view_history_polish Decision 3)', async () => {
    const { store, emit } = makeStore();
    renderView(store);
    seedTree(emit, [{ path: 'valsa.cifra.md', status: null }]);
    const dialog = openRenameOn('valsa.cifra.md');
    emit(event(EventKind.FILE_LINKS, { bookId: BOOK, path: 'valsa.cifra.md', links: [] }));
    expect(within(dialog).queryByText(t('fileView.linkNotice'))).toBeNull();
    expect(within(dialog).queryByRole('list')).toBeNull();
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('a setlist rename asks for no links and shows no notice (a moved setlist relinks nothing)', async () => {
    const { store, sent, emit } = makeStore();
    renderView(store);
    seedTree(emit, [{ path: 'gigs/ensaio.setlist.md', status: null }]);
    const dialog = openRenameOn('gigs/ensaio.setlist.md');
    expect(within(dialog).getByRole('heading', { name: t('fileView.renameSetlist') })).toBeInTheDocument();
    expect(kind(sent, 'file_links')).toEqual([]);
    expect(within(dialog).queryByText(t('fileView.linkNotice'))).toBeNull();
  });

  it('delete asks once, sends DELETE_FILE, and the row then reads deleted (workflow 14 L147)', async () => {
    const { store, sent, emit } = makeStore();
    renderView(store);
    seedTree(emit, [{ path: 'valsa.cifra.md', status: null }]);
    act(() => fireEvent.click(screen.getByRole('button', { name: /valsa\.cifra\.md/ })));
    act(() => fireEvent.click(screen.getByRole('button', { name: t('fileView.deleteLabel', { name: 'valsa.cifra.md' }) })));

    const dialog = screen.getByRole('dialog');
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
    act(() => fireEvent.click(within(dialog).getByRole('button', { name: t('fileView.deleteConfirm') })));

    expect(kind(sent, 'delete_file')).toContainEqual(
      expect.objectContaining({ payload: { bookId: BOOK, path: 'valsa.cifra.md' } }),
    );

    // The Worker would now report it deleted; the row reads the word.
    seedTree(emit, [{ path: 'valsa.cifra.md', status: 'deleted' }]);
    expect(screen.getByText('deleted')).toBeInTheDocument();
  });

  // songs.discard_summary Constraint 4: Delete on a never-saved file opens the
  // discard confirm from outside the editor, so the still-debounced edit is sent
  // before the confirm's PREVIEW_SAVE (workflow 4 §Discarding).
  it('Delete on a never-saved file flushes before the discard confirm previews', async () => {
    const { store, sent, emit } = makeStore();
    renderView(store);
    seedTree(emit, []);
    emit(event(EventKind.NEW_SONG_READY, { bookId: BOOK, path: 'tide.cifra.md' }));
    // The raw editor mounted on the new song's template.
    expect(screen.getByRole('button', { name: t('editor.source.save') })).toBeInTheDocument();
    const view = EditorView.findFromDOM(document.querySelector('.cm-editor'));
    act(() => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: '# Tide\n' } }));

    // Delete at once — well inside the editor's write debounce.
    act(() =>
      fireEvent.click(screen.getByRole('button', { name: t('fileView.deleteLabel', { name: 'tide.cifra.md' }) })),
    );

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('button', { name: t('saveSheet.discard') })).toBeInTheDocument();
    const order = sent
      .filter((c) => c.kind === CommandKind.WRITE || c.kind === CommandKind.PREVIEW_SAVE)
      .map((c) => c.kind);
    expect(order).toEqual([CommandKind.WRITE, CommandKind.PREVIEW_SAVE]);
    expect(kind(sent, CommandKind.WRITE)[0].payload).toMatchObject({ bookId: BOOK, path: 'tide.cifra.md', text: '# Tide\n' });
    expect(kind(sent, CommandKind.PREVIEW_SAVE)[0].payload).toMatchObject({ bookId: BOOK, paths: ['tide.cifra.md'] });
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('the change list shows each change checked and Save… opens the sheet for them (workflow 14 L152-159)', async () => {
    const { store, sent, emit } = makeStore();
    const { container } = renderView(store);
    seedTree(emit, [
      { path: 'a.cifra.md', status: 'unsaved' },
      { path: 'b.cifra.md', status: 'new' },
      { path: 'clean.cifra.md', status: null },
    ]);
    // Go to the history tab, where the change list lives (W14 desktop board).
    act(() => fireEvent.click(screen.getByRole('button', { name: t('fileView.historyTab') })));
    emit(event(EventKind.BOOK_LOG, { bookId: BOOK, commits: [] }));

    const changeGroup = screen.getByRole('group', { name: t('fileView.changesTitle') });
    const boxes = within(changeGroup).getAllByRole('checkbox');
    expect(boxes).toHaveLength(2);
    boxes.forEach((b) => expect(b).toBeChecked());
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // Seed the preview the sheet reads, then save the checked files.
    emit(
      event(EventKind.SAVE_PREVIEW, {
        bookId: BOOK,
        previews: [
          { path: 'a.cifra.md', title: 'A', changes: [], summary: '', isNew: false },
          { path: 'b.cifra.md', title: 'B', changes: [], summary: '', isNew: false },
        ],
      }),
    );
    act(() => fireEvent.click(screen.getByRole('button', { name: /Save 2 files/ })));

    // The save sheet opened for exactly the checked paths (its PREVIEW_SAVE).
    const previews = kind(sent, 'preview_save');
    expect(previews.at(-1).payload.paths).toEqual(['a.cifra.md', 'b.cifra.md']);
  });

  it('the history list, a commit diff and restore (workflow 14 L161-173)', async () => {
    const { store, sent, emit } = makeStore();
    const { container } = renderView(store);
    seedTree(emit, []);
    act(() => fireEvent.click(screen.getByRole('button', { name: t('fileView.historyTab') })));
    emit(
      event(EventKind.BOOK_LOG, {
        bookId: BOOK,
        commits: [
          {
            commit: 'c2222222aaaa',
            short: 'c222222',
            parents: ['p1'],
            isMerge: false,
            author: { name: 'Rafael' },
            timestamp: 1696000000,
            message: 'Edit Valsa',
            files: [{ path: 'valsa.cifra.md', status: 'modified' }],
          },
          {
            commit: 'm1111111bbbb',
            short: 'm111111',
            parents: ['x', 'y'],
            isMerge: true,
            author: { name: 'Bea' },
            timestamp: 1695000000,
            message: 'Merge',
            files: [{ path: 'valsa.cifra.md', status: 'modified' }],
          },
        ],
      }),
    );

    // Commits render newest-first, merges marked, with short hash and file count.
    expect(screen.getByText('Edit Valsa')).toBeInTheDocument();
    expect(screen.getByText('c222222')).toBeInTheDocument();
    expect(screen.getByText(t('fileView.merge'))).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // Open a commit → COMMIT_DIFF; the view line-diffs the before/after.
    act(() => fireEvent.click(screen.getByRole('button', { name: /Edit Valsa/ })));
    expect(kind(sent, 'commit_diff').at(-1).payload.commit).toBe('c2222222aaaa');
    emit(
      event(EventKind.COMMIT_DIFF, {
        bookId: BOOK,
        commit: 'c2222222aaaa',
        files: [
          {
            path: 'valsa.cifra.md',
            status: 'modified',
            before: '# Valsa\n\nold line\n',
            after: '# Valsa\n\nnew line\n',
          },
        ],
      }),
    );
    await waitFor(() => expect(container.querySelector('.ln.add')).toBeTruthy());
    expect(container.querySelector('.ln.del')).toBeTruthy();
    // The open commit is headed by its message, then author · full date · hash ·
    // files (W14 computer #4 L201-202; workflow 14 L169-172).
    expect(screen.getByRole('heading', { level: 2, name: 'Edit Valsa' })).toBeInTheDocument();
    const metaLine = container.querySelector('.commit-meta');
    expect(metaLine.textContent).toContain('Rafael');
    expect(metaLine.textContent).toContain(String(new Date(1696000000 * 1000).getFullYear()));
    expect(within(metaLine).getByText('c222222')).toHaveClass('t-mono');
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // Restore writes that version into the working copy.
    act(() => fireEvent.click(screen.getByRole('button', { name: t('fileView.restore') })));
    expect(kind(sent, 'restore_version')).toContainEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ bookId: BOOK, path: 'valsa.cifra.md', commit: 'c2222222aaaa' }),
      }),
    );
  });

  // A two-line commit message: the subject heads the open commit, the rest of the
  // message follows under it (books.file_view_history_polish Decision 4).
  const TWO_LINE = {
    commit: 'c3333333cccc',
    short: 'c333333',
    parents: ['c2222222aaaa'],
    isMerge: false,
    author: { name: 'Rafael' },
    timestamp: 1696000000,
    message: 'Edit Valsa\n\nThe bridge moves to Em7.\n',
    files: [{ path: 'valsa.cifra.md', status: 'modified' }],
  };
  const DIFF = {
    bookId: BOOK,
    commit: 'c3333333cccc',
    files: [{ path: 'valsa.cifra.md', status: 'modified', before: '# Valsa\n\nold\n', after: '# Valsa\n\nnew\n' }],
  };

  it('the open commit carries its message: the subject as heading, the body under it (workflow 14 L169-172; W14 computer #4 L201)', async () => {
    const { store, emit } = makeStore();
    const { container } = renderView(store);
    seedTree(emit, []);
    act(() => fireEvent.click(screen.getByRole('button', { name: t('fileView.historyTab') })));
    emit(event(EventKind.BOOK_LOG, { bookId: BOOK, commits: [TWO_LINE] }));
    act(() => fireEvent.click(screen.getByRole('button', { name: /Edit Valsa/ })));
    emit(event(EventKind.COMMIT_DIFF, DIFF));

    const heading = await screen.findByRole('heading', { level: 2, name: 'Edit Valsa' });
    expect(heading.textContent).toBe('Edit Valsa');
    const body = screen.getByText('The bridge moves to Em7.');
    // The body sits under the heading, before the meta line.
    expect(heading.compareDocumentPosition(body) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(body.compareDocumentPosition(container.querySelector('.commit-meta')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('the heading on narrow: the one-at-a-time commit detail is headed by its message (workflow 14 L137-138)', async () => {
    const { store, emit } = makeStore();
    const { container } = renderView(store, { mode: 'narrow' });
    seedTree(emit, []);
    act(() => fireEvent.click(screen.getByRole('button', { name: t('fileView.historyTab') })));
    emit(event(EventKind.BOOK_LOG, { bookId: BOOK, commits: [TWO_LINE] }));
    act(() => fireEvent.click(screen.getByRole('button', { name: /Edit Valsa/ })));
    emit(event(EventKind.COMMIT_DIFF, DIFF));

    const heading = await screen.findByRole('heading', { level: 2, name: 'Edit Valsa' });
    await waitFor(() => expect(container.querySelector('.ln.add')).toBeTruthy());
    expect(heading.compareDocumentPosition(container.querySelector('.ln.add')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  // songs.show_the_file — the reading view's *Show the file* opens the view at
  // the song's file (workflow 14 L133, "opens the tree at that file").
  describe('opened at a file (initialPath)', () => {
    const LANTERN = 'sets/evening/lantern-road.cifra.md';
    const ENTRIES = [
      { path: 'sets/evening/lantern-road.cifra.md', status: null },
      { path: 'sets/evening/quiet-harbour.cifra.md', status: null },
      { path: 'sets/evening.setlist.md', status: null },
      { path: 'README.md', status: null },
    ];
    const LANTERN_TEXT = '# Lantern Road\n\nA road lit by lanterns';
    // A row of the tree (the raw editor's own controls name the file too).
    const tree = () => screen.getByRole('group', { name: t('fileView.tree', { book: BOOK }) });
    const row = (name) => within(tree()).getByRole('button', { name: new RegExp(name.replaceAll('.', '\\.')) });

    it('opened at a file: the tree shows it selected and the raw editor holds it (workflow 14 L133; Constraint 3)', async () => {
      const { store, sent, emit } = makeStore();
      const { container } = renderView(store, { initialPath: LANTERN });
      seedTree(emit, ENTRIES);

      // The Files tab: the tree and its History switch, not the history title.
      expect(screen.getByRole('button', { name: t('fileView.historyTab') })).toBeInTheDocument();
      expect(screen.queryByText(t('fileView.historyTitle', { book: BOOK }))).toBeNull();
      // The row is marked selected by its state, not colour alone.
      expect(row('lantern-road.cifra.md')).toHaveAttribute('aria-pressed', 'true');
      expect(row('quiet-harbour.cifra.md')).toHaveAttribute('aria-pressed', 'false');
      // The raw editor opened on it.
      expect(kind(sent, 'open_source').some((c) => c.payload.path === LANTERN)).toBe(true);
      expect(screen.getByRole('button', { name: t('editor.source.save') })).toBeInTheDocument();
      emit(event(EventKind.SOURCE, { bookId: BOOK, path: LANTERN, text: LANTERN_TEXT }));
      await waitFor(() => expect(container.textContent).toContain('A road lit by lanterns'));
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    });

    it('opened at a file on a phone: the file pane, Back to files to the tree (workflow 14 L137-138)', async () => {
      const { store, sent, emit } = makeStore();
      const { container } = renderView(store, { initialPath: LANTERN, mode: 'narrow' });
      seedTree(emit, ENTRIES);

      // One pane at a time: the file, under its own Back to files.
      expect(container.querySelector('.file-view-narrow-editor .file-view-bar')).toHaveTextContent(LANTERN);
      expect(screen.queryByRole('group', { name: t('fileView.tree', { book: BOOK }) })).toBeNull();
      expect(kind(sent, 'open_source').some((c) => c.payload.path === LANTERN)).toBe(true);
      emit(event(EventKind.SOURCE, { bookId: BOOK, path: LANTERN, text: LANTERN_TEXT }));
      await waitFor(() => expect(container.textContent).toContain('A road lit by lanterns'));
      expect(await checkWcag21aa(container)).toHaveNoViolations();

      act(() => fireEvent.click(screen.getByRole('button', { name: t('fileView.backToFiles') })));
      // The tree, with the file just left marked.
      expect(row('lantern-road.cifra.md')).toHaveAttribute('aria-pressed', 'true');
      expect(row('quiet-harbour.cifra.md')).toHaveAttribute('aria-pressed', 'false');
      expect(screen.queryByRole('button', { name: t('editor.source.save') })).toBeNull();
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    });

    it('without initialPath nothing is selected (the Files in {book} entry, unchanged)', () => {
      const { store, sent, emit } = makeStore();
      renderView(store);
      seedTree(emit, ENTRIES);

      expect(row('lantern-road.cifra.md')).toHaveAttribute('aria-pressed', 'false');
      expect(row('quiet-harbour.cifra.md')).toHaveAttribute('aria-pressed', 'false');
      expect(kind(sent, 'open_source')).toEqual([]);
      expect(screen.getByText(t('fileView.emptyEditor'))).toBeInTheDocument();
    });
  });
});
