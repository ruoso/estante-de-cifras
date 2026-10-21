// behavior (books.share_people; workflow 10 **Where it sits**; board W10 #1) —
// the phone's Share sheet with its real collaborators (React Aria Components,
// i18n, the sharing client over a loopback `fetch`), inside ThemeRoot so the
// sheet portals into `.est`; axe at WCAG 2.1 AA on each state.
//
// Pins: "37 of 50" and "Room for 13 more."; the Members row "You, 1 editor, 36
// readers" leading to the people screen; the invitation rows "open until … · 36
// joined" / "1 use, used · Marina Costa joined"; *Invite people* leading to the
// New invitation screen; a song's sheet — the owner's *Invite someone to this
// song* (the link carries `#<path>`), a member's address with Copy; and, while
// nobody but the owner is in the book, the owner's sheet leading with the
// invitation, with Send on the made link where the device can share (workflow
// 10 §Nobody in the book yet, §Sending the link).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { injectStyles, expectSheetHead } from '../test/theme-styles.js';
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

// Board W10 #7: the book just put online, nobody in it but its owner.
const EMPTY = { members: [ANA], count: 0, limit: 50 };
function emptyClient(over = {}) {
  return makeClient({
    'GET /api/books/bk/members': () => ({ body: EMPTY }),
    'GET /api/books/bk/invitations': () => ({ body: { invitations: [] } }),
    ...over,
  });
}

// `a` comes before `b` in document order.
const before = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

function ownerClient(over = {}) {
  return makeClient({
    'GET /api/books/bk/members': () => ({ body: MEMBERS }),
    'GET /api/books/bk/invitations': () => ({ body: { invitations: [READER_INV, EDITOR_INV] } }),
    ...over,
  });
}

// The sheet opens into a ThemeRoot already on screen, as in the app: the
// portal container (ThemeRoot's `.est` ref) is only there once the root has
// mounted, and the sheet's own frame does not re-render once its body loads.
const renderSheet = (client, props = {}) => {
  const store = makeStore();
  const view = render(<ThemeRoot store={store} />);
  view.rerender(
    <ThemeRoot store={store}>
      <ShareSheet bookId={BOOK} title={BOOK_TITLE} role={OWNER_ROLE} sharingClient={client} {...props} />
    </ThemeRoot>,
  );
  return view;
};

// The caller's role, the book's owner (a prop, not an ARIA role).
const OWNER_ROLE = 'owner';

