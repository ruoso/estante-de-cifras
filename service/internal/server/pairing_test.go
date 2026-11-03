package server

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	apicontract "estantedecifras.app/api"
	"estantedecifras.app/service/internal/pairing"
	"estantedecifras.app/service/internal/ratelimit"
)

// These behavior tests drive the pairing handlers (reader.device_pairing;
// docs/remarkable-reader.md §5.1; workflow 13 §Pairing a reMarkable) through
// the real Handler against the compose Postgres, every response validated
// against the contract. A device begins with no session and polls with its
// token; a passkey-registered account approves the code. Expiry is driven by
// moving the pairing's timestamps back in Postgres (the clock the handlers
// compare against), as the invitation and email-link tests do. A standalone
// `go test` with the DSN unset skips (migratedServerSchema → envDSN).

var shownCode = regexp.MustCompile(`^[2-9A-HJKMNP-Z]{3}-[2-9A-HJKMNP-Z]{3}$`)

type pollJSON struct {
	Status  string `json:"status"`
	Session string `json:"session"`
}

// validate checks a response body against the contract for an operation and
// status, failing the test on a mismatch.
func (e *passkeyEnv) validate(t *testing.T, op string, resp *http.Response, body []byte) {
	t.Helper()
	if err := e.contract.Validate(op, apicontract.Response, strconv.Itoa(resp.StatusCode), body); err != nil {
		t.Errorf("%s %d does not conform to the contract: %v\nbody=%s", op, resp.StatusCode, err, body)
	}
}

// beginPairing begins a pairing (from ip, when given, via X-Forwarded-For),
// asserting 201 and conformance.
func (e *passkeyEnv) beginPairing(t *testing.T, ip string) devicePairingJSON {
	t.Helper()
	resp, body := e.doXFF(t, http.MethodPost, "/api/devices/pair/begin", "", ip, nil)
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("beginDevicePairing: status = %d, want 201; body=%s", resp.StatusCode, body)
	}
	e.validate(t, "beginDevicePairing", resp, body)
	var p devicePairingJSON
	if err := json.Unmarshal(body, &p); err != nil {
		t.Fatalf("decoding DevicePairing: %v", err)
	}
	return p
}

func (e *passkeyEnv) approvePair(t *testing.T, cookie, code string) (*http.Response, []byte) {
	t.Helper()
	resp, body := e.do(t, http.MethodPost, "/api/devices/pair/approve", cookie, []byte(`{"code":`+mustQuote(code)+`}`))
	if resp.StatusCode != http.StatusNoContent {
		e.validate(t, "approveDevicePairing", resp, body)
	}
	return resp, body
}

func (e *passkeyEnv) pollPair(t *testing.T, ip, token string) (*http.Response, []byte, pollJSON) {
	t.Helper()
	resp, body := e.doXFF(t, http.MethodPost, "/api/devices/pair/poll", "", ip, []byte(`{"pollToken":`+mustQuote(token)+`}`))
	e.validate(t, "pollDevicePairing", resp, body)
	var p pollJSON
	if resp.StatusCode == http.StatusOK {
		if err := json.Unmarshal(body, &p); err != nil {
			t.Fatalf("decoding DevicePairingPoll: %v", err)
		}
	}
	return resp, body, p
}

// wantError asserts a status and an Error code.
func wantError(t *testing.T, what string, resp *http.Response, body []byte, status int, code string) {
	t.Helper()
	if resp.StatusCode != status {
		t.Fatalf("%s: status = %d, want %d; body=%s", what, resp.StatusCode, status, body)
	}
	var eb errorBody
	if err := json.Unmarshal(body, &eb); err != nil {
		t.Fatalf("%s: decoding Error: %v; body=%s", what, err, body)
	}
	if eb.Code != code {
		t.Errorf("%s: code = %q, want %q", what, eb.Code, code)
	}
}

