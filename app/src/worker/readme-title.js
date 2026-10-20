// readme-title.js — a book's title from its README (DIRECTION §2.1: "A book's
// title is the level-1 heading of its README"). Shared by the upload import,
// FORK and the shelf backfill at OPEN (songs.no_raw_ids Constraint 7). Pure: no
// I/O, no logging — a heading is the user's words (standing rule).

const decoder = new TextDecoder();

/**
 * The first level-1 heading (`# Title`) of a README, trimmed, or `null` when
 * there is none. A `##` heading is not a title.
 *
 * @param {Uint8Array | string | null | undefined} bytes the README's bytes or text
 * @returns {string | null}
 */
export function readmeTitle(bytes) {
  if (bytes == null) return null;
  const text = typeof bytes === 'string' ? bytes : decoder.decode(bytes);
  const m = text.match(/^#[ \t]+(.*?)[ \t]*$/m);
  const title = m ? m[1].trim() : '';
  return title ? title : null;
}
