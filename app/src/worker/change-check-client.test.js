import { describe, it, expect, vi, afterEach } from 'vitest';
import { createChangeCheckClient } from './change-check-client.js';

// unit — the change-check HTTP client (sync.engine). Pins the request it builds
// from each hosted book's head (null when empty), the changed/gone/omit mapping
// of the response, the session cookie (`credentials: 'include'`) and that it
// logs nothing (api/openapi.yaml ChangeCheckRequest/Response L1060-1120;
// DIRECTION §3.3). All fixture ids are opaque strings written for this test.

function jsonResponse(body, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    json: async () => body,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('change-check client (unit)', () => {
  it('builds the request from each book head (null when empty) and sends the session cookie', async () => {
    let seenUrl;
    let seenInit;
    const fetchImpl = vi.fn(async (url, init) => {
      seenUrl = url;
      seenInit = init;
      return jsonResponse({ books: [] });
    });
    const client = createChangeCheckClient({ fetch: fetchImpl });

    await client.check([
      { bookId: 'book-a', head: 'a'.repeat(40) },
      { bookId: 'book-b', head: null }, // an empty book the device holds nothing for
      { bookId: 'book-c' }, // head omitted → sent as null
    ]);

    expect(seenUrl).toBe('/api/shelf/change-check');
    expect(seenInit.method).toBe('POST');
    // The session cookie must flow so the service can authorise the shelf.
    expect(seenInit.credentials).toBe('include');
    expect(seenInit.headers['content-type']).toBe('application/json');
    expect(JSON.parse(seenInit.body)).toEqual({
      books: [
        { bookId: 'book-a', head: 'a'.repeat(40) },
        { bookId: 'book-b', head: null },
        { bookId: 'book-c', head: null },
      ],
    });
  });

  it('maps changed and gone, and omits an unchanged book (absent from the result)', async () => {
    const changedHead = 'b'.repeat(40);
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        books: [
          { bookId: 'book-a', status: 'changed', head: changedHead },
          { bookId: 'book-b', status: 'gone' },
          // The service omits an unchanged book; nothing for book-c comes back.
        ],
      }),
    );
    const client = createChangeCheckClient({ fetch: fetchImpl });

    const news = await client.check([
      { bookId: 'book-a', head: 'a'.repeat(40) },
      { bookId: 'book-b', head: 'a'.repeat(40) },
      { bookId: 'book-c', head: 'a'.repeat(40) },
    ]);

    expect(news.get('book-a')).toEqual({ bookId: 'book-a', status: 'changed', head: changedHead });
    expect(news.get('book-b')).toEqual({ bookId: 'book-b', status: 'gone' });
    expect(news.has('book-c')).toBe(false); // unchanged → omitted
  });

  it('rejects (for the engine to treat as "no news") on a non-2xx and logs nothing', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => jsonResponse(null, { ok: false, status: 401 }));
    const client = createChangeCheckClient({ fetch: fetchImpl });

    await expect(client.check([{ bookId: 'book-a', head: null }])).rejects.toMatchObject({
      status: 401,
    });
    expect(logSpy).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('caps the request at the service maximum of 500 books', async () => {
    let seenInit;
    const fetchImpl = vi.fn(async (_url, init) => {
      seenInit = init;
      return jsonResponse({ books: [] });
    });
    const client = createChangeCheckClient({ fetch: fetchImpl });
    const books = Array.from({ length: 600 }, (_, i) => ({ bookId: `book-${i}`, head: null }));

    await client.check(books);

    expect(JSON.parse(seenInit.body).books).toHaveLength(500);
  });
});
