import { defineConfig, devices } from '@playwright/test';

import { baseUrl } from './lib/env.js';

// Black-box against the running compose stack. The gate owns the stack's
// lifecycle (stack_up/stack_down) and exports ESTANTE_E2E_BASE_URL — the one
// origin, app + API — before Playwright starts (scripts/gate stack_up, line
// 253); the stack is already healthy (`--wait`), so tests navigate, they do not
// poll for startup. This config only points baseURL at that origin (read and
// validated in lib/env.js, which fails fast when unset) — no webServer and no
// stack management, which would double-manage what the gate owns and break the
// one-stack-per-run isolation (the e2e_web refinement, Decisions).
//
// Three projects — phone, tablet and computer — with no project-level testMatch
// filter, so every spec runs on all three (DIRECTION §3.7 line 399, "a phone, a
// tablet and a computer alike"). All three are Chromium: Playwright's offline
// network emulation (context.setOffline) is a Chromium capability the other
// engines do not all support, and the mandated offline journeys must run on
// every viewport, so one engine every project can share (the e2e_web
// refinement, Decisions). The mobile two use Chromium device descriptors
// (viewport, deviceScaleFactor, isMobile, hasTouch); the computer a desktop
// Chromium viewport. Only Chromium device names appear below — no other-engine
// or iOS-device token — so the gate's browser-detection resolves to chromium
// only (scripts/gate lines 196–207). (This comment avoids those tokens on
// purpose: the gate greps this file's text to decide what to install.)
//
// workers is left to the gate's --workers (≤4, never pinned here, or it would
// fight the gate's bound); retries/forbidOnly follow CI as the template does.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: baseUrl,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'tablet', use: { ...devices['Galaxy Tab S4'] } },
    { name: 'computer', use: { ...devices['Desktop Chrome'] } },
  ],
});
