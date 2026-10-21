// The pure glue behind the setlist player (books.play, workflow 12 §Playing
// through, §The key). Framework-free: it turns the setlist's rows into the
// ordered playable list, clamps navigation at the ends, derives the Next
// card's item, and computes the semitone offset from a song's written key to
// a setlist item's target key. The view (SetlistPlay.jsx) composes the music
// core around these; the Worker owns no play model (Decision 1).

import { parseNote, pitchClass } from '../core/pitch.js';

// A §10.7.1 key as the setlist writes it — a root, an optional accidental
// (ASCII or the unicode ♯/♭), an optional `m` for minor. `parseNote` reads a
// bare note with ASCII accidentals, so drop the mode and fold the glyphs. The
// mode itself is compared separately (isMinor): two keys that differ in mode
// are not transposed between (§10.7.1).
function isMinor(key) {
  return /m$/.test(String(key).trim());
}

function noteOf(key) {
  return String(key)
    .trim()
    .replace(/m$/, '')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b');
}

/**
 * The signed semitone offset (0–11, up to the target) from a song's written
 * `key` to a setlist item's target `key` — `playKeyOffset('G', 'A')` → `2`.
 * Returns `null` when the song has no written key, either key is unparseable,
 * or the two keys differ in mode (`Am` under `C`), so the caller shows the
 * setlist key as a note, untransposed (workflow 12 §The key L52-54; cifra.md
 * §10.7.1). Enharmonic spellings are the same key: `A#` → `Bb` is `0`.
 * @param {string|null|undefined} songKey the song's written `key` property
 * @param {string|null|undefined} targetKey the setlist item's target `key`
 * @returns {number|null}
 */
export function playKeyOffset(songKey, targetKey) {
  if (!songKey || !targetKey) return null;
  if (isMinor(songKey) !== isMinor(targetKey)) return null;
  let from;
  let to;
  try {
    from = pitchClass(parseNote(noteOf(songKey)));
    to = pitchClass(parseNote(noteOf(targetKey)));
  } catch {
    return null;
  }
  return (((to - from) % 12) + 12) % 12;
}

/**
 * The ordered list of playable items from `setlistRows`: the song links that
 * point at a song present in the book. Missing items and unlinked items are
 * skipped — they are not played (workflow 12 §Songs moved L83-85).
 * @param {Array<object>} rows the rows from `setlistRows`
 * @returns {Array<object>}
 */
export function playableItems(rows) {
  return (rows || []).filter((row) => row && row.path != null && !row.missing);
}

/**
 * Clamp a play index into the playable list's bounds — navigation stops at the
 * ends, it does not wrap (workflow 12 §Playing through, Decision 5).
 * @param {number} index
 * @param {number} length
 * @returns {number}
 */
export function clampIndex(index, length) {
  if (!(length > 0)) return 0;
  if (index < 0) return 0;
  if (index > length - 1) return length - 1;
  return index;
}

/**
 * The item after `index` in the playable list, for the Next card: its number,
 * title and note (workflow 12 §Playing through L72). `null` at the last song.
 * @param {Array<object>} playable the playable list
 * @param {number} index the current index
 * @returns {{ number: number, title: string, note: string|null }|null}
 */
export function nextItem(playable, index) {
  const next = (playable || [])[index + 1];
  if (!next) return null;
  return { number: next.number, title: next.title, note: next.note ?? null };
}

/**
 * The play index a row opens at: the position in the playable list of the row
 * whose item index is `at` (books.setlist_row_opens; workflow 12 §Playing
 * through). Missing and unlinked items are not in the playable list, so the
 * row's `at` is not its play index; `at`, not the title or the path, since a
 * setlist may hold the same song twice. An `at` that is not playable (absent,
 * missing, out of range) starts at the first song.
 * @param {Array<object>} playable the playable list
 * @param {number|null|undefined} at the pressed row's item index
 * @returns {number}
 */
export function startIndex(playable, at) {
  if (at == null) return 0;
  const index = (playable || []).findIndex((row) => row.at === at);
  return index < 0 ? 0 : index;
}
