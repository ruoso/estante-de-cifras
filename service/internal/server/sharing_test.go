package server

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	apicontract "estantedecifras.app/api"
)

// These tests cover service.sharing (workflow 10; api/openapi.yaml Sharing).
//
// The pure-helper tests run with no DB or network (the note's "unit (role,
// expiry and use rules)"): resolveExpiry, the token hash, the who-sees-whom
// filter, and the accept-route token redaction in the request log.
//
// The behavior tests drive the real handlers through httptest against the
// compose Postgres (ESTANTE_TEST_DATABASE_URL) with accounts and sessions from
// the passkey ceremony (newBooksEnv), and validate every response against the
// contract: create / list / withdraw an invitation, accept it (with the four
// 409 reasons and idempotency), the fiftieth joining while the fifty-first is
// refused, change a role, remove a member, and who-sees-whom. A standalone
// `go test` with the DSN unset skips (migratedServerSchema → envDSN).

// --- unit: pure rule helpers -------------------------------------------------

// TestResolveExpiry pins the expiry resolution (workflow 10 lines 49-51;
// contract ExpiryChoice): the three finite choices resolve to now + their span,
// until-withdrawn has no deadline.
func TestResolveExpiry(t *testing.T) {
	now := time.Date(2026, 10, 7, 12, 0, 0, 0, time.UTC)
	cases := []struct {
		choice string
		want   *time.Time
	}{
		{"day", ptrTime(now.Add(24 * time.Hour))},
		{"week", ptrTime(now.Add(7 * 24 * time.Hour))},
		{"month", ptrTime(now.Add(30 * 24 * time.Hour))},
		{"until-withdrawn", nil},
	}
	for _, c := range cases {
		got := resolveExpiry(c.choice, now)
		switch {
		case c.want == nil && got != nil:
			t.Errorf("resolveExpiry(%q) = %v, want nil", c.choice, got)
		case c.want != nil && got == nil:
			t.Errorf("resolveExpiry(%q) = nil, want %v", c.choice, *c.want)
		case c.want != nil && got != nil && !got.Equal(*c.want):
			t.Errorf("resolveExpiry(%q) = %v, want %v", c.choice, *got, *c.want)
		}
	}
}

func ptrTime(t time.Time) *time.Time { return &t }

// TestInvitationTokenHash pins the hash-of-secret pattern (0002_email_links.sql
// header note; invitations.token NOT NULL UNIQUE): a minted token is
// high-entropy, and hashToken reproduces the stored hash so accept finds the
// row by it.
func TestInvitationTokenHash(t *testing.T) {
	raw1, hash1, err := newInvitationToken()
	if err != nil {
		t.Fatalf("newInvitationToken: %v", err)
	}
	if len(raw1) < 32 {
		t.Errorf("raw token too short (%d chars) for a high-entropy secret", len(raw1))
	}
	if hashToken(raw1) != hash1 {
		t.Errorf("hashToken(raw) = %q, want the minted hash %q", hashToken(raw1), hash1)
	}
	if raw1 == hash1 {
		t.Error("the stored hash must not equal the raw secret")
	}
	// A second mint differs from the first (the token is random).
	raw2, hash2, err := newInvitationToken()
	if err != nil {
		t.Fatalf("newInvitationToken (2): %v", err)
	}
	if raw1 == raw2 || hash1 == hash2 {
		t.Error("two minted tokens collided; the token is not random")
	}
}

// TestVisibleMembers pins who-sees-whom (workflow 10 lines 71-75; contract
// listMembers): the owner sees everyone, any other caller sees the owner and
// the editors but not the other readers.
func TestVisibleMembers(t *testing.T) {
	all := []memberEntry{
		{userID: "owner-id", role: "owner"},
		{userID: "editor-id", role: "editor"},
		{userID: "reader-id", role: "reader"},
	}
	if got := visibleMembers("owner", all); len(got) != 3 {
		t.Errorf("owner sees %d members, want all 3", len(got))
	}
	for _, caller := range []string{"editor", "reader"} {
		got := visibleMembers(caller, all)
		if len(got) != 2 {
			t.Fatalf("%s caller sees %d members, want 2 (owner + editor)", caller, len(got))
		}
		for _, m := range got {
			if m.role == "reader" {
				t.Errorf("%s caller saw a reader (%s); readers must be hidden", caller, m.userID)
			}
		}
	}
}

