package server

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"estantedecifras.app/service/internal/db"
	"estantedecifras.app/service/internal/emaillink"
	"estantedecifras.app/service/internal/session"
)

// These behavior tests drive the real Handler through httptest against the
// compose Postgres (ESTANTE_TEST_DATABASE_URL, which scripts/gate exports),
// with a recording fake Mailer. Each test migrates into a freshly-created,
// uniquely-named schema and drops it, as the db behavior tests do; a standalone
// `go test` with the DSN unset skips, staying green (service.email_links
// refinement, behavior level).

const testLinkSecretHex = "746573742d6c696e6b2d7365637265742d6279746573"

// recordingMailer is the Mailer the behavior tests inject: it records what
// would be sent instead of speaking SMTP, so the request handler is exercised
// end-to-end without a relay.
type recordingMailer struct {
	mu   sync.Mutex
	sent []sentMail
}

// sentMail is one recorded mail: its kind (mailSignIn, mailRecoveryLink,
// mailRecoveryChanged), its recipient, and the link it carries ("" for the
// link-less change notice).
type sentMail struct {
	Kind string
	To   string
	Link string
}

const (
	mailSignIn          = "sign-in"
	mailRecoveryLink    = "recovery-link"
	mailRecoveryChanged = "recovery-changed"
)

func (m *recordingMailer) record(s sentMail) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sent = append(m.sent, s)
	return nil
}

func (m *recordingMailer) SendSignInLink(_ context.Context, to, link string) error {
	return m.record(sentMail{Kind: mailSignIn, To: to, Link: link})
}

func (m *recordingMailer) SendRecoveryEmailLink(_ context.Context, to, link string) error {
	return m.record(sentMail{Kind: mailRecoveryLink, To: to, Link: link})
}

func (m *recordingMailer) SendRecoveryEmailChanged(_ context.Context, to string) error {
	return m.record(sentMail{Kind: mailRecoveryChanged, To: to})
}

func (m *recordingMailer) messages() []sentMail {
	m.mu.Lock()
	defer m.mu.Unlock()
	return append([]sentMail(nil), m.sent...)
}

// linksEnv is a migrated schema, the real Handler wired to it with a recording
// mailer and a known secret, an httptest server, and a buffer capturing the
// service's logs so the no-secret-in-logs rule can be asserted.
type linksEnv struct {
	pool   *pgxpool.Pool
	mailer *recordingMailer
	secret []byte
	server *httptest.Server
	logBuf *bytes.Buffer
}

func newLinksEnv(t *testing.T) *linksEnv {
	t.Helper()
	pool := migratedServerSchema(t)

	secret, err := hex.DecodeString(testLinkSecretHex)
	if err != nil {
		t.Fatalf("decoding test secret: %v", err)
	}
	m := &recordingMailer{}
	var logBuf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&logBuf, nil))

	api := &APIDeps{
		DB:            pool,
		Mailer:        m,
		LinkSecret:    secret,
		PublicBaseURL: "https://estante.test",
	}
	h, err := Handler(logger, newTestAppRoot(t), pool, api)
	if err != nil {
		t.Fatalf("Handler: %v", err)
	}
	ts := httptest.NewServer(h)
	t.Cleanup(ts.Close)

	return &linksEnv{pool: pool, mailer: m, secret: secret, server: ts, logBuf: &logBuf}
}

// migratedServerSchema mirrors the db package's helper: a pool pinned to a
// throwaway schema, migrated empty→latest, dropped on cleanup. It skips when
// the DSN is unset so a standalone `go test` stays green.
func migratedServerSchema(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := envDSN(t)
	schema := "est_test_" + randHex(t)

	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatalf("ParseConfig: %v", err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema

	ctx := context.Background()
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatalf("NewWithConfig: %v", err)
	}
	t.Cleanup(func() {
		dropCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := pool.Exec(dropCtx, `DROP SCHEMA IF EXISTS "`+schema+`" CASCADE`); err != nil {
			t.Logf("dropping schema %s: %v", schema, err)
		}
		pool.Close()
	})

	if _, err := pool.Exec(ctx, `CREATE SCHEMA "`+schema+`"`); err != nil {
		t.Fatalf("CREATE SCHEMA %s: %v", schema, err)
	}
	if err := db.Migrate(ctx, pool); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	return pool
}

