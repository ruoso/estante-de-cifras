// The file view (books.file_view, workflow 14; DIRECTION §4 L449-452): the book
// as git sees it — the tree with each file's status in words, a raw editor for
// any file, the whole history with plain line diffs, and the file operations
// only it allows (rename/move keeping the kind and relinking setlists, delete,
// new song in a folder, saving several files in one commit). A full-screen host
// over the shell (AppShell mounts it like the new-song editor host); selection
// and the open view are ephemeral `useState`, no router (Decision 7).
//
// The view is the only React layer: it reads the `tree`, `bookLog` and `source`
// slices through the store and sends BOOK_TREE / MOVE_FILE / DELETE_FILE /
// COMMIT_DIFF / SAVE / RESTORE_VERSION / NEW_SONG; it never touches IndexedDB,
// runs git, or reads the working tree directly (DIRECTION §3.7).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from 'react-aria-components';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { t } from '../i18n/index.js';
import { orderedBooks, titleFor, canSaveFor } from '../books/book-display.js';
import SaveSheet from '../songs/SaveSheet.jsx';
import DiscardConfirm from '../songs/DiscardConfirm.jsx';
import FileTree from './FileTree.jsx';
import RawEditorHost from './RawEditorHost.jsx';
import RenameFileDialog from './RenameFileDialog.jsx';
import DeleteFileConfirm from './DeleteFileConfirm.jsx';
import BookHistory from './BookHistory.jsx';
import { buildTree, changedFiles, fileKind, splitPath } from './file-tree.js';
import { ChevronLeftIcon, PlusIcon, ClockIcon } from './icons.jsx';
import './file-view.css';

