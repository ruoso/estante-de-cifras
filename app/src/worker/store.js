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

  endpoint.onmessage = (messageEvent) => {
    const next = reduce(state, messageEvent.data);
    // The reducer returns the same reference when nothing changed; only
    // notify when the state object actually moved.
    if (next !== state) {
      state = next;
      for (const listener of listeners) listener();
    }
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
