// my-songs-choice.js — whether to offer a device its two *My songs* choice
// (account.new_device acceptance 6; workflow 13 §A device used before signing
// in). A device used before signing in may have its own *My songs*; when the
// account has one too, the device is asked to merge the two or keep both.
//
// The account's *My songs* is the one a device put online: the home book's
// `shelf.mySongs` register names that hosted book (home-book-format §4.2,
// Decision 7). When the account's *My songs* was never put online it is only on
// another device, with nothing here to merge into, so nothing is offered.
//
// Pure: the Worker reads the shelf, counts this device's songs and the
// device-local *keep both* flag, and emits what this decides. No I/O, no
// logging.

import { MY_SONGS_ID } from './my-songs.js';

// A register's value when it is live — present, not a tombstone, not empty.
function liveValue(register) {
  if (!register || typeof register !== 'object') return undefined;
  const value = register.value;
  return value === null || value === undefined || value === '' ? undefined : value;
}

/**
 * The offer, or null. Offered only when ALL hold:
 *   - `shelf.mySongs` names a live hosted book on the shelf (one with a link);
 *   - this device has a live *My songs* of its own (`shelf.local[deviceId]
 *     [MY_SONGS_ID]`) with at least one song (`localSongs`);
 *   - this device has not chosen *keep both* (`keptBoth`).
 *
 * @param {{ shelf: Object, deviceId: string, localSongs: number, keptBoth: boolean }} opts
 * @returns {{ accountBookId: string } | null}
 */
export function mySongsOffer({ shelf, deviceId, localSongs, keptBoth }) {
  if (keptBoth) return null;
  if (!shelf || typeof shelf !== 'object') return null;
  const accountBookId = liveValue(shelf.mySongs);
  if (typeof accountBookId !== 'string' || accountBookId === MY_SONGS_ID) return null;
  if (typeof liveValue(shelf.books?.[accountBookId]?.link) !== 'string') return null;
  if (typeof liveValue(shelf.local?.[deviceId]?.[MY_SONGS_ID]?.title) !== 'string') return null;
  if (!(Number.isInteger(localSongs) && localSongs >= 1)) return null;
  return { accountBookId };
}
