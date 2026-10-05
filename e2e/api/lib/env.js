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

// The one origin (app + API). Every HTTP call resolves against this.
export const baseUrl = required('ESTANTE_E2E_BASE_URL');

// The mail catcher's (Mailpit) HTTP API.
export const mailUrl = required('ESTANTE_E2E_MAIL_URL');