// TestRedactInvitationToken pins the "never log the token" rule at the HTTP edge
// (service.sharing Constraints; DIRECTION §3.3): the accept route's secret
// segment is redacted, and no other path is touched.
func TestRedactInvitationToken(t *testing.T) {
	secret := "a-high-entropy-secret-token"
	if got := redactInvitationToken("/api/invitations/" + secret + "/accept"); strings.Contains(got, secret) {
		t.Errorf("redactInvitationToken leaked the token: %q", got)
	}
	if got := redactInvitationToken("/api/invitations/" + secret + "/accept"); got != "/api/invitations/{token}/accept" {
		t.Errorf("redactInvitationToken = %q, want the placeholder path", got)
	}
	for _, p := range []string{"/api/books", "/api/books/abc/members", "/api/invitations", "/healthz"} {
		if got := redactInvitationToken(p); got != p {
			t.Errorf("redactInvitationToken(%q) = %q, want it unchanged", p, got)
		}
	}
}

// --- behavior helpers --------------------------------------------------------

// createInvitation POSTs an invitation and returns the decoded invitation,
// asserting 201 and contract conformance.
func (e *booksEnv) createInvitation(t *testing.T, cookie, bookID, body string) invitationJSON {
	t.Helper()
	resp, b := e.do(t, http.MethodPost, "/api/books/"+bookID+"/invitations", cookie, []byte(body))
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create invitation: status = %d, want 201; body=%s", resp.StatusCode, b)
	}
	if err := e.contract.Validate("createInvitation", apicontract.Response, "201", b); err != nil {
		t.Errorf("createInvitation response does not conform: %v", err)
	}
	var inv invitationJSON
	if err := json.Unmarshal(b, &inv); err != nil {
		t.Fatalf("decoding invitation: %v", err)
	}
	return inv
}

// tokenFromURL extracts the raw token the accept route expects from an
// invitation link (<base>/i/<raw>).
func tokenFromURL(t *testing.T, url string) string {
	t.Helper()
	const marker = "/i/"
	i := strings.Index(url, marker)
	if i < 0 {
		t.Fatalf("invitation url %q has no %q segment", url, marker)
	}
	return url[i+len(marker):]
}

// acceptInvitation POSTs the accept route with the raw token and the session
// cookie, returning the raw response and body for the caller to assert on.
func (e *booksEnv) acceptInvitation(t *testing.T, cookie, token string) (*http.Response, []byte) {
	t.Helper()
	return e.do(t, http.MethodPost, "/api/invitations/"+token+"/accept", cookie, nil)
}

func (e *booksEnv) invitationUsesRemaining(t *testing.T, invitationID string) *int {
	t.Helper()
	var u *int
	if err := e.pool.QueryRow(context.Background(), `SELECT uses_remaining FROM invitations WHERE id = $1`, invitationID).Scan(&u); err != nil {
		t.Fatalf("read uses_remaining: %v", err)
	}
	return u
}

// seedMembers inserts n fresh accounts as reader members of the book directly,
// a fixture no endpoint shapes (the cap is enforced at accept, so the rows are
// seeded straight). NULL emails are allowed to repeat (Postgres).
func (e *booksEnv) seedMembers(t *testing.T, bookID string, n int) {
	t.Helper()
	if _, err := e.pool.Exec(context.Background(),
		`WITH a AS (
			INSERT INTO accounts (email) SELECT NULL::text FROM generate_series(1, $2) RETURNING id
		)
		INSERT INTO memberships (book_id, account_id, role) SELECT $1, id, 'reader' FROM a`,
		bookID, n); err != nil {
		t.Fatalf("seed %d members: %v", n, err)
	}
}

// --- behavior: invitations ---------------------------------------------------

