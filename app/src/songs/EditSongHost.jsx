// EditSongHost.jsx — the in-app host for editing a song that already exists
// (workflow 4 §Editing; W04 board): what the reading view's **Edit** opens. A
// full screen in the editor chrome both hosts share (EditorChrome; songs.
// editor_chrome): the header names the song by its title as the text has it
// now, carries Save (the editor's gate, through `saveRef`) and — on a tablet or
// computer — *unsaved changes* and Discard; on a phone the mark sits on a strip
// of its own and Add section and Discard in a bottom bar (W04#1).
//
// Where the save sits follows the device (Constraint 7): a bottom sheet on a
// phone, a centred dialog on a tablet, and on a computer (EDITOR_WIDE_QUERY) an
// inline panel beside the song, with the *Unsaved* pane on the other side
// (W04#4). In a book the user cannot save to, Save opens the make-it-your-own
// offer (workflow 4 §A book the user cannot push to; books.fork Constraint 7).
//
// Presentational like NewSongHost: AppShell owns the `editing` state and closes
// this host on SAVED or Back; `onEdit` opens another unsaved song from the pane.
// A discard reverts the working copy, so the editor is remounted to re-read the
// reverted text, as the dev mount does.

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { saveTargetFor } from '../books/book-display.js';
import { EDITOR_WIDE_QUERY } from '../shell/layout-mode.js';
import SongEditor from '../editor/SongEditor.jsx';
import EditorChrome from './EditorChrome.jsx';
import UnsavedPane from './UnsavedPane.jsx';
import SaveSheet from './SaveSheet.jsx';
import DiscardConfirm from './DiscardConfirm.jsx';
import './new-song.css';

// The computer's three columns engage from EDITOR_WIDE_QUERY (Decision 8): the
// same `matchMedia`/`useSyncExternalStore` seam the shell and the reading view
// use; a missing `matchMedia` (jsdom) reads as not-wide.
function editorWideQuery() {
  return typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia(EDITOR_WIDE_QUERY) : null;
}
function subscribeEditorWide(onChange) {
  const query = editorWideQuery();
  if (!query?.addEventListener) return () => {};
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
function readEditorWide() {
  return editorWideQuery()?.matches ?? false;
}

export default function EditSongHost({
  store,
  editing,
  mode,
  onBack,
  onOpenHistory,
  onEdit = () => {},
  editorRef,
  onMakeYourOwn = () => {},
}) {
  const { bookId, path, songTitle } = editing;
  const editorWide = useSyncExternalStore(subscribeEditorWide, readEditorWide, readEditorWide);
  const phone = mode === 'narrow';
  const computer = !phone && editorWide;
  const layout = phone ? 'phone' : computer ? 'computer' : 'tablet';

  const [saveOpen, setSaveOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  // The editor's flush, gate and Add section: Discard and Save sit outside the
  // editor (songs.discard_summary; songs.editor_chrome Constraints 2-3).
  const flushRef = useRef(null);
  const saveRef = useRef(null);
  const addSectionRef = useRef(null);
  const saveButtonRef = useRef(null);
  const openDiscard = () => {
    flushRef.current?.();
    setDiscardOpen(true);
  };
  const [reloadKey, setReloadKey] = useState(0);
  // Reported by the editor (SOURCE's `unsaved`, or an edit since); a Discard
  // remounts it, and the fresh SOURCE reports false.
  const [unsaved, setUnsaved] = useState(false);
  // The `#` title as the text has it now (Constraint 4), else the host's.
  const [liveTitle, setLiveTitle] = useState(null);
  const title = liveTitle || songTitle || path;
  // The panel follows the text (Constraint 8): each WRITE bumps the revision.
  const [revision, setRevision] = useState(0);
  const onWrite = useCallback(() => setRevision((r) => r + 1), []);
  // Whether a save can go to this book (books.fork Constraint 7): a reader's
  // book opens the make-it-your-own offer, not the form. The host's own id
  // follows BOOK_FORKED (AppShell), so the editor re-reads the fork.
  const shelf = useSlice(store, 'shelf');
  const target = saveTargetFor(shelf, bookId);
  const panelOpen = computer && saveOpen;
  const closeSave = () => {
    setSaveOpen(false);
    // The panel is no overlay, so nothing restores focus for it: back to Save.
    if (panelOpen) saveButtonRef.current?.focus();
  };
  // Another unsaved song from the pane: AppShell re-points `editing`, and the
  // editor remounts on it (its key); what this host showed for the last one goes.
  const editAnother = (song) => {
    setSaveOpen(false);
    setLiveTitle(null);
    onEdit(song);
  };
  const current = useMemo(() => ({ bookId, path, title, unsaved }), [bookId, path, title, unsaved]);

  return (
    <EditorChrome
      title={title}
      unsaved={unsaved}
      layout={layout}
      backLabel={t('reading.back')}
      onBack={onBack}
      onSave={() => saveRef.current?.()}
      onDiscard={openDiscard}
      onAddSection={() => addSectionRef.current?.()}
      saveButtonRef={saveButtonRef}
    >
      <div className="edit-song-body">
        {computer ? <UnsavedPane store={store} current={current} onEdit={editAnother} /> : null}
        <div className="edit-song-main">
          <SongEditor
            key={`${bookId}:${path}:${reloadKey}`}
            store={store}
            bookId={bookId}
            path={path}
            title={songTitle}
            layoutMode={mode}
            onSave={() => setSaveOpen(true)}
            onOpenHistory={onOpenHistory}
            onUnsavedChange={setUnsaved}
            onTitleChange={setLiveTitle}
            onWrite={onWrite}
            showPreview={!panelOpen}
            editorRef={editorRef}
            flushRef={flushRef}
            saveRef={saveRef}
            addSectionRef={phone ? addSectionRef : undefined}
          />
        </div>
        <SaveSheet
          store={store}
          isOpen={saveOpen}
          onClose={closeSave}
          bookId={bookId}
          paths={[path]}
          titleHint={title}
          bookLabel={target.label}
          canSave={target.canSave}
          onMakeYourOwn={onMakeYourOwn}
          presentation={phone ? 'sheet' : computer ? 'panel' : 'dialog'}
          revision={revision}
          beforeSave={() => saveRef.current?.() !== false}
        />
      </div>
      <DiscardConfirm
        store={store}
        isOpen={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onDiscarded={() => {
          setSaveOpen(false);
          setReloadKey((k) => k + 1);
        }}
        bookId={bookId}
        paths={[path]}
        titleHint={title}
      />
    </EditorChrome>
  );
}
