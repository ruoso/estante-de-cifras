// Which source lines of a song the reader reads as music (spec §1.9, §1.9.1):
// the lines inside a music fence, and — in a chart with no fence at all that
// the reader took as unfenced music — every chart line that is not blank, a
// Markdown heading, the title's details or past the rule. The editor's
// colouring and its notices locate things in the text with this, so they agree
// with the reader on what is music and what is notes (editor Decision 8).
//
// Pure: no React, no CodeMirror.

import { fenceOpen, closesFence, mdHeading } from 'cifra-md';

// The rule that ends the chart (js/src/parse.js RULE).
export const RULE = /^ {0,3}-{3,}$/;
// A list item, as the reader defines one (js/src/parse.js LIST_ITEM).
export const LIST_ITEM = /^ {0,3}[-*+](?: +(.*))?$/;

/**
 * Whether the reader read the chart as unfenced music (§1.9.1): no fence
 * before the rule, and a music part in its model.
 *
 * @param {string[]} lines the source lines
 * @param {{sections: {body: {type: string}[]}[]}} doc the reader's model
 * @returns {boolean}
 */
export function isUnfenced(lines, doc) {
  for (const line of lines) {
    if (RULE.test(line)) break;
    if (fenceOpen(line)) return false;
  }
  return doc.sections.some((section) => section.body.some((part) => part.type === 'music'));
}

/**
 * One flag per source line: true for a line the reader reads as music.
 *
 * @param {string[]} lines the source lines
 * @param {object} doc the reader's model of those lines
 * @returns {boolean[]}
 */
export function musicLines(lines, doc) {
  if (isUnfenced(lines, doc)) {
    let preamble = true; // the title and its `- key: value` details
    let chart = true;
    return lines.map((raw) => {
      if (!chart) return false;
      if (RULE.test(raw)) {
        chart = false;
        return false;
      }
      const heading = mdHeading(raw);
      if (heading) {
        if (heading.level >= 2) preamble = false;
        return false;
      }
      if (!raw.trim()) return false;
      if (preamble && LIST_ITEM.test(raw)) return false;
      preamble = false;
      return true;
    });
  }
  let fence = null;
  let music = false;
  return lines.map((raw) => {
    if (fence) {
      if (closesFence(raw, fence)) {
        fence = null;
        return false;
      }
      return music;
    }
    const fo = fenceOpen(raw);
    if (fo) {
      fence = { char: fo.char, length: fo.length };
      music = !fo.info || fo.info === 'cifra';
    }
    return false;
  });
}
