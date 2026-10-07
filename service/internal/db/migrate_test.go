package db

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// These behavior tests run the real embedded migrator against the compose
// Postgres (ESTANTE_TEST_DATABASE_URL, which scripts/gate exports from the
// stack it brings up). Each test migrates into a freshly-created, uniquely-
// named schema and drops it on cleanup, so every run is empty→latest and runs
// are isolated — the migrator never names a schema, it works in the
// connection's search_path (refinement Constraints). A standalone `go test`
// with the DSN unset skips, staying green.

// migratedSchema builds a pool pinned to a throwaway schema, creates that
// schema, and registers its drop; the caller runs Migrate into it. It skips the
// test when the DSN is unset.
func migratedSchema(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("ESTANTE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("ESTANTE_TEST_DATABASE_URL is unset; this behavior test needs the compose Postgres (scripts/gate provides it)")
	}

	schema := "est_test_" + randToken(t)

	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatalf("ParseConfig: %v", err)
	}
	// Every connection the pool hands out works in this schema, so the
	// unqualified migrations land there and nowhere else.
	cfg.ConnConfig.RuntimeParams["search_path"] = schema

	ctx := context.Background()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatalf("NewWithConfig: %v", err)
	}
	t.Cleanup(func() {
		dropCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		// The qualified DROP ignores search_path; CASCADE removes the tables,
		// enums and bookkeeping this run created.
		if _, err := pool.Exec(dropCtx, `DROP SCHEMA IF EXISTS "`+schema+`" CASCADE`); err != nil {
			t.Logf("dropping schema %s: %v", schema, err)
		}
		pool.Close()
	})

	if _, err := pool.Exec(ctx, `CREATE SCHEMA "`+schema+`"`); err != nil {
		t.Fatalf("CREATE SCHEMA %s: %v", schema, err)
	}
	return pool
}

func randToken(t *testing.T) string {
	t.Helper()
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		t.Fatalf("rand: %v", err)
	}
	return hex.EncodeToString(b[:])
}

// relExists reports whether an unqualified relation (table) resolves in the
// current search_path.
func relExists(t *testing.T, pool *pgxpool.Pool, name string) bool {
	t.Helper()
	var exists bool
	if err := pool.QueryRow(context.Background(),
		`SELECT to_regclass($1) IS NOT NULL`, name).Scan(&exists); err != nil {
		t.Fatalf("checking relation %q: %v", name, err)
	}
	return exists
}

// typeExists reports whether an unqualified type (an enum) resolves in the
// current search_path.
func typeExists(t *testing.T, pool *pgxpool.Pool, name string) bool {
	t.Helper()
	var exists bool
	if err := pool.QueryRow(context.Background(),
		`SELECT to_regtype($1) IS NOT NULL`, name).Scan(&exists); err != nil {
		t.Fatalf("checking type %q: %v", name, err)
	}
	return exists
}

func insertAccount(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(context.Background(),
		`INSERT INTO accounts DEFAULT VALUES RETURNING id`).Scan(&id); err != nil {
		t.Fatalf("insert account: %v", err)
	}
	return id
}

func insertBook(t *testing.T, pool *pgxpool.Pool, ownerID string) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(context.Background(),
		`INSERT INTO books (owner_id) VALUES ($1) RETURNING id`, ownerID).Scan(&id); err != nil {
		t.Fatalf("insert book: %v", err)
	}
	return id
}

