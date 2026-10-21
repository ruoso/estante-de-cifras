// behavior (books.share_people; workflow 10 §Sharing a song, **Where it sits**;
// board W10 #4) — a song's share on a tablet or a computer: a panel beside the
// chart, not a Modal. Real React Aria Components, i18n and the sharing client
// over a loopback `fetch`; axe at WCAG 2.1 AA.
//
// Pins: a `complementary` region "Share <song>"; focus to its heading on open,
// back to Share on close (✕) and on Escape; the chart beside it stays in the
// accessibility tree (no aria-hidden); the members' address with Copy; the
// invitation to this song carrying `#<path>`; the People line "1 editor, 36
// readers · 2 invitations" with *Manage*; while nobody but the owner is in the
// book, the invitation first and the address after it, with Send on the made
// link where the device can share (workflow 10 §Nobody in the book yet, §Sending
// the link).

import { useState } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, fireEvent, waitFor, within } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { injectStyles, expectSheetHead } from '../test/theme-styles.js';
import { setLocale } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import SongSharePanel from './SongSharePanel.jsx';
import { ANA, MARINA, fromNow, makeClient, makeStore, uid } from './sharing-fixtures.js';

const SONG_PATH = 'choro/carinhoso.cifra.md';
const READERS = Array.from({ length: 36 }, (_, i) => ({ userId: uid(100 + i), role: 'reader' }));
const inv = (id) => ({
  id,
  role: 'reader',
  expiry: 'week',
  createdAt: fromNow(-3),
  expiresAt: fromNow(4),
  useLimit: null,
  joined: [],
  joinedCount: 0,
  withdrawn: false,
});

// Board W10 #9: the book just put online, nobody in it but its owner.
function emptyClient() {
  return makeClient({
    'GET /api/books/bk/members': () => ({ body: { members: [ANA], count: 0, limit: 50 } }),
    'GET /api/books/bk/invitations': () => ({ body: { invitations: [] } }),
    'POST /api/books/bk/invitations': () => ({ status: 201, body: { ...inv('c'), url: 'https://estante.app/i/tok' } }),
  });
}

// `a` comes before `b` in document order.
const before = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

function ownerClient() {
  return makeClient({
    'GET /api/books/bk/members': () => ({ body: { members: [ANA, MARINA, ...READERS], count: 37, limit: 50 } }),
    'GET /api/books/bk/invitations': () => ({ body: { invitations: [inv('a'), inv('b')] } }),
    'POST /api/books/bk/invitations': () => ({ status: 201, body: { ...inv('c'), url: 'https://estante.app/i/tok' } }),
  });
}

// The reading view in miniature: the chart and a Share that opens the panel
// beside it, as SongReading lays it out.
function Reading({ client, role, onManage }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="reading-with-panel">
      <div className="scroll reading-scroll">
        <section role="group" aria-label="Carinhoso">
          <h1>Carinhoso</h1>
        </section>
        <button type="button" onClick={() => setOpen(true)}>
          Share
        </button>
      </div>
      {open ? (
        <SongSharePanel
          bookId="bk"
          title="Choros da Ana"
          role={role}
          songPath={SONG_PATH}
          songTitle="Carinhoso"
          origin="https://estante.app"
          sharingClient={client}
          onClose={() => setOpen(false)}
          onManage={onManage}
        />
      ) : null}
    </div>
  );
}

const renderReading = (client, props = {}) =>
  render(
    <ThemeRoot store={makeStore()}>
      <Reading client={client} role={OWNER_ROLE} onManage={() => {}} {...props} />
    </ThemeRoot>,
  );

function openPanel() {
  const share = screen.getByRole('button', { name: 'Share' });
  act(() => share.focus());
  fireEvent.click(share);
  return share;
}

// The caller's role, the book's owner (a prop, not an ARIA role).
const OWNER_ROLE = 'owner';

