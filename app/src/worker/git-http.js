// git-http.js — the Worker's custom HTTP client for isomorphic-git
// (storage.git). isomorphic-git does its own network through an injected `http`
// plugin: a single `request({ url, method, headers, body, signal }) → { url,
// method, headers, statusCode, statusMessage, body }` whose bodies are iterables
// of `Uint8Array`. This module is that plugin, wrapping `fetch` (Decision 1).
//
// It is the one network choke point for git, so three things live here and
// nowhere else:
//   - `credentials: 'include'` on EVERY request, so the browser's session
//     cookie flows to the service that authorises each git request (DIRECTION
//     §3.3 L206-211 — "The browser only ever holds its session with the
//     service"; Decision 2). The client itself stores no credentials and never
//     uses isomorphic-git's `onAuth` (Decision 6).
//   - Protocol v1 is pinned by stripping any inbound `Git-Protocol: version=2`
//     header before the request leaves (Decision 3). The service upgrades to v2
//     only on that header (DIRECTION §3.6 L330-332), so never sending it keeps
//     this client on v1 — and push on isomorphic-git's v1 receive-pack flow,
//     never the v2 `getRemoteInfo2` path (tasks/40-storage.tji:26).
//   - It logs nothing: not URLs, not request/response bodies (pack data is song
//     blobs), not headers. Errors surface as the thrown/rejected value for the
//     caller to turn into a protocol `ERROR` event — never to `console`
//     (the standing no-song-text-in-logs rule, mirroring logic.js:9-11).
//
// Framework-free, Worker-only: plain ESM, no React, no DOM beyond `fetch`.

/**
 * Collect an iterable (sync array or async-iterable) of `Uint8Array` chunks
 * into one `Uint8Array`. isomorphic-git hands a request body as an array of
 * chunks; collecting it up front lets `fetch` send an ordinary body (no stream,
 * so no `duplex` dance) — the same shape isomorphic-git's bundled web client
 * uses. `undefined` stays `undefined` (a GET carries no body).
 *
 * @param {Iterable<Uint8Array>|AsyncIterable<Uint8Array>|undefined} body
 * @returns {Promise<Uint8Array|undefined>}
 */
async function collectBody(body) {
  if (body == null) return undefined;
  const chunks = [];
  let total = 0;
  for await (const chunk of body) {
    const u8 = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    chunks.push(u8);
    total += u8.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/**
 * Build the git HTTP client. `options.fetch` injects a `fetch` implementation
 * (a test supplies one to drive and observe requests); it defaults to the
 * global `fetch` the real Worker provides.
 *
 * @param {{ fetch?: typeof globalThis.fetch }} [options]
 * @returns {{ request: (req: {
 *   url: string, method?: string, headers?: Record<string, string>,
 *   body?: Iterable<Uint8Array>|AsyncIterable<Uint8Array>,
 *   onProgress?: Function, signal?: AbortSignal,
 * }) => Promise<{
 *   url: string, method: string, statusCode: number, statusMessage: string,
 *   headers: Record<string, string>, body: Uint8Array[],
 * }> }}
 */
export function createGitHttpClient(options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;

  async function request({ url, method = 'GET', headers = {}, body, signal }) {
    // Pin protocol v1: drop any `Git-Protocol: version=2` header so the service
    // never upgrades this client past v1 (Decision 3). Matched case-insensitively
    // on both header name and the `version=2` token.
    const outHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      if (
        key.toLowerCase() === 'git-protocol' &&
        /version=2/i.test(String(value))
      ) {
        continue;
      }
      outHeaders[key] = value;
    }

    const payload = await collectBody(body);

    const response = await fetchImpl(url, {
      method,
      headers: outHeaders,
      body: payload,
      // The session cookie must flow on every git request (Decision 2).
      credentials: 'include',
      signal,
    });

    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // Collect the whole response into one chunk (test repos are small, and this
    // mirrors the bundled web client's `arrayBuffer()` path). isomorphic-git
    // accepts an array of `Uint8Array` as the response body.
    const buffer = new Uint8Array(await response.arrayBuffer());

    return {
      url: response.url || url,
      method,
      statusCode: response.status,
      statusMessage: response.statusText,
      headers: responseHeaders,
      body: [buffer],
    };
  }

  return { request };
}