// TestMigrateEmptyToLatestIsIdempotent pins the .tji's "every migration applied
// from empty to the latest" and DIRECTION §3.3 lines 184–185: a scratch schema
// migrated from nothing to HEAD has every registry table, the migrator's
// bookkeeping and both enums; a second Migrate is a no-op (idempotent), adding
// no schema_migrations rows.
func TestMigrateEmptyToLatestIsIdempotent(t *testing.T) {
	pool := migratedSchema(t)
	ctx := context.Background()

	if err := Migrate(ctx, pool); err != nil {
		t.Fatalf("first Migrate: %v", err)
	}

	// The registry tables service.schema creates, plus the migrator's own
	// bookkeeping. email_login_links is deliberately not here — service.
	// email_links adds its own 0002 migration (refinement table 8).
	tables := []string{
		"accounts", "passkeys", "sessions", "books",
		"memberships", "invitations", "invitation_joins", "schema_migrations",
	}
	for _, name := range tables {
		if !relExists(t, pool, name) {
			t.Errorf("table %q does not exist after migrating to HEAD", name)
		}
	}
	for _, name := range []string{"book_role", "invitation_expiry"} {
		if !typeExists(t, pool, name) {
			t.Errorf("enum type %q does not exist after migrating to HEAD", name)
		}
	}

	var count int64
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM schema_migrations`).Scan(&count); err != nil {
		t.Fatalf("counting schema_migrations: %v", err)
	}
	if count == 0 {
		t.Fatal("schema_migrations is empty after migrating to HEAD")
	}

	if err := Migrate(ctx, pool); err != nil {
		t.Fatalf("second Migrate (should be a no-op): %v", err)
	}
	var after int64
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM schema_migrations`).Scan(&after); err != nil {
		t.Fatalf("re-counting schema_migrations: %v", err)
	}
	if after != count {
		t.Errorf("schema_migrations grew from %d to %d on a second Migrate; it must be idempotent", count, after)
	}
}

// TestOneMembershipPerPersonPerBook pins the .tji constraint and workflow 10
// lines 28–39: a second memberships row for the same (book_id, account_id) is
// rejected by the key.
func TestOneMembershipPerPersonPerBook(t *testing.T) {
	pool := migratedSchema(t)
	ctx := context.Background()
	if err := Migrate(ctx, pool); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	owner := insertAccount(t, pool)
	member := insertAccount(t, pool)
	book := insertBook(t, pool, owner)

	if _, err := pool.Exec(ctx,
		`INSERT INTO memberships (book_id, account_id, role) VALUES ($1, $2, 'reader')`,
		book, member); err != nil {
		t.Fatalf("first membership: %v", err)
	}
	if _, err := pool.Exec(ctx,
		`INSERT INTO memberships (book_id, account_id, role) VALUES ($1, $2, 'editor')`,
		book, member); err == nil {
		t.Error("a duplicate (book_id, account_id) membership was accepted; want the key to reject it")
	}
}

// TestInvitationUsesNeverBelowZero pins the .tji constraint, workflow 10 lines
// 50–51 and api Invitation.useLimit (line 1185): uses_remaining cannot be
// inserted or updated below zero, while NULL (unlimited) is accepted.
func TestInvitationUsesNeverBelowZero(t *testing.T) {
	pool := migratedSchema(t)
	ctx := context.Background()
	if err := Migrate(ctx, pool); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	owner := insertAccount(t, pool)
	book := insertBook(t, pool, owner)

	// NULL means unlimited and is accepted.
	var invID string
	if err := pool.QueryRow(ctx,
		`INSERT INTO invitations (token, book_id, role, uses_remaining) VALUES ($1, $2, 'editor', NULL) RETURNING id`,
		"tok-"+randToken(t), book).Scan(&invID); err != nil {
		t.Fatalf("invitation with NULL uses_remaining (unlimited): %v", err)
	}

	// Zero is the floor and is accepted.
	if _, err := pool.Exec(ctx,
		`INSERT INTO invitations (token, book_id, role, uses_remaining) VALUES ($1, $2, 'reader', 0)`,
		"tok-"+randToken(t), book); err != nil {
		t.Fatalf("invitation with uses_remaining 0: %v", err)
	}

	// Below zero is rejected, on insert and on update.
	if _, err := pool.Exec(ctx,
		`INSERT INTO invitations (token, book_id, role, uses_remaining) VALUES ($1, $2, 'reader', -1)`,
		"tok-"+randToken(t), book); err == nil {
		t.Error("an invitation with uses_remaining -1 was accepted; want the CHECK to reject it")
	}
	if _, err := pool.Exec(ctx,
		`UPDATE invitations SET uses_remaining = -1 WHERE id = $1`, invID); err == nil {
		t.Error("decrementing uses_remaining below zero was accepted; want the CHECK to reject it")
	}
}

