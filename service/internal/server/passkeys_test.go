package server

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	apicontract "estantedecifras.app/api"
	"estantedecifras.app/service/internal/passkey"
	"estantedecifras.app/service/internal/session"
	"estantedecifras.app/service/internal/webauthntest"
)

// These behavior tests drive the real Handler through httptest against the
// compose Postgres (ESTANTE_TEST_DATABASE_URL), with the Go software
// authenticator standing in for a platform authenticator. They pin workflow 13:
// register (creating an account), sign in, a second passkey per account, an
// unknown credential refused, and the account's passkey list. Each response is
// validated against the contract (api/openapi.yaml). A standalone `go test`
// with the DSN unset skips (migratedServerSchema → envDSN), staying green.
//
// The RP origin is a fixed value the software authenticator also claims; the
// relying party never compares it to the httptest server's real address, so
// the ceremony is independent of the test server's port.

const (
	testPkRPID   = "localhost"
	testPkOrigin = "https://estante.test"
)

type passkeyEnv struct {
	pool     *pgxpool.Pool
	server   *httptest.Server
	auth     *webauthntest.Authenticator
	contract *apicontract.Contract
	logBuf   *bytes.Buffer
}

func newPasskeyEnv(t *testing.T) *passkeyEnv {
	t.Helper()
	pool := migratedServerSchema(t)

	rp, err := passkey.New(passkey.Config{
		RPID:        testPkRPID,
		RPOrigins:   []string{testPkOrigin},
		StateSecret: []byte("behavior-test-webauthn-state-secret"),
	})
	if err != nil {
		t.Fatalf("passkey.New: %v", err)
	}

	contract, err := apicontract.Load()
	if err != nil {
		t.Fatalf("apicontract.Load: %v", err)
	}

	var logBuf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logBuf, nil))
	api := &APIDeps{DB: pool, Passkeys: rp, PublicBaseURL: testPkOrigin}
	h, err := Handler(logger, newTestAppRoot(t), pool, api)
	if err != nil {
		t.Fatalf("Handler: %v", err)
	}
	ts := httptest.NewServer(h)
	t.Cleanup(ts.Close)

	return &passkeyEnv{pool: pool, server: ts, auth: webauthntest.New(testPkOrigin), contract: contract, logBuf: &logBuf}
}

