// song-filename.js — deriving a song's file name from its title (songs.new_song,
// workflow 3 §Its file name; DIRECTION §4 L446-448). A new song is "named once,
// from its title", and the name is the title folded to ASCII: accents dropped,
// lower case, runs of anything else turned into one hyphen, so *Coração
// Vagabundo* becomes `coracao-vagabundo.cifra.md`. ASCII because accented file
// names are where tools disagree (macOS vs git vs zip).
//
// A small pure module, framework-free and I/O-free, deliberately placed under
// `songs/` rather than `worker/` so BOTH sides reach it (Decision 1): the Worker
// computes the authoritative name — with a collision suffix against the real
// folder listing it alone has — at NAME_AND_SAVE, and the view (and later
// `songs.save_sheet`) previews the same name in its save sheet (the W03 File
// name field). A framework-free module importable by both keeps them in
// agreement.
//
// It is a DIFFERENT transform from search's `fold.js`: that folds text for
// matching (accent/case-insensitive comparison); this folds a title into a
// path-safe, collision-free filename (hyphenation, `.cifra.md`, the `-N`
// suffix). It shares only the NFD-accent-drop idea, not the code.

// The file extension every song carries (spec; the save/canonicalise path keys
// off it too — canonicalise.js).
const SONG_SUFFIX = '.cifra.md';

// The placeholder slug a title-less new song gets: `untitled.cifra.md`,
// `untitled-2.cifra.md`, … (workflow 3 §Its file name L39-41). Also the slug a
// title that folds to nothing (only punctuation/accents) falls back to.
const PLACEHOLDER_SLUG = 'untitled';

// Combining marks (U+0300–U+036F): the accents NFD splits a letter into, dropped
// so an accented letter folds to its ASCII base (é → e, ç → c after NFD).
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Fold a title to its ASCII slug: NFD-decompose and drop combining marks
 * (accents), lower-case, turn every run of non-alphanumeric characters into one
 * hyphen, and trim leading/trailing hyphens. A title that folds to nothing
 * yields the empty string (the caller substitutes the placeholder slug).
 *
 * @param {string} title
 * @returns {string} the slug, without extension
 */
export function slugify(title) {
  return String(title ?? '')
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The file name a song with this `title` takes, free of collision against
 * `existing` (workflow 3 §Its file name L39-48). The title is slugified (an
 * empty/placeholder title yields `untitled`) and `.cifra.md` appended; a name
 * already in `existing` gains `-2`, `-3`, … (so `untitled` taken → `untitled-2`).
 *
 * `existing` is the set of file names already in the same folder — the names
 * this one must not clash with. The Worker passes the real folder listing (the
 * authoritative name); the view passes nothing (a bare preview, no suffix).
 *
 * @param {string} title the song's title (its `#` heading)
 * @param {Iterable<string>} [existing] file names already in the folder
 * @returns {string} e.g. `coracao-vagabundo.cifra.md`
 */
export function deriveSongFilename(title, existing = []) {
  const taken = existing instanceof Set ? existing : new Set(existing);
  const slug = slugify(title) || PLACEHOLDER_SLUG;
  const base = `${slug}${SONG_SUFFIX}`;
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${slug}-${n}${SONG_SUFFIX}`;
    if (!taken.has(candidate)) return candidate;
  }
}
