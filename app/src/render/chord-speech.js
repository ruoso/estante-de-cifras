// The spoken chord name (shell.a11y_chart): a pure, framework-free transform
// from a parsed cifra.md chord into the words a screen reader announces, per
// `docs/screen-reader.md` §3. It sits beside `diagram.js`'s `describeFingering`
// — the renderer produces the accessible labels, the view assembles them in
// reading order (screen-reader.md §8; DIRECTION §3.7 lines 415-417, §5 line
// 482). No DOM, no React, no `cifra-md` import: its input is the plain chord
// object the reader already produced (`{ root, quality, extensions, bass }`,
// the shape of `core/chord.js`'s Chord) and its output is a string, so the unit
// test pins the exact §3 words with no DOM.
//
// A chord MUST be spoken by name, never by its glyph string (§3): `Em` is
// "E minor", not the word "em"; `C#m7` is "C sharp minor seven", not spelled
// letter by letter; `G/B` is "G over B", not "G slash B". The spoken form reads
// the same canonical chord the visible symbol was drawn from, so the two always
// agree without this module re-spelling per dialect (the `notation` option is
// accepted for the §3 contract and future dialect-specific wording; the note
// names C-G are the same across cifra.md's dialects, so it does not change the
// string today). A §2.4 footnote marker (`Cm[2]`) is appended as its reference
// so the occurrence stays one chord token; index 1 is the bare key and adds
// nothing (`Cm` and `Cm[1]` → "C minor").

/** The interval degrees spoken as words (§3); other degrees fall back to the number. */
const SPOKEN_DEGREES = new Set([2, 4, 5, 6, 7, 9, 11, 13]);

/** The accidental on a note as a word, '' for a natural (§3). */
function accidentalWord(accidental, t) {
  switch (accidental) {
    case -2:
      return t('chord.spoken.doubleFlat');
    case -1:
      return t('chord.spoken.flat');
    case 1:
      return t('chord.spoken.sharp');
    case 2:
      return t('chord.spoken.doubleSharp');
    default:
      return '';
  }
}

/** A spelled note as spoken words: the letter, then its accidental if any. */
function speakNote(note, t) {
  const acc = accidentalWord(note.accidental, t);
  return acc ? `${note.letter} ${acc}` : note.letter;
}

/** A chord degree spoken as a word (`7` → "seven"), the number itself when exotic. */
function degreeWord(degree, t) {
  return SPOKEN_DEGREES.has(degree) ? t(['chord', 'spoken', 'interval', String(degree)]) : String(degree);
}

/** An altered degree's accidental word ahead of the number (`b5` → "flat"). */
function alterWord(alter, t) {
  if (alter < 0) return alter === -2 ? t('chord.spoken.doubleFlat') : t('chord.spoken.flat');
  if (alter > 0) return alter === 2 ? t('chord.spoken.doubleSharp') : t('chord.spoken.sharp');
  return '';
}

/**
 * The spoken name of a parsed chord, in words (screen-reader.md §3).
 *
 * @param {import('../core/chord.js').Chord} chord  the reader's canonical chord
 * @param {object} [options]
 * @param {string} [options.notation]  the home-book notation preference; the
 *   same dialect the visible symbol follows (§3). Accepted for the contract;
 *   the note names are dialect-independent so it does not alter the string.
 * @param {number} [options.footnote]  the §2.4 occurrence index (`item.index`);
 *   appended as "footnote N" when greater than 1, nothing at 1 (the bare key)
 * @param {(key: string|string[], params?: object) => string} options.t  the
 *   locale lookup (passed in, so the module stays framework-free and pure)
 * @returns {string}
 */
export function speakChord(chord, { notation, footnote = 1, t } = {}) {
  void notation;
  if (!chord || !chord.root) return '';
  const parts = [speakNote(chord.root, t)];

  const ext = new Map((chord.extensions ?? []).map((e) => [e.degree, e.alter]));
  const seventh = ext.get(7);
  const hasSeventh = seventh !== undefined;

  // The stated top degree, exactly as `notation/format.js` analyses it, so the
  // spoken shape matches the drawn symbol: the highest stacked degree present
  // and unaltered, each below it also present and unaltered.
  let top = null;
  if (hasSeventh) {
    top = 7;
    if (ext.get(9) === 0) {
      top = 9;
      if (ext.get(11) === 0) top = 11;
      if (ext.get(13) === 0) top = 13;
    }
  }
  const covered = new Set();
  if (top !== null) {
    covered.add(7);
    if (top >= 9) covered.add(9);
    if (top === 11) covered.add(11);
    if (top === 13) covered.add(13);
  }
  const isHalfDim = chord.quality === 'dim' && seventh === -1;
  const isDim7 = chord.quality === 'dim' && seventh === -2;
  const hasSix = ext.has(6);
  const hasSixNine = hasSix && ext.get(9) === 0 && !hasSeventh;

  // The quality word — a major triad is silent ("G"), minor and the rest named.
  const quality = {
    minor: t('chord.spoken.minor'),
    dim: isHalfDim ? t('chord.spoken.minor') : t('chord.spoken.diminished'),
    aug: t('chord.spoken.augmented'),
    sus2: t('chord.spoken.suspendedTwo'),
    sus4: t('chord.spoken.suspendedFour'),
    power: t('chord.spoken.fifth'),
  }[chord.quality];
  if (quality) parts.push(quality);

  if (hasSixNine) parts.push(degreeWord(6, t), degreeWord(9, t));
  else if (hasSix && !hasSeventh) parts.push(degreeWord(6, t));

  if (hasSeventh && !isDim7) {
    if (seventh === 0) parts.push(t('chord.spoken.major'), degreeWord(top, t));
    else parts.push(degreeWord(top, t));
  }
  if (isDim7) parts.push(degreeWord(7, t));

  if (isHalfDim) parts.push(alterWord(-1, t), degreeWord(5, t));
  if (chord.quality === 'aug' && hasSeventh) parts.push(alterWord(1, t), degreeWord(5, t));

  const coveredPlus = new Set(covered);
  coveredPlus.add(6);
  for (const [degree, alter] of [...ext.entries()].sort((a, b) => a[0] - b[0])) {
    if (coveredPlus.has(degree)) continue;
    if (alter === 0 && !hasSeventh) {
      parts.push(t('chord.spoken.add'), degreeWord(degree, t));
    } else {
      if (alter !== 0) parts.push(alterWord(alter, t));
      parts.push(degreeWord(degree, t));
    }
  }

  if (chord.bass) parts.push(t('chord.spoken.over'), speakNote(chord.bass, t));
  if (footnote > 1) parts.push(t('chord.spoken.footnote'), String(footnote));

  return parts.filter(Boolean).join(' ');
}