func envDSN(t *testing.T) string {
	t.Helper()
	dsn := os.Getenv("ESTANTE_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("ESTANTE_TEST_DATABASE_URL is unset; this behavior test needs the compose Postgres (scripts/gate provides it)")
	}
	return dsn
}

func randHex(t *testing.T) string {
	t.Helper()
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		t.Fatalf("rand: %v", err)
	}
	return hex.EncodeToString(b[:])
}

// seedAccount inserts an account with the given email and returns its id.
func (e *linksEnv) seedAccount(t *testing.T, email string) string {
	t.Helper()
	var id string
	if err := e.pool.QueryRow(context.Background(),
		`INSERT INTO accounts (email) VALUES ($1) RETURNING id`, email).Scan(&id); err != nil {
		t.Fatalf("seed account: %v", err)
	}
	return id
}

func (e *linksEnv) countRows(t *testing.T, query string, args ...any) int {
	t.Helper()
	var n int
	if err := e.pool.QueryRow(context.Background(), query, args...).Scan(&n); err != nil {
		t.Fatalf("count (%s): %v", query, err)
	}
	return n
}

// postJSON POSTs a JSON body to the test server without following redirects or
// managing cookies, so the raw status and Set-Cookie header are visible.
func (e *linksEnv) postJSON(t *testing.T, path, body string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, e.server.URL+path, strings.NewReader(body))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("POST %s: %v", path, err)
	}
	return resp
}

// TestRequestForSeededAccountMailsOneLink pins requestEmailLink's 202 for an
// address that has an account (openapi.yaml:181-183; workflow 13 lines 25-27):
// one message recorded, one email_login_links row.
func TestRequestForSeededAccountMailsOneLink(t *testing.T) {
	e := newLinksEnv(t)
	email := "player-" + randHex(t) + "@estante.test"
	e.seedAccount(t, email)

	resp := e.postJSON(t, "/api/auth/email/request", `{"email":"`+email+`"}`)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		t.Errorf("status = %d, want 202", resp.StatusCode)
	}

	sent := e.mailer.messages()
	if len(sent) != 1 {
		t.Fatalf("recorded %d messages, want exactly 1", len(sent))
	}
	if sent[0].To != email {
		t.Errorf("message to %q, want %q", sent[0].To, email)
	}
	if n := e.countRows(t, `SELECT count(*) FROM email_login_links`); n != 1 {
		t.Errorf("email_login_links has %d rows, want 1", n)
	}
}

// TestRequestForUnknownAddressIsIndistinguishable pins "never reveals who has
// an account" (openapi.yaml:169-172): an address with no account still answers
// 202, but nothing is mailed and no row is written.
func TestRequestForUnknownAddressIsIndistinguishable(t *testing.T) {
	e := newLinksEnv(t)
	email := "nobody-" + randHex(t) + "@estante.test"

	resp := e.postJSON(t, "/api/auth/email/request", `{"email":"`+email+`"}`)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		t.Errorf("status = %d, want 202 for an unknown address", resp.StatusCode)
	}
	if sent := e.mailer.messages(); len(sent) != 0 {
		t.Errorf("recorded %d messages for an unknown address, want 0", len(sent))
	}
	if n := e.countRows(t, `SELECT count(*) FROM email_login_links`); n != 0 {
		t.Errorf("email_login_links has %d rows for an unknown address, want 0", n)
	}
}