// pairDevice runs begin → approve → poll and returns the delivered read-only
// session (the device's cookie value).
func (e *passkeyEnv) pairDevice(t *testing.T, approverCookie string) string {
	t.Helper()
	p := e.beginPairing(t, "")
	if resp, body := e.approvePair(t, approverCookie, p.Code); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("approve: status = %d, want 204; body=%s", resp.StatusCode, body)
	}
	resp, body, got := e.pollPair(t, "", p.PollToken)
	if resp.StatusCode != http.StatusOK || got.Status != "approved" || got.Session == "" {
		t.Fatalf("poll after approve: %d %s, want approved with a session", resp.StatusCode, body)
	}
	return got.Session
}

func codeHash(t *testing.T, shown string) string {
	t.Helper()
	raw, ok := pairing.Normalize(shown)
	if !ok {
		t.Fatalf("code %q does not normalise", shown)
	}
	return hashToken(raw)
}

func (e *passkeyEnv) execSQL(t *testing.T, sql string, args ...any) {
	t.Helper()
	if _, err := e.pool.Exec(context.Background(), sql, args...); err != nil {
		t.Fatalf("exec (%s): %v", sql, err)
	}
}

// TestPairURLKeepsHost pins the address a code is typed at: the public base,
// www. kept (the bare domain's forwarding 404s every path), plus /pair.
func TestPairURLKeepsHost(t *testing.T) {
	for base, want := range map[string]string{
		"https://www.estantedecifras.app":  "https://www.estantedecifras.app/pair",
		"https://www.estantedecifras.app/": "https://www.estantedecifras.app/pair",
		"https://estantedecifras.app":      "https://estantedecifras.app/pair",
		"http://127.0.0.1:8080":            "http://127.0.0.1:8080/pair",
	} {
		if got := pairURL(base); got != want {
			t.Errorf("pairURL(%q) = %q, want %q", base, got, want)
		}
	}
}

// TestPairBeginGivesCodeURLTokenExpiry pins begin (remarkable-reader.md §5.1;
// Constraints 2, 5, 10): 201 with a three-dash-three code, the public base's
// /pair (www. kept), a poll token and an expiry ten minutes on; the
// database holds only hashes.
func TestPairBeginGivesCodeURLTokenExpiry(t *testing.T) {
	e := newBooksEnvWith(t, func(api *APIDeps) { api.PublicBaseURL = "https://www.estante.test" })
	before := time.Now()
	p := e.beginPairing(t, "")
	if !shownCode.MatchString(p.Code) {
		t.Errorf("code = %q, want XXX-XXX of the alphabet", p.Code)
	}
	if p.URL != "https://www.estante.test/pair" {
		t.Errorf("url = %q, want https://www.estante.test/pair", p.URL)
	}
	if len(p.PollToken) < 32 {
		t.Errorf("pollToken %q is too short to be 256 bits", p.PollToken)
	}
	exp, err := time.Parse(time.RFC3339, p.ExpiresAt)
	if err != nil {
		t.Fatalf("expiresAt %q: %v", p.ExpiresAt, err)
	}
	if d := exp.Sub(before); d < 9*time.Minute || d > 11*time.Minute {
		t.Errorf("expiresAt is %s after begin, want ten minutes", d)
	}

	raw, _ := pairing.Normalize(p.Code)
	if n := e.countRows(t, `SELECT count(*) FROM device_pairings WHERE code_hash = $1 AND poll_token_hash = $2`,
		hashToken(raw), hashToken(p.PollToken)); n != 1 {
		t.Errorf("no row holds the code's and token's hashes (%d rows)", n)
	}
	for _, clear := range []string{raw, p.Code, p.PollToken} {
		if n := e.countRows(t, `SELECT count(*) FROM device_pairings WHERE code_hash = $1 OR poll_token_hash = $1`, clear); n != 0 {
			t.Errorf("the database holds a secret in the clear")
		}
	}
}

