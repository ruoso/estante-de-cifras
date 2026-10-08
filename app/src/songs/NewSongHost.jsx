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
// them and routes presses back through callbacks. The unsaved badge carries the
// word "unsaved" (never colour alone, mockups README L26).

import { useState } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import SongEditor from '../editor/SongEditor.jsx';
import WhichBook from './WhichBook.jsx';
import SaveSheet from './SaveSheet.jsx';
import DiscardConfirm from './DiscardConfirm.jsx';
import './new-song.css';

function BackIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

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
  // The editor owns Save and its pre-save gate; the host owns what Save does
  // (editor Decision 10) — it opens the save sheet (songs.save_sheet Decision 1).
  // Discard is the host's own destructive affordance, which always asks.
  const [saveOpen, setSaveOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  return (
    <div className="screen new-song">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('newSong.back')} onPress={onBack}>
          <BackIcon />
        </Button>
        <span className="title">{songTitle || t('newSong.untitled')}</span>
        <span className="badge unsaved dot">{t('newSong.unsaved')}</span>
        <Button className="btn" onPress={() => setDiscardOpen(true)}>
          {t('saveSheet.discard')}
        </Button>
      </div>
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
        editorRef={editorRef}
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
        titleHint={songTitle}
      />
      <DiscardConfirm
        store={store}
        isOpen={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onDiscarded={onBack}
        bookId={bookId}
        paths={[path]}
        titleHint={songTitle || t('newSong.untitled')}
      />
    </div>
  );
}
