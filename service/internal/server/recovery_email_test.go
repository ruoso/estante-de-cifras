package server

import (
	"context"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	apicontract "estantedecifras.app/api"
	"estantedecifras.app/service/internal/ratelimit"
	"estantedecifras.app/service/internal/webauthntest"
)

// These behavior tests drive the recovery email (workflow 13 §The recovery
// email; api/openapi.yaml getRecoveryEmail, requestRecoveryEmail,
// confirmRecoveryEmail) through httptest against the compose Postgres
// (ESTANTE_TEST_DATABASE_URL), with a recording Mailer and the passkey ceremony
// standing in for a sign-in. Every response with a body is validated against
// the contract. A standalone `go test` with the DSN unset skips
// (migratedServerSchema → envDSN).

// recoveryEnv is a books env (accounts and sessions by passkey) whose server
// also mails through a recording Mailer under a known link secret.
type recoveryEnv struct {
	*booksEnv
	mailer *recordingMailer
}

func newRecoveryEnv(t *testing.T) *recoveryEnv {
	t.Helper()
	return newRecoveryEnvWith(t, nil)
}

// newRecoveryEnvWith applies tweak to the APIDeps after the mailer and secret
// are wired (the rate-limit test injects a tiny-cap Limiter).
func newRecoveryEnvWith(t *testing.T, tweak func(*APIDeps)) *recoveryEnv {
	t.Helper()
	secret, err := hex.DecodeString(testLinkSecretHex)
	if err != nil {
		t.Fatalf("decoding test secret: %v", err)
	}
	m := &recordingMailer{}
	e := newBooksEnvWith(t, func(api *APIDeps) {
		api.Mailer = m
		api.LinkSecret = secret
		if tweak != nil {
			tweak(api)
		}
	})
	return &recoveryEnv{booksEnv: e, mailer: m}
}

// request POSTs /api/account/recovery-email and returns the response.
func (e *recoveryEnv) request(t *testing.T, cookie, address string) (*http.Response, []byte) {
	t.Helper()
	return e.do(t, http.MethodPost, "/api/account/recovery-email", cookie, []byte(`{"email":`+mustQuote(address)+`}`))
}

// mustRequest asks for a link and asserts the 202, returning the token mailed.
func (e *recoveryEnv) mustRequest(t *testing.T, cookie, address string) string {
	t.Helper()
	before := len(e.mailer.messages())
	resp, body := e.request(t, cookie, address)
	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("requestRecoveryEmail(%s): status = %d, want 202; body=%s", address, resp.StatusCode, body)
	}
	sent := e.mailer.messages()
	if len(sent) != before+1 {
		t.Fatalf("requestRecoveryEmail mailed %d messages, want 1", len(sent)-before)
	}
	last := sent[len(sent)-1]
	if last.Kind != mailRecoveryLink || last.To != strings.ToLower(address) {
		t.Fatalf("mailed %+v, want a recovery link to %s", last, address)
	}
	return recoveryTokenOf(t, last.Link)
}

// recoveryTokenOf takes the token from a mailed /recovery-email/<token> link.
func recoveryTokenOf(t *testing.T, link string) string {
	t.Helper()
	const marker = "/recovery-email/"
	i := strings.Index(link, marker)
	if i < 0 {
		t.Fatalf("mailed link %q has no %q segment", link, marker)
	}
	return link[i+len(marker):]
}

// confirm POSTs /api/recovery-email/confirm with no cookie, as a device that
// opened the mail would, validating any error body against the contract.
func (e *recoveryEnv) confirm(t *testing.T, token string) (*http.Response, []byte) {
	t.Helper()
	resp, body := e.do(t, http.MethodPost, "/api/recovery-email/confirm", "", []byte(`{"token":`+mustQuote(token)+`}`))
	if resp.StatusCode != http.StatusNoContent {
		if err := e.contract.Validate("confirmRecoveryEmail", apicontract.Response, statusString(resp), body); err != nil {
			t.Errorf("confirmRecoveryEmail %d does not conform: %v", resp.StatusCode, err)
		}
	}
	return resp, body
}

