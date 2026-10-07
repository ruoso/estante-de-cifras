package server

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	apicontract "estantedecifras.app/api"
	"estantedecifras.app/service/internal/passkey"
	"estantedecifras.app/service/internal/session"
)

// These behavior tests drive the real Handler through httptest against the
// compose Postgres (ESTANTE_TEST_DATABASE_URL), building real sessions through
// the passkey ceremony (the only landed sign-in that calls session.Issue) so
// the cookie attributes, the stored device label and lazy revocation are all
// exercised end to end. They pin workflow 13 §The account screen and §Signing
// out, and the contract (api/openapi.yaml /api/auth/signout,
// /api/account/sessions). Each response is validated against the contract. A
// standalone `go test` with the DSN unset skips (migratedServerSchema), staying
// green.
//
// The ceremonies set a User-Agent on the finish request so session.Issue
// derives and stores a device label (refinement acceptance #4); Go's default
// client otherwise sends an unrecognised agent and device would be NULL.

const (
	uaChromeLinux    = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
	uaFirefoxWindows = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0"
)

// doUA mirrors passkeyEnv.do but sets a User-Agent, so a sign-in's finish
// request carries the agent session.Issue derives a device label from.
func (e *passkeyEnv) doUA(t *testing.T, method, path, cookie, userAgent string, body []byte) (*http.Response, []byte) {
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
	if userAgent != "" {
		req.Header.Set("User-Agent", userAgent)
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

// registerWithUA runs register begin→finish with no session, the finish
// carrying userAgent, returning the new account id, its session cookie and the
// finish response (for its Set-Cookie attributes).
func (e *passkeyEnv) registerWithUA(t *testing.T, userAgent string) (accountID, cookie string, finish *http.Response) {
	t.Helper()
	_, beginBody := e.do(t, http.MethodPost, "/api/auth/passkey/register/begin", "", []byte(`{}`))
	finishBody := e.finishRegistrationBody(t, beginBody)
	resp, body := e.doUA(t, http.MethodPost, "/api/auth/passkey/register/finish", "", userAgent, finishBody)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("register/finish status = %d, want 200; body=%s", resp.StatusCode, body)
	}
	return accountIDOf(t, body), sessionCookieValue(resp), resp
}

// authenticateWithUA signs the registered passkey in again from a fresh client,
// the finish carrying userAgent, returning the new session cookie — a second
// session on the same account.
func (e *passkeyEnv) authenticateWithUA(t *testing.T, userAgent string) (cookie string) {
	t.Helper()
	_, beginBody := e.do(t, http.MethodPost, "/api/auth/passkey/authenticate/begin", "", []byte(`{}`))
	finishBody := e.finishAssertionBody(t, beginBody, false)
	resp, body := e.doUA(t, http.MethodPost, "/api/auth/passkey/authenticate/finish", "", userAgent, finishBody)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("authenticate/finish status = %d, want 200; body=%s", resp.StatusCode, body)
	}
	return sessionCookieValue(resp)
}

func setCookieNamed(t *testing.T, resp *http.Response, name string) *http.Cookie {
	t.Helper()
	for _, c := range resp.Cookies() {
		if c.Name == name {
			return c
		}
	}
	t.Fatalf("response set no %q cookie", name)
	return nil
}

// assertSessionCookieAttrs checks the fixed attributes every estante_session
// Set-Cookie carries (DIRECTION §3.3 line 170; refinement acceptance #1).
func assertSessionCookieAttrs(t *testing.T, c *http.Cookie) {
	t.Helper()
	if !c.HttpOnly {
		t.Error("session cookie is not HttpOnly")
	}
	if !c.Secure {
		t.Error("session cookie is not Secure")
	}
	if c.SameSite != http.SameSiteLaxMode {
		t.Errorf("session cookie SameSite = %v, want Lax", c.SameSite)
	}
	if c.Path != "/" {
		t.Errorf("session cookie Path = %q, want /", c.Path)
	}
}

