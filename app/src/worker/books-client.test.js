// Unit — the `/api/books` client (books.online). Pins its request/response
// shapes against the `api/openapi.yaml` `Book`/`CreateBookRequest` schemas, the
// `credentials:'include'` rule, a `413`/`401`/`403` surfaced as a typed error,
// and the no-logging rule (DIRECTION §3.6 L288-291). Modelled on
// change-check-client.test.js — an injected `fetch` double drives and observes
// each request.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { createBooksClient } from './books-client.js';

// A `fetch` double: records its calls and replies with a fixed response. A
// response is `{ status, body? }`; `ok` is derived (2xx).
function fakeFetch(responder) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const { status = 200, body } = responder(url, init) ?? {};
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };
  return { fetchImpl, calls };
}

describe('books-client (service.books contract)', () => {
  let logs;
  beforeEach(() => {
    // The client must log NOTHING — a title, id or gitUrl is account data.
    logs = [];
    for (const m of ['log', 'info', 'warn', 'error', 'debug']) {
      vi.spyOn(console, m).mockImplementation((...args) => logs.push([m, ...args]));
    }
  });
  afterEach(() => vi.restoreAllMocks());

  it('create POSTs { title } with credentials and parses the Book', async () => {
    const book = {
      id: 'srv-abc',
      title: 'My Choros',
      role: 'owner',
      visibility: 'private',
      gitUrl: 'https://estante.example/git/srv-abc',
      original: null,
    };
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 201, body: book }));
    const client = createBooksClient({ fetch: fetchImpl });

    const got = await client.create({ title: 'My Choros' });

    expect(got).toEqual(book);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('/api/books');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.credentials).toBe('include');
    expect(calls[0].init.headers['content-type']).toBe('application/json');
    expect(JSON.parse(calls[0].init.body)).toEqual({ title: 'My Choros' });
  });

  it('list GETs the collection with credentials and returns the books array', async () => {
    const books = [
      { id: 'a', title: 'A', role: 'owner', visibility: 'private', gitUrl: 'u/a' },
      { id: 'b', title: 'B', role: 'editor', visibility: 'private', gitUrl: 'u/b' },
    ];
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 200, body: { books } }));
    const client = createBooksClient({ fetch: fetchImpl });

    const got = await client.list();

    expect(got).toEqual(books);
    expect(calls[0].url).toBe('/api/books');
    expect(calls[0].init.method).toBe('GET');
    expect(calls[0].init.credentials).toBe('include');
  });

  it('remove DELETEs the per-book path with credentials and no body (204)', async () => {
    const { fetchImpl, calls } = fakeFetch(() => ({ status: 204 }));
    const client = createBooksClient({ fetch: fetchImpl });

    await expect(client.remove('srv abc/slash')).resolves.toBeUndefined();

    expect(calls[0].url).toBe('/api/books/srv%20abc%2Fslash');
    expect(calls[0].init.method).toBe('DELETE');
    expect(calls[0].init.credentials).toBe('include');
    expect(calls[0].init.body).toBeUndefined();
  });

  it('surfaces a 413 (over quota) as a typed error carrying the status', async () => {
    const { fetchImpl } = fakeFetch(() => ({ status: 413 }));
    const client = createBooksClient({ fetch: fetchImpl });
    await expect(client.create({ title: 'One too many' })).rejects.toMatchObject({
      status: 413,
    });
  });

  it('surfaces a 401 (no session) on create as a typed error', async () => {
    const { fetchImpl } = fakeFetch(() => ({ status: 401 }));
    const client = createBooksClient({ fetch: fetchImpl });
    await expect(client.create({ title: 'Signed out' })).rejects.toMatchObject({
      status: 401,
    });
  });

  it('surfaces a 403 (non-owner) on delete as a typed error', async () => {
    const { fetchImpl } = fakeFetch(() => ({ status: 403 }));
    const client = createBooksClient({ fetch: fetchImpl });
    await expect(client.remove('not-mine')).rejects.toMatchObject({ status: 403 });
  });

  it('logs nothing — not on success, not on failure', async () => {
    const { fetchImpl } = fakeFetch((url, init) =>
      init.method === 'DELETE' ? { status: 403 } : { status: 201, body: { id: 'x' } },
    );
    const client = createBooksClient({ fetch: fetchImpl });
    await client.create({ title: 'Quiet' });
    await client.remove('x').catch(() => {});
    expect(logs).toEqual([]);
  });
});
