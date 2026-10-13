// behavior (books.add_by_link) — the invited door driven through its real
// collaborators: real React Aria Components and real i18n. Pins workflow 1
// §Invited as amended by this task's design delta (the pre-account screen is
// generic — it names neither the book nor its owner), and the dead/full copy
// taken from W01 (L175-191). Every screen is checked axe-clean at WCAG 2.1 AA.
//
// A dead or full link must reveal NOTHING about the book (workflow 1 §Invited
// L53-58): the screen is handed no title or owner, and the test asserts a sample
// book name never appears.

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

  it('a dead link shows "This link doesn’t open a book" and reveals nothing about it (workflow 1 §Invited L53-58)', async () => {
    const { container } = render(<InvitedScreen phase="refused" reason="dead" />);

    expect(screen.getByRole('heading', { name: /doesn.t open a book/i })).toBeInTheDocument();
    // Not the full-book message, and no book name.
    expect(screen.queryByRole('heading', { name: /is full/i })).toBeNull();
    expect(screen.queryByText(SECRET_TITLE)).toBeNull();
    // The refusal is announced.
    expect(screen.getByRole('alert')).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('a full book shows "This book is full" and reveals nothing about it (workflow 1 §Invited)', async () => {
    const { container } = render(<InvitedScreen phase="refused" reason="full" />);

    expect(screen.getByRole('heading', { name: /is full/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /doesn.t open a book/i })).toBeNull();
    expect(screen.queryByText(SECRET_TITLE)).toBeNull();

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