beforeEach(() => setLocale('en'));
afterEach(() => {
  setLocale('en');
  delete navigator.clipboard;
  delete navigator.share;
});

describe('a song’s share panel (W10 #4)', () => {
  it('is a complementary region beside the chart; focus moves to its heading and back to Share on close', async () => {
    const { container } = renderReading(ownerClient().client);
    const share = openPanel();

    const panel = screen.getByRole('complementary', { name: 'Share Carinhoso' });
    expect(document.activeElement).toBe(within(panel).getByRole('heading', { name: 'Share Carinhoso' }));
    // No scrim: the chart is still there for assistive technology.
    const chart = screen.getByRole('group', { name: 'Carinhoso' });
    expect(chart.closest('[aria-hidden="true"]')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    await within(panel).findByText('1 editor, 36 readers · 2 invitations');
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(document.activeElement).toBe(share);
  });

  it('its header is the shared sheet head: the heading grows, Close last (W10 #4; shell.sheet_close_placement)', async () => {
    const removeStyles = injectStyles('books/sharing.css');
    try {
      const { container } = renderReading(ownerClient().client);
      openPanel();
      const panel = screen.getByRole('complementary', { name: 'Share Carinhoso' });
      await within(panel).findByText(/2 invitations/);
      expectSheetHead(within(panel).getByRole('heading', { name: 'Share Carinhoso' }));
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    } finally {
      removeStyles();
    }
  });

  it('closes on Escape, focus back to Share', async () => {
    renderReading(ownerClient().client);
    const share = openPanel();
    const panel = screen.getByRole('complementary', { name: 'Share Carinhoso' });
    await within(panel).findByText(/2 invitations/);
    fireEvent.keyDown(within(panel).getByRole('heading'), { key: 'Escape' });
    expect(screen.queryByRole('complementary')).toBeNull();
    expect(document.activeElement).toBe(share);
  });

  it('for the owner: the address, an invitation to this song carrying #<path>, and Manage', async () => {
    const onManage = vi.fn();
    const { client, calls } = ownerClient();
    const { container } = renderReading(client, { onManage });
    openPanel();
    const panel = screen.getByRole('complementary', { name: 'Share Carinhoso' });

    expect(within(panel).getByRole('textbox', { name: 'Song address' })).toHaveValue(
      'https://estante.app/b/bk/choro/carinhoso.cifra.md',
    );
    expect(within(panel).getByText('Members open Carinhoso at its address.')).toBeInTheDocument();
    await within(panel).findByText('Expires in a week · no limit on uses');
    // People in the book: the address first, then the invitation (the usual order).
    expect(
      before(within(panel).getByText('For people already in the book'), within(panel).getByText('Invite someone to this song')),
    ).toBe(true);
    fireEvent.click(within(panel).getByRole('radio', { name: 'Editor' }));
    fireEvent.click(within(panel).getByRole('button', { name: 'Create link' }));
    const link = await within(panel).findByRole('textbox', { name: 'Invitation link' });
    expect(link).toHaveValue('https://estante.app/i/tok#choro/carinhoso.cifra.md');
    expect(calls.find((c) => c.method === 'POST').body).toEqual({ role: 'editor', expiry: 'week' });
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(within(panel).getByRole('button', { name: 'Manage' }));
    expect(onManage).toHaveBeenCalled();
  });

  it('for the owner of a book nobody has joined yet: the invitation leads, the address follows, and the made link has Send beside Copy (workflow 10 §Nobody in the book yet, §Sending the link)', async () => {
    const share = vi.fn(async () => {});
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
    const { container } = renderReading(emptyClient().client);
    openPanel();
    const panel = screen.getByRole('complementary', { name: 'Share Carinhoso' });

    const heading = await within(panel).findByText('Invite someone to this song');
    expect(before(heading, within(panel).getByText('For people already in the book'))).toBe(true);
    expect(before(within(panel).getByRole('textbox', { name: 'Song address' }), within(panel).getByText('0 of 50'))).toBe(true);
    expect(within(panel).getByText(/^Nobody yet/)).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(within(panel).getByRole('button', { name: 'Create link' }));
    const link = await within(panel).findByRole('textbox', { name: 'Invitation link' });
    const send = within(panel).getByRole('button', { name: 'Send' });
    const copies = within(panel).getAllByRole('button', { name: 'Copy' });
    // Send sits before the made link's Copy; the address's Copy follows below.
    expect(before(link, send)).toBe(true);
    expect(before(send, copies[0])).toBe(true);
    expect(before(copies[0], within(panel).getByRole('textbox', { name: 'Song address' }))).toBe(true);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    fireEvent.click(send);
    await waitFor(() => expect(share).toHaveBeenCalledWith({ url: 'https://estante.app/i/tok#choro/carinhoso.cifra.md' }));
  });

  it('while the people have not loaded, the address shows and comes first (workflow 10 §Nobody in the book yet; Constraints 6–7)', async () => {
    const pending = { listMembers: () => new Promise(() => {}), listInvitations: () => new Promise(() => {}) };
    renderReading(pending);
    openPanel();
    const panel = screen.getByRole('complementary', { name: 'Share Carinhoso' });

    const address = within(panel).getByRole('textbox', { name: 'Song address' });
    expect(before(address, within(panel).getByRole('status'))).toBe(true);
    expect(within(panel).getByRole('status')).toHaveTextContent('Loading');
    expect(within(panel).queryByText('Invite someone to this song')).toBeNull();
  });

  it('for a member: the address with Copy, no invitation', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { client } = makeClient({
      'GET /api/books/bk/members': () => ({ body: { members: [ANA, MARINA], count: 37, limit: 50 } }),
    });
    const { container } = renderReading(client, { role: 'reader' });
    openPanel();
    const panel = screen.getByRole('complementary', { name: 'Share Carinhoso' });

    await within(panel).findByText('37 of 50');
    expect(within(panel).getByText('Ana, Marina Costa')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Create link' })).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://estante.app/b/bk/choro/carinhoso.cifra.md'));
    expect(await within(panel).findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

// books.share_needs_online (workflow 10 §Sharing a song): a song in a book only
// on this device — the panel says so and offers Put online, and nothing asks
// Estante before Put online is pressed.
describe('a song’s share panel on a book only on this device', () => {
  it('shows the needs-online body under Share <song>, no Song address, and makes no call', async () => {
    const { client, calls } = makeClient({});
    const { container } = render(
      <ThemeRoot store={makeStore()}>
        <SongSharePanel
          store={makeStore()}
          bookId="local-1"
          title="My songs"
          isLocal
          accountStatus="in"
          songPath={SONG_PATH}
          songTitle="Carinhoso"
          origin="https://estante.app"
          sharingClient={client}
        />
      </ThemeRoot>,
    );

    const panel = screen.getByRole('complementary', { name: 'Share Carinhoso' });
    expect(within(panel).getByText('My songs is only on this device. Put it online to invite people.')).toBeInTheDocument();
    expect(
      within(panel).getByText('Only on this device: nobody else can see it. Put it online to invite people — up to 50.'),
    ).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Put online' })).toBeInTheDocument();
    expect(within(panel).queryByRole('textbox', { name: 'Song address' })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    expect(calls).toEqual([]);
  });
});

// books.setlist_invitation (workflow 10 §Sharing a song or a setlist; workflow 12
// §Sharing one): the same panel in setlist mode — the setlist's address, an
// invitation whose link opens on the setlist, and the line that the invited join
// the whole book. The `#<path>` stays on the client: the request carries no path.
describe('Share on a setlist, wide (workflow 10 §Sharing a song or a setlist)', () => {
  const SETLIST_PATH = 'lessons/lesson-3.setlist.md';

  function renderSetlistPanel(client, props = {}) {
    return render(
      <ThemeRoot store={makeStore()}>
        <div className="setlist-with-panel">
          <div className="scroll">
            <h2>Lesson 3</h2>
          </div>
          <SongSharePanel
            store={makeStore()}
            bookId="bk"
            title="Choros da Ana"
            role={OWNER_ROLE}
            itemKind="setlist"
            songPath={SETLIST_PATH}
            songTitle="Lesson 3"
            origin="https://estante.app"
            sharingClient={client}
            {...props}
          />
        </div>
      </ThemeRoot>,
    );
  }

  it('for the owner: Share Lesson 3, the joins-the-book line, the setlist address, an invitation carrying #<path>', async () => {
    const { client, calls } = ownerClient();
    const { container } = renderSetlistPanel(client);
    const panel = screen.getByRole('complementary', { name: 'Share Lesson 3' });

    expect(
      within(panel).getByText(
        'A setlist is shared with its book, Choros da Ana. Everyone you invite joins Choros da Ana; the link opens it on Lesson 3.',
      ),
    ).toBeInTheDocument();
    expect(within(panel).getByRole('textbox', { name: 'Setlist address' })).toHaveValue(
      'https://estante.app/b/bk/lessons/lesson-3.setlist.md',
    );
    expect(within(panel).queryByRole('textbox', { name: 'Song address' })).toBeNull();
    expect(await within(panel).findByText('Invite someone to this setlist')).toBeInTheDocument();
    expect(within(panel).getByText('The invitation brings them into Choros da Ana, and opens on Lesson 3 once they’ve signed in.')).toBeInTheDocument();
    await within(panel).findByText('Expires in a week · no limit on uses');
    fireEvent.click(within(panel).getByRole('button', { name: 'Create link' }));
    const link = await within(panel).findByRole('textbox', { name: 'Invitation link' });
    expect(link.value.endsWith('#lessons/lesson-3.setlist.md')).toBe(true);
    const post = calls.find((c) => c.method === 'POST');
    expect(JSON.stringify(post.body)).not.toContain('setlist');
    expect(post.path).not.toContain('setlist');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('for the owner of a book nobody has joined yet: Invite someone to this setlist leads, the Setlist address follows (workflow 10 §Nobody in the book yet)', async () => {
    const { container } = renderSetlistPanel(emptyClient().client);
    const panel = screen.getByRole('complementary', { name: 'Share Lesson 3' });

    const heading = await within(panel).findByText('Invite someone to this setlist');
    expect(before(heading, within(panel).getByRole('textbox', { name: 'Setlist address' }))).toBe(true);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('for a reader: the setlist address and no invitation', async () => {
    const { client } = makeClient({
      'GET /api/books/bk/members': () => ({ body: { members: [ANA, MARINA], count: 37, limit: 50 } }),
    });
    const { container } = renderSetlistPanel(client, { role: 'reader' });
    const panel = screen.getByRole('complementary', { name: 'Share Lesson 3' });
    await within(panel).findByText('37 of 50');
    expect(within(panel).getByRole('textbox', { name: 'Setlist address' })).toHaveValue(
      'https://estante.app/b/bk/lessons/lesson-3.setlist.md',
    );
    expect(within(panel).queryByText('Invite someone to this setlist')).toBeNull();
    expect(within(panel).queryByRole('button', { name: 'Create link' })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('on a book only on this device: the needs-online body under Share Lesson 3, and no call', async () => {
    const { client, calls } = makeClient({});
    const { container } = renderSetlistPanel(client, { bookId: 'local-1', title: 'My songs', isLocal: true, accountStatus: 'in', role: null });
    const panel = screen.getByRole('complementary', { name: 'Share Lesson 3' });
    expect(within(panel).getByText('My songs is only on this device. Put it online to invite people.')).toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Put online' })).toBeInTheDocument();
    expect(within(panel).queryByRole('textbox', { name: 'Setlist address' })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
    expect(calls).toEqual([]);
  });
});
