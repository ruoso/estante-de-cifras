// The editor's save gate (songs.save_sheet Decision 3; songs.save_gate_dropped_section):
// which of the reader's diagnostics stop a save, for which path, and which stop
// message each shows. Pure — keyed on the reader's diagnostic codes (editor
// Decision 8: no second grammar), so it re-scans nothing.
//
// - `marker-line` — a conflict marker is never canonical (spec §8.1/§11.12.3):
//   it stops a save of every file.
// - `bad-voicing` — a voicing the reader could not read, which canonicalising
//   would silently drop (workflow 4 §Normalising; spec §8.3).
// - `bad-block-heading`, `notes-outside-block`, `item-outside-block` — content
//   after the rule the song writer drops (spec §7.2, §7.4, §8.2): a heading with
//   no tuning and the lines under it, or text/a voicing before the first block.
// The last four describe a drop only where the Worker writes the file with the
// song writer — a `*.cifra.md` path, or a new song with no path yet
// (worker/canonicalise.js canonicaliseFile). A setlist has its own writer, and
// README.md / `.gitattributes` are saved as written (books.save_readme_verbatim
// Decision 4).

const SONG_SUFFIX = '.cifra.md';

const EVERY_FILE = new Set(['marker-line']);
const SONG_WRITER = new Set(['bad-voicing', 'bad-block-heading', 'notes-outside-block', 'item-outside-block']);
const AFTER_RULE = new Set(['bad-block-heading', 'notes-outside-block', 'item-outside-block']);

/**
 * The diagnostics that stop a save of `path`, in line order.
 *
 * @param {Array<{ code: string, line: number }>} diagnostics  the reader's (`parse`) diagnostics
 * @param {string|null|undefined} path  the file's path within the book; none for a new song
 * @returns {Array<{ code: string, line: number }>}
 */
export function saveBlockers(diagnostics, path) {
  const songWriter = !path || path.endsWith(SONG_SUFFIX);
  return diagnostics
    .filter((d) => EVERY_FILE.has(d.code) || (songWriter && SONG_WRITER.has(d.code)))
    .sort((a, b) => a.line - b.line);
}

/**
 * The i18n key of the stop message for a blocking diagnostic's code.
 *
 * @param {string} code
 * @returns {'editor.source.markerStop'|'editor.source.voicingStop'|'editor.source.afterRuleStop'}
 */
export function stopMessageKey(code) {
  if (code === 'marker-line') return 'editor.source.markerStop';
  if (AFTER_RULE.has(code)) return 'editor.source.afterRuleStop';
  return 'editor.source.voicingStop';
}
