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

import { useSyncExternalStore } from 'react';

export function useSlice(store, name) {
  return useSyncExternalStore(
    store.subscribe,
    () => store.slice(name),
    () => store.slice(name),
  );
}
