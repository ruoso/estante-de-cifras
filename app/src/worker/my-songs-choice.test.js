import { describe, it, expect } from 'vitest';
import { mySongsOffer } from './my-songs-choice.js';
import { MY_SONGS_ID } from './my-songs.js';

// unit — the *My songs* choice's offer predicate (account.new_device acceptance
// 6; workflow 13 §A device used before signing in, delta: the account's My songs
// is the one a device put online; with none online, nothing is offered).

const AT = '2026-10-15T10:00:00.000Z';
const reg = (value) => ({ value, at: AT });
const DEVICE = 'dev-tablet';
const OTHER = 'dev-phone';

function shelfWith({ mySongs = 'srv-ms', hosted = true, local = true } = {}) {
  return {
    ...(mySongs ? { mySongs: reg(mySongs) } : {}),
    books: hosted
      ? { 'srv-ms': { label: reg('My songs'), link: reg('/git/srv-ms'), position: reg(0), role: reg('owner') } }
      : {},
    local: {
      ...(local ? { [DEVICE]: { [MY_SONGS_ID]: { title: reg('My songs'), position: reg(1) } } } : {}),
    },
  };
}

describe('mySongsOffer (unit)', () => {
  it('offers when the account’s My songs is online, this device has songs in its own, and has not kept both', () => {
    expect(mySongsOffer({ shelf: shelfWith(), deviceId: DEVICE, localSongs: 2, keptBoth: false })).toEqual({
      accountBookId: 'srv-ms',
    });
  });

  it('does not offer once this device kept both', () => {
    expect(mySongsOffer({ shelf: shelfWith(), deviceId: DEVICE, localSongs: 2, keptBoth: true })).toBeNull();
  });

  it('does not offer when this device’s My songs has no songs, or there is none', () => {
    expect(mySongsOffer({ shelf: shelfWith(), deviceId: DEVICE, localSongs: 0, keptBoth: false })).toBeNull();
    expect(
      mySongsOffer({ shelf: shelfWith({ local: false }), deviceId: DEVICE, localSongs: 3, keptBoth: false }),
    ).toBeNull();
  });

  it('does not offer when mySongs names no live hosted book', () => {
    // No register at all: the account's My songs was never put online.
    expect(
      mySongsOffer({ shelf: shelfWith({ mySongs: null }), deviceId: DEVICE, localSongs: 2, keptBoth: false }),
    ).toBeNull();
    // A register naming a book the shelf no longer holds.
    expect(
      mySongsOffer({ shelf: shelfWith({ hosted: false }), deviceId: DEVICE, localSongs: 2, keptBoth: false }),
    ).toBeNull();
  });

  it('does not offer when the account’s My songs is only local on another device (workflow 13 delta)', () => {
    const shelf = {
      books: {},
      local: {
        [OTHER]: { [MY_SONGS_ID]: { title: reg('My songs'), position: reg(0) } },
        [DEVICE]: { [MY_SONGS_ID]: { title: reg('My songs'), position: reg(0) } },
      },
    };
    expect(mySongsOffer({ shelf, deviceId: DEVICE, localSongs: 4, keptBoth: false })).toBeNull();
  });
});