// TestCreateInvitation pins acceptance #1 (workflow 10 lines 40-61; contract
// createInvitation): an owner's create stores a hashed token, the resolved
// expiry and uses_remaining, and returns 201 with the link; the gates and the
// body validations answer as declared.
func TestCreateInvitation(t *testing.T) {
	e := newBooksEnv(t)
	_, ownerCookie := e.registerNewAccount(t)
	b := e.createBook(t, ownerCookie, "Shared Choros")

	inv := e.createInvitation(t, ownerCookie, b.ID, `{"role":"editor","expiry":"week","useLimit":3}`)
	if inv.Role != "editor" || inv.Expiry != "week" {
		t.Errorf("invitation = role %q expiry %q, want editor/week", inv.Role, inv.Expiry)
	}
	if inv.URL == "" || !strings.Contains(inv.URL, "/i/") {
		t.Errorf("invitation url = %q, want a <base>/i/<token> link", inv.URL)
	}
	if inv.Withdrawn || inv.JoinedCount != 0 || len(inv.Joined) != 0 {
		t.Errorf("fresh invitation = withdrawn %v joinedCount %d joined %v, want false/0/[]", inv.Withdrawn, inv.JoinedCount, inv.Joined)
	}
	if inv.UseLimit == nil || *inv.UseLimit != 3 {
		t.Errorf("useLimit = %v, want 3", inv.UseLimit)
	}
	if inv.ExpiresAt == nil {
		t.Error("expiresAt = nil, want a resolved instant for a week")
	}
	// The stored token is the hash of the raw token, never the raw token itself.
	raw := tokenFromURL(t, inv.URL)
	if n := e.countRows(t, `SELECT count(*) FROM invitations WHERE id = $1 AND token = $2`, inv.ID, hashToken(raw)); n != 1 {
		t.Errorf("invitation row with hashed token = %d, want 1", n)
	}
	if n := e.countRows(t, `SELECT count(*) FROM invitations WHERE token = $1`, raw); n != 0 {
		t.Errorf("the raw token is stored (%d rows); it must be stored only hashed", n)
	}
	if n := e.countRows(t, `SELECT count(*) FROM invitations WHERE id = $1 AND uses_remaining = 3 AND expires_at IS NOT NULL`, inv.ID); n != 1 {
		t.Errorf("invitation row with uses_remaining=3 and a resolved expiry = %d, want 1", n)
	}

	// until-withdrawn resolves to a NULL expiry; an absent useLimit to NULL.
	open := e.createInvitation(t, ownerCookie, b.ID, `{"role":"reader","expiry":"until-withdrawn"}`)
	if open.ExpiresAt != nil {
		t.Errorf("until-withdrawn expiresAt = %v, want null", open.ExpiresAt)
	}
	if open.UseLimit != nil {
		t.Errorf("absent useLimit = %v, want null", open.UseLimit)
	}

	// Gates and validations.
	memberID, memberCookie := e.registerNewAccount(t)
	e.insertMembership(t, b.ID, memberID, "editor")
	if resp, _ := e.do(t, http.MethodPost, "/api/books/"+b.ID+"/invitations", memberCookie, []byte(`{"role":"reader"}`)); resp.StatusCode != http.StatusForbidden {
		t.Errorf("non-owner member create: status = %d, want 403", resp.StatusCode)
	}
	_, strangerCookie := e.registerNewAccount(t)
	if resp, _ := e.do(t, http.MethodPost, "/api/books/"+b.ID+"/invitations", strangerCookie, []byte(`{"role":"reader"}`)); resp.StatusCode != http.StatusNotFound {
		t.Errorf("stranger create: status = %d, want 404", resp.StatusCode)
	}
	if resp, _ := e.do(t, http.MethodPost, "/api/books/not-a-uuid/invitations", ownerCookie, []byte(`{"role":"reader"}`)); resp.StatusCode != http.StatusNotFound {
		t.Errorf("non-UUID book create: status = %d, want 404", resp.StatusCode)
	}
	if resp, _ := e.do(t, http.MethodPost, "/api/books/"+b.ID+"/invitations", ownerCookie, []byte(`{"role":"owner"}`)); resp.StatusCode != http.StatusBadRequest {
		t.Errorf("owner-role invitation: status = %d, want 400", resp.StatusCode)
	}
	if resp, _ := e.do(t, http.MethodPost, "/api/books/"+b.ID+"/invitations", ownerCookie, []byte(`{"role":"reader","useLimit":0}`)); resp.StatusCode != http.StatusBadRequest {
		t.Errorf("useLimit below 1: status = %d, want 400", resp.StatusCode)
	}
	if resp, _ := e.do(t, http.MethodPost, "/api/books/"+b.ID+"/invitations", "", []byte(`{"role":"reader"}`)); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("no session create: status = %d, want 401", resp.StatusCode)
	}
}