// TestPairPollPendingThenApprovedOnce pins §5.1 "receives a session" — once:
// pending before approve, approved with the session after, then 404.
func TestPairPollPendingThenApprovedOnce(t *testing.T) {
	e := newBooksEnv(t)
	_, cookie := e.registerNewAccount(t)
	p := e.beginPairing(t, "")

	if resp, body, got := e.pollPair(t, "", p.PollToken); resp.StatusCode != http.StatusOK || got.Status != "pending" {
		t.Fatalf("poll before approve: %d %s, want 200 pending", resp.StatusCode, body)
	}
	if resp, body := e.approvePair(t, cookie, p.Code); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("approve: %d %s, want 204", resp.StatusCode, body)
	}
	resp, body, got := e.pollPair(t, "", p.PollToken)
	if resp.StatusCode != http.StatusOK || got.Status != "approved" || got.Session == "" {
		t.Fatalf("poll after approve: %d %s, want approved with a session", resp.StatusCode, body)
	}
	// The session is the account's: it reads the account's home book.
	if r, b := e.do(t, http.MethodGet, "/api/account/home-book", got.Session, nil); r.StatusCode != http.StatusOK {
		t.Errorf("home-book with the delivered session: %d %s, want 200", r.StatusCode, b)
	}
	resp, body, _ = e.pollPair(t, "", p.PollToken)
	wantError(t, "a second poll", resp, body, http.StatusNotFound, "pair_token_unknown")

	resp, body, _ = e.pollPair(t, "", "never-given-out")
	wantError(t, "an unknown token", resp, body, http.StatusNotFound, "pair_token_unknown")
}

// TestPairApproveRefusals pins the four refusals told apart (pair_design
// L361–364; workflow 13 L404–416).
func TestPairApproveRefusals(t *testing.T) {
	e := newBooksEnv(t)
	_, ana := e.registerNewAccount(t)
	_, bia := e.registerNewAccount(t)

	// unknown: a well-formed code no device is showing.
	resp, body := e.approvePair(t, ana, "KQ7-4TM")
	wantError(t, "an unknown code", resp, body, http.StatusNotFound, "pair_code_unknown")
	// malformed: answered as unknown.
	for _, bad := range []string{"KQ7-4T", "KQ7-4TMX", "KQ7-4T0", ""} {
		resp, body = e.approvePair(t, ana, bad)
		wantError(t, "a malformed code "+bad, resp, body, http.StatusNotFound, "pair_code_unknown")
	}

	// expired: past ten minutes.
	old := e.beginPairing(t, "")
	e.execSQL(t, `UPDATE device_pairings SET expires_at = now() - interval '1 second' WHERE code_hash = $1`, codeHash(t, old.Code))
	resp, body = e.approvePair(t, ana, old.Code)
	wantError(t, "an expired code", resp, body, http.StatusGone, "pair_code_expired")

	// used: again by the same account, and by a second account.
	p := e.beginPairing(t, "")
	if resp, body := e.approvePair(t, ana, p.Code); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("first approve: %d %s, want 204", resp.StatusCode, body)
	}
	resp, body = e.approvePair(t, ana, p.Code)
	wantError(t, "a reused code, same account", resp, body, http.StatusConflict, "pair_code_used")
	resp, body = e.approvePair(t, bia, p.Code)
	wantError(t, "a reused code, another account", resp, body, http.StatusConflict, "pair_code_used")

	// no session: 401.
	fresh := e.beginPairing(t, "")
	resp, body = e.approvePair(t, "", fresh.Code)
	wantError(t, "approve with no session", resp, body, http.StatusUnauthorized, "unauthorized")

	if n := e.countRows(t, `SELECT count(*) FROM sessions WHERE kind = 'remarkable'`); n != 1 {
		t.Errorf("%d reader sessions made, want exactly the one approval", n)
	}
}

// TestPairApproveAcceptsAnySpelling pins workflow 13 L387–388.
func TestPairApproveAcceptsAnySpelling(t *testing.T) {
	e := newBooksEnv(t)
	_, cookie := e.registerNewAccount(t)
	for _, spell := range []func(string) string{
		strings.ToLower,
		func(c string) string { return strings.ReplaceAll(c, "-", "") },
		func(c string) string { return "  " + strings.ToLower(strings.ReplaceAll(c, "-", " ")) + " " },
	} {
		p := e.beginPairing(t, "")
		typed := spell(p.Code)
		if resp, body := e.approvePair(t, cookie, typed); resp.StatusCode != http.StatusNoContent {
			t.Errorf("approve %q (shown %s): %d %s, want 204", typed, p.Code, resp.StatusCode, body)
		}
	}
}

