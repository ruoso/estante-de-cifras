package server

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	apicontract "estantedecifras.app/api"
	"estantedecifras.app/service/internal/ratelimit"
	"estantedecifras.app/service/internal/session"
)

// These behavior tests drive the real server.Handler through httptest on
// newBooksEnv's stack (the compose Postgres, a real git on a throwaway books
// root, the passkey ceremony for sessions) with an injected tiny-window Limiter.
// Each of the four limits trips at its threshold and recovers (service.rate_limits
// acceptance): sign-in failures per IP (successful sign-ins never count),
// emailed-link requests per address and per IP, book create + fork per account,
// invitation accept per account. The 429 body is validated against the contract
// and carries Retry-After; distinct IPs/addresses/accounts isolate; the tripped
// request leaks no secret into the log; and a nil limiter serves everything.
// Pins workflow 14 §Limits (book create) and DIRECTION §3.3 (the rest). A
// standalone `go test` with the DSN unset skips (migratedServerSchema → envDSN).

// rlClock is an injectable, advanceable, concurrency-safe clock for the limiter.
type rlClock struct {
	mu sync.Mutex
	t  time.Time
}

func (c *rlClock) now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *rlClock) advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.t = c.t.Add(d)
}

// newRateLimitEnv builds a books env whose APIDeps carries a Limiter wired with
// the given tiny-window rules and TrustedProxies=1, so the tests key on an
// X-Forwarded-For header they set.
func newRateLimitEnv(t *testing.T, rules map[ratelimit.RuleID]ratelimit.Rule) (*booksEnv, *rlClock) {
	t.Helper()
	clk := &rlClock{t: time.Unix(1_700_000_000, 0)}
	lim := ratelimit.New(clk.now, rules)
	e := newBooksEnvWith(t, func(api *APIDeps) {
		api.Limiter = lim
		api.TrustedProxies = 1
	})
	return e, clk
}

// doXFF is do with a client IP supplied via X-Forwarded-For (honoured because
// the env sets TrustedProxies=1).
func (e *passkeyEnv) doXFF(t *testing.T, method, path, cookie, xff string, body []byte) (*http.Response, []byte) {
	t.Helper()
	var r io.Reader
	if body != nil {
		r = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, e.server.URL+path, r)
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if xff != "" {
		req.Header.Set("X-Forwarded-For", xff)
	}
	if cookie != "" {
		req.AddCookie(&http.Cookie{Name: session.CookieName, Value: cookie})
	}
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	data, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		t.Fatalf("reading body: %v", err)
	}
	return resp, data
}

// assertRateLimited checks a response is the contract's 429 for the given
// operation: a conforming Error body with code rate_limited and a Retry-After
// header of at least one second.
func (e *booksEnv) assertRateLimited(t *testing.T, operationID string, resp *http.Response, body []byte) {
	t.Helper()
	if resp.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("%s: status = %d, want 429; body=%s", operationID, resp.StatusCode, body)
	}
	if err := e.contract.Validate(operationID, apicontract.Response, "429", body); err != nil {
		t.Errorf("%s 429 body does not conform to the contract: %v\nbody=%s", operationID, err, body)
	}
	ra := resp.Header.Get("Retry-After")
	secs, err := strconv.Atoi(ra)
	if err != nil || secs < 1 {
		t.Errorf("%s Retry-After = %q, want an integer ≥ 1 second", operationID, ra)
	}
}

func emailBody(addr string) []byte { return []byte(fmt.Sprintf(`{"email":%q}`, addr)) }

// passkeySignIn drives a full, successful passkey authentication from the given
// client IP and asserts a 200. The account must already have a registered
// passkey (registerNewAccount).
func (e *booksEnv) passkeySignIn(t *testing.T, ip string) {
	t.Helper()
	beginResp, beginBody := e.do(t, http.MethodPost, "/api/auth/passkey/authenticate/begin", "", []byte(`{}`))
	if beginResp.StatusCode != http.StatusOK {
		t.Fatalf("authenticate/begin status = %d, want 200; body=%s", beginResp.StatusCode, beginBody)
	}
	finishBody := e.finishAssertionBody(t, beginBody, false)
	resp, body := e.doXFF(t, http.MethodPost, "/api/auth/passkey/authenticate/finish", "", ip, finishBody)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("a successful sign-in got status %d, want 200; body=%s", resp.StatusCode, body)
	}
}

