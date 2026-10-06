// The `#dev/history` mount (songs.history Decision 5), mirroring `#dev/editor`
// (EditorDev.jsx). The history surface's real entry point is a *history* control
// in the song's toolbar, which belongs to `songs.reading` (a sibling, not a
// dependency); it wires the `onOpenHistory` seam when it lands. Until then — as
// the chart shipped behind `#dev/chart` and the editor behind `#dev/editor`
// before a song screen existed — history stands up behind `#dev/history` so its
// behaviour and e2e run now. Reachable only at the hash; absent from the tab bar.
//
// It opens a song from a book already on the device, taken from the hash query
// (`#dev/history?book=<id>&path=<path>`), mounts SongHistory, and plays the host
// half of the RESTORED handshake: when a version is restored into the working
// copy, it opens the save sheet on the song so the restored copy is saved as a
// new version (workflow 6 L59-62; storage/history.md RESTORED→save-sheet).

import { useState } from 'react';
import SongHistory from './SongHistory.jsx';
import SaveSheet from './SaveSheet.jsx';
import { getAppStore } from '../worker/store.js';

function historyDevParams() {
  if (typeof location === 'undefined') return { bookId: null, path: null };
  const hash = location.hash;
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  return { bookId: params.get('book') || null, path: params.get('path') || null };
}

export default function HistoryDev({ store = getAppStore() }) {
  const { bookId, path } = historyDevParams();
  const [saveOpen, setSaveOpen] = useState(false);

  if (!bookId || !path) {
    return (
      <main className="scroll" style={{ padding: 'calc(var(--u) * 2)' }}>
        <h1 className="t-h1">Song history (dev)</h1>
        <p className="t-body">Open with #dev/history?book=&lt;id&gt;&amp;path=&lt;path&gt;.</p>
      </main>
    );
  }

  return (
    <>
      <SongHistory
        store={store}
        bookId={bookId}
        path={path}
        onBack={() => {
          if (typeof history !== 'undefined') history.back();
        }}
        onRestored={() => setSaveOpen(true)}
      />
      <SaveSheet
        store={store}
        isOpen={saveOpen}
        onClose={() => setSaveOpen(false)}
        bookId={bookId}
        paths={[path]}
      />
    </>
  );
}
