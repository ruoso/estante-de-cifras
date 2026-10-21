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
//     entry from before a reload that is the same place as the reloaded one,
//     naming only layers the reload dropped, is a dead step and keeps going
//     back (reload-step.js) — any other entry, a scope-only or tab-only step
//     among them, is a real step;
//   - `pushNext` makes the next change a pushed step even when it is not an
//     opening by place.js's reading — a book pressed on the Books tab opens
//     its songs on search, a tab change that is still a step Back undoes
//     (books.row_opens_songs);
//   - `renameBook` follows a book whose id changed (a fork, a put-online): the
//     current entry is replaced, and an entry below naming the old id is read
//     as naming the new one when `popstate` lands on it. The record of renames
//     (book-renames.js) is kept in `sessionStorage`, so it outlives a reload as
//     the tab's history entries do;
//   - `followSong` follows the open song's file renamed, moved or deleted (in the
//     file view opened over it, songs.show_the_file Constraint 6): the current
//     entry is replaced, and an entry that names the old path is read as naming
//     the new one — or, deleted, as the same place with no song — when
//     `popstate` lands on it. Kept for the session only.
//
// A reload keeps only what the address says: `bootEntry` parses the pathname,
// drops the layers, and keeps the depth so back still walks the earlier entries.
// What the reload dropped (the entry's place and layers before it) is kept as
// the `reloaded` record, written into the entry so a second reload still knows
// it; it is spent once back lands on a real step, or the hook writes an entry.

