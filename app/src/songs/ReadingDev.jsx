// The `#dev/reading` mount (songs.reading Decision 5). Reachable only at
// `#dev/reading?book=<id>&path=<path>` — absent from the tab bar and normal
// navigation — it stands the reading view up before its real host (the search
// result tap in AppShell, wired in this same task) so the behavior and e2e
// journeys can open a seeded song on every viewport. Mirrors `#dev/editor`
// (EditorDev) and `#dev/history` (HistoryDev).
//
// It picks the layout mode the same way AppShell does (`useLayoutMode`), so the
// e2e's phone / tablet / computer projects exercise the narrow screen and the
// wide master-detail. The reading view's toolbar seams (edit, history, arrange,
// add to setlist, share) are sibling tasks' and route nowhere here; Back is a
// no-op at a dev mount with no shell behind it.

import { getAppStore } from '../worker/store.js';
import { useLayoutMode } from '../shell/AppShell.jsx';
import SongReading from './SongReading.jsx';

function readingDevParams() {
  if (typeof location === 'undefined') return { bookId: null, path: null };
  const hash = location.hash;
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  return { bookId: params.get('book') || null, path: params.get('path') || null };
}

export default function ReadingDev({ store = getAppStore() }) {
  const { bookId, path } = readingDevParams();
  const mode = useLayoutMode();
  return <SongReading store={store} bookId={bookId} path={path} mode={mode} />;
}
