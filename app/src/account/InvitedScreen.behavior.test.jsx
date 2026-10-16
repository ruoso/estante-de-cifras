// behavior (books.add_by_link, books.invited_presentation) — the invited door
// driven through its real collaborators: real React Aria Components and real
// i18n. Pins workflow 1 §Invited L50-56 (the pre-account screen is generic — it
// names neither the book nor its owner), W01 #2 (the column under a book mark)
// and the UI audit's focus finding (the heading takes focus, without a ring).
// Every screen is checked axe-clean at WCAG 2.1 AA. The refusals are
// InvitedRefusal's, in InvitedRefusal.behavior.test.jsx.

import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import InvitedScreen from './InvitedScreen.jsx';
import SignIn from './SignIn.jsx';

// A book name that must NEVER leak onto the generic/refusal screens — the screen
// is never given it (there is no peek endpoint; Decision 1).
const SECRET_TITLE = 'Choros da Ana';

describe('InvitedScreen (behavior)', () => {
  it('the generic prompt offers the account-first choice and names neither book nor owner (workflow 1 §Invited, amended)', async () => {
    const { container } = render(<InvitedScreen phase="prompt" />);

    // The account-first prompt: make an account, or sign in.
    expect(screen.getByRole('button', { name: 'Make an account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'I have an account: sign in' })).toBeInTheDocument();
    // Generic: it names only "a book on Estante" — never a specific book/owner.
    expect(screen.getByRole('heading', { name: /invited to a book on Estante/i })).toBeInTheDocument();
    expect(screen.queryByText(SECRET_TITLE)).toBeNull();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('each phase lands focus on its heading, which carries the no-outline class (books.invited_presentation Decision 2)', () => {
    const { rerender } = render(<InvitedScreen phase="working" />);
    const working = screen.getByRole('heading', { level: 2 });
    expect(document.activeElement).toBe(working);
    // The class `.invited-heading:focus { outline: none; }` targets (the ring
    // itself is pinned in e2e-web, against the real CSS — Decision 3).
    expect(working).toHaveClass('invited-heading');

    rerender(<InvitedScreen phase="prompt" />);
    const prompt = screen.getByRole('heading', { level: 2, name: /invited to a book on Estante/i });
    expect(document.activeElement).toBe(prompt);
    expect(prompt).toHaveClass('invited-heading');
  });

  it('the column begins with a decorative book mark above the heading (W01 #2 L70)', async () => {
    const { container } = render(<InvitedScreen phase="prompt" />);
    const heading = screen.getByRole('heading', { level: 2 });
    const column = heading.parentElement;
    const mark = column.firstElementChild;
    expect(mark.tagName.toLowerCase()).toBe('svg');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    // The mark precedes the heading in the column.
    expect(mark.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // The top-aligned modifier, not the shared centred scroller alone.
    expect(column.parentElement).toHaveClass('account-scroll', 'invited-scroll');

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('the working phase is axe clean (books.invited_presentation)', async () => {
    const { container } = render(<InvitedScreen phase="working" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('“Make an account” and “sign in” open the SignIn surface', () => {
    // A tiny host wiring the prompt's two seams to the SignIn surface, as AppShell
    // does: pressing either opens the passkey ceremony surface.
    function Host() {
      const [signIn, setSignIn] = useState(null);
      if (signIn) return <SignIn intent={signIn.intent} />;
      return (
        <InvitedScreen
          phase="prompt"
          onMakeAccount={() => setSignIn({ intent: 'create' })}
          onSignIn={() => setSignIn({ intent: 'signIn' })}
        />
      );
    }

    const { unmount } = render(<Host />);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'Make an account' })));
    // The SignIn surface's method screen is now up.
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    unmount();

    render(<Host />);
    act(() => fireEvent.click(screen.getByRole('button', { name: 'I have an account: sign in' })));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});
