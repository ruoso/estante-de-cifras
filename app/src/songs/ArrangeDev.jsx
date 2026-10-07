// The arrange surface's dev mount, `#dev/arrange` — mirroring `#dev/reading`
// (ReadingDev). Its real entry point is the reading view's `onArrange` seam,
// wired in AppShell in this same task; the dev mount stands the surface up at
// `#dev/arrange?book=<id>&path=<path>` so its behavior and e2e journeys open a
// seeded song and arrange it on every viewport. It picks the layout mode the way
// AppShell does (`useLayoutMode`) so the phone / tablet / computer projects
// exercise the narrow screen and the wide side-by-side. Back and Run-the-wizard
// are no-ops at a dev mount with no shell behind them.

import { getAppStore } from '../worker/store.js';
import { useLayoutMode } from '../shell/AppShell.jsx';
import SongArrange from './SongArrange.jsx';

function arrangeDevParams() {
  if (typeof location === 'undefined') return { bookId: null, path: null };
  const hash = location.hash;
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  return { bookId: params.get('book') || null, path: params.get('path') || null };
}

export default function ArrangeDev({ store = getAppStore() }) {
  const { bookId, path } = arrangeDevParams();
  const mode = useLayoutMode();
  return <SongArrange store={store} bookId={bookId} path={path} mode={mode} />;
}
