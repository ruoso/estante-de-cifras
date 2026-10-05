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
  // (never colour alone): 'idle' | 'ready' | 'error'. `persisted` carries the
  // result of `navigator.storage.persist()` once storage comes up — true
  // (granted) / false (denied) / null (unavailable or not asked yet) — so a
  // later task can nudge toward export when the durable store was denied
  // (DIRECTION §3 L114-115).
  connection: { status: 'idle', error: null, persisted: null },
  // The Worker's persisted `meta` record once it reports it, else null.
  meta: null,
  // The home book's preferences (preferences.json), a flat map of `{value, at}`
  // registers keyed by name — `theme`, `language`, … (home-book-format §4.1).
  // The theme root reads `preferences.theme.value` to resolve the applied theme
  // (shell.tokens). Starts empty: no register until the user chooses, and the
  // producer that reads the home book (storage.preferences_surface) is deferred,
  // so while absent the app's theme is automatic, following the device.
  preferences: {},
  // The outcome of the last save/discard per book, keyed by `bookId`
  // (storage.working_copy). Each entry carries its status as a word (never
  // colour alone): 'saved' (with `commit` and whether the push landed),
  // 'discarded', or 'refused' (with the refused `path`/`reason` and the first
  // marker `line`/`marker`). A book an event does not touch keeps its exact
  // entry reference, so a view watching one book does not re-render on another's
  // save. Starts empty: nothing saved yet.
  save: {},
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
      // move. `meta` becomes the reported record (a plain, cloned object);
      // `persisted` carries the storage-durability result from bring-up.
      return {
        ...state,
        connection: {
          status: 'ready',
          error: null,
          persisted: message.payload?.persisted ?? null,
        },
        meta: message.payload?.meta ?? null,
      };

    case EventKind.ERROR:
      // Only the connection slice moves; `meta` keeps its reference, so a
      // component showing meta does not re-render on an unrelated error.
      return {
        ...state,
        connection: { status: 'error', error: message.payload ?? null },
      };

    case EventKind.SAVED: {
      // A save landed: record the commit and whether the push landed, under the
      // book's key. Only this book's entry moves; the rest of `save` keeps its
      // references (DIRECTION §3.7 "only what shows it moves").
      const bookId = message.payload?.bookId;
      if (!bookId) return state;
      return {
        ...state,
        save: {
          ...state.save,
          [bookId]: {
            status: 'saved',
            commit: message.payload?.commit ?? null,
            pushed: message.payload?.pushed ?? null,
          },
        },
      };
    }

    case EventKind.DISCARDED: {
      const bookId = message.payload?.bookId;
      if (!bookId) return state;
      return {
        ...state,
        save: { ...state.save, [bookId]: { status: 'discarded' } },
      };
    }

    case EventKind.SAVE_REFUSED: {
      // A marked or unreadable file stopped the save: carry the refused path and
      // reason as a word, with the first marker line, so the view can point at it.
      const bookId = message.payload?.bookId;
      if (!bookId) return state;
      return {
        ...state,
        save: {
          ...state.save,
          [bookId]: {
            status: 'refused',
            path: message.payload?.path ?? null,
            reason: message.payload?.reason ?? null,
            line: message.payload?.line ?? null,
            marker: message.payload?.marker ?? null,
          },
        },
      };
    }

    case EventKind.PREFERENCES:
      // The home book's preferences surfaced (or changed): replace the slice
      // with the reported map of registers. Only this slice moves; a component
      // watching, say, `save` keeps its reference and does not re-render
      // ("only what shows it moves"). An absent payload resets to empty.
      return { ...state, preferences: message.payload ?? {} };

    default:
      return state;
  }
}