beforeEach(() => setLocale('en'));
afterEach(() => {
  setLocale('en');
  delete navigator.clipboard;
  delete navigator.share;
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

    // With people in the book, Invite people keeps its place after the Members
    // row (workflow 10 §Nobody in the book yet: the usual order).
    expect(before(members, within(sheet).getByRole('button', { name: 'Invite people' }))).toBe(true);

    fireEvent.click(members);
    expect(onOpenPeople).toHaveBeenCalledTimes(1);
    fireEvent.click(readerRow);
    expect(onOpenPeople).toHaveBeenCalledTimes(2);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Invite people' }));
    expect(onNewInvitation).toHaveBeenCalled();
  });

  it('for the owner of a book nobody has joined yet, Invite people comes before the People count (workflow 10 §Nobody in the book yet)', async () => {
    const { container } = renderSheet(emptyClient().client);

    const sheet = await screen.findByRole('dialog', { name: 'Share Choros da Ana' });
    const count = await within(sheet).findByText('0 of 50');
    const invite = within(sheet).getByRole('button', { name: 'Invite people' });
    const intro = within(sheet).getByText('Only people you invite can open this book, each with their own account.');
    expect(before(intro, invite)).toBe(true);
    expect(before(invite, count)).toBe(true);
    expect(before(count, within(sheet).getByRole('button', { name: /^Members/ }))).toBe(true);
    expect(within(sheet).getByRole('button', { name: /^Members/ })).toHaveTextContent('You');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('the header is the shared sheet head: title, the role chip, then Close last (W10 #1 L45-49)', async () => {
    const removeStyles = injectStyles('books/sharing.css');
    try {
      const { client } = makeClient({
        'GET /api/books/bk/members': () => ({ body: { members: [ANA, MARINA], count: 37, limit: 50 } }),
      });
      const { container } = renderSheet(client, { role: 'editor' });
      const sheet = await screen.findByRole('dialog', { name: 'Share Choros da Ana' });
      await within(sheet).findByText('You’re an editor');
      const heading = within(sheet).getByRole('heading', { name: 'Share Choros da Ana' });
      const head = expectSheetHead(heading);
      // The chip sits between the title and the close.
      expect([...head.children].map((el) => el.textContent)).toEqual(['Share Choros da Ana', 'You’re an editor', '']);
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    } finally {
      removeStyles();
    }
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

// books.put_online_confirm Constraint 6 (workflow 10 §At most fifty people per
// book): the owner's sharing screen — a book's, a song's or a setlist's, every
// invitation joins the book — says the limit; a member's, who cannot invite,
// does not.
describe('the limit hint (workflow 10 §At most fifty)', () => {
  const HINT = 'Invite people to read or edit this book — up to 50 people.';

  it('the owner’s sharing screen says "Invite people to read or edit this book — up to 50 people.", a member’s does not', async () => {
    const owner = renderSheet(ownerClient().client);
    let sheet = await screen.findByRole('dialog', { name: 'Share Choros da Ana' });
    expect(await within(sheet).findByText('37 of 50')).toBeInTheDocument();
    expect(within(sheet).getByText(HINT)).toBeInTheDocument();
    expect(await checkWcag21aa(owner.container)).toHaveNoViolations();
    owner.unmount();

    // A song's share, the owner's: the same hint.
    const song = renderSheet(ownerClient().client, { songPath: SONG_PATH, songTitle: 'Carinhoso', origin: 'https://estante.app' });
    sheet = await screen.findByRole('dialog', { name: 'Share Carinhoso' });
    await within(sheet).findByRole('textbox', { name: 'Song address' });
    expect(within(sheet).getByText(HINT)).toBeInTheDocument();
    song.unmount();

    const { client } = makeClient({
      'GET /api/books/bk/members': () => ({ body: { members: [ANA, MARINA], count: 37, limit: 50 } }),
    });
    const { container } = renderSheet(client, { role: 'editor' });
    sheet = await screen.findByRole('dialog', { name: 'Share Choros da Ana' });
    expect(await within(sheet).findByText('You’re an editor')).toBeInTheDocument();
    expect(within(sheet).queryByText(HINT)).toBeNull();
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
    // People in the book: the address first, the invite after (the usual order).
    await within(sheet).findByText('37 of 50');
    expect(
      before(
        within(sheet).getByRole('textbox', { name: 'Song address' }),
        within(sheet).getByRole('button', { name: 'Invite someone to this song' }),
      ),
    ).toBe(true);
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(within(sheet).getByRole('button', { name: 'Invite someone to this song' }));
    expect(within(sheet).getByText(/opens on Carinhoso once they’ve signed in/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Create link' }));
    const link = await within(sheet).findByRole('textbox', { name: 'Invitation link' });
    expect(link).toHaveValue('https://estante.app/i/tok#choro/carinhoso.cifra.md');
    expect(calls.find((c) => c.method === 'POST').body).toEqual({ role: 'reader', expiry: 'week' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('for the owner of a book nobody has joined yet: the invitation leads, and its link goes out with Send carrying #<path> (workflow 10 §Nobody in the book yet, §Sending the link)', async () => {
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const { client } = emptyClient({
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
    const invite = await within(sheet).findByRole('button', { name: 'Invite someone to this song' });
    const address = within(sheet).getByRole('textbox', { name: 'Song address' });
    expect(before(invite, address)).toBe(true);
    expect(before(address, within(sheet).getByText('0 of 50'))).toBe(true);
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(invite);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Create link' }));
    const link = await within(sheet).findByRole('textbox', { name: 'Invitation link' });
    expect(link).toHaveValue('https://estante.app/i/tok#choro/carinhoso.cifra.md');
    const send = within(sheet).getByRole('button', { name: 'Send' });
    expect(before(send, within(sheet).getByRole('button', { name: 'Copy' }))).toBe(true);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    fireEvent.click(send);
    await waitFor(() => expect(share).toHaveBeenCalledWith({ url: 'https://estante.app/i/tok#choro/carinhoso.cifra.md' }));
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('for a reader, even of a book whose members count none: the usual order, the address first, no invite (Constraint 6)', async () => {
    const { client } = makeClient({
      'GET /api/books/bk/members': () => ({ body: EMPTY }),
    });
    const { container } = renderSheet(client, {
      role: 'reader',
      songPath: SONG_PATH,
      songTitle: 'Carinhoso',
      origin: 'https://estante.app',
    });

    const sheet = await screen.findByRole('dialog', { name: 'Share Carinhoso' });
    const count = await within(sheet).findByText('0 of 50');
    expect(before(within(sheet).getByRole('textbox', { name: 'Song address' }), count)).toBe(true);
    expect(within(sheet).queryByRole('button', { name: 'Invite someone to this song' })).toBeNull();
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

// books.share_needs_online (workflow 10 §Sharing a song): a song's sheet on a
// book only on this device says so and offers signing in, then Put online; it
// asks Estante nothing before Put online is pressed.
describe('a song’s Share sheet on a book only on this device', () => {
  it('shows the needs-online body under Share <song>, no Song address, and makes no call', async () => {
    const { client, calls } = makeClient({});
    const { container } = renderSheet(client, {
      store: makeStore(),
      bookId: 'local-1',
      title: 'My songs',
      role: null,
      isLocal: true,
      accountStatus: 'out',
      songPath: SONG_PATH,
      songTitle: 'Carinhoso',
      origin: 'https://estante.app',
    });

    const sheet = await screen.findByRole('dialog', { name: 'Share Carinhoso' });
    expect(within(sheet).getByText('My songs is only on this device. Put it online to invite people.')).toBeInTheDocument();
    expect(
      within(sheet).getByText('Only on this device: nobody else can see it. Put it online to invite people — up to 50.'),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Sign in to put it online' })).toBeInTheDocument();
    expect(within(sheet).queryByRole('button', { name: 'Put online' })).toBeNull();
    expect(within(sheet).queryByRole('textbox', { name: 'Song address' })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    expect(calls).toEqual([]);
  });
});

// books.setlist_invitation (workflow 10 §Sharing a song or a setlist; workflow 12
// §Sharing one): the sheet in setlist mode on a phone — the setlist's address,
// *Invite someone to this setlist* whose link carries `#<path>`, the line that
// the invited join the whole book, and Done back to the sheet's summary.
describe('a setlist’s Share sheet on a phone', () => {
  const SETLIST_PATH = 'lessons/lesson-3.setlist.md';
  const SETLIST = { itemKind: 'setlist', songPath: SETLIST_PATH, songTitle: 'Lesson 3', origin: 'https://estante.app' };

  it('for the owner: the address, the joins-the-book line, an invitation whose link carries #<path>, Done back to the summary', async () => {
    const { client, calls } = ownerClient({
      'POST /api/books/bk/invitations': () => ({
        status: 201,
        body: { ...READER_INV, id: 'i-new', joined: [], joinedCount: 0, url: 'https://estante.app/i/tok' },
      }),
    });
    const { container } = renderSheet(client, SETLIST);

    const sheet = await screen.findByRole('dialog', { name: 'Share Lesson 3' });
    expect(await within(sheet).findByRole('textbox', { name: 'Setlist address' })).toHaveValue(
      'https://estante.app/b/bk/lessons/lesson-3.setlist.md',
    );
    expect(within(sheet).getByText(/Everyone you invite joins Choros da Ana; the link opens it on Lesson 3\./)).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(within(sheet).getByRole('button', { name: 'Invite someone to this setlist' }));
    expect(within(sheet).getByText(/opens on Lesson 3 once they’ve signed in/)).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole('button', { name: 'Create link' }));
    const link = await within(sheet).findByRole('textbox', { name: 'Invitation link' });
    expect(link).toHaveValue('https://estante.app/i/tok#lessons/lesson-3.setlist.md');
    expect(calls.find((c) => c.method === 'POST').body).toEqual({ role: 'reader', expiry: 'week' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(within(sheet).getByRole('button', { name: 'Done' }));
    expect(await within(sheet).findByRole('textbox', { name: 'Setlist address' })).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Invite someone to this setlist' })).toBeInTheDocument();
    expect(within(sheet).queryByRole('textbox', { name: 'Invitation link' })).toBeNull();
  });

  it('for the owner of a book nobody has joined yet: Invite someone to this setlist comes before the Setlist address (workflow 10 §Nobody in the book yet)', async () => {
    const { container } = renderSheet(emptyClient().client, SETLIST);

    const sheet = await screen.findByRole('dialog', { name: 'Share Lesson 3' });
    const invite = await within(sheet).findByRole('button', { name: 'Invite someone to this setlist' });
    expect(before(invite, within(sheet).getByRole('textbox', { name: 'Setlist address' }))).toBe(true);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('for a reader: the setlist’s address, no invite', async () => {
    const { client } = makeClient({
      'GET /api/books/bk/members': () => ({ body: { members: [ANA], count: 3, limit: 50 } }),
    });
    const { container } = renderSheet(client, { ...SETLIST, role: 'reader' });

    const sheet = await screen.findByRole('dialog', { name: 'Share Lesson 3' });
    expect(await within(sheet).findByRole('textbox', { name: 'Setlist address' })).toHaveValue(
      'https://estante.app/b/bk/lessons/lesson-3.setlist.md',
    );
    expect(within(sheet).queryByRole('button', { name: 'Invite someone to this setlist' })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('on a book only on this device: the needs-online body under Share Lesson 3, and no call', async () => {
    const { client, calls } = makeClient({});
    const { container } = renderSheet(client, {
      ...SETLIST,
      store: makeStore(),
      bookId: 'local-1',
      title: 'My songs',
      role: null,
      isLocal: true,
      accountStatus: 'in',
    });

    const sheet = await screen.findByRole('dialog', { name: 'Share Lesson 3' });
    expect(within(sheet).getByText('My songs is only on this device. Put it online to invite people.')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Put online' })).toBeInTheDocument();
    expect(within(sheet).queryByRole('textbox', { name: 'Setlist address' })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    expect(calls).toEqual([]);
  });
});
