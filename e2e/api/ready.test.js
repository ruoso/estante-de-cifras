/**
 * e2e-api — the live image is wired to Postgres and migrated at start-up.
 *
 * Pins DIRECTION §3.3 (one server with Postgres beside it) and service.schema's
 * migrate-at-start-up decision: GET /readyz answering 200 proves the deployed
 * binary read ESTANTE_DATABASE_URL, reached the stack's Postgres and applied
 * its migrations before serving. It exercises the compose.yaml DSN wiring — the
 * service container could not come up healthy, let alone answer ready, without
 * it.
 */
import { describe, it, expect } from 'vitest';

import { HttpClient } from './lib/http.js';

describe('readiness', () => {
  it('GET /readyz returns 200 ready at ESTANTE_E2E_BASE_URL', async () => {
    const client = new HttpClient();
    const response = await client.get('/readyz');
    expect(response.status).toBe(200);
    expect((await response.text()).trim()).toBe('ready');
  });
});
