import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.jsx';
import { updateStore } from './pwa/update-state.js';
import { getAppStore } from './worker/store.js';
import { createSyncTriggers } from './sync-triggers.js';

// Register the generated service worker as a load-time side effect. VitePWA
// runs with `injectRegister: null` (app/vite.config.js), so nothing registers
// the worker unless the entry does: this call precaches the shell and — via
// `clientsClaim` — takes control of the page, the precondition for the app
// working with no signal (DIRECTION §1 offline-first, §3.7). `immediate: true`
// registers as the entry runs rather than on the window `load` event, closing
// the window before the first offline reload. Registered once at module scope so
// StrictMode's double-invoke does not register twice.
//
// `skipWaiting: false` (vite.config.js) holds a new version as a waiting worker —
// "update on the next launch" (shell.pwa; workflow 8 no-interruption). When one
// is waiting the plugin fires onNeedRefresh; we hand that to the main-thread
// update store, which the shell's quiet, dismissible notice reads. The returned
// updateSW is what Reload now calls to take the update on the person's terms.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    updateStore.onNeedRefresh(updateSW);
  },
});

// Forward the two DOM-only sync triggers (foreground, network back) to the
// Worker's scheduler through the one app store (sync.engine). Wired at the entry
// — the production-only line the jsdom tests never reach (like the real Worker
// in store.js) — so the singleton store the view also uses carries them. The
// Worker sees the other three triggers (open, after-save, the five-minute timer)
// itself.
createSyncTriggers(getAppStore());

// The view is the only layer that knows React (DIRECTION §3.7): the entry
// mounts the app and nothing more.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
