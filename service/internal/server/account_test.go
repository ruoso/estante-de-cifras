package server

import (
	"context"
	"net/http"
	"os"
	"strings"
	"testing"

	apicontract "estantedecifras.app/api"
)

// These behavior tests drive handleDeleteAccount through httptest against the
// compose Postgres (ESTANTE_TEST_DATABASE_URL) and a real git volume, with the
// passkey ceremony standing in for a sign-in. They pin workflow 17 §The cascade
// (lines 115-136) and §What happens to books others are members of (lines 85-113),
// and the contract (api/openapi.yaml deleteAccount): the typed-email confirm, the
// one-statement `ON DELETE CASCADE`, best-effort repo removal, a fork surviving
// with its original nulled, and the 401/400 guards. A standalone `go test` with
// the DSN unset skips (migratedServerSchema → envDSN).

// setEmail gives a passkey-registered account (whose email is NULL) an address to
// type-match against. A real account gets its email from an email-login link; the
// test seeds it directly so the confirm has something to compare.
func (e *booksEnv) setEmail(t *testing.T, accountID, email string) {
	t.Helper()
	if _, err := e.pool.Exec(context.Background(), `UPDATE accounts SET email = $1 WHERE id = $2`, email, accountID); err != nil {
		t.Fatalf("set email: %v", err)
	}
}

// insertFork inserts a book owned by ownerID whose original_book_id points at
// originalID (a fork, workflow 11). The FK is ON DELETE SET NULL, so deleting the
// original's owner must leave this row with a NULL original_book_id.
func (e *booksEnv) insertFork(t *testing.T, ownerID, originalID string) string {
	t.Helper()
	var id string
	if err := e.pool.QueryRow(context.Background(),
		`INSERT INTO books (owner_id, original_book_id) VALUES ($1, $2) RETURNING id`, ownerID, originalID).Scan(&id); err != nil {
		t.Fatalf("insert fork: %v", err)
	}
	return id
}

