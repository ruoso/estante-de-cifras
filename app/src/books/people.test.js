// unit (books.share_people) — the pure wording of a book's people: names, never
// account ids (workflow 10 §Who sees whom, as books.share_people revised it),
// the members counted by role (W10 #1), who joined through an invitation (W10
// #3), the invitation a member joined through (Decision 7), and the room left
// under fifty (workflow 10 §At most fifty people per book).

import { describe, it, expect, beforeEach } from 'vitest';

import { setLocale, t } from '../i18n/index.js';
import {
  canCopyLink,
  invitationShort,
  invitationState,
  invitationTitle,
  joinedSummary,
  joinedThrough,
  joinerLabel,
  memberSummary,
  personLabel,
  roomLeft,
  shortDate,
  usesLeft,
} from './people.js';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

beforeEach(() => setLocale('en'));

describe('personLabel — a name, else a word by role, never the id', () => {
  it('reads the display name the service sends', () => {
    expect(personLabel({ userId: id(1), role: 'reader', displayName: 'Bia Rocha' }, { t })).toBe('Bia Rocha');
  });

  it('reads an unnamed person by role', () => {
    expect(personLabel({ userId: id(2), role: 'reader' }, { t })).toBe('Unnamed reader');
    expect(personLabel({ userId: id(3), role: 'editor', displayName: '  ' }, { t })).toBe('Unnamed editor');
    expect(personLabel({ userId: id(4), role: 'owner' }, { t })).not.toMatch(UUID);
  });

  it('reads a joiner by their name, their role now, or Someone unnamed', () => {
    const members = [{ userId: id(5), role: 'editor' }];
    expect(joinerLabel({ userId: id(6), displayName: 'Caio Nunes' }, members, { t })).toBe('Caio Nunes');
    expect(joinerLabel({ userId: id(5) }, members, { t })).toBe('Unnamed editor');
    expect(joinerLabel({ userId: id(7) }, members, { t })).toBe('Someone unnamed');
  });
});

describe('memberSummary — the members counted by role (W10 #1)', () => {
  const owner = { userId: id(1), role: 'owner' };
  const editor = { userId: id(2), role: 'editor' };
  const readers = Array.from({ length: 36 }, (_, i) => ({ userId: id(10 + i), role: 'reader' }));

  it('reads "You, 1 editor, 36 readers"', () => {
    expect(memberSummary([owner, editor, ...readers], { t })).toBe('You, 1 editor, 36 readers');
  });

  it('is singular and plural by count, and leaves out a role nobody holds', () => {
    expect(memberSummary([owner, editor, { userId: id(3), role: 'editor' }, readers[0]], { t })).toBe(
      'You, 2 editors, 1 reader',
    );
    expect(memberSummary([owner], { t })).toBe('You');
  });

  it('drops You for a song panel (W10 #4: "1 editor, 36 readers")', () => {
    expect(memberSummary([owner, editor, ...readers], { t, you: false })).toBe('1 editor, 36 readers');
  });
});

describe('joinedSummary — who joined through an invitation (W10 #3)', () => {
  const join = (n, name) => ({ userId: id(n), joinedAt: '2026-10-02T10:00:00Z', ...(name ? { displayName: name } : {}) });

  it('reads nobody yet, or one name alone', () => {
    expect(joinedSummary({ joined: [] }, [], { t })).toBe('nobody yet');
    expect(joinedSummary({ joined: [join(1, 'Marina Costa')] }, [], { t })).toBe('Marina Costa');
  });

  it('lists up to four names after the count', () => {
    const inv = { joined: [join(1, 'Joana Lima'), join(2, 'Rafael Souza'), join(3, 'Beatriz Alves')] };
    expect(joinedSummary(inv, [], { t })).toBe('3 people: Joana Lima, Rafael Souza, and Beatriz Alves');
  });

  it('beyond four, the first four and "and {n} more"', () => {
    const names = ['Joana Lima', 'Rafael Souza', 'Beatriz Alves', 'Lucas Pereira'];
    const joined = [...names.map((n, i) => join(i + 1, n)), ...Array.from({ length: 32 }, (_, i) => join(100 + i))];
    expect(joinedSummary({ joined }, [], { t })).toBe(
      '36 people: Joana Lima, Rafael Souza, Beatriz Alves, Lucas Pereira and 32 more',
    );
  });

  it('never shows an id for an unnamed joiner', () => {
    const text = joinedSummary({ joined: [join(1), join(2)] }, [{ userId: id(1), role: 'reader' }], { t });
    expect(text).toBe('2 people: Unnamed reader and Someone unnamed');
    expect(text).not.toMatch(UUID);
  });
});