// TestRateLimitSignInFailuresPerIP pins the sign-in limit (Constraint 5,
// Decision 3; DIRECTION §3.3): failed attempts per client IP trip the limit, a
// successful sign-in in between does not count, a distinct IP is unaffected, and
// the count recovers once the window rolls.
func TestRateLimitSignInFailuresPerIP(t *testing.T) {
	e, clk := newRateLimitEnv(t, map[ratelimit.RuleID]ratelimit.Rule{
		ratelimit.SignIn: {Max: 3, Window: time.Minute},
	})
	e.registerNewAccount(t) // so the authenticator holds a credential for a success
	const ipA, ipB = "198.51.100.10", "198.51.100.20"
	badToken := []byte(`{"token":"not-a-real-token"}`)

	redeemFail := func(ip string) *http.Response {
		resp, _ := e.doXFF(t, http.MethodPost, "/api/auth/email/redeem", "", ip, badToken)
		return resp
	}

	// Two failures, then a successful sign-in that must NOT count, then a third
	// failure: if the success had counted, this third failure would already be
	// the 429.
	if got := redeemFail(ipA).StatusCode; got != http.StatusUnauthorized {
		t.Fatalf("failure 1: status = %d, want 401", got)
	}
	if got := redeemFail(ipA).StatusCode; got != http.StatusUnauthorized {
		t.Fatalf("failure 2: status = %d, want 401", got)
	}
	e.passkeySignIn(t, ipA) // a success in between
	if got := redeemFail(ipA).StatusCode; got != http.StatusUnauthorized {
		t.Fatalf("failure 3: status = %d, want 401 (the success must not have counted)", got)
	}

	// The window is now full (three failures); the next attempt is refused before
	// any token work.
	resp, body := e.doXFF(t, http.MethodPost, "/api/auth/email/redeem", "", ipA, badToken)
	e.assertRateLimited(t, "redeemEmailLink", resp, body)

	// A distinct IP has its own window.
	if got := redeemFail(ipB).StatusCode; got != http.StatusUnauthorized {
		t.Errorf("a distinct IP: status = %d, want 401 (keys isolate)", got)
	}

	// Recovery: once the clock passes the window, ipA serves again.
	clk.advance(time.Minute)
	if got := redeemFail(ipA).StatusCode; got != http.StatusUnauthorized {
		t.Errorf("after the window rolled: status = %d, want 401 (recovered)", got)
	}
}

// TestRateLimitEmailLinkPerAddress pins the emailed-link limit keyed on the
// address (DIRECTION §3.3: one mailbox cannot be flooded). A non-existent
// address is answered 202, so the 429 is as account-oblivious as the 202.
func TestRateLimitEmailLinkPerAddress(t *testing.T) {
	e, clk := newRateLimitEnv(t, map[ratelimit.RuleID]ratelimit.Rule{
		ratelimit.EmailLinkAddr: {Max: 2, Window: time.Hour},
		ratelimit.EmailLinkIP:   {Max: 100, Window: time.Hour}, // room, so only the address trips
	})
	addr := "flood-" + randHex(t) + "@estante.test"
	const ip = "203.0.113.5"

	for i := 0; i < 2; i++ {
		resp, body := e.doXFF(t, http.MethodPost, "/api/auth/email/request", "", ip, emailBody(addr))
		if resp.StatusCode != http.StatusAccepted {
			t.Fatalf("request %d: status = %d, want 202; body=%s", i+1, resp.StatusCode, body)
		}
	}
	resp, body := e.doXFF(t, http.MethodPost, "/api/auth/email/request", "", ip, emailBody(addr))
	e.assertRateLimited(t, "requestEmailLink", resp, body)

	// A different address from the same IP is unaffected (the IP cap is high).
	other := "other-" + randHex(t) + "@estante.test"
	resp, body = e.doXFF(t, http.MethodPost, "/api/auth/email/request", "", ip, emailBody(other))
	if resp.StatusCode != http.StatusAccepted {
		t.Errorf("a distinct address: status = %d, want 202 (keys isolate); body=%s", resp.StatusCode, body)
	}

	// Recovery once the window rolls.
	clk.advance(time.Hour)
	resp, body = e.doXFF(t, http.MethodPost, "/api/auth/email/request", "", ip, emailBody(addr))
	if resp.StatusCode != http.StatusAccepted {
		t.Errorf("after the window rolled: status = %d, want 202 (recovered); body=%s", resp.StatusCode, body)
	}
}

