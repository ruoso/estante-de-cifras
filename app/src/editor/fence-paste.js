// The paste-into-a-fence transform (songs.editor; workflow 3 §Pasting a cifra
// L87-95; mockup W03 paste notice). Text pasted from a cifra site is chords
// over words with `[Intro]`-style headings and no fences — outside a fence the
// reader would read it as notes, not music (spec §1.9 L350-375). So when a
// paste lands OUTSIDE any fence the editor wraps it in a music fence, and — when
// the song has no title yet — lifts the first pasted line out to become the `#`
// title. Both happen in one reversible move (the editor applies the returned
// changes as a single CodeMirror transaction, so one undo reverts the whole
// thing).
//
// Pure: no React, no CodeMirror. The editor decides the paste point; this helper
// decides the transform from the text before that point.

import { fenceOpen, closesFence, mdHeading } from 'cifra-md';

const FENCE = '```';

// Is the paste point inside an open fence? Scan the text that precedes it with
// cifra.md's own fence primitives; if a fence is still open at the end, the
// paste lands inside it. (Any fence counts — music or verbatim — because text
// already in a fence needs no wrapping.)
function endsInsideFence(before) {
  let fence = null;
  for (const line of before.split(/\r\n|\r|\n/)) {
    if (fence) {
      if (closesFence(line, fence)) fence = null;
    } else {
      const open = fenceOpen(line);
      if (open) fence = open;
    }
  }
  return fence !== null;
}

/**
 * Decide how a paste should be transformed.
 *
 * @param {object} args
 * @param {string} args.text the buffer text BEFORE the paste point (start of
 *   document up to the cursor) — used to decide whether the paste lands inside
 *   an open fence.
 * @param {string} args.pasted the pasted text.
 * @param {boolean} args.hasTitle whether the song already has a `#` title.
 * @returns {{
 *   insideFence: boolean,
 *   wrapped: boolean,
 *   titled: boolean,
 *   insert: string,
 *   title: (string|null),
 * }} the transform: `insert` replaces the selection at the paste point; `title`
 *   (when non-null) is the `# …` line to add at the document start. When the
 *   paste lands inside a fence nothing is transformed (`insert` is the pasted
 *   text verbatim).
 */
export function fencePaste({ text = '', pasted = '', hasTitle = true } = {}) {
  if (endsInsideFence(text)) {
    return { insideFence: true, wrapped: false, titled: false, insert: pasted, title: null };
  }

  let body = pasted;
  let title = null;
  let titled = false;

  if (!hasTitle) {
    const lines = pasted.split(/\r\n|\r|\n/);
    const firstMeaningful = lines.findIndex((l) => l.trim() !== '');
    if (firstMeaningful !== -1) {
      title = `# ${lines[firstMeaningful].trim()}`;
      titled = true;
      // The remaining lines become the fenced body, dropping the leading blanks
      // left where the title used to be.
      const rest = lines.slice(firstMeaningful + 1);
      while (rest.length && rest[0].trim() === '') rest.shift();
      body = rest.join('\n');
    }
  }

  const insert = `${FENCE}\n${body}${body.endsWith('\n') || body === '' ? '' : '\n'}${FENCE}`;
  return { insideFence: false, wrapped: true, titled, insert, title };
}

// What ends a paragraph for `fenceAround`: a blank line, a `#` heading, a
// `- key:` list item (a property or a voicing), a thematic break, or a fence
// delimiter — the markdown structure around a chart, never part of it.
const THEMATIC_BREAK = /^ {0,3}([-*_])( *\1){2,} *$/;
const LIST_ITEM = /^ {0,3}-\s+[^:]+:/;
function endsParagraph(line) {
  return (
    line.trim() === '' ||
    mdHeading(line) !== null ||
    LIST_ITEM.test(line) ||
    THEMATIC_BREAK.test(line) ||
    fenceOpen(line) !== null
  );
}

/**
 * Put the paragraph holding `line` inside a music fence — **Put it in the
 * music** on the *chords outside the music* notice (songs.editor_errors_in_words
 * Constraint 6, Decision 6; workflow 3 §When it looks like another format;
 * spec §1.9). The paragraph is the contiguous run of lines around `line` up to,
 * not including, a blank line, a heading, a `- key:` item, a rule or a fence
 * delimiter: chords over words are two lines, and fencing the chord line alone
 * would split them.
 *
 * @param {string} text the whole buffer
 * @param {number} line the 1-based line the reader reported
 * @returns {{from: number, to: number, insert: string}} one change: the text
 *   between `from` and `to` (the paragraph) replaced by itself between two
 *   lines of three backticks.
 */
export function fenceAround(text, line) {
  // Each line's text and its start offset, keeping the real separators.
  const lines = [];
  const re = /\r\n|\r|\n/g;
  let start = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    lines.push({ text: text.slice(start, m.index), from: start });
    start = m.index + m[0].length;
  }
  lines.push({ text: text.slice(start), from: start });

  const at = Math.min(Math.max(line, 1), lines.length) - 1;
  let first = at;
  let last = at;
  if (!endsParagraph(lines[at].text)) {
    while (first > 0 && !endsParagraph(lines[first - 1].text)) first -= 1;
    while (last < lines.length - 1 && !endsParagraph(lines[last + 1].text)) last += 1;
  }
  const from = lines[first].from;
  const to = lines[last].from + lines[last].text.length;
  return { from, to, insert: `${FENCE}\n${text.slice(from, to)}\n${FENCE}` };
}