// read GETs the recovery email and returns it, validated.
func (e *recoveryEnv) read(t *testing.T, cookie string) (email, pending *string) {
	t.Helper()
	resp, body := e.do(t, http.MethodGet, "/api/account/recovery-email", cookie, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("getRecoveryEmail: status = %d, want 200; body=%s", resp.StatusCode, body)
	}
	if err := e.contract.Validate("getRecoveryEmail", apicontract.Response, "200", body); err != nil {
		t.Errorf("getRecoveryEmail response does not conform: %v", err)
	}
	var got recoveryEmailJSON
	if err := json.Unmarshal(body, &got); err != nil {
		t.Fatalf("decoding RecoveryEmail: %v", err)
	}
	return got.Email, got.Pending
}

func (e *recoveryEnv) accountEmail(t *testing.T, accountID string) *string {
	t.Helper()
	var email *string
	if err := e.pool.QueryRow(context.Background(), `SELECT email FROM accounts WHERE id = $1`, accountID).Scan(&email); err != nil {
		t.Fatalf("reading accounts.email: %v", err)
	}
	return email
}

func statusString(resp *http.Response) string {
	return strconv.Itoa(resp.StatusCode)
}

// freshAuthenticator is a new software authenticator, so the next account
// registered holds its own resident credential (Get answers with the first
// credential an authenticator holds).
func freshAuthenticator() *webauthntest.Authenticator {
	return webauthntest.New(testPkOrigin)
}

func deref(s *string) string {
	if s == nil {
		return "<null>"
	}
	return *s
}

// TestRecoveryEmailSetAndConfirm pins workflow 13 §Setting it and §Confirming
// it ("does not sign in"): the request answers 202 and mails one link while the
// account's email stays NULL and the address shows as pending; the confirm,
// with no cookie, answers 204 and sets no cookie and no session, after which
// the address is the account's email and nothing is pending.
func TestRecoveryEmailSetAndConfirm(t *testing.T) {
	e := newRecoveryEnv(t)
	accountID, cookie := e.registerNewAccount(t)
	const address = "player@estante.test"

	token := e.mustRequest(t, cookie, "Player@Estante.test")
	if email := e.accountEmail(t, accountID); email != nil {
		t.Errorf("accounts.email = %q after the request, want NULL until confirmed", *email)
	}
	if email, pending := e.read(t, cookie); email != nil || deref(pending) != address {
		t.Errorf("before confirm: email=%s pending=%s, want email=<null> pending=%s", deref(email), deref(pending), address)
	}

	sessionsBefore := e.countRows(t, `SELECT count(*) FROM sessions`)
	resp, body := e.confirm(t, token)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("confirm: status = %d, want 204; body=%s", resp.StatusCode, body)
	}
	if h := resp.Header.Get("Set-Cookie"); h != "" {
		t.Errorf("confirm set a cookie %q, want none (it does not sign in)", h)
	}
	if n := e.countRows(t, `SELECT count(*) FROM sessions`); n != sessionsBefore {
		t.Errorf("sessions = %d after confirm, want %d (no new session)", n, sessionsBefore)
	}
	if email, pending := e.read(t, cookie); deref(email) != address || pending != nil {
		t.Errorf("after confirm: email=%s pending=%s, want email=%s pending=<null>", deref(email), deref(pending), address)
	}
}

// TestRecoveryEmailRequestReplacesEarlierLink pins that a new request replaces
// the old: the first link stops working, the second confirms.
func TestRecoveryEmailRequestReplacesEarlierLink(t *testing.T) {
	e := newRecoveryEnv(t)
	_, cookie := e.registerNewAccount(t)

	first := e.mustRequest(t, cookie, "first@estante.test")
	second := e.mustRequest(t, cookie, "second@estante.test")
	if _, pending := e.read(t, cookie); deref(pending) != "second@estante.test" {
		t.Errorf("pending = %s, want the latest request's address", deref(pending))
	}

	resp, body := e.confirm(t, first)
	if resp.StatusCode != http.StatusBadRequest || !strings.Contains(string(body), `"link_invalid"`) {
		t.Errorf("confirm of the replaced link: status = %d body=%s, want 400 link_invalid", resp.StatusCode, body)
	}
	if resp, body := e.confirm(t, second); resp.StatusCode != http.StatusNoContent {
		t.Errorf("confirm of the latest link: status = %d, want 204; body=%s", resp.StatusCode, body)
	}
}

