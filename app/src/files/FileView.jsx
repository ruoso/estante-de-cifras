// The file view (books.file_view, workflow 14; DIRECTION §4 L449-452): the book
// as git sees it — the tree with each file's status in words, a raw editor for
// any file, the whole history with plain line diffs, and the file operations
// only it allows (rename/move keeping the kind and relinking setlists, delete,
// creating a song, a setlist, a folder or the README in the folder being looked
// at, saving several files in one commit). A full-screen host
// over the shell (AppShell mounts it like the new-song editor host); selection
// and the open view are ephemeral `useState`, no router (Decision 7).
//
// The view is the only React layer: it reads the `tree`, `bookLog` and `source`
// slices through the store and sends BOOK_TREE / MOVE_FILE / DELETE_FILE /
// COMMIT_DIFF / SAVE / RESTORE_VERSION / NEW_SONG / CREATE_FILE; it never touches IndexedDB,
// runs git, or reads the working tree directly (DIRECTION §3.7).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover } from 'react-aria-components';
import { useSlice, useWorkerEvent } from '../worker/useStore.js';
import { command, CommandKind, EventKind } from '../worker/protocol.js';
import { t } from '../i18n/index.js';
import { orderedBooks, titleFor, canSaveFor } from '../books/book-display.js';
import SaveSheet from '../songs/SaveSheet.jsx';
import DiscardConfirm from '../songs/DiscardConfirm.jsx';
import FileTree, { StatusBadge } from './FileTree.jsx';
import CreateMenu from './CreateMenu.jsx';
import NewNameDialog from './NewNameDialog.jsx';
import RawEditorHost from './RawEditorHost.jsx';
import RenameFileDialog from './RenameFileDialog.jsx';
import DeleteFileConfirm from './DeleteFileConfirm.jsx';
import BookHistory from './BookHistory.jsx';
import { buildTree, changedFiles, fileKind, splitPath } from './file-tree.js';
import { createChoices, folderBeingLookedAt, folderNameProblem, namesIn } from './new-file.js';
import { ChevronLeftIcon, ClockIcon, MoreIcon } from './icons.jsx';
import './file-view.css';