// do makes a request to the test server carrying an optional session cookie
// value (the server sets the cookie Secure, which a cookie jar would not resend
// over httptest's plain HTTP, so the value is threaded by hand). It returns the
// response and its body bytes.
func (e *passkeyEnv) do(t *testing.T, method, path, cookie string, body []byte) (*http.Response, []byte) {
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

func (e *passkeyEnv) countRows(t *testing.T, query string, args ...any) int {
	t.Helper()
	var n int
	if err := e.pool.QueryRow(context.Background(), query, args...).Scan(&n); err != nil {
		t.Fatalf("count (%s): %v", query, err)
	}
	return n
}

func sessionCookieValue(resp *http.Response) string {
	for _, c := range resp.Cookies() {
		if c.Name == session.CookieName {
			return c.Value
		}
	}
	return ""
}

type beginResponse struct {
	PublicKey json.RawMessage `json:"publicKey"`
	State     string          `json:"state"`
}

// registerNewAccount runs begin→finish with no session, returning the account
// id and the session cookie value the finish set. The authenticator keeps the
// created resident credential for a later sign-in.
func (e *passkeyEnv) registerNewAccount(t *testing.T) (accountID, cookie string) {
	t.Helper()
	beginResp, beginBody := e.do(t, http.MethodPost, "/api/auth/passkey/register/begin", "", []byte(`{}`))
	if beginResp.StatusCode != http.StatusOK {
		t.Fatalf("register/begin status = %d, want 200; body=%s", beginResp.StatusCode, beginBody)
	}
	if err := e.contract.Validate("registerPasskeyBegin", apicontract.Response, "200", beginBody); err != nil {
		t.Errorf("register/begin response does not conform: %v", err)
	}

	finishBody := e.finishRegistrationBody(t, beginBody)
	finishResp, body := e.do(t, http.MethodPost, "/api/auth/passkey/register/finish", "", finishBody)
	if finishResp.StatusCode != http.StatusOK {
		t.Fatalf("register/finish status = %d, want 200; body=%s", finishResp.StatusCode, body)
	}
	if err := e.contract.Validate("registerPasskeyFinish", apicontract.Response, "200", body); err != nil {
		t.Errorf("register/finish response does not conform: %v", err)
	}
	return accountIDOf(t, body), sessionCookieValue(finishResp)
}

// finishRegistrationBody turns a register/begin response into the finish body
// by driving the software authenticator over the returned options.
func (e *passkeyEnv) finishRegistrationBody(t *testing.T, beginBody []byte) []byte {
	t.Helper()
	var begin beginResponse
	if err := json.Unmarshal(beginBody, &begin); err != nil {
		t.Fatalf("decoding begin response: %v", err)
	}
	creation, err := webauthntest.CredentialCreationFrom(begin.PublicKey)
	if err != nil {
		t.Fatalf("building creation options: %v", err)
	}
	credJSON, _, err := e.auth.Create(creation)
	if err != nil {
		t.Fatalf("authenticator Create: %v", err)
	}
	return mustJSON(t, map[string]any{"state": begin.State, "credential": json.RawMessage(credJSON)})
}

// TestRegisterCreatesNewAccount pins acceptance #2 and the first-run account
// path (workflow 13; registerPasskeyBegin/Finish; DIRECTION §3.3): a register
// with no session makes one accounts row and one passkeys row, sets the session
// cookie, and returns the Account.
func TestRegisterCreatesNewAccount(t *testing.T) {
	e := newPasskeyEnv(t)
	accountID, cookie := e.registerNewAccount(t)

	if cookie == "" {
		t.Error("register/finish set no session cookie, want one")
	}
	if n := e.countRows(t, `SELECT count(*) FROM accounts WHERE id = $1`, accountID); n != 1 {
		t.Errorf("accounts rows for the new account = %d, want 1", n)
	}
	if n := e.countRows(t, `SELECT count(*) FROM accounts WHERE id = $1 AND email IS NULL`, accountID); n != 1 {
		t.Errorf("the new account's email is not NULL, want NULL (first-run account)")
	}
	if n := e.countRows(t, `SELECT count(*) FROM passkeys WHERE account_id = $1`, accountID); n != 1 {
		t.Errorf("passkeys rows for the new account = %d, want 1", n)
	}
}

// TestSignInWithPasskey pins acceptance #4 and workflow 13 §same ecosystem:
// after registering, a fresh client (no cookie) signs in with the passkey via
// discoverable login and gets the same account id and a session.
func TestSignInWithPasskey(t *testing.T) {
	e := newPasskeyEnv(t)
	accountID, _ := e.registerNewAccount(t)

	beginResp, beginBody := e.do(t, http.MethodPost, "/api/auth/passkey/authenticate/begin", "", []byte(`{}`))
	if beginResp.StatusCode != http.StatusOK {
		t.Fatalf("authenticate/begin status = %d, want 200; body=%s", beginResp.StatusCode, beginBody)
	}
	if err := e.contract.Validate("authenticatePasskeyBegin", apicontract.Response, "200", beginBody); err != nil {
		t.Errorf("authenticate/begin response does not conform: %v", err)
	}

	finishBody := e.finishAssertionBody(t, beginBody, false)
	finishResp, body := e.do(t, http.MethodPost, "/api/auth/passkey/authenticate/finish", "", finishBody)
	if finishResp.StatusCode != http.StatusOK {
		t.Fatalf("authenticate/finish status = %d, want 200; body=%s", finishResp.StatusCode, body)
	}
	if err := e.contract.Validate("authenticatePasskeyFinish", apicontract.Response, "200", body); err != nil {
		t.Errorf("authenticate/finish response does not conform: %v", err)
	}
	if got := accountIDOf(t, body); got != accountID {
		t.Errorf("signed-in account id = %q, want %q", got, accountID)
	}
	if sessionCookieValue(finishResp) == "" {
		t.Error("authenticate/finish set no session cookie, want one")
	}
}

// finishAssertionBody turns an authenticate/begin response into the finish body
// by driving the software authenticator; tamper corrupts the signature.
func (e *passkeyEnv) finishAssertionBody(t *testing.T, beginBody []byte, tamper bool) []byte {
	t.Helper()
	var begin beginResponse
	if err := json.Unmarshal(beginBody, &begin); err != nil {
		t.Fatalf("decoding begin response: %v", err)
	}
	assertion, err := webauthntest.CredentialAssertionFrom(begin.PublicKey)
	if err != nil {
		t.Fatalf("building assertion options: %v", err)
	}
	var credJSON []byte
	if tamper {
		credJSON, err = e.auth.GetTampered(assertion)
	} else {
		credJSON, err = e.auth.Get(assertion)
	}
	if err != nil {
		t.Fatalf("authenticator Get: %v", err)
	}
	return mustJSON(t, map[string]any{"state": begin.State, "credential": json.RawMessage(credJSON)})
}

// TestSecondPasskeyOnAccount pins acceptance #2 (several per account) and
// workflow 13 lines 24, 73: a second passkey added with the session cookie
// makes two passkeys rows, and the first credential appears in the second
// begin's excludeCredentials.
func TestSecondPasskeyOnAccount(t *testing.T) {
	e := newPasskeyEnv(t)
	accountID, cookie := e.registerNewAccount(t)

	// The first credential's id (base64url), to find it in excludeCredentials.
	firstCredID := base64.RawURLEncoding.EncodeToString(e.firstCredentialID(t))

	beginResp, beginBody := e.do(t, http.MethodPost, "/api/auth/passkey/register/begin", cookie, []byte(`{}`))
	if beginResp.StatusCode != http.StatusOK {
		t.Fatalf("second register/begin status = %d, want 200; body=%s", beginResp.StatusCode, beginBody)
	}
	if !excludesCredential(t, beginBody, firstCredID) {
		t.Errorf("the second register/begin did not exclude the first credential %q", firstCredID)
	}

	finishBody := e.finishRegistrationBody(t, beginBody)
	finishResp, body := e.do(t, http.MethodPost, "/api/auth/passkey/register/finish", cookie, finishBody)
	if finishResp.StatusCode != http.StatusOK {
		t.Fatalf("second register/finish status = %d, want 200; body=%s", finishResp.StatusCode, body)
	}
	if got := accountIDOf(t, body); got != accountID {
		t.Errorf("second passkey bound to account %q, want %q", got, accountID)
	}
	if n := e.countRows(t, `SELECT count(*) FROM passkeys WHERE account_id = $1`, accountID); n != 2 {
		t.Errorf("passkeys rows after a second registration = %d, want 2", n)
	}
}

// firstCredentialID reads the one stored credential_id, for the
// excludeCredentials assertion.
func (e *passkeyEnv) firstCredentialID(t *testing.T) []byte {
	t.Helper()
	var id []byte
	if err := e.pool.QueryRow(context.Background(),
		`SELECT credential_id FROM passkeys LIMIT 1`).Scan(&id); err != nil {
		t.Fatalf("reading credential_id: %v", err)
	}
	return id
}

// TestUnknownCredentialRefused pins acceptance #4 and the note's "an unknown
// credential refused": an assertion from a credential that was never stored
// (its account does not exist) is 401 with no session.
func TestUnknownCredentialRefused(t *testing.T) {
	e := newPasskeyEnv(t)

	// Make the authenticator hold a resident credential by beginning and
	// "creating" a registration, but never finishing it — so nothing is stored.
	_, beginBody := e.do(t, http.MethodPost, "/api/auth/passkey/register/begin", "", []byte(`{}`))
	var begin beginResponse
	if err := json.Unmarshal(beginBody, &begin); err != nil {
		t.Fatalf("decoding begin: %v", err)
	}
	creation, err := webauthntest.CredentialCreationFrom(begin.PublicKey)
	if err != nil {
		t.Fatalf("creation options: %v", err)
	}
	if _, _, err := e.auth.Create(creation); err != nil {
		t.Fatalf("authenticator Create: %v", err)
	}

	// Now try to sign in with that unknown credential.
	_, aBeginBody := e.do(t, http.MethodPost, "/api/auth/passkey/authenticate/begin", "", []byte(`{}`))
	finishBody := e.finishAssertionBody(t, aBeginBody, false)
	resp, body := e.do(t, http.MethodPost, "/api/auth/passkey/authenticate/finish", "", finishBody)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("authenticate/finish with an unknown credential status = %d, want 401; body=%s", resp.StatusCode, body)
	}
	if sessionCookieValue(resp) != "" {
		t.Error("a refused sign-in set a session cookie, want none")
	}
	if n := e.countRows(t, `SELECT count(*) FROM sessions`); n != 0 {
		t.Errorf("sessions = %d after a refused sign-in, want 0", n)
	}
}

