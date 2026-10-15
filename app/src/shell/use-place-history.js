// use-place-history.js — the browser's history follows the place (shell.routing;
// DIRECTION §3.7 "The address follows where you are"). The History API under
// the app's own module, not a routing library (Decision 5); the URL is view
// state held by AppShell, and the Worker never sees it.
//
// Every entry this hook writes carries `history.state = { place, layers, depth }`:
// the place (place.js), the full-screen surfaces open over it (`layers`, kinds
// such as 'editor' or 'history'), and how many entries this app has pushed
// below it. AppShell renders as before and hands the hook what it shows:
//
//   - opening a song, a setlist or a one-book scope, or a surface over the
//     place, PUSHES an entry (depth + 1); a surface keeps the place's address
//     (Decision 3);
//   - anything else — a tab switch (Decision 4), a close not made through
//     `back` — REPLACES the entry, or steps back when the entry below is
//     exactly what is now shown (so a save closing the editor leaves no dead
//     step behind);
//   - `back(close)` is every in-app Back: above depth 0 it is `history.back()`,
//     and `popstate` applies the entry below; at depth 0 it runs `close`. The
//     in-app Back and the system back never disagree;
//   - `popstate` hands the entry's place and layers to `onApply`; a layer is
//     never reopened by it — only the layers still open and named by the entry
//     are kept, and the entry is rewritten to say so; a step back onto an
//     entry from before a reload that shows the same address (a layer the
//     reload dropped) keeps going back;
//   - `renameBook` follows a book whose id changed (a fork, a put-online): the
//     current entry is replaced, and an entry below naming the old id is read
//     as naming the new one when `popstate` lands on it. The record of renames
//     (book-renames.js) is kept in `sessionStorage`, so it outlives a reload as
//     the tab's history entries do.
//
// A reload keeps only what the address says: `bootEntry` parses the pathname,
// drops the layers, and keeps the depth so back still walks the earlier entries.

import { useCallback, useEffect, useRef } from 'react';
import { isOpening, placeFromUrl, samePlace, urlFromPlace } from './place.js';
import { readRenames, recordRename, resolveBookId, writeRenames } from './book-renames.js';

// The tab's sessionStorage, or null where there is none (or reaching it throws).
function sessionStore() {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage;
  } catch {
    return null;
  }
}

// The place a session starts on: the address's (`fromAddress` when it names a
// book, a song or a setlist — AppShell resolves those before opening them), or
// search for any other path. `depth` is kept from the entry a reload landed on.
export function bootEntry() {
  if (typeof location === 'undefined') return { place: { tab: 'search' }, fromAddress: false, depth: 0 };
  const parsed = placeFromUrl(location.pathname);
  const state = typeof history === 'undefined' ? null : history.state;
  const depth = Number.isInteger(state?.depth) && state.depth > 0 ? state.depth : 0;
  return {
    place: parsed ?? { tab: 'search' },
    fromAddress: Boolean(parsed && (parsed.book || parsed.song || parsed.setlist)),
    depth,
  };
}

// A place with every book id it holds passed through `rename` (an id → its
// current id).
function renamePlace(place, rename) {
  if (!place) return place;
  const item = (it) => (it ? { ...it, bookId: rename(it.bookId) } : it);
  return {
    ...place,
    ...(place.book ? { book: rename(place.book) } : {}),
    ...(place.song ? { song: item(place.song) } : {}),
    ...(place.setlist ? { setlist: item(place.setlist) } : {}),
  };
}

function sameLayers(a = [], b = []) {
  return a.length === b.length && a.every((kind, i) => kind === b[i]);
}

function sameEntry(entry, place, layers) {
  return Boolean(entry) && samePlace(entry.place, place) && sameLayers(entry.layers, layers);
}

/**
 * @param {object} args
 * @param {{ place: object, depth: number }} args.boot the session's first entry (bootEntry)
 * @param {object} args.place the place AppShell shows now
 * @param {string[]} args.layers the surfaces open over it, in a fixed order
 * @param {boolean} args.hold true while the shown place is not the address's
 *   yet (resolving it, or showing not-here): nothing is written meanwhile
 * @param {(place: object, layers: string[]) => void} args.onApply apply an entry
 */
