// The format help's topics (songs.format_help; workflow 3 §Help with the
// format): the eight topics of *Writing a song* in order, what each example
// carries — Insert for the parts (2-7), Copy for the title and the voicings
// (1, 8) — and where an inserted example lands: where Add section puts a new
// part (section-insert.js; Decision 9), never at the cursor, never inside a
// fence, never after the voicings rule.
//
// Pure: no React, no CodeMirror. The copy — headings, sentences, examples — is
// i18n's (`editor.formatHelp.topics.<id>`), since part names and sung words are
// translated (Decision 8).

import { sectionInsertion } from './section-insert.js';

export const FORMAT_TOPICS = [
  { id: 'title', action: 'copy' },
  { id: 'parts', action: 'insert' },
  { id: 'chords', action: 'insert' },
  { id: 'bars', action: 'insert' },
  { id: 'repeats', action: 'insert' },
  { id: 'bracketNames', action: 'insert' },
  { id: 'notes', action: 'insert' },
  { id: 'voicings', action: 'copy' },
];

/**
 * The change that inserts an example into a song: at the end of the chart,
 * padded by a blank line on each side as Add section pads, and the cursor at
 * the end of the example itself (before any trailing padding).
 *
 * @param {string} text the buffer text
 * @param {string} example the example, as the help shows it
 * @returns {{from: number, insert: string, cursor: number}}
 */
export function exampleInsertion(text, example) {
  const { from, insert, offset } = sectionInsertion(text, example);
  return { from, insert, cursor: from + offset + example.length };
}