// TestRequestMalformedBodyIs400 pins openapi.yaml:184-185: a body that does not
// conform is 400, and nothing is mailed.
func TestRequestMalformedBodyIs400(t *testing.T) {
	e := newLinksEnv(t)

	for _, body := range []string{`{`, `{"email":"not-an-address"}`, `{"email":123}`, `{"nope":"x"}`} {
		resp := e.postJSON(t, "/api/auth/email/request", body)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("POST request %q status = %d, want 400", body, resp.StatusCode)
		}
		resp.Body.Close()
	}
	if sent := e.mailer.messages(); len(sent) != 0 {
		t.Errorf("recorded %d messages for malformed bodies, want 0", len(sent))
	}
}

// requestTokenFor seeds an account, requests a link, and returns the token the
// mailed link carries — the behavior path a redeem test starts from.
func (e *linksEnv) requestTokenFor(t *testing.T, email string) string {
	t.Helper()
	e.seedAccount(t, email)
	resp := e.postJSON(t, "/api/auth/email/request", `{"email":"`+email+`"}`)
	resp.Body.Close()
	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("request status = %d, want 202", resp.StatusCode)
	}
	sent := e.mailer.messages()
	if len(sent) != 1 {
		t.Fatalf("recorded %d messages, want 1", len(sent))
	}
	const marker = "/sign-in/"
	i := strings.Index(sent[0].Link, marker)
	if i < 0 {
		t.Fatalf("mailed link %q has no %q segment", sent[0].Link, marker)
	}
	return sent[0].Link[i+len(marker):]
}

