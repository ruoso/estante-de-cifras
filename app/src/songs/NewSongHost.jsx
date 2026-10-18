// NewSongHost.jsx — the in-app host for a new song (songs.new_song, workflow 3;
// W03 board). It is the first real host of the editor `songs.editor` (which
// shipped behind `#dev/editor`): a full screen with an appbar, the which-book
// bar, and the `SongEditor` itself, rendered once the Worker has allocated a
// concrete book and placeholder path (the host mounts it only after
// NEW_SONG_READY, so the editor's debounced WRITE persists from the first
// keystroke — Decision 2).
//
// The W03 board draws this full-screen with a Back affordance on every viewport
// (the desktop has a Back button and no app rail); the editor's own text/preview
// split is the wide layout, handled by `SongEditor` off `layoutMode`. Presen‐
// tational: the editing state, the NEW_SONG/NAME_AND_SAVE sends and the
// change-book re-target all live in the host's owner (AppShell); this renders
// them and routes presses back through callbacks. The unsaved mark carries the
// word (never colour alone, mockups README L26).
//
// The chrome is the one both hosts draw (EditorChrome; songs.editor_chrome): on a
// phone *Back · {title} · Save*, the unsaved strip from the start (a new song is
// unsaved until its first save) above the which-book bar, and Add section and
// Discard in a bottom bar; on a tablet and a computer all of it in the header.
// The header names the song by its first heading as typed (Constraint 4). The
// first save is a bottom sheet on a phone and a centred dialog on a tablet and a
// computer (W03#4; Decision 3).

import { useRef, useState } from 'react';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { bookLabelFor } from './first-run.js';
import SongEditor from '../editor/SongEditor.jsx';
import EditorChrome from './EditorChrome.jsx';
import WhichBook from './WhichBook.jsx';
import SaveSheet from './SaveSheet.jsx';
import DiscardConfirm from './DiscardConfirm.jsx';
import './new-song.css';

export default function NewSongHost({
  store,
  editing,
  mode,
  onBack,
  onChangeBook,
  onOpenHistory,
  editorRef,
}) {
  const { bookId, path, isNew, songTitle } = editing;
  const phone = mode === 'narrow';
  // The first save names the book the song goes into (songs.first_save_fields
  // Constraint 4), labelled as the which-book line names it.
  const shelf = useSlice(store, 'shelf');
  // The editor owns Save and its pre-save gate; the host owns what Save does
  // (editor Decision 10) — it opens the save sheet (songs.save_sheet Decision 1).
  // Discard is the host's own destructive affordance, which always asks.
  const [saveOpen, setSaveOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  // The editor's flush, gate and Add section, for the chrome's buttons outside
  // it (songs.discard_summary; songs.editor_chrome Constraints 2-3).
  const flushRef = useRef(null);
  const saveRef = useRef(null);
  const addSectionRef = useRef(null);
  const openDiscard = () => {
    flushRef.current?.();
    setDiscardOpen(true);
  };
  // The `#` title as typed (Constraint 4), else the one the song started with.
  const [liveTitle, setLiveTitle] = useState(null);
  const title = liveTitle || songTitle || t('newSong.untitled');
  return (
    <EditorChrome
      title={title}
      unsaved
      layout={phone ? 'phone' : 'wide'}
      backLabel={t('newSong.back')}
      onBack={onBack}
      onSave={() => saveRef.current?.()}
      onDiscard={openDiscard}
      onAddSection={() => addSectionRef.current?.()}
    >
      <WhichBook store={store} bookId={bookId} onChangeBook={onChangeBook} />
      {/* Keyed by book:path so changing the book (a re-target) remounts the
          editor on the new file (editor.md note; EditorDev uses the same key). */}
      <SongEditor
        key={`${bookId}:${path}`}
        store={store}
        bookId={bookId}
        path={path}
        isNew={isNew}
        title={songTitle}
        layoutMode={mode}
        onSave={() => setSaveOpen(true)}
        onOpenHistory={onOpenHistory}
        onTitleChange={setLiveTitle}
        editorRef={editorRef}
        flushRef={flushRef}
        saveRef={saveRef}
        addSectionRef={phone ? addSectionRef : undefined}
      />
      <p className="t-small new-song-note">{t('newSong.notationNote')}</p>
      <SaveSheet
        store={store}
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        bookId={bookId}
        paths={[path]}
        isNew
        fromPath={path}
        titleHint={liveTitle || songTitle}
        bookLabel={bookLabelFor(shelf, bookId)}
        presentation={phone ? 'sheet' : 'dialog'}
      />
      <DiscardConfirm
        store={store}
        isOpen={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onDiscarded={onBack}
        bookId={bookId}
        paths={[path]}
        titleHint={title}
      />
    </EditorChrome>
  );
}
