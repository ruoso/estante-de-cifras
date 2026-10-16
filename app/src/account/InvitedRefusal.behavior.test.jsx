// behavior (books.invited_presentation) — a refused invitation link as W01 #4
// draws it (L175-195): an alert dialog, labelled by its heading, with the
// board's buttons, driven through real React Aria Components and real i18n.
// Pins workflow 1 §Invited L61-66 (a refusal names nothing about the book) and
// its presentation paragraph (a refusal is a dialog, dismissed by OK or Escape).
// Every dialog is checked axe-clean at WCAG 2.1 AA. (AppShell mounts it over the
// shell, inside ThemeRoot, only once the Worker refuses; the shell-level case is
// in AppShell.routing.behavior.test.jsx.)

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { checkWcag21aa } from '../a11y/axe.js';
import InvitedRefusal from './InvitedRefusal.jsx';

// A book name that must NEVER leak onto a refusal — the dialog is never given it
// (there is no peek endpoint; books.add_by_link Decision 1).
const SECRET_TITLE = 'Choros da Ana';

const renderRefusal = (props) => render(<InvitedRefusal {...props} />);

describe('InvitedRefusal (behavior)', () => {
  it('a dead link: an alertdialog with the board’s copy and both buttons, naming nothing (workflow 1 §Invited L61-66; W01 L175-185)', async () => {
    const onAddByLink = vi.fn();
    const onClose = vi.fn();
    renderRefusal({ reason: 'dead', onAddByLink, onClose });

    const dialog = screen.getByRole('alertdialog', { name: 'This link doesn’t open a book' });
    expect(within(dialog).getByText(/The invitation may have expired/)).toBeInTheDocument();
    const add = within(dialog).getByRole('button', { name: 'Add a book by its link' });
    const ok = within(dialog).getByRole('button', { name: 'OK' });
    expect(screen.queryByText(SECRET_TITLE)).toBeNull();
    expect(document.body.textContent).not.toContain(SECRET_TITLE);
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();

    act(() => fireEvent.click(add));
    expect(onAddByLink).toHaveBeenCalledTimes(1);
    act(() => fireEvent.click(ok));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a dead link: Escape closes it through onClose (presentation paragraph)', () => {
    const onClose = vi.fn();
    renderRefusal({ reason: 'dead', onClose });
    const dialog = screen.getByRole('alertdialog');
    act(() => fireEvent.keyDown(dialog, { key: 'Escape' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('a full book: an alertdialog with only OK, naming nothing (W01 L186-195)', async () => {
    renderRefusal({ reason: 'full' });

    const dialog = screen.getByRole('alertdialog', { name: 'This book is full' });
    expect(within(dialog).getByRole('button', { name: 'OK' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Add a book by its link' })).toBeNull();
    expect(document.body.textContent).not.toContain(SECRET_TITLE);
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('a transport failure: “We couldn’t open this link” with OK (Decision 6)', async () => {
    renderRefusal({ reason: 'error' });

    const dialog = screen.getByRole('alertdialog', { name: /We couldn.t open this link/ });
    expect(within(dialog).getByRole('button', { name: 'OK' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Add a book by its link' })).toBeNull();
    expect(await checkWcag21aa(dialog)).toHaveNoViolations();
  });

  it('focus is inside the dialog when it opens', () => {
    renderRefusal({ reason: 'dead' });
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
  });
});
