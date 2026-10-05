import { baseUrl } from './env.js';

// An HTTP client that carries a session, device-side (the e2e_api refinement,
// §What this task is #1). The API is one origin with one session cookie and no
// CORS (api_contract.md; DIRECTION §3.6 line 369), so a hand-rolled cookie jar
// over Node's built-in `fetch` is exactly the device's behaviour and needs no
// HTTP-client dependency. One session per instance: a test signs in once and
// stays signed in, as a browser does on one origin.
export class HttpClient {
  constructor({ base = baseUrl } = {}) {
    this.base = base;
    // name -> value; the single session cookie lives here across calls.
    this.cookies = new Map();
  }

  // Resolve a path ("/healthz", "/api/...") against the one origin.
  url(path) {
    return new URL(path, `${this.base}/`).toString();
  }

  // The Cookie header to re-send, or '' when the jar is empty.
  cookieHeader() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  }

  // Store Set-Cookie headers from a response. Node 24's undici exposes every
  // Set-Cookie via getSetCookie(); a cookie set to an empty value is a
  // deletion.
  storeCookies(response) {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const header of setCookies) {
      const [pair] = header.split(';');
      const eq = pair.indexOf('=');
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (value === '') this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  // Core request: attach the cookie jar, send, remember any Set-Cookie. Follows
  // redirects by default so a signed-in navigation behaves like a browser.
  async fetch(path, options = {}) {
    const headers = new Headers(options.headers ?? {});
    const cookie = this.cookieHeader();
    if (cookie && !headers.has('cookie')) headers.set('cookie', cookie);
    const response = await fetch(this.url(path), { ...options, headers });
    this.storeCookies(response);
    return response;
  }

  get(path, options = {}) {
    return this.fetch(path, { ...options, method: 'GET' });
  }

  // POST a JSON body; returns the raw Response.
  postJson(path, body, options = {}) {
    const headers = new Headers(options.headers ?? {});
    headers.set('content-type', 'application/json');
    return this.fetch(path, {
      ...options,
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  // GET and parse JSON.
  async getJson(path, options = {}) {
    const response = await this.get(path, options);
    return response.json();
  }
}
