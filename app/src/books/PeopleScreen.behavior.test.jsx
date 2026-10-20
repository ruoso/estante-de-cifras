// behavior (books.share_people; workflow 10 §Who sees whom, §Invitations,
// §Removing someone; board W10 #3, #5, #6) — the people screen with its real
// collaborators: React Aria Components, i18n, and the sharing client over a
// loopback `fetch` double. Rendered inside ThemeRoot as the app mounts it, so
// its dialogs portal into the `.est` token root; every state is axe-checked at
// WCAG 2.1 AA, a dialog open included.
//
// Pins: people named by the name they give their saves, never an id (Unnamed
// reader otherwise); a member's meta line names the invitation they joined
// through (Decision 7); the first four readers then *Show N more readers*;
// invitation cards with a state word, *Joined through it: … and N more*, and
// **Copy link** only while open with a url (Decision 4) — Copied, or Couldn't
// copy with the link to select; change role; withdraw; Remove as drawn, no
// typed name (Decision 5); the full book (#5); a member's view (#6).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { injectStyles, expectPopoverSurface } from '../test/theme-styles.js';
import { setLocale } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import PeopleScreen from './PeopleScreen.jsx';
import { shortDate } from './people.js';
import {
  ANA,
  BOOK,
  BOOK_TITLE,
  MARINA,
  NAMED_READERS,
  UUID,
  invitations,
  makeClient,
  makeStore,
  ownerMembers,
} from './sharing-fixtures.js';

const BIA = NAMED_READERS[4];

const renderPeople = (client, props = {}) =>
  render(
    <ThemeRoot store={makeStore()}>
      <PeopleScreen bookId={BOOK} title={BOOK_TITLE} role={OWNER_ROLE} mode="wide" sharingClient={client} {...props} />
    </ThemeRoot>,
  );

function ownerClient(over = {}) {
  return makeClient({
    'GET /api/books/bk/members': () => ({ body: ownerMembers() }),
    'GET /api/books/bk/invitations': () => ({ body: { invitations: invitations() } }),
    ...over,
  });
}

function stubClipboard(writeText) {
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
}

// The caller's role, the book's owner (a prop, not an ARIA role).
const OWNER_ROLE = 'owner';

beforeEach(() => setLocale('en'));
afterEach(() => {
  setLocale('en');
  delete navigator.clipboard;
});

