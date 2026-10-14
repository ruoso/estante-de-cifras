// save-note.js — the pure default note the save sheet prefills (songs.save_sheet,
// Decision 3; workflow 4 §Saving, §Several songs at once). The note is the git
// commit message, stored in history and shared with every member of the book, so
// it stays the diff's neutral-English `summary` verbatim — one reproducible line,
// not localized (Decision 3). For one song it is that song's summary; for *save
// all* it is each song's summary, prefixed with its title, joined with "; ", so a
// single commit over many files still names what it carries for each.
//
// When there is no musical summary — a file that is not a song (README.md), or a
// save with nothing musical in it — the note names the paths it saves instead,
// *Update README.md* (songs.save_empty_message, workflow 4 §Saving): a save is
// never left without a message. The Worker applies the same default to a blank
// note (one definition, imported there too), so the sheet's prefill is exactly
// what a cleared note commits.
//
// Pure: no React, no I/O.

/**
 * The default commit message for a save with no musical summary: `Update` and
 * the book-relative paths, comma-joined in the given order. Neutral English, not
 * localized (songs.save_sheet Decision 3).
 *
 * @param {string[]} paths
 * @returns {string}
 */
export function defaultSaveMessage(paths) {
  const list = (Array.isArray(paths) ? paths : []).filter(Boolean);
  return list.length ? `Update ${list.join(', ')}` : 'Update';
}

/**
 * The default save note for one or more previews.
 *
 * @param {Array<{ path?: string, title?: string, summary?: string }>} previews
 * @returns {string}
 */
export function buildSaveNote(previews) {
  const list = Array.isArray(previews) ? previews : [];
  if (list.length === 0) return '';
  if (list.length === 1) return list[0]?.summary || defaultSaveMessage([list[0]?.path]);
  return list
    .map((p) => {
      const title = (p?.title ?? '').trim();
      const summary = p?.summary ?? '';
      if (!summary) return defaultSaveMessage([p?.path]);
      return title ? `${title}: ${summary}` : summary;
    })
    .join('; ');
}
