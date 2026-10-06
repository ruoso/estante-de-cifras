// A dev mount for the file view (books.file_view Decision 7), mirroring
// editor/EditorDev.jsx and songs/HistoryDev.jsx: it stands the surface up at
// `#dev/files?book=<id>` before every real entry point exists, so the e2e
// journey and hand testing can reach it. The real entry is the per-book Files
// control on the book-management screen (wired through AppShell).

import { getAppStore } from '../worker/store.js';
import { useLayoutMode } from '../shell/AppShell.jsx';
import FileView from './FileView.jsx';

export function filesDevParams() {
  const query = typeof location === 'undefined' ? '' : location.hash.split('?')[1] ?? '';
  const params = new URLSearchParams(query);
  return { bookId: params.get('book') };
}

export default function FilesDev({ store = getAppStore() }) {
  const mode = useLayoutMode();
  const { bookId } = filesDevParams();

  if (!bookId) {
    return (
      <main className="scroll">
        <h1 className="t-h1">File view (dev)</h1>
        <p className="t-body">Open #dev/files?book=&lt;id&gt; to view a book's files.</p>
      </main>
    );
  }

  return (
    <FileView
      store={store}
      bookId={bookId}
      mode={mode}
      onBack={() => {
        if (typeof history !== 'undefined') history.back();
      }}
    />
  );
}