describe('the owner’s people screen (W10 #3)', () => {
  it('names everyone with their meta line, never an id; Unnamed reader; Show N more readers', async () => {
    const { client } = ownerClient();
    const { container } = renderPeople(client);

    const region = await screen.findByRole('region', { name: 'Choros da Ana · People' });
    await within(region).findByText('Ana (you)');
    expect(within(region).getByText('owns this book')).toBeInTheDocument();
    const rowNames = () => [...region.querySelectorAll('.est-sharing-member .name')].map((n) => n.textContent);
    expect(rowNames()).toContain('Marina Costa');
    const editorDate = shortDate(invitations()[1].createdAt, 'en');
    expect(within(region).getByText(`through the editor invitation of ${editorDate}`)).toBeInTheDocument();
    expect(rowNames()).toContain('Joana Lima');

    // Four readers shown, the rest behind the disclosure — among them the
    // reader with no name, who reads by role.
    expect(within(region).getByText('Bia Rocha')).not.toBeVisible();
    const more = within(region).getByRole('button', { name: 'Show 2 more readers' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(within(region).getByText('Bia Rocha')).toBeVisible();
    expect(within(region).getByText('Unnamed reader')).toBeInTheDocument();

    // No account id anywhere in what is rendered.
    expect(container.textContent).not.toMatch(UUID);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('shows the count against fifty, and the invitation cards with their state, terms and who joined', async () => {
    const { client } = ownerClient();
    const { container } = renderPeople(client);

    expect(await screen.findByText('37 of 50 people')).toBeInTheDocument();
    expect(screen.getByText('besides you · room for 13 more')).toBeInTheDocument();

    const readerCard = screen.getByText(/^Reader invitation · /).closest('.est-sharing-invite');
    expect(within(readerCard).getByText('open')).toBeInTheDocument();
    expect(within(readerCard).getByText('Expires in a week · no limit on uses')).toBeInTheDocument();
    expect(readerCard).toHaveTextContent(
      'Joined through it: 6 people: Joana Lima, Rafael Souza, Beatriz Alves, Lucas Pereira and 2 more',
    );
    expect(within(readerCard).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();

    const editorCard = screen.getByText(/^Editor invitation · /).closest('.est-sharing-invite');
    expect(within(editorCard).getByText('used up')).toBeInTheDocument();
    expect(editorCard).toHaveTextContent('Joined through it: Marina Costa');
    expect(within(editorCard).queryByRole('button', { name: 'Copy link' })).toBeNull();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('Copy link writes the listed url and reads Copied, announced politely', async () => {
    const writeText = vi.fn(async () => {});
    stubClipboard(writeText);
    const { client } = ownerClient();
    renderPeople(client);

    const card = (await screen.findByText(/^Reader invitation · /)).closest('.est-sharing-invite');
    fireEvent.click(within(card).getByRole('button', { name: 'Copy link' }));

    await waitFor(() => expect(within(card).getByRole('button', { name: 'Copied' })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith('https://estante.app/i/tok-reader');
    expect(card.querySelector('[aria-live="polite"]')).toHaveTextContent('Copied');
  });

  it('a failed copy says Couldn’t copy and shows the link to select by hand', async () => {
    stubClipboard(vi.fn(async () => Promise.reject(new Error('denied'))));
    const { client } = ownerClient();
    const { container } = renderPeople(client);

    const card = (await screen.findByText(/^Reader invitation · /)).closest('.est-sharing-invite');
    fireEvent.click(within(card).getByRole('button', { name: 'Copy link' }));

    await waitFor(() => expect(within(card).getByRole('button', { name: 'Couldn’t copy' })).toBeInTheDocument());
    expect(within(card).getByRole('textbox', { name: 'Invitation link' })).toHaveValue('https://estante.app/i/tok-reader');
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('offers no Copy link on a withdrawn invitation, nor on one the service gave no url', async () => {
    const [reader] = invitations({ readerUrl: null });
    const withdrawn = { ...invitations()[0], id: 'i-gone', withdrawn: true, url: undefined };
    const { client } = ownerClient({
      'GET /api/books/bk/invitations': () => ({ body: { invitations: [reader, withdrawn] } }),
    });
    renderPeople(client);

    await screen.findByText('withdrawn');
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy link' })).toBeNull();
  });

  it('changes a member’s role (PATCH)', async () => {
    const { client, calls } = ownerClient({
      [`PATCH /api/books/bk/members/${MARINA.userId}`]: () => ({ body: { userId: MARINA.userId, role: 'reader' } }),
    });
    renderPeople(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Change Marina Costa’s role' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Make reader' }));

    await waitFor(() => expect(calls.some((c) => c.method === 'PATCH')).toBe(true));
    expect(calls.find((c) => c.method === 'PATCH').body).toEqual({ role: 'reader' });
  });

  // shell.popover_surface: the role menu is drawn on the shared opaque surface
  // inside the .est theme root, axe clean while open (the .tji note:
  // PeopleScreen's Popover was bare).
  it('a member’s role menu is drawn on the popover surface', async () => {
    const removeStyles = injectStyles('books/sharing.css');
    try {
      const { container } = renderPeople(ownerClient().client);
      fireEvent.click(await screen.findByRole('button', { name: 'Change Marina Costa’s role' }));
      const menu = await screen.findByRole('menu', { name: 'Change Marina Costa’s role' });
      expectPopoverSurface(menu);
      expect(within(menu).getByRole('menuitem', { name: 'Make reader' })).toBeInTheDocument();
      expect(await checkWcag21aa(container)).toHaveNoViolations();
    } finally {
      removeStyles();
    }
  });

  it('withdraws an invitation (DELETE); the reloaded card reads withdrawn and offers no Copy link', async () => {
    let withdrawn = false;
    const { client, calls } = ownerClient({
      'GET /api/books/bk/invitations': () => ({
        body: {
          invitations: invitations().map((inv) =>
            inv.id === 'i-reader' && withdrawn ? { ...inv, withdrawn: true, url: undefined } : inv,
          ),
        },
      }),
      'DELETE /api/books/bk/invitations/i-reader': () => {
        withdrawn = true;
        return { status: 204 };
      },
    });
    renderPeople(client);

    const card = (await screen.findByText(/^Reader invitation · /)).closest('.est-sharing-invite');
    fireEvent.click(within(card).getByRole('button', { name: 'Withdraw' }));

    await waitFor(() => expect(within(card).getByText('withdrawn')).toBeInTheDocument());
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/books/bk/invitations/i-reader')).toBe(true);
    expect(within(card).queryByRole('button', { name: 'Copy link' })).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Withdraw' })).toBeNull();
  });

  it('removes a member as drawn — the sentences, Remove Bia Rocha, no typed name — and the count goes down', async () => {
    let removed = false;
    const { client, calls } = ownerClient({
      'GET /api/books/bk/members': () => ({
        body: removed
          ? { ...ownerMembers({ count: 36 }), members: ownerMembers().members.filter((m) => m.userId !== BIA.userId) }
          : ownerMembers(),
      }),
      [`DELETE /api/books/bk/members/${BIA.userId}`]: () => {
        removed = true;
        return { status: 204 };
      },
    });
    const { container } = renderPeople(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Show 2 more readers' }));
    const row = screen.getByText('Bia Rocha').closest('.est-sharing-member');
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('heading', { name: 'Remove Bia Rocha?' })).toBeInTheDocument();
    const readerDate = shortDate(invitations()[0].createdAt, 'en');
    expect(dialog).toHaveTextContent(
      `Bia Rocha joined through your reader invitation of ${readerDate}. Removing them takes effect the next time their app reaches Estante; the other members are not affected.`,
    );
    expect(dialog).toHaveTextContent(
      'What is already on their device stays there. It can’t be recalled. The book will have room for 14 more.',
    );
    expect(within(dialog).queryByRole('textbox')).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations(); // the dialog open

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove Bia Rocha' }));

    await waitFor(() => expect(screen.getByText('36 of 50 people')).toBeInTheDocument());
    expect(calls.some((c) => c.method === 'DELETE' && c.path === `/api/books/bk/members/${BIA.userId}`)).toBe(true);
    expect(screen.queryByText('Bia Rocha')).toBeNull();
  });

  it('an unnamed member’s remove reads by role: Remove this reader?, and Remove', async () => {
    const { client } = ownerClient();
    renderPeople(client);

    fireEvent.click(await screen.findByRole('button', { name: 'Show 2 more readers' }));
    const row = screen.getByText('Unnamed reader').closest('.est-sharing-member');
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('heading', { name: 'Remove this reader?' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent(/^Remove this reader\?This person joined through your reader invitation/);
    expect(within(dialog).getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(UUID);
  });

  it('New invitation opens a centred dialog on a wide layout, and the phone’s screen on a narrow one', async () => {
    const { client } = ownerClient();
    const { unmount } = renderPeople(client);
    fireEvent.click(await screen.findByRole('button', { name: 'New invitation' }));
    const dialog = await screen.findByRole('dialog', { name: 'New invitation' });
    expect(dialog).toHaveTextContent('Choros da Ana has room for 13 more people.');
    unmount();

    const onNewInvitation = vi.fn();
    renderPeople(ownerClient().client, { mode: 'narrow', onNewInvitation });
    fireEvent.click(await screen.findByRole('button', { name: 'New invitation' }));
    expect(onNewInvitation).toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a full book reads Full and 50 of 50 people, with the notice (W10 #5)', async () => {
    const { client } = ownerClient({
      'GET /api/books/bk/members': () => ({ body: ownerMembers({ count: 50 }) }),
    });
    const { container } = renderPeople(client);

    expect(await screen.findByText('50 of 50 people')).toBeInTheDocument();
    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getByText('no room left')).toBeInTheDocument();
    expect(screen.getByText(/Choros da Ana is full\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review members' })).toBeInTheDocument();
    // The app never blocks making an invitation (books.share Decision 5).
    expect(screen.getByRole('button', { name: 'New invitation' })).not.toBeDisabled();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('words a needs-connection state when the load fails', async () => {
    const { client } = makeClient({
      'GET /api/books/bk/members': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderPeople(client);
    expect(await screen.findByRole('alert')).toHaveTextContent(/offline, or Estante is unreachable/);
  });
});

describe('a member’s view (W10 #6)', () => {
  it('reads You’re a reader, names the owner and the editor, lists no other reader, and has no controls', async () => {
    const { client, calls } = makeClient({
      'GET /api/books/bk/members': () => ({ body: { members: [ANA, MARINA], count: 37, limit: 50 } }),
    });
    const { container } = renderPeople(client, { role: 'reader' });

    const region = await screen.findByRole('region', { name: 'Choros da Ana · Sharing' });
    expect(await within(region).findByText('Ana')).toBeInTheDocument();
    expect(within(region).getByText('You’re a reader')).toBeInTheDocument();
    expect(within(region).getByText('shares this book')).toBeInTheDocument();
    expect(within(region).getByText('Marina Costa')).toBeInTheDocument();
    expect(within(region).getByText('saves to this book')).toBeInTheDocument();
    expect(within(region).getByText(/Shared with you by Ana\..*Other readers aren’t listed\./)).toBeInTheDocument();

    for (const name of ['New invitation', 'Remove', 'Withdraw', 'Copy link']) {
      expect(within(region).queryByRole('button', { name })).toBeNull();
    }
    expect(calls.some((c) => c.path === '/api/books/bk/invitations')).toBe(false);
    expect(container.textContent).not.toMatch(UUID);
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});
