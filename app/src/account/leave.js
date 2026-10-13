// leave.js — the pure predicates for workflow 17 (Leaving). No DOM, no React, no
// Worker: the view-side shapes the delete-account dialog reads, kept here so they
// can be unit-tested in isolation (precedent: sign_in and sign_out each added a
// pure unit module for their shapes).
//
// Two things live here:
//   - canDeleteAccount — the enable predicate for the terminal Delete action
//     (workflow 17 §Deleting / §Offline): the typed-email field is non-empty AND
//     the device is online. The email itself is verified server-side (Decision 4),
//     so the predicate never compares addresses — it only gates deliberateness.
//   - aggregateLeaveWarnings — merges the sign-out survey's per-book counts
//     (SURVEY_SIGN_OUT) with per-owned-book member counts (listMembers) into the
//     two warning lists the dialog shows (workflow 17 §The warnings, counted,
//     lines 68-83; §What happens to books others are members of, lines 85-113):
//       · "who loses access" — one line per OWNED book; a book shared with others
//         carries its member count, a book nobody else shares is "only you".
//       · "only on this device" — one line per book with unsaved or not-yet-pushed
//         work that would be lost with the device copy (reusing the sign-out
//         survey's measure), regardless of ownership.
//     A book the leaver is only a member of (role 'editor'/'reader') never appears
//     under "who loses access" — leaving ends only that membership, the book is
//     untouched (workflow 17 lines 101-103); it still shows under "only on this
//     device" if it holds unsaved work. The home book is not surveyed, so it never
//     reaches either list here.

/**
 * Whether the terminal Delete action may fire: a non-empty typed confirmation and
 * an online device (deleting is the one action that waits for a connection —
 * workflow 17 §Offline). The address match is the server's (Decision 4).
 *
 * @param {{ confirmEmail?: string, online?: boolean }} state
 * @returns {boolean}
 */
export function canDeleteAccount({ confirmEmail = '', online = false } = {}) {
  return confirmEmail.trim().length > 0 && Boolean(online);
}

/**
 * Split the sign-out survey records into the delete dialog's two warning lists.
 *
 * @param {{
 *   books?: Array<{ id: string, title: string, role?: string|null,
 *                   savesWaiting?: number, unsavedSongs?: number }>,
 *   memberCounts?: Record<string, number>,
 * }} input
 * @returns {{
 *   loseAccess: Array<{ id: string, title: string, count: number }>,
 *   onlyHere: Array<{ id: string, title: string, unsavedSongs: number, savesWaiting: number }>,
 * }}
 *   `loseAccess` is OWNED books only (one line each; `count` is members besides
 *   the owner — 0 means "only you — deleted"). `onlyHere` is every book carrying
 *   device-only work that would be lost.
 */
export function aggregateLeaveWarnings({ books = [], memberCounts = {} } = {}) {
  const loseAccess = [];
  const onlyHere = [];
  for (const book of books) {
    const unsavedSongs = book.unsavedSongs ?? 0;
    const savesWaiting = book.savesWaiting ?? 0;
    if (unsavedSongs > 0 || savesWaiting > 0) {
      onlyHere.push({ id: book.id, title: book.title, unsavedSongs, savesWaiting });
    }
    if (book.role === 'owner') {
      const count = memberCounts[book.id] ?? 0;
      loseAccess.push({ id: book.id, title: book.title, count });
    }
  }
  return { loseAccess, onlyHere };
}
