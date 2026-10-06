// The new-song starting text (workflow 3 §The editor L64-66, §The notation
// property L82-85; mockup W03 `edTemplate`). A new song opens on a template:
// the title, the properties it will want, one empty section with its fence,
// and the cursor on the empty line inside that fence.
//
// `notation:` is always written from the user's dialect preference so the song
// "reads the same to someone whose preference differs" (Decision 9): a reader
// with no `notation` property defaults to Brazilian, which would change how the
// song reads for a user whose preference differs.

import { DEFAULT_DIALECT } from 'cifra-md';

/**
 * The dialect a new song is written in: the preferences slice's notation
 * value, falling back to the format default when the slice is absent.
 *
 * @param {object} [preferences] the `preferences` worker slice
 * @returns {string} a dialect id (e.g. `'brazilian'`)
 */
export function templateDialect(preferences) {
  return preferences?.notation?.value ?? DEFAULT_DIALECT;
}

/**
 * The starting text and cursor offset for a new song.
 *
 * @param {object} [preferences] the `preferences` worker slice (for the dialect)
 * @param {object} [options]
 * @param {string} [options.title] an initial title (e.g. a search query); the
 *   heading is left empty when absent, as `songs.new_song` fills it later.
 * @returns {{ text: string, cursor: number }} the buffer text and the offset to
 *   place the cursor at (the empty line inside the section's fence).
 */
export function template(preferences, { title = '' } = {}) {
  const dialect = templateDialect(preferences);
  // Everything up to (and including) the fence-open line; the cursor sits at
  // the empty line that follows it, between the fence delimiters.
  const head =
    `# ${title}\n` +
    `- artist:\n` +
    `- notation: ${dialect}\n` +
    `\n` +
    `## Intro\n` +
    '```\n';
  const text = head + '\n```';
  return { text, cursor: head.length };
}