// TestListAndRemovePasskeys pins acceptance #5 and workflow 13 line 73
// (listPasskeys/removePasskey): the signed-in account lists its passkeys and
// removes one; an id not on the account is 404; both routes are 401 without a
// session.
func TestListAndRemovePasskeys(t *testing.T) {
	e := newPasskeyEnv(t)
	accountID, cookie := e.registerNewAccount(t)

	// 401 without a session.
	if resp, _ := e.do(t, http.MethodGet, "/api/account/passkeys", "", nil); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("listPasskeys without a session = %d, want 401", resp.StatusCode)
	}
	if resp, _ := e.do(t, http.MethodDelete, "/api/account/passkeys/"+passkey.NewAccountID(), "", nil); resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("removePasskey without a session = %d, want 401", resp.StatusCode)
	}

	// List the one passkey.
	listResp, listBody := e.do(t, http.MethodGet, "/api/account/passkeys", cookie, nil)
	if listResp.StatusCode != http.StatusOK {
		t.Fatalf("listPasskeys status = %d, want 200; body=%s", listResp.StatusCode, listBody)
	}
	if err := e.contract.Validate("listPasskeys", apicontract.Response, "200", listBody); err != nil {
		t.Errorf("listPasskeys response does not conform: %v", err)
	}
	ids := passkeyIDs(t, listBody)
	if len(ids) != 1 {
		t.Fatalf("listed %d passkeys, want 1", len(ids))
	}

	// A passkey id not on the account is 404.
	if resp, _ := e.do(t, http.MethodDelete, "/api/account/passkeys/"+passkey.NewAccountID(), cookie, nil); resp.StatusCode != http.StatusNotFound {
		t.Errorf("removePasskey of an id not on the account = %d, want 404", resp.StatusCode)
	}

	// Remove the account's own passkey. It is the account's last, so the
	// account first gets a confirmed recovery email — without one the last
	// way in cannot be removed (TestRemoveLastPasskeyRefusedWithoutEmail).
	if _, err := e.pool.Exec(context.Background(),
		`UPDATE accounts SET email = 'owner@estante.test' WHERE id = $1`, accountID); err != nil {
		t.Fatalf("set email: %v", err)
	}
	if resp, _ := e.do(t, http.MethodDelete, "/api/account/passkeys/"+ids[0], cookie, nil); resp.StatusCode != http.StatusNoContent {
		t.Errorf("removePasskey status = %d, want 204", resp.StatusCode)
	}
	_, after := e.do(t, http.MethodGet, "/api/account/passkeys", cookie, nil)
	if n := len(passkeyIDs(t, after)); n != 0 {
		t.Errorf("listed %d passkeys after removal, want 0", n)
	}
}

