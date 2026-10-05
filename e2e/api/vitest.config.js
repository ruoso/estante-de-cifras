import { defineConfig } from 'vitest/config';

// The e2e-api harness is black-box HTTP and git — no DOM, so the node
// environment (DIRECTION §3.6; the e2e_api refinement, "Vitest `run` in the
// node environment"). `vitest run` (not watch) is what the gate invokes with
// --maxWorkers; the gate — not this harness — owns the compose stack's
// lifecycle (stack_up/stack_down), so there is no globalSetup here.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.js'],
    exclude: ['**/node_modules/**'],
  },
});