// TestRecoveryEmailConfirmExpiredOrUsed pins workflow 13 §Confirming it (single
// use, fifteen minutes): an expired link, a link used twice and a tampered link
// are each 400 link_invalid, and none writes the email.
func TestRecoveryEmailConfirmExpiredOrUsed(t *testing.T) {
	e := newRecoveryEnv(t)

	// Expired: the row's expiry moved into the past.
	expiredID, expiredCookie := e.registerNewAccount(t)
	expired := e.mustRequest(t, expiredCookie, "late@estante.test")
	if _, err := e.pool.Exec(context.Background(),
		`UPDATE recovery_email_links SET expires_at = now() - interval '1 minute' WHERE account_id = $1`, expiredID); err != nil {
		t.Fatalf("expiring the link: %v", err)
	}
	if resp, body := e.confirm(t, expired); resp.StatusCode != http.StatusBadRequest || !strings.Contains(string(body), `"link_invalid"`) {
		t.Errorf("expired confirm: status = %d body=%s, want 400 link_invalid", resp.StatusCode, body)
	}
	if email := e.accountEmail(t, expiredID); email != nil {
		t.Errorf("an expired link wrote the email %q", *email)
	}
	// The pending address is still shown once expired, for send again.
	if _, pending := e.read(t, expiredCookie); deref(pending) != "late@estante.test" {
		t.Errorf("pending after expiry = %s, want the address still shown", deref(pending))
	}

	// Tampered: the signature's last character changed.
	e.auth = freshAuthenticator()
	tamperedID, tamperedCookie := e.registerNewAccount(t)
	token := e.mustRequest(t, tamperedCookie, "tamper@estante.test")
	last := token[len(token)-1]
	swap := byte('A')
	if last == 'A' {
		swap = 'B'
	}
	if resp, _ := e.confirm(t, token[:len(token)-1]+string(swap)); resp.StatusCode != http.StatusBadRequest {
		t.Errorf("tampered confirm: status = %d, want 400", resp.StatusCode)
	}
	if email := e.accountEmail(t, tamperedID); email != nil {
		t.Errorf("a tampered link wrote the email %q", *email)
	}

	// Used: the same (untampered) token twice — the second is refused and the
	// email stays what the first wrote.
	if resp, body := e.confirm(t, token); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("first confirm: status = %d, want 204; body=%s", resp.StatusCode, body)
	}
	if _, err := e.pool.Exec(context.Background(), `UPDATE accounts SET email = NULL WHERE id = $1`, tamperedID); err != nil {
		t.Fatalf("clearing the email: %v", err)
	}
	if resp, body := e.confirm(t, token); resp.StatusCode != http.StatusBadRequest || !strings.Contains(string(body), `"link_invalid"`) {
		t.Errorf("second confirm: status = %d body=%s, want 400 link_invalid", resp.StatusCode, body)
	}
	if email := e.accountEmail(t, tamperedID); email != nil {
		t.Errorf("a used link wrote the email %q again", *email)
	}
}

