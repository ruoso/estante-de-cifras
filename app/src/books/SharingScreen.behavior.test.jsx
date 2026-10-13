// behavior (books.share, workflow 10; board W10) — the sharing surface driven
// through its real collaborators: real React Aria Components, real i18n, and a
// loopback `fetch` double standing in for the service's Sharing endpoints. Each
// rendered state is checked axe-clean at WCAG 2.1 AA. Rendered inside ThemeRoot
// the way the app mounts it, so the Modal portals into the `.est` token root (the
// app-wide UNSAFE_PortalProvider — [[rac-overlays-portal-outside-est-theme-root]]).
//
// Pins workflow 10 L27-38 (N of 50, room), L40-60 (invitations: role, expiry
// default a week, optional use-limit, the link shown once, who joined, withdraw),
// L62-75 (roles, who-sees-whom), L77-85 (change role, remove), L92-101 (share a
// song); the createInvitation 201 `url`; `listMembers` role-filtering; W10 board
// L26/L110/L228.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';

import { checkWcag21aa } from '../a11y/axe.js';
import { setLocale } from '../i18n/index.js';
import { createStore } from '../worker/store.js';
import { createSharingClient } from './sharing-client.js';
import ThemeRoot from '../theme/ThemeRoot.jsx';
import SharingScreen from './SharingScreen.jsx';

// A loopback fetch double keyed by "METHOD /path"; records every call with its
// parsed body, returns the handler's status/body.
function makeClient(routes) {
  const calls = [];
  const fetch = async (path, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method, path, body });
    const handler = routes[`${method} ${path}`];
    if (!handler) throw new Error(`no route for ${method} ${path}`);
    const result = handler() ?? {};
    const status = result.status ?? 200;
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => {
        if (result.body === undefined) throw new Error('no body');
        return result.body;
      },
    };
  };
  return { client: createSharingClient({ fetch }), calls };
}

// A bare store for ThemeRoot's preferences slice (SharingScreen itself needs no
// store — the sharing client is injected).
function makeStore() {
  const endpoint = { postMessage: () => {}, onmessage: null };
  return createStore(endpoint);
}

const renderSharing = (client, props) =>
  render(
    <ThemeRoot store={makeStore()}>
      <SharingScreen bookId="bk" title="Choros da Ana" sharingClient={client} {...props} />
    </ThemeRoot>,
  );

const inv = (over = {}) => ({
  id: 'i1',
  role: 'reader',
  expiry: 'week',
  createdAt: '2026-10-02T00:00:00.000Z',
  expiresAt: '2026-10-09T00:00:00.000Z',
  useLimit: null,
  joined: [{ userId: 'u2' }],
  joinedCount: 1,
  withdrawn: false,
  ...over,
});

beforeEach(() => setLocale('en'));
afterEach(() => setLocale('en'));