// TestRateLimitEmailLinkPerIP pins the emailed-link limit keyed on the client
// IP, independent of the address.
func TestRateLimitEmailLinkPerIP(t *testing.T) {
	e, _ := newRateLimitEnv(t, map[ratelimit.RuleID]ratelimit.Rule{
		ratelimit.EmailLinkAddr: {Max: 100, Window: time.Hour}, // room, so only the IP trips
		ratelimit.EmailLinkIP:   {Max: 2, Window: time.Hour},
	})
	const ip, otherIP = "203.0.113.6", "203.0.113.7"

	for i := 0; i < 2; i++ {
		addr := fmt.Sprintf("u%d-%s@estante.test", i, randHex(t))
		resp, body := e.doXFF(t, http.MethodPost, "/api/auth/email/request", "", ip, emailBody(addr))
		if resp.StatusCode != http.StatusAccepted {
			t.Fatalf("request %d: status = %d, want 202; body=%s", i+1, resp.StatusCode, body)
		}
	}
	// A third, fresh address from the same IP is refused on the IP cap.
	resp, body := e.doXFF(t, http.MethodPost, "/api/auth/email/request", "", ip, emailBody("fresh-"+randHex(t)+"@estante.test"))
	e.assertRateLimited(t, "requestEmailLink", resp, body)

	// A different IP is unaffected.
	resp, body = e.doXFF(t, http.MethodPost, "/api/auth/email/request", "", otherIP, emailBody("far-"+randHex(t)+"@estante.test"))
	if resp.StatusCode != http.StatusAccepted {
		t.Errorf("a distinct IP: status = %d, want 202 (keys isolate); body=%s", resp.StatusCode, body)
	}
}

// TestRateLimitBookCreateAndForkPerAccount pins workflow 14 §Limits: book
// creation is rate-limited per account, forks included (Decision 6), and a
// distinct account is unaffected.
func TestRateLimitBookCreateAndForkPerAccount(t *testing.T) {
	e, clk := newRateLimitEnv(t, map[ratelimit.RuleID]ratelimit.Rule{
		ratelimit.BookCreate: {Max: 2, Window: time.Hour},
	})
	_, cookie := e.registerNewAccount(t)

	// One create and one fork exhaust the per-account cap of two — proving fork
	// draws on the same counter.
	b := e.createBook(t, cookie, "First")
	e.forkBook(t, cookie, b.ID)

	resp, body := e.do(t, http.MethodPost, "/api/books", cookie, []byte(`{"title":"Third"}`))
	e.assertRateLimited(t, "createBook", resp, body)

	// A distinct account has its own window.
	_, cookie2 := e.registerNewAccount(t)
	resp2, body2 := e.do(t, http.MethodPost, "/api/books", cookie2, []byte(`{"title":"Theirs"}`))
	if resp2.StatusCode != http.StatusCreated {
		t.Errorf("a distinct account: status = %d, want 201 (keys isolate); body=%s", resp2.StatusCode, body2)
	}

	// Recovery once the window rolls.
	clk.advance(time.Hour)
	resp, body = e.do(t, http.MethodPost, "/api/books", cookie, []byte(`{"title":"Later"}`))
	if resp.StatusCode != http.StatusCreated {
		t.Errorf("after the window rolled: status = %d, want 201 (recovered); body=%s", resp.StatusCode, body)
	}
}

