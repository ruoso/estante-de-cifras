// The wizard surface's dev mount, `#dev/wizard` — mirroring `#dev/arrange`
// (ArrangeDev). Its real entry is arrange's `onRunWizard` seam, wired in AppShell
// (songs.wizard_ui); the dev mount stands the surface up at
// `#dev/wizard?book=<id>&path=<path>` so its behavior and e2e journeys open a
// seeded song and run the wizard on every viewport. It picks the layout mode the
// way AppShell does (`useLayoutMode`) so the phone / tablet / computer projects
// exercise the narrow screen and the wide side-by-side. Back is a no-op at a dev
// mount with no shell behind it.

import { getAppStore } from '../worker/store.js';
import { useLayoutMode } from '../shell/AppShell.jsx';
import SongWizard from './SongWizard.jsx';

function wizardDevParams() {
  if (typeof location === 'undefined') return { bookId: null, path: null };
  const hash = location.hash;
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  const params = new URLSearchParams(query);
  return { bookId: params.get('book') || null, path: params.get('path') || null };
}

export default function WizardDev({ store = getAppStore() }) {
  const { bookId, path } = wizardDevParams();
  const mode = useLayoutMode();
  return <SongWizard store={store} bookId={bookId} path={path} mode={mode} />;
}
