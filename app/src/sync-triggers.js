// sync-triggers.js — the thin main-thread adapter that forwards the two
// DOM-only sync triggers to the Worker (sync.engine). The scheduler lives in the
// Worker, which owns the data (DIRECTION §3.7), and sees three of the five
// triggers itself (open, after-save, the five-minute timer). The remaining two —
// return to the foreground and the network coming back — are only visible to the
// document, so this adapter listens for them and forwards each as a SYNC command
// through the store, where the Worker's scheduler coalesces it with the rest
// (workflow 8 §When it runs; Decision "a thin main-thread adapter").
//
// It is the precedent set by auth-client.js: a small main-thread module that
// touches no IndexedDB, git or index and so never crosses the Worker boundary.
// It forwards an opaque command carrying only a `reason` string — never song
// text, a book id or any data (standing no-logging rule). Framework-free: no
// React (the view mounts it once; it is not a component).

import { command, CommandKind } from './worker/protocol.js';

/**
 * Wire the two DOM-only triggers to `store`. Returns a teardown that removes the
 * listeners. `doc`/`win` are injectable (default the globals) so a test drives
 * them without a real document. A `visibilitychange` is forwarded only when the
 * page became visible (returning to the foreground — not when it was hidden);
 * `online` is forwarded whenever the network comes back.
 *
 * @param {{ send: (message: object) => void }} store
 * @param {{ doc?: Document, win?: (Window & typeof globalThis) }} [deps]
 * @returns {() => void} teardown
 */
export function createSyncTriggers(store, { doc = globalThis.document, win = globalThis } = {}) {
  const onVisibility = () => {
    // Only the hidden → visible edge is a trigger: coming back to the app asks
    // whether anything moved while it was away (workflow 8 L15-16).
    if (!doc || doc.visibilityState === 'visible') {
      store.send(command(CommandKind.SYNC, { reason: 'foreground' }));
    }
  };
  const onOnline = () => {
    store.send(command(CommandKind.SYNC, { reason: 'online' }));
  };

  doc?.addEventListener?.('visibilitychange', onVisibility);
  win?.addEventListener?.('online', onOnline);

  return function stop() {
    doc?.removeEventListener?.('visibilitychange', onVisibility);
    win?.removeEventListener?.('online', onOnline);
  };
}
