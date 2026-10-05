import { describe, it, expect, vi } from 'vitest';
import { createGitHttpClient } from './git-http.js';

// unit — the custom HTTP client's contract against an injected fake `fetch`
// (Decision 1). Pins tasks/40-storage.tji:26 ("custom HTTP client",
// "credentials included", "protocol v1") and the no-song-text-in-logs rule:
// the request/response shape maps both directions, `credentials: 'include'` is
// on every call, an inbound `Git-Protocol: version=2` is stripped, and
// `console` is never touched.

// A fake Response with just the surface the client reads: `.headers.forEach`,
// `.arrayBuffer()`, `.status`, `.statusText`, `.url`.
function fakeResponse({
  status = 200,
  statusText = 'OK',
  url = 'http://origin.test/repo.git/info/refs',
  headers = {},
  body = new Uint8Array([1, 2, 3]),
} = {}) {
  return {
    status,
    statusText,
    url,
    headers: {
      forEach(fn) {
        for (const [k, v] of Object.entries(headers)) fn(v, k);
      },
    },
    async arrayBuffer() {
      return body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength);
    },
  };
}

// Drain an async-iterable / array body into one Uint8Array, for asserting the
// request body the client sent to `fetch`.
async function drain(body) {
  const chunks = [];
  for await (const c of body) chunks.push(c);
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

describe('createGitHttpClient (unit)', () => {
  it('sets credentials: include on every request', async () => {
    const fetch = vi.fn(async () => fakeResponse());
    const { request } = createGitHttpClient({ fetch });

    await request({ url: 'http://origin.test/a', method: 'GET' });
    await request({ url: 'http://origin.test/b', method: 'POST', body: [new Uint8Array([9])] });

    expect(fetch).toHaveBeenCalledTimes(2);
    for (const call of fetch.mock.calls) {
      expect(call[1].credentials).toBe('include');
    }
  });

  it('strips an inbound Git-Protocol: version=2 header (pins v1)', async () => {
    const fetch = vi.fn(async () => fakeResponse());
    const { request } = createGitHttpClient({ fetch });

    await request({
      url: 'http://origin.test/repo.git/info/refs',
      method: 'GET',
      headers: { Accept: 'application/x-git-upload-pack-advertisement', 'Git-Protocol': 'version=2' },
    });

    const sentHeaders = fetch.mock.calls[0][1].headers;
    // The v2 header is gone; the rest of the headers survive.
    expect(sentHeaders).not.toHaveProperty('Git-Protocol');
    expect(sentHeaders.Accept).toBe('application/x-git-upload-pack-advertisement');
  });

  it('keeps a non-v2 Git-Protocol header untouched', async () => {
    const fetch = vi.fn(async () => fakeResponse());
    const { request } = createGitHttpClient({ fetch });

    await request({
      url: 'http://origin.test/x',
      headers: { 'Git-Protocol': 'version=1' },
    });

    expect(fetch.mock.calls[0][1].headers['Git-Protocol']).toBe('version=1');
  });

  it('collects the request body into one Uint8Array passed to fetch', async () => {
    const fetch = vi.fn(async () => fakeResponse());
    const { request } = createGitHttpClient({ fetch });

    await request({
      url: 'http://origin.test/repo.git/git-upload-pack',
      method: 'POST',
      body: [new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])],
    });

    const sentBody = fetch.mock.calls[0][1].body;
    expect(sentBody).toBeInstanceOf(Uint8Array);
    expect(Array.from(sentBody)).toEqual([1, 2, 3, 4, 5]);
  });

  it('collects an async-iterable request body too', async () => {
    const fetch = vi.fn(async () => fakeResponse());
    const { request } = createGitHttpClient({ fetch });

    async function* chunks() {
      yield new Uint8Array([7]);
      yield new Uint8Array([8, 9]);
    }
    await request({ url: 'http://origin.test/x', method: 'POST', body: chunks() });

    expect(Array.from(fetch.mock.calls[0][1].body)).toEqual([7, 8, 9]);
  });

  it('sends no body for a GET', async () => {
    const fetch = vi.fn(async () => fakeResponse());
    const { request } = createGitHttpClient({ fetch });

    await request({ url: 'http://origin.test/x', method: 'GET' });

    expect(fetch.mock.calls[0][1].body).toBeUndefined();
  });

  it('maps the response to the isomorphic-git http shape', async () => {
    const payload = new Uint8Array([10, 20, 30]);
    const fetch = vi.fn(async () =>
      fakeResponse({
        status: 200,
        statusText: 'OK',
        url: 'http://origin.test/repo.git/git-upload-pack',
        headers: { 'content-type': 'application/x-git-upload-pack-result' },
        body: payload,
      }),
    );
    const { request } = createGitHttpClient({ fetch });

    const res = await request({ url: 'http://origin.test/repo.git/git-upload-pack', method: 'POST', body: [new Uint8Array([1])] });

    expect(res.statusCode).toBe(200);
    expect(res.statusMessage).toBe('OK');
    expect(res.url).toBe('http://origin.test/repo.git/git-upload-pack');
    expect(res.method).toBe('POST');
    expect(res.headers['content-type']).toBe('application/x-git-upload-pack-result');
    expect(Array.isArray(res.body)).toBe(true);
    const got = await drain(res.body);
    expect(Array.from(got)).toEqual([10, 20, 30]);
  });

  it('surfaces a non-200 as the response status, not a throw', async () => {
    // A 401 (no session) / 404 (not a member) comes back as data for the
    // consumer to handle (workflow 10), not a thrown transport error.
    const fetch = vi.fn(async () => fakeResponse({ status: 401, statusText: 'Unauthorized' }));
    const { request } = createGitHttpClient({ fetch });

    const res = await request({ url: 'http://origin.test/repo.git/info/refs' });
    expect(res.statusCode).toBe(401);
    expect(res.statusMessage).toBe('Unauthorized');
  });

  it('logs nothing — console is never touched', async () => {
    const spies = ['log', 'info', 'warn', 'error', 'debug'].map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const fetch = vi.fn(async () => fakeResponse());
    const { request } = createGitHttpClient({ fetch });

    await request({
      url: 'http://origin.test/repo.git/git-receive-pack',
      method: 'POST',
      body: [new Uint8Array([1, 2, 3])],
      headers: { 'Git-Protocol': 'version=2' },
    });

    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    for (const spy of spies) spy.mockRestore();
  });

  it('defaults to globalThis.fetch when none is injected', async () => {
    const original = globalThis.fetch;
    const fetch = vi.fn(async () => fakeResponse());
    globalThis.fetch = fetch;
    try {
      const { request } = createGitHttpClient();
      await request({ url: 'http://origin.test/x' });
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
