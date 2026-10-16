// behavior (books.share_people; workflow 10 §Invitations, §At most fifty people
// per book; board W10 #2) — the New invitation screen with its real
// collaborators (React Aria Components, i18n, the sharing client over a
// loopback `fetch`), axe at WCAG 2.1 AA.
//
// Pins: the room callout "Choros da Ana has room for 13 more people. …"; on a
// full book the conflict notice with *Create link* still enabled (books.share
// Decision 5); the role, the expiry (a week by default) and the use limit in
// the request; the made link with Copy, and Done.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import NewInvitationScreen from './NewInvitation.jsx';
import { BOOK, BOOK_TITLE, makeClient, makeStore, ownerMembers } from './sharing-fixtures.js';

const created = {
  id: 'i-new',
  role: 'editor',
  expiry: 'month',
  createdAt: '2026-10-02T00:00:00.000Z',
  expiresAt: '2026-11-01T00:00:00.000Z',
  useLimit: 1,
  joined: [],
  joinedCount: 0,
  withdrawn: false,
  url: 'https://estante.app/i/tok123',
};

function client(count = 37) {
  return makeClient({
    'GET /api/books/bk/members': () => ({ body: ownerMembers({ count }) }),
    'POST /api/books/bk/invitations': () => ({ status: 201, body: created }),
  });
}

const renderScreen = (c, props = {}) =>
  render(
    <ThemeRoot store={makeStore()}>
      <NewInvitationScreen bookId={BOOK} title={BOOK_TITLE} sharingClient={c} {...props} />
    </ThemeRoot>,
  );

beforeEach(() => setLocale('en'));
afterEach(() => {
  setLocale('en');
  delete navigator.clipboard;
});

describe('the New invitation screen (W10 #2)', () => {
  it('says how much room the book has, and makes the invitation the owner chose', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const onBack = vi.fn();
    const { client: c, calls } = client();
    const { container } = renderScreen(c, { onBack });

    expect(screen.getByRole('region', { name: 'New invitation' })).toBeInTheDocument();
    expect(
      await screen.findByText(
        'Choros da Ana has room for 13 more people. Once it has 50, this link stops letting anyone in.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('You’ll see who joins through it, and can withdraw it at any time.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Reader' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'A week' })).toBeChecked();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('radio', { name: 'Editor' }));
    fireEvent.click(screen.getByRole('radio', { name: 'A month' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Limit how many can use it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));

    const field = await screen.findByRole('textbox', { name: 'Invitation link' });
    expect(field).toHaveValue('https://estante.app/i/tok123');
    expect(calls.find((x) => x.method === 'POST').body).toEqual({ role: 'editor', expiry: 'month', useLimit: 1 });
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://estante.app/i/tok123'));
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onBack).toHaveBeenCalled();
  });

  it('on a full book says the link lets nobody in yet, and Create link stays enabled', async () => {
    const { client: c, calls } = client(50);
    const { container } = renderScreen(c);

    expect(
      await screen.findByText('Choros da Ana is full. This link won’t let anyone in until you remove someone.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/has room for/)).toBeNull();
    const create = screen.getByRole('button', { name: 'Create link' });
    expect(create).not.toBeDisabled();
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    fireEvent.click(create);
    await screen.findByRole('textbox', { name: 'Invitation link' });
    expect(calls.some((x) => x.method === 'POST')).toBe(true);
  });

  it('Back leaves without making anything', async () => {
    const onBack = vi.fn();
    const { client: c, calls } = client();
    renderScreen(c, { onBack });
    await screen.findByText(/has room for 13 more people/);
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalled();
    expect(calls.some((x) => x.method === 'POST')).toBe(false);
  });
});
