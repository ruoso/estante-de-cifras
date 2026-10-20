// The exploration seeds' Playwright configuration (explore/README.md). Kept
// apart from playwright.config.js so the gate never runs a seed: same projects
// and origin, but testDir is explore/, no retries, and a full trace so a
// session can be replayed afterwards.
import { defineConfig } from '@playwright/test';
import base from './playwright.config.js';

export default defineConfig({
  ...base,
  testDir: './explore',
  fullyParallel: false,
  retries: 0,
  use: { ...base.use, trace: 'on' },
});
