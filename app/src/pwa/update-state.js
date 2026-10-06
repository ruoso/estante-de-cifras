// The main-thread update store (shell.pwa). It holds whether a new app version
// is waiting and the plugin's `updateSW` function to take it. It touches neither
// IndexedDB nor the Web Worker — it reads only the PWA registration's callbacks
// (DIRECTION §3.7 "the main thread never touches IndexedDB"; shell.pwa
// Constraints "the update affordance lives on the main thread").
//
// The lifecycle is "update on the next launch" (vite.config.js skipWaiting:
// false, workflow 8 no-interruption): a new service worker installs and waits,
// the plugin fires onNeedRefresh, and we surface a quiet, dismissible notice.
// The app never calls skipWaiting/reload on its own — only when the person
// chooses to reload, which is itself a launch (it tears down and rebuilds both
// threads), so it loses no work and keeps the same-build-per-session invariant
// storage.migrations depends on (migrations.md Decision 4).
//
// A tiny useSyncExternalStore-shaped store (subscribe / getSnapshot), like the
// rest of the view's non-Worker state. createUpdateStore() is the testable
// factory; `updateStore` is the singleton the entry wires and the component reads.

export function createUpdateStore() {
  // One frozen snapshot object, swapped on change so getSnapshot stays stable
  // between notifications (useSyncExternalStore compares by reference).
  let snapshot = { updateReady: false };
  // The plugin's updateSW(reload) function, stashed when a new version is
  // actually waiting. Null until then, so reload() is a no-op for a bare
  // registration with no waiting worker.
  let updateSW = null;
  const listeners = new Set();

  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getSnapshot() {
      return snapshot;
    },

    // Wired to the plugin's onNeedRefresh: a new version has installed and is
    // waiting. Stash the updateSW function and surface the notice. Idempotent —
    // a repeat never churns the snapshot.
    onNeedRefresh(sw) {
      updateSW = sw ?? updateSW;
      if (!snapshot.updateReady) {
        snapshot = { updateReady: true };
        notify();
      }
    },

    // Hide the notice without taking the update: the waiting worker still
    // applies on the next launch (updateSW is kept, not cleared).
    dismiss() {
      if (snapshot.updateReady) {
        snapshot = { updateReady: false };
        notify();
      }
    },

    // Take the update now. updateSW(true) skips waiting for this one worker and
    // reloads the page — a launch, so it is safe and loses no work. A no-op when
    // nothing is waiting.
    reload() {
      if (updateSW) updateSW(true);
    },
  };
}

// The singleton: the entry (app/src/main.jsx) feeds it the plugin's onNeedRefresh
// and updateSW; the notice (UpdateReady.jsx) subscribes to it.
export const updateStore = createUpdateStore();
