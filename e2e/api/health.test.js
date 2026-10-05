/**
 * e2e-api — the compose stack is up and answers at the one origin.
 *
 * Pins DIRECTION §3.6 lines 386–392 (the end-to-end tests run against the one
 * origin), service_skeleton's `GET /healthz` → `200 ok`, and the executable
 * proof foundation.compose names for itself (.tji line 49). This is the first
 * assertion the whole compose → ci → e2e chain has ever made.
 */
import { describe, it, expect } from 'vitest';

import { HttpClient } from './lib/http.js';

describe('health', () => {
  it('GET /healthz returns 200 ok at ESTANTE_E2E_BASE_URL', async () => {
    const client = new HttpClient();
    const response = await client.get('/healthz');
    expect(response.status).toBe(200);
    expect((await response.text()).trim()).toBe('ok');
  });
});