// TestListInvitations pins acceptance #2 (workflow 10 lines 54-55, 71-72;
// contract listInvitations): the owner's list carries each invitation with its
// joiners and withdrawn flag and omits the url; the gates answer as declared.
func TestListInvitations(t *testing.T) {
	e := newBooksEnv(t)
	_, ownerCookie := e.registerNewAccount(t)
	b := e.createBook(t, ownerCookie, "Listed Book")
	inv := e.createInvitation(t, ownerCookie, b.ID, `{"role":"reader","useLimit":2}`)

	// A second account joins through it, so the list shows a joiner.
	joinerID, joinerCookie := e.registerNewAccount(t)
	if resp, body := e.acceptInvitation(t, joinerCookie, tokenFromURL(t, inv.URL)); resp.StatusCode != http.StatusOK {
		t.Fatalf("accept: status = %d, want 200; body=%s", resp.StatusCode, body)
	}

	resp, body := e.do(t, http.MethodGet, "/api/books/"+b.ID+"/invitations", ownerCookie, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("list invitations: status = %d, want 200; body=%s", resp.StatusCode, body)
	}
	if err := e.contract.Validate("listInvitations", apicontract.Response, "200", body); err != nil {
		t.Errorf("listInvitations response does not conform: %v", err)
	}
	// The url is unrecoverable once stored (Decisions): it never appears in the list.
	if strings.Contains(string(body), "/i/") {
		t.Errorf("listInvitations leaked a link: %s", body)
	}
	var list invitationListJSON
	if err := json.Unmarshal(body, &list); err != nil {
		t.Fatalf("decoding invitation list: %v", err)
	}
	if len(list.Invitations) != 1 {
		t.Fatalf("invitations = %d, want 1", len(list.Invitations))
	}
	got := list.Invitations[0]
	if got.URL != "" {
		t.Errorf("listed invitation url = %q, want omitted", got.URL)
	}
	if got.JoinedCount != 1 || len(got.Joined) != 1 || got.Joined[0].UserID != joinerID {
		t.Errorf("joined = %+v (count %d), want the one joiner %s", got.Joined, got.JoinedCount, joinerID)
	}

	// Gates.
	memberID, memberCookie := e.registerNewAccount(t)
	e.insertMembership(t, b.ID, memberID, "reader")
	if resp, _ := e.do(t, http.MethodGet, "/api/books/"+b.ID+"/invitations", memberCookie, nil); resp.StatusCode != http.StatusForbidden {
		t.Errorf("non-owner member list: status = %d, want 403", resp.StatusCode)
	}
	_, strangerCookie := e.registerNewAccount(t)
	if resp, _ := e.do(t, http.MethodGet, "/api/books/"+b.ID+"/invitations", strangerCookie, nil); resp.StatusCode != http.StatusNotFound {
		t.Errorf("stranger list: status = %d, want 404", resp.StatusCode)
	}
	if resp, _ := e.do(t, http.MethodGet, "/api/books/"+b.ID+"/invitations", "", nil); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("no session list: status = %d, want 401", resp.StatusCode)
	}
}

// TestWithdrawInvitation pins acceptance #3 (workflow 10 lines 52-53; contract
// withdrawInvitation): withdraw stops new joins (409 invitation_withdrawn) while
// those who joined stay members; the gates answer as declared.
func TestWithdrawInvitation(t *testing.T) {
	e := newBooksEnv(t)
	_, ownerCookie := e.registerNewAccount(t)
	b := e.createBook(t, ownerCookie, "Withdrawable")
	inv := e.createInvitation(t, ownerCookie, b.ID, `{"role":"editor"}`)
	token := tokenFromURL(t, inv.URL)

	// Someone joins before the withdrawal; they must stay a member.
	joinerID, joinerCookie := e.registerNewAccount(t)
	if resp, _ := e.acceptInvitation(t, joinerCookie, token); resp.StatusCode != http.StatusOK {
		t.Fatalf("accept before withdraw: status = %d, want 200", resp.StatusCode)
	}

	// Withdraw.
	if resp, _ := e.do(t, http.MethodDelete, "/api/books/"+b.ID+"/invitations/"+inv.ID, ownerCookie, nil); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("withdraw: status = %d, want 204", resp.StatusCode)
	}
	if n := e.countRows(t, `SELECT count(*) FROM invitations WHERE id = $1 AND withdrawn_at IS NOT NULL`, inv.ID); n != 1 {
		t.Errorf("withdrawn_at set rows = %d, want 1", n)
	}

	// A new account can no longer join; the earlier joiner is still a member.
	_, latecomerCookie := e.registerNewAccount(t)
	resp, body := e.acceptInvitation(t, latecomerCookie, token)
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("accept after withdraw: status = %d, want 409; body=%s", resp.StatusCode, body)
	}
	assertConflictCode(t, e, body, "invitation_withdrawn")
	if n := e.countRows(t, `SELECT count(*) FROM memberships WHERE book_id = $1 AND account_id = $2`, b.ID, joinerID); n != 1 {
		t.Errorf("earlier joiner membership after withdraw = %d, want it kept (1)", n)
	}

	// Gates: non-owner 403, unknown invitation on the owned book 404.
	memberID, memberCookie := e.registerNewAccount(t)
	e.insertMembership(t, b.ID, memberID, "reader")
	if resp, _ := e.do(t, http.MethodDelete, "/api/books/"+b.ID+"/invitations/"+inv.ID, memberCookie, nil); resp.StatusCode != http.StatusForbidden {
		t.Errorf("non-owner withdraw: status = %d, want 403", resp.StatusCode)
	}
	unknown := "00000000-0000-0000-0000-000000000000"
	if resp, _ := e.do(t, http.MethodDelete, "/api/books/"+b.ID+"/invitations/"+unknown, ownerCookie, nil); resp.StatusCode != http.StatusNotFound {
		t.Errorf("unknown invitation withdraw: status = %d, want 404", resp.StatusCode)
	}
}