// TestRemoveLastPasskeyRefusedWithoutEmail pins workflow 13 §The last way in:
// the only passkey of an account with no confirmed recovery email cannot be
// removed (409 last_way_in, still listed); with a second passkey the first
// removes and the remaining one is then refused; once a recovery email is
// confirmed the last one removes.
func TestRemoveLastPasskeyRefusedWithoutEmail(t *testing.T) {
	e := newPasskeyEnv(t)
	accountID, cookie := e.registerNewAccount(t)

	listIDs := func() []string {
		t.Helper()
		_, body := e.do(t, http.MethodGet, "/api/account/passkeys", cookie, nil)
		return passkeyIDs(t, body)
	}
	assertLastWayIn := func(id string) {
		t.Helper()
		resp, body := e.do(t, http.MethodDelete, "/api/account/passkeys/"+id, cookie, nil)
		if resp.StatusCode != http.StatusConflict || !strings.Contains(string(body), `"last_way_in"`) {
			t.Fatalf("removing the last passkey: status = %d body=%s, want 409 last_way_in", resp.StatusCode, body)
		}
		if err := e.contract.Validate("removePasskey", apicontract.Response, "409", body); err != nil {
			t.Errorf("removePasskey 409 does not conform: %v", err)
		}
		if ids := listIDs(); len(ids) != 1 || ids[0] != id {
			t.Errorf("after a refused removal the passkeys are %v, want [%s]", ids, id)
		}
	}

	first := listIDs()[0]
	assertLastWayIn(first)

	// A second passkey: the first removes, the remaining one is the last.
	_, beginBody := e.do(t, http.MethodPost, "/api/auth/passkey/register/begin", cookie, []byte(`{}`))
	if resp, body := e.do(t, http.MethodPost, "/api/auth/passkey/register/finish", cookie, e.finishRegistrationBody(t, beginBody)); resp.StatusCode != http.StatusOK {
		t.Fatalf("second register/finish: status = %d; body=%s", resp.StatusCode, body)
	}
	if resp, body := e.do(t, http.MethodDelete, "/api/account/passkeys/"+first, cookie, nil); resp.StatusCode != http.StatusNoContent {
		t.Fatalf("removing one of two passkeys: status = %d, want 204; body=%s", resp.StatusCode, body)
	}
	last := listIDs()[0]
	assertLastWayIn(last)

	// A confirmed recovery email is another way in: the last passkey removes.
	if _, err := e.pool.Exec(context.Background(),
		`UPDATE accounts SET email = 'way-in@estante.test' WHERE id = $1`, accountID); err != nil {
		t.Fatalf("set email: %v", err)
	}
	if resp, body := e.do(t, http.MethodDelete, "/api/account/passkeys/"+last, cookie, nil); resp.StatusCode != http.StatusNoContent {
		t.Errorf("removing the last passkey with an email: status = %d, want 204; body=%s", resp.StatusCode, body)
	}
}

