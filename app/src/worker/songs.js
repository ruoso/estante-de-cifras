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
// §4.5). music.transpose shipped the transposition half — the reader of the
// stored offset and the builder of the change that writes it — ahead of its
// consumer. songs.reading adds the variation half beside it (`variationOf` /
// `variationChange`, keyed by tuning), and the `SET_TRANSPOSITION` /
// `SET_VARIATION` Worker commands and the reading control that dispatch them;
// both halves are pinned at unit level here and exercised end-to-end there.

import { isRegister } from './home-book-merge.js';

/**
 * The §2.3 song ref the reading state is keyed by: `<book-id>/<path>`, with the
 * path NFC-normalised so the key matches whatever the canonical writer stores
 * (home-book-canonical NFC-normalises member names on write). The book id is an
 * opaque id and is left as given.
 *
 * @param {string} bookId the book's opaque id
 * @param {string} path the song's in-book path
 * @returns {string} the §2.3 ref
 */
export function songRefOf(bookId, path) {
  return `${bookId}/${String(path).normalize('NFC')}`;
}

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

/**
 * The variation in use for a song on one tuning (home-book-format §4.5
 * L315-316): the stored string from `songs.json[<songRef>].variation[<tuning>]`,
 * or `''` when the register is absent, malformed, a non-string, or a tombstone
 * — `''` is the default variation (cifra.md's plain `Voicings` heading), so "no
 * record" and "the default" are the same reading. The per-tuning map keeps one
 * choice per tuning, as §4.5 defines it, so a guitar and a cavaquinho remember
 * their variations independently.
 *
 * @param {object} songsModel the parsed songs.json (an absent file is `{}`)
 * @param {string} songRef the §2.3 song ref the state is keyed by
 * @param {string} tuning the §6.3 tuning identity the choice is keyed by
 * @returns {string} the variation label, `''` for the default
 */
export function variationOf(songsModel, songRef, tuning) {
  const entry = songsModel?.[songRef];
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return '';
  const variations = entry.variation;
  if (!variations || typeof variations !== 'object' || Array.isArray(variations)) return '';
  const reg = variations[tuning];
  if (!isRegister(reg) || typeof reg.value !== 'string') return '';
  return reg.value;
}

/**
 * The home-book change that records the variation in use for a song on one
 * tuning (home-book-format §4.5), for `home-book.set` to write to songs.json
 * under the §2.3 song ref's per-tuning `variation` map. Like
 * `transpositionChange`, this seam only names the key path and the value;
 * `home-book.set` wraps it in the `{ value, at }` register envelope and commits
 * automatically. A later read returns `variation` through `variationOf`.
 *
 * @param {string} songRef the §2.3 song ref
 * @param {string} tuning the §6.3 tuning identity the choice is keyed by
 * @param {string} variation the variation label to remember (`''` the default)
 * @returns {{ path: string[], value: string }}
 */
export function variationChange(songRef, tuning, variation) {
  return { path: [songRef, 'variation', tuning], value: variation };
}

/**
 * The whole per-tuning variation map for a song (home-book-format §4.5), as the
 * `OPEN_SONG` → `SONG` surface carries it to the view: a plain
 * `{ [tuning]: label }` of the live choices, tombstones and malformed or
 * non-string registers dropped. The view reads the entry for the tuning in use;
 * a tuning with no entry reads as the default (`''`), exactly as `variationOf`.
 *
 * @param {object} songsModel the parsed songs.json (an absent file is `{}`)
 * @param {string} songRef the §2.3 song ref
 * @returns {Record<string, string>} tuning identity → variation label
 */
export function variationsOf(songsModel, songRef) {
  const entry = songsModel?.[songRef];
  const variations =
    entry && typeof entry === 'object' && !Array.isArray(entry) ? entry.variation : null;
  if (!variations || typeof variations !== 'object' || Array.isArray(variations)) return {};
  const out = {};
  for (const tuning of Object.keys(variations)) {
    const reg = variations[tuning];
    if (isRegister(reg) && typeof reg.value === 'string') out[tuning] = reg.value;
  }
  return out;
}