// assertConflictCode decodes a 409 body, validates it against the contract, and
// checks its machine-readable code.
func assertConflictCode(t *testing.T, e *booksEnv, body []byte, wantCode string) {
	t.Helper()
	if err := e.contract.Validate("acceptInvitation", apicontract.Response, "409", body); err != nil {
		t.Errorf("409 response does not conform: %v", err)
	}
	var er errorBody
	if err := json.Unmarshal(body, &er); err != nil {
		t.Fatalf("decoding 409 body: %v", err)
	}
	if er.Code != wantCode {
		t.Errorf("409 code = %q, want %q", er.Code, wantCode)
	}
}

// TestAcceptInvitation pins acceptance #4 (workflow 10 lines 56-61; contract
// acceptInvitation): accept admits the caller at the invitation's role, records
// a join, decrements a finite use, and returns the Book; a repeat accept is
// idempotent; the four 409 reasons each fire with the right code; an unknown
// token is 404 and no session is 401.
func TestAcceptInvitation(t *testing.T) {
	e := newBooksEnv(t)
	_, ownerCookie := e.registerNewAccount(t)
	b := e.createBook(t, ownerCookie, "Acceptable")
	seedREADME(t, e.repoPath(b.ID), "Acceptable")
	inv := e.createInvitation(t, ownerCookie, b.ID, `{"role":"editor","useLimit":2}`)
	token := tokenFromURL(t, inv.URL)

	joinerID, joinerCookie := e.registerNewAccount(t)
	resp, body := e.acceptInvitation(t, joinerCookie, token)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("accept: status = %d, want 200; body=%s", resp.StatusCode, body)
	}
	if err := e.contract.Validate("acceptInvitation", apicontract.Response, "200", body); err != nil {
		t.Errorf("acceptInvitation response does not conform: %v", err)
	}
	var book bookJSON
	if err := json.Unmarshal(body, &book); err != nil {
		t.Fatalf("decoding book: %v", err)
	}
	if book.ID != b.ID || book.Role != "editor" || book.Title != "Acceptable" {
		t.Errorf("accepted book = {id %s role %s title %q}, want {%s editor Acceptable}", book.ID, book.Role, book.Title, b.ID)
	}
	if n := e.countRows(t, `SELECT count(*) FROM memberships WHERE book_id = $1 AND account_id = $2 AND role = 'editor'`, b.ID, joinerID); n != 1 {
		t.Errorf("membership row = %d, want 1 editor", n)
	}
	if n := e.countRows(t, `SELECT count(*) FROM invitation_joins WHERE invitation_id = $1 AND account_id = $2`, inv.ID, joinerID); n != 1 {
		t.Errorf("invitation_joins row = %d, want 1", n)
	}
	if u := e.invitationUsesRemaining(t, inv.ID); u == nil || *u != 1 {
		t.Errorf("uses_remaining after one accept = %v, want 1", u)
	}

	// Idempotent: a repeat accept by the same account makes no second membership
	// and consumes no second use.
	if resp, _ := e.acceptInvitation(t, joinerCookie, token); resp.StatusCode != http.StatusOK {
		t.Errorf("re-accept: status = %d, want 200", resp.StatusCode)
	}
	if n := e.countRows(t, `SELECT count(*) FROM memberships WHERE book_id = $1 AND account_id = $2`, b.ID, joinerID); n != 1 {
		t.Errorf("membership rows after re-accept = %d, want still 1", n)
	}
	if u := e.invitationUsesRemaining(t, inv.ID); u == nil || *u != 1 {
		t.Errorf("uses_remaining after re-accept = %v, want still 1", u)
	}

	// Unknown token -> 404; no session -> 401.
	if resp, _ := e.acceptInvitation(t, joinerCookie, "not-a-real-token"); resp.StatusCode != http.StatusNotFound {
		t.Errorf("unknown token accept: status = %d, want 404", resp.StatusCode)
	}
	if resp, _ := e.acceptInvitation(t, "", token); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("no session accept: status = %d, want 401", resp.StatusCode)
	}

	// The four 409 reasons, each with its code.
	// expired: a resolved expiry moved into the past.
	expInv := e.createInvitation(t, ownerCookie, b.ID, `{"role":"reader","expiry":"day"}`)
	if _, err := e.pool.Exec(context.Background(), `UPDATE invitations SET expires_at = now() - interval '1 hour' WHERE id = $1`, expInv.ID); err != nil {
		t.Fatalf("age the invitation: %v", err)
	}
	_, expiredCookie := e.registerNewAccount(t)
	r, bd := e.acceptInvitation(t, expiredCookie, tokenFromURL(t, expInv.URL))
	if r.StatusCode != http.StatusConflict {
		t.Fatalf("expired accept: status = %d, want 409", r.StatusCode)
	}
	assertConflictCode(t, e, bd, "invitation_expired")

	// exhausted: a one-use invitation already used.
	oneInv := e.createInvitation(t, ownerCookie, b.ID, `{"role":"reader","useLimit":1}`)
	oneTok := tokenFromURL(t, oneInv.URL)
	_, firstCookie := e.registerNewAccount(t)
	if resp, _ := e.acceptInvitation(t, firstCookie, oneTok); resp.StatusCode != http.StatusOK {
		t.Fatalf("first use of one-use invitation: status = %d, want 200", resp.StatusCode)
	}
	_, secondCookie := e.registerNewAccount(t)
	r, bd = e.acceptInvitation(t, secondCookie, oneTok)
	if r.StatusCode != http.StatusConflict {
		t.Fatalf("exhausted accept: status = %d, want 409", r.StatusCode)
	}
	assertConflictCode(t, e, bd, "invitation_exhausted")
}