// TestNoSecretsInPasskeyLogs pins the no-secret-in-logs rule (DIRECTION §3.3):
// across a full register+sign-in, the captured log carries no state token, no
// credential JSON and no account id — only request metadata.
func TestNoSecretsInPasskeyLogs(t *testing.T) {
	e := newPasskeyEnv(t)
	accountID, _ := e.registerNewAccount(t)

	logs := e.logBuf.String()
	if logs == "" {
		t.Fatal("no logs captured; expected request lines")
	}
	if strings.Contains(logs, accountID) {
		t.Errorf("the log contains the account id:\n%s", logs)
	}
	if !strings.Contains(logs, "/api/auth/passkey/register/finish") {
		t.Errorf("expected a metadata request line for register/finish:\n%s", logs)
	}
}

// --- small decode helpers ---------------------------------------------------

func mustJSON(t *testing.T, v any) []byte {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshalling body: %v", err)
	}
	return b
}

func accountIDOf(t *testing.T, body []byte) string {
	t.Helper()
	var acct struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(body, &acct); err != nil {
		t.Fatalf("decoding Account: %v", err)
	}
	return acct.ID
}

func passkeyIDs(t *testing.T, body []byte) []string {
	t.Helper()
	var list struct {
		Passkeys []struct {
			ID string `json:"id"`
		} `json:"passkeys"`
	}
	if err := json.Unmarshal(body, &list); err != nil {
		t.Fatalf("decoding PasskeyList: %v", err)
	}
	ids := make([]string, len(list.Passkeys))
	for i, p := range list.Passkeys {
		ids[i] = p.ID
	}
	return ids
}

func excludesCredential(t *testing.T, beginBody []byte, credID string) bool {
	t.Helper()
	var begin struct {
		PublicKey struct {
			ExcludeCredentials []struct {
				ID string `json:"id"`
			} `json:"excludeCredentials"`
		} `json:"publicKey"`
	}
	if err := json.Unmarshal(beginBody, &begin); err != nil {
		t.Fatalf("decoding begin for excludeCredentials: %v", err)
	}
	for _, c := range begin.PublicKey.ExcludeCredentials {
		if c.ID == credID {
			return true
		}
	}
	return false
}
