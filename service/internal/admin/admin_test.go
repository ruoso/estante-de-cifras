package admin_test

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"estantedecifras.app/service/internal/admin"
	"estantedecifras.app/service/internal/db"
)

// These are behavior tests against a real Postgres (the compose stack's, which
// scripts/gate provides as ESTANTE_TEST_DATABASE_URL). Each gets an isolated,
// freshly migrated schema, and seeds the registry rows the three admin actions
// move, then asserts both the mutation and the book_notices record they commit
// together (refinement Acceptance — behavior: "each action against Postgres, the
// owner's notice recorded"). Without the DSN they skip, so a plain `go test`
// still passes (the env helper precedent in the server package).

// migratedSchema opens a pool on an isolated, freshly migrated schema — the
// package-admin twin of the server package's migratedServerSchema, replicated
// because that helper is unexported. It skips without the compose Postgres.
func migratedSchema(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("ESTANTE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("ESTANTE_TEST_DATABASE_URL is unset; this behavior test needs the compose Postgres (scripts/gate provides it)")
	}
	schema := "est_admin_test_" + randHex(t)
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatalf("parse DSN: %v", err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema

	ctx := context.Background()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatalf("open pool: %v", err)
	}
	if _, err := pool.Exec(ctx, `CREATE SCHEMA "`+schema+`"`); err != nil {
		pool.Close()
		t.Fatalf("create schema: %v", err)
	}
	if err := db.Migrate(ctx, pool); err != nil {
		pool.Close()
		t.Fatalf("migrate: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), `DROP SCHEMA IF EXISTS "`+schema+`" CASCADE`)
		pool.Close()
	})
	return pool
}

func randHex(t *testing.T) string {
	t.Helper()
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		t.Fatalf("rand: %v", err)
	}
	return hex.EncodeToString(b[:])
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

func insertBook(t *testing.T, pool *pgxpool.Pool, owner string) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(context.Background(),
		`INSERT INTO books (owner_id) VALUES ($1) RETURNING id`, owner).Scan(&id); err != nil {
		t.Fatalf("insert book: %v", err)
	}
	return id
}

func insertMembership(t *testing.T, pool *pgxpool.Pool, book, account, role string) {
	t.Helper()
	if _, err := pool.Exec(context.Background(),
		`INSERT INTO memberships (book_id, account_id, role) VALUES ($1, $2, $3)`,
		book, account, role); err != nil {
		t.Fatalf("insert membership: %v", err)
	}
}

func insertInvitation(t *testing.T, pool *pgxpool.Pool, book, role string) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(context.Background(),
		`INSERT INTO invitations (token, book_id, role) VALUES ($1, $2, $3) RETURNING id`,
		randHex(t), book, role).Scan(&id); err != nil {
		t.Fatalf("insert invitation: %v", err)
	}
	return id
}

func insertJoin(t *testing.T, pool *pgxpool.Pool, invitation, account string) {
	t.Helper()
	if _, err := pool.Exec(context.Background(),
		`INSERT INTO invitation_joins (invitation_id, account_id) VALUES ($1, $2)`,
		invitation, account); err != nil {
		t.Fatalf("insert invitation_join: %v", err)
	}
}

func noticeCount(t *testing.T, pool *pgxpool.Pool, book, action string) int {
	t.Helper()
	var n int
	if err := pool.QueryRow(context.Background(),
		`SELECT count(*) FROM book_notices WHERE book_id = $1 AND action = $2`,
		book, action).Scan(&n); err != nil {
		t.Fatalf("count notices: %v", err)
	}
	return n
}

// TestTakeDownRecordsNotice: take-down sets taken_down_reason and records a
// take_down notice carrying the owner and the reason; a deleted book and an empty
// reason are refused with no write. Pins workflow 10 lines 103-106, 111-113;
// migration 0004 (book_notices).
func TestTakeDownRecordsNotice(t *testing.T) {
	pool := migratedSchema(t)
	ctx := context.Background()

	owner := insertAccount(t, pool)
	member := insertAccount(t, pool)
	book := insertBook(t, pool, owner)
	insertMembership(t, pool, book, member, "editor")

	if err := admin.TakeDown(ctx, pool, book, "copyright claim #42"); err != nil {
		t.Fatalf("TakeDown: %v", err)
	}

	var reason *string
	if err := pool.QueryRow(ctx, `SELECT taken_down_reason FROM books WHERE id = $1`, book).Scan(&reason); err != nil {
		t.Fatalf("read reason: %v", err)
	}
	if reason == nil || *reason != "copyright claim #42" {
		t.Errorf("taken_down_reason = %v, want %q", reason, "copyright claim #42")
	}

	var gotOwner, gotReason string
	if err := pool.QueryRow(ctx,
		`SELECT owner_id, reason FROM book_notices WHERE book_id = $1 AND action = 'take_down'`,
		book).Scan(&gotOwner, &gotReason); err != nil {
		t.Fatalf("read notice: %v", err)
	}
	if gotOwner != owner {
		t.Errorf("notice owner = %q, want %q", gotOwner, owner)
	}
	if gotReason != "copyright claim #42" {
		t.Errorf("notice reason = %q, want %q", gotReason, "copyright claim #42")
	}

	// A deleted book is already gone: ErrNoBook, nothing written.
	deleted := insertBook(t, pool, owner)
	if _, err := pool.Exec(ctx, `UPDATE books SET deleted_at = now() WHERE id = $1`, deleted); err != nil {
		t.Fatalf("soft-delete: %v", err)
	}
	if err := admin.TakeDown(ctx, pool, deleted, "x"); !errors.Is(err, admin.ErrNoBook) {
		t.Errorf("TakeDown on deleted book: err = %v, want ErrNoBook", err)
	}
	if n := noticeCount(t, pool, deleted, "take_down"); n != 0 {
		t.Errorf("deleted book notices = %d, want 0", n)
	}

	// An empty reason is refused, nothing written.
	fresh := insertBook(t, pool, owner)
	if err := admin.TakeDown(ctx, pool, fresh, ""); !errors.Is(err, admin.ErrEmptyReason) {
		t.Errorf("TakeDown with empty reason: err = %v, want ErrEmptyReason", err)
	}
	var freshReason *string
	if err := pool.QueryRow(ctx, `SELECT taken_down_reason FROM books WHERE id = $1`, fresh).Scan(&freshReason); err != nil {
		t.Fatalf("read fresh reason: %v", err)
	}
	if freshReason != nil {
		t.Errorf("empty-reason take-down wrote taken_down_reason = %q", *freshReason)
	}
	if n := noticeCount(t, pool, fresh, "take_down"); n != 0 {
		t.Errorf("empty-reason notices = %d, want 0", n)
	}
}

