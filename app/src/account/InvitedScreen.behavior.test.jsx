// behavior (books.add_by_link, books.invited_presentation) — the invited door
// driven through its real collaborators: real React Aria Components and real
// i18n. Pins workflow 1 §Invited L50-56 (the pre-account screen is generic — it
// names neither the book nor its owner), W01 #2 (the column under a book mark)
// and the UI audit's focus finding (the heading takes focus, without a ring).
// Every screen is checked axe-clean at WCAG 2.1 AA. The refusals are
// InvitedRefusal's, in InvitedRefusal.behavior.test.jsx. The prompt is the one
// sign-in surface headed by `InvitedLead` (account.sign_in_two_doors; workflow 1
// §Invited L54-71; W01 #2): its sections are pressed in place.

import { describe, it, expect } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import InvitedScreen, { InvitedLead, InvitedFooter } from './InvitedScreen.jsx';
import SignIn from './SignIn.jsx';

// A book name that must NEVER leak onto the generic/refusal screens — the screen
// is never given it (there is no peek endpoint; Decision 1).
const SECRET_TITLE = 'Choros da Ana';

describe('InvitedScreen (behavior)', () => {
  it('InvitedLead draws the account-first ask — heading, body, passkey card, footer — naming neither book nor owner (workflow 1 §Invited, amended)', async () => {
    const { container } = render(
      <main>
        <InvitedLead />
        <InvitedFooter />
      </main>,
    );

    // Generic: it names only "a book on Estante" — never a specific book/owner.
    expect(screen.getByRole('heading', { name: /invited to a book on Estante/i })).toBeInTheDocument();
    expect(
      screen.getByText('To open it, sign in, or make an account first — no book can be read without one.'),
    ).toBeInTheDocument();
    expect(screen.getByText('An account is a passkey')).toBeInTheDocument();
    expect(screen.getByText('Then the book goes on your shelf, and opens on its songs.')).toBeInTheDocument();
    expect(screen.queryByText(SECRET_TITLE)).toBeNull();
    // The lead carries no door of its own: the sections are the surface's.
    expect(screen.queryAllByRole('button')).toHaveLength(0);

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('InvitedLead inside SignIn shows both sections below the invitation, its heading focused without a ring, axe clean', async () => {
    const { container } = render(<SignIn lead={<InvitedLead />} leadFooter={<InvitedFooter />} />);

    const prompt = screen.getByRole('heading', { level: 2, name: /invited to a book on Estante/i });
    await waitFor(() => expect(prompt).toHaveFocus());
    // The class `.invited-heading:focus { outline: none; }` targets (the ring
    // itself is pinned in e2e-web, against the real CSS — Decision 3).
    expect(prompt).toHaveClass('invited-heading');
    const have = screen.getByRole('group', { name: 'Already have an account?' });
    const fresh = screen.getByRole('group', { name: 'New here?' });
    expect(within(have).getByRole('button', { name: 'Use a passkey' })).toBeInTheDocument();
    expect(within(have).getByRole('button', { name: 'Email me a link' })).toBeInTheDocument();
    expect(within(fresh).getByRole('button', { name: 'Make an account' })).toBeInTheDocument();
    expect(prompt.compareDocumentPosition(have) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(have.compareDocumentPosition(fresh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The old pair of the invitation's own is gone.
    expect(screen.queryByRole('button', { name: 'I have an account: sign in' })).toBeNull();
    expect(screen.queryByText(SECRET_TITLE)).toBeNull();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('the working phase lands focus on its heading, which carries the no-outline class (books.invited_presentation Decision 2)', () => {
    render(<InvitedScreen />);
    const working = screen.getByRole('heading', { level: 2 });
    expect(document.activeElement).toBe(working);
    expect(working).toHaveClass('invited-heading');
  });

  it('the column begins with a decorative book mark above the heading (W01 #2 L70)', async () => {
    const { container } = render(<SignIn lead={<InvitedLead />} />);
    const heading = screen.getByRole('heading', { level: 2, name: /invited to a book on Estante/i });
    const column = heading.parentElement;
    const mark = column.firstElementChild;
    expect(mark.tagName.toLowerCase()).toBe('svg');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    // The mark precedes the heading in the column.
    expect(mark.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The top-aligned modifier, not the shared centred scroller alone.
    expect(column.closest('.account-scroll')).toHaveClass('invited-scroll');

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('the working phase is axe clean (books.invited_presentation)', async () => {
    const { container } = render(<InvitedScreen />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});