describe('the owner view (workflow 10 L27-75; W10 L26/L110)', () => {
  function ownerClient(over = {}) {
    return makeClient({
      'GET /api/books/bk/members': () => ({
        body: {
          members: [
            { userId: 'u1', role: 'owner' },
            { userId: 'u3', role: 'editor' },
            { userId: 'u2', role: 'reader' },
          ],
          count: 2,
          limit: 50,
        },
      }),
      'GET /api/books/bk/invitations': () => ({ body: { invitations: [inv()] } }),
      ...over,
    });
  }

  it('shows N of 50 with room remaining, the role-grouped members with worded chips, and the invitations', async () => {
    const { client } = ownerClient();
    const { container } = renderSharing(client, { role: 'owner' });

    expect(await screen.findByText('2 of 50')).toBeInTheDocument();
    expect(screen.getByText('Room for 48 more.')).toBeInTheDocument();

    // Members: You (owner), an editor, a reader — each with its worded role chip.
    expect(screen.getByText('You')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.getByText('Reader')).toBeInTheDocument();

    // The invitation: role, state, terms (expiry + uses), who joined through it.
    expect(screen.getByText('Reader invitation')).toBeInTheDocument();
    expect(screen.getByText('open')).toBeInTheDocument();
    expect(screen.getByText('Expires in a week · no limit on uses')).toBeInTheDocument();
    expect(screen.getByText(/1 person · u2/)).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });

  it('makes an invitation: editor, default a week, shows the link once with a copy affordance', async () => {
    const created = { ...inv({ id: 'i2', role: 'editor', joined: [], joinedCount: 0 }), url: 'https://estante.app/i/tok123' };
    const { client, calls } = ownerClient({
      'POST /api/books/bk/invitations': () => ({ status: 201, body: created }),
    });
    const { container } = renderSharing(client, { role: 'owner' });

    fireEvent.click(await screen.findByRole('button', { name: 'Invite people' }));

    // The default expiry is a week; choose the editor role.
    expect(screen.getByRole('radio', { name: 'A week' })).toBeChecked();
    fireEvent.click(screen.getByRole('radio', { name: 'Editor' }));
    expect(await checkWcag21aa(container)).toHaveNoViolations(); // the form

    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));

    // The link is shown once, in a copyable field, with the won't-be-shown-again note.
    const field = await screen.findByRole('textbox', { name: 'Invitation link' });
    expect(field).toHaveValue('https://estante.app/i/tok123');
    expect(screen.getByText(/won’t be shown again/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument();

    // The POST carried role + default expiry, nothing else.
    const post = calls.find((c) => c.method === 'POST');
    expect(post.body).toEqual({ role: 'editor', expiry: 'week' });

    expect(await checkWcag21aa(container)).toHaveNoViolations(); // the link state
  });

  it('carries an optional use-limit when the owner turns it on', async () => {
    const { client, calls } = ownerClient({
      'POST /api/books/bk/invitations': () => ({ status: 201, body: { ...inv({ id: 'i3' }), url: 'https://x/i/t' } }),
    });
    renderSharing(client, { role: 'owner' });

    fireEvent.click(await screen.findByRole('button', { name: 'Invite people' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Limit how many can use it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));

    await screen.findByRole('textbox', { name: 'Invitation link' });
    const post = calls.find((c) => c.method === 'POST');
    expect(post.body).toEqual({ role: 'reader', expiry: 'week', useLimit: 1 });
  });

  it('withdraws an invitation (DELETE), and the reloaded list shows it withdrawn', async () => {
    let withdrawn = false;
    const { client, calls } = ownerClient({
      'GET /api/books/bk/invitations': () => ({ body: { invitations: [inv({ withdrawn: withdrawn })] } }),
      'DELETE /api/books/bk/invitations/i1': () => {
        withdrawn = true;
        return { status: 204 };
      },
    });
    renderSharing(client, { role: 'owner' });

    fireEvent.click(await screen.findByRole('button', { name: 'Withdraw' }));

    await waitFor(() => expect(screen.getByText('withdrawn')).toBeInTheDocument());
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/books/bk/invitations/i1')).toBe(true);
    // Those who joined stay (the count is unchanged); no new Withdraw control.
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
  });

  it('changes a member’s role (PATCH)', async () => {
    const { client, calls } = ownerClient({
      'PATCH /api/books/bk/members/u3': () => ({ body: { userId: 'u3', role: 'reader' } }),
    });
    renderSharing(client, { role: 'owner' });

    // The editor row's role menu → Make reader.
    fireEvent.click(await screen.findByRole('button', { name: 'Change u3’s role' }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Make reader' }));

    await waitFor(() =>
      expect(calls.some((c) => c.method === 'PATCH' && c.path === '/api/books/bk/members/u3')).toBe(true),
    );
    const patch = calls.find((c) => c.method === 'PATCH');
    expect(patch.body).toEqual({ role: 'reader' });
  });

  it('removes a member through the typed-name confirm (DELETE)', async () => {
    const { client, calls } = ownerClient({
      'DELETE /api/books/bk/members/u3': () => ({ status: 204 }),
    });
    const { container } = renderSharing(client, { role: 'owner' });

    // Open the editor's Remove confirm.
    await screen.findByText('You');
    const editorRow = screen.getByText('u3').closest('.est-sharing-member');
    fireEvent.click(within(editorRow).getByRole('button', { name: 'Remove' }));

    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Remove u3' });
    expect(confirm).toBeDisabled(); // typed-name guard
    expect(await checkWcag21aa(container)).toHaveNoViolations(); // the confirm

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Type u3 to confirm' }), {
      target: { value: 'u3' },
    });
    expect(confirm).not.toBeDisabled();
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(calls.some((c) => c.method === 'DELETE' && c.path === '/api/books/bk/members/u3')).toBe(true),
    );
  });

  it('shows the full-book state at fifty, with no app-side block on inviting (workflow 10 L32-34; W10 L228)', async () => {
    const { client } = makeClient({
      'GET /api/books/bk/members': () => ({ body: { members: [{ userId: 'u1', role: 'owner' }], count: 50, limit: 50 } }),
      'GET /api/books/bk/invitations': () => ({ body: { invitations: [] } }),
    });
    const { container } = renderSharing(client, { role: 'owner' });

    expect(await screen.findByText('50 of 50')).toBeInTheDocument();
    expect(screen.getByText(/Choros da Ana is full/)).toBeInTheDocument();
    expect(screen.queryByText(/Room for/)).toBeNull();
    // The app never blocks creating an invitation on a full book (Decision 5).
    expect(screen.getByRole('button', { name: 'Invite people' })).toBeInTheDocument();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

describe('the member view (workflow 10 L71-75; W10 L228)', () => {
  it('a non-owner member sees the owner and editors and the count, with no owner controls and no reader identities', async () => {
    const { client, calls } = makeClient({
      'GET /api/books/bk/members': () => ({
        body: {
          members: [
            { userId: 'u1', role: 'owner' },
            { userId: 'u3', role: 'editor' },
          ],
          count: 5,
          limit: 50,
        },
      }),
    });
    const { container } = renderSharing(client, { role: 'reader' });

    expect(await screen.findByText('5 of 50')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Editor')).toBeInTheDocument();
    expect(screen.getByText('You’re a reader')).toBeInTheDocument();

    // No owner controls, and no invitations were ever requested (owner-only).
    expect(screen.queryByRole('button', { name: 'Invite people' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Withdraw' })).toBeNull();
    expect(calls.some((c) => c.path === '/api/books/bk/invitations')).toBe(false);
    // No reader identities surfaced (the server filtered them out).
    expect(screen.queryByText('u2')).toBeNull();

    expect(await checkWcag21aa(container)).toHaveNoViolations();
  });
});

describe('sharing a song (workflow 10 L92-101; W10 L163-227)', () => {
  it('for the owner: the address for members, and an invitation link that carries the #<path> fragment', async () => {
    const { client } = makeClient({
      'GET /api/books/bk/members': () => ({ body: { members: [{ userId: 'u1', role: 'owner' }], count: 0, limit: 50 } }),
      'GET /api/books/bk/invitations': () => ({ body: { invitations: [] } }),
      'POST /api/books/bk/invitations': () => ({ status: 201, body: { ...inv({ id: 'i9', joined: [], joinedCount: 0 }), url: 'https://estante.app/i/tok' } }),
    });
    const { container } = renderSharing(client, {
      role: 'owner',
      songPath: 'choro/carinhoso.cifra.md',
      origin: 'https://estante.app',
    });

    // The plain address a member copies.
    const address = await screen.findByRole('textbox', { name: 'Song address' });
    expect(address).toHaveValue('https://estante.app/b/bk/choro/carinhoso.cifra.md');
    expect(await checkWcag21aa(container)).toHaveNoViolations();

    // The invite-to-this-song link carries the song path as a #<path> fragment.
    fireEvent.click(screen.getByRole('button', { name: 'Invite someone to this song' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create link' }));
    const link = await screen.findByRole('textbox', { name: 'Invitation link' });
    expect(link).toHaveValue('https://estante.app/i/tok#choro/carinhoso.cifra.md');
  });

  it('for a member: only the song’s address, no invite form', async () => {
    const { client } = makeClient({
      'GET /api/books/bk/members': () => ({ body: { members: [{ userId: 'u1', role: 'owner' }], count: 3, limit: 50 } }),
    });
    renderSharing(client, {
      role: 'reader',
      songPath: 'choro/carinhoso.cifra.md',
      origin: 'https://estante.app',
    });

    expect(await screen.findByRole('textbox', { name: 'Song address' })).toHaveValue(
      'https://estante.app/b/bk/choro/carinhoso.cifra.md',
    );
    expect(screen.queryByRole('button', { name: 'Invite someone to this song' })).toBeNull();
  });
});

describe('a refusal is worded, never left silent', () => {
  it('words a needs-connection state when the load fails', async () => {
    const { client } = makeClient({
      'GET /api/books/bk/members': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    renderSharing(client, { role: 'owner' });
    expect(await screen.findByRole('alert')).toHaveTextContent(/offline, or Estante is unreachable/);
  });
});