import { useCallback, useEffect, useRef } from 'react';
import { isOpening, placeFromUrl, samePlace, urlFromPlace } from './place.js';
import { readRenames, recordRename, resolveBookId, writeRenames } from './book-renames.js';
import { isDeadStep, reloadRecord, renamePlace } from './reload-step.js';

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
// search for any other path. `depth` is kept from the entry a reload landed on,
// and `reloaded` says what the reload dropped (reload-step.js), or is null.
export function bootEntry() {
  if (typeof location === 'undefined') {
    return { place: { tab: 'search' }, fromAddress: false, depth: 0, reloaded: null };
  }
  const parsed = placeFromUrl(location.pathname);
  const state = typeof history === 'undefined' ? null : history.state;
  const depth = Number.isInteger(state?.depth) && state.depth > 0 ? state.depth : 0;
  return {
    place: parsed ?? { tab: 'search' },
    fromAddress: Boolean(parsed && (parsed.book || parsed.song || parsed.setlist)),
    depth,
    reloaded: reloadRecord(state),
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
  // The next change pushes an entry whatever it is (`pushNext`).
  const forcePushRef = useRef(false);
  // The next change is not a step of its own (`replaceNext`): it rewrites the
  // entry it lands on — after the step back, when the same change closes the
  // layer the current entry opened.
  const replaceNextRef = useRef(false);
  // The entry to write once a `replaceNext` step back lands: `{ place, layers }`.
  const afterPopRef = useRef(null);
  // What the reload this session booted from dropped (reload-step.js), until
  // back lands on a real step or the hook writes an entry.
  const reloadedRef = useRef(null);
  // Book ids changed under this session (a fork or a put-online): old → new.
  // The entries below the current one still name the old id, so an entry popped
  // from history is read through this map. Read back from sessionStorage, so an
  // entry from before a reload still opens the new id.
  const renamesRef = useRef(null);
  if (renamesRef.current === null) renamesRef.current = readRenames(sessionStore());
  // Songs whose file moved or was deleted under this session: `bookId\0path` →
  // the new path, or null (deleted).
  const songMovesRef = useRef(new Map());
  const layersRef = useRef(layers);
  const onApplyRef = useRef(onApply);
  useEffect(() => {
    layersRef.current = layers;
    onApplyRef.current = onApply;
  });

  // The first entry: the boot place at its canonical address (an unknown path
  // becomes `/`, a captured token is never left in the URL), no layers; what a
  // reload dropped rides along, so a second reload still skips the same steps.
  useEffect(() => {
    const state = {
      place: boot.place,
      layers: [],
      depth: boot.depth,
      ...(boot.reloaded ? { reloaded: boot.reloaded } : {}),
    };
    history.replaceState(state, '', urlFromPlace(boot.place));
    reloadedRef.current = boot.reloaded ?? null;
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
    const replace = replaceNextRef.current;
    replaceNextRef.current = false;
    if (sameEntry(cur, place, layers)) return;
    const push = forcePushRef.current;
    forcePushRef.current = false;
    // The person moved on: no entry below is a dead step of the reload anymore.
    reloadedRef.current = null;
    const stack = stackRef.current;
    // A consequence, not a step (`replaceNext`): when the same change closes the
    // layer this entry opened (a save closing the editor), step back to the
    // entry below and rewrite it there, so no entry naming the closed layer is
    // left and Back goes where it went from the entry below.
    if (!force && replace && cur.depth > 0) {
      const below = stack[cur.depth - 1];
      if (below && sameLayers(below.layers, layers) && !sameLayers(cur.layers, layers)) {
        afterPopRef.current = { place, layers };
        pendingPopRef.current = true;
        history.back();
        return;
      }
    }
    const adds = layers.some((kind) => !cur.layers.includes(kind));
    if (!force && !replace && (push || isOpening(cur.place, place) || adds)) {
      const state = { place, layers, depth: cur.depth + 1 };
      history.pushState(state, '', urlFromPlace(place));
      stack.length = state.depth;
      stack[state.depth] = state;
      lastRef.current = state;
      return;
    }
    if (!force && !replace && cur.depth > 0 && sameEntry(stack[cur.depth - 1], place, layers)) {
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
      // A `replaceNext` step back landed: the shell already shows the place, so
      // the entry is rewritten to it rather than applied.
      const after = afterPopRef.current;
      if (after) {
        afterPopRef.current = null;
        const depth = Number.isInteger(state.depth) ? state.depth : 0;
        const rewritten = { place: after.place, layers: after.layers, depth };
        history.replaceState(rewritten, '', urlFromPlace(after.place));
        stackRef.current[depth] = rewritten;
        lastRef.current = rewritten;
        return;
      }
      const renames = renamesRef.current;
      const rename = (id) => resolveBookId(renames, id);
      const place = followPlace(songMovesRef.current, renamePlace(state.place, rename));
      const renamed = JSON.stringify(place) !== JSON.stringify(state.place);
      const named = Array.isArray(state.layers) ? state.layers : [];
      const kept = layersRef.current.filter((kind) => named.includes(kind));
      const depth = Number.isInteger(state.depth) ? state.depth : 0;
      const applied = { place, layers: kept, depth };
      if (renamed || !sameLayers(kept, named)) {
        history.replaceState(applied, '', urlFromPlace(place));
      }
      const known = Boolean(stackRef.current[depth]);
      lastRef.current = applied;
      // An entry from before a reload that is the place the reload landed on,
      // naming only layers the reload dropped, shows what is already shown: a
      // dead step, keep going back (the record holds across the skips).
      if (!known && isDeadStep({ place: state.place, layers: named, depth }, reloadedRef.current, rename)) {
        stackRef.current[depth] = applied;
        pendingPopRef.current = true;
        history.back();
        return;
      }
      // A real step: the reload's record is spent.
      reloadedRef.current = null;
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

  // The next change is a step of its own (a pushed entry), even a tab change.
  const pushNext = useCallback(() => {
    forcePushRef.current = true;
  }, []);

  // The next change is a consequence, not a step (the search scope following a
  // saved song — songs.search_scope_follows Decision 3): it replaces the entry
  // it lands on rather than pushing one.
  const replaceNext = useCallback(() => {
    replaceNextRef.current = true;
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

  // The open song's file moved (`toPath`) or was deleted (`toPath` null): the
  // next change replaces the current entry, and every entry naming the old path
  // follows it.
  const followSong = useCallback((bookId, fromPath, toPath) => {
    forceReplaceRef.current = true;
    const moves = songMovesRef.current;
    moves.set(songKey(bookId, fromPath), toPath);
    // A file moved back to a path it once left is there again.
    if (toPath) moves.delete(songKey(bookId, toPath));
    stackRef.current = stackRef.current.map((entry) =>
      entry ? { ...entry, place: followPlace(moves, entry.place) } : entry,
    );
  }, []);

  return { back, renameBook, followSong, pushNext, replaceNext };
}

function songKey(bookId, path) {
  return `${bookId}\0${path}`;
}

// The place with its song followed through the session's moves: at the path its
// file went to, or dropped (the place underneath) if it was deleted.
function followPlace(moves, place) {
  if (!place?.song || !moves.size) return place;
  const { bookId } = place.song;
  let path = place.song.path;
  // Bounded: each step follows one recorded move.
  for (let i = 0; i <= moves.size && moves.has(songKey(bookId, path)); i += 1) {
    path = moves.get(songKey(bookId, path));
    if (path === null) {
      const rest = { ...place };
      delete rest.song;
      return rest;
    }
  }
  return path === place.song.path ? place : { ...place, song: { ...place.song, path } };
}
