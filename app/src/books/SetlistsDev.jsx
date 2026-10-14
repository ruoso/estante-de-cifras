// The `#dev/setlists` mount (books.setlists Decision 3; mirrors ReadingDev /
// FilesDev). Reachable only at `#dev/setlists?book=<id>&path=<path>` — absent
// from the tab bar and normal navigation — it stands the setlist surface up
// before its real host (the Setlists destination tap, wired in AppShell in this
// same task) so the behavior and e2e journeys open a seeded setlist on every
// viewport. Back is a no-op at a dev mount with no shell behind it.

import { getAppStore } from '../worker/store.js';
import { useLayoutMode } from '../shell/AppShell.jsx';
import SetlistView from './SetlistView.jsx';

function setlistsDevParams() {
  if (typeof location === 'undefined') return { bookId: null, path: null };
  const hash = location.hash;
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  return { bookId: params.get('book') || null, path: params.get('path') || null };
}

export default function SetlistsDev({ store = getAppStore() }) {
  const { bookId, path } = setlistsDevParams();
  const mode = useLayoutMode();
  return <SetlistView store={store} bookId={bookId} path={path} mode={mode} />;
}
