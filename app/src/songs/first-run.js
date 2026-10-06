// first-run.js — the pure, framework-free decisions behind the search screen's
// first-run empty state (account.first_run, workflow 1 §Cold / §My songs). It
// knows nothing of React: it decides WHEN the first-run state shows, resolves a
// book's shelf label (widened so a local book shows its title, not its opaque
// id), and names the listed-from-the-start My songs entry. The screen
// (SearchScreen.jsx) owns the state and the RAC view; FirstRun.jsx renders it;
// this module owns the parts that are testable without a DOM.
//
// Pure: no I/O, no React, no logging, no labels in any message (standing rule).

/**
 * Whether the search screen's pre-typing region shows the first-run empty state
 * rather than the normal recents / books-as-sections listing: the shelf has no
 * books to list AND there are no recents (workflow 1 §Cold; refinement Decision
 * 1, SearchScreen.jsx:414-460). Once either is non-empty the normal pre-typing
 * state takes over (acceptance 4).
 *
 * @param {Array} bookIds the book ids the screen would list (browse ∪ building)
 * @param {Array} recentItems the device-local recents the screen would list
 * @returns {boolean}
 */
export function showsFirstRun(bookIds, recentItems) {
  return bookIds.length === 0 && recentItems.length === 0;
}

/**
 * A book's display label on the shelf, resolved from the surfaced `shelf` slice
 * (storage.shelf_surface). A local book shows its `title` register, a shared
 * book its `label` register, and anything else falls back to the opaque book id
 * (refinement Decision 5; home-book-format §4.2). `local` is already narrowed to
 * this device by `surfaceShelf`, so `shelf.local[id]` is this device's marker.
 * A cleared tombstone or empty value falls through to the next source, the same
 * way the shared-label resolver did before this widening (home-book-format §5.3).
 *
 * @param {{ books?: Object, local?: Object }} shelf the `shelf` slice
 * @param {string} bookId
 * @returns {string}
 */
export function bookLabelFor(shelf, bookId) {
  return (
    shelf?.local?.[bookId]?.title?.value ||
    shelf?.books?.[bookId]?.label?.value ||
    bookId
  );
}

// The My songs identity, shared so the first-run view and the first-write
// creation of the repository (songs.new_song, "My songs created when first
// written to") agree (refinement Decision 4). In the first-run state My songs is
// a listed-from-the-start SYNTHETIC entry labelled live from i18n — no shelf
// entry is stored and no repository is created here (workflow 1 §My songs:
// "listed from the start … created when the first song is written into it").
// `id` keeps the `local-` prefix books.js uses for device-born books; it is the
// reserved identity songs.new_song will create the repository under.
export const MY_SONGS = Object.freeze({
  id: 'local-my-songs',
  labelKey: 'firstRun.mySongs',
  metaKey: 'firstRun.mySongsMeta',
});
