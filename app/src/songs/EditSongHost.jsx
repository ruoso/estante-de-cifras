// EditSongHost.jsx — the in-app host for editing a song that already exists
// (workflow 4 §Editing; W04 board): what the reading view's **Edit** opens. A
// full screen with an appbar (Back, the song's title, Discard) over the source
// editor; the editor's Save opens the ordinary save sheet (a SAVE, not the new
// song's name-and-save), Discard the confirm that always asks.
//
// In a book the user cannot save to, Save opens the make-it-your-own offer
// (workflow 4 §A book the user cannot push to; books.fork Constraint 7).
//
// Presentational like NewSongHost: AppShell owns the `editing` state and closes
// this host on SAVED or Back. A discard reverts the working copy, so the editor
// is remounted to re-read the reverted text, as the dev mount does.

import { useRef, useState } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
import { useSlice } from '../worker/useStore.js';
import { saveTargetFor } from '../books/book-display.js';
import SongEditor from '../editor/SongEditor.jsx';
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

export default function EditSongHost({
  store,
  editing,
  mode,
  onBack,
  onOpenHistory,
  editorRef,
  onMakeYourOwn = () => {},
}) {
  const { bookId, path, songTitle } = editing;
  const [saveOpen, setSaveOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  // The editor's flush: Discard sits outside the editor, so it sends a
  // still-debounced edit before the confirm previews what would be lost
  // (workflow 4 §Discarding; songs.discard_summary).
  const flushRef = useRef(null);
  const openDiscard = () => {
    flushRef.current?.();
    setDiscardOpen(true);
  };
  const [reloadKey, setReloadKey] = useState(0);
  const title = songTitle || path;
  // Whether a save can go to this book (books.fork Constraint 7): a reader's
  // book opens the make-it-your-own offer, not the form. The host's own id
  // follows BOOK_FORKED (AppShell), so the editor re-reads the fork.
  const shelf = useSlice(store, 'shelf');
  const target = saveTargetFor(shelf, bookId);
  return (
    <div className="screen new-song">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('reading.back')} onPress={onBack}>
          <BackIcon />
        </Button>
        <span className="title">{title}</span>
        <Button className="btn" onPress={openDiscard}>
          {t('saveSheet.discard')}
        </Button>
      </div>
      <SongEditor
        key={`${bookId}:${path}:${reloadKey}`}
        store={store}
        bookId={bookId}
        path={path}
        title={songTitle}
        layoutMode={mode}
        onSave={() => setSaveOpen(true)}
        onOpenHistory={onOpenHistory}
        editorRef={editorRef}
        flushRef={flushRef}
      />
      <SaveSheet
        store={store}
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        bookId={bookId}
        paths={[path]}
        titleHint={title}
        bookLabel={target.label}
        canSave={target.canSave}
        onMakeYourOwn={onMakeYourOwn}
      />
      <DiscardConfirm
        store={store}
        isOpen={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onDiscarded={() => setReloadKey((k) => k + 1)}
        bookId={bookId}
        paths={[path]}
        titleHint={title}
      />
    </div>
  );
}