// TestSessionCookieAttributesAndSignOut pins acceptance #1 and the named
// "cookie HttpOnly, Secure, SameSite" behavior: sign-in sets the session cookie
// with the fixed attributes, and signOut returns 204 with a clearing cookie
// that carries the same attributes and a past expiry; the stale cookie then
// resolves to "not signed in" (401).
func TestSessionCookieAttributesAndSignOut(t *testing.T) {
	e := newPasskeyEnv(t)
	_, cookie, finish := e.registerWithUA(t, uaChromeLinux)

	// The sign-in cookie carries the fixed attributes, with the session id as
	// its value.
	live := setCookieNamed(t, finish, session.CookieName)
	assertSessionCookieAttrs(t, live)
	if live.Value == "" {
		t.Error("sign-in set an empty session cookie value")
	}

	// signOut: 204, and a clearing cookie — empty value, past expiry, same
	// attributes.
	resp, body := e.do(t, http.MethodPost, "/api/auth/signout", cookie, nil)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("signOut status = %d, want 204; body=%s", resp.StatusCode, body)
	}
	cleared := setCookieNamed(t, resp, session.CookieName)
	assertSessionCookieAttrs(t, cleared)
	if cleared.Value != "" {
		t.Errorf("signOut clearing cookie value = %q, want empty", cleared.Value)
	}
	expired := cleared.MaxAge < 0 || (!cleared.Expires.IsZero() && cleared.Expires.Before(time.Now()))
	if !expired {
		t.Errorf("signOut clearing cookie is not expired: MaxAge=%d Expires=%v", cleared.MaxAge, cleared.Expires)
	}

	// The stale cookie no longer resolves (lazy revocation at the next request).
	after, _ := e.do(t, http.MethodGet, "/api/account/sessions", cookie, nil)
	if after.StatusCode != http.StatusUnauthorized {
		t.Errorf("a request with the signed-out cookie = %d, want 401", after.StatusCode)
	}
}

// TestListSessionsDevicesWithLastUse pins acceptance #2 and workflow 13 §The
// account screen: two sessions on one account list with lastUsedAt, exactly one
// current, most-recently-used first, device populated; a revoked session is
// absent; unauthenticated is 401.
func TestListSessionsDevicesWithLastUse(t *testing.T) {
	e := newPasskeyEnv(t)
	_, cookieA, _ := e.registerWithUA(t, uaChromeLinux)
	cookieB := e.authenticateWithUA(t, uaFirefoxWindows)

	// Unauthenticated is 401.
	if resp, _ := e.do(t, http.MethodGet, "/api/account/sessions", "", nil); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("listSessions without a session = %d, want 401", resp.StatusCode)
	}

	// List from B: B is the request's own session, and listing just bumped its
	// last_used_at, so it sorts first and is the only current one.
	resp, body := e.do(t, http.MethodGet, "/api/account/sessions", cookieB, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("listSessions status = %d, want 200; body=%s", resp.StatusCode, body)
	}
	if err := e.contract.Validate("listSessions", apicontract.Response, "200", body); err != nil {
		t.Errorf("listSessions response does not conform: %v", err)
	}
	sessions := sessionsOf(t, body)
	if len(sessions) != 2 {
		t.Fatalf("listed %d sessions, want 2", len(sessions))
	}
	current := 0
	for _, s := range sessions {
		if s.LastUsedAt == "" {
			t.Errorf("session %q has no lastUsedAt", s.ID)
		}
		if s.Device == nil || *s.Device == "" {
			t.Errorf("session %q has no device label, want a best-effort one", s.ID)
		}
		if s.Current {
			current++
		}
	}
	if current != 1 {
		t.Errorf("%d sessions marked current, want exactly 1", current)
	}
	if !sessions[0].Current || sessions[0].ID != cookieB {
		t.Errorf("most-recently-used session = %q (current=%v), want the current one %q", sessions[0].ID, sessions[0].Current, cookieB)
	}

	// Revoke A; it is no longer a signed-in device, so it drops off the list.
	if resp, _ := e.do(t, http.MethodDelete, "/api/account/sessions/"+cookieA, cookieB, nil); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("revokeSession of A status = %d, want 204", resp.StatusCode)
	}
	_, after := e.do(t, http.MethodGet, "/api/account/sessions", cookieB, nil)
	remaining := sessionsOf(t, after)
	if len(remaining) != 1 || remaining[0].ID != cookieB {
		t.Errorf("after revoking A, listed %d sessions, want only B", len(remaining))
	}
}