// TestRecoveryEmailChangeKeepsOldUntilConfirmed pins workflow 13 §Changing it:
// with old@ confirmed, a request for new@ leaves old@ the account's email —
// the one an emailed sign-in still reaches, while new@ gets no sign-in link —
// until the confirm, which makes new@ the email and mails old@ a notice with
// no link.
func TestRecoveryEmailChangeKeepsOldUntilConfirmed(t *testing.T) {
	e := newRecoveryEnv(t)
	accountID, cookie := e.registerNewAccount(t)
	const oldAddr, newAddr = "old@estante.test", "new@estante.test"
	if resp, body := e.confirm(t, e.mustRequest(t, cookie, oldAddr)); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("confirming old@: status = %d; body=%s", resp.StatusCode, body)
	}

	token := e.mustRequest(t, cookie, newAddr)
	if email, pending := e.read(t, cookie); deref(email) != oldAddr || deref(pending) != newAddr {
		t.Errorf("during the change: email=%s pending=%s, want %s and %s", deref(email), deref(pending), oldAddr, newAddr)
	}
	if email := e.accountEmail(t, accountID); deref(email) != oldAddr {
		t.Errorf("accounts.email = %s during the change, want %s", deref(email), oldAddr)
	}

	// The old address is still the way in; the pending one is not yet.
	for _, addr := range []string{oldAddr, newAddr} {
		if resp, _ := e.do(t, http.MethodPost, "/api/auth/email/request", "", []byte(`{"email":`+mustQuote(addr)+`}`)); resp.StatusCode != http.StatusAccepted {
			t.Fatalf("requestEmailLink(%s): status = %d, want 202", addr, resp.StatusCode)
		}
	}
	signIns := 0
	for _, m := range e.mailer.messages() {
		if m.Kind == mailSignIn {
			signIns++
			if m.To != oldAddr {
				t.Errorf("a sign-in link went to %s, want only %s (a pending address gets none)", m.To, oldAddr)
			}
		}
	}
	if signIns != 1 {
		t.Errorf("sign-in links mailed = %d, want 1 (to the old address)", signIns)
	}

	if resp, body := e.confirm(t, token); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("confirming new@: status = %d; body=%s", resp.StatusCode, body)
	}
	if email := e.accountEmail(t, accountID); deref(email) != newAddr {
		t.Errorf("accounts.email = %s after the change, want %s", deref(email), newAddr)
	}
	var notices []sentMail
	for _, m := range e.mailer.messages() {
		if m.Kind == mailRecoveryChanged {
			notices = append(notices, m)
		}
	}
	if len(notices) != 1 || notices[0].To != oldAddr || notices[0].Link != "" {
		t.Errorf("change notices = %+v, want one to %s with no link", notices, oldAddr)
	}
}

// TestRecoveryEmailTakenRefusedOnlyOnConfirm pins workflow 13 §Who holds an
// address: B holds x@; A's request for x@ is the same 202 with a mail (no
// enumeration), and only A's confirm is refused, 409 address_taken, leaving A's
// email unchanged and the link unconsumed.
func TestRecoveryEmailTakenRefusedOnlyOnConfirm(t *testing.T) {
	e := newRecoveryEnv(t)
	const address = "x@estante.test"
	holderID := e.insertAccount(t)
	e.setEmail(t, holderID, address)

	accountID, cookie := e.registerNewAccount(t)
	token := e.mustRequest(t, cookie, address)

	resp, body := e.confirm(t, token)
	if resp.StatusCode != http.StatusConflict || !strings.Contains(string(body), `"address_taken"`) {
		t.Fatalf("confirm of a held address: status = %d body=%s, want 409 address_taken", resp.StatusCode, body)
	}
	if strings.Contains(string(body), address) {
		t.Errorf("the 409 body names the address: %s", body)
	}
	if email := e.accountEmail(t, accountID); email != nil {
		t.Errorf("accounts.email = %q after a refused confirm, want NULL", *email)
	}
	if n := e.countRows(t, `SELECT count(*) FROM recovery_email_links WHERE account_id = $1 AND consumed_at IS NULL`, accountID); n != 1 {
		t.Errorf("unconsumed links = %d after a refused confirm, want 1 (rolled back)", n)
	}
	// Opening it again says the same.
	if resp, _ := e.confirm(t, token); resp.StatusCode != http.StatusConflict {
		t.Errorf("second confirm of a held address: status = %d, want 409", resp.StatusCode)
	}
}