// TestNoBookWithoutAnAccount pins DIRECTION §3.3 lines 175–178: a book with no
// owner, and a membership or invitation for a missing book or account, are all
// rejected by the foreign keys — "no book without an account" is a schema fact.
func TestNoBookWithoutAnAccount(t *testing.T) {
	pool := migratedSchema(t)
	ctx := context.Background()
	if err := Migrate(ctx, pool); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	// A book with no owner at all (owner_id is NOT NULL, no default).
	if _, err := pool.Exec(ctx, `INSERT INTO books DEFAULT VALUES`); err == nil {
		t.Error("a book with no owner_id was accepted; want NOT NULL to reject it")
	}
	// A book with an explicit NULL owner.
	if _, err := pool.Exec(ctx, `INSERT INTO books (owner_id) VALUES (NULL)`); err == nil {
		t.Error("a book with a NULL owner was accepted; want NOT NULL to reject it")
	}

	missing := "00000000-0000-0000-0000-000000000000"
	// A membership for a missing book and account.
	if _, err := pool.Exec(ctx,
		`INSERT INTO memberships (book_id, account_id, role) VALUES ($1, $2, 'reader')`,
		missing, missing); err == nil {
		t.Error("a membership for a missing book/account was accepted; want the FK to reject it")
	}
	// An invitation for a missing book.
	if _, err := pool.Exec(ctx,
		`INSERT INTO invitations (token, book_id, role) VALUES ($1, $2, 'editor')`,
		"tok-"+randToken(t), missing); err == nil {
		t.Error("an invitation for a missing book was accepted; want the FK to reject it")
	}
}

// TestRegistryShape pins api Role/InvitableRole (lines 835–843), api Original
// (lines 1001–1012) and workflow 11 lines 37–39: the owner is books.owner_id
// and never a memberships row (so the role enum has no 'owner'); role accepts
// only editor/reader; a single-level original_book_id resolves and may be set
// NULL without deleting the fork.
func TestRegistryShape(t *testing.T) {
	pool := migratedSchema(t)
	ctx := context.Background()
	if err := Migrate(ctx, pool); err != nil {
		t.Fatalf("Migrate: %v", err)
	}

	owner := insertAccount(t, pool)
	member := insertAccount(t, pool)
	book := insertBook(t, pool, owner)

	// The role enum carries only the invitable roles; 'owner' is not a value.
	if _, err := pool.Exec(ctx,
		`INSERT INTO memberships (book_id, account_id, role) VALUES ($1, $2, 'owner')`,
		book, member); err == nil {
		t.Error("a membership with role 'owner' was accepted; the owner is books.owner_id, not a membership row")
	}
	for _, role := range []string{"editor", "reader"} {
		one := insertAccount(t, pool)
		if _, err := pool.Exec(ctx,
			`INSERT INTO memberships (book_id, account_id, role) VALUES ($1, $2, $3)`,
			book, one, role); err != nil {
			t.Errorf("membership with role %q: %v", role, err)
		}
	}

	// A single-level fork remembers its original; the original may go away
	// (set NULL) without deleting the fork.
	original := insertBook(t, pool, owner)
	var fork string
	if err := pool.QueryRow(ctx,
		`INSERT INTO books (owner_id, original_book_id) VALUES ($1, $2) RETURNING id`,
		owner, original).Scan(&fork); err != nil {
		t.Fatalf("insert fork: %v", err)
	}
	var resolved string
	if err := pool.QueryRow(ctx,
		`SELECT original_book_id FROM books WHERE id = $1`, fork).Scan(&resolved); err != nil {
		t.Fatalf("reading fork original: %v", err)
	}
	if resolved != original {
		t.Errorf("fork original = %q, want %q", resolved, original)
	}
	if _, err := pool.Exec(ctx,
		`UPDATE books SET original_book_id = NULL WHERE id = $1`, fork); err != nil {
		t.Fatalf("clearing fork original: %v", err)
	}
	var stillThere bool
	if err := pool.QueryRow(ctx,
		`SELECT EXISTS (SELECT 1 FROM books WHERE id = $1)`, fork).Scan(&stillThere); err != nil {
		t.Fatalf("checking fork survives: %v", err)
	}
	if !stillThere {
		t.Error("the fork vanished when its original was cleared; the original is single-level and detachable")
	}
}
