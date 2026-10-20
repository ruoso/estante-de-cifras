// The chart's screen-reader reading order (shell.a11y_chart): a pure,
// framework-free transform from a `chartRows` render row into the ordered
// spoken tokens a screen reader announces, in the fixed order of
// `docs/screen-reader.md` §2, §4, §5 and §7. It sits beside `layout.js`: the
// layout turns the model into render rows, this turns a row into its reading.
// No DOM, no React — it is given a bound `speak(chord, { footnote })` (the
// §3 spoken chord name from `render/chord-speech.js`) and the locale lookup
// `t`, so the unit test pins the exact `", "`-joined "Announced text" strings
// with no DOM (screen-reader.md §1.2, §8). `Chart.jsx` is the only place that
// turns these tokens into ARIA; it assembles them element by element, while
// this module produces the canonical joined string the spec fixes.
//
// A token is one unit the reader announces (§1.2): a spoken chord name (§3), a
// word-run (§2), a structural phrase (a bar number, "no chord", a boundary word
// §7). Padding and the centred hyphen are silent (§4): a word-run carries only
// its words, trimmed, and a split word reads as its pieces in source order.

/**
 * The spoken form of one chart slot's chord part (§3, §5), or null when the
 * slot contributes no chord token (a lead run, an empty slot).
 *
 * @param {object} voice  the slot's `voice` descriptor from `layout.js`
 * @param {object} deps
 * @param {(chord: object, opts?: { footnote?: number }) => string} deps.speak
 * @param {(key: string|string[], params?: object) => string} deps.t
 * @returns {string|null}
 */
export function speakVoice(voice, { speak, t }) {
  if (!voice) return null;
  switch (voice.type) {
    case 'chord':
      // A voiced chord with no parsed model (a hand-built fixture) falls back to
      // its glyph, read by the view; here it contributes no spoken name.
      return voice.chord ? speak(voice.chord, { footnote: voice.footnote }) : null;
    case 'nochord':
      return t('chart.spoken.noChord'); // N.C. (cifra.md §2.6) → "no chord" (§5)
    case 'lead':
      return null; // leading syllables are a word-run alone, no chord before them
    default:
      // A beat, repeat or unknown glyph has no §3 spoken form; read its text.
      return voice.text || null;
  }
}

/** A measure's bar-number prefix when an anchor is stated on it (§5, cifra.md §2.8). */
function barPrefix(number, t) {
  return t('chart.spoken.bar', { n: number });
}

/**
 * A verbatim block's accessible name (songs.render_notes): its info string,
 * lower-cased by the reader, with the first letter capitalised — "Tab block".
 *
 * @param {string} info  the fence's info string
 * @param {(key: string, params?: object) => string} t
 * @returns {string}
 */
export function verbatimLabel(info, t) {
  const word = String(info ?? '');
  return t('chart.verbatim', { info: word.charAt(0).toUpperCase() + word.slice(1) });
}

/**
 * The ordered spoken tokens of one render row (§2, §4, §5).
 *
 * @param {object} row  a `chartRows` render row
 * @param {object} deps  { speak, t } (see `speakVoice`)
 * @returns {string[]}
 */
export function readingTokens(row, deps) {
  const { t } = deps;
  switch (row?.type) {
    case 'sung': {
      // Each segment in source order: the chord first, then the word-run it
      // sits over (§2.1). Padding and the centred hyphen are silent (§4) — a
      // split word's pieces each read after their chord, not reassembled.
      const tokens = [];
      for (const segment of row.segments) {
        const chord = speakVoice(segment.voice, deps);
        if (chord) tokens.push(chord);
        const words = (segment.words ?? '').trim();
        if (words) tokens.push(words);
      }
      return tokens;
    }
    case 'bars': {
      // Measures in order as an ordered group (§5): each measure's chords by
      // name, a stated bar number leading its measure ("bar 5: …"), the `|`
      // never spoken.
      const tokens = [];
      row.cells.forEach((cells, i) => {
        const measureTokens = cells.map((cell) => speakVoice(cell.voice, deps)).filter(Boolean);
        const number = row.numbers?.[i];
        if (number?.stated && number?.number != null && measureTokens.length) {
          measureTokens[0] = `${barPrefix(number.number, t)} ${measureTokens[0]}`;
        }
        tokens.push(...measureTokens);
      });
      return tokens;
    }
    case 'run':
      // An intro/`.run` line reads its chords as a plain sequence (§5): no bar
      // numbers, no measure grouping.
      return row.tokens.map((cell) => speakVoice(cell.voice, deps)).filter(Boolean);
    case 'notes':
      // A notes part reads as its paragraphs, as written (cifra.md §1.9): plain
      // text, nothing spoken that is not on the screen.
      return row.paragraphs.map((paragraph) => paragraph.replace(/[ \t]+$/gm, ''));
    case 'verbatim':
      // A verbatim fence reads as its named group, then its text whole.
      return [verbatimLabel(row.info, t), row.text];
    default:
      return [];
  }
}

/**
 * The "Announced text" of a row: its tokens joined with `", "` (§1.2).
 *
 * @param {object} row  a `chartRows` render row
 * @param {object} deps  { speak, t }
 * @returns {string}
 */
export function announce(row, deps) {
  return readingTokens(row, deps).join(', ');
}

/**
 * The chord diagram's reading (§6): the `describeFingering` sentence (produced
 * by `render/diagram.js`, decided in workflow 16) plus the role word that says
 * whose shape it is, composed in the announced order. The sentence's trailing
 * period is dropped so the tokens join as the "Announced text" convention fixes
 * (§1.2); the song's own shape carries no role word (§6). The diagram's DOM is
 * unchanged — this only pins the composition (the "reuse §6 as-is" decision).
 *
 * @param {string} sentence  the `describeFingering` sentence
 * @param {string|null} [word]  the role word ("your shape" / "default"), or null
 * @returns {string}
 */
export function diagramReading(sentence, word) {
  const base = String(sentence).replace(/\.\s*$/, '');
  return word ? `${base}, ${word}` : base;
}

/**
 * The entry and exit announcements that bound a marked region (§7).
 *
 * A conflict (`'conf'`) is bounded by "needs you" plus what conflicts in
 * musical terms — the phrase the consumer that computed the mark supplies
 * (`SongConflict` → "conflict in the chart line / voicing / property", workflow
 * 9 lines 13-23), a generic fallback otherwise — and ends with "end of
 * conflict" (§7.1, REQUIRED). A shown default (`'def'`) uses the same bounding
 * with "default" / "end of defaults" (§7.3). Any other mark bounds nothing.
 *
 * @param {'conf'|'def'|string|null} mark
 * @param {object} [deps]
 * @param {(key: string|string[], params?: object) => string} deps.t
 * @param {string} [deps.phrase]  the musical-terms phrase from the consumer
 * @returns {{ enter: string, exit: string }|null}
 */
export function regionAnnouncement(mark, { t, phrase } = {}) {
  if (mark === 'conf') {
    const what = phrase || t('chart.spoken.conflict');
    return { enter: `${t('chart.spoken.needsYou')}, ${what}`, exit: t('chart.spoken.endOfConflict') };
  }
  if (mark === 'def') {
    return { enter: t('chart.spoken.default'), exit: t('chart.spoken.endOfDefaults') };
  }
  return null;
}