// TestWithdrawInvitationsRecordsNotice: withdraw sets withdrawn_at on every
// not-yet-withdrawn invitation and records a withdraw_invitations notice; those
// who joined keep their membership; a re-run withdraws nothing new and records no
// new notice (idempotent). Pins workflow 10 lines 52-53, 103-106; 0001:125.
func TestWithdrawInvitationsRecordsNotice(t *testing.T) {
	pool := migratedSchema(t)
	ctx := context.Background()

	owner := insertAccount(t, pool)
	joiner := insertAccount(t, pool)
	book := insertBook(t, pool, owner)
	inv1 := insertInvitation(t, pool, book, "editor")
	inv2 := insertInvitation(t, pool, book, "reader")
	insertMembership(t, pool, book, joiner, "editor")
	insertJoin(t, pool, inv1, joiner)

	if err := admin.WithdrawInvitations(ctx, pool, book, "copyright notice"); err != nil {
		t.Fatalf("WithdrawInvitations: %v", err)
	}

	for _, inv := range []string{inv1, inv2} {
		var withdrawn *string
		if err := pool.QueryRow(ctx, `SELECT withdrawn_at::text FROM invitations WHERE id = $1`, inv).Scan(&withdrawn); err != nil {
			t.Fatalf("read withdrawn_at: %v", err)
		}
		if withdrawn == nil {
			t.Errorf("invitation %s not withdrawn", inv)
		}
	}
	if n := noticeCount(t, pool, book, "withdraw_invitations"); n != 1 {
		t.Errorf("notices = %d, want 1", n)
	}

	// The already-joined member keeps their membership.
	var members int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM memberships WHERE book_id = $1 AND account_id = $2`, book, joiner).Scan(&members); err != nil {
		t.Fatalf("count membership: %v", err)
	}
	if members != 1 {
		t.Errorf("joined member membership count = %d, want 1", members)
	}

	// Idempotent: a re-run withdraws nothing new and records no new notice.
	if err := admin.WithdrawInvitations(ctx, pool, book, "copyright notice"); err != nil {
		t.Fatalf("WithdrawInvitations (re-run): %v", err)
	}
	if n := noticeCount(t, pool, book, "withdraw_invitations"); n != 1 {
		t.Errorf("notices after re-run = %d, want 1 (idempotent)", n)
	}
}

// TestRemoveMembersRecordsNotice: remove deletes every membership and records a
// remove_members notice; invitation_joins history survives and the owner is
// untouched. Pins workflow 10 lines 77-81, 103-106; 0001:100-106.
func TestRemoveMembersRecordsNotice(t *testing.T) {
	pool := migratedSchema(t)
	ctx := context.Background()

	owner := insertAccount(t, pool)
	editor := insertAccount(t, pool)
	reader := insertAccount(t, pool)
	book := insertBook(t, pool, owner)
	insertMembership(t, pool, book, editor, "editor")
	insertMembership(t, pool, book, reader, "reader")
	inv := insertInvitation(t, pool, book, "editor")
	insertJoin(t, pool, inv, editor)

	if err := admin.RemoveMembers(ctx, pool, book, "copyright notice"); err != nil {
		t.Fatalf("RemoveMembers: %v", err)
	}

	var members int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM memberships WHERE book_id = $1`, book).Scan(&members); err != nil {
		t.Fatalf("count memberships: %v", err)
	}
	if members != 0 {
		t.Errorf("memberships = %d, want 0", members)
	}
	if n := noticeCount(t, pool, book, "remove_members"); n != 1 {
		t.Errorf("notices = %d, want 1", n)
	}

	// invitation_joins history survives (workflow 10 line 52).
	var joins int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM invitation_joins WHERE invitation_id = $1`, inv).Scan(&joins); err != nil {
		t.Fatalf("count joins: %v", err)
	}
	if joins != 1 {
		t.Errorf("invitation_joins = %d, want 1 (history untouched)", joins)
	}

	// The owner is never a membership row, so ownership is unaffected.
	var gotOwner string
	if err := pool.QueryRow(ctx, `SELECT owner_id FROM books WHERE id = $1`, book).Scan(&gotOwner); err != nil {
		t.Fatalf("read owner: %v", err)
	}
	if gotOwner != owner {
		t.Errorf("owner = %q, want %q", gotOwner, owner)
	}
}