// TestSignOutAnotherDevice pins acceptance #3 and workflow 13 §The account
// screen, §Signing out: from one device, revoke another device's session (204),
// which stops working at its next request (401); an id outside the account, and
// a malformed one, are 404; signOut clears this device's cookie and the stale
// cookie then 401s.
func TestSignOutAnotherDevice(t *testing.T) {
	e := newPasskeyEnv(t)
	_, cookieA, _ := e.registerWithUA(t, uaChromeLinux)
	cookieB := e.authenticateWithUA(t, uaFirefoxWindows)

	// From A, sign B out.
	if resp, _ := e.do(t, http.MethodDelete, "/api/account/sessions/"+cookieB, cookieA, nil); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("revokeSession of B from A = %d, want 204", resp.StatusCode)
	}
	// B stops working at its next request (lazy revocation).
	if resp, _ := e.do(t, http.MethodGet, "/api/account/sessions", cookieB, nil); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("B's next request after revocation = %d, want 401", resp.StatusCode)
	}

	// A session id that is not one of the account's own is 404 (never a signal
	// that another account's session exists), as is a malformed id.
	if resp, _ := e.do(t, http.MethodDelete, "/api/account/sessions/"+passkey.NewAccountID(), cookieA, nil); resp.StatusCode != http.StatusNotFound {
		t.Errorf("revokeSession of an id not on the account = %d, want 404", resp.StatusCode)
	}
	if resp, _ := e.do(t, http.MethodDelete, "/api/account/sessions/not-a-uuid", cookieA, nil); resp.StatusCode != http.StatusNotFound {
		t.Errorf("revokeSession of a malformed id = %d, want 404", resp.StatusCode)
	}

	// signOut on A: 204, clearing cookie, and the stale cookie then 401s.
	resp, _ := e.do(t, http.MethodPost, "/api/auth/signout", cookieA, nil)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("signOut status = %d, want 204", resp.StatusCode)
	}
	if cleared := setCookieNamed(t, resp, session.CookieName); cleared.Value != "" {
		t.Errorf("signOut clearing cookie value = %q, want empty", cleared.Value)
	}
	if resp, _ := e.do(t, http.MethodGet, "/api/account/sessions", cookieA, nil); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("A's request after signOut = %d, want 401", resp.StatusCode)
	}

	// signOut without a session is 401.
	if resp, _ := e.do(t, http.MethodPost, "/api/auth/signout", "", nil); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("signOut without a session = %d, want 401", resp.StatusCode)
	}
}

// TestNoSessionValueInLogs pins the no-session-value-in-logs rule (DIRECTION
// §3.3; refinement Constraints): across sign-ins and the session routes, the
// captured log carries no account id, no session id (the cookie value) — only
// request metadata.
func TestNoSessionValueInLogs(t *testing.T) {
	e := newPasskeyEnv(t)
	accountID, cookieA, _ := e.registerWithUA(t, uaChromeLinux)
	cookieB := e.authenticateWithUA(t, uaFirefoxWindows)
	e.do(t, http.MethodGet, "/api/account/sessions", cookieB, nil)
	e.do(t, http.MethodPost, "/api/auth/signout", cookieB, nil)

	logs := e.logBuf.String()
	if logs == "" {
		t.Fatal("no logs captured; expected request lines")
	}
	for _, secret := range []string{accountID, cookieA, cookieB} {
		if secret != "" && strings.Contains(logs, secret) {
			t.Errorf("the log leaked a session value %q:\n%s", secret, logs)
		}
	}
	if !strings.Contains(logs, "/api/account/sessions") {
		t.Errorf("expected a metadata request line for /api/account/sessions:\n%s", logs)
	}
}

// --- decode helper ----------------------------------------------------------

type sessionBody struct {
	ID         string  `json:"id"`
	Current    bool    `json:"current"`
	LastUsedAt string  `json:"lastUsedAt"`
	Device     *string `json:"device"`
}

func sessionsOf(t *testing.T, body []byte) []sessionBody {
	t.Helper()
	var list struct {
		Sessions []sessionBody `json:"sessions"`
	}
	if err := json.Unmarshal(body, &list); err != nil {
		t.Fatalf("decoding SessionList: %v; body=%s", err, body)
	}
	return list.Sessions
}
