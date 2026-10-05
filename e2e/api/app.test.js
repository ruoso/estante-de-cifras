/**
 * e2e-api — the built PWA is served at the root of the one origin, with the
 * API namespace beside it, against the real compose image (service.serve_app).
 *
 * Pins DIRECTION §3.3 lines 159–160 (the app at the root), line 170 (one
 * origin, the API beside the app) and line 180 (noindex on everything), and
 * api/openapi.yaml:30-36 (the app's own /b/{book} routing). Black-box via
 * HttpClient at ESTANTE_E2E_BASE_URL, modeled on health.test.js.
 */
import { describe, it, expect } from 'vitest';

import { HttpClient } from './lib/http.js';

describe('app', () => {
  it('GET / returns the real app shell, revalidated, with noindex', async () => {
    const client = new HttpClient();
    const response = await client.get('/');
    expect(response.status).toBe(200);
    const body = await response.text();
    // the bundled index.html's markers (DIRECTION §3.3 lines 159–160).
    expect(body).toContain('<div id="root">');
    expect(body).toContain('manifest.webmanifest');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(response.headers.get('cache-control')).toContain('no-cache');
  });

  it('GET /b/anything returns the same shell (SPA fallback)', async () => {
    const client = new HttpClient();
    const shell = await (await client.get('/')).text();
    const response = await client.get('/b/anything');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(shell);
  });

  it('the app at / and an API namespace beside it both carry noindex', async () => {
    const client = new HttpClient();
    // No /api handler exists yet; the app handler at / must not swallow the
    // namespace — it 404s, carrying the origin-wide noindex (DIRECTION §3.3
    // lines 170, 180).
    const api = await client.get('/api/does-not-exist');
    expect(api.status).toBe(404);
    expect(api.headers.get('x-robots-tag')).toBe('noindex');

    const root = await client.get('/');
    expect(root.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('GET /sw.js revalidates while a hashed asset is immutable', async () => {
    const client = new HttpClient();
    const sw = await client.get('/sw.js');
    expect(sw.status).toBe(200);
    expect(sw.headers.get('cache-control')).toContain('no-cache');

    // Discover the content-hashed entry from the served shell.
    const shell = await (await client.get('/')).text();
    const match = shell.match(/\/assets\/[^"']+\.js/);
    expect(match).not.toBeNull();
    const asset = await client.get(match[0]);
    expect(asset.status).toBe(200);
    expect(asset.headers.get('cache-control')).toContain('immutable');
  });
});
