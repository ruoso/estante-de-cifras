import postgres from 'postgres';

// A narrow Postgres seam for the e2e-web harness, mirroring e2e/api/lib/db.js
// (the api and web harnesses share no code — DIRECTION §3.6 line 288 — so it is
// re-stated here). The journey stays black-box over the browser and the Mailpit
// HTTP API for its *assertions*; this seam exists only to seed one precondition
// no landed endpoint provides — an account that already holds a recovery email.
// Passkeys carry no email and the account-screen recovery-email flow is a later
// concern (service.email_links refinement, Decisions), so the emailed-link
// sign-in cannot be reached black-box without seeding the address first.
// scripts/gate exports ESTANTE_TEST_DATABASE_URL from the stack it brings up.

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set — the e2e-web sign-in journey seeds its fixture ` +
        'account against the compose Postgres. Run it via scripts/gate (which ' +
        'brings the stack up and exports ESTANTE_TEST_DATABASE_URL), or set that ' +
        'variable to a stack you brought up yourself.',
    );
  }
  return value;
}

// seedAccount inserts an account holding `email` and returns its id, opening
// and closing its own short-lived connection.
export async function seedAccount(email) {
  const sql = postgres(required('ESTANTE_TEST_DATABASE_URL'), { max: 1, onnotice: () => {} });
  try {
    const [row] = await sql`INSERT INTO accounts (email) VALUES (${email}) RETURNING id`;
    return row.id;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

// Fill a book to its fifty-person cap so the next accept is refused `book_full`
// (books.add_by_link; workflow 10 §At most fifty — the service enforces the
// count). Mirrors e2e/api/sharing.test.js's fixture: insert `count` emailless
// accounts and a reader membership for each. The book's owner is already a
// member, so `count = 49` reaches fifty; the test passes 50 to be safely full.
export async function fillBookToCapacity(bookId, count = 50) {
  const sql = postgres(required('ESTANTE_TEST_DATABASE_URL'), { max: 1, onnotice: () => {} });
  try {
    await sql`
      WITH a AS (
        INSERT INTO accounts (email)
        SELECT NULL::text FROM generate_series(1, ${count})
        RETURNING id
      )
      INSERT INTO memberships (book_id, account_id, role)
      SELECT ${bookId}, id, 'reader' FROM a`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
