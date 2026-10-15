// reload-step.js — which entries from before a reload are dead steps
// (shell.routing_reload_scope_step; DIRECTION §3.7 "The address follows where
// you are"). A reload keeps only the address: the screens open over the place
// (the editor, arrange, the wizard, …) are steps in history but not addresses,
// so the entries below a reload under a layer can show exactly what is already
// shown. Those, and only those, are passed over on the way back. A step that
// differs in anything else — the tab, a one-book scope (workflow 2 §Scope), the
// song, the setlist, a layer the reload did not drop — is a real step.
//
// Pure: no window, history or React. use-place-history.js gathers the inputs.

import { samePlace } from './place.js';

// A place with every book id it holds passed through `rename` (an id → its
// current id).
export function renamePlace(place, rename) {
  if (!place) return place;
  const item = (it) => (it ? { ...it, bookId: rename(it.bookId) } : it);
  return {
    ...place,
    ...(place.book ? { book: rename(place.book) } : {}),
    ...(place.song ? { song: item(place.song) } : {}),
    ...(place.setlist ? { setlist: item(place.setlist) } : {}),
  };
}

function isRecord(value) {
  return Boolean(value && value.place && Array.isArray(value.layers) && Number.isInteger(value.depth));
}

// What a reload landing on `state` (the `history.state` it lands on) drops:
// `{ place, layers, depth }` when the entry is one of ours and names a layer;
// else the record an earlier reload of the same entry carried forward
// (`reloaded`); else null — nothing dropped.
export function reloadRecord(state) {
  if (!state || !state.place) return null;
  const depth = Number.isInteger(state.depth) ? state.depth : 0;
  if (Array.isArray(state.layers) && state.layers.length > 0) {
    return { place: state.place, layers: [...state.layers], depth };
  }
  return isRecord(state.reloaded) ? state.reloaded : null;
}

// Whether the popped `entry` ({ place, layers, depth }) is a dead step under
// the reload `record`: below it, the same place, naming only layers the reload
// dropped. `rename` maps a book id to its current id; both places are read
// through it.
export function isDeadStep(entry, record, rename = (id) => id) {
  if (!record || !entry) return false;
  if (!(entry.depth > 0 && entry.depth < record.depth)) return false;
  if (!samePlace(renamePlace(entry.place, rename), renamePlace(record.place, rename))) return false;
  const layers = Array.isArray(entry.layers) ? entry.layers : [];
  return layers.every((kind) => record.layers.includes(kind));
}
