// book-renames.js — the record of book ids changed under this tab's session
// history (a fork, a put-online): old id → new id (shell.routing_rename_across_reload;
// DIRECTION §3.7 "The address follows where you are").
//
// The entries below the current one still name the old id; the record lets
// `popstate` read them as naming the new one. It is view state on the main
// thread, kept in `sessionStorage` (Decision 1): per tab, it survives a reload
// exactly as the tab's history entries do. Book ids only. The storage is
// injected; a storage that is absent, malformed or throws yields an empty
// record, and a write that throws is swallowed — the in-memory record keeps
// working for the session.

export const RENAMES_KEY = 'estante.bookRenames';

const isId = (v) => typeof v === 'string' && v !== '';

// The record kept in `storage`, or an empty one.
export function readRenames(storage) {
  const map = new Map();
  try {
    const raw = storage?.getItem(RENAMES_KEY);
    if (raw == null) return map;
    const pairs = JSON.parse(raw);
    if (!Array.isArray(pairs)) return map;
    for (const pair of pairs) {
      if (!Array.isArray(pair) || pair.length !== 2 || !isId(pair[0]) || !isId(pair[1])) {
        return new Map();
      }
      map.set(pair[0], pair[1]);
    }
    return map;
  } catch {
    return new Map();
  }
}

// `previousBookId` is now `bookId`; a record from the new id onwards is dropped
// (the id is current again — a chain never resolves past it).
export function recordRename(map, previousBookId, bookId) {
  map.set(previousBookId, bookId);
  map.delete(bookId);
  return map;
}

export function writeRenames(storage, map) {
  try {
    storage?.setItem(RENAMES_KEY, JSON.stringify([...map]));
  } catch {
    // Storage disabled or full: the record lives in memory for this session.
  }
}

// An id's current id: the chain of renames followed, stopping on a cycle.
export function resolveBookId(map, id) {
  const seen = new Set();
  while (map.has(id) && !seen.has(id)) {
    seen.add(id);
    id = map.get(id);
  }
  return id;
}
