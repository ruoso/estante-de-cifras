import postgres from 'postgres';

// A narrow Postgres seam for the e2e-api harness. The suite stays black-box
// over HTTP and the Mailpit HTTP API for its *assertions*; this seam exists
// only to seed a precondition that no landed endpoint yet provides — an
// account that already holds a recovery email. No HTTP endpoint sets
// accounts.email (passkeys carry no email; the account-screen recovery-email
// flow is a later concern), so the real request→SMTP→Mailpit→redeem round-trip
// cannot be reached black-box without seeding (service.email_links refinement,
// Decisions). scripts/gate exports ESTANTE_TEST_DATABASE_URL from the stack it
// brings up.

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set — the e2e-api sign-in test seeds its fixture account ` +
        'against the compose Postgres. Run it via scripts/gate (which brings the ' +
        'stack up and exports ESTANTE_TEST_DATABASE_URL), or set that variable to ' +
        'a stack you brought up yourself.',
    );
  }
  return value;
}

// connect opens a tiny, single-connection client against the compose Postgres.
// Callers end it when done.
export function connect() {
  return postgres(required('ESTANTE_TEST_DATABASE_URL'), { max: 1, onnotice: () => {} });
}

// seedAccount inserts an account holding `email` and returns its id, opening
// and closing its own short-lived connection.
export async function seedAccount(email) {
  const sql = connect();
  try {
    const [row] = await sql`INSERT INTO accounts (email) VALUES (${email}) RETURNING id`;
    return row.id;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
