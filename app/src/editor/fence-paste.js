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

import { fenceOpen, closesFence } from 'cifra-md';

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