// TestPairApproveConcurrent pins Constraint 4: two approvals of one code at
// once — one 204, one 409, one session made.
func TestPairApproveConcurrent(t *testing.T) {
	e := newBooksEnv(t)
	_, ana := e.registerNewAccount(t)
	_, bia := e.registerNewAccount(t)
	p := e.beginPairing(t, "")

	var wg sync.WaitGroup
	statuses := make([]int, 2)
	for i, c := range []string{ana, bia} {
		wg.Add(1)
		go func(i int, c string) {
			defer wg.Done()
			resp, _ := e.approvePair(t, c, p.Code)
			statuses[i] = resp.StatusCode
		}(i, c)
	}
	wg.Wait()
	ok, used := 0, 0
	for _, s := range statuses {
		switch s {
		case http.StatusNoContent:
			ok++
		case http.StatusConflict:
			used++
		}
	}
	if ok != 1 || used != 1 {
		t.Errorf("statuses = %v, want one 204 and one 409", statuses)
	}
	if n := e.countRows(t, `SELECT count(*) FROM sessions WHERE kind = 'remarkable'`); n != 1 {
		t.Errorf("%d reader sessions made, want one", n)
	}
}

// TestPairPollExpired pins Constraint 3: an unapproved code past ten minutes
// polls expired; an approved one not collected within ten minutes of approval
// polls expired and its session is revoked.
func TestPairPollExpired(t *testing.T) {
	e := newBooksEnv(t)
	_, cookie := e.registerNewAccount(t)

	p := e.beginPairing(t, "")
	e.execSQL(t, `UPDATE device_pairings SET expires_at = now() - interval '1 second' WHERE code_hash = $1`, codeHash(t, p.Code))
	if resp, body, got := e.pollPair(t, "", p.PollToken); resp.StatusCode != http.StatusOK || got.Status != "expired" {
		t.Errorf("unapproved past ten minutes: %d %s, want 200 expired", resp.StatusCode, body)
	}

	q := e.beginPairing(t, "")
	if resp, body := e.approvePair(t, cookie, q.Code); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("approve: %d %s", resp.StatusCode, body)
	}
	var sessionID string
	if err := e.pool.QueryRow(context.Background(),
		`SELECT session_id FROM device_pairings WHERE code_hash = $1`, codeHash(t, q.Code)).Scan(&sessionID); err != nil {
		t.Fatalf("reading the pairing's session: %v", err)
	}
	e.execSQL(t, `UPDATE device_pairings SET approved_at = now() - interval '11 minutes', expires_at = now() - interval '5 minutes' WHERE code_hash = $1`, codeHash(t, q.Code))
	if resp, body, got := e.pollPair(t, "", q.PollToken); resp.StatusCode != http.StatusOK || got.Status != "expired" || got.Session != "" {
		t.Errorf("approved, uncollected past ten minutes: %d %s, want 200 expired with no session", resp.StatusCode, body)
	}
	if n := e.countRows(t, `SELECT count(*) FROM sessions WHERE id = $1 AND revoked_at IS NOT NULL`, sessionID); n != 1 {
		t.Error("the uncollected session was not revoked")
	}
	if r, _ := e.do(t, http.MethodGet, "/api/account/home-book", sessionID, nil); r.StatusCode != http.StatusUnauthorized {
		t.Errorf("the uncollected session still reads: %d, want 401", r.StatusCode)
	}
}

