// progression.js — chord-progression search for the Worker's song index
// (storage.progression_search). Workflow 2 L42 deferred "searching by
// progression, `Am F C G`, as songs that contain it"; this is that feature's
// pure core. It turns a parsed `cifra-md` model into the song's ordered chord
// run, reduces each chord to a canonical, spelling-tolerant token (spec §5.2
// identity), generates the contiguous n-grams the MiniSearch `progression`
// field indexes, and parses a typed query into the same tokens so the query and
// the index agree by construction.
//
// Framework-free, Worker-only: plain ESM, no React, no DOM, no IndexedDB. Logs
// nothing — never a chord symbol, title or path (standing rule). The one source
// of chord grammar is the `cifra-md` package's `parseChord`/`isChord` — the same
// grammar whose `parse` produced the stored `item.chord` (Decision 6), so this
// module writes no second chord tokenizer.

import { parseChord, isChord, DEFAULT_DIALECT } from 'cifra-md';

// The n-gram window (Decision 2). MIN_N is 2 — a progression is two or more
// chords; a single chord is the chord-*use* path, not a progression. MAX_N is a
// small constant, comfortably longer than a hand-typed progression: every
// contiguous run of length 2..MAX_N is indexed, so a query of length L ≤ MAX_N
// is a single exact-match token and a query of L > MAX_N falls back to the AND
// of its MAX_N-grams plus a direct contiguous-subsequence confirmation.
export const MIN_N = 2;
export const MAX_N = 8;

// The MiniSearch field holding the n-grams. Named so `search-index.js`'s
// `tokenize` can branch on it, splitting this field on the n-gram separator
// rather than on chord punctuation (acceptance 3, Decision 2).
export const PROGRESSION_FIELD = 'progression';

// Two reserved separators, both chosen to survive `fold` (lowercase, no
// combining marks) and to be absent from every canonical chord token:
//   - MEMBER_SEP joins the chords WITHIN one n-gram, so an n-gram is one whole
//     token the tokenizer keeps intact (a '~' never appears in a chord token).
//   - NGRAM_SEP separates the n-grams within the stored field string; the
//     field's `tokenize` splits on it (a space never appears in a token).
const MEMBER_SEP = '~';
const NGRAM_SEP = ' ';

// MiniSearch's default term splitter (its own `SPACE_OR_PUNCTUATION`, v7),
// replicated so the branching `tokenize` reproduces the exact default splitting
// for every non-progression field and for a plain text query (fieldName
// undefined). The progression field alone is split on NGRAM_SEP.
const SPACE_OR_PUNCTUATION = /[\n\r\p{Z}\p{P}]+/u;

/**
 * The accidental of a note or extension (−2..+2) as a single stable digit
 * '0'..'4' (accidental + 2), so a token carries no sign punctuation and folds
 * to itself.
 */
const acc = (n) => String((n ?? 0) + 2);

// A note (root or bass) as `<letter><accidentalDigit>`, letter lowercased so the
// token survives `fold` unchanged. `Db` → `d1`, `C#` → `c3`, `A` → `a2`.
const note = (n) => `${String(n.letter).toLowerCase()}${acc(n.accidental)}`;

/**
 * The canonical, spelling-tolerant token for one structured `item.chord`
 * (Decision 2 = spec §5.2 chord identity). Two chords that are "the same chord"
 * by §5.2 — equal root, quality, extensions and bass — produce the SAME token;
 * any difference in those produces a different one. Roots compare by spelling
 * (no enharmonic folding, the §5.2 default), so `Db` ≠ `C#`. Because it is built
 * from the reader's already-§5.2.1-normalised model, `Am`=`Amin`=`A-` and
 * `Cmaj7`=`CM7`=`C∆7` collapse here with no re-normalisation.
 *
 * Pins spec §5.2 (`/home/ruoso/devel/cifra.md/spec/5-chord-symbols.md:68-71`),
 * §5.2.1.
 *
 * @param {{ root: {letter:string, accidental:number},
 *   quality: string,
 *   extensions: Array<{degree:number, alter:number}>,
 *   bass: null | {letter:string, accidental:number} }} chord
 * @returns {string}
 */
export function canonicalChordToken(chord) {
  const root = note(chord.root);
  const quality = chord.quality; // already lowercase, dialect-free (§5.2.1)
  const exts = (chord.extensions ?? [])
    .map((e) => `${e.degree}.${acc(e.alter)}`)
    .join(',');
  const bass = chord.bass ? `/${note(chord.bass)}` : '';
  return `${root}-${quality}${exts ? `-${exts}` : ''}${bass}`;
}

/**
 * The song's ordered chord run: every `type:'chord'` item in document order
 * (the same section → music part → line → measure → item traversal
 * `search-index.js` already walks, reading the structured `item.chord`), each
 * reduced to its canonical token, with CONSECUTIVE DUPLICATES COLLAPSED — a
 * chord held across several bars counts once between changes (Decision 1). Items
 * of any other type (nochord, unknown, beat, repeat, mark…) do not enter the
 * sequence.
 *
 * Pins `.tji` "n-gram extraction"; workflow 2 L42.
 *
 * @param {object} model a `cifra-md` parse model
 * @returns {string[]} canonical tokens, in order, consecutive repeats removed
 */
