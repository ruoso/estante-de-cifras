import { describe, it, expect, vi, afterEach } from 'vitest';
import { createSharingClient, SharingError } from './sharing-client.js';

// unit (books.share Decision 1) — the main-thread sharing client builds the
// correct method/path/body for each of the six Sharing calls, parses the
// MemberList / InvitationList / Invitation bodies, and surfaces 401/403/404/409
// as typed status-bearing errors carrying only code/status. It logs nothing.
//
// Pins api/openapi.yaml L410-546 (the six operations) and L1124-1233 (MemberList,
// Invitation, InvitationList, the request bodies); DIRECTION §3.6 (the app and
// the service share only the HTTP contract); the no-logs rule (Constraints).

// A loopback fetch double: route by "METHOD /path", record every call with its
// parsed JSON body, and let a handler set the status/body — or throw, to model an
// unreachable service. Mirrors SignIn.behavior.test.jsx's makeClient.
function makeClient(routes) {
  const calls = [];
  const fetch = async (path, init = {}) => {
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(init.body) : undefined;
    const call = { method, path, body, credentials: init.credentials };
    calls.push(call);
    const handler = routes[`${method} ${path}`];
    if (!handler) throw new Error(`no route for ${method} ${path}`);
    const result = handler(call); // may throw to simulate offline / a 5xx
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

function only(obj, allowed) {
  for (const key of Object.keys(obj)) expect(allowed, `unexpected key "${key}"`).toContain(key);
}

afterEach(() => vi.restoreAllMocks());

describe('the Sharing calls build the right request', () => {
  it('listMembers: GET the members path, credentials included, parses MemberList', async () => {
    const list = { members: [{ userId: 'u1', role: 'owner' }], count: 0, limit: 50 };
    const { client, calls } = makeClient({
      'GET /api/books/bk1/members': () => ({ body: list }),
    });
    await expect(client.listMembers('bk1')).resolves.toEqual(list);
    expect(calls[0]).toMatchObject({ method: 'GET', credentials: 'include', body: undefined });
  });

  it('listInvitations: GET the invitations path, parses InvitationList', async () => {
    const list = { invitations: [{ id: 'i1', role: 'reader', expiry: 'week', createdAt: 't', joined: [], joinedCount: 0, withdrawn: false }] };
    const { client } = makeClient({
      'GET /api/books/bk1/invitations': () => ({ body: list }),
    });
    await expect(client.listInvitations('bk1')).resolves.toEqual(list);
  });

  it('createInvitation: POST role only when expiry/useLimit are absent; returns the Invitation with its url', async () => {
    const inv = { id: 'i1', url: 'https://x/i/tok', role: 'editor', expiry: 'week', createdAt: 't', joined: [], joinedCount: 0, withdrawn: false };
    const { client, calls } = makeClient({
      'POST /api/books/bk1/invitations': () => ({ status: 201, body: inv }),
    });
    await expect(client.createInvitation('bk1', { role: 'editor' })).resolves.toEqual(inv);
    expect(calls[0].method).toBe('POST');
    expect(calls[0].body).toEqual({ role: 'editor' });
    only(calls[0].body, ['role', 'expiry', 'useLimit']);
  });

  it('createInvitation: POST carries expiry and useLimit when chosen', async () => {
    const { client, calls } = makeClient({
      'POST /api/books/bk1/invitations': () => ({ status: 201, body: { id: 'i', role: 'reader', expiry: 'day', createdAt: 't', joined: [], joinedCount: 0, withdrawn: false } }),
    });
    await client.createInvitation('bk1', { role: 'reader', expiry: 'day', useLimit: 1 });
    expect(calls[0].body).toEqual({ role: 'reader', expiry: 'day', useLimit: 1 });
  });

  it('withdrawInvitation: DELETE the invitation path, returns nothing on 204', async () => {
    const { client, calls } = makeClient({
      'DELETE /api/books/bk1/invitations/i1': () => ({ status: 204 }),
    });
    await expect(client.withdrawInvitation('bk1', 'i1')).resolves.toBeUndefined();
    expect(calls[0].method).toBe('DELETE');
  });

  it('changeMemberRole: PATCH the member path with the new role, returns the Member', async () => {
    const member = { userId: 'u2', role: 'editor' };
    const { client, calls } = makeClient({
      'PATCH /api/books/bk1/members/u2': () => ({ body: member }),
    });
    await expect(client.changeMemberRole('bk1', 'u2', 'editor')).resolves.toEqual(member);
    expect(calls[0].method).toBe('PATCH');
    expect(calls[0].body).toEqual({ role: 'editor' });
  });

  it('removeMember: DELETE the member path, returns nothing on 204', async () => {
    const { client, calls } = makeClient({
      'DELETE /api/books/bk1/members/u2': () => ({ status: 204 }),
    });
    await expect(client.removeMember('bk1', 'u2')).resolves.toBeUndefined();
    expect(calls[0].method).toBe('DELETE');
  });

  it('percent-encodes opaque id segments into the path', async () => {
    const { client, calls } = makeClient({
      'DELETE /api/books/bk%201/members/u%2F2': () => ({ status: 204 }),
    });
    await client.removeMember('bk 1', 'u/2');
    expect(calls[0].path).toBe('/api/books/bk%201/members/u%2F2');
  });
});

describe('refusals become typed status-bearing errors', () => {
  const cases = [
    ['401', 401, undefined, 401],
    ['403 with a code', 403, { code: 'forbidden', message: 'owner only' }, 403],
    ['404', 404, { code: 'not_found', message: 'no' }, 404],
    ['409', 409, { code: 'conflict', message: 'x' }, 409],
  ];
  for (const [label, status, body, expectedStatus] of cases) {
    it(`surfaces ${label}`, async () => {
      const { client } = makeClient({ 'GET /api/books/bk1/members': () => ({ status, body }) });
      const error = await client.listMembers('bk1').catch((e) => e);
      expect(error).toBeInstanceOf(SharingError);
      expect(error.status).toBe(expectedStatus);
      expect(error.code).toBe(body?.code ?? null);
    });
  }

  it('a thrown fetch (offline) is a network error carrying no status', async () => {
    const client = createSharingClient({
      fetch: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    const error = await client.listMembers('bk1').catch((e) => e);
    expect(error).toBeInstanceOf(SharingError);
    expect(error.status).toBeNull();
    expect(error.code).toBe('network');
  });

  it('the error carries only code/status — nothing about the user or the book', async () => {
    const { client } = makeClient({
      'GET /api/books/secret-book/members': () => ({ status: 404, body: { code: 'not_found', message: 'nope' } }),
    });
    const error = await client.listMembers('secret-book').catch((e) => e);
    expect(Object.keys(error).sort()).not.toContain('bookId');
    expect(JSON.stringify({ status: error.status, code: error.code })).not.toContain('secret-book');
    expect(error.message).toBe('not_found'); // the code, never the body message or the book id
  });
});

describe('the client logs nothing', () => {
  it('makes no console call on success or on a refusal', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    const { client } = makeClient({
      'GET /api/books/bk1/members': () => ({ body: { members: [], count: 0, limit: 50 } }),
      'POST /api/books/bk1/invitations': () => ({ status: 403, body: { code: 'forbidden', message: 'no' } }),
    });
    await client.listMembers('bk1');
    await client.createInvitation('bk1', { role: 'reader' }).catch(() => {});
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
  });
});