// `initialPath` (songs.show_the_file Decision 1): the file to open the view at —
// the reading view's *Show the file* — seeding the selection once; null (Files
// in {book}) opens it with nothing selected.
export default function FileView({ store, bookId, mode, initialPath = null, onBack = () => {}, onOpenHistory = () => {} }) {
  const treeSlice = useSlice(store, 'tree');
  const shelf = useSlice(store, 'shelf');
  const entries = useMemo(() => treeSlice?.[bookId]?.entries ?? [], [treeSlice, bookId]);
  const nodes = useMemo(() => buildTree(entries), [entries]);
  const changes = useMemo(() => changedFiles(nodes), [nodes]);

  const book = useMemo(() => orderedBooks(shelf).find((b) => b.id === bookId), [shelf, bookId]);
  const bookLabel = titleFor(book?.book, t('books.untitled'));
  const savable = canSaveFor(book?.kind ?? 'local', book?.book) !== false;

  const [tab, setTab] = useState('files');
  const [selected, setSelected] = useState(() =>
    initialPath ? { path: initialPath, kind: fileKind(splitPath(initialPath).base), isNew: false } : null,
  ); // { path, kind, isNew } | null
  // On a phone, the file just left by *Back to files*: its row stays marked in
  // the tree, so the way back lands where the user was (songs.show_the_file).
  const [leftPath, setLeftPath] = useState(null);
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
  // The setlist items linking to the song being renamed, from the Worker's
  // FILE_LINKS reply (books.file_view_history_polish Decision 2): null until it
  // arrives, so no notice is drawn before it is known.
  const [renameLinks, setRenameLinks] = useState(null); // { path, links } | null
  const [del, setDel] = useState(null); // { path, kind } | null
  // The *New* menu (books.file_view_create_menu): the folder chosen in the tree
  // (Decision 5), the folders made here that no file is in yet (Decision 3 —
  // gone when the view is left), the name dialog open, and the README refusal.
  const [chosenFolder, setChosenFolder] = useState(null); // string | null
  const [emptyFolders, setEmptyFolders] = useState([]); // string[]
  const [creating, setCreating] = useState(null); // 'setlist' | 'folder' | null
  const [refused, setRefused] = useState(false);

  const refreshTree = useCallback(() => {
    store.send(command(CommandKind.BOOK_TREE, { bookId }));
  }, [store, bookId]);

  // Load the tree on open and whenever the selected file changes (so a file
  // edited then left reads its new status), and after every operation.
  useEffect(() => {
    refreshTree();
  }, [refreshTree, selected?.path]);

  // Opening a file clears the chosen folder: the folder being looked at is then
  // the file's (Acceptance 6).
  const openFile = (file) => {
    setSelected(file);
    setChosenFolder(null);
  };
  const selectFile = (path) => {
    const kind = fileKind(splitPath(path).base);
    openFile({ path, kind, isNew: false });
  };
  // Choosing a folder row points *New* at it and clears the file selection; on a
  // phone it opens no pane, the tree stays (Acceptance 6).
  const chooseFolder = (path) => {
    setChosenFolder(path);
    setSelected(null);
    setLeftPath(null);
  };

  // Where a create goes (workflow 3 L32-33; Constraint 2), and which kinds the
  // *New* menu offers (README only when the book has none).
  const lookingAt = folderBeingLookedAt({ chosenFolder, selectedPath: selected?.path ?? null });
  const choices = useMemo(() => createChoices(entries), [entries]);

  // The *New* menu's choices (workflow 14 §What can be done to a file). A song
  // goes through NEW_SONG in the folder being looked at: on NEW_SONG_READY the
  // placeholder opens in the editor and the first save names it. A setlist and a
  // folder are named in a dialog first; the README is written at once with the
  // book's name as its title (Decision 7).
  const onCreate = (kind) => {
    setRefused(false);
    if (kind === 'song') {
      store.send(
        command(CommandKind.NEW_SONG, {
          targetBookId: bookId,
          folder: lookingAt || null,
          mySongsTitle: t('firstRun.mySongs'),
        }),
      );
    } else if (kind === 'setlist' || kind === 'folder') {
      setCreating(kind);
    } else if (kind === 'readme') {
      store.send(command(CommandKind.CREATE_FILE, { bookId, kind: 'readme', title: bookLabel }));
    }
  };
  const createSetlist = (title) => {
    store.send(
      command(CommandKind.CREATE_FILE, { bookId, kind: 'setlist', folder: lookingAt || null, title }),
    );
  };
  // A folder is held by the view, *empty* and chosen, until a file is in it —
  // git has no empty folders, so nothing is sent (Decision 3).
  const folderSiblings = useMemo(
    () => namesIn([...entries.map((e) => e.path), ...emptyFolders.map((f) => `${f}/`)], lookingAt),
    [entries, emptyFolders, lookingAt],
  );
  const folderProblem = (name) => {
    const code = folderNameProblem(name, folderSiblings);
    return code ? t(`fileView.folderProblem.${code}`) : null;
  };
  const createFolder = (name) => {
    const path = lookingAt ? `${lookingAt}/${name}` : name;
    setEmptyFolders((prev) => (prev.includes(path) ? prev : [...prev, path]));
    chooseFolder(path);
  };

  useWorkerEvent(store, EventKind.NEW_SONG_READY, ({ bookId: readyBook, path }) => {
    if (readyBook !== bookId) return;
    setTab('files');
    openFile({ path, kind: 'song', isNew: true });
  });

  // A setlist or README written by CREATE_FILE: open it (on a phone, the one
  // pane shown). The Worker's TREE follows, listing it *new*.
  useWorkerEvent(store, EventKind.FILE_CREATED, ({ bookId: createdBook, path }) => {
    if (createdBook !== bookId) return;
    setTab('files');
    setLeftPath(null);
    selectFile(path);
  });
  useWorkerEvent(store, EventKind.CREATE_REFUSED, ({ bookId: refusedBook }) => {
    if (refusedBook === bookId) setRefused(true);
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
    setLeftPath(null);
    selectFile(toPath);
    refreshTree();
  });

  useWorkerEvent(store, EventKind.FILE_LINKS, ({ bookId: linksBook, path, links }) => {
    if (linksBook !== bookId) return;
    setRenameLinks({ path, links: links ?? [] });
  });

  useWorkerEvent(store, EventKind.FILE_DELETED, ({ bookId: delBook, path }) => {
    if (delBook !== bookId) return;
    setSelected((prev) => (prev && prev.path === path ? null : prev));
    setLeftPath((prev) => (prev === path ? null : prev));
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

  // Only a song has links to it (a moved setlist relinks nothing), so only a
  // song's rename asks the Worker which setlist items it will update.
  const openRename = (file) => {
    setRenameLinks(null);
    setRename(file);
    if (file.kind === 'song') {
      store.send(command(CommandKind.FILE_LINKS, { bookId, path: file.path }));
    }
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

  // Delete on the open file: a never-saved song is discarded (the still-debounced
  // edit flushed first, so the confirm previews it); anything else asks once.
  const deleteSelected = () => {
    if (!selected) return;
    if (selected.isNew) {
      flushRef.current?.();
      setDiscard({ paths: [selected.path] });
    } else {
      setDel({ path: selected.path, kind: selected.kind });
    }
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

  // History and *New*: text buttons on wide (W14 tablet #3), icon buttons on a
  // phone so the *Files* title is not squeezed (W14 #1 L30-35).
  const filesActions = (
    <>
      {mode === 'wide' ? (
        <Button
          className="btn"
          onPress={() => setTab('history')}
          aria-label={t('fileView.historyTab')}
        >
          <ClockIcon />
          {t('fileView.historyTab')}
        </Button>
      ) : (
        <Button className="btn icon" onPress={() => setTab('history')} aria-label={t('fileView.historyTab')}>
          <ClockIcon />
        </Button>
      )}
      {savable ? <CreateMenu mode={mode} choices={choices} onAction={onCreate} /> : null}
    </>
  );

  const treePane = (
    <>
      {refused ? (
        <p className="notice file-view-notice" role="status">
          {t('fileView.readmeExists')}
        </p>
      ) : null}
      <FileTree
        entries={entries}
        emptyFolders={emptyFolders}
        selectedPath={selected?.path ?? (mode === 'wide' ? null : leftPath)}
        chosenFolder={chosenFolder}
        onSelect={selectFile}
        onChooseFolder={chooseFolder}
        label={t('fileView.tree', { book: bookLabel })}
      />
    </>
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
      onRename={() => openRename({ path: selected.path, kind: selected.kind })}
      onDelete={deleteSelected}
      showHead={mode === 'wide'}
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
    // Narrow: one file open, under ONE bar — Back to files, its base name, and a
    // *More* menu holding Rename and Delete — then a meta line with the book,
    // the folder and the file's status (W14 #2 L68-74; Decision 6).
    const { folder, base } = splitPath(selected.path);
    const renameable = !selected.isNew && (selected.kind === 'song' || selected.kind === 'setlist');
    const status = entries.find((e) => e.path === selected.path)?.status ?? null;
    body = (
      <div className="file-view-narrow-editor">
        <div className="appbar file-view-bar">
          <Button
            className="btn icon"
            aria-label={t('fileView.backToFiles')}
            onPress={() => {
              setLeftPath(selected.isNew ? null : selected.path);
              setSelected(null);
            }}
          >
            <ChevronLeftIcon />
          </Button>
          <span className="title t-mono">{base}</span>
          <MenuTrigger>
            <Button className="btn icon" aria-label={t('fileView.more')}>
              <MoreIcon />
            </Button>
            <Popover className="popover file-create-menu" placement="bottom end">
              <Menu
                aria-label={t('fileView.more')}
                onAction={(key) => {
                  if (key === 'rename') openRename({ path: selected.path, kind: selected.kind });
                  else if (key === 'delete') deleteSelected();
                }}
              >
                {renameable ? (
                  <MenuItem id="rename" className="row file-create-item">
                    {t('fileView.rename')}
                  </MenuItem>
                ) : null}
                <MenuItem id="delete" className="row file-create-item">
                  {t('fileView.delete')}
                </MenuItem>
              </Menu>
            </Popover>
          </MenuTrigger>
        </div>
        <div className="file-view-meta">
          <span className="t-small grow">
            {folder ? t('fileView.fileMeta', { book: bookLabel, folder }) : bookLabel}
          </span>
          <StatusBadge status={status} />
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
        links={rename && renameLinks?.path === rename.path ? renameLinks.links : null}
        onRename={doRename}
      />
      <DeleteFileConfirm
        isOpen={Boolean(del)}
        onClose={() => setDel(null)}
        file={del}
        onConfirm={() => del && doDelete(del.path)}
      />
      {creating ? (
        <NewNameDialog
          isOpen
          onClose={() => setCreating(null)}
          title={creating === 'setlist' ? t('fileView.newSetlistTitle') : t('fileView.newFolderTitle')}
          folder={lookingAt}
          problem={creating === 'folder' ? folderProblem : undefined}
          onCreate={creating === 'setlist' ? createSetlist : createFolder}
        />
      ) : null}
    </div>
  );
}
