// The e2e-web harness is black-box against the running compose stack: it reads
// the stack's origin from the environment and never starts, stops or reaches
// inside a container (the e2e_web refinement, Constraints). scripts/gate's
// stack_up() exports ESTANTE_E2E_BASE_URL — the one origin, app + API — per run
// (gate line 253), and the stack is already healthy before Playwright starts
// (`--wait`). Read and validate it once, at import, and fail fast with an
// actionable message when Playwright is run outside the gate against no stack
// (mirrors e2e/api/lib/env.js — the harnesses share no code, DIRECTION §3.6
// line 288).

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set — the e2e-web harness drives a browser against a ` +
        'live compose stack. Bring the stack up via scripts/gate (which exports ' +
        'ESTANTE_E2E_BASE_URL and runs Playwright with --workers), or bring a ' +
        'stack up yourself, set ESTANTE_E2E_BASE_URL to its origin, run ' +
        "'npx playwright install chromium', and then 'npx playwright test'.",
    );
  }
  // Drop any trailing slash so page.goto() resolves relative paths cleanly.
  return value.replace(/\/+$/, '');
}

// WebAuthn ceremonies run against the page's own origin, and a real browser
// rejects an IP-literal origin outright: navigator.credentials.create() throws
// SecurityError "This is an invalid domain." on http://127.0.0.1 for every
// rp.id (and omitted), succeeding only on a named host such as `localhost`.
// scripts/gate publishes the stack on loopback and exports its origin as
// http://127.0.0.1:<port>; normalize that host to the equivalent `localhost`
// name so this harness drives the passkey ceremony against a WebAuthn-valid
// origin. `localhost` resolves to the same published loopback bind, so only the
// host name changes — the compose stack serves its one origin on `localhost`
// too (ESTANTE_PUBLIC_BASE_URL, ESTANTE_WEBAUTHN_RP_ID), so the browser origin,
// the service's RP ID + RP origin and the mailed link all agree.
function browserOrigin(value) {
  const url = new URL(value);
  if (url.hostname === '127.0.0.1') url.hostname = 'localhost';
  return url.origin;
}

// The one origin (app + API). Playwright's use.baseURL resolves against this.
export const baseUrl = browserOrigin(required('ESTANTE_E2E_BASE_URL'));

// The mail catcher's HTTP API (Mailpit), read lazily: `playwright.config.js`
// imports `baseUrl` from here, so a throwing top-level read would break even the
// specs that never touch mail. The first `account` sign-in journey calls this;
// scripts/gate exports ESTANTE_E2E_MAIL_URL alongside the base URL (gate line
// 254). Trailing slash dropped so the reader can join paths cleanly.
export function mailUrl() {
  return required('ESTANTE_E2E_MAIL_URL');
}
