// The pure reducer that folds Worker events into the main-thread store's
// state (DIRECTION §3.7 L397-401). State is a map of named slices; a component
// reads the one slice it needs through `useSlice`. The reducer returns the
// *same* reference for every slice an event does not touch, so "only what
// shows it moves" — `useSyncExternalStore`'s `Object.is` bail-out skips the
// re-render of any component whose slice did not change.
//
// Framework-free: no React here. The reducer never puts a non-cloneable value
// into state; it only ever stores what arrived over the wire.

import { EVENT, EventKind } from './protocol.js';

// The slices a component can subscribe to. Both start empty: no connection to
// the Worker's database yet, no persisted meta yet.
export const initialState = {
  // The lifecycle of the Worker's IndexedDB connection, carried as a word
  // (never colour alone): 'idle' | 'ready' | 'error'.
  connection: { status: 'idle', error: null },
  // The Worker's persisted `meta` record once it reports it, else null.
  meta: null,
};

// Fold one message into the state. Only event-direction messages change
// anything; a command, a malformed message, or an event of an unknown kind
// returns the *same* state reference (forward-compatible: an event kind a
// later build adds is ignored, not a crash).
export function reduce(state, message) {
  if (!message || message.dir !== EVENT) return state;

  switch (message.kind) {
    case EventKind.READY:
      // The connection is up and the Worker reported its meta: both slices
      // move. `meta` becomes the reported record (a plain, cloned object).
      return {
        ...state,
        connection: { status: 'ready', error: null },
        meta: message.payload?.meta ?? null,
      };

    case EventKind.ERROR:
      // Only the connection slice moves; `meta` keeps its reference, so a
      // component showing meta does not re-render on an unrelated error.
      return {
        ...state,
        connection: { status: 'error', error: message.payload ?? null },
      };

    default:
      return state;
  }
}
