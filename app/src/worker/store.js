// The main-thread store (DIRECTION §3.7 L397-401). It holds state built by
// folding the Worker's events through the pure reducer into named slices,
// sends commands down the port, and lets components subscribe. It talks to the
// Worker only through the DOM `{ postMessage, onmessage }` endpoint shape — a
// real `Worker` in production, a loopback double in tests — so production
// wiring is a no-op (a `Worker` already is such an endpoint). Decision 2.
//
// The boundary is the point: this module never references `indexedDB`,
// a filesystem, lightning-fs, or isomorphic-git. It imports only the protocol
// constructors and the reducer. Framework-free: no React (the hook knows
// React, not the store).

import { initialState, reduce } from './reducer.js';
import { command, CommandKind } from './protocol.js';

// Wrap a transport endpoint (`{ postMessage, onmessage }`) in a store.
// Exposes `subscribe` + per-slice snapshots for `useSyncExternalStore`, and
// `send` / `open` to issue commands.
export function createStore(endpoint) {
  let state = initialState;
  const listeners = new Set();
  // Raw-event listeners (songs.new_song). Most events fold into a slice and the
  // view reads the slice; a few are TRANSIENT command replies — NEW_SONG_READY
  // — that carry no read model and so add no slice (Decision 5). The new-song
  // host observes those here instead, turning the reply into ephemeral view
  // state. These fire for every event, independent of whether a slice moved.
  const eventListeners = new Set();

  endpoint.onmessage = (messageEvent) => {
    const message = messageEvent.data;
    const next = reduce(state, message);
    // The reducer returns the same reference when nothing changed; only
    // notify when the state object actually moved.
    if (next !== state) {
      state = next;
      for (const listener of listeners) listener();
    }
    // Deliver the raw event to any transient-reply listeners, after the slices
    // have settled so a handler reading a slice sees the folded state.
    for (const listener of eventListeners) listener(message);
  };

  return {
    // `subscribe` and `slice` are stable closures (no `this`), so a component
    // can pass `store.subscribe` straight to `useSyncExternalStore`.
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    slice(name) {
      return state[name];
    },
    getState() {
      return state;
    },
    // Subscribe to raw events (songs.new_song) — the transient command replies
    // that add no slice. Returns an unsubscribe. The listener is called with the
    // event envelope for every message; it filters by kind itself (useStore's
    // `useWorkerEvent` wraps this).
    subscribeEvents(listener) {
      eventListeners.add(listener);
      return () => {
        eventListeners.delete(listener);
      };
    },
    // Send an arbitrary command envelope down the port.
    send(message) {
      endpoint.postMessage(message);
    },
    // Convenience for this task's one command: ask the Worker to open its
    // database and report its meta.
    open() {
      endpoint.postMessage(command(CommandKind.OPEN));
    },
  };
}

// Production factory: spawn the real module Worker and wrap it. This is the
// only place a browser `Worker` is instantiated; see index.js on why the jsdom
// tests cannot reach this line and where e2e-web covers it.
export function createWorkerStore() {
  const worker = new Worker(new URL('./index.js', import.meta.url), {
    type: 'module',
  });
  return createStore(worker);
}

// The one store the running app subscribes to, created lazily and once so a
// re-render (or StrictMode's double-invoke) never spawns a second Worker. In a
// browser it is the real Worker-backed store; where no `Worker` global exists
// (the jsdom unit/behavior tests, which render <App/> directly) it is an inert
// store over a no-op endpoint, so importing the view never reaches the
// `new Worker(...)` line those tests cannot run. The chosen-theme producer
// (storage.preferences_surface) is deferred, so until it lands the
// `preferences` slice stays `{}` and the app resolves to the automatic theme.
let appStore;
export function getAppStore() {
  if (!appStore) {
    appStore =
      typeof Worker === 'function'
        ? createWorkerStore()
        : createStore({ postMessage() {}, onmessage: null });
  }
  return appStore;
}