describe('joinedThrough — the invitation a member joined through (Decision 7)', () => {
  const member = { userId: id(9), role: 'reader' };
  it('is the latest invitation whose joined holds the member', () => {
    const older = { id: 'a', joined: [{ userId: id(9), joinedAt: '2026-09-28T00:00:00Z' }] };
    const newer = { id: 'b', joined: [{ userId: id(9), joinedAt: '2026-10-02T00:00:00Z' }] };
    const other = { id: 'c', joined: [{ userId: id(8), joinedAt: '2026-10-05T00:00:00Z' }] };
    expect(joinedThrough(member, [older, newer, other]).id).toBe('b');
    expect(joinedThrough(member, [newer, older]).id).toBe('b');
  });

  it('is null when no invitation holds them', () => {
    expect(joinedThrough(member, [{ id: 'c', joined: [{ userId: id(8) }] }])).toBeNull();
    expect(joinedThrough(member, null)).toBeNull();
  });
});

describe('roomLeft and an invitation’s uses and state (workflow 10 §At most fifty, §Invitations)', () => {
  it('is the limit less the count, never below zero', () => {
    expect(roomLeft(37, 50)).toBe(13);
    expect(roomLeft(50, 50)).toBe(0);
    expect(roomLeft(51, 50)).toBe(0);
  });

  it('reads uses left from the cap and the joins', () => {
    expect(usesLeft({ useLimit: null, joinedCount: 4 })).toBeNull();
    expect(usesLeft({ useLimit: 3, joinedCount: 1 })).toBe(2);
    expect(usesLeft({ useLimit: 1, joinedCount: 1 })).toBe(0);
  });

  it('reads withdrawn, expired, used up, else open — and offers Copy link only while open with a url', () => {
    const now = Date.parse('2026-10-05T00:00:00Z');
    const open = { withdrawn: false, expiresAt: '2026-10-09T00:00:00Z', useLimit: null, joinedCount: 0, url: 'https://e/i/x' };
    expect(invitationState(open, now)).toBe('open');
    expect(canCopyLink(open, now)).toBe(true);
    expect(canCopyLink({ ...open, url: undefined }, now)).toBe(false);
    expect(invitationState({ ...open, withdrawn: true }, now)).toBe('withdrawn');
    expect(invitationState({ ...open, expiresAt: '2026-10-01T00:00:00Z' }, now)).toBe('expired');
    expect(invitationState({ ...open, useLimit: 1, joinedCount: 1 }, now)).toBe('usedUp');
    expect(canCopyLink({ ...open, useLimit: 1, joinedCount: 1 }, now)).toBe(false);
  });
});

describe('an invitation’s title and the sheet’s line for it (W10 #1)', () => {
  const now = Date.parse('2026-10-05T00:00:00Z');
  it('titles it by role and date', () => {
    expect(shortDate('2026-10-02T12:00:00Z', 'en')).toBe('2 Oct');
    expect(invitationTitle({ role: 'reader', createdAt: '2026-10-02T12:00:00Z' }, { t })).toBe('Reader invitation · 2 Oct');
  });

  it('reads "open until 9 Oct · 36 joined" and "1 use, used · Marina Costa joined"', () => {
    const many = Array.from({ length: 36 }, (_, i) => ({ userId: id(i) }));
    expect(
      invitationShort({ expiresAt: '2026-10-09T12:00:00Z', useLimit: null, joined: many, joinedCount: 36 }, [], { t, now }),
    ).toBe('open until 9 Oct · 36 joined');
    expect(
      invitationShort(
        { expiresAt: null, useLimit: 1, joined: [{ userId: id(1), displayName: 'Marina Costa' }], joinedCount: 1 },
        [],
        { t, now },
      ),
    ).toBe('1 use, used · Marina Costa joined');
  });
});
