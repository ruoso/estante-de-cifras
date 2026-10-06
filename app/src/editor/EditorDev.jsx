// The `#dev/editor` mount (songs.editor Decision 6). Reachable only at
// `#dev/editor` — absent from the tab bar and normal navigation — it is the
// e2e-web mount point for the editor before its real hosts (songs.reading's
// edit, songs.new_song, the file view) wire its entry points. It opens a song
// from a book already on the device, taken from the hash query
// (`#dev/editor?book=<id>&path=<path>`), or a blank template when none is given
// (or `&new=1`). Like the chart gallery it uses raw dev copy for its own chrome
// (not the i18n catalogues) and inherits the site-wide `.est` theme root.

import { useState } from 'react';
import SongEditor from './SongEditor.jsx';
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
  // The Save seam hands off to songs.save_sheet (Decision 10); that task is not
  // built, so here a clean Save just confirms it would proceed — enough for the
  // e2e to see the voicing-stop clear and Save go through.
  const [saved, setSaved] = useState(false);

  return (
    <main
      className="scroll"
      style={{ padding: 'calc(var(--u) * 2)', height: '100%', display: 'flex', flexDirection: 'column', gap: 'calc(var(--u))' }}
    >
      <h1 className="t-h1">Source editor (dev)</h1>
      {saved && <p role="status">Ready to save.</p>}
      <SongEditor
        key={`${bookId ?? 'new'}:${path ?? ''}`}
        store={store}
        bookId={bookId}
        path={path}
        isNew={isNew}
        onSave={() => setSaved(true)}
      />
    </main>
  );
}
