// behavior (books.share_people; workflow 10 **Where it sits**; board W10 #1) —
// the phone's Share sheet with its real collaborators (React Aria Components,
// i18n, the sharing client over a loopback `fetch`), inside ThemeRoot so the
// sheet portals into `.est`; axe at WCAG 2.1 AA on each state.
//
// Pins: "37 of 50" and "Room for 13 more."; the Members row "You, 1 editor, 36
// readers" leading to the people screen; the invitation rows "open until … · 36
// joined" / "1 use, used · Marina Costa joined"; *Invite people* leading to the
// New invitation screen; a song's sheet — the owner's *Invite someone to this
// song* (the link carries `#<path>`), a member's address with Copy.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import ShareSheet from './ShareSheet.jsx';
import { shortDate } from './people.js';
import { ANA, BOOK, BOOK_TITLE, MARINA, UUID, fromNow, makeClient, makeStore, uid } from './sharing-fixtures.js';

const SONG_PATH = 'choro/carinhoso.cifra.md';

// Board W10 #1: Ana, Marina Costa and 36 readers who joined through the reader
// invitation; Marina through the one-use editor invitation.
const READERS = Array.from({ length: 36 }, (_, i) => ({ userId: uid(100 + i), role: 'reader', displayName: `Leitor ${i + 1}` }));
const MEMBERS = { members: [ANA, MARINA, ...READERS], count: 37, limit: 50 };
const READER_INV = {
  id: 'i-reader',
  role: 'reader',
  expiry: 'week',
  createdAt: fromNow(-3),
  expiresAt: fromNow(4),
  useLimit: null,
  joined: READERS.map((r) => ({ userId: r.userId, joinedAt: fromNow(-2), displayName: r.displayName })),
  joinedCount: 36,
  withdrawn: false,
  url: 'https://estante.app/i/tok-reader',
};
const EDITOR_INV = {
  id: 'i-editor',
  role: 'editor',
  expiry: 'until-withdrawn',
  createdAt: fromNow(-7),
  expiresAt: null,
  useLimit: 1,
  joined: [{ userId: MARINA.userId, joinedAt: fromNow(-6), displayName: 'Marina Costa' }],
  joinedCount: 1,
  withdrawn: false,
};

function ownerClient(over = {}) {
  return makeClient({
    'GET /api/books/bk/members': () => ({ body: MEMBERS }),
    'GET /api/books/bk/invitations': () => ({ body: { invitations: [READER_INV, EDITOR_INV] } }),
    ...over,
  });
}

const renderSheet = (client, props = {}) =>
  render(
    <ThemeRoot store={makeStore()}>
      <ShareSheet bookId={BOOK} title={BOOK_TITLE} role={OWNER_ROLE} sharingClient={client} {...props} />
    </ThemeRoot>,
  );

// The caller's role, the book's owner (a prop, not an ARIA role).
const OWNER_ROLE = 'owner';

beforeEach(() => setLocale('en'));
afterEach(() => {
  setLocale('en');
  delete navigator.clipboard;
});

describe('a book’s Share sheet (W10 #1)', () => {
  it('sums the people up and leads to the people screen and a new invitation', async () => {
    const onOpenPeople = vi.fn();
    const onNewInvitation = vi.fn();
    const { container } = renderSheet(ownerClient().client, { onOpenPeople, onNewInvitation });

    const sheet = await screen.findByRole('dialog', { name: 'Share Choros da Ana' });
    expect(await within(sheet).findByText('37 of 50')).toBeInTheDocument();
    expect(within(sheet).getByText('Room for 13 more.')).toBeInTheDocument();
    expect(within(sheet).getByText('Only people you invite can open this book, each with their own account.')).toBeInTheDocument();

    const members = within(sheet).getByRole('button', { name: /^Members/ });
    expect(members).toHaveTextContent('You, 1 editor, 36 readers');

    const readerRow = within(sheet).getByRole('button', { name: /^Reader invitation/ });
    expect(readerRow).toHaveTextContent(`Reader invitation · ${shortDate(READER_INV.createdAt)}`);
    expect(readerRow).toHaveTextContent(`open until ${shortDate(READER_INV.expiresAt)} · 36 joined`);
    const editorRow = within(sheet).getByRole('button', { name: /^Editor invitation/ });
    expect(editorRow).toHaveTextContent('1 use, used · Marina Costa joined');
    expect(container.ownerDocument.body.textContent).not.toMatch(UUID);
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(members);
    expect(onOpenPeople).toHaveBeenCalledTimes(1);
    fireEvent.click(readerRow);
    expect(onOpenPeople).toHaveBeenCalledTimes(2);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Invite people' }));
    expect(onNewInvitation).toHaveBeenCalled();
  });

  it('a member’s sheet reads their role and who shares the book, with no invitations and no invite', async () => {
    const { client, calls } = makeClient({
      'GET /api/books/bk/members': () => ({ body: { members: [ANA, MARINA], count: 37, limit: 50 } }),
    });
    const { container } = renderSheet(client, { role: 'editor' });

    const sheet = await screen.findByRole('dialog', { name: 'Share Choros da Ana' });
    expect(await within(sheet).findByText('You’re an editor')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: /^Members/ })).toHaveTextContent('Ana, Marina Costa');
    expect(within(sheet).getByText(/^Shared with you by Ana\./)).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Invite people' })).toBeNull();
    expect(calls.some((c) => c.path === '/api/books/bk/invitations')).toBe(false);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

describe('a song’s Share sheet on a phone (workflow 10 §Sharing a song)', () => {
  it('for the owner: the address, and an invitation to this song whose link carries #<path>', async () => {
    const { client, calls } = ownerClient({
      'POST /api/books/bk/invitations': () => ({
        status: 201,
        body: { ...READER_INV, id: 'i-new', joined: [], joinedCount: 0, url: 'https://estante.app/i/tok' },
      }),
    });
    const { container } = renderSheet(client, {
      songPath: SONG_PATH,
      songTitle: 'Carinhoso',
      origin: 'https://estante.app',
    });

    const sheet = await screen.findByRole('dialog', { name: 'Share Carinhoso' });
    expect(await within(sheet).findByRole('textbox', { name: 'Song address' })).toHaveValue(
      'https://estante.app/b/bk/choro/carinhoso.cifra.md',
    );
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(within(sheet).getByRole('button', { name: 'Invite someone to this song' }));
    expect(within(sheet).getByText(/opens on Carinhoso once they’ve signed in/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Create link' }));
    const link = await within(sheet).findByRole('textbox', { name: 'Invitation link' });
    expect(link).toHaveValue('https://estante.app/i/tok#choro/carinhoso.cifra.md');
    expect(calls.find((c) => c.method === 'POST').body).toEqual({ role: 'reader', expiry: 'week' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('for a member: the song’s address with Copy, no invite', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { client } = makeClient({
      'GET /api/books/bk/members': () => ({ body: { members: [ANA], count: 3, limit: 50 } }),
    });
    const { container } = renderSheet(client, {
      role: 'reader',
      songPath: SONG_PATH,
      songTitle: 'Carinhoso',
      origin: 'https://estante.app',
    });

    const sheet = await screen.findByRole('dialog', { name: 'Share Carinhoso' });
    await within(sheet).findByRole('textbox', { name: 'Song address' });
    expect(within(sheet).queryByRole('button', { name: 'Invite someone to this song' })).toBeNull();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://estante.app/b/bk/choro/carinhoso.cifra.md'));
    expect(await within(sheet).findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});