// TestFiftiethJoinsFiftyFirstRefused pins the cap (DIRECTION §3.3 lines 175-176;
// workflow 10 lines 28-38; contract MemberList): with 49 members seeded, the
// account that takes the book to fifty succeeds and the next is refused 409
// book_full, and the count reads 50 of 50.
func TestFiftiethJoinsFiftyFirstRefused(t *testing.T) {
	e := newBooksEnv(t)
	_, ownerCookie := e.registerNewAccount(t)
	b := e.createBook(t, ownerCookie, "Nearly Full")
	e.seedMembers(t, b.ID, 49)
	inv := e.createInvitation(t, ownerCookie, b.ID, `{"role":"reader"}`)
	token := tokenFromURL(t, inv.URL)

	// The fiftieth joins.
	_, fiftiethCookie := e.registerNewAccount(t)
	if resp, body := e.acceptInvitation(t, fiftiethCookie, token); resp.StatusCode != http.StatusOK {
		t.Fatalf("fiftieth accept: status = %d, want 200; body=%s", resp.StatusCode, body)
	}

	// The fifty-first is refused.
	_, overCookie := e.registerNewAccount(t)
	resp, body := e.acceptInvitation(t, overCookie, token)
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("fifty-first accept: status = %d, want 409; body=%s", resp.StatusCode, body)
	}
	assertConflictCode(t, e, body, "book_full")

	// The owner's member count reads 50 of 50.
	mResp, mBody := e.do(t, http.MethodGet, "/api/books/"+b.ID+"/members", ownerCookie, nil)
	if mResp.StatusCode != http.StatusOK {
		t.Fatalf("list members: status = %d, want 200", mResp.StatusCode)
	}
	if err := e.contract.Validate("listMembers", apicontract.Response, "200", mBody); err != nil {
		t.Errorf("listMembers response does not conform: %v", err)
	}
	var ml memberListJSON
	if err := json.Unmarshal(mBody, &ml); err != nil {
		t.Fatalf("decoding member list: %v", err)
	}
	if ml.Count != 50 || ml.Limit != 50 {
		t.Errorf("member count/limit = %d/%d, want 50/50", ml.Count, ml.Limit)
	}
}

// --- behavior: members -------------------------------------------------------

