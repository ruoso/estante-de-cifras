// behavior — the file view React screen (books.file_view, workflow 14) over a
// pure store double: slices are seeded by emitting their events, and the
// commands the view sends are captured and asserted. Real React Aria Components
// and i18n; axe (WCAG 2.1 AA) over each state. The CodeMirror geometry stub is
// installed because the raw editor (SongEditor) mounts here (memory
// codemirror-jsdom-getclientrects). Fixtures are purpose-written.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import { createStore } from '../worker/store.js';
import { event, EventKind } from '../worker/protocol.js';
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

  it('rename pins the kind and shows the link notice; submit sends MOVE_FILE (workflow 14 L144-146)', async () => {
    const { store, sent, emit } = makeStore();
    renderView(store);
    seedTree(emit, [{ path: 'valsa.cifra.md', status: null }]);
    act(() => fireEvent.click(screen.getByRole('button', { name: /valsa\.cifra\.md/ })));
    act(() => fireEvent.click(screen.getByRole('button', { name: t('fileView.renameLabel', { name: 'valsa.cifra.md' }) })));

    const dialog = screen.getByRole('dialog');
    // The extension is pinned beside the field, and the link notice shows.
    expect(within(dialog).getAllByText(/\.cifra\.md/).length).toBeGreaterThan(0);
    expect(within(dialog).getByText(t('fileView.linkNotice'))).toBeInTheDocument();
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
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // Restore writes that version into the working copy.
    act(() => fireEvent.click(screen.getByRole('button', { name: t('fileView.restore') })));
    expect(kind(sent, 'restore_version')).toContainEqual(
      expect.objectContaining({
        payload: expect.objectContaining({ bookId: BOOK, path: 'valsa.cifra.md', commit: 'c2222222aaaa' }),
      }),
    );
  });
});