// TestPairedSessionListed pins workflow 13 L418–425: the account's list shows
// the reader's row with its kind and read-only mark, no device, not current
// from the approving browser; two pairings are two rows.
func TestPairedSessionListed(t *testing.T) {
	e := newBooksEnv(t)
	_, cookie := e.registerNewAccount(t)
	first := e.pairDevice(t, cookie)
	second := e.pairDevice(t, cookie)

	resp, body := e.do(t, http.MethodGet, "/api/account/sessions", cookie, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("listSessions: %d %s", resp.StatusCode, body)
	}
	e.validate(t, "listSessions", resp, body)
	var list struct {
		Sessions []struct {
			ID       string  `json:"id"`
			Current  bool    `json:"current"`
			Device   *string `json:"device"`
			Kind     *string `json:"kind"`
			ReadOnly *bool   `json:"readOnly"`
		} `json:"sessions"`
	}
	if err := json.Unmarshal(body, &list); err != nil {
		t.Fatal(err)
	}
	readers := map[string]bool{}
	for _, s := range list.Sessions {
		if s.ID == first || s.ID == second {
			readers[s.ID] = true
			if s.Kind == nil || *s.Kind != "remarkable" {
				t.Errorf("reader row kind = %v, want remarkable", s.Kind)
			}
			if s.ReadOnly == nil || !*s.ReadOnly {
				t.Errorf("reader row readOnly = %v, want true", s.ReadOnly)
			}
			if s.Device != nil {
				t.Errorf("reader row device = %q, want none", *s.Device)
			}
			if s.Current {
				t.Error("reader row is current from the approving browser")
			}
		} else {
			if s.Kind != nil || s.ReadOnly != nil {
				t.Errorf("browser row carries kind %v / readOnly %v, want neither", s.Kind, s.ReadOnly)
			}
		}
	}
	if len(readers) != 2 {
		t.Errorf("listed %d reader rows, want two (one per pairing)", len(readers))
	}
}

// TestPairedSessionRevoked pins workflow 13 L431–433: signed out from the
// account, the reader's next request is 401; deleting the account removes it.
func TestPairedSessionRevoked(t *testing.T) {
	e := newBooksEnv(t)
	accountID, cookie := e.registerNewAccount(t)
	reader := e.pairDevice(t, cookie)
	if r, b := e.do(t, http.MethodGet, "/api/account/home-book", reader, nil); r.StatusCode != http.StatusOK {
		t.Fatalf("home-book before revoke: %d %s", r.StatusCode, b)
	}
	if r, b := e.do(t, http.MethodDelete, "/api/account/sessions/"+reader, cookie, nil); r.StatusCode != http.StatusNoContent {
		t.Fatalf("revokeSession: %d %s", r.StatusCode, b)
	}
	r, b := e.do(t, http.MethodGet, "/api/account/home-book", reader, nil)
	wantError(t, "home-book after revoke", r, b, http.StatusUnauthorized, "unauthorized")

	// Account deletion takes the reader's session (and its pairing) with it.
	other := e.pairDevice(t, cookie)
	e.setEmail(t, accountID, "pair-owner@example.test")
	if r, b := e.do(t, http.MethodDelete, "/api/account", cookie, []byte(`{"confirm":"pair-owner@example.test"}`)); r.StatusCode != http.StatusNoContent {
		t.Fatalf("deleteAccount: %d %s", r.StatusCode, b)
	}
	if n := e.countRows(t, `SELECT count(*) FROM sessions WHERE id = $1`, other); n != 0 {
		t.Error("the reader's session outlived the account")
	}
	if n := e.countRows(t, `SELECT count(*) FROM device_pairings WHERE approved_by = $1`, accountID); n != 0 {
		t.Error("the account's pairings outlived it")
	}
	if r, _ := e.do(t, http.MethodGet, "/api/account/home-book", other, nil); r.StatusCode != http.StatusUnauthorized {
		t.Errorf("the reader still reads after account deletion: %d", r.StatusCode)
	}
}