// TestListMembersWhoSeesWhom pins acceptance #5 (workflow 10 lines 71-75;
// contract listMembers): the owner sees every member, a non-owner sees the
// owner and the editors only, and count/limit are the true numbers for both.
func TestListMembersWhoSeesWhom(t *testing.T) {
	e := newBooksEnv(t)
	ownerID, ownerCookie := e.registerNewAccount(t)
	b := e.createBook(t, ownerCookie, "Visible Book")

	ed1 := e.insertAccount(t)
	ed2 := e.insertAccount(t)
	e.insertMembership(t, b.ID, ed1, "editor")
	e.insertMembership(t, b.ID, ed2, "editor")
	rd1 := e.insertAccount(t)
	e.insertMembership(t, b.ID, rd1, "reader")
	readerID, readerCookie := e.registerNewAccount(t)
	e.insertMembership(t, b.ID, readerID, "reader")

	// The owner sees all five members (owner + 2 editors + 2 readers), count 4.
	resp, body := e.do(t, http.MethodGet, "/api/books/"+b.ID+"/members", ownerCookie, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("owner list members: status = %d, want 200; body=%s", resp.StatusCode, body)
	}
	if err := e.contract.Validate("listMembers", apicontract.Response, "200", body); err != nil {
		t.Errorf("listMembers (owner) does not conform: %v", err)
	}
	ownerView := decodeMemberList(t, body)
	if ownerView.Count != 4 || ownerView.Limit != 50 {
		t.Errorf("owner view count/limit = %d/%d, want 4/50", ownerView.Count, ownerView.Limit)
	}
	if len(ownerView.Members) != 5 {
		t.Errorf("owner sees %d member entries, want 5 (owner + 4)", len(ownerView.Members))
	}
	if roleOf(ownerView, ownerID) != "owner" {
		t.Errorf("owner entry role = %q, want owner", roleOf(ownerView, ownerID))
	}

	// A reader sees the owner and the two editors only — no reader, not even
	// itself; count stays the true 4.
	resp, body = e.do(t, http.MethodGet, "/api/books/"+b.ID+"/members", readerCookie, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("reader list members: status = %d, want 200", resp.StatusCode)
	}
	if err := e.contract.Validate("listMembers", apicontract.Response, "200", body); err != nil {
		t.Errorf("listMembers (reader) does not conform: %v", err)
	}
	readerView := decodeMemberList(t, body)
	if readerView.Count != 4 {
		t.Errorf("reader view count = %d, want 4", readerView.Count)
	}
	if len(readerView.Members) != 3 {
		t.Errorf("reader sees %d member entries, want 3 (owner + 2 editors)", len(readerView.Members))
	}
	for _, m := range readerView.Members {
		if m.Role == "reader" {
			t.Errorf("reader view leaked a reader (%s); readers must be hidden", m.UserID)
		}
	}

	// A stranger -> 404; no session -> 401.
	_, strangerCookie := e.registerNewAccount(t)
	if resp, _ := e.do(t, http.MethodGet, "/api/books/"+b.ID+"/members", strangerCookie, nil); resp.StatusCode != http.StatusNotFound {
		t.Errorf("stranger list members: status = %d, want 404", resp.StatusCode)
	}
	if resp, _ := e.do(t, http.MethodGet, "/api/books/"+b.ID+"/members", "", nil); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("no session list members: status = %d, want 401", resp.StatusCode)
	}
}

func decodeMemberList(t *testing.T, body []byte) memberListJSON {
	t.Helper()
	var ml memberListJSON
	if err := json.Unmarshal(body, &ml); err != nil {
		t.Fatalf("decoding member list: %v", err)
	}
	return ml
}

func roleOf(ml memberListJSON, userID string) string {
	for _, m := range ml.Members {
		if m.UserID == userID {
			return m.Role
		}
	}
	return ""
}

