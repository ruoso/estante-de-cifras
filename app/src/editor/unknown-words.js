// What the editor flags in a song as it is typed (songs.unknown_tokens_loud;
// workflow 4 §Editing, workflow 3 §When it looks like another format): every
// word inside the music the reader does not read as a chord (spec §2.9), and a
// bracket heading whose name reads as a chord — almost certainly a chord written
// in another format (§1.7.2). The reader decides both — `unknownTokens` and the
// model's sections, `isChord` in the song's own notation — and this module only
// locates them in the text (editor Decision 8: never a second grammar).
//
// Pure: no React, no CodeMirror.

import { parse, unknownTokens, isChord, fenceOpen, closesFence } from 'cifra-md';
import { songDialect } from '../core/notation/dialects.js';

/**
 * Whether a path is a song a person is writing — a `*.cifra.md` file, or a new
 * song with no path yet (Decision 6). README.md, setlists and any other file
 * the raw editor opens get no marks and no notice.
 *
 * @param {string|null|undefined} path
 * @returns {boolean}
 */
export function isSongPath(path) {
  return !path || path.endsWith('.cifra.md');
}

// The start offset of each line of `text` (lines split on \n, as CodeMirror
// joins its document).
function lineStarts(text) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) if (text[i] === '\n') starts.push(i + 1);
  return starts;
}

/**
 * The document ranges of every unknown token of a song, in source order. A
 * token whose text is not where the reader says it is (a text the text layer
 * normalises, spec §1.3) is not marked rather than marked in the wrong place.
 *
 * @param {string} text
 * @returns {{from: number, to: number}[]}
 */
export function unknownMarks(text) {
  const starts = lineStarts(text);
  const out = [];
  for (const tok of unknownTokens(text)) {
    const start = starts[tok.line - 1];
    if (start === undefined) continue;
    const from = start + tok.column;
    const to = from + tok.text.length;
    if (text.slice(from, to) === tok.text) out.push({ from, to });
  }
  return out;
}

// A bracket heading's name as written on a line (§1.7.2), or null.
const BRACKET = /^ *\[ *([^\]]*?) *\]/;
const firstWord = (name) => name.trim().split(/ +/)[0] ?? '';

/**
 * The bracket headings whose name — its first word, before any count — reads
 * as a chord in the song's notation: `[{line, name}]`, each at the first fenced
 * source line (after the previous one found) whose bracket heading carries that
 * name. `[A]` is flagged too: a part named *A* is legitimate, and the notice
 * only says it looks like a chord (workflow 3).
 *
 * @param {string} text
 * @returns {{line: number, name: string}[]}
 */
export function chordBracketHeadings(text) {
  const doc = parse(text);
  const dialect = songDialect(doc);
  const names = doc.sections
    .filter((s) => s.heading === 'bracket')
    .map((s) => firstWord(s.name))
    .filter((name) => name && isChord(name, dialect));
  if (names.length === 0) return [];

  // The bracket headings of the music fences, in order (a fence with another
  // info string is verbatim, so its lines are no headings).
  const lines = text.split('\n');
  const candidates = [];
  let fence = null;
  let music = false;
  lines.forEach((raw, idx) => {
    if (fence) {
      if (closesFence(raw, fence)) {
        fence = null;
        return;
      }
      if (!music) return;
      // A bracket heading may follow another on its line (`[Intro][Am]`).
      let rest = raw;
      let m;
      while ((m = BRACKET.exec(rest)) && m[1]) {
        candidates.push({ line: idx + 1, name: firstWord(m[1]) });
        rest = rest.slice(m[0].length);
      }
      return;
    }
    const fo = fenceOpen(raw);
    if (fo) {
      fence = { char: fo.char, length: fo.length };
      music = !fo.info || fo.info === 'cifra';
    }
  });

  const out = [];
  let k = 0;
  for (const name of names) {
    while (k < candidates.length && candidates[k].name !== name) k += 1;
    if (k === candidates.length) break;
    out.push({ line: candidates[k].line, name });
    k += 1;
  }
  return out;
}
