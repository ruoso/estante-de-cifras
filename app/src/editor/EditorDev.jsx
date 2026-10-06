// The `#dev/editor` mount (songs.editor Decision 6). Reachable only at
// `#dev/editor` — absent from the tab bar and normal navigation — it is the
// e2e-web mount point for the editor before its real hosts (songs.reading's
// edit, songs.new_song, the file view) wire its entry points. It opens a song
// from a book already on the device, taken from the hash query
// (`#dev/editor?book=<id>&path=<path>`), or a blank template when none is given
// (or `&new=1`). Like the chart gallery it uses raw dev copy for its own chrome
// (not the i18n catalogues) and inherits the site-wide `.est` theme root.
//
// Save and Discard hand off to songs.save_sheet (Decision 1): when a concrete
// book and path are open, Save opens the SaveSheet (an ordinary SAVE) and
// Discard the DiscardConfirm; a discard reverts the working copy, so the editor
// is remounted to reload the reverted text. The blank-template case (`new=1`,
// no book) has nowhere to commit, so it keeps a lightweight confirmation — the
// editor's pre-save gate is what that case exercises.

import { useState } from 'react';
import { Button } from 'react-aria-components';
import SongEditor from './SongEditor.jsx';
import SaveSheet from '../songs/SaveSheet.jsx';
import DiscardConfirm from '../songs/DiscardConfirm.jsx';
import { t } from '../i18n/index.js';
import { getAppStore } from '../worker/store.js';

function editorDevParams() {
  if (typeof location === 'undefined') return { bookId: null, path: null, isNew: true };
  const hash = location.hash;
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  const bookId = params.get('book') || null;
  const path = params.get('path') || null;
  const hasSong = Boolean(bookId && path);
  return { bookId, path, isNew: params.get('new') === '1' || !hasSong };
}

export default function EditorDev({ store = getAppStore() }) {
  const { bookId, path, isNew } = editorDevParams();
  const hasSong = Boolean(bookId && path);
  // The blank-template case (no book) has nowhere to commit, so it keeps the
  // old confirmation; a concrete song opens the real save sheet.
  const [saved, setSaved] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  // A discard reverts the working copy; bump the key so the editor remounts and
  // re-reads the reverted text from the working copy (OPEN_SOURCE).
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <main
      className="scroll"
      style={{ padding: 'calc(var(--u) * 2)', height: '100%', display: 'flex', flexDirection: 'column', gap: 'calc(var(--u))' }}
    >
      <h1 className="t-h1">Source editor (dev)</h1>
      {saved && <p role="status">Ready to save.</p>}
      {hasSong && (
        <Button className="btn" onPress={() => setDiscardOpen(true)}>
          {t('saveSheet.discard')}
        </Button>
      )}
      <SongEditor
        key={`${bookId ?? 'new'}:${path ?? ''}:${reloadKey}`}
        store={store}
        bookId={bookId}
        path={path}
        isNew={isNew}
        onSave={() => (hasSong ? setSaveOpen(true) : setSaved(true))}
      />
      {hasSong && (
        <>
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
          />
        </>
      )}
    </main>
  );
}