// TestRecoveryEmailNeedsSession pins that the read and the request are the
// owner's: 401 without a session; a malformed address is 400.
func TestRecoveryEmailNeedsSession(t *testing.T) {
	e := newRecoveryEnv(t)
	_, cookie := e.registerNewAccount(t)

	resp, body := e.do(t, http.MethodGet, "/api/account/recovery-email", "", nil)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("getRecoveryEmail without a session: status = %d, want 401", resp.StatusCode)
	}
	if err := e.contract.Validate("getRecoveryEmail", apicontract.Response, "401", body); err != nil {
		t.Errorf("getRecoveryEmail 401 does not conform: %v", err)
	}
	resp, body = e.request(t, "", "player@estante.test")
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("requestRecoveryEmail without a session: status = %d, want 401", resp.StatusCode)
	}
	if err := e.contract.Validate("requestRecoveryEmail", apicontract.Response, "401", body); err != nil {
		t.Errorf("requestRecoveryEmail 401 does not conform: %v", err)
	}
	resp, body = e.request(t, cookie, "not-an-address")
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("requestRecoveryEmail of a malformed address: status = %d, want 400", resp.StatusCode)
	}
	if err := e.contract.Validate("requestRecoveryEmail", apicontract.Response, "400", body); err != nil {
		t.Errorf("requestRecoveryEmail 400 does not conform: %v", err)
	}
	if n := len(e.mailer.messages()); n != 0 {
		t.Errorf("mailed %d messages, want none", n)
	}
}

// TestRecoveryEmailRateLimited pins DIRECTION §3.3: the request is capped per
// address (across accounts) and per account (across addresses), the excess
// 429 rate_limited with Retry-After, mailing nothing.
func TestRecoveryEmailRateLimited(t *testing.T) {
	e := newRecoveryEnvWith(t, func(api *APIDeps) {
		api.Limiter = ratelimit.New(nil, map[ratelimit.RuleID]ratelimit.Rule{
			ratelimit.RecoveryEmailAccount: {Max: 2, Window: time.Hour},
			ratelimit.RecoveryEmailAddr:    {Max: 1, Window: time.Hour},
		})
	})
	_, cookieA := e.registerNewAccount(t)
	e.auth = freshAuthenticator()
	_, cookieB := e.registerNewAccount(t)

	assertLimited := func(what string, resp *http.Response, body []byte) {
		t.Helper()
		if resp.StatusCode != http.StatusTooManyRequests {
			t.Fatalf("%s: status = %d, want 429; body=%s", what, resp.StatusCode, body)
		}
		if resp.Header.Get("Retry-After") == "" {
			t.Errorf("%s: 429 without Retry-After", what)
		}
		if err := e.contract.Validate("requestRecoveryEmail", apicontract.Response, "429", body); err != nil {
			t.Errorf("%s: 429 does not conform: %v", what, err)
		}
	}

	e.mustRequest(t, cookieA, "x@estante.test")
	// Per address: B asking for the same mailbox is refused.
	resp, body := e.request(t, cookieB, "x@estante.test")
	assertLimited("per address", resp, body)
	// Per account: A's second address passes, the third is refused.
	e.mustRequest(t, cookieA, "y@estante.test")
	resp, body = e.request(t, cookieA, "z@estante.test")
	assertLimited("per account", resp, body)

	if n := len(e.mailer.messages()); n != 2 {
		t.Errorf("mailed %d messages, want 2 (the refused requests mail nothing)", n)
	}
}

// TestRecoveryEmailNeverLogged pins workflow 13 "never logged": across a
// request, a confirm, a change and the mailed app page being opened, the
// captured log holds neither address nor token.
func TestRecoveryEmailNeverLogged(t *testing.T) {
	e := newRecoveryEnv(t)
	_, cookie := e.registerNewAccount(t)
	const first, second = "first-secret@estante.test", "second-secret@estante.test"

	t1 := e.mustRequest(t, cookie, first)
	e.do(t, http.MethodGet, "/recovery-email/"+t1, "", nil)
	e.confirm(t, t1)
	t2 := e.mustRequest(t, cookie, second)
	e.do(t, http.MethodGet, "/recovery-email/"+t2, "", nil)
	e.confirm(t, t2)
	e.read(t, cookie)

	logs := e.logBuf.String()
	if !strings.Contains(logs, "/api/recovery-email/confirm") {
		t.Fatalf("expected a metadata request line for the confirm:\n%s", logs)
	}
	for _, secret := range []string{first, second, "first-secret", "second-secret", t1, t2} {
		if strings.Contains(logs, secret) {
			t.Errorf("the log contains %q:\n%s", secret, logs)
		}
	}
}
