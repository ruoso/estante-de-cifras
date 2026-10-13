// sign-out.js — the pure survey aggregation and the keep-as-local shelf-change
// computation for account.sign_out (workflow 13 §Signing out, docs/workflows/
// 13-new-device.md:82-88). No git, no IndexedDB, no React: the SURVEY_SIGN_OUT
// and SIGN_OUT handlers in logic.js gather the per-book facts under the Worker's
// locks and call these to shape the dialog's survey and to build the shelf
// changes the teardown writes through home-book `set`. Kept pure so the survey
// shape and the migration are unit-testable without a worker (Decision 2, 3).

/**
 * Split the per-book sign-out records into the dialog's two notices:
 *
 * - `notYetOnEstante` — books that ARE on Estante but still carry work only on
 *   this device: unsaved working changes and/or saves not yet pushed. These are
 *   warned about ("Not yet on Estante: … unsaved changes in N songs / N saves
 *   not yet pushed", mockup W13-new-device.dc.html:187-191), per book.
 * - `downloadGuard` — books that are only on this device (a local book, or a
 *   shared book whose content is not on Estante yet). The remove branch offers
 *   each a download before it is removed (mockup line 192; workflow lines 87-88).
 *
 * A pure function of the records the survey gathered; it reads no data itself.
 *
 * @param {Array<{ id: string, title: string, kind: 'local' | 'shared',
 *   role: string | null, savesWaiting: number, unsavedSongs: number,
 *   onEstante: boolean }>} books
 * @returns {{ notYetOnEstante: Array<{ id, title, unsavedSongs, savesWaiting }>,
 *   downloadGuard: Array<{ id, title }> }}
 */
export function aggregateSignOutSurvey(books = []) {
  const notYetOnEstante = [];
  const downloadGuard = [];
  for (const book of books) {
    const savesWaiting = book.savesWaiting ?? 0;
    const unsavedSongs = book.unsavedSongs ?? 0;
    const onEstante = Boolean(book.onEstante);
    if (onEstante && (unsavedSongs > 0 || savesWaiting > 0)) {
      notYetOnEstante.push({ id: book.id, title: book.title, unsavedSongs, savesWaiting });
    }
    if (book.kind === 'local' || !onEstante) {
      downloadGuard.push({ id: book.id, title: book.title });
    }
  }
  return { notYetOnEstante, downloadGuard };
}

/**
 * The shelf changes that turn a shared book into a local book on this device —
 * the inverse of put-online's migration (logic.js PUT_ONLINE, Decision 3).
 * Put-online moves `local/{deviceId}/{id}` → `books/{id}` and adopts the service
 * id; keep-as-local tombstones the hosted register (`books/{id}`) and writes the
 * local register (`local/{deviceId}/{id}`), carrying the hosted label as the
 * local title and keeping the position. The git remote is stripped separately
 * (online.detach); the repo, working copy and history stay in place.
 *
 * @param {{ bookId: string, deviceId: string, label: string | null,
 *   position: number | null }} args
 * @returns {Array<{ path: string[], value: * }>} home-book `set` changes
 */
export function keepAsLocalChanges({ bookId, deviceId, label, position }) {
  return [
    { path: ['books', bookId, 'label'], value: null },
    { path: ['books', bookId, 'link'], value: null },
    { path: ['books', bookId, 'position'], value: null },
    { path: ['books', bookId, 'role'], value: null },
    { path: ['local', deviceId, bookId, 'title'], value: label ?? null },
    { path: ['local', deviceId, bookId, 'position'], value: position ?? null },
  ];
}

/**
 * The shelf changes that tombstone a book's register for removal — the same
 * register shape REMOVE_BOOK tombstones (logic.js:1555-1591): a hosted book's
 * `label`/`link`/`position`/`role`, a local book's `title`/`position`.
 *
 * @param {{ bookId: string, deviceId: string, kind: 'local' | 'shared' }} args
 * @returns {Array<{ path: string[], value: null }>} home-book `set` changes
 */
export function removeChanges({ bookId, deviceId, kind }) {
  return kind === 'local'
    ? [
        { path: ['local', deviceId, bookId, 'title'], value: null },
        { path: ['local', deviceId, bookId, 'position'], value: null },
      ]
    : [
        { path: ['books', bookId, 'label'], value: null },
        { path: ['books', bookId, 'link'], value: null },
        { path: ['books', bookId, 'position'], value: null },
        { path: ['books', bookId, 'role'], value: null },
      ];
}
