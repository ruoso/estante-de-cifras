// The words for a line the reader reports (songs.editor_errors_in_words;
// workflow 4 §Editing). A reported line turns red (`est-err`, cifra-syntax.js);
// red alone is status carried by colour, so every such line also gets a note
// saying, in the user's language, what is wrong.
//
// The words come from the diagnostic's `code` — stable, pinned by the corpus
// (cifra.md §0) — never its `message`, which is the reader's own English
// (Constraint 1, Decision 7). A code the app does not know yet falls back to
// `other`, so a new code in cifra.md never shows an empty note.
//
// Pure: no React, no CodeMirror. The caller passes its translator.

/** Every diagnostic code the reader emits (cifra.md js/src/parse.js `diag()`). */
export const DIAGNOSTIC_CODES = Object.freeze([
  'duplicate-property',
  'bad-property',
  'marker-line',
  'bad-notation',
  'heading-looks-like-key',
  'unclosed-fence',
  'extra-rule',
  'bad-block-heading',
  'duplicate-block',
  'item-outside-block',
  'bad-voicing',
  'bad-fingering',
  'notes-outside-block',
  'unfenced-music',
  'stray-mark',
  'ending-outside-group',
  'count-out-of-place',
  'unclosed-group',
  'bad-ending-sequence',
  'count-with-endings',
  'repeat-without-previous',
  'repeat-beside-items',
]);

const KNOWN = new Set(DIAGNOSTIC_CODES);

/**
 * The message key that words a diagnostic code.
 *
 * @param {string} code
 * @returns {string} `editor.diagnostic.<code>`, or `editor.diagnostic.other`
 */
export function diagnosticKey(code) {
  return `editor.diagnostic.${KNOWN.has(code) ? code : 'other'}`;
}

/**
 * The diagnostic that names each reported line, keyed by 1-based line number
 * (Constraint 2): the first one on the line. A line holding a conflict marker
 * (`marker-line`) is the editor's `mk`, not `err` — its words are the conflict
 * notice's — so it has no entry. This is the one rule cifra-syntax.js colours
 * by, so the note and the red never disagree.
 *
 * @param {{code: string, line?: number}[]} diagnostics `parse().diagnostics`
 * @returns {Map<number, {code: string, line: number}>}
 */
export function lineDiagnostics(diagnostics) {
  const marked = new Set();
  const byLine = new Map();
  for (const d of diagnostics) {
    if (typeof d.line !== 'number') continue;
    if (d.code === 'marker-line') marked.add(d.line);
    else if (!byLine.has(d.line)) byLine.set(d.line, d);
  }
  for (const line of marked) byLine.delete(line);
  return byLine;
}

/**
 * The note under a reported line: "Line {line}: {words}".
 *
 * @param {{code: string, line: number}} diagnostic
 * @param {(key: string, params?: object) => string} translate the app's `t`
 * @returns {string}
 */
export function lineNoteText(diagnostic, translate) {
  return translate('editor.source.lineNote', {
    line: diagnostic.line,
    words: translate(diagnosticKey(diagnostic.code)),
  });
}