export function usePlaceHistory({ boot, place, layers, hold, onApply }) {
  // The entry this hook last wrote or applied, and the entries it knows of by
  // depth (this session's; those below a reload are unknown).
  const lastRef = useRef(null);
  const stackRef = useRef([]);
  // A `history.back()` is on its way: write nothing until its popstate lands.
  const pendingPopRef = useRef(false);
  // The next change replaces the entry whatever it is (a book's id changing
  // under the open place — a fork or a put-online).
  const forceReplaceRef = useRef(false);
  // Book ids changed under this session (a fork or a put-online): old → new.
  // The entries below the current one still name the old id, so an entry popped
  // from history is read through this map. Read back from sessionStorage, so an
  // entry from before a reload still opens the new id.
  const renamesRef = useRef(null);
  if (renamesRef.current === null) renamesRef.current = readRenames(sessionStore());
  const layersRef = useRef(layers);
  const onApplyRef = useRef(onApply);
  useEffect(() => {
    layersRef.current = layers;
    onApplyRef.current = onApply;
  });

  // The first entry: the boot place at its canonical address (an unknown path
  // becomes `/`, a captured token is never left in the URL), no layers.
  useEffect(() => {
    const state = { place: boot.place, layers: [], depth: boot.depth };
    history.replaceState(state, '', urlFromPlace(boot.place));
    lastRef.current = state;
    stackRef.current[state.depth] = state;
  }, [boot]);

  const placeKey = JSON.stringify(place);
  const layersKey = layers.join(',');
  useEffect(() => {
    const cur = lastRef.current;
    if (!cur || hold || pendingPopRef.current) return;
    const force = forceReplaceRef.current;
    forceReplaceRef.current = false;
    if (sameEntry(cur, place, layers)) return;
    const stack = stackRef.current;
    const adds = layers.some((kind) => !cur.layers.includes(kind));
    if (!force && (isOpening(cur.place, place) || adds)) {
      const state = { place, layers, depth: cur.depth + 1 };
      history.pushState(state, '', urlFromPlace(place));
      stack.length = state.depth;
      stack[state.depth] = state;
      lastRef.current = state;
      return;
    }
    if (!force && cur.depth > 0 && sameEntry(stack[cur.depth - 1], place, layers)) {
      pendingPopRef.current = true;
      history.back();
      return;
    }
    const state = { place, layers, depth: cur.depth };
    history.replaceState(state, '', urlFromPlace(place));
    stack[state.depth] = state;
    lastRef.current = state;
    // placeKey/layersKey stand for place/layers (fresh objects every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeKey, layersKey, hold]);

  useEffect(() => {
    const onPopState = (e) => {
      const state = e.state;
      // Not one of ours (a `#dev/*` hash change): leave it to App.
      if (!state || !state.place) return;
      pendingPopRef.current = false;
      const renames = renamesRef.current;
      const rename = (id) => resolveBookId(renames, id);
      const place = renamePlace(state.place, rename);
      const renamed = JSON.stringify(place) !== JSON.stringify(state.place);
      const named = Array.isArray(state.layers) ? state.layers : [];
      const kept = layersRef.current.filter((kind) => named.includes(kind));
      const depth = Number.isInteger(state.depth) ? state.depth : 0;
      const applied = { place, layers: kept, depth };
      if (renamed || !sameLayers(kept, named)) {
        history.replaceState(applied, '', urlFromPlace(place));
      }
      const shown = lastRef.current;
      const known = Boolean(stackRef.current[depth]);
      lastRef.current = applied;
      // An entry from before a reload that shows what is already shown — the
      // same address, the reload having dropped the layer that set it apart —
      // is a dead step: keep going back.
      if (
        shown &&
        !known &&
        depth > 0 &&
        depth < shown.depth &&
        urlFromPlace(place) === urlFromPlace(shown.place) &&
        sameLayers(kept, shown.layers)
      ) {
        stackRef.current[depth] = applied;
        pendingPopRef.current = true;
        history.back();
        return;
      }
      stackRef.current[depth] = applied;
      onApplyRef.current(place, kept);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const back = useCallback((close) => {
    if (pendingPopRef.current) return;
    if ((lastRef.current?.depth ?? 0) > 0) {
      pendingPopRef.current = true;
      history.back();
    } else {
      close?.();
    }
  }, []);

  // A book's id changed under the open place (a fork or a put-online): the next
  // change replaces the current entry, and every entry below that names the old
  // id opens the new one when back lands on it.
  const renameBook = useCallback((previousBookId, bookId) => {
    forceReplaceRef.current = true;
    recordRename(renamesRef.current, previousBookId, bookId);
    writeRenames(sessionStore(), renamesRef.current);
    const rename = (id) => (id === previousBookId ? bookId : id);
    stackRef.current = stackRef.current.map((entry) =>
      entry ? { ...entry, place: renamePlace(entry.place, rename) } : entry,
    );
  }, []);

  return { back, renameBook };
}
