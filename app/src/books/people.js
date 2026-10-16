// people.js — the pure wording of a book's people on the sharing surface
// (books.share_people; workflow 10 §Who sees whom, §At most fifty people per
// book, §Invitations; board W10 #1, #3, #6). No React, no client: every
// function takes the service's Member / Invitation shapes (api/openapi.yaml) and
// the `t` translator, so the sheet, the people screen, the new invitation and a
// song's panel all say the same thing.
//
// A person is named by the name they give their saves (`displayName`, read by
// the service from their home book) and never by an account id: someone with no
// name reads by their role (*Unnamed reader*, *Unnamed editor*), a joiner who is
// no longer a member *Someone unnamed* (Constraint 3).

const DAY_MONTH = { day: 'numeric', month: 'short' };

// "2 Oct": the day and the short month, in the reader's language (English reads
// day-first, as the boards write it). Null for a missing or unreadable date.
export function shortDate(iso, locale = 'en') {
  if (typeof iso !== 'string' || !iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, DAY_MONTH).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-GB', DAY_MONTH).format(date);
  }
}

const named = (p) => (typeof p?.displayName === 'string' && p.displayName.trim() ? p.displayName.trim() : null);

// A member's shown name: their name, else a word by role — never the id.
export function personLabel(member, { t }) {
  const name = named(member);
  if (name) return name;
  if (member?.role === 'owner') return t('sharing.unnamedOwner');
  if (member?.role === 'editor') return t('sharing.unnamedEditor');
  return t('sharing.unnamedReader');
}

// A joiner's shown name: their own name, else the role they hold now (when they
// are still a member), else *Someone unnamed*.
export function joinerLabel(joiner, members, { t }) {
  const name = named(joiner);
  if (name) return name;
  const member = (members ?? []).find((m) => m.userId === joiner?.userId);
  return member ? personLabel(member, { t }) : t('sharing.someoneUnnamed');
}

const countRole = (members, role) => (members ?? []).filter((m) => m.role === role).length;

// The members counted by role, as the sheet's Members row reads them (W10 #1:
// "You, 1 editor, 36 readers"), or without the owner for a song's panel (#4:
// "1 editor, 36 readers"). `members` is the owner's full list.
export function memberSummary(members, { t, you = true }) {
  const parts = you ? [t('sharing.you')] : [];
  const editors = countRole(members, 'editor');
  const readers = countRole(members, 'reader');
  if (editors) parts.push(t('sharing.editorsCount', { count: editors }));
  if (readers) parts.push(t('sharing.readersCount', { count: readers }));
  if (!parts.length) return t('sharing.nobodyYet');
  return parts.join(', ');
}

// Who joined through an invitation (W10 #3): nobody yet; one name alone; up to
// four names after the count; beyond four, the first four "and {n} more".
export function joinedSummary(invitation, members, { t, locale = 'en' }) {
  const joined = invitation?.joined ?? [];
  if (!joined.length) return t('sharing.joinedNobody');
  const labels = joined.map((j) => joinerLabel(j, members, { t }));
  if (labels.length === 1) return labels[0];
  let names;
  if (labels.length <= 4) {
    names = listOf(labels, locale);
  } else {
    names = t('sharing.namesAndMore', { names: labels.slice(0, 4).join(', '), count: labels.length - 4 });
  }
  return t('sharing.joinedPeople', { count: labels.length, names });
}

function listOf(items, locale) {
  try {
    return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);
  } catch {
    return items.join(', ');
  }
}

// The invitation a member joined through (Decision 7): of the owner's
// invitations whose `joined` holds them, the one they joined most recently.
// Null when none does (a member let in before invitations kept their joins).
export function joinedThrough(member, invitations) {
  let found = null;
  let at = -Infinity;
  for (const inv of invitations ?? []) {
    for (const j of inv.joined ?? []) {
      if (j.userId !== member?.userId) continue;
      const when = j.joinedAt ? new Date(j.joinedAt).getTime() : 0;
      if (found === null || when >= at) {
        found = inv;
        at = when;
      }
    }
  }
  return found;
}

// The room left under the cap — the service's count against its limit (the app
// shows it and never enforces it, books.share Decision 5).
export function roomLeft(count, limit = 50) {
  return Math.max(0, (Number(limit) || 0) - (Number(count) || 0));
}

// The uses an invitation has left: null when it has no limit. `useLimit` is the
// cap the owner chose and every join used one.
export function usesLeft(invitation) {
  if (invitation?.useLimit === null || invitation?.useLimit === undefined) return null;
  return Math.max(0, invitation.useLimit - (invitation.joinedCount ?? invitation.joined?.length ?? 0));
}

// An invitation's state, in the order the service refuses a join: withdrawn,
// expired, used up — else open.
export function invitationState(invitation, now = Date.now()) {
  if (invitation?.withdrawn) return 'withdrawn';
  if (invitation?.expiresAt && new Date(invitation.expiresAt).getTime() <= now) return 'expired';
  if (usesLeft(invitation) === 0) return 'usedUp';
  return 'open';
}

// Whether an invitation offers Copy link (Decision 4): it can still let someone
// in, and the service could give its link again.
export function canCopyLink(invitation, now = Date.now()) {
  return invitationState(invitation, now) === 'open' && typeof invitation?.url === 'string' && invitation.url !== '';
}

// "Reader invitation · 2 Oct" — the invitation's title on its card and row.
export function invitationTitle(invitation, { t, locale = 'en' }) {
  const role = invitation?.role === 'editor' ? t('sharing.roleEditor') : t('sharing.roleReader');
  const title = t('sharing.inviteRowTitle', { role });
  const date = shortDate(invitation?.createdAt, locale);
  return date ? `${title} · ${date}` : title;
}

// The sheet's one-line summary of an invitation (W10 #1): "open until 9 Oct ·
// 36 joined", "1 use, used · Marina Costa joined".
export function invitationShort(invitation, members, { t, locale = 'en', now = Date.now() }) {
  const state = invitationState(invitation, now);
  let head;
  if (state === 'open') {
    const until = shortDate(invitation.expiresAt, locale);
    head = until ? t('sharing.openUntil', { date: until }) : t('sharing.stateOpen');
  } else if (state === 'usedUp') {
    head = t('sharing.usesUsed', { count: invitation.useLimit });
  } else {
    head = t(state === 'withdrawn' ? 'sharing.stateWithdrawn' : 'sharing.stateExpired');
  }
  const joined = invitation?.joined ?? [];
  const tail =
    joined.length === 0
      ? t('sharing.nobodyJoined')
      : joined.length === 1
        ? t('sharing.nameJoined', { name: joinerLabel(joined[0], members, { t }) })
        : t('sharing.countJoined', { count: joined.length });
  return `${head} · ${tail}`;
}