// TestRateLimitInviteAcceptPerAccount pins the invitation-accept limit keyed on
// the account, never the path token (Constraint 6): a second account reusing the
// very same token path is not limited, so the key is the account id. The rate
// check runs before the token is looked up, so bogus tokens (404) still count.
func TestRateLimitInviteAcceptPerAccount(t *testing.T) {
	e, _ := newRateLimitEnv(t, map[ratelimit.RuleID]ratelimit.Rule{
		ratelimit.InviteAccept: {Max: 2, Window: time.Hour},
	})
	_, cookie := e.registerNewAccount(t)
	const token = "11111111-1111-1111-1111-111111111111"

	for i := 0; i < 2; i++ {
		resp, body := e.do(t, http.MethodPost, "/api/invitations/"+token+"/accept", cookie, nil)
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("accept %d: status = %d, want 404 (bogus token, but still counts); body=%s", i+1, resp.StatusCode, body)
		}
	}
	resp, body := e.do(t, http.MethodPost, "/api/invitations/"+token+"/accept", cookie, nil)
	e.assertRateLimited(t, "acceptInvitation", resp, body)

	// A second account, same token path: not limited — the key is the account.
	_, cookie2 := e.registerNewAccount(t)
	resp2, body2 := e.do(t, http.MethodPost, "/api/invitations/"+token+"/accept", cookie2, nil)
	if resp2.StatusCode != http.StatusNotFound {
		t.Errorf("a second account on the same token: status = %d, want 404 (keyed on account, not token); body=%s", resp2.StatusCode, body2)
	}
}

// TestRateLimit429LeaksNoSecretToTheLog pins Constraint 6 over a tripped
// request: a 429 is recorded by LogRequests as status only, with no address and
// no invitation token in the line (the invitation token is redacted even on the
// 429). Reuses the logBuf captured by the env, as logging_test.go does.
func TestRateLimit429LeaksNoSecretToTheLog(t *testing.T) {
	e, _ := newRateLimitEnv(t, map[ratelimit.RuleID]ratelimit.Rule{
		ratelimit.EmailLinkAddr: {Max: 1, Window: time.Hour},
		ratelimit.EmailLinkIP:   {Max: 100, Window: time.Hour},
		ratelimit.InviteAccept:  {Max: 1, Window: time.Hour},
	})
	_, cookie := e.registerNewAccount(t)
	addr := "leaky-" + randHex(t) + "@estante.test"
	const ip = "203.0.113.8"
	const token = "22222222-2222-2222-2222-222222222222"

	// Trip the per-address email limit (address in the body, never a path).
	e.doXFF(t, http.MethodPost, "/api/auth/email/request", "", ip, emailBody(addr))
	resp, body := e.doXFF(t, http.MethodPost, "/api/auth/email/request", "", ip, emailBody(addr))
	e.assertRateLimited(t, "requestEmailLink", resp, body)

	// Trip the invitation-accept limit (token in the path).
	e.do(t, http.MethodPost, "/api/invitations/"+token+"/accept", cookie, nil)
	resp, body = e.do(t, http.MethodPost, "/api/invitations/"+token+"/accept", cookie, nil)
	e.assertRateLimited(t, "acceptInvitation", resp, body)

	logs := e.logBuf.String()
	if logs == "" {
		t.Fatal("no logs captured; expected request lines")
	}
	for _, secret := range []string{addr, token} {
		if strings.Contains(logs, secret) {
			t.Errorf("the log leaked %q:\n%s", secret, logs)
		}
	}
	// The metadata-only line is still there, with the invitation token redacted.
	if !strings.Contains(logs, "/api/auth/email/request") || !strings.Contains(logs, "/api/invitations/{token}/accept") {
		t.Errorf("expected metadata-only request lines (token redacted):\n%s", logs)
	}
}

// TestRateLimitNilLimiterServesAll pins Constraint 7: an APIDeps with no Limiter
// never limits — the many existing behavior tests build one that way.
func TestRateLimitNilLimiterServesAll(t *testing.T) {
	e := newBooksEnv(t) // no Limiter wired
	addr := "nolimit-" + randHex(t) + "@estante.test"
	// Far more than any default per-address window; all must be served.
	for i := 0; i < 12; i++ {
		resp, body := e.do(t, http.MethodPost, "/api/auth/email/request", "", emailBody(addr))
		if resp.StatusCode != http.StatusAccepted {
			t.Fatalf("request %d with a nil limiter: status = %d, want 202; body=%s", i+1, resp.StatusCode, body)
		}
	}
}
