// line-diff.js — the pure line/hunk diff behind *show the text* (songs.history,
// workflow 6 §A version L43-45; mockup W06 computer `editor` block). "Show the
// text gives the line diff of the file, for whoever wants to see exactly what
// was written" — a plain unified view of two version texts, classed
// `del`/`add`/`gap`, NOT the musical diff (that is `diff` + `renderChange`).
//
// A short LCS over the lines, grouped into hunks with a little surrounding
// context, so a long unchanged run collapses to a `gap` between hunks (Decision
// 6). No diff library and no CodeMirror: a read-only hunk list renders as plain
// classed `<div>`s, so there is no npm dependency to add behind a possibly-
// blocked network (memory: adding-npm-deps-needs-lockfile-and-network) and no
// jsdom geometry stub to carry (memory: codemirror-jsdom-getclientrects).
//
// Pure: no React, no I/O, no state; equal inputs give an equal result.

// Lines of context kept on each side of a change; two adjacent changes closer
// than a full gap of context are bridged into one hunk rather than split.
const CONTEXT = 3;

// Split a version's text into lines. A single trailing newline (canonical
// cifra.md files end with one) is dropped so it does not read as an extra blank
// line on both sides; any other blank lines are kept as content.
function toLines(text) {
  const str = String(text ?? '');
  if (str === '') return [];
  const lines = str.split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

// The ordered op sequence aligning `a` (before) to `b` (after) by a classic
// longest-common-subsequence walk: a `context` op for a shared line, a `del` for
// a line only in `a`, an `add` for a line only in `b`. Deletions precede
// additions at the same point, so a changed line reads old-then-new.
function alignOps(a, b) {
  const n = a.length;
  const m = b.length;
  // lcs[i][j] = length of the LCS of a[i..] and b[j..].
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ type: 'context', text: a[i] });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      ops.push({ type: 'del', text: a[i] });
      i += 1;
    } else {
      ops.push({ type: 'add', text: b[j] });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: 'del', text: a[i] });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: 'add', text: b[j] });
    j += 1;
  }
  return ops;
}

/**
 * The line diff of two version texts as hunks (workflow 6 §A version L43-45).
 * Each hunk is `{ lines: [{ type: 'context'|'add'|'del', text }] }`; the caller
 * renders a `gap` separator between consecutive hunks. Identical texts give no
 * hunks (an empty array), so *show the text* shows nothing changed.
 *
 * @param {string} before the earlier version's text
 * @param {string} after the later version's text
 * @returns {Array<{ lines: Array<{ type: string, text: string }> }>}
 */
export function lineDiff(before, after) {
  const ops = alignOps(toLines(before), toLines(after));
  const n = ops.length;
  const isChange = (op) => op.type !== 'context';
  const hunks = [];
  let i = 0;
  while (i < n) {
    if (!isChange(ops[i])) {
      i += 1;
      continue;
    }
    // A change starts: open the hunk CONTEXT lines back, then extend forward
    // across changes, bridging short unchanged runs (≤ 2·CONTEXT) so nearby
    // edits share one hunk, and stop CONTEXT lines past the last change.
    const start = Math.max(0, i - CONTEXT);
    let end = i;
    let j = i;
    while (j < n) {
      if (isChange(ops[j])) {
        end = j;
        j += 1;
        continue;
      }
      let k = j;
      while (k < n && !isChange(ops[k])) k += 1;
      if (k < n && k - j <= 2 * CONTEXT) {
        j = k; // bridge the short unchanged run and keep extending
      } else {
        break;
      }
    }
    end = Math.min(n - 1, end + CONTEXT);
    hunks.push({ lines: ops.slice(start, end + 1) });
    i = end + 1;
  }
  return hunks;
}