// TestChangeMemberRole pins acceptance #6 (workflow 10 lines 63-69; contract
// changeMemberRole): the owner moves a member between editor and reader; a
// non-owner is 403, a non-member userId 404, a bad role 400.
func TestChangeMemberRole(t *testing.T) {
	e := newBooksEnv(t)
	_, ownerCookie := e.registerNewAccount(t)
	b := e.createBook(t, ownerCookie, "Role Book")
	memberID, _ := e.registerNewAccount(t)
	e.insertMembership(t, b.ID, memberID, "editor")

	// editor -> reader -> editor.
	resp, body := e.do(t, http.MethodPatch, "/api/books/"+b.ID+"/members/"+memberID, ownerCookie, []byte(`{"role":"reader"}`))
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("change to reader: status = %d, want 200; body=%s", resp.StatusCode, body)
	}
	if err := e.contract.Validate("changeMemberRole", apicontract.Response, "200", body); err != nil {
		t.Errorf("changeMemberRole response does not conform: %v", err)
	}
	var m memberJSON
	if err := json.Unmarshal(body, &m); err != nil {
		t.Fatalf("decoding member: %v", err)
	}
	if m.UserID != memberID || m.Role != "reader" {
		t.Errorf("changed member = {%s %s}, want {%s reader}", m.UserID, m.Role, memberID)
	}
	if n := e.countRows(t, `SELECT count(*) FROM memberships WHERE book_id = $1 AND account_id = $2 AND role = 'reader'`, b.ID, memberID); n != 1 {
		t.Errorf("membership role after change = not reader (%d rows)", n)
	}
	if resp, _ := e.do(t, http.MethodPatch, "/api/books/"+b.ID+"/members/"+memberID, ownerCookie, []byte(`{"role":"editor"}`)); resp.StatusCode != http.StatusOK {
		t.Errorf("change back to editor: status = %d, want 200", resp.StatusCode)
	}

	// Gates.
	otherID, otherCookie := e.registerNewAccount(t)
	e.insertMembership(t, b.ID, otherID, "reader")
	if resp, _ := e.do(t, http.MethodPatch, "/api/books/"+b.ID+"/members/"+memberID, otherCookie, []byte(`{"role":"reader"}`)); resp.StatusCode != http.StatusForbidden {
		t.Errorf("non-owner change: status = %d, want 403", resp.StatusCode)
	}
	unknown := "00000000-0000-0000-0000-000000000000"
	if resp, _ := e.do(t, http.MethodPatch, "/api/books/"+b.ID+"/members/"+unknown, ownerCookie, []byte(`{"role":"reader"}`)); resp.StatusCode != http.StatusNotFound {
		t.Errorf("non-member userId change: status = %d, want 404", resp.StatusCode)
	}
	if resp, _ := e.do(t, http.MethodPatch, "/api/books/"+b.ID+"/members/"+memberID, ownerCookie, []byte(`{"role":"owner"}`)); resp.StatusCode != http.StatusBadRequest {
		t.Errorf("owner-role change: status = %d, want 400", resp.StatusCode)
	}
}

// TestRemoveMember pins acceptance #7 (workflow 10 lines 77-85; contract
// removeMember): the owner's remove deletes the membership and the book then
// resolves inaccessible to that account; a non-owner is 403, a non-member 404.
func TestRemoveMember(t *testing.T) {
	e := newBooksEnv(t)
	_, ownerCookie := e.registerNewAccount(t)
	b := e.createBook(t, ownerCookie, "Removal Book")
	memberID, memberCookie := e.registerNewAccount(t)
	e.insertMembership(t, b.ID, memberID, "editor")

	// The member can see the book before removal.
	if _, ok := bookByID(e.listBooks(t, memberCookie), b.ID); !ok {
		t.Fatalf("member cannot see the shared book before removal")
	}

	// A non-owner cannot remove.
	otherID, otherCookie := e.registerNewAccount(t)
	e.insertMembership(t, b.ID, otherID, "reader")
	if resp, _ := e.do(t, http.MethodDelete, "/api/books/"+b.ID+"/members/"+memberID, otherCookie, nil); resp.StatusCode != http.StatusForbidden {
		t.Errorf("non-owner remove: status = %d, want 403", resp.StatusCode)
	}

	// The owner removes the member.
	if resp, _ := e.do(t, http.MethodDelete, "/api/books/"+b.ID+"/members/"+memberID, ownerCookie, nil); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("owner remove: status = %d, want 204", resp.StatusCode)
	}
	if n := e.countRows(t, `SELECT count(*) FROM memberships WHERE book_id = $1 AND account_id = $2`, b.ID, memberID); n != 0 {
		t.Errorf("membership rows after remove = %d, want 0", n)
	}
	// The book is now inaccessible to that account: its list omits it.
	if _, ok := bookByID(e.listBooks(t, memberCookie), b.ID); ok {
		t.Errorf("removed member still sees the book")
	}

	// A second remove (no membership now) -> 404.
	if resp, _ := e.do(t, http.MethodDelete, "/api/books/"+b.ID+"/members/"+memberID, ownerCookie, nil); resp.StatusCode != http.StatusNotFound {
		t.Errorf("remove of non-member userId: status = %d, want 404", resp.StatusCode)
	}
}