export function chordSequence(model) {
  const sections = Array.isArray(model?.sections) ? model.sections : [];
  const seq = [];
  for (const section of sections) {
    for (const part of section?.body ?? []) {
      if (part?.type !== 'music') continue;
      for (const line of part.lines ?? []) {
        if (line?.kind !== 'sung' && line?.kind !== 'chart') continue;
        for (const measure of line.measures ?? []) {
          for (const item of measure?.items ?? []) {
            if (item?.type !== 'chord' || !item.chord) continue;
            const token = canonicalChordToken(item.chord);
            if (seq[seq.length - 1] !== token) seq.push(token);
          }
        }
      }
    }
  }
  return seq;
}

/**
 * Every contiguous n-gram of `seq` for `n` in `[MIN_N, min(MAX_N, seq.length)]`,
 * each n-gram one token with members joined by MEMBER_SEP (Decision 2). A
 * sequence shorter than MIN_N yields none (a one-chord song contributes nothing
 * to the progression field).
 *
 * Pins `.tji` "n-gram extraction".
 *
 * @param {string[]} seq canonical tokens in order
 * @returns {string[]}
 */
export function ngrams(seq) {
  const out = [];
  const max = Math.min(MAX_N, seq.length);
  for (let n = MIN_N; n <= max; n += 1) {
    for (let i = 0; i + n <= seq.length; i += 1) {
      out.push(seq.slice(i, i + n).join(MEMBER_SEP));
    }
  }
  return out;
}

/**
 * The stored `progression` field value for a sequence: its n-grams joined by
 * NGRAM_SEP. The field's `tokenize` splits this back into the n-gram tokens.
 *
 * @param {string[]} seq
 * @returns {string}
 */
export function progressionField(seq) {
  return ngrams(seq).join(NGRAM_SEP);
}

/**
 * The branching tokenizer for the MiniSearch instance (Decision 2, acceptance
 * 3). The `progression` field is split on NGRAM_SEP so each n-gram stays whole;
 * every other field — and a plain text query, where `fieldName` is undefined —
 * uses MiniSearch's own default splitting, so existing text search is
 * unchanged.
 *
 * @param {string} text
 * @param {string} [fieldName]
 * @returns {string[]}
 */
export function progressionTokenize(text, fieldName) {
  if (fieldName === PROGRESSION_FIELD) {
    return text.split(NGRAM_SEP).filter(Boolean);
  }
  return text.split(SPACE_OR_PUNCTUATION);
}

/**
 * Decide whether a typed query is a progression query and, if so, its canonical
 * sequence (Decision 4, 6). A query is a progression when its
 * whitespace-separated tokens all parse as chords via `parseChord` AND, after
 * collapsing consecutive duplicates, number two or more. A single chord, a
 * non-chord token, or a repeat that collapses to one chord (`Am Am`) is NOT a
 * progression — it stays on the chord-use + text path.
 *
 * Pins `.tji` "progression match"; workflow 2 L42, L37.
 *
 * @param {string} query the raw typed query
 * @param {string} [dialect] notation for query parsing (default DEFAULT_DIALECT)
 * @returns {{ isProgression: boolean, seq: string[] }}
 */
export function parseProgressionQuery(query, dialect = DEFAULT_DIALECT) {
  const tokens = String(query ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return { isProgression: false, seq: [] };

  const seq = [];
  for (const text of tokens) {
    if (!isChord(text, dialect)) return { isProgression: false, seq: [] };
    const { chord } = parseChord(text, dialect);
    if (!chord) return { isProgression: false, seq: [] };
    const token = canonicalChordToken(chord);
    if (seq[seq.length - 1] !== token) seq.push(token);
  }
  if (seq.length < 2) return { isProgression: false, seq: [] };
  return { isProgression: true, seq };
}

/**
 * Does `docSeq` contain `querySeq` as a CONTIGUOUS run (Decision 1, acceptance
 * 7)? Order and contiguity both matter: the same chords out of order, or spread
 * non-contiguously, do not match; a run whose chords are held for several bars
 * matches because both sequences are consecutive-collapsed.
 *
 * Pins `.tji` "progression match"; acceptance 7.
 *
 * @param {string[]} querySeq canonical tokens, collapsed
 * @param {string[]} docSeq canonical tokens, collapsed
 * @returns {boolean}
 */
export function progressionMatch(querySeq, docSeq) {
  if (querySeq.length === 0) return false;
  const last = docSeq.length - querySeq.length;
  for (let i = 0; i <= last; i += 1) {
    let ok = true;
    for (let j = 0; j < querySeq.length; j += 1) {
      if (docSeq[i + j] !== querySeq[j]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/**
 * The query's progression tokens to hand MiniSearch, plus whether a direct
 * contiguous-subsequence confirmation against each candidate's stored sequence
 * is still required (Decision 2, acceptance 4):
 *   - L ≤ MAX_N → a single whole-run n-gram token, an exact "contains this
 *     contiguous run" match; no confirmation needed.
 *   - L > MAX_N → the AND of the query's MAX_N-grams for recall, then confirm.
 *
 * @param {string[]} seq the query's canonical sequence (length ≥ 2)
 * @returns {{ tokens: string[], confirm: boolean }}
 */
export function queryProgressionTokens(seq) {
  if (seq.length <= MAX_N) {
    return { tokens: [seq.join(MEMBER_SEP)], confirm: false };
  }
  const tokens = [];
  for (let i = 0; i + MAX_N <= seq.length; i += 1) {
    tokens.push(seq.slice(i, i + MAX_N).join(MEMBER_SEP));
  }
  return { tokens, confirm: true };
}
