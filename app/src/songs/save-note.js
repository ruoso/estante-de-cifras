// save-note.js — the pure default note the save sheet prefills (songs.save_sheet,
// Decision 3; workflow 4 §Saving, §Several songs at once). The note is the git
// commit message, stored in history and shared with every member of the book, so
// it stays the diff's neutral-English `summary` verbatim — one reproducible line,
// not localized (Decision 3). For one song it is that song's summary; for *save
// all* it is each song's summary, prefixed with its title, joined with "; ", so a
// single commit over many files still names what it carries for each.
//
// Pure: no React, no I/O.

/**
 * The default save note for one or more previews.
 *
 * @param {Array<{ title?: string, summary?: string }>} previews
 * @returns {string}
 */
export function buildSaveNote(previews) {
  const list = Array.isArray(previews) ? previews : [];
  if (list.length === 0) return '';
  if (list.length === 1) return list[0]?.summary ?? '';
  return list
    .map((p) => {
      const title = (p?.title ?? '').trim();
      const summary = p?.summary ?? '';
      return title ? `${title}: ${summary}` : summary;
    })
    .join('; ');
}