// TestRedeemValidTokenStartsSession pins redeemEmailLink 200 + cookie
// (openapi.yaml:187-209, 700-707; DIRECTION §3.3 lines 170-171, 184): a valid
// token returns the Account, sets estante_session HttpOnly/Secure/SameSite=Lax/
// Path=/, and writes one sessions row for the account.
func TestRedeemValidTokenStartsSession(t *testing.T) {
	e := newLinksEnv(t)
	email := "player-" + randHex(t) + "@estante.test"
	var accountID string
	if err := e.pool.QueryRow(context.Background(),
		`INSERT INTO accounts (email) VALUES ($1) RETURNING id`, email).Scan(&accountID); err != nil {
		t.Fatalf("seed account: %v", err)
	}
	// Request a link for the seeded account and pull its token.
	resp := e.postJSON(t, "/api/auth/email/request", `{"email":"`+email+`"}`)
	resp.Body.Close()
	sent := e.mailer.messages()
	if len(sent) != 1 {
		t.Fatalf("recorded %d messages, want 1", len(sent))
	}
	token := sent[0].Link[strings.Index(sent[0].Link, "/sign-in/")+len("/sign-in/"):]

	resp = e.postJSON(t, "/api/auth/email/redeem", `{"token":"`+token+`"}`)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("redeem status = %d, want 200", resp.StatusCode)
	}

	var acct struct {
		ID string `json:"id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&acct); err != nil {
		t.Fatalf("decoding Account: %v", err)
	}
	if acct.ID != accountID {
		t.Errorf("Account.id = %q, want %q", acct.ID, accountID)
	}

	assertSessionCookie(t, resp)

	if n := e.countRows(t, `SELECT count(*) FROM sessions WHERE account_id = $1`, accountID); n != 1 {
		t.Errorf("sessions for the account = %d, want 1", n)
	}
}

// assertSessionCookie checks the estante_session cookie is set with the
// required attributes (HttpOnly, Secure, SameSite=Lax, Path=/).
func assertSessionCookie(t *testing.T, resp *http.Response) {
	t.Helper()
	var raw string
	for _, c := range resp.Header.Values("Set-Cookie") {
		if strings.HasPrefix(c, session.CookieName+"=") {
			raw = c
			break
		}
	}
	if raw == "" {
		t.Fatalf("no %s cookie set; Set-Cookie = %v", session.CookieName, resp.Header.Values("Set-Cookie"))
	}
	for _, want := range []string{"HttpOnly", "Secure", "SameSite=Lax", "Path=/"} {
		if !strings.Contains(raw, want) {
			t.Errorf("session cookie %q missing attribute %q", raw, want)
		}
	}
	// The value must be non-empty (the session id).
	if v := strings.TrimPrefix(strings.SplitN(raw, ";", 2)[0], session.CookieName+"="); v == "" {
		t.Error("session cookie has an empty value, want the session id")
	}
}

// TestRedeemExpiredTokenIsRefused pins the .tji "an expired … link refused": a
// token for a row already past its expiry is 401, with no session and no
// sessions row.
func TestRedeemExpiredTokenIsRefused(t *testing.T) {
	e := newLinksEnv(t)
	accountID := e.seedAccount(t, "player-"+randHex(t)+"@estante.test")

	// A row that expired a minute ago, with a validly signed token for its id.
	id, err := emaillink.NewID()
	if err != nil {
		t.Fatalf("NewID: %v", err)
	}
	if _, err := e.pool.Exec(context.Background(),
		`INSERT INTO email_login_links (id, account_id, expires_at) VALUES ($1, $2, now() - interval '1 minute')`,
		id, accountID); err != nil {
		t.Fatalf("insert expired link: %v", err)
	}
	token := emaillink.Mint(id, e.secret)

	resp := e.postJSON(t, "/api/auth/email/redeem", `{"token":"`+token+`"}`)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Errorf("redeem of an expired token status = %d, want 401", resp.StatusCode)
	}
	if hasSessionCookie(resp) {
		t.Error("an expired redeem set a session cookie, want none")
	}
	if n := e.countRows(t, `SELECT count(*) FROM sessions`); n != 0 {
		t.Errorf("sessions = %d after an expired redeem, want 0", n)
	}
}

// TestRedeemTwiceIsSingleUse pins the .tji "a reused link refused": the first
// redeem is 200, the second 401, and only one sessions row is ever written
// (the atomic single-use UPDATE).
func TestRedeemTwiceIsSingleUse(t *testing.T) {
	e := newLinksEnv(t)
	email := "player-" + randHex(t) + "@estante.test"
	token := e.requestTokenFor(t, email)

	first := e.postJSON(t, "/api/auth/email/redeem", `{"token":"`+token+`"}`)
	first.Body.Close()
	if first.StatusCode != http.StatusOK {
		t.Fatalf("first redeem status = %d, want 200", first.StatusCode)
	}

	second := e.postJSON(t, "/api/auth/email/redeem", `{"token":"`+token+`"}`)
	second.Body.Close()
	if second.StatusCode != http.StatusUnauthorized {
		t.Errorf("second redeem status = %d, want 401 (single use)", second.StatusCode)
	}
	if hasSessionCookie(second) {
		t.Error("the second redeem set a session cookie, want none")
	}
	if n := e.countRows(t, `SELECT count(*) FROM sessions`); n != 1 {
		t.Errorf("sessions = %d after redeeming twice, want 1", n)
	}
}

// TestRedeemTamperedOrUnknownTokenIsRefused pins redeemEmailLink 401
// (openapi.yaml:208-209): a token with a flipped signature, a token for an id
// that was never stored, and a garbage token are all refused.
func TestRedeemTamperedOrUnknownTokenIsRefused(t *testing.T) {
	e := newLinksEnv(t)
	email := "player-" + randHex(t) + "@estante.test"
	valid := e.requestTokenFor(t, email)

	// Flip the final signature character.
	b := []byte(valid)
	if b[len(b)-1] == 'A' {
		b[len(b)-1] = 'B'
	} else {
		b[len(b)-1] = 'A'
	}
	tampered := string(b)

	// A validly signed token whose id was never inserted.
	unknownID, err := emaillink.NewID()
	if err != nil {
		t.Fatalf("NewID: %v", err)
	}
	unknown := emaillink.Mint(unknownID, e.secret)

	for _, tok := range []string{tampered, unknown, "garbage", ""} {
		resp := e.postJSON(t, "/api/auth/email/redeem", `{"token":"`+tok+`"}`)
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("redeem of %q status = %d, want 401", tok, resp.StatusCode)
		}
		resp.Body.Close()
	}
	// No session was ever minted by a refused redeem (the valid token was never
	// redeemed, only tampered copies were).
	if n := e.countRows(t, `SELECT count(*) FROM sessions`); n != 0 {
		t.Errorf("sessions = %d after refused redeems, want 0", n)
	}
}

// TestNoAddressOrTokenInLogs pins the no-song-text/no-secret-in-logs rule
// (logging.go): across a request and a redeem, the captured log carries no
// email address and no token — only request metadata.
func TestNoAddressOrTokenInLogs(t *testing.T) {
	e := newLinksEnv(t)
	email := "player-" + randHex(t) + "@estante.test"
	token := e.requestTokenFor(t, email)

	resp := e.postJSON(t, "/api/auth/email/redeem", `{"token":"`+token+`"}`)
	resp.Body.Close()

	logs := e.logBuf.String()
	if logs == "" {
		t.Fatal("no logs captured; expected request lines")
	}
	if strings.Contains(logs, email) {
		t.Errorf("the log contains the email address:\n%s", logs)
	}
	if strings.Contains(logs, token) {
		t.Errorf("the log contains the token:\n%s", logs)
	}
	// The path is logged (metadata), but never the query — confirm a line exists.
	if !strings.Contains(logs, "/api/auth/email/request") || !strings.Contains(logs, "/api/auth/email/redeem") {
		t.Errorf("expected metadata-only request lines for both endpoints:\n%s", logs)
	}
}

// TestSignInLinkPageNeverLogged pins workflow 13 "Signing in on a new device"
// and "never logged": opening the mailed sign-in link's app page — plain, with
// a trailing slash, or in a non-clean form the router 301s — leaves only
// /sign-in/{token} in the captured log: no token, neither half of it, and no
// address.
func TestSignInLinkPageNeverLogged(t *testing.T) {
	e := newLinksEnv(t)
	email := "link-opener-" + randHex(t) + "@estante.test"
	token := e.requestTokenFor(t, email)
	id, sig, ok := strings.Cut(token, ".")
	if !ok || id == "" || sig == "" {
		t.Fatalf("token %q is not id.signature", token)
	}

	client := &http.Client{CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	get := func(p string) (int, string) {
		t.Helper()
		resp, err := client.Get(e.server.URL + p)
		if err != nil {
			t.Fatalf("GET %s: %v", p, err)
		}
		defer resp.Body.Close()
		b, _ := io.ReadAll(resp.Body)
		return resp.StatusCode, string(b)
	}
	for _, p := range []string{"/sign-in/" + token, "/sign-in/" + token + "/"} {
		if status, body := get(p); status != http.StatusOK || !strings.Contains(body, "estante-test") {
			t.Errorf("GET %s = %d, want 200 with the app shell", p, status)
		}
	}
	if status, _ := get("//sign-in/" + token); status != http.StatusMovedPermanently {
		t.Errorf("GET //sign-in/<token> = %d, want 301", status)
	}

	logs := e.logBuf.String()
	if !strings.Contains(logs, `"path":"/sign-in/{token}"`) {
		t.Errorf("expected a /sign-in/{token} request line:\n%s", logs)
	}
	for _, secret := range []string{token, id, sig, email} {
		if strings.Contains(logs, secret) {
			t.Errorf("the log contains %q:\n%s", secret, logs)
		}
	}
}

func hasSessionCookie(resp *http.Response) bool {
	for _, c := range resp.Header.Values("Set-Cookie") {
		if strings.HasPrefix(c, session.CookieName+"=") {
			return true
		}
	}
	return false
}
