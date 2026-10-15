// unit (account.leaving) — the pure predicates behind the Delete-my-account
// dialog: the enable gate and the warnings aggregator. Pins workflow 17 §The
// warnings, counted (lines 68-83) and §What happens to books others are members
// of (lines 85-113), and §Offline (the enable gate waits for a connection).

import { describe, it, expect } from 'vitest';

import { canDeleteAccount, aggregateLeaveWarnings } from './leave.js';

describe('canDeleteAccount (workflow 17 §Deleting / §Offline)', () => {
  // confirmBy 'email': the typed path, unchanged by account.recovery_email.
  it('is false until the field is non-empty', () => {
    expect(canDeleteAccount({ confirmBy: 'email', confirmEmail: '', online: true })).toBe(false);
    expect(canDeleteAccount({ confirmBy: 'email', confirmEmail: '   ', online: true })).toBe(false);
  });

  it('is false while offline, even with a typed address (deleting waits for a connection)', () => {
    expect(
      canDeleteAccount({ confirmBy: 'email', confirmEmail: 'rafael@example.com', online: false }),
    ).toBe(false);
  });

  it('is true with a non-empty field and an online device', () => {
    expect(
      canDeleteAccount({ confirmBy: 'email', confirmEmail: 'rafael@example.com', online: true }),
    ).toBe(true);
  });

  it('defaults to false with nothing supplied', () => {
    expect(canDeleteAccount()).toBe(false);
  });
});

// account.recovery_email — workflow 17 §An account with no email (L70–92): a
// passkey-only account confirms with a passkey, so nothing is typed.
describe('canDeleteAccount — confirmBy (workflow 17 §An account with no email)', () => {
  it("'passkey' is enabled online with an empty field", () => {
    expect(canDeleteAccount({ confirmBy: 'passkey', confirmEmail: '', online: true })).toBe(true);
  });

  it("'passkey' is disabled offline", () => {
    expect(canDeleteAccount({ confirmBy: 'passkey', confirmEmail: '', online: false })).toBe(false);
  });

  it('null (not yet known) is always disabled', () => {
    expect(canDeleteAccount({ confirmBy: null, confirmEmail: '', online: true })).toBe(false);
    expect(
      canDeleteAccount({ confirmBy: null, confirmEmail: 'rafael@example.com', online: true }),
    ).toBe(false);
    expect(canDeleteAccount({ confirmBy: null, confirmEmail: '', online: false })).toBe(false);
  });
});

describe('aggregateLeaveWarnings (workflow 17 §The warnings, counted)', () => {
  // One owned book shared with others, one owned book nobody else shares, one
  // book the leaver only reads, plus each carrying its own device-only work.
  const books = [
    { id: 'banda', title: 'Banda do Bairro', role: 'owner', unsavedSongs: 2, savesWaiting: 0 },
    { id: 'mine', title: 'My songs', role: 'owner', unsavedSongs: 0, savesWaiting: 1 },
    { id: 'ana', title: 'Choros da Ana', role: 'reader', unsavedSongs: 0, savesWaiting: 0 },
  ];
  const memberCounts = { banda: 12, mine: 0 };

  it('lists every owned book under "who loses access", members-only books never', () => {
    const { loseAccess } = aggregateLeaveWarnings({ books, memberCounts });
    expect(loseAccess).toEqual([
      { id: 'banda', title: 'Banda do Bairro', count: 12 },
      { id: 'mine', title: 'My songs', count: 0 },
    ]);
    // The read-only book is untouched but for the membership; it never appears.
    expect(loseAccess.some((b) => b.id === 'ana')).toBe(false);
  });

  it('a count of 0 is the "only you — deleted" branch; a positive count is "shared with N"', () => {
    const { loseAccess } = aggregateLeaveWarnings({ books, memberCounts });
    expect(loseAccess.find((b) => b.id === 'mine').count).toBe(0);
    expect(loseAccess.find((b) => b.id === 'banda').count).toBe(12);
  });

  it('an owned book with no member count defaults to "only you" (0)', () => {
    const { loseAccess } = aggregateLeaveWarnings({ books, memberCounts: {} });
    expect(loseAccess.every((b) => b.count === 0)).toBe(true);
  });

  it('lists only books with unsaved or not-yet-pushed work under "only on this device"', () => {
    const { onlyHere } = aggregateLeaveWarnings({ books, memberCounts });
    expect(onlyHere).toEqual([
      { id: 'banda', title: 'Banda do Bairro', unsavedSongs: 2, savesWaiting: 0 },
      { id: 'mine', title: 'My songs', unsavedSongs: 0, savesWaiting: 1 },
    ]);
    // The read-only book carries no device-only work, so it is absent.
    expect(onlyHere.some((b) => b.id === 'ana')).toBe(false);
  });

  it('a member-only book with unsaved work shows only under "only on this device"', () => {
    const memberBook = [
      { id: 'ana', title: 'Choros da Ana', role: 'reader', unsavedSongs: 3, savesWaiting: 0 },
    ];
    const { loseAccess, onlyHere } = aggregateLeaveWarnings({ books: memberBook });
    expect(loseAccess).toEqual([]);
    expect(onlyHere).toEqual([{ id: 'ana', title: 'Choros da Ana', unsavedSongs: 3, savesWaiting: 0 }]);
  });

  it('returns empty lists for an empty survey', () => {
    expect(aggregateLeaveWarnings()).toEqual({ loseAccess: [], onlyHere: [] });
  });
});