export default function FileView({ store, bookId, mode, onBack = () => {}, onOpenHistory = () => {} }) {
  const treeSlice = useSlice(store, 'tree');
  const shelf = useSlice(store, 'shelf');
  const entries = useMemo(() => treeSlice?.[bookId]?.entries ?? [], [treeSlice, bookId]);
  const nodes = useMemo(() => buildTree(entries), [entries]);
  const changes = useMemo(() => changedFiles(nodes), [nodes]);

  const book = useMemo(() => orderedBooks(shelf).find((b) => b.id === bookId), [shelf, bookId]);
  const bookLabel = titleFor(book?.book, bookId);
  const savable = canSaveFor(book?.kind ?? 'local', book?.book) !== false;

  const [tab, setTab] = useState('files');
  const [selected, setSelected] = useState(null); // { path, kind, isNew } | null
  const [editorRef] = useState(() => ({ current: null }));
  // The editor's flush: Delete on a never-saved file opens the discard confirm
  // from outside the editor, so a still-debounced edit is sent first and the
  // confirm previews it (songs.discard_summary Constraint 4).
  const [flushRef] = useState(() => ({ current: null }));

  // The sheets and dialogs (ephemeral). `save` carries the paths and new-song
  // context the SaveSheet needs; `discard` / `rename` / `del` the file in hand.
  const [save, setSave] = useState(null); // { paths, isNew, fromPath } | null
  const [discard, setDiscard] = useState(null); // { paths } | null
  const [rename, setRename] = useState(null); // { path, kind } | null
  const [del, setDel] = useState(null); // { path, kind } | null

  const refreshTree = useCallback(() => {
    store.send(command(CommandKind.BOOK_TREE, { bookId }));
  }, [store, bookId]);

  // Load the tree on open and whenever the selected file changes (so a file
  // edited then left reads its new status), and after every operation.
  useEffect(() => {
    refreshTree();
  }, [refreshTree, selected?.path]);

  const selectFile = (path) => {
    const kind = fileKind(splitPath(path).base);
    setSelected({ path, kind, isNew: false });
  };

  // A new song in the folder being looked at (workflow 14 L140-143; the
  // folder-aware seam songs.new_song left to this task). On NEW_SONG_READY the
  // placeholder opens in the editor; the first save names and commits it.
  const newSong = () => {
    const folder = selected ? splitPath(selected.path).folder : '';
    store.send(
      command(CommandKind.NEW_SONG, {
        targetBookId: bookId,
        folder: folder || null,
        mySongsTitle: t('firstRun.mySongs'),
      }),
    );
  };

  useWorkerEvent(store, EventKind.NEW_SONG_READY, ({ bookId: readyBook, path }) => {
    if (readyBook !== bookId) return;
    setTab('files');
    setSelected({ path, kind: 'song', isNew: true });
  });

  // A restore wrote a past version into the working copy: open the save sheet on
  // it, to be saved as a new version (workflow 6; W14 caption), and refresh.
  useWorkerEvent(store, EventKind.RESTORED, ({ bookId: restoredBook, path }) => {
    if (restoredBook !== bookId) return;
    setSave({ paths: [path], isNew: false, fromPath: null });
    refreshTree();
  });

  useWorkerEvent(store, EventKind.FILE_MOVED, ({ bookId: movedBook, toPath }) => {
    if (movedBook !== bookId) return;
    selectFile(toPath);
    refreshTree();
  });

  useWorkerEvent(store, EventKind.FILE_DELETED, ({ bookId: delBook, path }) => {
    if (delBook !== bookId) return;
    setSelected((prev) => (prev && prev.path === path ? null : prev));
    refreshTree();
  });

  useWorkerEvent(store, EventKind.SAVED, ({ bookId: savedBook, path }) => {
    if (savedBook !== bookId) return;
    // A new song's first save renamed the placeholder to its final path
    // (NAME_AND_SAVE carries it); follow the editor to it, no longer new.
    if (path) {
      setSelected((prev) =>
        prev && prev.isNew
          ? { path, kind: fileKind(splitPath(path).base), isNew: false }
          : prev,
      );
    }
    refreshTree();
  });
  useWorkerEvent(store, EventKind.DISCARDED, ({ bookId: discardedBook }) => {
    if (discardedBook === bookId) refreshTree();
  });

  const onEditorSave = () => {
    if (!selected) return;
    setSave({
      paths: [selected.path],
      isNew: selected.isNew,
      fromPath: selected.isNew ? selected.path : null,
    });
  };

  const doRename = (fromPath, toPath) => {
    store.send(command(CommandKind.MOVE_FILE, { bookId, fromPath, toPath }));
  };
  const doDelete = (path) => {
    store.send(command(CommandKind.DELETE_FILE, { bookId, path }));
  };
  const doRestore = (path, commit) => {
    store.send(command(CommandKind.RESTORE_VERSION, { bookId, path, commit, fromPath: path }));
  };

  // The appbar for the files tab's tree view and the history tab.
  const topBar = (title, right) => (
    <div className="appbar file-view-bar">
      <Button className="btn icon" aria-label={t('fileView.back')} onPress={onBack}>
        <ChevronLeftIcon />
      </Button>
      <span className="title">{title}</span>
      {right}
    </div>
  );

  const filesActions = (
    <>
      <Button
        className="btn"
        onPress={() => setTab('history')}
        aria-label={t('fileView.historyTab')}
      >
        <ClockIcon />
        {t('fileView.historyTab')}
      </Button>
      {savable ? (
        <Button className="btn" onPress={newSong}>
          <PlusIcon />
          {t('fileView.newSong')}
        </Button>
      ) : null}
    </>
  );

  const treePane = (
    <FileTree
      entries={entries}
      selectedPath={selected?.path ?? null}
      onSelect={selectFile}
      label={t('fileView.tree', { book: bookLabel })}
    />
  );

  const editorPane = selected ? (
    <RawEditorHost
      store={store}
      bookId={bookId}
      file={selected}
      mode={mode}
      editorRef={editorRef}
      flushRef={flushRef}
      onSave={onEditorSave}
      onOpenHistory={onOpenHistory}
      onRename={() => setRename({ path: selected.path, kind: selected.kind })}
      onDelete={() => {
        if (selected.isNew) {
          flushRef.current?.();
          setDiscard({ paths: [selected.path] });
        } else {
          setDel({ path: selected.path, kind: selected.kind });
        }
      }}
    />
  ) : (
    <p className="t-small file-view-empty" role="status">
      {t('fileView.emptyEditor')}
    </p>
  );

  const changesFooter =
    changes.length && tab === 'files' ? (
      <div className="file-view-foot">
        <span className="t-small grow">
          {t('fileView.filesChanged', { count: changes.length })}
        </span>
        <Button
          className="btn primary"
          onPress={() => setSave({ paths: changes.map((c) => c.path), isNew: false, fromPath: null })}
        >
          {t('fileView.save')}
        </Button>
      </div>
    ) : null;

  let body;
  if (tab === 'history') {
    body = (
      <BookHistory
        store={store}
        bookId={bookId}
        bookLabel={bookLabel}
        changes={changes}
        mode={mode}
        onSaveChecked={(paths) => setSave({ paths, isNew: false, fromPath: null })}
        onRestore={doRestore}
      />
    );
  } else if (mode === 'wide') {
    body = (
      <div className="split file-view-split">
        <div className="pane side">
          <div className="scroll">{treePane}</div>
        </div>
        <div className="pane main">
          <div className="scroll">{editorPane}</div>
        </div>
      </div>
    );
  } else if (selected) {
    // Narrow: one file open, with its own back to the tree.
    body = (
      <div className="file-view-narrow-editor">
        <div className="appbar file-view-bar">
          <Button
            className="btn icon"
            aria-label={t('fileView.backToFiles')}
            onPress={() => setSelected(null)}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="title t-mono">{selected.path}</span>
        </div>
        {editorPane}
      </div>
    );
  } else {
    body = (
      <div className="scroll">
        {treePane}
        <p className="t-small">{t('fileView.holds')}</p>
      </div>
    );
  }

  // The top appbar is shown for the tree (files tab, or wide) and the history
  // tab; the narrow open-editor renders its own bar above.
  const showTopBar = tab === 'history' || mode === 'wide' || !selected;
  const topBarNode =
    tab === 'history'
      ? topBar(
          t('fileView.historyTitle', { book: bookLabel }),
          <Button className="btn" onPress={() => setTab('files')}>
            {t('fileView.filesTab')}
          </Button>,
        )
      : topBar(
          mode === 'wide' ? t('fileView.titleIn', { book: bookLabel }) : t('fileView.title'),
          filesActions,
        );

  return (
    <div className="file-view est-file-view">
      {showTopBar ? topBarNode : null}
      {body}
      {changesFooter}

      <SaveSheet
        store={store}
        isOpen={Boolean(save)}
        onClose={() => setSave(null)}
        bookId={bookId}
        paths={save?.paths ?? []}
        isNew={save?.isNew ?? false}
        fromPath={save?.fromPath ?? null}
        bookLabel={bookLabel}
        canSave={savable}
      />
      <DiscardConfirm
        store={store}
        isOpen={Boolean(discard)}
        onClose={() => setDiscard(null)}
        onDiscarded={() => setSelected(null)}
        bookId={bookId}
        paths={discard?.paths ?? []}
      />
      <RenameFileDialog
        isOpen={Boolean(rename)}
        onClose={() => setRename(null)}
        file={rename}
        onRename={doRename}
      />
      <DeleteFileConfirm
        isOpen={Boolean(del)}
        onClose={() => setDel(null)}
        file={del}
        onConfirm={() => del && doDelete(del.path)}
      />
    </div>
  );
}