// TestDeleteAccountCascades pins the whole cascade (workflow 17 §The cascade): an
// owner with two books (one shared with a member, with an invitation out, and
// forked by someone else) deletes their account; the account, its session and
// passkey, its owned books and their repos, the member's membership and the
// invitation are all gone, while the member's own account and the fork survive —
// the fork with its original nulled. The confirm is the account's email; a wrong
// one is 400 and deletes nothing, no session is 401.
func TestDeleteAccountCascades(t *testing.T) {
	e := newBooksEnv(t)
	ownerID, cookie := e.registerNewAccount(t)
	const email = "owner@example.test"
	e.setEmail(t, ownerID, email)

	shared := e.createBook(t, cookie, "Banda do Bairro")
	solo := e.createBook(t, cookie, "My songs")

	// A member on the shared book, an invitation out, and a fork by someone else.
	memberID := e.insertAccount(t)
	e.insertMembership(t, shared.ID, memberID, "editor")
	if _, err := e.pool.Exec(context.Background(),
		`INSERT INTO invitations (book_id, token, role) VALUES ($1, $2, 'editor')`, shared.ID, "tok_"+shared.ID); err != nil {
		t.Fatalf("insert invitation: %v", err)
	}
	forkerID := e.insertAccount(t)
	forkID := e.insertFork(t, forkerID, shared.ID)

	// No session → 401, nothing touched.
	if resp, _ := e.do(t, http.MethodDelete, "/api/account", "", []byte(`{"confirm":`+mustQuote(email)+`}`)); resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("unauthenticated delete: status = %d, want 401", resp.StatusCode)
	}

	// Wrong email → 400, and the account and its books are untouched.
	resp, body := e.do(t, http.MethodDelete, "/api/account", cookie, []byte(`{"confirm":"not-the-address@example.test"}`))
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("wrong-email delete: status = %d, want 400; body=%s", resp.StatusCode, body)
	}
	if err := e.contract.Validate("deleteAccount", apicontract.Response, "400", body); err != nil {
		t.Errorf("deleteAccount 400 does not conform: %v", err)
	}
	// The error never carries the real address (DIRECTION §3.3; Decision 4).
	if strings.Contains(strings.ToLower(string(body)), strings.ToLower(email)) {
		t.Errorf("400 body leaked the account email: %s", body)
	}
	if n := e.countRows(t, `SELECT count(*) FROM accounts WHERE id = $1`, ownerID); n != 1 {
		t.Fatalf("after a wrong-email delete the account is gone (n=%d), want it kept", n)
	}

	// Right email → 204, the session cookie cleared.
	resp, body = e.do(t, http.MethodDelete, "/api/account", cookie, []byte(`{"confirm":`+mustQuote(email)+`}`))
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("delete: status = %d, want 204; body=%s", resp.StatusCode, body)
	}
	if v := sessionCookieValue(resp); v != "" {
		t.Errorf("delete left a non-empty session cookie %q, want it cleared", v)
	}

	// The account and every account-owned row are gone.
	for _, c := range []struct {
		what  string
		query string
		args  []any
	}{
		{"account", `SELECT count(*) FROM accounts WHERE id = $1`, []any{ownerID}},
		{"sessions", `SELECT count(*) FROM sessions WHERE account_id = $1`, []any{ownerID}},
		{"passkeys", `SELECT count(*) FROM passkeys WHERE account_id = $1`, []any{ownerID}},
		{"owned books", `SELECT count(*) FROM books WHERE owner_id = $1`, []any{ownerID}},
		{"membership", `SELECT count(*) FROM memberships WHERE book_id = $1`, []any{shared.ID}},
		{"invitations", `SELECT count(*) FROM invitations WHERE book_id = $1`, []any{shared.ID}},
	} {
		if n := e.countRows(t, c.query, c.args...); n != 0 {
			t.Errorf("after delete, %s rows = %d, want 0", c.what, n)
		}
	}

	// The owned books' bare repos are reclaimed from disk (best-effort — here it
	// succeeds, so they are gone).
	for _, id := range []string{shared.ID, solo.ID} {
		if _, err := os.Stat(e.repoPath(id)); !os.IsNotExist(err) {
			t.Errorf("repo for %s still on disk (err=%v), want removed", id, err)
		}
	}

	// The member's own account survives (only its membership was dropped).
	if n := e.countRows(t, `SELECT count(*) FROM accounts WHERE id = $1`, memberID); n != 1 {
		t.Errorf("member account rows = %d, want 1 (the member is untouched)", n)
	}

	// The fork survives, its original_book_id nulled (ON DELETE SET NULL).
	if n := e.countRows(t, `SELECT count(*) FROM books WHERE id = $1 AND owner_id = $2`, forkID, forkerID); n != 1 {
		t.Errorf("fork rows = %d, want 1 (a fork survives its original's deletion)", n)
	}
	if n := e.countRows(t, `SELECT count(*) FROM books WHERE id = $1 AND original_book_id IS NULL`, forkID); n != 1 {
		t.Errorf("fork original_book_id not nulled, want NULL after the original's deletion")
	}

	// A follow-up call on the now-dead session is 401 (the session is gone).
	if resp, _ := e.do(t, http.MethodGet, "/api/account/sessions", cookie, nil); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("listSessions after delete: status = %d, want 401", resp.StatusCode)
	}
}

// TestDeleteAccountNullEmailFailsClosed pins the Open-questions degrade-gracefully
// note: a passkey-only account has a NULL email, so there is nothing to type-match
// and the confirm fails closed with a 400 (never a 500), leaving the account.
func TestDeleteAccountNullEmailFailsClosed(t *testing.T) {
	e := newBooksEnv(t)
	accountID, cookie := e.registerNewAccount(t) // email stays NULL

	resp, body := e.do(t, http.MethodDelete, "/api/account", cookie, []byte(`{"confirm":"anything@example.test"}`))
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("null-email delete: status = %d, want 400; body=%s", resp.StatusCode, body)
	}
	if n := e.countRows(t, `SELECT count(*) FROM accounts WHERE id = $1`, accountID); n != 1 {
		t.Errorf("account deleted despite a failed confirm, want it kept")
	}
}
