// behavior (account.recovery_email) — the recovery email's confirm page driven
// through its real collaborators: real React Aria Components, real i18n and an
// injected loopback auth-client. Pins workflow 13 §Confirming it L48–53 (the
// link confirms and does not sign in) and §Who holds an address L60–65, and
// board Recovery-email.dc.html Tablet. Every outcome is checked axe-clean at
// WCAG 2.1 AA. The request body is pinned structurally against api/openapi.yaml
// (RecoveryEmailConfirmRequest { token }) — not via api/validate.js
// ([[api-validate-js-breaks-under-vite]]).

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { createAuthClient } from './auth-client.js';
import RecoveryEmailConfirm from './RecoveryEmailConfirm.jsx';

const TOKEN = 'AAAA-_x.BBBB_-y';

// A loopback fetch double: every call is recorded; the confirm answers with
// whatever `answer()` returns (or throws, to model an unreachable service).
function makeClient(answer) {
  const calls = [];
  const fetch = async (path, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    if (`${method} ${path}` !== 'POST /api/recovery-email/confirm') throw new Error(`no route for ${method} ${path}`);
    const result = answer();
    const status = result?.status ?? 204;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (result?.body === undefined) throw new Error('no body');
        return result.body;
      },
    };
  };
  return { client: createAuthClient({ fetch }), calls };
}

describe('RecoveryEmailConfirm (workflow 13 §Confirming it)', () => {
  it('204: confirmed, with the does-not-sign-in notice; the token is posted once and nothing else is called, axe clean', async () => {
    const { client, calls } = makeClient(() => ({ status: 204 }));
    const { container, rerender } = render(<RecoveryEmailConfirm token={TOKEN} authClient={client} />);

    expect(screen.getByText('Confirming your recovery email…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Your recovery email is confirmed' })).toBeInTheDocument();
    expect(
      screen.getByText(
        'This link only confirms the address — it does not sign you in on this device, and opens no book.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Your recovery email is now where Estante sends a sign-in link if you lose every device with a passkey.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Estante')).toBeInTheDocument(); // the app bar

    // Re-renders do not spend the single-use link twice.
    rerender(<RecoveryEmailConfirm token={TOKEN} authClient={client} />);
    rerender(<RecoveryEmailConfirm token={TOKEN} authClient={client} />);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ method: 'POST', path: '/api/recovery-email/confirm', body: { token: TOKEN } });
    // It never signs in: no session or sign-in call is made (only the confirm).
    expect(calls.some((c) => c.path.startsWith('/api/auth') || c.path.startsWith('/api/account'))).toBe(false);

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('400 link_invalid: the expired-or-used copy, axe clean', async () => {
    const { client } = makeClient(() => ({
      status: 400,
      body: { code: 'link_invalid', message: 'That link is not valid. It may have expired or been used.' },
    }));
    const { container } = render(<RecoveryEmailConfirm token={TOKEN} authClient={client} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This link has expired or was already used — send a new one from the account screen.',
    );
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('409 address_taken: the another-account copy, axe clean', async () => {
    const { client } = makeClient(() => ({
      status: 409,
      body: { code: 'address_taken', message: 'That address belongs to another account.' },
    }));
    const { container } = render(<RecoveryEmailConfirm token={TOKEN} authClient={client} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This address is the recovery email of another Estante account — sign in with it instead.',
    );
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('429: "Too many tries — try again shortly." with Try again', async () => {
    const { client } = makeClient(() => ({
      status: 429,
      body: { code: 'rate_limited', message: 'Too many requests. Try again shortly.' },
    }));
    const { container } = render(<RecoveryEmailConfirm token={TOKEN} authClient={client} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many tries — try again shortly.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('network: errNetwork and Try again, which re-posts, axe clean', async () => {
    let failing = true;
    const { client, calls } = makeClient(() => {
      if (failing) throw new TypeError('Failed to fetch');
      return { status: 204 };
    });
    const { container } = render(<RecoveryEmailConfirm token={TOKEN} authClient={client} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/offline, or Estante is unreachable/);
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    failing = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Your recovery email is confirmed' })).toBeInTheDocument();
    expect(calls).toHaveLength(2);
    expect(calls[1].body).toEqual({ token: TOKEN });
  });

  it('Open Estante calls onClose, on success and on a refusal', async () => {
    const onClose = vi.fn();
    const { client } = makeClient(() => ({ status: 204 }));
    const { unmount } = render(<RecoveryEmailConfirm token={TOKEN} authClient={client} onClose={onClose} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Open Estante' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    const { client: refused } = makeClient(() => ({ status: 400, body: { code: 'link_invalid', message: 'x' } }));
    render(<RecoveryEmailConfirm token={TOKEN} authClient={refused} onClose={onClose} />);
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: 'Open Estante' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(2));
  });
});