// TestPairRateLimits pins Constraint 9 (workflow 13 *Too many tries*;
// DIRECTION §3.3): begin per IP, approve failures per account, poll per IP.
func TestPairRateLimits(t *testing.T) {
	e, clk := newRateLimitEnv(t, map[ratelimit.RuleID]ratelimit.Rule{
		ratelimit.PairBegin:   {Max: 2, Window: time.Hour},
		ratelimit.PairApprove: {Max: 2, Window: 10 * time.Minute},
		ratelimit.PairPoll:    {Max: 3, Window: time.Minute},
	})

	// begin: per client IP.
	e.beginPairing(t, "203.0.113.1")
	e.beginPairing(t, "203.0.113.1")
	resp, body := e.doXFF(t, http.MethodPost, "/api/devices/pair/begin", "", "203.0.113.1", nil)
	e.assertRateLimited(t, "beginDevicePairing", resp, body)
	p := e.beginPairing(t, "203.0.113.2") // another IP is free

	// poll: per client IP.
	for i := 0; i < 3; i++ {
		if r, b, _ := e.pollPair(t, "203.0.113.3", p.PollToken); r.StatusCode != http.StatusOK {
			t.Fatalf("poll %d: %d %s", i+1, r.StatusCode, b)
		}
	}
	resp, body = e.doXFF(t, http.MethodPost, "/api/devices/pair/poll", "", "203.0.113.3", []byte(`{"pollToken":`+mustQuote(p.PollToken)+`}`))
	e.assertRateLimited(t, "pollDevicePairing", resp, body)

	// approve: failures per account; a success does not count.
	_, ana := e.registerNewAccount(t)
	_, bia := e.registerNewAccount(t)
	if r, b := e.approvePair(t, ana, p.Code); r.StatusCode != http.StatusNoContent {
		t.Fatalf("approve: %d %s", r.StatusCode, b)
	}
	for i := 0; i < 2; i++ {
		r, b := e.approvePair(t, ana, "KQ7-4TM")
		wantError(t, "a failed approve", r, b, http.StatusNotFound, "pair_code_unknown")
	}
	q := e.beginPairing(t, "203.0.113.4")
	resp, body = e.approvePair(t, ana, q.Code)
	e.assertRateLimited(t, "approveDevicePairing", resp, body)
	if r, b := e.approvePair(t, bia, q.Code); r.StatusCode != http.StatusNoContent {
		t.Errorf("another account's approve: %d %s, want 204", r.StatusCode, b)
	}

	clk.advance(time.Hour)
	e.beginPairing(t, "203.0.113.1")
}

// TestPairNeverLogged pins the note's "never logged" (Constraint 5; DIRECTION
// §3.3): after a full begin/approve/poll and every refusal, the log holds
// neither the code (either spelling), the poll token, nor the session id.
func TestPairNeverLogged(t *testing.T) {
	e := newBooksEnv(t)
	_, cookie := e.registerNewAccount(t)

	p := e.beginPairing(t, "")
	e.pollPair(t, "", p.PollToken)
	e.approvePair(t, cookie, strings.ToLower(p.Code))
	_, _, got := e.pollPair(t, "", p.PollToken)
	e.pollPair(t, "", p.PollToken)
	e.approvePair(t, cookie, p.Code)
	e.approvePair(t, cookie, "KQ7-4TM")
	old := e.beginPairing(t, "")
	e.execSQL(t, `UPDATE device_pairings SET expires_at = now() - interval '1 second' WHERE code_hash = $1`, codeHash(t, old.Code))
	e.approvePair(t, cookie, old.Code)
	e.pollPair(t, "", old.PollToken)
	e.approvePair(t, "", old.Code)

	logs := e.logBuf.String()
	if !strings.Contains(logs, "/api/devices/pair/poll") {
		t.Fatalf("expected metadata request lines for the pairing routes:\n%s", logs)
	}
	raw, _ := pairing.Normalize(p.Code)
	oldRaw, _ := pairing.Normalize(old.Code)
	for _, secret := range []string{p.Code, raw, strings.ToLower(p.Code), old.Code, oldRaw, p.PollToken, old.PollToken, got.Session} {
		if secret != "" && strings.Contains(logs, secret) {
			t.Errorf("the log leaked a pairing secret %q", secret)
		}
	}
}
