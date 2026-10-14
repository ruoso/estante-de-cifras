// EditSongHost.jsx — the in-app host for editing a song that already exists
// (workflow 4 §Editing; W04 board): what the reading view's **Edit** opens. A
// full screen with an appbar (Back, the song's title, Discard) over the source
// editor; the editor's Save opens the ordinary save sheet (a SAVE, not the new
// song's name-and-save), Discard the confirm that always asks.
//
// Presentational like NewSongHost: AppShell owns the `editing` state and closes
// this host on SAVED or Back. A discard reverts the working copy, so the editor
// is remounted to re-read the reverted text, as the dev mount does.

import { useState } from 'react';
import { Button } from 'react-aria-components';
import { t } from '../i18n/index.js';
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

export default function EditSongHost({ store, editing, mode, onBack, onOpenHistory, editorRef }) {
  const { bookId, path, songTitle } = editing;
  const [saveOpen, setSaveOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const title = songTitle || path;
  return (
    <div className="screen new-song">
      <div className="appbar">
        <Button className="btn icon" aria-label={t('reading.back')} onPress={onBack}>
          <BackIcon />
        </Button>
        <span className="title">{title}</span>
        <Button className="btn" onPress={() => setDiscardOpen(true)}>
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
      />
      <SaveSheet
        store={store}
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        bookId={bookId}
        paths={[path]}
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
