// songs.js — the pure per-song reading-state seam over the home book's
// songs.json (storage.home_book; home-book-format §4.5). The sibling of
// preferences.js and instruments.js: no I/O, no logging, no song text in any
// message (standing rules); plain ESM, Worker-only; it reads the §3 register
// envelope and builds §3 register change-sets, and knows nothing of React,
// IndexedDB or the network.
//
// songs.json holds, per song ref (§2.3 `<book-id>/<path>`), the reading state
// that is the user's and not the song's: how far the song is transposed
// (`transposition`) and which variation is in use per tuning (`variation`,
// §4.5). This task owns only the transposition half — the reader of the stored
// offset and the builder of the change that writes it. The variation half, the
// `SET_TRANSPOSITION` Worker command that calls these, and the reading control
// that dispatches it are songs.reading's (the refinement's boundary): this seam
// is pinned at unit level here and exercised end-to-end there, mirroring
// music.fallback shipping the `ignoreSongVoicings` seam ahead of its consumer.

import { isRegister } from './home-book-merge.js';

/**
 * The semitone offset a song is read at (home-book-format §4.5): the stored
 * signed integer from `songs.json[<songRef>].transposition`, or `0` when the
 * register is absent, malformed, a tombstone, or holds `0` — "`0` or the absent
 * register means the written key" (§4.5 L312-314). A non-integer value (a
 * hand-edited or forward-version home book) reads as the written key rather than
 * a broken offset.
 *
 * @param {object} songsModel the parsed songs.json (an absent file is `{}`)
 * @param {string} songRef the §2.3 song ref the state is keyed by
 * @returns {number} the signed offset, `0` for the written key
 */
export function transpositionOf(songsModel, songRef) {
  const entry = songsModel?.[songRef];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return 0;
  const reg = entry.transposition;
  if (!isRegister(reg) || !Number.isInteger(reg.value)) return 0;
  return reg.value;
}

/**
 * The home-book change that records a song's transposition (home-book-format
 * §4.5), for `home-book.set` to write to songs.json under the §2.3 song ref.
 * `home-book.set` wraps the value in the `{ value, at }` register envelope and
 * commits automatically; this seam only names the key path and the value, as the
 * instrument change-set builders do. A later read of the written register returns
 * `semitones` through `transpositionOf`.
 *
 * @param {string} songRef the §2.3 song ref
 * @param {number} semitones the signed offset to remember
 * @returns {{ path: string[], value: number }}
 */
export function transpositionChange(songRef, semitones) {
  return { path: [songRef, 'transposition'], value: semitones };
}
