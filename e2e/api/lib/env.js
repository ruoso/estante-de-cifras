// The harness is black-box against the running compose stack: it reads the
// stack's address from the environment and never starts, stops or reaches
// inside a container (the e2e_api refinement, Constraints). `scripts/gate`'s
// stack_up() exports these per run (gate lines 253–254). Read and validate
// them once, at import, and fail fast with an actionable message when a test
// is run outside the gate against no stack.

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set — the e2e-api harness runs against a live compose ` +
        'stack. Run it via scripts/gate (which brings the stack up and exports ' +
        'ESTANTE_E2E_BASE_URL and ESTANTE_E2E_MAIL_URL), or set those two ' +
        'variables to a stack you brought up yourself.',
    );
  }
  // Drop any trailing slash so callers can resolve absolute paths against it.
  return value.replace(/\/+$/, '');
}

// The stack's one origin is `localhost`, not the loopback IP: the e2e-web
// harness drives a real browser, which rejects WebAuthn on an IP-literal origin
// (SecurityError "This is an invalid domain."), so the compose service's RP ID
// and RP origin are `localhost` (ESTANTE_WEBAUTHN_RP_ID, ESTANTE_PUBLIC_BASE_URL).
// scripts/gate still exports the origin as http://127.0.0.1:<port>; normalize
// that host to `localhost` so this harness's HTTP calls and the origin its
// software authenticator stamps into clientDataJSON match the origin the
// service validates against. `localhost` resolves to the same published
// loopback bind, so only the host name changes.
function stackOrigin(value) {
  const url = new URL(value);
  if (url.hostname === '127.0.0.1') url.hostname = 'localhost';
  return url.origin;
}

// The one origin (app + API). Every HTTP call resolves against this.
export const baseUrl = stackOrigin(required('ESTANTE_E2E_BASE_URL'));

// The mail catcher's (Mailpit) HTTP API.
export const mailUrl = required('ESTANTE_E2E_MAIL_URL');
