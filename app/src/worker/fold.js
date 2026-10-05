// The accent fold for the search index: lowercase and strip Latin combining
// marks so that `coracao` matches *Coração* and `CORACAO` matches *coração*
// (DIRECTION §4 L431–432 "Accent-insensitive"; workflow 2 L24 "ignores accents
// and case"). This is deliberately distinct from `home-book-canonical.js`'s NFC
// normalisation, which is for *storage* and runs the opposite direction
// (storage.index refinement, Decision 7). It is applied to indexed terms and to
// query terms alike through MiniSearch's `processTerm` hook, so both sides fold
// consistently.
//
// NFD decomposes an accented Latin/Greek/Cyrillic letter into its base letter
// plus a combining mark in the U+0300–U+036F block; stripping that block drops
// the accent. We then recompose with NFC so scripts that *decompose* under NFD
// but carry no Latin combining marks — Hangul especially — come back to their
// original composed form unharmed; CJK and kana have no decomposition and pass
// through either way.

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Fold a string for accent- and case-insensitive search.
 *
 * Idempotent: `fold(fold(s)) === fold(s)`.
 *
 * @param {string} text
 * @returns {string}
 */
export function fold(text) {
  return text
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .normalize('NFC')
    .toLowerCase();
}
