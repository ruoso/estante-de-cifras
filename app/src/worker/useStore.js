// The `useSyncExternalStore` binding (DIRECTION §3.7 L397-401). This is the
// one layer below the view that knows React. A component calls
// `useSlice(store, name)` to read a single named slice; it re-renders only
// when that slice changes, because the reducer keeps every untouched slice
// referentially stable and `useSyncExternalStore`'s `Object.is` comparison
// bails out of the rest ("only what shows it moves").
//
// No selector shim: DIRECTION says components read "the slices they need" —
// named slices, not arbitrary derived selectors (Decision 3). A component that
// wants a derived value memoizes it itself, with the React Compiler already on.

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { EVENT } from './protocol.js';

export function useSlice(store, name) {
  return useSyncExternalStore(
    store.subscribe,
    () => store.slice(name),
    () => store.slice(name),
  );
}

// Observe a transient Worker event of one `kind` (songs.new_song): the command
// replies that carry no read model and so add no slice — NEW_SONG_READY, and the
// first-save SAVED the new-song host turns into ephemeral view state (Decision
// 5). `handler` is called with the event payload. It is NOT a `useSyncExternal‐
// Store` subscription: these are one-shot signals, not state a component renders
// from. The latest handler is held in a ref so re-renders do not re-subscribe,
// and a store with no `subscribeEvents` (the inert no-op store) is a no-op.
export function useWorkerEvent(store, kind, handler) {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(() => {
    if (typeof store?.subscribeEvents !== 'function') return undefined;
    return store.subscribeEvents((message) => {
      if (message?.dir === EVENT && message.kind === kind) {
        handlerRef.current?.(message.payload);
      }
    });
  }, [store, kind]);
}
